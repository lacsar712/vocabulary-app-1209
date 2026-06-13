const express = require('express');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
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

router.get('/:id', authenticate, (req, res) => {
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

router.post('/', authenticate, (req, res) => {
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

router.put('/:id', authenticate, (req, res) => {
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

router.delete('/:id', authenticate, (req, res) => {
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

router.post('/:id/copy', authenticate, (req, res) => {
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

router.get('/:id/words', authenticate, (req, res) => {
    const { id } = req.params;
    const { sort = 'difficulty' } = req.query;

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

router.post('/:id/words/:wordId', authenticate, (req, res) => {
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

router.delete('/:id/words/:wordId', authenticate, (req, res) => {
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

router.get('/:id/quiz', authenticate, (req, res) => {
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
        db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
