const db = require('./database');
const achievements = require('./achievements');

console.log('=== 调试成就系统 ===');

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        console.log('数据库中的表:');
        rows.forEach(row => console.log('  - ' + row.name));
    });

    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        console.log('用户数量: ' + row.count);
    });

    db.get("SELECT * FROM users ORDER BY id DESC LIMIT 1", (err, user) => {
        if (user) {
            console.log('最新用户: id=' + user.id + ', username=' + user.username);
            
            console.log('\n测试 getUnreadCount...');
            achievements.getUnreadCount(user.id, (err, count) => {
                if (err) {
                    console.log('  错误: ' + err.message);
                } else {
                    console.log('  未读数量: ' + count);
                }
            });
            
            console.log('\n测试 getLatestAchievement...');
            achievements.getLatestAchievement(user.id, (err, result) => {
                if (err) {
                    console.log('  错误: ' + err.message);
                } else {
                    console.log('  结果: ' + JSON.stringify(result));
                }
            });
            
            console.log('\n测试 markAchievementsRead...');
            achievements.markAchievementsRead(user.id, (err, result) => {
                if (err) {
                    console.log('  错误: ' + err.message);
                } else {
                    console.log('  结果: ' + JSON.stringify(result));
                }
            });
            
            console.log('\n测试 getUserAchievements...');
            achievements.getUserAchievements(user.id, (err, result) => {
                if (err) {
                    console.log('  错误: ' + err.message);
                } else {
                    console.log('  成就数量: ' + result.length);
                    console.log('  已解锁: ' + result.filter(a => a.unlocked).length);
                }
            });
        }
    });
});
