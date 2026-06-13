const express = require('express');
const db = require('../database');
const { requireAdmin, writeAuditLog } = require('../middleware/auth');

const router = express.Router();

router.get('/check', requireAdmin, (req, res) => {
    res.json({ is_admin: true, user: req.user });
});

router.get('/stats', requireAdmin, (req, res) => {
    const sql1 = "SELECT COUNT(*) as total FROM words";
    const sql2 = "SELECT difficulty_level, COUNT(*) as count FROM words GROUP BY difficulty_level ORDER BY difficulty_level";
    const sql3 = "SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 20";

    db.get(sql1, (err, totalResult) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all(sql2, (err2, distribution) => {
            if (err2) return res.status(500).json({ error: err2.message });
            db.all(sql3, (err3, recentChanges) => {
                if (err3) return res.status(500).json({ error: err3.message });
                res.json({
                    total_words: totalResult.total,
                    difficulty_distribution: distribution,
                    recent_changes: recentChanges
                });
            });
        });
    });
});

router.get('/audit-log', requireAdmin, (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const action = req.query.action || '';

    let whereClauses = [];
    let params = [];

    if (action) {
        whereClauses.push('action = ?');
        params.push(action);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const countSql = `SELECT COUNT(*) as total FROM admin_audit_log ${whereSql}`;
    const dataSql = `SELECT * FROM admin_audit_log ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;

    db.get(countSql, params, (err, countResult) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all(dataSql, [...params, limit, offset], (err2, rows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({
                total: countResult.total,
                limit,
                offset,
                data: rows.map(r => ({
                    ...r,
                    details: r.details ? JSON.parse(r.details) : null
                }))
            });
        });
    });
});

router.get('/tags', requireAdmin, (req, res) => {
    db.all("SELECT * FROM word_tags ORDER BY tag", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/tags', requireAdmin, (req, res) => {
    const { tag } = req.body;
    if (!tag || tag.trim() === '') {
        return res.status(400).json({ error: '标签名称不能为空' });
    }
    db.run("INSERT OR IGNORE INTO word_tags (tag) VALUES (?)", [tag.trim()], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get("SELECT * FROM word_tags WHERE tag = ?", [tag.trim()], (err2, row) => {
            if (err2) return res.status(500).json({ error: err2.message });
            writeAuditLog(req.user.id, req.user.username, 'create', 'tag', row?.id, { tag });
            res.json(row || { success: true });
        });
    });
});

router.delete('/tags/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM word_tags WHERE id = ?", [id], (err, tag) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!tag) return res.status(404).json({ error: '标签不存在' });
        db.run("DELETE FROM word_tags WHERE id = ?", [id], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            writeAuditLog(req.user.id, req.user.username, 'delete', 'tag', id, { tag: tag.tag });
            res.json({ success: true });
        });
    });
});

router.get('/words', requireAdmin, (req, res) => {
    const {
        q = '',
        difficulty = '',
        tag = '',
        limit = 20,
        offset = 0,
        sort_by = 'id',
        sort_order = 'desc'
    } = req.query;

    let whereClauses = [];
    let params = [];

    if (q) {
        whereClauses.push('(word LIKE ? OR definition LIKE ? OR pronunciation LIKE ?)');
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (difficulty) {
        whereClauses.push('difficulty_level = ?');
        params.push(parseInt(difficulty));
    }

    if (tag) {
        whereClauses.push('tags LIKE ?');
        params.push(`%${tag}%`);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const validSortColumns = ['id', 'word', 'difficulty_level', 'frequency', 'rank', 'updated_at'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'id';
    const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

    const countSql = `SELECT COUNT(*) as total FROM words ${whereSql}`;
    const dataSql = `SELECT * FROM words ${whereSql} ORDER BY ${sortColumn} ${sortDir} LIMIT ? OFFSET ?`;

    db.get(countSql, params, (err, countResult) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all(dataSql, [...params, parseInt(limit), parseInt(offset)], (err2, rows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({
                total: countResult.total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                data: rows
            });
        });
    });
});

router.get('/words/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM words WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: '单词不存在' });
        res.json(row);
    });
});

router.post('/words', requireAdmin, (req, res) => {
    const { word, pronunciation, pos, definition, example, rank, frequency, difficulty_level, tags } = req.body;

    if (!word || word.trim() === '') {
        return res.status(400).json({ error: '单词不能为空' });
    }
    if (!definition || definition.trim() === '') {
        return res.status(400).json({ error: '释义不能为空' });
    }

    const sql = `INSERT INTO words (word, pronunciation, pos, definition, example, rank, frequency, difficulty_level, tags, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

    const params = [
        word.trim(),
        pronunciation || '',
        pos || '',
        definition.trim(),
        example || '',
        rank ? parseInt(rank) : null,
        frequency ? parseInt(frequency) : 5,
        difficulty_level ? parseInt(difficulty_level) : 3,
        tags || ''
    ];

    db.run(sql, params, function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint')) {
                return res.status(400).json({ error: '该单词已存在' });
            }
            return res.status(500).json({ error: err.message });
        }
        const newId = this.lastID;
        writeAuditLog(req.user.id, req.user.username, 'create', 'word', newId, { word: word.trim() });
        db.get("SELECT * FROM words WHERE id = ?", [newId], (err2, row) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json(row);
        });
    });
});

