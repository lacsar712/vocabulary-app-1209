const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const achievements = require('./achievements');
const app = express();
const PORT = 3000;
const SECRET_KEY = "supersecretkey_vocabulary_1209"; // In prod, use .env

app.use(cors());
app.use(express.json());

// Middleware to authenticate
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token.split(' ')[1], SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
};

// Auth Routes
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    db.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, hash], function (err) {
        if (err) return res.status(400).json({ error: "用户名已存在" });
        res.json({ id: this.lastID, username, vocab_size: 0 });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (!user || applyPasswordCheck(password, user)) return res.status(401).json({ error: "无效的用户名或密码" });
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, vocab_size: user.vocab_size } });
    });
});

function applyPasswordCheck(password, user) {
    return !bcrypt.compareSync(password, user.password_hash);
}

// User Profile
app.get('/api/me', authenticate, (req, res) => {
    db.get("SELECT id, username, vocab_size, created_at FROM users WHERE id = ?", [req.user.id], (err, row) => {
        res.json(row);
    });
});

// Vocab Test Routes
// Adaptive test: Start with medium difficulty, adjust based on answers
app.get('/api/test/words', (req, res) => {
    // Get words from each difficulty level for adaptive testing
    // Returns words grouped by difficulty for frontend to implement adaptive logic
    const sql = `
        SELECT * FROM words
        ORDER BY difficulty_level ASC, RANDOM()
    `;
    db.all(sql, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get next adaptive test word based on current ability estimate
app.post('/api/test/next-word', authenticate, (req, res) => {
    const { currentAbility, answeredWordIds } = req.body;
    // currentAbility: estimated rank level (starts at 3000)
    // answeredWordIds: array of word IDs already answered

    const excludeIds = answeredWordIds && answeredWordIds.length > 0
        ? answeredWordIds.join(',')
        : '0';

    // Find word closest to current ability estimate
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

// Submit test result with detailed answer data for accurate estimation
app.post('/api/test/submit', authenticate, (req, res) => {
    const { answers } = req.body;
    // answers: [{ wordId, rank, isCorrect }]

    if (!answers || answers.length === 0) {
        return res.status(400).json({ error: "No answers provided" });
    }

    // Binary search estimation using Item Response Theory (IRT) simplified
    // Find the rank threshold where user transitions from knowing to not knowing
    const sortedAnswers = [...answers].sort((a, b) => a.rank - b.rank);

    let correctByRank = sortedAnswers.map(a => ({
        rank: a.rank,
        correct: a.isCorrect ? 1 : 0
    }));

    // Calculate weighted average based on correct/incorrect boundary
    // Words answered correctly contribute their rank, incorrect ones don't
    let totalWeight = 0;
    let weightedSum = 0;

    correctByRank.forEach((item, index) => {
        const weight = item.correct ? 1.5 : 0.5;
        weightedSum += item.rank * weight * (item.correct ? 1 : 0.3);
        totalWeight += weight * (item.correct ? 1 : 0.3);
    });

    // Find the highest rank where user got correct
    const correctAnswers = sortedAnswers.filter(a => a.isCorrect);
    const incorrectAnswers = sortedAnswers.filter(a => !a.isCorrect);

    let estimatedVocab;

    if (correctAnswers.length === 0) {
        // All wrong - estimate at lowest rank
        estimatedVocab = Math.min(...sortedAnswers.map(a => a.rank)) * 0.5;
    } else if (incorrectAnswers.length === 0) {
        // All correct - estimate above highest tested rank
        estimatedVocab = Math.max(...sortedAnswers.map(a => a.rank)) * 1.2;
    } else {
        // Mixed results - find the boundary
        const maxCorrectRank = Math.max(...correctAnswers.map(a => a.rank));
        const minIncorrectRank = Math.min(...incorrectAnswers.map(a => a.rank));

        // Estimate is between highest correct and lowest incorrect
        // Weight towards correct answers
        const correctRatio = correctAnswers.length / answers.length;
        estimatedVocab = maxCorrectRank * 0.7 + minIncorrectRank * 0.3;

        // Adjust based on overall performance
        estimatedVocab = estimatedVocab * (0.8 + correctRatio * 0.4);
    }

    estimatedVocab = Math.round(Math.max(100, Math.min(10000, estimatedVocab)));

    // Record test history
    const stmt = db.prepare(`
        INSERT INTO test_history (user_id, word_id, is_correct, word_rank)
        VALUES (?, ?, ?, ?)
    `);

    answers.forEach(a => {
        stmt.run(req.user.id, a.wordId, a.isCorrect ? 1 : 0, a.rank);
    });
    stmt.finalize();

    // Get old vocab size for leap achievement check
    db.get("SELECT vocab_size FROM users WHERE id = ?", [req.user.id], (err, user) => {
        const oldVocabSize = user?.vocab_size || 0;
        
        // Update user vocab size
        db.run("UPDATE users SET vocab_size = ? WHERE id = ?", [estimatedVocab, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const testResult = {
                vocab_size: estimatedVocab,
                correct_count: correctAnswers.length,
                total_questions: answers.length,
                accuracy: Math.round((correctAnswers.length / answers.length) * 100)
            };
            
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

// Get multiple recommendations for batch learning
app.get('/api/recommend/batch', authenticate, (req, res) => {
    const limit = parseInt(req.query.limit) || 5;

    db.get("SELECT vocab_size FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (!user) return res.status(404).json({ error: "用户未找到" });

        const i = user.vocab_size;

        const sql = `
            SELECT w.*,
                   CASE
                       WHEN w.rank BETWEEN ? AND ? THEN 100
                       WHEN w.rank BETWEEN ? AND ? THEN 80
                       WHEN w.rank < ? THEN 60
                       ELSE 40
                   END as level_score,
                   (w.frequency * 10) as frequency_score
            FROM words w
            WHERE w.id NOT IN (
                SELECT word_id FROM learning_history
                WHERE user_id = ? AND status = 'learned'
            )
            ORDER BY (level_score + frequency_score) DESC, w.rank ASC
            LIMIT ?
        `;

        db.all(sql, [i, i + 1500, i + 1500, i + 3000, i, req.user.id, limit], (err, words) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(words);
        });
    });
});

// Mark word as learned
app.post('/api/learn/record', authenticate, (req, res) => {
    const { word_id, status } = req.body; // status: 'learned'
    db.run("INSERT INTO learning_history (user_id, word_id, status) VALUES (?, ?, ?)", [req.user.id, word_id, status || 'learned'], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        achievements.checkLearningAchievements(req.user.id, (achErr, newAchievements) => {
            if (achErr) {
                console.error('Error checking learning achievements:', achErr);
                return res.json({ success: true, new_achievements: [] });
            }
            
            const achievementDetails = newAchievements.map(a => {
                const def = achievements.getAllAchievements().find(ach => ach.id === a.achievement_id);
                return { ...a, name: def?.name, description: def?.description, icon: def?.icon };
            });
            
            res.json({ success: true, new_achievements: achievementDetails });
        });
    });
});

// Statistics
app.get('/api/stats', authenticate, (req, res) => {
    // Get history with word details
    const sql = `
        SELECT lh.*, w.word, w.definition, w.pronunciation 
        FROM learning_history lh
        JOIN words w ON lh.word_id = w.id
        WHERE lh.user_id = ?
        ORDER BY lh.updated_at DESC
    `;
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ learned_count: rows.length, history: rows });
    });
});

// Learning Calendar - Get daily aggregated data for a month
app.get('/api/calendar', authenticate, (req, res) => {
    const { year, month } = req.query;
    
    if (!year || !month) {
        return res.status(400).json({ error: "Year and month are required" });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    const endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-31`;

    const sql = `
        SELECT 
            DATE(lh.updated_at) as date,
            COUNT(DISTINCT lh.word_id) as word_count
        FROM learning_history lh
        WHERE lh.user_id = ?
        AND lh.status = 'learned'
        AND DATE(lh.updated_at) BETWEEN ? AND ?
        GROUP BY DATE(lh.updated_at)
        ORDER BY date ASC
    `;

    db.all(sql, [req.user.id, startDate, endDate], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const dailyData = {};
        rows.forEach(row => {
            dailyData[row.date] = row.word_count;
        });
        
        res.json({
            year: yearNum,
            month: monthNum,
            daily_data: dailyData
        });
    });
});

// Learning Calendar - Get detailed words for a specific day
app.get('/api/calendar/day', authenticate, (req, res) => {
    const { date } = req.query;
    
    if (!date) {
        return res.status(400).json({ error: "Date is required" });
    }

    const sql = `
        SELECT 
            lh.id,
            lh.word_id,
            lh.status,
            lh.updated_at,
            w.word,
            w.pronunciation,
            w.pos,
            w.definition,
            w.example
        FROM learning_history lh
        JOIN words w ON lh.word_id = w.id
        WHERE lh.user_id = ?
        AND lh.status = 'learned'
        AND DATE(lh.updated_at) = ?
        ORDER BY lh.updated_at DESC
    `;

    db.all(sql, [req.user.id, date], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            date: date,
            word_count: rows.length,
            words: rows
        });
    });
});

// Achievement Routes
app.get('/api/achievements', authenticate, (req, res) => {
    console.log('GET /api/achievements called, user:', req.user.id);
    achievements.getUserAchievements(req.user.id, (err, result) => {
        if (err) {
            console.error('Error in /api/achievements:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log('GET /api/achievements success, count:', result.length);
        res.json(result);
    });
});

app.get('/api/achievements/latest', authenticate, (req, res) => {
    console.log('GET /api/achievements/latest called, user:', req.user.id);
    achievements.getLatestAchievement(req.user.id, (err, result) => {
        if (err) {
            console.error('Error in /api/achievements/latest:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log('GET /api/achievements/latest success, result:', result ? result.achievement_id : null);
        res.json(result);
    });
});

app.get('/api/achievements/unread-count', authenticate, (req, res) => {
    console.log('GET /api/achievements/unread-count called, user:', req.user.id);
    achievements.getUnreadCount(req.user.id, (err, count) => {
        if (err) {
            console.error('Error in /api/achievements/unread-count:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log('GET /api/achievements/unread-count success, count:', count);
        res.json({ unread_count: count });
    });
});

app.post('/api/achievements/mark-read', authenticate, (req, res) => {
    console.log('POST /api/achievements/mark-read called, user:', req.user.id);
    achievements.markAchievementsRead(req.user.id, (err, result) => {
        if (err) {
            console.error('Error in /api/achievements/mark-read:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log('POST /api/achievements/mark-read success, changed:', result.changed);
        res.json(result);
    });
});

// ==================== Word Lists (Custom Vocabulary) API ====================

// Get all word lists for current user with word count and progress
app.get('/api/word-lists', authenticate, (req, res) => {
    const sql = `
        SELECT 
            wl.*,
            (SELECT COUNT(*) FROM word_list_items wli WHERE wli.word_list_id = wl.id) as word_count,
            (SELECT COUNT(*) FROM word_list_items wli 
             JOIN learning_history lh ON wli.word_id = lh.word_id 
             WHERE wli.word_list_id = wl.id 
             AND lh.user_id = ? AND lh.status = 'learned') as learned_count
        FROM word_lists wl
        WHERE wl.user_id = ?
        ORDER BY wl.updated_at DESC
    `;
    db.all(sql, [req.user.id, req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get a single word list with details
app.get('/api/word-lists/:id', authenticate, (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT 
            wl.*,
            (SELECT COUNT(*) FROM word_list_items wli WHERE wli.word_list_id = wl.id) as word_count,
            (SELECT COUNT(*) FROM word_list_items wli 
             JOIN learning_history lh ON wli.word_id = lh.word_id 
             WHERE wli.word_list_id = wl.id 
             AND lh.user_id = wl.user_id AND lh.status = 'learned') as learned_count
        FROM word_lists wl
        WHERE wl.id = ? AND wl.user_id = ?
    `;
    db.get(sql, [id, req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: '词单不存在' });
        res.json(row);
    });
});

// Create a new word list
app.post('/api/word-lists', authenticate, (req, res) => {
    const { name, description } = req.body;
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: '词单名称不能为空' });
    }
    const sql = `INSERT INTO word_lists (user_id, name, description) VALUES (?, ?, ?)`;
    db.run(sql, [req.user.id, name.trim(), description || ''], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const newId = this.lastID;
        db.get(`SELECT * FROM word_lists WHERE id = ?`, [newId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ...row, word_count: 0, learned_count: 0 });
        });
    });
});

