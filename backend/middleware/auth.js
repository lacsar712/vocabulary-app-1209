const jwt = require('jsonwebtoken');
const db = require('../database');

const SECRET_KEY = "supersecretkey_vocabulary_1209";

const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token.split(' ')[1], SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token.split(' ')[1], SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        if (user.role !== 'admin') return res.status(403).json({ error: '无权限访问' });
        req.user = user;
        next();
    });
};

const writeAuditLog = (adminId, adminUsername, action, targetType, targetId, details) => {
    db.run(`INSERT INTO admin_audit_log (admin_id, admin_username, action, target_type, target_id, details)
            VALUES (?, ?, ?, ?, ?, ?)`,
        [adminId, adminUsername, action, targetType, targetId, details ? JSON.stringify(details) : null]
    );
};

module.exports = {
    authenticate,
    requireAdmin,
    writeAuditLog,
    SECRET_KEY
};
