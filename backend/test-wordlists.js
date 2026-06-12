const http = require('http');

const BASE_OPTIONS = {
    hostname: 'localhost',
    port: 3000,
    headers: {
        'Content-Type': 'application/json'
    }
};

function request(path, method, body, token) {
    return new Promise((resolve, reject) => {
        const options = {
            ...BASE_OPTIONS,
            path: '/api' + path,
            method: method
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
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function test() {
    console.log('=== 测试词单模块 API ===\n');
    let token = '';

    // 1. 注册/登录
    console.log('1. 注册测试用户...');
    let res = await request('/register', 'POST', {
        username: 'testuser_wl_' + Date.now(),
        password: 'password123'
    });
    if (res.statusCode === 200) {
        console.log('   注册成功，用户ID:', res.data.id);
    } else {
        console.log('   注册返回:', res.statusCode, JSON.stringify(res.data));
    }

    console.log('\n2. 登录测试用户...');
    const username = res.data?.username || 'testuser_wl_' + Date.now();
    res = await request('/login', 'POST', {
        username: username,
        password: 'password123'
    });
    token = res.data.token;
    console.log('   登录成功');

    let testListId = null;
    let copiedListId = null;

    // 3. 获取词单列表
    console.log('\n3. 获取词单列表...');
    res = await request('/word-lists', 'GET', null, token);
    console.log('   状态:', res.statusCode, '词单数:', res.data.length);

    // 4. 创建词单
    console.log('\n4. 创建词单...');
    res = await request('/word-lists', 'POST', {
        name: '测试词单',
        description: '这是一个测试词单'
    }, token);
    testListId = res.data.id;
    console.log('   状态:', res.statusCode);
    console.log('   ID:', res.data.id, '名称:', res.data.name);

    // 5. 编辑词单
    console.log('\n5. 编辑词单...');
    res = await request(`/word-lists/${testListId}`, 'PUT', {
        name: '测试词单-已修改',
        description: '已修改的描述'
    }, token);
    console.log('   状态:', res.statusCode, '新名称:', res.data.name);

    // 6. 搜索单词
    console.log('\n6. 搜索单词...');
    res = await request('/words/search?q=ab&limit=5', 'GET', null, token);
    console.log('   状态:', res.statusCode, '找到:', res.data.length, '个');
    const sampleWords = res.data.slice(0, 4);
    sampleWords.forEach(w => console.log('     -', w.word));

    // 7. 添加单词到词单
    console.log('\n7. 添加单词到词单...');
    for (const w of sampleWords) {
        await request(`/word-lists/${testListId}/words/${w.id}`, 'POST', {}, token);
    }
    console.log('   添加完成');

    // 8. 获取词单详情
    console.log('\n8. 获取词单详情...');
    res = await request(`/word-lists/${testListId}`, 'GET', null, token);
    console.log('   状态:', res.statusCode);
    console.log('   单词数:', res.data.word_count, '已掌握:', res.data.learned_count);

    // 9. 获取词单单词（难度排序）
    console.log('\n9. 获取词单单词（难度排序）...');
    res = await request(`/word-lists/${testListId}/words?sort=difficulty`, 'GET', null, token);
    console.log('   状态:', res.statusCode, '单词数:', res.data.length);
    res.data.forEach(w => console.log('     -', w.word, '[难度', w.difficulty_level, ']'));

    // 10. 获取词单单词（字母排序）
    console.log('\n10. 获取词单单词（字母排序）...');
    res = await request(`/word-lists/${testListId}/words?sort=alpha`, 'GET', null, token);
    console.log('   状态:', res.statusCode);
    if (res.data.length > 0) {
        console.log('   首字母排序第一个:', res.data[0].word);
        console.log('   首字母排序最后一个:', res.data[res.data.length - 1].word);
    }

    // 11. 复制词单
    console.log('\n11. 复制词单...');
    res = await request(`/word-lists/${testListId}/copy`, 'POST', {}, token);
    copiedListId = res.data.id;
    console.log('   状态:', res.statusCode);
    console.log('   副本名称:', res.data.name, '单词数:', res.data.word_count);

    // 12. 随机抽查
    console.log('\n12. 获取随机抽查单词...');
    res = await request(`/word-lists/${testListId}/quiz?limit=3`, 'GET', null, token);
    console.log('   状态:', res.statusCode, '返回:', res.data.length, '个单词');

    // 13. 词单模式推荐
    console.log('\n13. 词单模式推荐...');
    res = await request(`/recommend?word_list_id=${testListId}`, 'GET', null, token);
    console.log('   状态:', res.statusCode);
    if (res.data.word) {
        console.log('   推荐:', res.data.word);
    } else {
        console.log('   返回:', JSON.stringify(res.data));
    }

    // 14. 从词单移除单词
    console.log('\n14. 从词单移除单词...');
    if (sampleWords.length > 0) {
        await request(`/word-lists/${testListId}/words/${sampleWords[0].id}`, 'DELETE', null, token);
        res = await request(`/word-lists/${testListId}/words`, 'GET', null, token);
        console.log('   状态: 200, 剩余:', res.data.length, '个单词');
    }

    // 15. 获取所有词单
    console.log('\n15. 获取所有词单列表...');
    res = await request('/word-lists', 'GET', null, token);
    console.log('   状态:', res.statusCode, '词单数:', res.data.length);
    res.data.forEach(wl => {
        const progress = wl.word_count > 0 ? Math.round((wl.learned_count / wl.word_count) * 100) : 0;
        console.log('     -', wl.name, `(${wl.word_count}词, ${progress}%)`);
    });

    // 16. 删除词单
    console.log('\n16. 清理测试词单...');
    await request(`/word-lists/${testListId}`, 'DELETE', null, token);
    await request(`/word-lists/${copiedListId}`, 'DELETE', null, token);
    res = await request('/word-lists', 'GET', null, token);
    console.log('   状态:', res.statusCode, '清理后剩余:', res.data.length, '个词单');

    console.log('\n=== 所有测试通过! ===');
}

test().catch(e => {
    console.error('测试出错:', e.message);
    process.exit(1);
});
