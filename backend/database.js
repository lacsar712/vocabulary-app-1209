const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./data/vocab.db', (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// frequency: 使用频率 (1-10, 10为最常用)
// difficulty_level: 难度等级 (1=基础, 2=初级, 3=中级, 4=中高级, 5=高级, 6=专业)
const wordList = [
    // 基础词汇 (difficulty_level: 1, rank: 100-500)
    { word: "apple", pronunciation: "/ˈæpəl/", pos: "n.", definition: "苹果", example: "She ate an apple for lunch.", rank: 100, frequency: 10, difficulty_level: 1 },
    { word: "book", pronunciation: "/bʊk/", pos: "n.", definition: "书，书籍", example: "I read a book about history.", rank: 150, frequency: 10, difficulty_level: 1 },
    { word: "cat", pronunciation: "/kæt/", pos: "n.", definition: "猫", example: "The cat sat on the mat.", rank: 120, frequency: 10, difficulty_level: 1 },
    { word: "dog", pronunciation: "/dɒɡ/", pos: "n.", definition: "狗", example: "We could hear a dog barking.", rank: 130, frequency: 10, difficulty_level: 1 },
    { word: "eat", pronunciation: "/iːt/", pos: "v.", definition: "吃", example: "Do you want to eat lunch now?", rank: 200, frequency: 10, difficulty_level: 1 },
    { word: "water", pronunciation: "/ˈwɔːtər/", pos: "n.", definition: "水", example: "I need a glass of water.", rank: 180, frequency: 10, difficulty_level: 1 },
    { word: "house", pronunciation: "/haʊs/", pos: "n.", definition: "房子", example: "They live in a big house.", rank: 220, frequency: 10, difficulty_level: 1 },
    { word: "time", pronunciation: "/taɪm/", pos: "n.", definition: "时间", example: "What time is it?", rank: 250, frequency: 10, difficulty_level: 1 },

    // 初级词汇 (difficulty_level: 2, rank: 500-1500)
    { word: "ability", pronunciation: "/əˈbɪləti/", pos: "n.", definition: "做某事所需的身体或脑力；能力", example: "She had the ability to explain things clearly.", rank: 500, frequency: 9, difficulty_level: 2 },
    { word: "abandon", pronunciation: "/əˈbændən/", pos: "v.", definition: "永远离开某地、某人或某物；抛弃", example: "We had to abandon the car.", rank: 1100, frequency: 7, difficulty_level: 2 },
    { word: "absence", pronunciation: "/ˈæbsəns/", pos: "n.", definition: "缺席；不在场", example: "A new manager was appointed during her absence.", rank: 1200, frequency: 7, difficulty_level: 2 },
    { word: "absolute", pronunciation: "/ˈæbsəluːt/", pos: "adj.", definition: "完全的；绝对的", example: "I have absolute faith in her judgment.", rank: 1300, frequency: 7, difficulty_level: 2 },
    { word: "academic", pronunciation: "/ˌækəˈdemɪk/", pos: "adj.", definition: "学校的；学院的；学术的", example: "The book brings together several academic subjects.", rank: 1500, frequency: 8, difficulty_level: 2 },
    { word: "accept", pronunciation: "/əkˈsept/", pos: "v.", definition: "接受", example: "Please accept my apology.", rank: 800, frequency: 9, difficulty_level: 2 },
    { word: "achieve", pronunciation: "/əˈtʃiːv/", pos: "v.", definition: "达到；实现", example: "She achieved her goal.", rank: 900, frequency: 8, difficulty_level: 2 },
    { word: "advice", pronunciation: "/ədˈvaɪs/", pos: "n.", definition: "建议；忠告", example: "Can you give me some advice?", rank: 1000, frequency: 8, difficulty_level: 2 },

    // 中级词汇 (difficulty_level: 3, rank: 2000-4000)
    { word: "yearn", pronunciation: "/jɜːn/", pos: "v.", definition: "渴望，切盼", example: "Despite his great commercial success he still yearns for critical approval.", rank: 3500, frequency: 5, difficulty_level: 3 },
    { word: "benevolent", pronunciation: "/bəˈnevələnt/", pos: "adj.", definition: "慈善的；仁慈的", example: "He was a benevolent old man and wouldn't hurt a fly.", rank: 4000, frequency: 4, difficulty_level: 3 },
    { word: "wane", pronunciation: "/weɪn/", pos: "v.", definition: "（势力、影响等）衰弱，减退", example: "By the late 70s the band's popularity was beginning to wane.", rank: 4200, frequency: 5, difficulty_level: 3 },
    { word: "eloquent", pronunciation: "/ˈeləkwənt/", pos: "adj.", definition: "雄辩的；有说服力的", example: "She gave an eloquent speech.", rank: 3800, frequency: 5, difficulty_level: 3 },
    { word: "diligent", pronunciation: "/ˈdɪlɪdʒənt/", pos: "adj.", definition: "勤奋的；勤勉的", example: "He is a diligent student.", rank: 3200, frequency: 6, difficulty_level: 3 },
    { word: "ambiguous", pronunciation: "/æmˈbɪɡjuəs/", pos: "adj.", definition: "模棱两可的；含糊的", example: "The statement was ambiguous.", rank: 3600, frequency: 5, difficulty_level: 3 },

    // 中高级词汇 (difficulty_level: 4, rank: 4000-6000)
    { word: "ubiquitous", pronunciation: "/juːˈbɪkwɪtəs/", pos: "adj.", definition: "普遍存在的，无所不在的", example: "Leather is very much in fashion this season, as is the ubiquitous denim.", rank: 4500, frequency: 4, difficulty_level: 4 },
    { word: "zealous", pronunciation: "/ˈzeləs/", pos: "adj.", definition: "热情的；狂热的", example: "No one was more zealous than Neil in supporting the proposal.", rank: 4700, frequency: 4, difficulty_level: 4 },
    { word: "eclectic", pronunciation: "/ɪˈklektɪk/", pos: "adj.", definition: "不拘一格的；兼收并蓄的", example: "It was an eclectic mix of our ethnic foods and traditional Thanksgiving food.", rank: 4800, frequency: 4, difficulty_level: 4 },
    { word: "magnanimous", pronunciation: "/mæɡˈnænɪməs/", pos: "adj.", definition: "（对敌人或失败者）宽宏大量的", example: "The team's manager was magnanimous in victory.", rank: 5100, frequency: 3, difficulty_level: 4 },
    { word: "fabricate", pronunciation: "/ˈfæbrɪkeɪt/", pos: "v.", definition: "捏造，虚构（借口、谎言等）", example: "He was late, so he fabricated an excuse to avoid trouble.", rank: 5200, frequency: 4, difficulty_level: 4 },
    { word: "quintessential", pronunciation: "/ˌkwɪntɪˈsenʃəl/", pos: "adj.", definition: "最典型的；完美的", example: "Sheep's milk cheese is the quintessential Corsican cheese.", rank: 5300, frequency: 4, difficulty_level: 4 },
    { word: "debilitate", pronunciation: "/dɪˈbɪlɪteɪt/", pos: "v.", definition: "使（身心）衰弱", example: "Chemotherapy exhausted and debilitated him.", rank: 5500, frequency: 3, difficulty_level: 4 },
    { word: "xenophobia", pronunciation: "/ˌzenəˈfəʊbiə/", pos: "n.", definition: "仇外，惧外", example: "The government has denied that the new policy is motivated by xenophobia.", rank: 5600, frequency: 4, difficulty_level: 4 },
    { word: "kaleidoscope", pronunciation: "/kəˈlaɪdəskəʊp/", pos: "n.", definition: "千变万化；万花筒", example: "The street bazaar was a kaleidoscope of colors, smells, and sounds.", rank: 5800, frequency: 3, difficulty_level: 4 },
    { word: "vacillate", pronunciation: "/ˈvæsɪleɪt/", pos: "v.", definition: "摇摆；犹豫不定", example: "Her mood vacillated between hope and despair.", rank: 5900, frequency: 3, difficulty_level: 4 },
    { word: "juxtapose", pronunciation: "/ˌdʒʌkstəˈpəʊz/", pos: "v.", definition: "把…并列；把…并置（以作对比）", example: "The exhibition juxtaposes Picasso's early drawings with some of his later works.", rank: 6000, frequency: 3, difficulty_level: 4 },

    // 高级词汇 (difficulty_level: 5, rank: 6000-8000)
    { word: "rambunctious", pronunciation: "/ræmˈbʌŋkʃəs/", pos: "adj.", definition: "精力过剩的；难管束的", example: "The puppy was rambunctious and chewed on everything.", rank: 6100, frequency: 2, difficulty_level: 5 },
    { word: "languid", pronunciation: "/ˈlæŋɡwɪd/", pos: "adj.", definition: "慢悠悠的；慵懒的", example: "He sat on the porch, enjoying the languid afternoon heat.", rank: 6200, frequency: 2, difficulty_level: 5 },
    { word: "taciturn", pronunciation: "/ˈtæsɪtɜːn/", pos: "adj.", definition: "沉默寡言的", example: "He was a taciturn man who spent most of his time alone.", rank: 6300, frequency: 2, difficulty_level: 5 },
    { word: "cacophony", pronunciation: "/kəˈkɒfəni/", pos: "n.", definition: "刺耳嘈杂的声音；杂音", example: "As we entered the farmyard we were met with a cacophony of animal sounds.", rank: 6500, frequency: 2, difficulty_level: 5 },
    { word: "sagacious", pronunciation: "/səˈɡeɪʃəs/", pos: "adj.", definition: "聪明的，睿智的；有远见的", example: "The leader was known for her sagacious decisions during the crisis.", rank: 6700, frequency: 2, difficulty_level: 5 },
    { word: "nefarious", pronunciation: "/nɪˈfeəriəs/", pos: "adj.", definition: "（尤指活动）邪恶的，不道德的", example: "The company's CEO seems to have been involved in some nefarious practices.", rank: 6800, frequency: 2, difficulty_level: 5 },
    { word: "garrulous", pronunciation: "/ˈɡærələs/", pos: "adj.", definition: "（尤指对琐事）喋喋不休的", example: "I had a garrulous neighbor who talked specifically about her cat.", rank: 7000, frequency: 2, difficulty_level: 5 },
    { word: "harangue", pronunciation: "/həˈræŋ/", pos: "v.", definition: "（愤怒而有力地）训斥，谴责", example: "A drunk in the station was haranguing passers-by.", rank: 7200, frequency: 2, difficulty_level: 5 },
    { word: "obfuscate", pronunciation: "/ˈɒbfʌskeɪt/", pos: "v.", definition: "（尤指故意）可能会混淆；使困惑", example: "She was criticized for using arguments that obfuscated the main issue.", rank: 7500, frequency: 2, difficulty_level: 5 },

    // 专业词汇 (difficulty_level: 6, rank: 8000+)
    { word: "iconoclast", pronunciation: "/naɪˈkɒnəklæst/", pos: "n.", definition: "反传统者；打破偶像者", example: "Rogers, an iconoclast in architecture, is sometimes described as shameless.", rank: 8000, frequency: 1, difficulty_level: 6 },
    { word: "palimpsest", pronunciation: "/ˈpælɪmpsest/", pos: "n.", definition: "多层次结构；具有多重意义的事物", example: "The city is a palimpsest of different cultures and eras.", rank: 9000, frequency: 1, difficulty_level: 6 },
    { word: "sesquipedalian", pronunciation: "/ˌseskwɪpɪˈdeɪliən/", pos: "adj.", definition: "（词语）冗长的；好用长词的", example: "His sesquipedalian prose style made the article difficult to read.", rank: 9500, frequency: 1, difficulty_level: 6 },
    { word: "defenestration", pronunciation: "/diːˌfenɪˈstreɪʃən/", pos: "n.", definition: "将人或物从窗户扔出", example: "The defenestration of Prague was a pivotal event in European history.", rank: 9200, frequency: 1, difficulty_level: 6 }
];


