const express = require('express');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
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

router.get('/:id', authenticate, (req, res) => {
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

router.get('/word/:wordId', authenticate, (req, res) => {
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

router.get('/roots/list', authenticate, (req, res) => {
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

router.get('/roots/:root', authenticate, (req, res) => {
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

router.get('/favorites/list', authenticate, (req, res) => {
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

router.post('/favorites/:id', authenticate, (req, res) => {
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

router.delete('/favorites/:id', authenticate, (req, res) => {
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

router.get('/stats/summary', authenticate, (req, res) => {
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

module.exports = router;