// Update a word list (name, description)
app.put('/api/word-lists/:id', authenticate, (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    
    db.get(`SELECT * FROM word_lists WHERE id = ? AND user_id = ?`, [id, req.user.id], (err, list) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!list) return res.status(404).json({ error: '词单不存在' });
        
        const newName = name !== undefined ? name.trim() : list.name;
        const newDesc = description !== undefined ? description : list.description;
        
        if (!newName || newName === '') {
            return res.status(400).json({ error: '词单名称不能为空' });
        }
        
        db.run(
            `UPDATE word_lists SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [newName, newDesc, id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                db.get(`SELECT * FROM word_lists WHERE id = ?`, [id], (err, row) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json(row);
                });
            }
        );
    });
});

// Delete a word list
app.delete('/api/word-lists/:id', authenticate, (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM word_lists WHERE id = ? AND user_id = ?`, [id, req.user.id], (err, list) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!list) return res.status(404).json({ error: '词单不存在' });
        
        db.run(`DELETE FROM word_list_items WHERE word_list_id = ?`, [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            db.run(`DELETE FROM word_lists WHERE id = ?`, [id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        });
    });
});

// Copy (duplicate) a word list
app.post('/api/word-lists/:id/copy', authenticate, (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM word_lists WHERE id = ? AND user_id = ?`, [id, req.user.id], (err, list) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!list) return res.status(404).json({ error: '词单不存在' });
        
        const newName = `${list.name} (副本)`;
        db.run(
            `INSERT INTO word_lists (user_id, name, description) VALUES (?, ?, ?)`,
            [req.user.id, newName, list.description],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                const newListId = this.lastID;
                
                db.all(`SELECT word_id FROM word_list_items WHERE word_list_id = ?`, [id], (err, items) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    if (items.length > 0) {
                        const stmt = db.prepare(`INSERT INTO word_list_items (word_list_id, word_id) VALUES (?, ?)`);
                        items.forEach(item => stmt.run(newListId, item.word_id));
                        stmt.finalize();
                    }
                    
                    db.get(`
                        SELECT 
                            wl.*,
                            (SELECT COUNT(*) FROM word_list_items wli WHERE wli.word_list_id = wl.id) as word_count,
                            (SELECT COUNT(*) FROM word_list_items wli 
                             JOIN learning_history lh ON wli.word_id = lh.word_id 
                             WHERE wli.word_list_id = wl.id 
                             AND lh.user_id = wl.user_id AND lh.status = 'learned') as learned_count
                        FROM word_lists wl
                        WHERE wl.id = ?
                    `, [newListId], (err, row) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json(row);
                    });
                });
            }
        );
    });
});

// Get words in a word list with optional sorting
app.get('/api/word-lists/:id/words', authenticate, (req, res) => {
    const { id } = req.params;
    const { sort = 'difficulty' } = req.query; // 'difficulty' or 'alpha'
    
    db.get(`SELECT id FROM word_lists WHERE id = ? AND user_id = ?`, [id, req.user.id], (err, list) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!list) return res.status(404).json({ error: '词单不存在' });
        
        const orderClause = sort === 'alpha' 
            ? 'w.word ASC' 
            : 'w.difficulty_level ASC, w.rank ASC';
        
        const sql = `
            SELECT w.*, 
                   lh.status as learn_status,
                   lh.updated_at as learned_at
            FROM word_list_items wli
            JOIN words w ON wli.word_id = w.id
            LEFT JOIN learning_history lh ON w.id = lh.word_id 
                AND lh.user_id = ? 
                AND lh.status = 'learned'
            WHERE wli.word_list_id = ?
            ORDER BY ${orderClause}
        `;
        db.all(sql, [req.user.id, id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});

// Add a word to a word list
app.post('/api/word-lists/:id/words/:wordId', authenticate, (req, res) => {
    const { id, wordId } = req.params;
    db.get(`SELECT id FROM word_lists WHERE id = ? AND user_id = ?`, [id, req.user.id], (err, list) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!list) return res.status(404).json({ error: '词单不存在' });
        
        db.get(`SELECT id FROM words WHERE id = ?`, [wordId], (err, word) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!word) return res.status(404).json({ error: '单词不存在' });
            
            db.run(
                `INSERT OR IGNORE INTO word_list_items (word_list_id, word_id) VALUES (?, ?)`,
                [id, wordId],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    db.run(`UPDATE word_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
                    res.json({ success: true });
                }
            );
        });
    });
});

