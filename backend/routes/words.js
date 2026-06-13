const express = require('express');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/search', authenticate, (req, res) => {
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

    params.splice(2, 0, searchTerm);

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
