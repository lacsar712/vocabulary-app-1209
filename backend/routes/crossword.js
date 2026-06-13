const express = require('express');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

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

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
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

router.get('/', authenticate, (req, res) => {
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

router.post('/submit', authenticate, (req, res) => {
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

router.get('/best', authenticate, (req, res) => {
    db.get("SELECT * FROM crossword_best_scores WHERE user_id = ?", [req.user.id], (err, best) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!best) {
            return res.json({ best_time: null, best_hints: null, best_date: null });
        }
        res.json({ best_time: best.best_time, best_hints: best.best_hints, best_date: best.best_date });
    });
});

router.get('/hint', authenticate, (req, res) => {
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

module.exports = router;
