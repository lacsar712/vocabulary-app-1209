const express = require('express');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const QUESTION_TYPES = ['word_choice', 'definition_fill', 'audio_recognition'];
const TOTAL_QUESTIONS = 5;

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function generateDailyQuestions(vocabSize, callback) {
    const today = getTodayDate();

    db.get("SELECT COUNT(*) as count FROM daily_challenge_questions WHERE challenge_date = ?", [today], (err, row) => {
        if (err) return callback(err);

        if (row.count > 0) {
            return callback(null, true);
        }

        const targetRank = vocabSize || 3000;
        const rankMin = Math.max(100, targetRank - 1500);
        const rankMax = targetRank + 2000;

        const sql = `
            SELECT * FROM words 
            WHERE rank BETWEEN ? AND ?
            ORDER BY ABS(rank - ?) ASC, RANDOM()
            LIMIT 20
        `;

        db.all(sql, [rankMin, rankMax, targetRank], (err, words) => {
            if (err) return callback(err);
            if (words.length < TOTAL_QUESTIONS) {
                db.all("SELECT * FROM words ORDER BY RANDOM() LIMIT 20", (err, fallbackWords) => {
                    if (err) return callback(err);
                    insertDailyQuestions(fallbackWords, today, callback);
                });
            } else {
                insertDailyQuestions(words, today, callback);
            }
        });
    });
}

