const express = require('express');
const achievements = require('../achievements');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
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

router.get('/latest', authenticate, (req, res) => {
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

router.get('/unread-count', authenticate, (req, res) => {
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

router.post('/mark-read', authenticate, (req, res) => {
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

module.exports = router;
