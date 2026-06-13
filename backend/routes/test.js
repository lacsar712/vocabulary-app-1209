const express = require('express');
const db = require('../database');
const achievements = require('../achievements');
const vocabEstimation = require('../services/vocabEstimation');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/words', (req, res) => {
    const sql = `
        SELECT * FROM words
        ORDER BY difficulty_level ASC, RANDOM()
    `;
    db.all(sql, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/next-word', authenticate, (req, res) => {
    const { currentAbility, answeredWordIds } = req.body;

    const excludeIds = answeredWordIds && answeredWordIds.length > 0
        ? answeredWordIds.join(',')
        : '0';

    const sql = `
        SELECT *, ABS(rank - ?) as distance
        FROM words
        WHERE id NOT IN (${excludeIds})
        ORDER BY distance ASC, RANDOM()
        LIMIT 1
    `;

    db.get(sql, [currentAbility], (err, word) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!word) return res.json({ finished: true });
        res.json(word);
    });
});

router.post('/submit', authenticate, (req, res) => {
    const { answers } = req.body;

    if (!answers || answers.length === 0) {
        return res.status(400).json({ error: "No answers provided" });
    }

    const testResult = vocabEstimation.estimateVocabulary(answers);
    const estimatedVocab = testResult.vocab_size;

    const stmt = db.prepare(`
        INSERT INTO test_history (user_id, word_id, is_correct, word_rank)
        VALUES (?, ?, ?, ?)
    `);

    answers.forEach(a => {
        stmt.run(req.user.id, a.wordId, a.isCorrect ? 1 : 0, a.rank);
    });
    stmt.finalize();

    db.get("SELECT vocab_size FROM users WHERE id = ?", [req.user.id], (err, user) => {
        const oldVocabSize = user?.vocab_size || 0;

        db.run("UPDATE users SET vocab_size = ? WHERE id = ?", [estimatedVocab, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            let allNewAchievements = [];
            let checksDone = 0;
            const totalChecks = 2;

            function checkDone() {
                checksDone++;
                if (checksDone === totalChecks) {
                    const achievementDetails = allNewAchievements.map(a => {
                        const def = achievements.getAllAchievements().find(ach => ach.id === a.achievement_id);
                        return { ...a, name: def?.name, description: def?.description, icon: def?.icon };
                    });
                    res.json({
                        ...testResult,
                        new_achievements: achievementDetails
                    });
                }
            }

            achievements.checkTestAchievements(req.user.id, testResult, (achErr, newAch) => {
                if (achErr) console.error('Error checking test achievements:', achErr);
                allNewAchievements = [...allNewAchievements, ...(newAch || [])];
                checkDone();
            });

            achievements.checkVocabLeapAchievement(req.user.id, oldVocabSize, estimatedVocab, (achErr, newAch) => {
                if (achErr) console.error('Error checking vocab leap achievement:', achErr);
                allNewAchievements = [...allNewAchievements, ...(newAch || [])];
                checkDone();
            });
        });
    });
});

module.exports = router;
