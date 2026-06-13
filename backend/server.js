const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const testRoutes = require('./routes/test');
const learnRoutes = require('./routes/learn');
const achievementRoutes = require('./routes/achievements');
const wordListRoutes = require('./routes/wordLists');
const wordRoutes = require('./routes/words');
const readingRoutes = require('./routes/reading');
const dailyChallengeRoutes = require('./routes/dailyChallenge');
const etymologyRoutes = require('./routes/etymology');
const crosswordRoutes = require('./routes/crossword');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use('/api', authRoutes);
app.use('/api/test', testRoutes);
app.use('/api', learnRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/word-lists', wordListRoutes);
app.use('/api/words', wordRoutes);
app.use('/api/reading', readingRoutes);
app.use('/api/daily-challenge', dailyChallengeRoutes);
app.use('/api/etymology', etymologyRoutes);
app.use('/api/crossword', crosswordRoutes);
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

setInterval(() => {}, 1 << 30);
