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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
