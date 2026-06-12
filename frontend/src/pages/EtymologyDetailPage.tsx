import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { etymologyApi, type EtymologyEntry, type EtymologyWordCheckResponse } from '../api';
import {
    ArrowLeft, Volume2, Heart, Globe, BookOpen, Lightbulb,
    GitBranch, Cloud, ChevronLeft, ChevronRight, Search,
    RefreshCw, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

const WORD_CLOUD_COLORS = [
    'text-primary',
    'text-secondary',
    'text-accent',
    'text-emerald-400',
    'text-amber-400',
    'text-pink-400',
    'text-cyan-400',
    'text-orange-400'
];

const WORD_CLOUD_SIZES = [
    'text-xs',
    'text-sm',
    'text-base',
    'text-lg',
    'text-xl',
    'text-2xl'
];

const EtymologyDetailPage: React.FC = () => {
    const { id, wordId } = useParams<{ id?: string; wordId?: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    const [entry, setEntry] = useState<EtymologyEntry | null>(null);
    const [checkResponse, setCheckResponse] = useState<EtymologyWordCheckResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFavorited, setIsFavorited] = useState(false);
    const [allEntries, setAllEntries] = useState<EtymologyEntry[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);

    const fromWordDetail = location.state?.fromWordDetail as boolean;
    const wordInfo = location.state?.wordInfo as { word?: string; difficulty_level?: number } | undefined;

    const fetchAllEntries = useCallback(async () => {
        try {
            const res = await etymologyApi.getEtymologyList({ limit: 100 });
            setAllEntries(res.data.data);
        } catch (e) {
            console.error('Failed to fetch all entries:', e);
        }
    }, []);

    const fetchEtymologyDetail = useCallback(async (entryId: number) => {
        try {
            setLoading(true);
            setError(null);
            const res = await etymologyApi.getEtymologyDetail(entryId);
            setEntry(res.data);
            setIsFavorited(!!res.data.is_favorited);
            setCheckResponse(null);
        } catch (e: any) {
            console.error('Failed to fetch etymology detail:', e);
            setError(e.response?.data?.error || '加载词源详情失败');
        } finally {
            setLoading(false);
        }
    }, []);

    const checkWordEtymology = useCallback(async (wId: number) => {
        try {
            setLoading(true);
            setError(null);
            const res = await etymologyApi.getEtymologyByWordId(wId);
            setCheckResponse(res.data);
            if (res.data.has_etymology && res.data.id) {
                fetchEtymologyDetail(res.data.id);
            } else {
                setEntry(null);
                setLoading(false);
            }
        } catch (e: any) {
            console.error('Failed to check word etymology:', e);
            setError(e.response?.data?.error || '检查词源信息失败');
            setLoading(false);
        }
    }, [fetchEtymologyDetail]);

    useEffect(() => {
        fetchAllEntries();
    }, [fetchAllEntries]);

    useEffect(() => {
        if (id) {
            fetchEtymologyDetail(parseInt(id));
        } else if (wordId) {
            checkWordEtymology(parseInt(wordId));
        }
    }, [id, wordId, fetchEtymologyDetail, checkWordEtymology]);

    useEffect(() => {
        if (entry && allEntries.length > 0) {
            const index = allEntries.findIndex(e => e.id === entry.id);
            setCurrentIndex(index);
        }
    }, [entry, allEntries]);

    const toggleFavorite = async () => {
        if (!entry) return;
        try {
            if (isFavorited) {
                await etymologyApi.removeFavorite(entry.id);
                setIsFavorited(false);
            } else {
                await etymologyApi.addFavorite(entry.id);
                setIsFavorited(true);
            }
        } catch (e) {
            console.error('Failed to toggle favorite:', e);
        }
    };

    const playAudio = (text?: string) => {
        const utter = new SpeechSynthesisUtterance(text || entry?.word || '');
        window.speechSynthesis.speak(utter);
    };

    const handleRelatedWordClick = (word: string) => {
        navigate('/etymology', { state: { searchQuery: word } });
    };

    const handleWordCloudClick = (word: string) => {
        navigate('/etymology', { state: { searchQuery: word } });
    };

    const navigateToPrev = () => {
        if (currentIndex > 0) {
            const prevEntry = allEntries[currentIndex - 1];
            navigate(`/etymology/${prevEntry.id}`);
        }
    };

    const navigateToNext = () => {
        if (currentIndex < allEntries.length - 1) {
            const nextEntry = allEntries[currentIndex + 1];
            navigate(`/etymology/${nextEntry.id}`);
        }
    };

    const handleRecommendationClick = (rec: EtymologyEntry) => {
        navigate(`/etymology/${rec.id}`);
    };

    const renderComponents = (components: EtymologyEntry['components']) => {
        if (!components || components.length === 0) return null;

        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    {components.map((comp, index) => (
                        <React.Fragment key={index}>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex flex-col items-center"
                            >
                                <div className="px-4 py-2 bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 rounded-xl">
                                    <span className="text-xl font-bold text-white">{comp.part}</span>
                                </div>
                                <span className="text-xs text-slate-400 mt-1">{comp.meaning}</span>
                                <span className="text-xs text-slate-500">{comp.origin}</span>
                            </motion.div>
                            {index < components.length - 1 && (
                                <span className="text-2xl text-slate-600 font-light">+</span>
                            )}
                        </React.Fragment>
                    ))}
                </div>
                <div className="text-slate-300 text-sm bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                    {components.map((comp, index) => (
                        <span key={index}>
                            <span className="text-primary font-medium">{comp.part}</span>
                            <span className="text-slate-400"> 表示『{comp.meaning}』</span>
                            {index < components.length - 1 && <span className="text-slate-500"> + </span>}
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    const renderWordCloud = (words: string[]) => {
        if (!words || words.length === 0) return null;

        return (
            <div className="flex flex-wrap gap-3 justify-center">
                {words.map((word, index) => {
                    const colorClass = WORD_CLOUD_COLORS[index % WORD_CLOUD_COLORS.length];
                    const sizeClass = WORD_CLOUD_SIZES[index % WORD_CLOUD_SIZES.length];
                    return (
                        <motion.span
                            key={word}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleWordCloudClick(word)}
                            className={`${colorClass} ${sizeClass} font-medium cursor-pointer hover:opacity-80 transition-opacity px-2 py-1 rounded-lg hover:bg-white/5`}
                        >
                            {word}
                        </motion.span>
                    );
                })}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw size={48} className="text-primary animate-spin mx-auto mb-4" />
                    <p className="text-white text-xl">加载词源详情中...</p>
                </div>
            </div>
        );
    }

    if (error && !entry && !checkResponse) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <Info size={48} className="text-red-400 mx-auto mb-4" />
                    <p className="text-white text-xl mb-4">加载失败</p>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button onClick={() => navigate('/etymology')} className="btn-primary inline-flex items-center gap-2">
                        <ArrowLeft size={18} />
                        返回词源列表
                    </button>
                </div>
            </div>
        );
    }

    const displayWord = entry?.word || wordInfo?.word || checkResponse?.word;

    return (
        <div className="min-h-screen bg-slate-900 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/etymology')}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                        >
                            <ArrowLeft size={20} className="text-slate-400" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                                词源百科
                            </h1>
                            <p className="text-slate-400 text-sm">探索单词的起源与奥秘</p>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6"
                        >
                            <p className="text-red-400">{error}</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {!entry && (!checkResponse || !checkResponse.has_etymology) ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-panel p-8 md:p-12 rounded-3xl text-center"
                    >
                        <BookOpen size={64} className="text-slate-600 mx-auto mb-4" />
                        <h2 className="text-3xl font-bold text-white mb-4">暂无词源信息</h2>
                        <p className="text-slate-400 mb-6">
                            {fromWordDetail
                                ? `「${displayWord}」暂无词源解析，看看其他同难度单词吧！`
                                : '该单词暂未收录词源信息'}
                        </p>
                        {checkResponse?.recommendations && checkResponse.recommendations.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-center gap-2">
                                    <Lightbulb size={20} className="text-amber-400" />
                                    同难度推荐词源
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {checkResponse.recommendations.map((rec, index) => (
                                        <motion.div
                                            key={rec.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            onClick={() => handleRecommendationClick(rec)}
                                            className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-primary/50 hover:bg-slate-800 transition cursor-pointer text-left"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xl font-bold text-white">{rec.word}</span>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${DIFFICULTY_COLORS[rec.difficulty_level] || DIFFICULTY_COLORS[3]}`}>
                                                    {DIFFICULTY_LABELS[rec.difficulty_level] || '中级'}
                                                </span>
                                            </div>
                                            <p className="text-slate-400 text-sm line-clamp-2">{rec.root_meaning}</p>
                                            {rec.language_origin && (
                                                <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                                                    <Globe size={12} />
                                                    <span>{rec.language_origin}</span>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                ) : entry ? (
                    <>
                        <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-panel p-6 md:p-10 rounded-3xl relative overflow-hidden mb-6"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-baseline gap-4 mb-3">
                                        <h2 className="text-5xl md:text-6xl font-bold text-white tracking-tight">{entry.word}</h2>
                                        {entry.pos && (
                                            <span className="text-xl text-slate-400 italic font-serif">{entry.pos}</span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div
                                            className="flex items-center gap-2 text-primary cursor-pointer hover:text-indigo-400 transition"
                                            onClick={() => playAudio(entry.word)}
                                        >
                                            <Volume2 size={24} />
                                            <span className="text-lg font-mono">{entry.pronunciation}</span>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${DIFFICULTY_COLORS[entry.difficulty_level] || DIFFICULTY_COLORS[3]}`}>
                                            {DIFFICULTY_LABELS[entry.difficulty_level] || '中级'}
                                        </span>
                                        {entry.language_origin && (
                                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-700/50 text-slate-300 flex items-center gap-1.5">
                                                <Globe size={14} />
                                                {entry.language_origin}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={toggleFavorite}
                                    className={`p-3 rounded-xl transition ${
                                        isFavorited
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'bg-slate-800/50 text-slate-500 hover:text-red-400'
                                    }`}
                                    title={isFavorited ? '取消收藏' : '添加收藏'}
                                >
                                    <Heart size={24} fill={isFavorited ? 'currentColor' : 'none'} />
                                </button>
                            </div>

                            {entry.definition && (
                                <div className="mb-8">
                                    <p className="text-2xl text-slate-200 font-light leading-relaxed">{entry.definition}</p>
                                </div>
                            )}

                            {entry.example && (
                                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 mb-8">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">例句</h3>
                                    <p className="text-xl text-indigo-200 italic font-serif">"{entry.example}"</p>
                                </div>
                            )}
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="glass-panel p-6 md:p-8 rounded-3xl mb-6"
                        >
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <GitBranch size={20} className="text-primary" />
                                词源解析
                            </h3>

                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">构词成分拆解</h4>
                                    {renderComponents(entry.components)}
                                </div>

                                {entry.root_meaning && (
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">词根来源说明</h4>
                                        <p className="text-slate-300 bg-gradient-to-r from-primary/10 to-accent/10 p-4 rounded-xl border border-primary/20">
                                            {entry.root_meaning}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="glass-panel p-6 md:p-8 rounded-3xl mb-6 bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/20"
                        >
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Lightbulb size={20} className="text-amber-400" />
                                词源故事
                            </h3>
                            <p className="text-slate-300 text-lg leading-relaxed">
                                {entry.explanation}
                            </p>
                        </motion.div>

                        {entry.related_words && entry.related_words.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="glass-panel p-6 md:p-8 rounded-3xl mb-6"
                            >
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Search size={20} className="text-secondary" />
                                    同根词举例
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    {entry.related_words.map((word, index) => (
                                        <motion.button
                                            key={word}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.3 + index * 0.05 }}
                                            onClick={() => handleRelatedWordClick(word)}
                                            className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 hover:border-secondary/50 rounded-xl text-white transition flex items-center gap-2 group"
                                        >
                                            <span className="font-medium">{word}</span>
                                            <Search size={14} className="text-slate-500 group-hover:text-secondary transition" />
                                        </motion.button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {entry.word_cloud && entry.word_cloud.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="glass-panel p-6 md:p-8 rounded-3xl mb-6"
                            >
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <Cloud size={20} className="text-accent" />
                                    关联词云
                                </h3>
                                {renderWordCloud(entry.word_cloud)}
                            </motion.div>
                        )}

                        <div className="flex items-center justify-between gap-4 pt-4">
                            <button
                                onClick={() => navigate('/etymology')}
                                className="btn-secondary inline-flex items-center gap-2"
                            >
                                <ArrowLeft size={18} />
                                返回列表
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={navigateToPrev}
                                    disabled={currentIndex <= 0}
                                    className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    title="上一词"
                                >
                                    <ChevronLeft size={24} className="text-slate-400" />
                                </button>
                                <span className="text-slate-500 text-sm px-2">
                                    {currentIndex >= 0 ? `${currentIndex + 1} / ${allEntries.length}` : '- / -'}
                                </span>
                                <button
                                    onClick={navigateToNext}
                                    disabled={currentIndex < 0 || currentIndex >= allEntries.length - 1}
                                    className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    title="下一词"
                                >
                                    <ChevronRight size={24} className="text-slate-400" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
};

export default EtymologyDetailPage;
