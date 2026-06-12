import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import type { Word, WordList } from '../api';
import { useWordList } from '../context/WordListContext';
import ProgressRing from '../components/ProgressRing';
import {
    ChevronLeft, Play, Search, Plus, X, Trash2, Volume2,
    SortAsc, TrendingUp, Shuffle, CheckCircle2, BookOpen,
    Clock, Edit3, ArrowRight, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type SortMode = 'difficulty' | 'alpha';

const DIFFICULTY_LABELS: Record<number, string> = {
    1: '基础',
    2: '初级',
    3: '中级',
    4: '中高级',
    5: '高级',
    6: '专业'
};

const DIFFICULTY_COLORS: Record<number, string> = {
    1: 'bg-emerald-500/20 text-emerald-400',
    2: 'bg-teal-500/20 text-teal-400',
    3: 'bg-blue-500/20 text-blue-400',
    4: 'bg-purple-500/20 text-purple-400',
    5: 'bg-pink-500/20 text-pink-400',
    6: 'bg-red-500/20 text-red-400'
};

const WordListDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { activeList, setActiveList, refreshActiveList } = useWordList();

    const [list, setList] = useState<WordList | null>(null);
    const [words, setWords] = useState<Word[]>([]);
    const [sortMode, setSortMode] = useState<SortMode>('difficulty');
    const [loading, setLoading] = useState(true);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Word[]>([]);
    const [searching, setSearching] = useState(false);
    const [showQuiz, setShowQuiz] = useState(false);
    const [quizWords, setQuizWords] = useState<Word[]>([]);
    const [quizIndex, setQuizIndex] = useState(0);
    const [showDefinition, setShowDefinition] = useState(false);
    const [quizResults, setQuizResults] = useState<{ word: Word; correct: boolean }[]>([]);

    const fetchList = useCallback(async () => {
        if (!id) return;
        try {
            const [listRes, wordsRes] = await Promise.all([
                api.get(`/word-lists/${id}`),
                api.get(`/word-lists/${id}/words?sort=${sortMode}`)
            ]);
            setList(listRes.data);
            setWords(wordsRes.data);
        } catch (e: any) {
            if (e.response?.status === 404) {
                navigate('/word-lists');
            }
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [id, sortMode, navigate]);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    const handleSearch = useCallback(async () => {
        if (!id || !searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await api.get('/words/search', {
                params: { q: searchQuery, exclude_list_id: id, limit: 20 }
            });
            setSearchResults(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setSearching(false);
        }
    }, [id, searchQuery]);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleSearch();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, handleSearch]);

    const addWord = async (word: Word) => {
        if (!id) return;
        try {
            await api.post(`/word-lists/${id}/words/${word.id}`);
            setSearchResults(prev => prev.filter(w => w.id !== word.id));
            fetchList();
            refreshActiveList();
        } catch (e) {
            console.error(e);
        }
    };

    const removeWord = async (wordId: number) => {
        if (!id) return;
        try {
            await api.delete(`/word-lists/${id}/words/${wordId}`);
            fetchList();
            refreshActiveList();
        } catch (e) {
            console.error(e);
        }
    };

    const startLearning = () => {
        if (list) {
            setActiveList(list);
            navigate('/');
        }
    };

    const startQuiz = async () => {
        if (!id) return;
        try {
            const res = await api.get(`/word-lists/${id}/quiz`, {
                params: { limit: Math.min(10, words.length) }
            });
            setQuizWords(res.data);
            setQuizIndex(0);
            setShowDefinition(false);
            setQuizResults([]);
            setShowQuiz(true);
        } catch (e) {
            console.error(e);
        }
    };

    const answerQuiz = (correct: boolean) => {
        const currentWord = quizWords[quizIndex];
        setQuizResults(prev => [...prev, { word: currentWord, correct }]);

        if (quizIndex + 1 >= quizWords.length) {
            setShowQuiz(false);
        } else {
            setQuizIndex(prev => prev + 1);
            setShowDefinition(false);
        }
    };

    const playAudio = (text: string) => {
        const utter = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utter);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getProgress = () => {
        if (!list || list.word_count === 0) return 0;
        return Math.round((list.learned_count / list.word_count) * 100);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-primary text-xl font-bold animate-pulse">加载中...</div>
            </div>
        );
    }

    if (!list) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-slate-400">词单不存在</div>
            </div>
        );
    }

    const currentQuizWord = quizWords[quizIndex];
    const correctCount = quizResults.filter(r => r.correct).length;

    return (
        <div className="min-h-screen bg-slate-900 p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/word-lists')}
                        className="p-2 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
                    >
                        <ChevronLeft size={20} className="text-slate-300" />
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-3xl font-bold text-white">{list.name}</h1>
                            {activeList?.id === list.id && (
                                <span className="px-2 py-1 rounded-full bg-primary/30 text-primary text-xs font-medium">
                                    学习中
                                </span>
                            )}
                        </div>
                        {list.description && (
                            <p className="text-slate-400">{list.description}</p>
                        )}
                    </div>
                </div>

                <div className="glass-panel rounded-2xl p-6 mb-6">
                    <div className="flex flex-wrap items-center gap-6">
                        <ProgressRing progress={getProgress()} size={72} strokeWidth={6} />
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-slate-400 text-sm">单词总数</p>
                                <p className="text-2xl font-bold text-white flex items-center gap-2">
                                    <BookOpen size={20} className="text-secondary" />
                                    {list.word_count}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-sm">已掌握</p>
                                <p className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
                                    <CheckCircle2 size={20} />
                                    {list.learned_count}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-sm">待学习</p>
                                <p className="text-2xl font-bold text-primary flex items-center gap-2">
                                    <TrendingUp size={20} />
                                    {Math.max(0, list.word_count - list.learned_count)}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-sm">创建时间</p>
                                <p className="text-sm text-slate-300 flex items-center gap-2 pt-1">
                                    <Clock size={16} />
                                    {formatDate(list.created_at)}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <button
                                onClick={startLearning}
                                disabled={list.word_count === 0}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition ${
                                    list.word_count === 0
                                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        : activeList?.id === list.id
                                            ? 'bg-primary/30 text-primary'
                                            : 'btn-primary'
                                }`}
                            >
                                <Play size={20} />
                                {activeList?.id === list.id ? '当前学习中' : '学习该词单'}
                            </button>
                            <button
                                onClick={startQuiz}
                                disabled={words.length < 3}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition ${
                                    words.length < 3
                                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        : 'btn-secondary'
                                }`}
                                title={words.length < 3 ? '需要至少3个单词才能开始测验' : ''}
                            >
                                <Shuffle size={20} />
                                随机抽查
                            </button>
                        </div>
                    </div>
                </div>

                <div className="glass-panel rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-4">
                        <h2 className="text-lg font-bold text-white">词单内容</h2>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center rounded-lg bg-slate-800 p-1">
                                <button
                                    onClick={() => setSortMode('difficulty')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition ${
                                        sortMode === 'difficulty'
                                            ? 'bg-slate-700 text-white'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <TrendingUp size={14} />
                                    难度
                                </button>
                                <button
                                    onClick={() => setSortMode('alpha')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition ${
                                        sortMode === 'alpha'
                                            ? 'bg-slate-700 text-white'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <SortAsc size={14} />
                                    字母
                                </button>
                            </div>
                            <button
                                onClick={() => setShowSearch(!showSearch)}
                                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition ${
                                    showSearch
                                        ? 'bg-primary text-white'
                                        : 'btn-secondary'
                                }`}
                            >
                                <Plus size={18} />
                                添加单词
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {showSearch && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-b border-slate-700/50 overflow-hidden"
                            >
                                <div className="p-4">
                                    <div className="relative mb-4">
                                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="搜索单词或释义..."
                                            className="input-field pl-10"
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto space-y-2">
                                        {searching ? (
                                            <p className="text-center text-slate-500 py-4">搜索中...</p>
                                        ) : searchResults.length === 0 ? (
                                            <p className="text-center text-slate-500 py-4">
                                                {searchQuery.trim() ? '未找到匹配的单词' : '输入关键词搜索单词'}
                                            </p>
                                        ) : (
                                            searchResults.map((word) => (
                                                <motion.div
                                                    key={word.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition"
                                                >
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div>
                                                            <h4 className="font-bold text-white">{word.word}</h4>
                                                            <p className="text-sm text-slate-400 truncate">{word.definition}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium mr-2 ${DIFFICULTY_COLORS[word.difficulty_level] || DIFFICULTY_COLORS[3]}`}>
                                                        {DIFFICULTY_LABELS[word.difficulty_level] || '中级'}
                                                    </span>
                                                    <button
                                                        onClick={() => addWord(word)}
                                                        className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition"
                                                    >
                                                        <Plus size={18} />
                                                    </button>
                                                </motion.div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="p-4">
                        {words.length === 0 ? (
                            <div className="text-center py-12">
                                <BookOpen size={48} className="text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400 mb-4">这个词单还是空的</p>
                                <button
                                    onClick={() => setShowSearch(true)}
                                    className="btn-primary inline-flex items-center gap-2"
                                >
                                    <Plus size={18} />
                                    添加单词
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {words.map((word) => (
                                    <motion.div
                                        key={word.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`p-4 rounded-xl border transition ${
                                            word.learn_status === 'learned'
                                                ? 'bg-emerald-500/5 border-emerald-500/20'
                                                : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                    <h3 className="text-xl font-bold text-white">{word.word}</h3>
                                                    <button
                                                        onClick={() => playAudio(word.word)}
                                                        className="p-1 rounded text-primary hover:text-indigo-400 transition"
                                                    >
                                                        <Volume2 size={18} />
                                                    </button>
                                                    <span className="text-sm text-slate-400 font-mono">{word.pronunciation}</span>
                                                    <span className="text-sm text-slate-500 italic">{word.pos}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DIFFICULTY_COLORS[word.difficulty_level] || DIFFICULTY_COLORS[3]}`}>
                                                        {DIFFICULTY_LABELS[word.difficulty_level] || '中级'}
                                                    </span>
                                                    {word.learn_status === 'learned' && (
                                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                                                            <CheckCircle2 size={12} />
                                                            已掌握
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-slate-200 mb-2">{word.definition}</p>
                                                <p className="text-sm text-slate-400 italic">"{word.example}"</p>
                                            </div>
                                            <button
                                                onClick={() => removeWord(word.id)}
                                                className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                                                title="从词单移除"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showQuiz && currentQuizWord && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="glass-panel bg-slate-900 rounded-3xl w-full max-w-xl overflow-hidden"
                        >
                            <div className="h-2 bg-slate-800">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                                    style={{ width: `${((quizIndex + 1) / quizWords.length) * 100}%` }}
                                />
                            </div>
                            <div className="p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <span className="text-slate-400 font-medium">
                                        第 {quizIndex + 1} / {quizWords.length} 题
                                    </span>
                                    <button
                                        onClick={() => setShowQuiz(false)}
                                        className="text-slate-400 hover:text-white transition"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="text-center mb-10">
                                    <h2 className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
                                        {currentQuizWord.word}
                                    </h2>
                                    <div className="flex items-center justify-center gap-2 text-primary">
                                        <button onClick={() => playAudio(currentQuizWord.word)}>
                                            <Volume2 size={22} />
                                        </button>
                                        <span className="text-lg font-mono">{currentQuizWord.pronunciation}</span>
                                    </div>
                                </div>

                                {!showDefinition ? (
                                    <div>
                                        <p className="text-center text-slate-300 mb-6">您认识这个单词吗？</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => setShowDefinition(true)}
                                                className="btn-secondary flex flex-col items-center py-6 hover:bg-emerald-500/10 hover:border-emerald-500 hover:text-emerald-400"
                                            >
                                                <HelpCircle size={32} className="mb-2" />
                                                有点印象
                                            </button>
                                            <button
                                                onClick={() => answerQuiz(false)}
                                                className="btn-secondary flex flex-col items-center py-6 hover:bg-red-500/10 hover:border-red-500 hover:text-red-400"
                                            >
                                                <X size={32} className="mb-2" />
                                                不认识
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 mb-6">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-slate-500 italic">{currentQuizWord.pos}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DIFFICULTY_COLORS[currentQuizWord.difficulty_level]}`}>
                                                    {DIFFICULTY_LABELS[currentQuizWord.difficulty_level]}
                                                </span>
                                            </div>
                                            <p className="text-xl text-white mb-3">{currentQuizWord.definition}</p>
                                            <p className="text-sm text-slate-400 italic">"{currentQuizWord.example}"</p>
                                        </div>
                                        <p className="text-center text-slate-300 mb-4">您想对了吗？</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => answerQuiz(false)}
                                                className="btn-secondary bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20"
                                            >
                                                想错了
                                            </button>
                                            <button
                                                onClick={() => answerQuiz(true)}
                                                className="btn-primary bg-emerald-600 hover:bg-emerald-500"
                                            >
                                                对了
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {!showQuiz && quizResults.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                        onClick={() => setQuizResults([])}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="glass-panel bg-slate-900 p-8 rounded-3xl w-full max-w-md text-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-6xl mb-4">
                                {correctCount >= quizResults.length * 0.7 ? '🎉' : correctCount >= quizResults.length * 0.5 ? '👍' : '💪'}
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-2">测验完成！</h2>
                            <p className="text-slate-400 mb-6">
                                {correctCount >= quizResults.length * 0.7
                                    ? '太棒了！继续保持！'
                                    : correctCount >= quizResults.length * 0.5
                                        ? '不错，再接再厉！'
                                        : '多加练习，你会越来越好的！'}
                            </p>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-800/50 p-4 rounded-xl">
                                    <p className="text-slate-400 text-sm">正确率</p>
                                    <p className="text-3xl font-bold text-emerald-400">
                                        {Math.round((correctCount / quizResults.length) * 100)}%
                                    </p>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-xl">
                                    <p className="text-slate-400 text-sm">答对题数</p>
                                    <p className="text-3xl font-bold text-primary">
                                        {correctCount}/{quizResults.length}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2 mb-6 max-h-48 overflow-y-auto text-left">
                                {quizResults.map((r, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-between p-2 rounded-lg ${
                                            r.correct ? 'bg-emerald-500/10' : 'bg-red-500/10'
                                        }`}
                                    >
                                        <span className="text-white font-medium">{r.word.word}</span>
                                        <span className={r.correct ? 'text-emerald-400' : 'text-red-400'}>
                                            {r.correct ? '✓' : '✗'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => setQuizResults([])}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                完成 <ArrowRight size={20} />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default WordListDetailPage;
