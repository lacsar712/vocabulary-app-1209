const db = require('./database');

const ACHIEVEMENTS = [
    { id: 'first_word', name: '初学乍练', description: '首次掌握一个单词', icon: '🌟', category: 'learning', order: 1 },
    { id: 'ten_words', name: '词汇新手', description: '累计掌握10个单词', icon: '📚', category: 'learning', order: 2 },
    { id: 'hundred_words', name: '词汇达人', description: '累计掌握100个单词', icon: '📖', category: 'learning', order: 3 },
    { id: 'five_hundred_words', name: '词汇大师', description: '累计掌握500个单词', icon: '🎓', category: 'learning', order: 4 },
    { id: 'three_day_streak', name: '三日之约', description: '连续学习3天', icon: '🔥', category: 'streak', order: 5 },
    { id: 'seven_day_streak', name: '七日坚持', description: '连续学习7天', icon: '💪', category: 'streak', order: 6 },
    { id: 'fifteen_day_streak', name: '半月达人', description: '连续学习15天', icon: '🏆', category: 'streak', order: 7 },
    { id: 'first_test', name: '初试锋芒', description: '完成第一次词汇量测试', icon: '🎯', category: 'test', order: 8 },
    { id: 'three_tests', name: '测试常客', description: '完成3次词汇量测试', icon: '📝', category: 'test', order: 9 },
    { id: 'five_tests', name: '测试达人', description: '完成5次词汇量测试', icon: '✏️', category: 'test', order: 10 },
    { id: 'vocab_leap', name: '词汇飞跃', description: '单次测试后词汇量提升500以上', icon: '🚀', category: 'test', order: 11 },
    { id: 'perfect_score', name: '完美答卷', description: '单次测试正确率100%', icon: '💯', category: 'test', order: 12 },
    { id: 'high_accuracy', name: '学霸潜质', description: '单次测试正确率达到80%以上', icon: '🧠', category: 'test', order: 13 },
    { id: 'vocab_5000', name: '学富五车', description: '词汇量达到5000', icon: '📜', category: 'milestone', order: 14 },
    { id: 'vocab_10000', name: '登峰造极', description: '词汇量达到10000', icon: '👑', category: 'milestone', order: 15 },
];

function initAchievementsTable() {
    db.run(`CREATE TABLE IF NOT EXISTS user_achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        achievement_id TEXT,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_read INTEGER DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id),
        UNIQUE(user_id, achievement_id)
    )`);
}

function getAllAchievements() {
    return ACHIEVEMENTS;
}

function getUserAchievements(userId, callback) {
    db.all(`SELECT * FROM user_achievements WHERE user_id = ?`, [userId], (err, rows) => {
        if (err) return callback(err);
        const unlockedMap = {};
        rows.forEach(row => {
            unlockedMap[row.achievement_id] = row;
        });
        const result = ACHIEVEMENTS.map(a => {
            const unlocked = unlockedMap[a.id];
            return {
                ...a,
                unlocked: !!unlocked,
                unlocked_at: unlocked ? unlocked.unlocked_at : null,
                is_read: unlocked ? unlocked.is_read : 0
            };
        });
        callback(null, result);
    });
}

function unlockAchievement(userId, achievementId, callback) {
    db.run(
        `INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, is_read) VALUES (?, ?, 0)`,
        [userId, achievementId],
        function(err) {
            if (err) return callback(err);
            if (this.changes > 0) {
                db.get(`SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?`, 
                    [userId, achievementId], (err, row) => {
                        callback(null, { newlyUnlocked: true, achievement: row });
                    });
            } else {
                callback(null, { newlyUnlocked: false, achievement: null });
            }
        }
    );
}

