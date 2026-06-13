const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { authenticate, SECRET_KEY } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
    const { username, password } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    db.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, hash], function (err) {
        if (err) return res.status(400).json({ error: "用户名已存在" });
        res.json({ id: this.lastID, username, vocab_size: 0 });
    });
});

function applyPasswordCheck(password, user) {
    return !bcrypt.compareSync(password, user.password_hash);
}

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (!user || applyPasswordCheck(password, user)) return res.status(401).json({ error: "无效的用户名或密码" });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role || 'user' }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, vocab_size: user.vocab_size, role: user.role || 'user' } });
    });
});

router.get('/me', authenticate, (req, res) => {
    db.get("SELECT id, username, vocab_size, role, created_at FROM users WHERE id = ?", [req.user.id], (err, row) => {
        res.json(row);
    });
});

module.exports = router;