router.put('/words/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { word, pronunciation, pos, definition, example, rank, frequency, difficulty_level, tags } = req.body;

    db.get("SELECT * FROM words WHERE id = ?", [id], (err, existingWord) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!existingWord) return res.status(404).json({ error: '单词不存在' });

        const newWord = word !== undefined ? word.trim() : existingWord.word;
        const newPronunciation = pronunciation !== undefined ? pronunciation : existingWord.pronunciation;
        const newPos = pos !== undefined ? pos : existingWord.pos;
        const newDefinition = definition !== undefined ? definition.trim() : existingWord.definition;
        const newExample = example !== undefined ? example : existingWord.example;
        const newRank = rank !== undefined ? parseInt(rank) : existingWord.rank;
        const newFrequency = frequency !== undefined ? parseInt(frequency) : existingWord.frequency;
        const newDifficulty = difficulty_level !== undefined ? parseInt(difficulty_level) : existingWord.difficulty_level;
        const newTags = tags !== undefined ? tags : existingWord.tags;

        if (!newWord || newWord === '') {
            return res.status(400).json({ error: '单词不能为空' });
        }
        if (!newDefinition || newDefinition === '') {
            return res.status(400).json({ error: '释义不能为空' });
        }

        const sql = `UPDATE words SET 
                        word = ?, pronunciation = ?, pos = ?, definition = ?, 
                        example = ?, rank = ?, frequency = ?, difficulty_level = ?, 
                        tags = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`;

        const params = [newWord, newPronunciation, newPos, newDefinition, newExample, newRank, newFrequency, newDifficulty, newTags, id];

        db.run(sql, params, function (err2) {
            if (err2) {
                if (err2.message.includes('UNIQUE constraint')) {
                    return res.status(400).json({ error: '该单词已存在' });
                }
                return res.status(500).json({ error: err2.message });
            }
            writeAuditLog(req.user.id, req.user.username, 'update', 'word', id, {
                before: existingWord,
                after: { word: newWord, definition: newDefinition, difficulty_level: newDifficulty, tags: newTags }
            });
            db.get("SELECT * FROM words WHERE id = ?", [id], (err3, row) => {
                if (err3) return res.status(500).json({ error: err3.message });
                res.json(row);
            });
        });
    });
});

router.delete('/words/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM words WHERE id = ?", [id], (err, word) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!word) return res.status(404).json({ error: '单词不存在' });

        db.run("DELETE FROM words WHERE id = ?", [id], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            writeAuditLog(req.user.id, req.user.username, 'delete', 'word', id, { word: word.word });
            res.json({ success: true });
        });
    });
});

router.post('/words/batch-delete', requireAdmin, (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: '请选择要删除的单词' });
    }

    const placeholders = ids.map(() => '?').join(',');
    db.all(`SELECT id, word FROM words WHERE id IN (${placeholders})`, ids, (err, words) => {
        if (err) return res.status(500).json({ error: err.message });

        db.run(`DELETE FROM words WHERE id IN (${placeholders})`, ids, function (err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            writeAuditLog(req.user.id, req.user.username, 'batch_delete', 'word', null, {
                count: ids.length,
                words: words.map(w => ({ id: w.id, word: w.word }))
            });
            res.json({ success: true, deleted_count: this.changes });
        });
    });
});

