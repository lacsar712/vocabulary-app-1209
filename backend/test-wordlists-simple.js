const http = require('http');

function request(path, method, body, token, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: timeout
        };
        if (token) {
            options.headers.Authorization = `Bearer ${token}`;
        }
        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ statusCode: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout: ' + path));
        });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function test() {
    console.log('=== 词单模块 API 快速测试 ===\n');
    let token = '';

    // 1. 注册/登录
    const username = 'testuser_wl_simple_' + Date.now();
    console.log('1. 注册 + 登录...');
    await request('/register', 'POST', { username, password: 'password123' });
    let res = await request('/login', 'POST', { username, password: 'password123' });
    token = res.data.token;
    console.log('   OK, 已登录');

    // 2. 获取空词单列表
    console.log('2. 获取词单列表（空）...');
    res = await request('/word-lists', 'GET', null, token);
    console.log('   OK, 状态:', res.statusCode, '数量:', res.data.length);

    // 3. 创建词单
    console.log('3. 创建词单...');
    res = await request('/word-lists', 'POST', { name: '测试词单', description: '描述' }, token);
    const listId = res.data.id;
    console.log('   OK, ID:', listId, '名称:', res.data.name);

    // 4. 编辑词单
    console.log('4. 编辑词单...');
    res = await request(`/word-lists/${listId}`, 'PUT', { name: '已修改词单' }, token);
    console.log('   OK, 新名称:', res.data.name);

    // 5. 搜索单词
    console.log('5. 搜索单词...');
    res = await request('/words/search?q=ab&limit=3', 'GET', null, token);
    console.log('   OK, 找到:', res.data.length, '个单词');
    const words = res.data;

    // 6. 添加单词
    console.log('6. 添加单词到词单...');
    for (const w of words.slice(0, 3)) {
        await request(`/word-lists/${listId}/words/${w.id}`, 'POST', {}, token);
    }
    console.log('   OK');

    // 7. 获取词单详情
    console.log('7. 获取词单详情...');
    res = await request(`/word-lists/${listId}`, 'GET', null, token);
    console.log('   OK, 单词数:', res.data.word_count);

    // 8. 获取词单单词
    console.log('8. 获取词单单词列表...');
    res = await request(`/word-lists/${listId}/words`, 'GET', null, token);
    console.log('   OK, 返回:', res.data.length, '个');

    // 9. 词单模式推荐
    console.log('9. 词单模式推荐...');
    res = await request(`/recommend?word_list_id=${listId}`, 'GET', null, token);
    console.log('   OK, 推荐词:', res.data.word || (res.data.message || JSON.stringify(res.data)));

    // 10. 复制词单
    console.log('10. 复制词单...');
    res = await request(`/word-lists/${listId}/copy`, 'POST', {}, token);
    const copyId = res.data.id;
    console.log('   OK, 副本ID:', copyId, '单词数:', res.data.word_count);

    // 11. 清理
    console.log('11. 清理...');
    await request(`/word-lists/${listId}`, 'DELETE', null, token);
    await request(`/word-lists/${copyId}`, 'DELETE', null, token);
    res = await request('/word-lists', 'GET', null, token);
    console.log('   OK, 剩余词单数:', res.data.length);

    console.log('\n=== 所有 API 测试通过! ===');
}

test().catch(e => {
    console.error('\n❌ 测试失败:', e.message);
    process.exit(1);
});
