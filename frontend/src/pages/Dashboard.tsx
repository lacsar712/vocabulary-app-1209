import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWordList } from '../context/WordListContext';
import api from '../api';
import type { NewAchievement } from '../api';
import { CheckCircle, BarChart2, Book, Volume2, LogOut, RefreshCw, Calendar, Trophy, Award, ListTodo, X, Play, Sparkles, Mic, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import LearningCalendar from '../components/LearningCalendar';
import AchievementPopup from '../components/AchievementPopup';
import DailyChallengeCard from '../components/DailyChallengeCard';

interface RecommendedWord {
    id: number;
    word: string;
    pronunciation: string;
    pos: string;
    definition: string;
    example: string;
    rank?: number;
    frequency?: number;
    difficulty_level?: number;
    message?: string;
    empty_list?: boolean;
    list_completed?: boolean;
}

interface LatestAchievement {
    achievement_id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    unlocked_at: string;
}

const Dashboard: React.FC = () => {
    const { user, logout, refreshUser } = useAuth();
    const { activeList, clearActiveList, refreshActiveList } = useWordList();
    const [word, setWord] = useState<RecommendedWord | null>(null);
    const [stats, setStats] = useState<any>([]);
    const [loading, setLoading] = useState(true);
    const [showReview, setShowReview] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [latestAchievement, setLatestAchievement] = useState<LatestAchievement | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [newAchievements, setNewAchievements] = useState<NewAchievement[]>([]);
    const [showListComplete, setShowListComplete] = useState(false);
    const navigate = useNavigate();

    const fetchRecommendation = async () => {
        try {
            const params: any = {};
            if (activeList) {
                params.word_list_id = activeList.id;
            }
            const res = await api.get('/recommend', { params });
            setWord(res.data);

            if (res.data.list_completed && activeList) {
                setShowListComplete(true);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await api.get('/stats');
            const history = res.data.history;
            setStats({
                chartData: history.map((_: any, i: number) => ({ name: `Day ${i + 1}`, words: i + 1 })),
                history: history
            });
        } catch (e) { console.error(e); }
    };

    const fetchLatestAchievement = async () => {
        try {
            const res = await api.get('/achievements/latest');
            setLatestAchievement(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchUnreadCount = async () => {
        try {
            const res = await api.get('/achievements/unread-count');
            setUnreadCount(res.data.unread_count);
        } catch (e) { console.error(e); }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const refreshData = () => {
        setLoading(true);
        Promise.all([
            fetchRecommendation(),
            fetchStats(),
            fetchLatestAchievement(),
            fetchUnreadCount(),
            refreshUser(),
            activeList ? refreshActiveList() : Promise.resolve()
        ]).then(() => setLoading(false));
    };

    useEffect(() => {
        refreshData();
    }, [activeList?.id]);

    const handleLearn = async () => {
        if (!word || 'message' in word) return;
        try {
            const res = await api.post('/learn/record', { word_id: word.id, status: 'learned' });
            if (res.data.new_achievements && res.data.new_achievements.length > 0) {
                setNewAchievements(res.data.new_achievements);
            }
            if (activeList) {
                await refreshActiveList();
            }
            await fetchRecommendation();
            await fetchStats();
            await fetchLatestAchievement();
            await fetchUnreadCount();
        } catch (e) { console.error(e); }
    };

    const handleSkip = async () => {
        if (!word || 'message' in word) return;
        try {
            await api.post('/learn/record', { word_id: word.id, status: 'skipped' });
            await fetchRecommendation();
        } catch (e) { console.error(e); }
    };

    const handleExitListComplete = () => {
        setShowListComplete(false);
        clearActiveList();
        setWord(null);
        fetchRecommendation();
    };

    const playAudio = (text?: string) => {
        const utter = new SpeechSynthesisUtterance(text || word?.word || '');
        window.speechSynthesis.speak(utter);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
        });
    };

    const getListProgress = () => {
        if (!activeList || activeList.word_count === 0) return 0;
        return Math.round((activeList.learned_count / activeList.word_count) * 100);
    };

    if (loading) return <div className="p-8 text-center text-white">加载主页中...</div>;

    return (
        <div className="min-h-screen bg-slate-900 p-4 md:p-8">
            {activeList && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-primary via-secondary to-accent"
                >
                    <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                <Play size={18} className="text-white" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-white/80 text-xs">词单学习模式</span>
                                    {activeList.word_count > 0 && (
                                        <span className="text-white/80 text-xs">· {getListProgress()}% 进度</span>
                                    )}
                                </div>
                                <div className="text-white font-bold truncate">{activeList.name}</div>
                            </div>
                            {activeList.word_count > 0 && (
                                <div className="hidden sm:block w-32 h-2 rounded-full bg-white/20 ml-4">
                                    <div
                                        className="h-full rounded-full bg-white transition-all duration-500"
                                        style={{ width: `${getListProgress()}%` }}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => navigate(`/word-lists/${activeList.id}`)}
                                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition"
                            >
                                查看词单
                            </button>
                            <button
                                onClick={clearActiveList}
                                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium flex items-center gap-1 transition"
                                title="退出词单模式"
                            >
                                <X size={16} />
                                <span className="hidden sm:inline">退出</span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            <div className={activeList ? 'pt-16' : ''}>
                <header className="flex justify-between items-center mb-8 max-w-6xl mx-auto">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                            你好, {user?.username}
                        </h1>
                        <p className="text-slate-400">当前词汇量: <span className="text-white font-bold">{user?.vocab_size}</span> 词</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/word-lists')}
                            className="p-2 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
                            title="我的词单"
                        >
                            <ListTodo size={20} className="text-secondary" />
                        </button>
                        <button
                            onClick={() => navigate('/achievements')}
                            className="relative p-2 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
                            title="成就徽章"
                        >
                            <Trophy size={20} className="text-amber-400" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                        <button onClick={refreshData} title="刷新数据" className="p-2 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 transition cursor-pointer">
                            <RefreshCw size={20} className="text-primary" />
                        </button>
                        <button onClick={handleLogout} title="退出登录" className="p-2 rounded-full bg-slate-800 border border-slate-700 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500 transition cursor-pointer">
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>

                {latestAchievement && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => navigate('/achievements')}
                        className="max-w-6xl mx-auto mb-6 cursor-pointer"
                    >
                        <div className="glass-panel p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-purple-500/10 border border-amber-500/20 hover:border-amber-500/40 transition">
                            <div className="flex items-center gap-4">
                                <div className="text-4xl">{latestAchievement.icon}</div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <Trophy size={16} className="text-amber-400" />
                                        <span className="text-amber-400 text-sm font-medium">最近获得的成就</span>
                                    </div>
                                    <h3 className="text-white font-bold text-lg">{latestAchievement.name}</h3>
                                    <p className="text-slate-400 text-sm">{latestAchievement.description}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-500 text-xs">
                                        {formatDate(latestAchievement.unlocked_at)}
                                    </p>
                                    <Award size={20} className="text-amber-400 ml-auto mt-1" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        {word && !('message' in word) ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass-panel p-8 md:p-12 rounded-3xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 bg-white/5 rounded-bl-2xl backdrop-blur-md">
                                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                        {activeList ? '词单推荐' : '每日推荐'}
                                    </span>
                                    {word.frequency && (
                                        <div className="flex items-center gap-1 mt-1">
                                            <span className="text-xs text-slate-400">常用度:</span>
                                            <div className="flex gap-0.5">
                                                {[...Array(5)].map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`w-1.5 h-1.5 rounded-full ${
                                                            i < Math.ceil((word.frequency || 0) / 2)
                                                                ? 'bg-emerald-400'
                                                                : 'bg-slate-600'
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mb-8">
                                    <div className="flex items-baseline gap-4 mb-2">
                                        <h2 className="text-6xl font-bold text-white tracking-tight">{word.word}</h2>
                                        <span className="text-2xl text-slate-400 italic font-serif">{word.pos}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-primary cursor-pointer hover:text-indigo-400 transition" onClick={() => playAudio()}>
                                        <Volume2 size={24} />
                                        <span className="text-lg font-mono">{word.pronunciation}</span>
                                    </div>
                                </div>

                                <div className="space-y-8 mb-12">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">释义</h3>
                                        <p className="text-2xl text-slate-200 font-light leading-relaxed">{word.definition}</p>
                                    </div>

                                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">例句</h3>
                                        <p className="text-xl text-indigo-200 italic font-serif">"{word.example}"</p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button onClick={handleLearn} className="btn-primary flex-1 flex items-center justify-center gap-2 py-4 text-lg">
                                        <CheckCircle size={24} />
                                        标为已掌握
                                    </button>
                                    <button onClick={handleSkip} className="btn-secondary px-6" title="跳过">
                                        <Book size={24} />
                                    </button>
                                </div>
                            </motion.div>
                        ) : word?.empty_list ? (
                            <div className="glass-panel p-12 rounded-3xl text-center">
                                <ListTodo size={64} className="text-slate-500 mx-auto mb-4" />
                                <h2 className="text-3xl font-bold text-white mb-4">该词单暂无单词</h2>
                                <p className="text-slate-400 mb-6">请先前往词单详情页添加单词</p>
                                <div className="flex items-center justify-center gap-3">
                                    <button
                                        onClick={() => navigate(`/word-lists/${activeList?.id}`)}
                                        className="btn-primary inline-flex items-center gap-2"
                                    >
                                        去添加单词
                                    </button>
                                    <button
                                        onClick={clearActiveList}
                                        className="btn-secondary inline-flex items-center gap-2"
                                    >
                                        退出词单模式
                                    </button>
                                </div>
                            </div>
                        ) : word?.list_completed ? (
                            <div className="glass-panel p-12 rounded-3xl text-center bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30">
                                <Sparkles size={64} className="text-emerald-400 mx-auto mb-4" />
                                <h2 className="text-3xl font-bold text-white mb-4">🎊 词单学习完成！</h2>
                                <p className="text-slate-300 mb-6">
                                    恭喜您！已经掌握了词单「{activeList?.name}」中的所有单词！
                                </p>
                                <div className="flex items-center justify-center gap-3">
                                    <button
                                        onClick={() => navigate('/word-lists')}
                                        className="btn-primary inline-flex items-center gap-2"
                                    >
                                        浏览其他词单
                                    </button>
                                    <button
                                        onClick={clearActiveList}
                                        className="btn-secondary inline-flex items-center gap-2"
                                    >
                                        恢复默认推荐
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="glass-panel p-12 rounded-3xl text-center">
                                <h2 className="text-3xl font-bold text-white mb-4">全部完成！</h2>
                                <p className="text-slate-400">太棒了！您已经掌握了当前难度的所有单词。</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-8">
                        <DailyChallengeCard />

                        <div className="glass-panel p-6 rounded-2xl">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <BarChart2 size={20} className="text-secondary" />
                                学习进度
                            </h3>
                            <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={stats.chartData ? stats.chartData : [{ name: 'Start', words: 0 }]}>
                                        <XAxis dataKey="name" hide />
                                        <YAxis hide />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                        />
                                        <Line type="monotone" dataKey="words" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-between mt-4 text-sm text-slate-400">
                                <span>今日已学</span>
                                <span className="text-white font-bold">{stats.history ? stats.history.length : 0} 词</span>
                            </div>
                        </div>

                        <div className="glass-panel p-6 rounded-2xl bg-gradient-to-br from-indigo-900/20 to-purple-900/20">
                            <h3 className="text-lg font-bold text-white mb-4">快捷操作</h3>
                            <div className="space-y-3">
                                <button
                                    onClick={() => navigate('/daily-challenge')}
                                    className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-orange-500/20 to-red-500/20 hover:from-orange-500/30 hover:to-red-500/30 border border-orange-500/30 transition text-white flex items-center gap-3"
                                >
                                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                                    <Flame size={18} />
                                    今日挑战
                                </button>
                                <button
                                    onClick={() => navigate('/reading-practice')}
                                    className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30 border border-primary/30 transition text-white flex items-center gap-3"
                                >
                                    <span className="w-2 h-2 rounded-full bg-accent"></span>
                                    <Mic size={18} />
                                    跟读练习
                                </button>
                                <button
                                    onClick={() => navigate('/word-lists')}
                                    className="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition text-slate-300 hover:text-white flex items-center gap-3"
                                >
                                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                                    <ListTodo size={18} />
                                    我的词单
                                </button>
                                <button
                                    onClick={() => navigate('/achievements')}
                                    className="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition text-slate-300 hover:text-white flex items-center gap-3"
                                >
                                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                    <Trophy size={18} />
                                    成就徽章
                                    {unreadCount > 0 && (
                                        <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                                            {unreadCount} 新
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowCalendar(true)}
                                    className="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition text-slate-300 hover:text-white flex items-center gap-3"
                                >
                                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                                    <Calendar size={18} />
                                    学习日历
                                </button>
                                <button
                                    onClick={() => setShowReview(true)}
                                    className="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition text-slate-300 hover:text-white flex items-center gap-3"
                                >
                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                    复习已掌握单词
                                </button>
                                <button
                                    onClick={() => navigate('/test')}
                                    className="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition text-slate-300 hover:text-white flex items-center gap-3"
                                >
                                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                    重测词汇量
                                </button>
                            </div>
                        </div>
                    </div>

                    {showReview && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowReview(false)}>
                            <div className="glass-panel bg-slate-900 p-6 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold text-white">已掌握单词</h2>
                                    <button onClick={() => setShowReview(false)} className="text-slate-400 hover:text-white">✕</button>
                                </div>
                                <div className="space-y-4">
                                    {stats.history && stats.history.length > 0 ? (
                                        stats.history.map((h: any, i: number) => (
                                            <div key={i} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-white">{h.word}</h3>
                                                        <p className="text-primary text-sm">{h.pronunciation}</p>
                                                    </div>
                                                    <button onClick={() => playAudio(h.word)} className="text-slate-400 hover:text-primary"><Volume2 size={18} /></button>
                                                </div>
                                                <p className="text-slate-300 mt-2 text-sm">{h.definition}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center text-slate-500 py-8">暂无已学单词，快去学习吧！</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <AnimatePresence>
                        {showCalendar && (
                            <LearningCalendar onClose={() => setShowCalendar(false)} />
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <AchievementPopup
                achievements={newAchievements}
                onClose={() => setNewAchievements([])}
            />

            <AnimatePresence>
                {showListComplete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="glass-panel bg-slate-900 p-10 rounded-3xl w-full max-w-md text-center"
                        >
                            <motion.div
                                animate={{ rotate: [0, 10, -10, 0] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="text-7xl mb-4"
                            >
                                🎉
                            </motion.div>
                            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400 mb-3">
                                词单学习完成！
                            </h2>
                            <p className="text-slate-300 mb-2">
                                恭喜您掌握了词单
                            </p>
                            <p className="text-xl font-bold text-white mb-6">
                                「{activeList?.name}」
                            </p>
                            <p className="text-slate-400 text-sm mb-8">
                                共 {activeList?.word_count} 个单词，全部已掌握！
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={handleExitListComplete}
                                    className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-lg"
                                >
                                    <Sparkles size={20} />
                                    太棒了！
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Dashboard;
