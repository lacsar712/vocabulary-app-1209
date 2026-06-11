const db = require('./database');
const achievements = require('./achievements');

console.log('=== 调试学习成就 ===');

const userId = 5;

db.serialize(() => {
    console.log('用户 ' + userId + ' 的学习历史:');
    db.all(`SELECT * FROM learning_history WHERE user_id = ?`, [userId], (err, rows) => {
        if (err) {
            console.log('  错误: ' + err.message);
        } else {
            console.log('  记录数: ' + rows.length);
            rows.forEach(row => {
                console.log('  - id=' + row.id + ', word_id=' + row.word_id + ', status=' + row.status + ', updated_at=' + row.updated_at);
            });
        }
    });
    
    console.log('\n检查 count(distinct word_id):');
    db.get(`SELECT COUNT(DISTINCT word_id) as count FROM learning_history WHERE user_id = ? AND status = 'learned'`, [userId], (err, row) => {
        if (err) {
            console.log('  错误: ' + err.message);
        } else {
            console.log('  count=' + row.count);
        }
    });
    
    console.log('\n手动调用 checkLearningAchievements:');
    achievements.checkLearningAchievements(userId, (err, newAchievements) => {
        if (err) {
            console.log('  错误: ' + err.message);
        } else {
            console.log('  新解锁成就数: ' + newAchievements.length);
            newAchievements.forEach(a => {
                console.log('  - ' + a.achievement_id);
            });
        }
        
        console.log('\n再次检查用户成就:');
        achievements.getUserAchievements(userId, (err, result) => {
            if (err) {
                console.log('  错误: ' + err.message);
            } else {
                const unlocked = result.filter(a => a.unlocked);
                console.log('  已解锁成就: ' + unlocked.length);
                unlocked.forEach(a => {
                    console.log('  - ' + a.name + ' (' + a.id + ')');
                });
            }
        });
    });
});