function checkLearningAchievements(userId, callback) {
    const newlyUnlocked = [];
    let pendingTasks = 0;
    let hasError = false;

    function taskDone() {
        pendingTasks--;
        if (pendingTasks === 0 && !hasError) {
            callback(null, newlyUnlocked);
        }
    }

    function handleError(err) {
        if (!hasError) {
            hasError = true;
            callback(err);
        }
    }

    pendingTasks++;
    db.get(`SELECT COUNT(DISTINCT word_id) as count FROM learning_history WHERE user_id = ? AND status = 'learned'`, 
        [userId], (err, row) => {
            if (err) { handleError(err); return; }
            const count = row.count;
            
            const countChecks = [
                { id: 'first_word', threshold: 1 },
                { id: 'ten_words', threshold: 10 },
                { id: 'hundred_words', threshold: 100 },
                { id: 'five_hundred_words', threshold: 500 },
            ];
            
            countChecks.forEach(check => {
                if (count >= check.threshold) {
                    pendingTasks++;
                    unlockAchievement(userId, check.id, (err, result) => {
                        if (err) { handleError(err); return; }
                        if (result && result.newlyUnlocked) {
                            newlyUnlocked.push(result.achievement);
                        }
                        taskDone();
                    });
                }
            });
            taskDone();
        });

    pendingTasks++;
    db.all(`
        SELECT DISTINCT DATE(updated_at) as date 
        FROM learning_history 
        WHERE user_id = ? AND status = 'learned'
        ORDER BY date DESC
    `, [userId], (err, rows) => {
        if (err) { handleError(err); return; }
        
        const dates = rows.map(r => r.date);
        let streak = 0;
        const today = new Date();
        
        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            const dateStr = checkDate.toISOString().split('T')[0];
            
            if (dates.includes(dateStr)) {
                streak++;
            } else if (i > 0) {
                break;
            }
        }
        
        const streakChecks = [
            { id: 'three_day_streak', threshold: 3 },
            { id: 'seven_day_streak', threshold: 7 },
            { id: 'fifteen_day_streak', threshold: 15 },
        ];
        
        streakChecks.forEach(check => {
            if (streak >= check.threshold) {
                pendingTasks++;
                unlockAchievement(userId, check.id, (err, result) => {
                    if (err) { handleError(err); return; }
                    if (result && result.newlyUnlocked) {
                        newlyUnlocked.push(result.achievement);
                    }
                    taskDone();
                });
            }
        });
        taskDone();
    });
}

function checkTestAchievements(userId, testResult, callback) {
    const newlyUnlocked = [];
    let pendingTasks = 0;
    let hasError = false;

    function taskDone() {
        pendingTasks--;
        if (pendingTasks === 0 && !hasError) {
            callback(null, newlyUnlocked);
        }
    }

    function handleError(err) {
        if (!hasError) {
            hasError = true;
            callback(err);
        }
    }

    function tryUnlock(achievementId) {
        pendingTasks++;
        unlockAchievement(userId, achievementId, (err, result) => {
            if (err) { handleError(err); return; }
            if (result && result.newlyUnlocked) {
                newlyUnlocked.push(result.achievement);
            }
            taskDone();
        });
    }

    pendingTasks++;
    db.get(`SELECT COUNT(*) as count FROM test_history WHERE user_id = ? AND tested_at IS NOT NULL`, 
        [userId], (err, row) => {
            if (err) { handleError(err); return; }
            const testCount = Math.ceil(row.count / 15);
            
            if (testCount >= 1) tryUnlock('first_test');
            if (testCount >= 3) tryUnlock('three_tests');
            if (testCount >= 5) tryUnlock('five_tests');
            
            taskDone();
        });

    if (testResult.accuracy === 100) tryUnlock('perfect_score');
    if (testResult.accuracy >= 80) tryUnlock('high_accuracy');
    if (testResult.vocab_size >= 5000) tryUnlock('vocab_5000');
    if (testResult.vocab_size >= 10000) tryUnlock('vocab_10000');
}

function checkVocabLeapAchievement(userId, oldVocabSize, newVocabSize, callback) {
    if (newVocabSize - oldVocabSize >= 500) {
        unlockAchievement(userId, 'vocab_leap', (err, result) => {
            callback(null, result && result.newlyUnlocked ? [result.achievement] : []);
        });
    } else {
        callback(null, []);
    }
}

function markAchievementsRead(userId, callback) {
    db.run(`UPDATE user_achievements SET is_read = 1 WHERE user_id = ?`, [userId], function(err) {
        if (err) return callback(err);
        callback(null, { success: true, changed: this.changes });
    });
}

function getLatestAchievement(userId, callback) {
    db.get(`
        SELECT * FROM user_achievements 
        WHERE user_id = ?
        ORDER BY unlocked_at DESC
        LIMIT 1
    `, [userId], (err, row) => {
        if (err) return callback(err);
        if (!row) return callback(null, null);
        const achDef = ACHIEVEMENTS.find(a => a.id === row.achievement_id);
        if (achDef) {
            callback(null, {
                ...row,
                name: achDef.name,
                description: achDef.description,
                icon: achDef.icon,
                category: achDef.category
            });
        } else {
            callback(null, null);
        }
    });
}

function getUnreadCount(userId, callback) {
    db.get(`SELECT COUNT(*) as count FROM user_achievements WHERE user_id = ? AND is_read = 0`, 
        [userId], (err, row) => {
            if (err) return callback(err);
            callback(null, row.count);
        });
}

module.exports = {
    initAchievementsTable,
    getAllAchievements,
    getUserAchievements,
    unlockAchievement,
    checkLearningAchievements,
    checkTestAchievements,
    checkVocabLeapAchievement,
    markAchievementsRead,
    getLatestAchievement,
    getUnreadCount,
};
