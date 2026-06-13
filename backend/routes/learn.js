const express = require('express');
const db = require('../database');
const achievements = require('../achievements');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/recommend/batch', authenticate, (req, res) => {
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

router.post('/learn/record', authenticate, (req, res) => {
    const { word_id, status } = req.body;
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

router.get('/stats', authenticate, (req, res) => {
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

router.get('/calendar', authenticate, (req, res) => {
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

router.get('/calendar/day', authenticate, (req, res) => {
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

router.get('/recommend', authenticate, (req, res) => {
    const { word_list_id } = req.query;

    if (word_list_id) {
        db.get(`SELECT id, user_id FROM word_lists WHERE id = ?`, [word_list_id], (err, list) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!list) return res.status(404).json({ error: '词单不存在' });
            if (list.user_id !== req.user.id) return res.status(403).json({ error: '无权访问此词单' });

            db.get(`SELECT COUNT(*) as count FROM word_list_items WHERE word_list_id = ?`, [word_list_id], (err, countResult) => {
                if (err) return res.status(500).json({ error: err.message });
                if (countResult.count === 0) {
                    return res.json({ message: "该词单暂无单词，请先添加单词。", empty_list: true });
                }

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
                        return res.json({ message: "恭喜！该词单的所有单词您都已掌握！", list_completed: true });
                    }
                    res.json(word);
                });
            });
        });
        return;
    }

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

module.exports = router;