// Remove a word from a word list
app.delete('/api/word-lists/:id/words/:wordId', authenticate, (req, res) => {
    const { id, wordId } = req.params;
    db.get(`SELECT id FROM word_lists WHERE id = ? AND user_id = ?`, [id, req.user.id], (err, list) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!list) return res.status(404).json({ error: '词单不存在' });
        
        db.run(
            `DELETE FROM word_list_items WHERE word_list_id = ? AND word_id = ?`,
            [id, wordId],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                db.run(`UPDATE word_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
                res.json({ success: true });
            }
        );
    });
});

// Search words globally (for adding to word lists)
app.get('/api/words/search', authenticate, (req, res) => {
    const { q = '', exclude_list_id, limit = 20 } = req.query;
    const searchTerm = `%${q}%`;
    
    let excludeSql = '';
    let params = [searchTerm, searchTerm];
    
    if (exclude_list_id) {
        excludeSql = `AND w.id NOT IN (SELECT word_id FROM word_list_items WHERE word_list_id = ?)`;
        params.push(exclude_list_id);
    }
    
    params.push(limit);
    
    const sql = `
        SELECT w.* 
        FROM words w
        WHERE (w.word LIKE ? OR w.definition LIKE ?)
        ${excludeSql}
        ORDER BY 
            CASE WHEN w.word LIKE ? THEN 0 ELSE 1 END,
            w.frequency DESC,
            w.rank ASC
        LIMIT ?
    `;
    
    // Add the second searchTerm for word match priority
    params.splice(2, 0, searchTerm);
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get random words from a word list for quiz
app.get('/api/word-lists/:id/quiz', authenticate, (req, res) => {
    const { id } = req.params;
    const { limit = 10 } = req.query;
    
    db.get(`SELECT id FROM word_lists WHERE id = ? AND user_id = ?`, [id, req.user.id], (err, list) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!list) return res.status(404).json({ error: '词单不存在' });
        
        const sql = `
            SELECT w.*
            FROM word_list_items wli
            JOIN words w ON wli.word_id = w.id
            WHERE wli.word_list_id = ?
            ORDER BY RANDOM()
            LIMIT ?
        `;
        db.all(sql, [id, limit], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});

// Modified recommend endpoint - supports word list mode
app.get('/api/recommend', authenticate, (req, res) => {
    const { word_list_id } = req.query;
    
    // If word_list_id is provided, recommend only from that list
    if (word_list_id) {
        db.get(`SELECT id, user_id FROM word_lists WHERE id = ?`, [word_list_id], (err, list) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!list) return res.status(404).json({ error: '词单不存在' });
            if (list.user_id !== req.user.id) return res.status(403).json({ error: '无权访问此词单' });
            
            // Check if list has words
            db.get(`SELECT COUNT(*) as count FROM word_list_items WHERE word_list_id = ?`, [word_list_id], (err, countResult) => {
                if (err) return res.status(500).json({ error: err.message });
                if (countResult.count === 0) {
                    return res.json({ message: "该词单暂无单词，请先添加单词。", empty_list: true });
                }
                
                // Recommend unlearned word from the list, ordered by difficulty
                const sql = `
                    SELECT w.*
                    FROM word_list_items wli
                    JOIN words w ON wli.word_id = w.id
                    WHERE wli.word_list_id = ?
                    AND w.id NOT IN (
                        SELECT word_id FROM learning_history
                        WHERE user_id = ? AND status = 'learned'
                    )
                    ORDER BY w.difficulty_level ASC, w.rank ASC
                    LIMIT 1
                `;
                db.get(sql, [word_list_id, req.user.id], (err, word) => {
                    if (err) return res.status(500).json({ error: err.message });
                    if (!word) {
                        // All words in list are learned
                        return res.json({ message: "恭喜！该词单的所有单词您都已掌握！", list_completed: true });
                    }
                    res.json(word);
                });
            });
        });
        return;
    }
    
    // Original recommendation logic
    db.get("SELECT vocab_size FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (!user) return res.status(404).json({ error: "用户未找到" });

        const i = user.vocab_size;

        const sql = `
            SELECT w.*,
                   CASE
                       WHEN w.rank BETWEEN ? AND ? THEN 100
                       WHEN w.rank BETWEEN ? AND ? THEN 80
                       WHEN w.rank < ? THEN 60
                       ELSE 40
                   END as level_score,
                   (w.frequency * 10) as frequency_score
            FROM words w
            WHERE w.id NOT IN (
                SELECT word_id FROM learning_history
                WHERE user_id = ? AND status = 'learned'
            )
            AND w.id NOT IN (
                SELECT word_id FROM learning_history
                WHERE user_id = ? AND status = 'skipped'
                AND updated_at > datetime('now', '-1 hour')
            )
            ORDER BY (level_score + frequency_score) DESC, w.rank ASC
            LIMIT 1
        `;

        const params = [
            i, i + 1500,
            i + 1500, i + 3000,
            i,
            req.user.id,
            req.user.id
        ];

        db.get(sql, params, (err, word) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!word) {
                db.get(`
                    SELECT * FROM words
                    WHERE id NOT IN (SELECT word_id FROM learning_history WHERE user_id = ? AND status = 'learned')
                    AND id NOT IN (SELECT word_id FROM learning_history WHERE user_id = ? AND status = 'skipped' AND updated_at > datetime('now', '-1 hour'))
                    ORDER BY frequency DESC, rank ASC
                    LIMIT 1
                `, [req.user.id, req.user.id], (err, fallback) => {
                    if (fallback) return res.json(fallback);
                    return res.json({ message: "暂无新单词. 您已掌握所有词汇!" });
                });
                return;
            }
            res.json(word);
        });
    });
});

// ==================== Reading Practice API ====================

// Get random example sentence for reading practice
app.get('/api/reading/random', authenticate, (req, res) => {
    const { word_list_id, exclude_word_id } = req.query;
    
    let baseSql = `SELECT w.*, 
                   CASE WHEN rf.id IS NOT NULL THEN 1 ELSE 0 END as is_favorited
                   FROM words w
                   LEFT JOIN reading_favorites rf ON w.id = rf.word_id AND rf.user_id = ?
                   WHERE w.example IS NOT NULL AND w.example != ''`;
    
    let params = [req.user.id];
    let whereClauses = [];
    
    if (word_list_id) {
        whereClauses.push(`w.id IN (SELECT word_id FROM word_list_items WHERE word_list_id = ?)`);
        params.push(word_list_id);
    }
    
    if (exclude_word_id) {
        whereClauses.push(`w.id != ?`);
        params.push(exclude_word_id);
    }
    
    if (whereClauses.length > 0) {
        baseSql += ' AND ' + whereClauses.join(' AND ');
    }
    
    baseSql += ' ORDER BY RANDOM() LIMIT 1';
    
    db.get(baseSql, params, (err, word) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!word) return res.status(404).json({ error: '未找到可用例句' });
        
        db.get(`SELECT practice_count FROM reading_practice_history 
                WHERE user_id = ? AND word_id = ?`, 
                [req.user.id, word.id], (err, history) => {
            if (err) {
                res.json({ ...word, practice_count: 0 });
            } else {
                res.json({ ...word, practice_count: history?.practice_count || 0 });
            }
        });
    });
});

// Get a specific word's example for reading practice
app.get('/api/reading/word/:wordId', authenticate, (req, res) => {
    const { wordId } = req.params;
    
    const sql = `SELECT w.*, 
                   CASE WHEN rf.id IS NOT NULL THEN 1 ELSE 0 END as is_favorited
                   FROM words w
                   LEFT JOIN reading_favorites rf ON w.id = rf.word_id AND rf.user_id = ?
                   WHERE w.id = ? AND w.example IS NOT NULL AND w.example != ''`;
    
    db.get(sql, [req.user.id, wordId], (err, word) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!word) return res.status(404).json({ error: '未找到该单词或无例句' });
        
        db.get(`SELECT practice_count FROM reading_practice_history 
                WHERE user_id = ? AND word_id = ?`, 
                [req.user.id, word.id], (err, history) => {
            if (err) {
                res.json({ ...word, practice_count: 0 });
            } else {
                res.json({ ...word, practice_count: history?.practice_count || 0 });
            }
        });
    });
});

// Record reading practice
app.post('/api/reading/record', authenticate, (req, res) => {
    const { word_id } = req.body;
    
    if (!word_id) {
        return res.status(400).json({ error: 'word_id is required' });
    }
    
    const sql = `INSERT INTO reading_practice_history (user_id, word_id, practice_count)
                 VALUES (?, ?, 1)
                 ON CONFLICT(user_id, word_id) DO UPDATE SET
                    practice_count = practice_count + 1,
                    last_practiced_at = CURRENT_TIMESTAMP`;
    
    db.run(sql, [req.user.id, word_id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        
        db.get(`SELECT practice_count FROM reading_practice_history 
                WHERE user_id = ? AND word_id = ?`, 
                [req.user.id, word_id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, practice_count: result?.practice_count || 1 });
        });
    });
});

// Get reading practice favorites list
app.get('/api/reading/favorites', authenticate, (req, res) => {
    const sql = `SELECT w.*, rf.created_at as favorited_at,
                   CASE WHEN rph.practice_count IS NOT NULL THEN rph.practice_count ELSE 0 END as practice_count
                   FROM reading_favorites rf
                   JOIN words w ON rf.word_id = w.id
                   LEFT JOIN reading_practice_history rph ON w.id = rph.word_id AND rph.user_id = rf.user_id
                   WHERE rf.user_id = ?
                   ORDER BY rf.created_at DESC`;
    
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(row => ({ ...row, is_favorited: 1 })));
    });
});

// Add to reading practice favorites
app.post('/api/reading/favorites/:wordId', authenticate, (req, res) => {
    const { wordId } = req.params;
    
    const sql = `INSERT OR IGNORE INTO reading_favorites (user_id, word_id)
                 VALUES (?, ?)`;
    
    db.run(sql, [req.user.id, wordId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        
        if (this.changes > 0) {
            res.json({ success: true, is_favorited: 1, message: '已添加到收藏' });
        } else {
            res.json({ success: true, is_favorited: 1, message: '已在收藏列表中' });
        }
    });
});

// Remove from reading practice favorites
app.delete('/api/reading/favorites/:wordId', authenticate, (req, res) => {
    const { wordId } = req.params;
    
    const sql = `DELETE FROM reading_favorites WHERE user_id = ? AND word_id = ?`;
    
    db.run(sql, [req.user.id, wordId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, is_favorited: 0, message: '已从收藏中移除' });
    });
});

// Get today's reading practice statistics
app.get('/api/reading/stats', authenticate, (req, res) => {
    const sql = `SELECT 
                   COUNT(DISTINCT rh.word_id) as practiced_today,
                   SUM(rh.practice_count) as total_practices
                   FROM reading_practice_history rh
                   WHERE rh.user_id = ?
                   AND DATE(rh.last_practiced_at) = DATE('now')`;
    
    db.get(sql, [req.user.id], (err, todayStats) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const totalSql = `SELECT COUNT(*) as total_favorites FROM reading_favorites WHERE user_id = ?`;
        db.get(totalSql, [req.user.id], (err, favStats) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({
                practiced_today: todayStats?.practiced_today || 0,
                total_practices: todayStats?.total_practices || 0,
                total_favorites: favStats?.total_favorites || 0
            });
        });
    });
});

// ==================== Daily Challenge API ====================

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

app.get('/api/daily-challenge', authenticate, (req, res) => {
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

app.post('/api/daily-challenge/submit', authenticate, (req, res) => {
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

app.get('/api/daily-challenge/stats', authenticate, (req, res) => {
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

// ==================== Etymology API ====================

// Get etymology list with search, filter, and pagination
app.get('/api/etymology', authenticate, (req, res) => {
    const { 
        q = '', 
        difficulty = '', 
        root = '', 
        limit = 20, 
        offset = 0,
        sort_by = 'difficulty'
    } = req.query;
    
    let whereClauses = [];
    let params = [];
    
    if (q) {
        whereClauses.push('(ee.word LIKE ? OR ee.explanation LIKE ?)');
        params.push(`%${q}%`, `%${q}%`);
    }
    
    if (difficulty) {
        whereClauses.push('ee.difficulty_level = ?');
        params.push(difficulty);
    }
    
    if (root) {
        whereClauses.push('ee.components LIKE ?');
        params.push(`%${root}%`);
    }
    
    const whereSql = whereClauses.length > 0 
        ? 'WHERE ' + whereClauses.join(' AND ') 
        : '';
    
    const orderClause = sort_by === 'alpha' 
        ? 'ee.word ASC' 
        : sort_by === 'newest'
            ? 'ee.created_at DESC'
            : 'ee.difficulty_level ASC, ee.word ASC';
    
    const countSql = `
        SELECT COUNT(*) as total FROM etymology_entries ee
        ${whereSql}
    `;
    
    const dataSql = `
        SELECT ee.*, 
               CASE WHEN ef.id IS NOT NULL THEN 1 ELSE 0 END as is_favorited,
               w.pronunciation, w.pos, w.definition
        FROM etymology_entries ee
        LEFT JOIN etymology_favorites ef ON ee.id = ef.etymology_id AND ef.user_id = ?
        LEFT JOIN words w ON ee.word_id = w.id
        ${whereSql}
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
    `;
    
    const countParams = [...params];
    const dataParams = [req.user.id, ...params, parseInt(limit), parseInt(offset)];
    
    db.get(countSql, countParams, (err, countResult) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all(dataSql, dataParams, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const formattedRows = rows.map(row => ({
                ...row,
                components: JSON.parse(row.components),
                related_words: JSON.parse(row.related_words),
                word_cloud: JSON.parse(row.word_cloud)
            }));
            
            res.json({
                total: countResult?.total || 0,
                limit: parseInt(limit),
                offset: parseInt(offset),
                data: formattedRows
            });
        });
    });
});

// Get etymology detail by ID
app.get('/api/etymology/:id', authenticate, (req, res) => {
    const { id } = req.params;
    
    const sql = `
        SELECT ee.*, 
               CASE WHEN ef.id IS NOT NULL THEN 1 ELSE 0 END as is_favorited,
               w.pronunciation, w.pos, w.definition, w.example, w.rank, w.frequency, w.difficulty_level as word_difficulty
        FROM etymology_entries ee
        LEFT JOIN etymology_favorites ef ON ee.id = ef.etymology_id AND ef.user_id = ?
        LEFT JOIN words w ON ee.word_id = w.id
        WHERE ee.id = ?
    `;
    
    db.get(sql, [req.user.id, id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: '词源条目不存在' });
        
        const result = {
            ...row,
            components: JSON.parse(row.components),
            related_words: JSON.parse(row.related_words),
            word_cloud: JSON.parse(row.word_cloud)
        };
        
        res.json(result);
    });
});

// Get etymology by word ID
app.get('/api/etymology/word/:wordId', authenticate, (req, res) => {
    const { wordId } = req.params;
    
    const sql = `
        SELECT ee.*, 
               CASE WHEN ef.id IS NOT NULL THEN 1 ELSE 0 END as is_favorited,
               w.pronunciation, w.pos, w.definition, w.example, w.rank, w.frequency
        FROM etymology_entries ee
        LEFT JOIN etymology_favorites ef ON ee.id = ef.etymology_id AND ef.user_id = ?
        LEFT JOIN words w ON ee.word_id = w.id
        WHERE ee.word_id = ?
    `;
    
    db.get(sql, [req.user.id, wordId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!row) {
            // Return empty result with recommendations
            const recSql = `
                SELECT ee.id, ee.word, ee.root_meaning, ee.difficulty_level,
                       w.pronunciation, w.pos, w.definition
                FROM etymology_entries ee
                JOIN words w ON ee.word_id = w.id
                WHERE w.difficulty_level = (
                    SELECT difficulty_level FROM words WHERE id = ?
                )
                AND ee.id IS NOT NULL
                ORDER BY RANDOM()
                LIMIT 3
            `;
            
            db.all(recSql, [wordId], (recErr, recRows) => {
                if (recErr) return res.status(500).json({ error: recErr.message });
                
                const formattedRecs = recRows.map(r => ({
                    ...r,
                }));
                
                res.json({
                    has_etymology: false,
                    message: '暂无词源信息',
                    recommendations: formattedRecs
                });
            });
            return;
        }
        
        const result = {
            ...row,
            has_etymology: true,
            components: JSON.parse(row.components),
            related_words: JSON.parse(row.related_words),
            word_cloud: JSON.parse(row.word_cloud)
        };
        
        res.json(result);
    });
});

// Get all etymology roots
app.get('/api/etymology/roots/list', authenticate, (req, res) => {
    const { language = '', limit = 50 } = req.query;
    
    let whereSql = '';
    let params = [];
    
    if (language) {
        whereSql = 'WHERE language = ?';
        params.push(language);
    }
    
    params.push(parseInt(limit));
    
    const sql = `
        SELECT * FROM etymology_roots
        ${whereSql}
        ORDER BY example_count DESC, root ASC
        LIMIT ?
    `;
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get etymology entries by root
app.get('/api/etymology/roots/:root', authenticate, (req, res) => {
    const { root } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const rootPattern = `%${root}%`;
    
    const countSql = `
        SELECT COUNT(*) as total FROM etymology_entries
        WHERE components LIKE ?
    `;
    
    const dataSql = `
        SELECT ee.*, 
               CASE WHEN ef.id IS NOT NULL THEN 1 ELSE 0 END as is_favorited,
               w.pronunciation, w.pos, w.definition
        FROM etymology_entries ee
        LEFT JOIN etymology_favorites ef ON ee.id = ef.etymology_id AND ef.user_id = ?
        LEFT JOIN words w ON ee.word_id = w.id
        WHERE ee.components LIKE ?
        ORDER BY ee.difficulty_level ASC, ee.word ASC
        LIMIT ? OFFSET ?
    `;
    
    db.get(countSql, [rootPattern], (err, countResult) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all(dataSql, [req.user.id, rootPattern, parseInt(limit), parseInt(offset)], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const formattedRows = rows.map(row => ({
                ...row,
                components: JSON.parse(row.components),
                related_words: JSON.parse(row.related_words),
                word_cloud: JSON.parse(row.word_cloud)
            }));
            
            res.json({
                root,
                total: countResult?.total || 0,
                data: formattedRows
            });
        });
    });
});

// Get user's favorite etymology entries
app.get('/api/etymology/favorites/list', authenticate, (req, res) => {
    const { limit = 20, offset = 0 } = req.query;
    
    const countSql = `
        SELECT COUNT(*) as total FROM etymology_favorites
        WHERE user_id = ?
    `;
    
    const dataSql = `
        SELECT ee.*, 
               1 as is_favorited,
               ef.created_at as favorited_at,
               w.pronunciation, w.pos, w.definition
        FROM etymology_favorites ef
        JOIN etymology_entries ee ON ef.etymology_id = ee.id
        LEFT JOIN words w ON ee.word_id = w.id
        WHERE ef.user_id = ?
        ORDER BY ef.created_at DESC
        LIMIT ? OFFSET ?
    `;
    
    db.get(countSql, [req.user.id], (err, countResult) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all(dataSql, [req.user.id, parseInt(limit), parseInt(offset)], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const formattedRows = rows.map(row => ({
                ...row,
                components: JSON.parse(row.components),
                related_words: JSON.parse(row.related_words),
                word_cloud: JSON.parse(row.word_cloud)
            }));
            
            res.json({
                total: countResult?.total || 0,
                data: formattedRows
            });
        });
    });
});

// Add etymology entry to favorites
app.post('/api/etymology/favorites/:id', authenticate, (req, res) => {
    const { id } = req.params;
    
    const sql = `
        INSERT OR IGNORE INTO etymology_favorites (user_id, etymology_id)
        VALUES (?, ?)
    `;
    
    db.run(sql, [req.user.id, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        if (this.changes > 0) {
            res.json({ success: true, is_favorited: 1, message: '已添加到收藏' });
        } else {
            res.json({ success: true, is_favorited: 1, message: '已在收藏列表中' });
        }
    });
});

// Remove etymology entry from favorites
app.delete('/api/etymology/favorites/:id', authenticate, (req, res) => {
    const { id } = req.params;
    
    const sql = `
        DELETE FROM etymology_favorites 
        WHERE user_id = ? AND etymology_id = ?
    `;
    
    db.run(sql, [req.user.id, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, is_favorited: 0, message: '已从收藏中移除' });
    });
});

// Get etymology statistics
app.get('/api/etymology/stats/summary', authenticate, (req, res) => {
    const sql = `
        SELECT 
            (SELECT COUNT(*) FROM etymology_entries) as total_entries,
            (SELECT COUNT(*) FROM etymology_roots) as total_roots,
            (SELECT COUNT(*) FROM etymology_favorites WHERE user_id = ?) as favorite_count,
            (SELECT COUNT(DISTINCT ee.id) FROM etymology_entries ee
             JOIN learning_history lh ON ee.word_id = lh.word_id
             WHERE lh.user_id = ? AND lh.status = 'learned') as learned_with_etymology
    `;
    
    db.get(sql, [req.user.id, req.user.id], (err, stats) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(stats);
    });
});

// ==================== Crossword Puzzle API ====================

function seededRandom(seed) {
    let s = seed;
    return function() {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function dateToSeed(dateStr) {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        const ch = dateStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + ch;
        hash = hash & hash;
    }
    return Math.abs(hash) + 1;
}

function generateCrossword(words, rng) {
    const GRID_SIZE = 5;
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    const placed = [];

    function canPlace(word, row, col, dir) {
        const len = word.length;
        if (dir === 'across') {
            if (col + len > GRID_SIZE) return false;
            if (col > 0 && grid[row][col - 1] !== null) return false;
            if (col + len < GRID_SIZE && grid[row][col + len] !== null) return false;
            for (let i = 0; i < len; i++) {
                const cell = grid[row][col + i];
                if (cell !== null && cell !== word[i]) return false;
                if (cell === null) {
                    if (row > 0 && grid[row - 1][col + i] !== null) return false;
                    if (row < GRID_SIZE - 1 && grid[row + 1][col + i] !== null) return false;
                }
            }
        } else {
            if (row + len > GRID_SIZE) return false;
            if (row > 0 && grid[row - 1][col] !== null) return false;
            if (row + len < GRID_SIZE && grid[row + len][col] !== null) return false;
            for (let i = 0; i < len; i++) {
                const cell = grid[row + i][col];
                if (cell !== null && cell !== word[i]) return false;
                if (cell === null) {
                    if (col > 0 && grid[row + i][col - 1] !== null) return false;
                    if (col < GRID_SIZE - 1 && grid[row + i][col + 1] !== null) return false;
                }
            }
        }
        return true;
    }

    function placeWord(word, row, col, dir) {
        const len = word.length;
        for (let i = 0; i < len; i++) {
            if (dir === 'across') {
                grid[row][col + i] = word[i];
            } else {
                grid[row + i][col] = word[i];
            }
        }
        placed.push({ word, row, col, direction: dir });
    }

    function findIntersections(word, existingWord, existingDir, existingRow, existingCol) {
        const results = [];
        for (let i = 0; i < word.length; i++) {
            for (let j = 0; j < existingWord.length; j++) {
                if (word[i] === existingWord[j]) {
                    let newRow, newCol, newDir;
                    if (existingDir === 'across') {
                        newDir = 'down';
                        newRow = existingRow - i;
                        newCol = existingCol + j;
                    } else {
                        newDir = 'across';
                        newRow = existingRow + j;
                        newCol = existingCol - i;
                    }
                    if (newRow >= 0 && newRow < GRID_SIZE && newCol >= 0 && newCol < GRID_SIZE) {
                        results.push({ row: newRow, col: newCol, direction: newDir });
                    }
                }
            }
        }
        return results;
    }

    const sortedWords = [...words].sort((a, b) => b.length - a.length);
    const firstWord = sortedWords[0];
    const startRow = Math.floor((GRID_SIZE - firstWord.length) / 2);
    placeWord(firstWord, startRow, 0, 'across');

    for (let wi = 1; wi < sortedWords.length; wi++) {
        const word = sortedWords[wi];
        let bestPlacement = null;
        let bestScore = -1;

        for (const existing of placed) {
            const intersections = findIntersections(word, existing.word, existing.direction, existing.row, existing.col);
            for (const placement of intersections) {
                if (canPlace(word, placement.row, placement.col, placement.direction)) {
                    let score = 0;
                    const len = word.length;
                    for (let i = 0; i < len; i++) {
                        const r = placement.direction === 'across' ? placement.row : placement.row + i;
                        const c = placement.direction === 'across' ? placement.col + i : placement.col;
                        if (grid[r][c] !== null) score++;
                    }
                    if (score > bestScore) {
                        bestScore = score;
                        bestPlacement = placement;
                    }
                }
            }
        }

        if (bestPlacement) {
            placeWord(word, bestPlacement.row, bestPlacement.col, bestPlacement.direction);
        }
    }

    return { grid, placed };
}

function generateCrosswordForDate(dateStr, callback) {
    db.get("SELECT id FROM crossword_puzzles WHERE puzzle_date = ?", [dateStr], (err, row) => {
        if (err) return callback(err);
        if (row) return callback(null, false);

        const seed = dateToSeed(dateStr);
        const rng = seededRandom(seed);

        const sql = `SELECT * FROM words WHERE length(word) BETWEEN 2 AND 5 ORDER BY difficulty_level ASC, RANDOM() LIMIT 80`;
        db.all(sql, (wErr, words) => {
            if (wErr) return callback(wErr);
            if (words.length < 6) return callback(new Error('Not enough words'));

            let bestResult = null;
            let bestCount = 0;

            for (let attempt = 0; attempt < 30; attempt++) {
                const shuffled = [...words].sort(() => rng() - 0.5).slice(0, 12);
                const wordStrings = shuffled.map(w => w.word.toLowerCase());
                const result = generateCrossword(wordStrings, rng);

                const acrossCount = result.placed.filter(p => p.direction === 'across').length;
                const downCount = result.placed.filter(p => p.direction === 'down').length;

                if (acrossCount >= 3 && downCount >= 3 && result.placed.length > bestCount) {
                    bestResult = result;
                    bestCount = result.placed.length;
                }
                if (bestCount >= 6) break;
            }

            if (!bestResult || bestResult.placed.length < 4) {
                return callback(new Error('Could not generate valid crossword'));
            }

            const finalGrid = bestResult.grid.map(row => row.map(cell => cell || ''));
            const cluesAcross = [];
            const cluesDown = [];

            for (const p of bestResult.placed) {
                const wordObj = words.find(w => w.word.toLowerCase() === p.word);
                const clueData = {
                    word: p.word,
                    row: p.row,
                    col: p.col,
                    direction: p.direction,
                    clue: wordObj ? wordObj.definition : p.word,
                    word_id: wordObj ? wordObj.id : null
                };
                if (p.direction === 'across') {
                    cluesAcross.push(clueData);
                } else {
                    cluesDown.push(clueData);
                }
            }

            cluesAcross.sort((a, b) => a.row - b.row || a.col - b.col);
            cluesDown.sort((a, b) => a.row - b.row || a.col - b.col);

            const across = cluesAcross.slice(0, 3);
            const down = cluesDown.slice(0, 3);

            const activeCells = new Set();
            for (const clue of [...across, ...down]) {
                for (let i = 0; i < clue.word.length; i++) {
                    const r = clue.direction === 'across' ? clue.row : clue.row + i;
                    const c = clue.direction === 'across' ? clue.col + i : clue.col;
                    activeCells.add(`${r},${c}`);
                }
            }

            const cleanGrid = Array.from({ length: 5 }, (_, r) =>
                Array.from({ length: 5 }, (_, c) =>
                    activeCells.has(`${r},${c}`) ? finalGrid[r][c] : ''
                )
            );

            const allWords = [...across, ...down].map(c => ({
                word: c.word,
                direction: c.direction,
                row: c.row,
                col: c.col,
                clue: c.clue,
                word_id: c.word_id
            }));

            db.run(
                `INSERT INTO crossword_puzzles (puzzle_date, grid, clues_across, clues_down, words) VALUES (?, ?, ?, ?, ?)`,
                [dateStr, JSON.stringify(cleanGrid), JSON.stringify(across), JSON.stringify(down), JSON.stringify(allWords)],
                (insertErr) => {
                    if (insertErr) return callback(insertErr);
                    callback(null, true);
                }
            );
        });
    });
}

app.get('/api/crossword', authenticate, (req, res) => {
    const today = getTodayDate();

    generateCrosswordForDate(today, (genErr) => {
        if (genErr) return res.status(500).json({ error: genErr.message });

        db.get("SELECT * FROM crossword_puzzles WHERE puzzle_date = ?", [today], (pErr, puzzle) => {
            if (pErr) return res.status(500).json({ error: pErr.message });
            if (!puzzle) return res.status(404).json({ error: '谜题不存在' });

            const grid = JSON.parse(puzzle.grid);
            const cluesAcross = JSON.parse(puzzle.clues_across);
            const cluesDown = JSON.parse(puzzle.clues_down);
            const words = JSON.parse(puzzle.words);

            db.get("SELECT * FROM crossword_submissions WHERE user_id = ? AND puzzle_date = ?", [req.user.id, today], (sErr, submission) => {
                if (sErr) return res.status(500).json({ error: sErr.message });

                const response = {
                    date: today,
                    grid: grid,
                    clues_across: cluesAcross.map(c => ({
                        row: c.row,
                        col: c.col,
                        direction: c.direction,
                        clue: c.clue,
                        word_length: c.word.length,
                        word_id: c.word_id
                    })),
                    clues_down: cluesDown.map(c => ({
                        row: c.row,
                        col: c.col,
                        direction: c.direction,
                        clue: c.clue,
                        word_length: c.word.length,
                        word_id: c.word_id
                    })),
                    submission: submission ? {
                        time_spent: submission.time_spent,
                        hints_used: submission.hints_used,
                        is_correct: submission.is_correct
                    } : null
                };

                if (!submission) {
                    const blankGrid = grid.map(row => row.map(cell => cell ? '' : null));
                    response.grid = blankGrid;
                }

                res.json(response);
            });
        });
    });
});

app.post('/api/crossword/submit', authenticate, (req, res) => {
    const today = getTodayDate();
    const { answers, time_spent, hints_used } = req.body;

    if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: 'Answers are required' });
    }

    db.get("SELECT * FROM crossword_submissions WHERE user_id = ? AND puzzle_date = ?", [req.user.id, today], (checkErr, existing) => {
        if (checkErr) return res.status(500).json({ error: checkErr.message });
        if (existing) {
            return res.status(400).json({ error: '今日填字游戏已完成' });
        }

        db.get("SELECT * FROM crossword_puzzles WHERE puzzle_date = ?", [today], (pErr, puzzle) => {
            if (pErr) return res.status(500).json({ error: pErr.message });
            if (!puzzle) return res.status(404).json({ error: '谜题不存在' });

            const solutionGrid = JSON.parse(puzzle.grid);
            let allCorrect = true;
            const cellResults = [];

            for (let r = 0; r < 5; r++) {
                cellResults[r] = [];
                for (let c = 0; c < 5; c++) {
                    const expected = solutionGrid[r][c];
                    const actual = (answers[r] && answers[r][c]) || '';
                    if (expected === '') {
                        cellResults[r][c] = { expected: '', actual: '', correct: true, empty: true };
                    } else {
                        const correct = actual.toLowerCase() === expected.toLowerCase();
                        if (!correct) allCorrect = false;
                        cellResults[r][c] = { expected: expected.toLowerCase(), actual: actual.toLowerCase(), correct, empty: false };
                    }
                }
            }

            db.run(
                `INSERT INTO crossword_submissions (user_id, puzzle_date, time_spent, hints_used, is_correct) VALUES (?, ?, ?, ?, ?)`,
                [req.user.id, today, time_spent || 0, hints_used || 0, allCorrect ? 1 : 0],
                function (insertErr) {
                    if (insertErr) return res.status(500).json({ error: insertErr.message });

                    if (allCorrect) {
                        db.get("SELECT * FROM crossword_best_scores WHERE user_id = ?", [req.user.id], (bErr, best) => {
                            if (bErr) console.error('Error checking best score:', bErr);

                            if (!best || time_spent < best.best_time || (time_spent === best.best_time && hints_used < best.best_hints)) {
                                db.run(
                                    `INSERT INTO crossword_best_scores (user_id, best_time, best_hints, best_date) VALUES (?, ?, ?, ?)
                                     ON CONFLICT(user_id) DO UPDATE SET best_time = ?, best_hints = ?, best_date = ?, updated_at = CURRENT_TIMESTAMP`,
                                    [req.user.id, time_spent, hints_used || 0, today, time_spent, hints_used || 0, today],
                                    (uErr) => { if (uErr) console.error('Error updating best score:', uErr); }
                                );
                            }
                        });
                    }

                    res.json({
                        is_correct: allCorrect,
                        cell_results: cellResults,
                        time_spent: time_spent || 0,
                        hints_used: hints_used || 0
                    });
                }
            );
        });
    });
});

app.get('/api/crossword/best', authenticate, (req, res) => {
    db.get("SELECT * FROM crossword_best_scores WHERE user_id = ?", [req.user.id], (err, best) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!best) {
            return res.json({ best_time: null, best_hints: null, best_date: null });
        }
        res.json({ best_time: best.best_time, best_hints: best.best_hints, best_date: best.best_date });
    });
});

app.get('/api/crossword/hint', authenticate, (req, res) => {
    const { row, col, type } = req.query;
    const today = getTodayDate();

    db.get("SELECT * FROM crossword_puzzles WHERE puzzle_date = ?", [today], (pErr, puzzle) => {
        if (pErr) return res.status(500).json({ error: pErr.message });
        if (!puzzle) return res.status(404).json({ error: '谜题不存在' });

        const solutionGrid = JSON.parse(puzzle.grid);

        if (type === 'cell' && row !== undefined && col !== undefined) {
            const r = parseInt(row);
            const c = parseInt(col);
            const letter = solutionGrid[r] && solutionGrid[r][c];
            if (!letter || letter === '') {
                return res.json({ hint: null });
            }
            res.json({ hint: letter[0].toLowerCase() });
        } else if (type === 'clue') {
            const words = JSON.parse(puzzle.words);
            if (words.length === 0) return res.json({ hint: null });
            const randomIdx = Math.floor(Math.random() * words.length);
            const word = words[randomIdx];
            res.json({ hint: { word: word.word, clue: word.clue, direction: word.direction, row: word.row, col: word.col } });
        } else {
            res.status(400).json({ error: 'Invalid hint type' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