router.get('/words/export/csv', requireAdmin, (req, res) => {
    const { difficulty = '', tag = '', q = '' } = req.query;

    let whereClauses = [];
    let params = [];

    if (q) {
        whereClauses.push('(word LIKE ? OR definition LIKE ?)');
        params.push(`%${q}%`, `%${q}%`);
    }
    if (difficulty) {
        whereClauses.push('difficulty_level = ?');
        params.push(parseInt(difficulty));
    }
    if (tag) {
        whereClauses.push('tags LIKE ?');
        params.push(`%${tag}%`);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const sql = `SELECT * FROM words ${whereSql} ORDER BY id ASC`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const headers = ['id', 'word', 'pronunciation', 'pos', 'definition', 'example', 'rank', 'frequency', 'difficulty_level', 'tags'];
        const csvLines = [headers.join(',')];

        const difficultyLabels = { 1: '基础', 2: '初级', 3: '中级', 4: '中高级', 5: '高级', 6: '专业' };

        rows.forEach(row => {
            const values = headers.map(h => {
                let val = row[h] ?? '';
                if (h === 'difficulty_level') val = difficultyLabels[val] || val;
                val = String(val).replace(/"/g, '""');
                if (val.includes(',') || val.includes('\n') || val.includes('"')) {
                    val = `"${val}"`;
                }
                return val;
            });
            csvLines.push(values.join(','));
        });

        const csvContent = '\ufeff' + csvLines.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="vocabulary_export.csv"');
        res.send(csvContent);
    });
});

function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

router.post('/words/import/csv', requireAdmin, (req, res) => {
    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ error: 'CSV内容不能为空' });
    }

    const lines = content.replace(/^\ufeff/, '').split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV格式不正确，至少需要标题行和一行数据' });
    }

    const headers = parseCsvLine(lines[0]);
    const headerMap = {};
    headers.forEach((h, i) => {
        const lower = h.trim().toLowerCase();
        headerMap[lower] = i;
    });

    const difficultyValues = { '基础': 1, '初级': 2, '中级': 3, '中高级': 4, '高级': 5, '专业': 6 };

    const stmt = db.prepare(`INSERT OR REPLACE INTO words 
        (word, pronunciation, pos, definition, example, rank, frequency, difficulty_level, tags, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    const importedWords = [];

    const transaction = db.transaction(() => {
        for (let i = 1; i < lines.length; i++) {
            try {
                const values = parseCsvLine(lines[i]);
                const word = values[headerMap['word'] ?? 0]?.trim();
                const definition = values[headerMap['definition'] ?? 3]?.trim();

                if (!word || !definition) {
                    errorCount++;
                    errors.push(`行 ${i + 1}: 单词和释义不能为空`);
                    continue;
                }

                const pronunciation = values[headerMap['pronunciation'] ?? 1] || '';
                const pos = values[headerMap['pos'] ?? 2] || '';
                const example = values[headerMap['example'] ?? 4] || '';
                const rankStr = values[headerMap['rank'] ?? 5];
                const freqStr = values[headerMap['frequency'] ?? 6];
                const diffStr = values[headerMap['difficulty_level'] ?? 7]?.trim() || '';
                const tags = values[headerMap['tags'] ?? 8] || '';

                let rank = rankStr ? parseInt(rankStr) : null;
                if (isNaN(rank)) rank = null;
                let frequency = freqStr ? parseInt(freqStr) : 5;
                if (isNaN(frequency)) frequency = 5;
                let difficulty_level = 3;
                if (difficultyValues[diffStr] !== undefined) {
                    difficulty_level = difficultyValues[diffStr];
                } else if (diffStr && !isNaN(parseInt(diffStr))) {
                    difficulty_level = Math.min(6, Math.max(1, parseInt(diffStr)));
                }

                stmt.run(word, pronunciation, pos, definition, example, rank, frequency, difficulty_level, tags);
                successCount++;
                importedWords.push(word);
            } catch (e) {
                errorCount++;
                errors.push(`行 ${i + 1}: ${e.message}`);
            }
        }
    });

    transaction();
    stmt.finalize();

    writeAuditLog(req.user.id, req.user.username, 'import', 'word', null, {
        success_count: successCount,
        error_count: errorCount,
        sample_words: importedWords.slice(0, 10)
    });

    res.json({
        success: true,
        success_count: successCount,
        error_count: errorCount,
        errors
    });
});

module.exports = router;
