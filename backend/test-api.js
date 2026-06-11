const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const SECRET_KEY = "supersecretkey_vocabulary_1209";
const testUsername = 'testuser_achievement_v3';
const testPassword = 'test123';

function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: body });
                }
            });
        });
        req.on('error', reject);
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runTests() {
    console.log('=== 测试成就系统 API ===\n');

    try {
        console.log('1. 注册测试用户...');
        const registerRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { username: testUsername, password: testPassword });
        console.log('   状态:', registerRes.statusCode);
        console.log('   数据:', JSON.stringify(registerRes.data));

        console.log('\n2. 登录测试用户...');
        const loginRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { username: testUsername, password: testPassword });
        console.log('   状态:', loginRes.statusCode);
        const token = loginRes.data.token;
        const userId = loginRes.data.user.id;
        console.log('   用户ID:', userId);

        console.log('\n3. 获取成就列表...');
        const achievementsRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/achievements',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('   状态:', achievementsRes.statusCode);
        console.log('   成就数量:', achievementsRes.data.length);
        console.log('   前3个成就:');
        achievementsRes.data.slice(0, 3).forEach(a => {
            console.log(`     - ${a.icon} ${a.name}: ${a.description} (解锁: ${a.unlocked})`);
        });

        console.log('\n4. 获取未读成就数量...');
        const unreadRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/achievements/unread-count',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('   状态:', unreadRes.statusCode);
        console.log('   未读数量:', unreadRes.data.unread_count);

        console.log('\n5. 学习一个单词来解锁成就...');
        const learnRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/learn/record',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }, { word_id: 1, status: 'learned' });
        console.log('   状态:', learnRes.statusCode);
        console.log('   新解锁成就数量:', learnRes.data.new_achievements?.length || 0);
        if (learnRes.data.new_achievements && learnRes.data.new_achievements.length > 0) {
            learnRes.data.new_achievements.forEach(a => {
                console.log(`     - ${a.icon} ${a.name}: ${a.description}`);
            });
        }

        console.log('\n6. 再次获取成就列表验证...');
        const achievementsRes2 = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/achievements',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const unlockedCount = achievementsRes2.data.filter(a => a.unlocked).length;
        console.log('   状态:', achievementsRes2.statusCode);
        console.log('   已解锁成就数量:', unlockedCount);
        console.log('   已解锁的成就:');
        achievementsRes2.data.filter(a => a.unlocked).forEach(a => {
            console.log(`     - ${a.icon} ${a.name} (解锁于: ${a.unlocked_at})`);
        });

        console.log('\n7. 获取最近获得的成就...');
        const latestRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/achievements/latest',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('   状态:', latestRes.statusCode);
        if (latestRes.data) {
            console.log('   最近成就:', latestRes.data.icon, latestRes.data.name);
        }

        console.log('\n8. 标记成就为已读...');
        const markReadRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/achievements/mark-read',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('   状态:', markReadRes.statusCode);
        console.log('   标记数量:', markReadRes.data.changed);

        console.log('\n9. 再次检查未读数量...');
        const unreadRes2 = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/achievements/unread-count',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('   状态:', unreadRes2.statusCode);
        console.log('   未读数量:', unreadRes2.data.unread_count, '(预期: 0)');

        console.log('\n=== 所有测试完成 ===');
    } catch (error) {
        console.error('测试出错:', error.message);
        process.exit(1);
    }
}

runTests();