function insertDailyQuestions(words, today, callback) {
    const selectedWords = shuffleArray(words).slice(0, TOTAL_QUESTIONS);
    const stmt = db.prepare(`
        INSERT INTO daily_challenge_questions 
        (challenge_date, question_index, question_type, word_id, options, correct_answer)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    let completed = 0;
    let hadError = false;

    selectedWords.forEach((word, index) => {
        if (hadError) return;

        const questionType = QUESTION_TYPES[index % QUESTION_TYPES.length];
        let options = null;
        let correctAnswer = '';

        if (questionType === 'word_choice') {
            const correctDef = word.definition;
            correctAnswer = correctDef;

            db.all("SELECT definition FROM words WHERE id != ? ORDER BY RANDOM() LIMIT 3", [word.id], (err, wrongDefs) => {
                if (err) {
                    hadError = true;
                    return callback(err);
                }
                const allOptions = shuffleArray([correctDef, ...wrongDefs.map(w => w.definition)]);
                options = JSON.stringify(allOptions);

                stmt.run(today, index, questionType, word.id, options, correctAnswer, (runErr) => {
                    if (runErr) {
                        hadError = true;
                        return callback(runErr);
                    }
                    completed++;
                    if (completed === TOTAL_QUESTIONS) {
                        stmt.finalize();
                        callback(null, false);
                    }
                });
            });
        } else if (questionType === 'definition_fill') {
            correctAnswer = word.word;
            stmt.run(today, index, questionType, word.id, null, correctAnswer, (runErr) => {
                if (runErr) {
                    hadError = true;
                    return callback(runErr);
                }
                completed++;
                if (completed === TOTAL_QUESTIONS) {
                    stmt.finalize();
                    callback(null, false);
                }
            });
        } else if (questionType === 'audio_recognition') {
            correctAnswer = word.word;
            db.all("SELECT word FROM words WHERE id != ? ORDER BY RANDOM() LIMIT 3", [word.id], (err, wrongWords) => {
                if (err) {
                    hadError = true;
                    return callback(err);
                }
                const allOptions = shuffleArray([word.word, ...wrongWords.map(w => w.word)]);
                options = JSON.stringify(allOptions);

                stmt.run(today, index, questionType, word.id, options, correctAnswer, (runErr) => {
                    if (runErr) {
                        hadError = true;
                        return callback(runErr);
                    }
                    completed++;
                    if (completed === TOTAL_QUESTIONS) {
                        stmt.finalize();
                        callback(null, false);
                    }
                });
            });
        }
    });
}

router.get('/', authenticate, (req, res) => {
    const today = getTodayDate();

    db.get("SELECT vocab_size FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });

        const vocabSize = user?.vocab_size || 3000;

        generateDailyQuestions(vocabSize, (genErr) => {
            if (genErr) return res.status(500).json({ error: genErr.message });

            db.get(`
                SELECT * FROM daily_challenge_submissions 
                WHERE user_id = ? AND challenge_date = ?
            `, [req.user.id, today], (subErr, submission) => {
                if (subErr) return res.status(500).json({ error: subErr.message });

                const sql = `
                    SELECT dcq.*, w.word, w.pronunciation, w.pos, w.definition, w.example, w.rank, w.difficulty_level
                    FROM daily_challenge_questions dcq
                    JOIN words w ON dcq.word_id = w.id
                    WHERE dcq.challenge_date = ?
                    ORDER BY dcq.question_index ASC
                `;

                db.all(sql, [today], (qErr, questions) => {
                    if (qErr) return res.status(500).json({ error: qErr.message });

                    const formattedQuestions = questions.map(q => ({
                        id: q.id,
                        index: q.question_index,
                        type: q.question_type,
                        word: {
                            id: q.word_id,
                            word: q.word,
                            pronunciation: q.pronunciation,
                            pos: q.pos,
                            definition: q.definition,
                            example: q.example,
                            rank: q.rank,
                            difficulty_level: q.difficulty_level
                        },
                        options: q.options ? JSON.parse(q.options) : null,
                        correct_answer: q.correct_answer
                    }));

                    if (submission) {
                        res.json({
                            status: 'completed',
                            questions: formattedQuestions,
                            submission: {
                                score: submission.score,
                                total_questions: submission.total_questions,
                                time_spent: submission.time_spent,
                                answers: JSON.parse(submission.answers),
                                submitted_at: submission.submitted_at
                            }
                        });
                    } else {
                        res.json({
                            status: 'available',
                            questions: formattedQuestions.map(q => ({
                                ...q,
                                correct_answer: undefined
                            }))
                        });
                    }
                });
            });
        });
    });
});

router.post('/submit', authenticate, (req, res) => {
    const today = getTodayDate();
    const { answers, time_spent } = req.body;

    if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: 'Answers are required' });
    }

    db.get(`
        SELECT * FROM daily_challenge_submissions 
        WHERE user_id = ? AND challenge_date = ?
    `, [req.user.id, today], (checkErr, existing) => {
        if (checkErr) return res.status(500).json({ error: checkErr.message });
        if (existing) {
            return res.status(400).json({ error: '今日挑战已完成，每人每天只能提交一次' });
        }

        const sql = `
            SELECT dcq.*, w.word, w.definition
            FROM daily_challenge_questions dcq
            JOIN words w ON dcq.word_id = w.id
            WHERE dcq.challenge_date = ?
            ORDER BY dcq.question_index ASC
        `;

        db.all(sql, [today], (qErr, questions) => {
            if (qErr) return res.status(500).json({ error: qErr.message });

            let score = 0;
            const detailedAnswers = questions.map((q, index) => {
                const userAnswer = answers[index] || '';
                const isCorrect = userAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
                if (isCorrect) score++;

                return {
                    question_index: q.question_index,
                    question_type: q.question_type,
                    word_id: q.word_id,
                    word: q.word,
                    definition: q.definition,
                    user_answer: userAnswer,
                    correct_answer: q.correct_answer,
                    is_correct: isCorrect
                };
            });

            db.run(`
                INSERT INTO daily_challenge_submissions 
                (user_id, challenge_date, score, total_questions, time_spent, answers)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                req.user.id, 
                today, 
                score, 
                TOTAL_QUESTIONS, 
                time_spent || 0, 
                JSON.stringify(detailedAnswers)
            ], function(insertErr) {
                if (insertErr) return res.status(500).json({ error: insertErr.message });

                res.json({
                    score,
                    total_questions: TOTAL_QUESTIONS,
                    time_spent: time_spent || 0,
                    answers: detailedAnswers
                });
            });
        });
    });
});

router.get('/stats', authenticate, (req, res) => {
    const today = getTodayDate();

    db.get(`
        SELECT 
            COUNT(*) as completed_count,
            AVG(score) as avg_score,
            AVG(time_spent) as avg_time
        FROM daily_challenge_submissions 
        WHERE challenge_date = ?
    `, [today], (err, stats) => {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
            date: today,
            completed_count: stats?.completed_count || 0,
            avg_score: stats?.avg_score ? Math.round(stats.avg_score * 10) / 10 : 0,
            avg_time: stats?.avg_time ? Math.round(stats.avg_time) : 0
        });
    });
});

module.exports = router;
