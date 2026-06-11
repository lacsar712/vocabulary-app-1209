const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsInVzZXJuYW1lIjoidGVzdHVzZXJfYWNoaWV2ZW1lbnRfdjIiLCJpYXQiOjE3ODA1MTMyODd9.Ffl7rWlThq1cG_6FpNw0qJgVb55Z7Q3aW7Xqz8Vh1cM';

function testRequest(path, method) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ statusCode: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: data, raw: true });
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function runTests() {
    console.log('=== 简单测试 ===\n');

    console.log('1. 测试 GET /api/achievements');
    const res1 = await testRequest('/api/achievements', 'GET');
    console.log('   状态:', res1.statusCode);
    if (res1.statusCode !== 200) {
        console.log('   错误:', JSON.stringify(res1.data));
    } else {
        console.log('   成就数量:', res1.data.length);
    }

    console.log('\n2. 测试 GET /api/achievements/latest');
    const res2 = await testRequest('/api/achievements/latest', 'GET');
    console.log('   状态:', res2.statusCode);
    if (res2.statusCode !== 200) {
        console.log('   错误:', JSON.stringify(res2.data));
    } else {
        console.log('   数据:', JSON.stringify(res2.data));
    }

    console.log('\n3. 测试 GET /api/achievements/unread-count');
    const res3 = await testRequest('/api/achievements/unread-count', 'GET');
    console.log('   状态:', res3.statusCode);
    if (res3.statusCode !== 200) {
        console.log('   错误:', JSON.stringify(res3.data));
    } else {
        console.log('   未读数量:', res3.data.unread_count);
    }

    console.log('\n4. 测试 POST /api/achievements/mark-read');
    const res4 = await testRequest('/api/achievements/mark-read', 'POST');
    console.log('   状态:', res4.statusCode);
    if (res4.statusCode !== 200) {
        console.log('   错误:', JSON.stringify(res4.data));
    } else {
        console.log('   结果:', JSON.stringify(res4.data));
    }

    console.log('\n=== 测试完成 ===');
}

runTests().catch(console.error);
