const express = require('express');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/random', authenticate, (req, res) => {
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

router.get('/word/:wordId', authenticate, (req, res) => {
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

router.post('/record', authenticate, (req, res) => {
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

router.get('/favorites', authenticate, (req, res) => {
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

router.post('/favorites/:wordId', authenticate, (req, res) => {
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

router.delete('/favorites/:wordId', authenticate, (req, res) => {
    const { wordId } = req.params;

    const sql = `DELETE FROM reading_favorites WHERE user_id = ? AND word_id = ?`;

    db.run(sql, [req.user.id, wordId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, is_favorited: 0, message: '已从收藏中移除' });
    });
});

router.get('/stats', authenticate, (req, res) => {
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

module.exports = router;