db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password_hash TEXT,
        vocab_size INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Words table - create if not exists
    db.run(`CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT UNIQUE,
        pronunciation TEXT,
        pos TEXT,
        definition TEXT,
        example TEXT,
        rank INTEGER,
        frequency INTEGER DEFAULT 5,
        difficulty_level INTEGER DEFAULT 3
    )`);

    // Migration: Add new columns if they don't exist
    db.all("PRAGMA table_info(words)", (err, columns) => {
        if (err) {
            console.error('Error checking table info:', err);
            return;
        }

        const columnNames = columns.map(c => c.name);

        if (!columnNames.includes('frequency')) {
            db.run("ALTER TABLE words ADD COLUMN frequency INTEGER DEFAULT 5", (err) => {
                if (err) console.error('Error adding frequency column:', err);
                else console.log('Added frequency column to words table');
            });
        }

        if (!columnNames.includes('difficulty_level')) {
            db.run("ALTER TABLE words ADD COLUMN difficulty_level INTEGER DEFAULT 3", (err) => {
                if (err) console.error('Error adding difficulty_level column:', err);
                else console.log('Added difficulty_level column to words table');
            });
        }
    });

    // Test history table for adaptive testing
    db.run(`CREATE TABLE IF NOT EXISTS test_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        word_id INTEGER,
        is_correct INTEGER,
        word_rank INTEGER,
        tested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(word_id) REFERENCES words(id)
    )`);

    // Learning History
    db.run(`CREATE TABLE IF NOT EXISTS learning_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        word_id INTEGER,
        status TEXT, -- 'learned', 'mastered'
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(word_id) REFERENCES words(id)
    )`);

    // User Achievements
    db.run(`CREATE TABLE IF NOT EXISTS user_achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        achievement_id TEXT,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_read INTEGER DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id),
        UNIQUE(user_id, achievement_id)
    )`);

    // Word Lists (Custom Vocabulary Lists)
    db.run(`CREATE TABLE IF NOT EXISTS word_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Word List Items (Many-to-Many relationship)
    db.run(`CREATE TABLE IF NOT EXISTS word_list_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_list_id INTEGER NOT NULL,
        word_id INTEGER NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(word_list_id) REFERENCES word_lists(id) ON DELETE CASCADE,
        FOREIGN KEY(word_id) REFERENCES words(id),
        UNIQUE(word_list_id, word_id)
    )`);

    // Reading Practice History
    db.run(`CREATE TABLE IF NOT EXISTS reading_practice_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        word_id INTEGER NOT NULL,
        practice_count INTEGER DEFAULT 1,
        last_practiced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(word_id) REFERENCES words(id),
        UNIQUE(user_id, word_id)
    )`);

    // Reading Practice Favorites
    db.run(`CREATE TABLE IF NOT EXISTS reading_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        word_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(word_id) REFERENCES words(id),
        UNIQUE(user_id, word_id)
    )`);

    // Daily Challenge Questions - stores the 5 daily questions for each date
    db.run(`CREATE TABLE IF NOT EXISTS daily_challenge_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        challenge_date TEXT NOT NULL,
        question_index INTEGER NOT NULL,
        question_type TEXT NOT NULL,
        word_id INTEGER NOT NULL,
        options TEXT,
        correct_answer TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(word_id) REFERENCES words(id),
        UNIQUE(challenge_date, question_index)
    )`);

    // Daily Challenge Submissions - stores user submissions (one per day per user)
    db.run(`CREATE TABLE IF NOT EXISTS daily_challenge_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        challenge_date TEXT NOT NULL,
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        time_spent INTEGER NOT NULL,
        answers TEXT NOT NULL,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        UNIQUE(user_id, challenge_date)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS crossword_puzzles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        puzzle_date TEXT NOT NULL,
        grid TEXT NOT NULL,
        clues_across TEXT NOT NULL,
        clues_down TEXT NOT NULL,
        words TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(puzzle_date)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS crossword_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        puzzle_date TEXT NOT NULL,
        time_spent INTEGER NOT NULL,
        hints_used INTEGER DEFAULT 0,
        is_correct INTEGER DEFAULT 0,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        UNIQUE(user_id, puzzle_date)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS crossword_best_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        best_time INTEGER NOT NULL,
        best_hints INTEGER DEFAULT 0,
        best_date TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        UNIQUE(user_id)
    )`);

    // Etymology Entries - 词源百科条目
    db.run(`CREATE TABLE IF NOT EXISTS etymology_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id INTEGER NOT NULL,
        word TEXT NOT NULL,
        language_origin TEXT NOT NULL,
        root_meaning TEXT NOT NULL,
        components TEXT NOT NULL,
        explanation TEXT NOT NULL,
        related_words TEXT NOT NULL,
        word_cloud TEXT NOT NULL,
        difficulty_level INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(word_id) REFERENCES words(id),
        UNIQUE(word_id)
    )`);

    // Etymology Roots - 词根前缀索引表
    db.run(`CREATE TABLE IF NOT EXISTS etymology_roots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        root TEXT NOT NULL,
        meaning TEXT NOT NULL,
        language TEXT NOT NULL,
        example_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(root)
    )`);

    // Etymology Favorites - 用户收藏的词源条目
    db.run(`CREATE TABLE IF NOT EXISTS etymology_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        etymology_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(etymology_id) REFERENCES etymology_entries(id),
        UNIQUE(user_id, etymology_id)
    )`);

    // Seed Data with UPSERT - delay to ensure migration completes
    setTimeout(() => {
        const stmt = db.prepare(`
            INSERT INTO words (word, pronunciation, pos, definition, example, rank, frequency, difficulty_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(word) DO UPDATE SET
                definition=excluded.definition,
                pos=excluded.pos,
                frequency=excluded.frequency,
                difficulty_level=excluded.difficulty_level
        `);

        wordList.forEach(w => {
            stmt.run(w.word, w.pronunciation, w.pos, w.definition, w.example, w.rank, w.frequency, w.difficulty_level);
        });
        stmt.finalize();
        console.log('Word data seeded successfully');

        // Seed etymology roots data
        const rootList = [
            { root: 'bene-', meaning: '好', language: 'Latin' },
            { root: 'vol-', meaning: '意愿，希望', language: 'Latin' },
            { root: 'dict-', meaning: '说，言', language: 'Latin' },
            { root: 'eloqu-', meaning: '说话', language: 'Latin' },
            { root: 'ent-', meaning: '存在，本质', language: 'Latin' },
            { root: 'diligent-', meaning: '勤奋', language: 'Latin' },
            { root: 'amb-', meaning: '周围，两边', language: 'Latin' },
            { root: 'ag-', meaning: '做，驱动', language: 'Latin' },
            { root: 'ous-', meaning: '充满...的', language: 'Latin' },
            { root: 'ubiqu-', meaning: '哪里，何处', language: 'Latin' },
            { root: 'zeal-', meaning: '热情', language: 'Greek' },
            { root: 'magn-', meaning: '大', language: 'Latin' },
            { root: 'anim-', meaning: '心灵，精神', language: 'Latin' },
            { root: 'fabric-', meaning: '制造，建造', language: 'Latin' },
            { root: 'quint-', meaning: '第五', language: 'Latin' },
            { root: 'essent-', meaning: '本质，存在', language: 'Latin' },
            { root: 'debilit-', meaning: '虚弱', language: 'Latin' },
            { root: 'xeno-', meaning: '外来，陌生', language: 'Greek' },
            { root: 'phob-', meaning: '恐惧', language: 'Greek' },
            { root: 'kaleido-', meaning: '美丽', language: 'Greek' },
            { root: 'scope-', meaning: '看，观察', language: 'Greek' },
            { root: 'vacill-', meaning: '摇摆', language: 'Latin' },
            { root: 'juxta-', meaning: '靠近，并列', language: 'Latin' },
            { root: 'pos-', meaning: '放置', language: 'Latin' },
            { root: 'tacit-', meaning: '沉默', language: 'Latin' },
            { root: 'caco-', meaning: '坏，恶劣', language: 'Greek' },
            { root: 'phon-', meaning: '声音', language: 'Greek' },
            { root: 'sag-', meaning: '感知，知道', language: 'Latin' },
            { root: 'ne-', meaning: '不，否定', language: 'Latin' },
            { root: 'far-', meaning: '做，行动', language: 'Latin' },
            { root: 'garr-', meaning: '唠叨', language: 'Latin' },
            { root: 'obfusc-', meaning: '黑暗，模糊', language: 'Latin' },
            { root: 'icono-', meaning: '偶像，形象', language: 'Greek' },
            { root: 'clast-', meaning: '打破', language: 'Greek' },
            { root: 'palimps-', meaning: '再次摩擦', language: 'Greek' },
            { root: 'sesqui-', meaning: '一个半', language: 'Latin' },
            { root: 'ped-', meaning: '脚', language: 'Latin' },
            { root: 'fenestr-', meaning: '窗户', language: 'Latin' },
            { root: 'ab-', meaning: '离开，远离', language: 'Latin' },
            { root: 'sence-', meaning: '存在，本质', language: 'Latin' },
            { root: 'solut-', meaning: '松开，解开', language: 'Latin' },
            { root: 'academ-', meaning: '学术，学院', language: 'Greek' },
            { root: 'cept-', meaning: '拿，取', language: 'Latin' },
            { root: 'iev-', meaning: '去，走', language: 'Latin' },
        ];

        const rootStmt = db.prepare(`
            INSERT OR IGNORE INTO etymology_roots (root, meaning, language)
            VALUES (?, ?, ?)
        `);
        rootList.forEach(r => {
            rootStmt.run(r.root, r.meaning, r.language);
        });
        rootStmt.finalize();
        console.log('Etymology roots data seeded successfully');

        // Seed etymology entries data
        const etymologyList = [
            {
                word: 'benevolent',
                language_origin: 'Latin',
                root_meaning: '由 bene（好）+ volens（意愿的）组成',
                components: JSON.stringify([
                    { part: 'bene-', meaning: '好', origin: 'Latin' },
                    { part: 'vol-', meaning: '意愿，希望', origin: 'Latin' },
                    { part: '-ent', meaning: '形容词后缀，表示「具有...性质的」', origin: 'Latin' }
                ]),
                explanation: '这个词源自拉丁语 benevolens，字面意思是「怀有良好意愿的」。古罗马人用它来形容那些乐善好施、对他人抱有善意的人。在现代英语中，benevolent 保留了「仁慈的、慈善的」这层含义，常用来描述慈祥的长者或人道主义者。',
                related_words: JSON.stringify(['benefit', 'volunteer', 'volition', 'benevolence', 'malevolent']),
                word_cloud: JSON.stringify(['善良', '慈善', '仁慈', '博爱', '慷慨', '热心', '好人', '长者', '公益', '关怀'])
            },
            {
                word: 'eloquent',
                language_origin: 'Latin',
                root_meaning: '由 e-（出）+ loqui（说）组成',
                components: JSON.stringify([
                    { part: 'e-', meaning: '出，向外', origin: 'Latin' },
                    { part: 'loqu-', meaning: '说话，言语', origin: 'Latin' },
                    { part: '-ent', meaning: '形容词后缀', origin: 'Latin' }
                ]),
                explanation: 'eloquent 源自拉丁语 eloquens，原意是「能说出来的」，后来演变为「善于表达的」。古罗马时期，雄辩术是政治家和律师的必备技能，西塞罗等演说家被誉为 eloquent 的典范。如今这个词不仅指口才好，还暗示言辞有说服力和感染力。',
                related_words: JSON.stringify(['eloquence', 'loquacious', 'colloquial', 'soliloquy', 'interlocutor']),
                word_cloud: JSON.stringify(['雄辩', '口才', '演说', '说服力', '感染力', '演讲', '表达', '语言', '修辞', '辩论'])
            },
            {
                word: 'diligent',
                language_origin: 'Latin',
                root_meaning: '由 di-（分开）+ legere（选择，收集）组成',
                components: JSON.stringify([
                    { part: 'di-', meaning: '分开，离析', origin: 'Latin' },
                    { part: 'lig-', meaning: '选择，收集', origin: 'Latin' },
                    { part: '-ent', meaning: '形容词后缀', origin: 'Latin' }
                ]),
                explanation: 'diligent 来自拉丁语 diligens，原意是「仔细挑选的」，引申为「用心的、勤勉的」。古罗马人认为，勤奋的人会仔细筛选自己要做的事情，不敷衍了事。这个词在现代英语中保留了「勤勉用功」的核心含义，强调持续性的专注和努力。',
                related_words: JSON.stringify(['diligence', 'deliberate', 'select', 'collect', 'intelligent']),
                word_cloud: JSON.stringify(['勤奋', '勤勉', '用功', '专注', '努力', '坚持', '认真', '踏实', '肯干', '敬业'])
            },
            {
                word: 'ambiguous',
                language_origin: 'Latin',
                root_meaning: '由 ambi-（两边）+ agere（驱动，引导）组成',
                components: JSON.stringify([
                    { part: 'ambi-', meaning: '周围，两边', origin: 'Latin' },
                    { part: 'ag-', meaning: '做，驱动，引导', origin: 'Latin' },
                    { part: '-uous', meaning: '形容词后缀，表示「充满...的」', origin: 'Latin' }
                ]),
                explanation: 'ambiguous 源自拉丁语 ambiguus，字面意思是「往两边驱动的」，引申为「不确定的、模棱两可的」。想象一辆车同时被拉向两个方向，结果就是摇摆不定。在现代英语中，这个词用来形容那些含义不明确、可以有多种解释的陈述或情况。',
                related_words: JSON.stringify(['ambiguity', 'ambition', 'ambivalent', 'agile', 'action']),
                word_cloud: JSON.stringify(['模糊', '含糊', '歧义', '不确定', '模棱两可', '费解', '困惑', '双关', '隐晦', '捉摸不透'])
            },
            {
                word: 'ubiquitous',
                language_origin: 'Latin',
                root_meaning: '由 ubique（到处）+ -itous（形容词后缀）组成',
                components: JSON.stringify([
                    { part: 'ubiqu-', meaning: '哪里，何处', origin: 'Latin' },
                    { part: '-itous', meaning: '形容词后缀，表示「具有...性质的」', origin: 'Latin' }
                ]),
                explanation: 'ubiquitous 源自拉丁语 ubique，意为「到处、处处」。基督教神学中用它来描述上帝「无所不在」的属性。进入英语后，这个词逐渐世俗化，用来形容那些随处可见、仿佛同时存在于所有地方的事物，比如现代社会中的智能手机。',
                related_words: JSON.stringify(['ubiquity', 'ubiquitarian', 'omnipresent', 'pervasive', 'universal']),
                word_cloud: JSON.stringify(['无处不在', '随处可见', '普遍', '遍及', '泛滥', '大众化', '常态', '遍布', '处处', '俯拾即是'])
            },
            {
                word: 'zealous',
                language_origin: 'Greek',
                root_meaning: '来自希腊语 zelos（热情、嫉妒）',
                components: JSON.stringify([
                    { part: 'zeal-', meaning: '热情，热忱', origin: 'Greek' },
                    { part: '-ous', meaning: '形容词后缀，表示「充满...的」', origin: 'Latin' }
                ]),
                explanation: 'zealous 源自希腊语 zelos，原意既指「神圣的热情」，也指「激烈的嫉妒」。有趣的是，英语中 zeal（热情）和 jealous（嫉妒）其实是同源词，反映了人类情感中「极度关心」与「害怕失去」之间微妙的边界。如今 zealous 主要指对事业或信仰的热忱投入。',
                related_words: JSON.stringify(['zeal', 'zealot', 'jealous', 'jealousy', 'enthusiastic']),
                word_cloud: JSON.stringify(['热情', '热忱', '狂热', '虔诚', '投入', '积极', '热衷', '奋发', '热心', '激情'])
            },
            {
                word: 'magnanimous',
                language_origin: 'Latin',
                root_meaning: '由 magnus（大）+ animus（心灵）组成',
                components: JSON.stringify([
                    { part: 'magn-', meaning: '大，宏大', origin: 'Latin' },
                    { part: 'anim-', meaning: '心灵，精神，生命', origin: 'Latin' },
                    { part: '-ous', meaning: '形容词后缀', origin: 'Latin' }
                ]),
                explanation: 'magnanimous 直接来自拉丁语 magnanimus，字面意思是「心灵伟大的」。古罗马哲学家塞内加认为，宽宏大量是最高尚的美德之一，表现为不因小事而动怒，能够宽恕他人的冒犯。在现代英语中，这个词特指对敌人或失败者展现出的高尚宽容。',
                related_words: JSON.stringify(['magnanimity', 'magnify', 'magnificent', 'animate', 'unanimous']),
                word_cloud: JSON.stringify(['宽宏大量', '慷慨', '高尚', '宽容', '大度', '君子', '不计较', '胸襟开阔', '雅量', '包容'])
            },
            {
                word: 'fabricate',
                language_origin: 'Latin',
                root_meaning: '来自拉丁语 faber（工匠、手艺人）',
                components: JSON.stringify([
                    { part: 'fabric-', meaning: '制造，建造，构造', origin: 'Latin' },
                    { part: '-ate', meaning: '动词后缀，表示「使...」', origin: 'Latin' }
                ]),
                explanation: 'fabricate 源自拉丁语 fabricare，原意是「用手艺建造」。古罗马的 faber 包括铁匠、木匠等各种工匠。后来这个词的含义逐渐扩展，既可以指真实的制造（如建造房屋），也可以指虚构的编造（如捏造谎言），暗示「精心构造」的意味。',
                related_words: JSON.stringify(['fabric', 'fabrication', 'fabulous', 'confabulate', 'forge']),
                word_cloud: JSON.stringify(['捏造', '虚构', '编造', '伪造', '制造', '构建', '杜撰', '凭空', '谎言', '造假'])
            },
            {
                word: 'quintessential',
                language_origin: 'Latin',
                root_meaning: '由 quinta essentia（第五元素）演变而来',
                components: JSON.stringify([
                    { part: 'quint-', meaning: '第五', origin: 'Latin' },
                    { part: 'essent-', meaning: '本质，存在', origin: 'Latin' },
                    { part: '-ial', meaning: '形容词后缀', origin: 'Latin' }
                ]),
                explanation: 'quintessential 源自中世纪拉丁语 quinta essentia，即「第五元素」。古希腊哲学认为世界由火、水、土、气四大元素构成，而亚里士多德提出了构成天体的「以太」作为第五元素，是最纯粹的本质。现代英语中这个词用来形容「最典型、最完美的化身」。',
                related_words: JSON.stringify(['quintessence', 'essential', 'essence', 'quintet', 'entity']),
                word_cloud: JSON.stringify(['典型', '典范', '精髓', '纯粹', '完美', '化身', '代表', '本质', '核心', '典范'])
            },
            {
                word: 'debilitate',
                language_origin: 'Latin',
                root_meaning: '由 de-（向下）+ habilis（强壮的）组成',
                components: JSON.stringify([
                    { part: 'de-', meaning: '向下，去除', origin: 'Latin' },
                    { part: 'bilit-', meaning: '力量，强壮', origin: 'Latin' },
                    { part: '-ate', meaning: '动词后缀', origin: 'Latin' }
                ]),
                explanation: 'debilitate 源自拉丁语 debilitare，原意是「使力量下降」。拉丁语 habilis 意为「强壮的、能干的」，加上否定前缀 de- 就成了「削弱」。这个词在医学语境中很常见，描述疾病或治疗对身体的削弱作用，也可用于比喻精神或意志的衰弱。',
                related_words: JSON.stringify(['debility', 'ability', 'habilitate', 'rehabilitate', 'weak']),
                word_cloud: JSON.stringify(['衰弱', '削弱', '疲惫', '虚弱', '无力', '憔悴', '萎靡', '虚脱', '乏力', '身心俱疲'])
            },
            {
                word: 'xenophobia',
                language_origin: 'Greek',
                root_meaning: '由 xenos（外来者）+ phobos（恐惧）组成',
                components: JSON.stringify([
                    { part: 'xeno-', meaning: '外来的，陌生的', origin: 'Greek' },
                    { part: 'phob-', meaning: '恐惧，害怕', origin: 'Greek' },
                    { part: '-ia', meaning: '名词后缀，表示「状态、疾病」', origin: 'Greek' }
                ]),
                explanation: 'xenophobia 直接使用希腊语词根组合：xenos 意为「陌生人、外来者」，phobos 意为「恐惧」。古希腊神话中有「好客之神」宙斯·克塞尼奥斯（Zeus Xenios），保护外来旅行者。到了现代，xenophobia 成为社会学术语，指对外国人或外来文化的恐惧与仇视。',
                related_words: JSON.stringify(['xenon', 'xenophile', 'phobia', 'claustrophobia', 'agoraphobia']),
                word_cloud: JSON.stringify(['排外', '仇外', '恐惧', '偏见', '歧视', '本土化', '排斥', '不信任', '民族主义', '隔阂'])
            },
            {
                word: 'kaleidoscope',
                language_origin: 'Greek',
                root_meaning: '由 kalos（美丽）+ eidos（形式）+ scope（看）组成',
                components: JSON.stringify([
                    { part: 'kaleido-', meaning: '美丽的，美好的', origin: 'Greek' },
                    { part: 'scope-', meaning: '看，观察，审视', origin: 'Greek' }
                ]),
                explanation: 'kaleidoscope 是19世纪发明的新词，完全由希腊语词根构成：kalos（美丽）+ eidos（形状）+ scopein（看），字面意思是「观看美丽形状的仪器」。1817年苏格兰物理学家大卫·布鲁斯特发明了万花筒后，用这个词命名。后来它也被用来比喻任何变化多端、绚丽多彩的景象。',
                related_words: JSON.stringify(['kaleidoscopic', 'microscope', 'telescope', 'stethoscope', 'calligraphy']),
                word_cloud: JSON.stringify(['万花筒', '变幻', '多彩', '绚丽', '千变万化', '斑斓', '缤纷', '眼花缭乱', '五光十色', '气象万千'])
            },
            {
                word: 'vacillate',
                language_origin: 'Latin',
                root_meaning: '来自拉丁语 vacillare（摇摆、晃动）',
                components: JSON.stringify([
                    { part: 'vacill-', meaning: '摇摆，晃动，不稳定', origin: 'Latin' },
                    { part: '-ate', meaning: '动词后缀', origin: 'Latin' }
                ]),
                explanation: 'vacillate 源自拉丁语 vacillare，原意是「像风中的芦苇一样摇摆」。古罗马诗人用它来形容麦穗在风中摇曳的样子。进入英语后，这个词更多地用于比喻义，描述人在选择面前犹豫不决、立场摇摆不定的状态，暗示缺乏决断力。',
                related_words: JSON.stringify(['vacillation', 'vacillating', 'waver', 'oscillate', 'fluctuate']),
                word_cloud: JSON.stringify(['犹豫', '摇摆', '迟疑', '纠结', '举棋不定', '优柔寡断', '徘徊', '动摇', '踌躇', '瞻前顾后'])
            },
            {
                word: 'juxtapose',
                language_origin: 'Latin',
                root_meaning: '由 juxta（靠近）+ ponere（放置）组成',
                components: JSON.stringify([
                    { part: 'juxta-', meaning: '靠近，接近，邻近', origin: 'Latin' },
                    { part: 'pos-', meaning: '放置，安置', origin: 'Latin' },
                    { part: '-e', meaning: '动词后缀', origin: 'Latin' }
                ]),
                explanation: 'juxtapose 源自拉丁语 juxta（近旁）和 ponere（放置）的组合，字面意思是「并排放置」。这个词在艺术、摄影和文学中很常见，指将两个截然不同的事物并置以形成对比或产生新的含义。例如超现实主义画家常将不相干的事物 juxtapose 来创造梦幻感。',
                related_words: JSON.stringify(['juxtaposition', 'position', 'compose', 'oppose', 'propose']),
                word_cloud: JSON.stringify(['并置', '并列', '对比', '对照', '反差', '衬托', '联想', '关联', '对照', '相映成趣'])
            },
            {
                word: 'taciturn',
                language_origin: 'Latin',
                root_meaning: '来自拉丁语 tacitus（沉默的）',
                components: JSON.stringify([
                    { part: 'tacit-', meaning: '沉默，安静，不言', origin: 'Latin' },
                    { part: '-urn', meaning: '形容词后缀，表示「倾向于...的」', origin: 'Latin' }
                ]),
                explanation: 'taciturn 源自拉丁语 tacitus，原意是「保持沉默的」。古罗马历史学家塔西佗（Tacitus）名字就与此词根相关，他以含蓄深刻的文风著称。英语中 tacit（心照不宣的）和 taciturn 是同源词，都与「不说话」有关，但 taciturn 更强调性格上的沉默寡言。',
                related_words: JSON.stringify(['tacit', 'taciturnity', 'reticent', 'silent', 'reserved']),
                word_cloud: JSON.stringify(['沉默', '寡言', '内敛', '深沉', '话少', '矜持', '缄默', '木讷', '不善言辞', '惜字如金'])
            },
            {
                word: 'cacophony',
                language_origin: 'Greek',
                root_meaning: '由 kakos（坏的）+ phone（声音）组成',
                components: JSON.stringify([
                    { part: 'caco-', meaning: '坏，恶劣，错误', origin: 'Greek' },
                    { part: 'phon-', meaning: '声音，语音', origin: 'Greek' },
                    { part: '-y', meaning: '名词后缀，表示「状态、性质」', origin: 'Greek' }
                ]),
                explanation: 'cacophony 源自希腊语 kakophonia，字面意思是「坏的声音」。古希腊修辞学中，cacophony 指不悦耳的音韵组合，与 euphony（悦耳的声音）相对。现代英语中这个词可用于描述任何刺耳的噪音，也可比喻各种不和谐因素的混杂。',
                related_words: JSON.stringify(['cacophonous', 'symphony', 'microphone', 'phonetic', 'euphony']),
                word_cloud: JSON.stringify(['刺耳', '嘈杂', '噪音', '不和谐', '混乱', '喧闹', '聒噪', '杂乱', '七嘴八舌', '扰攘'])
            },
            {
                word: 'sagacious',
                language_origin: 'Latin',
                root_meaning: '来自拉丁语 sagax（有洞察力的）',
                components: JSON.stringify([
                    { part: 'sag-', meaning: '感知，知道，辨别', origin: 'Latin' },
                    { part: '-acious', meaning: '形容词后缀，表示「具有...特征的」', origin: 'Latin' }
                ]),
                explanation: 'sagacious 源自拉丁语 sagax，原意是「嗅觉敏锐的」，最初用来形容猎犬追踪猎物的能力。后来词义逐渐扩展，用来形容人的洞察力和判断力——能够像猎犬嗅到猎物一样，敏锐地察觉事物的本质和发展趋势，做出明智的决策。',
                related_words: JSON.stringify(['sagacity', 'sage', 'presage', 'discern', 'astute']),
                word_cloud: JSON.stringify(['睿智', '洞察力', '远见', '精明', '聪慧', '明察', '决断', '眼光', '深谋远虑', '慧眼'])
            },
            {
                word: 'nefarious',
                language_origin: 'Latin',
                root_meaning: '由 ne-（不）+ fas（权利、正义）组成',
                components: JSON.stringify([
                    { part: 'ne-', meaning: '不，否定，无', origin: 'Latin' },
                    { part: 'far-', meaning: '说，宣布，神谕', origin: 'Latin' },
                    { part: '-ious', meaning: '形容词后缀', origin: 'Latin' }
                ]),
                explanation: 'nefarious 源自拉丁语 nefarius，字面意思是「违反神意的」。罗马宗教中，fas 指神所允许的正义之事，nefas 则是神所禁止的邪恶行为。在古罗马，犯下 nefas 罪行的人会被视为全民公敌。现代英语中这个词形容极其邪恶、不法的行为。',
                related_words: JSON.stringify(['nefariousness', 'fate', 'fame', 'infamous', 'iniquitous']),
                word_cloud: JSON.stringify(['邪恶', '罪恶', '不法', '阴险', '狠毒', '卑劣', '邪恶', '黑心', '险恶', '伤天害理'])
            },
            {
                word: 'garrulous',
                language_origin: 'Latin',
                root_meaning: '来自拉丁语 garrire（唠叨、闲聊）',
                components: JSON.stringify([
                    { part: 'garr-', meaning: '唠叨，喋喋不休', origin: 'Latin' },
                    { part: '-ulous', meaning: '形容词后缀，表示「倾向于...的」', origin: 'Latin' }
                ]),
                explanation: 'garrulous 源自拉丁语 garrulus，原意是「叽叽喳喳的」，古罗马作家用它来形容麻雀等鸟类的叫声。后来这个词被用来比喻那些喋喋不休、爱说琐事的人，通常带有轻微的贬义，暗示说话冗长乏味，让人不耐烦。',
                related_words: JSON.stringify(['garrulity', 'garrulousness', 'loquacious', 'talkative', 'verbose']),
                word_cloud: JSON.stringify(['唠叨', '啰嗦', '喋喋不休', '话痨', '健谈', '碎碎念', '多嘴', '贫嘴', '长舌', '口若悬河'])
            },
            {
                word: 'obfuscate',
                language_origin: 'Latin',
                root_meaning: '由 ob-（在上）+ fuscus（黑暗）组成',
                components: JSON.stringify([
                    { part: 'ob-', meaning: '在上，覆盖，反对', origin: 'Latin' },
                    { part: 'fusc-', meaning: '黑暗，深色，模糊', origin: 'Latin' },
                    { part: '-ate', meaning: '动词后缀', origin: 'Latin' }
                ]),
                explanation: 'obfuscate 源自拉丁语 obfuscare，字面意思是「用黑暗覆盖」。想象有人故意在你眼前蒙上一层黑布，让你看不清真相——这就是 obfuscate 的核心含义。在法律、政治和技术领域，这个词常用来形容故意混淆视听、模糊问题本质的行为。',
                related_words: JSON.stringify(['obfuscation', 'fuscous', 'obscure', 'confuse', 'muddle']),
                word_cloud: JSON.stringify(['混淆', '模糊', '迷惑', '扰乱', '遮瞒', '故弄玄虚', '打太极', '含糊其辞', '云山雾罩', '颠三倒四'])
            },
            {
                word: 'iconoclast',
                language_origin: 'Greek',
                root_meaning: '由 eikon（偶像）+ klastes（打破者）组成',
                components: JSON.stringify([
                    { part: 'icono-', meaning: '偶像，形象，图像', origin: 'Greek' },
                    { part: 'clast-', meaning: '打破，碎裂', origin: 'Greek' }
                ]),
                explanation: 'iconoclast 源自希腊语，原意是「破坏偶像的人」。历史上的「偶像破坏运动」（Iconoclasm）指8-9世纪拜占庭帝国反对宗教偶像崇拜的运动。到了现代，这个词的含义扩展为指一切敢于打破传统、挑战既定观念和制度的人，带有「思想先锋」的意味。',
                related_words: JSON.stringify(['icon', 'iconoclasm', 'iconoclastic', 'blast', 'clastic']),
                word_cloud: JSON.stringify(['反传统', '先锋', '革新', '叛逆', '破陈规', '挑战者', '开拓者', '颠覆者', '敢为人先', '标新立异'])
            },
            {
                word: 'palimpsest',
                language_origin: 'Greek',
                root_meaning: '由 palin（再次）+ psestos（擦干净）组成',
                components: JSON.stringify([
                    { part: 'palimps-', meaning: '再次摩擦，再次擦', origin: 'Greek' },
                    { part: '-est', meaning: '名词后缀', origin: 'Greek' }
                ]),
                explanation: 'palimpsest 源自希腊语 palimpsestos，字面意思是「被再次擦干净的」。在纸张昂贵的古代，人们会将羊皮纸上的旧字迹刮去，重新书写新内容，但旧字迹往往隐约可见。现代这个词被广泛用于比喻，形容任何多层次的事物——一座城市可以是历史的 palimpsest，一本书可以是多重含义的 palimpsest。',
                related_words: JSON.stringify(['palimpsestic', 'erase', 'delete', 'overlay', 'manuscript']),
                word_cloud: JSON.stringify(['层次', '叠加', '重写', '痕迹', '记忆', '历史层积', '叠印', '层次感', '积淀', '多重意义'])
            },
            {
                word: 'sesquipedalian',
                language_origin: 'Latin',
                root_meaning: '由 sesqui（一个半）+ pes（脚）组成',
                components: JSON.stringify([
                    { part: 'sesqui-', meaning: '一个半，一又二分之一', origin: 'Latin' },
                    { part: 'ped-', meaning: '脚，英尺', origin: 'Latin' },
                    { part: '-alian', meaning: '形容词后缀，表示「与...相关的」', origin: 'Latin' }
                ]),
                explanation: 'sesquipedalian 源自拉丁语 sesquipedalis，字面意思是「一英尺半长的」。古罗马诗人贺拉斯在《诗艺》中用 sesquipedalia verba（「一英尺半的词」）来讽刺那些喜欢用冗长词汇的作家。这个词本身就长达13个字母，堪称「自我指涉」的绝佳例子——它描述的正是它自己。',
                related_words: JSON.stringify(['sesquicentennial', 'pedal', 'pedestrian', 'expedite', 'impede']),
                word_cloud: JSON.stringify(['冗长', '晦涩', '长词', '卖弄', '学究气', '咬文嚼字', '连篇累牍', '拐弯抹角', '繁文缛节', '诘屈聱牙'])
            },
            {
                word: 'defenestration',
                language_origin: 'Latin',
                root_meaning: '由 de-（向下）+ fenestra（窗户）组成',
                components: JSON.stringify([
                    { part: 'de-', meaning: '向下，从...离开', origin: 'Latin' },
                    { part: 'fenestr-', meaning: '窗户，窗口', origin: 'Latin' },
                    { part: '-ation', meaning: '名词后缀，表示「行为、过程」', origin: 'Latin' }
                ]),
                explanation: 'defenestration 源自拉丁语 de（出）+ fenestra（窗），字面意思是「扔出窗外」。历史上著名的「布拉格扔出窗外事件」（1618年）是三十年战争的导火索，当时新教徒将三名天主教官员从城堡窗户扔出。如今这个词既可以作字面理解，也可比喻「突然解职」。',
                related_words: JSON.stringify(['defenestrate', 'fenestration', 'window', 'eject', 'expel']),
                word_cloud: JSON.stringify(['扔出窗外', '驱逐', '罢黜', '革职', '驱逐出境', '扫地出门', '赶走', '下台', '罢免', '轰走'])
            },
            {
                word: 'absolute',
                language_origin: 'Latin',
                root_meaning: '由 ab-（离开）+ solutus（松开的）组成',
                components: JSON.stringify([
                    { part: 'ab-', meaning: '离开，远离，从...分离', origin: 'Latin' },
                    { part: 'solut-', meaning: '松开，解开，释放', origin: 'Latin' },
                    { part: '-e', meaning: '形容词后缀', origin: 'Latin' }
                ]),
                explanation: 'absolute 源自拉丁语 absolutus，字面意思是「被完全释放的」，即「不受任何限制的」。在哲学中，absolute 指绝对存在，不依赖任何其他事物而存在。在政治上，absolute monarchy 指君主拥有不受限制的绝对权力。日常用语中它表示「完全的、绝对的」。',
                related_words: JSON.stringify(['absolve', 'solvent', 'dissolve', 'resolve', 'solution']),
                word_cloud: JSON.stringify(['绝对', '完全', '纯粹', '彻底', '无条件', '不受限制', '至高无上', '十足', '彻头彻尾', '毋庸置疑'])
            },
            {
                word: 'academic',
                language_origin: 'Greek',
                root_meaning: '来自 Akademeia（柏拉图学院）',
                components: JSON.stringify([
                    { part: 'academ-', meaning: '学术，学院，柏拉图学园', origin: 'Greek' },
                    { part: '-ic', meaning: '形容词后缀，表示「与...相关的」', origin: 'Greek' }
                ]),
                explanation: 'academic 源自希腊语 Akademeia，这是雅典郊外的一片橄榄林，也是柏拉图讲学的地方。相传这片树林是为纪念传说中的英雄 Akademos 而命名。从此，academy 和 academic 就与高等教育和学术研究结下了不解之缘，泛指一切学术性的活动和机构。',
                related_words: JSON.stringify(['academy', 'academia', 'academician', 'school', 'scholar']),
                word_cloud: JSON.stringify(['学术', '学院', '理论', '研究', '学者', '高等教育', '象牙塔', '科研', '学界', '学究'])
            },
            {
                word: 'accept',
                language_origin: 'Latin',
                root_meaning: '由 ad-（向）+ capere（拿）组成',
                components: JSON.stringify([
                    { part: 'ac-', meaning: '向，朝，趋近', origin: 'Latin' },
                    { part: 'cept-', meaning: '拿，取，抓', origin: 'Latin' }
                ]),
                explanation: 'accept 源自拉丁语 acceptare，字面意思是「朝向...拿取」，即主动伸手去接。当你 accept 某样东西时，你不仅是被动地收到，更是主动地接纳它。这个词既可以指接受具体的物品，也可以指接受抽象的观念、建议或某种处境。',
                related_words: JSON.stringify(['acceptance', 'capture', 'capable', 'receive', 'concept']),
                word_cloud: JSON.stringify(['接受', '接纳', '同意', '认可', '承受', '接纳', '甘愿', '承担', '收受', '信从'])
            },
            {
                word: 'achieve',
                language_origin: 'Latin',
                root_meaning: '由 ad-（到）+ caput（头）组成',
                components: JSON.stringify([
                    { part: 'ach-', meaning: '到，趋近', origin: 'Latin' },
                    { part: 'iev-', meaning: '头，顶端，终点', origin: 'Latin' }
                ]),
                explanation: 'achieve 源自拉丁语 ad caput，字面意思是「到达终点」或「斩首」（古代战争中砍下敌人头颅是重要功绩）。后来这个词的暴力色彩逐渐褪去，演变为「达到目标、取得成就」的意思。有趣的是，achieve 中的「头」与 achieve 现在关联的「出头、出人头地」含义仍有微妙联系。',
                related_words: JSON.stringify(['achievement', 'captain', 'capital', 'captain', 'chieftain']),
                word_cloud: JSON.stringify(['成就', '达成', '实现', '获得', '功绩', '成功', '建树', '业绩', '登顶', '创纪录'])
            },
        ];

        const etyStmt = db.prepare(`
            INSERT OR IGNORE INTO etymology_entries 
            (word_id, word, language_origin, root_meaning, components, explanation, related_words, word_cloud, difficulty_level)
            VALUES (
                (SELECT id FROM words WHERE word = ?),
                ?, ?, ?, ?, ?, ?, ?,
                (SELECT difficulty_level FROM words WHERE word = ?)
            )
        `);
        etymologyList.forEach(e => {
            etyStmt.run(e.word, e.word, e.language_origin, e.root_meaning, e.components, e.explanation, e.related_words, e.word_cloud, e.word);
        });
        etyStmt.finalize();
        console.log('Etymology entries data seeded successfully');

        // Update root example counts
        db.run(`
            UPDATE etymology_roots SET example_count = (
                SELECT COUNT(*) FROM etymology_entries ee
                WHERE ee.components LIKE '%' || etymology_roots.root || '%'
            )
        `, (err) => {
            if (err) console.error('Error updating root example counts:', err);
            else console.log('Root example counts updated successfully');
        });
    }, 1000);
});

module.exports = db;
