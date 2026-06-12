import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen,
    Search,
    Heart,
    Filter,
    ChevronDown,
    Star,
    BookmarkPlus,
    BookmarkCheck,
    Globe,
    ArrowLeft,
    X,
    Sparkles,
    Volume2,
    Hash,
    Layers,
    Clock,
    ArrowUpAZ,
} from 'lucide-react';
import { etymologyApi } from '../api';
import type { EtymologyEntry, EtymologyRoot } from '../api';

type TabType = 'all' | 'favorites';
type SortType = 'difficulty' | 'alpha' | 'newest';

const EtymologyPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
    const [difficultyFilter, setDifficultyFilter] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<SortType>('newest');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    const [etymologyList, setEtymologyList] = useState<EtymologyEntry[]>([]);
    const [roots, setRoots] = useState<EtymologyRoot[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 12;

    const [stats, setStats] = useState({
        total_entries: 0,
        total_roots: 0,
        favorite_count: 0,
        learned_with_etymology: 0,
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (activeTab === 'all') {
                const params: any = {
                    limit: LIMIT,
                    offset: 0,
                    sort_by: sortBy,
                };
                if (searchQuery) params.q = searchQuery;
                if (selectedRoot) params.root = selectedRoot;
                if (difficultyFilter) params.difficulty = difficultyFilter.toString();

                const res = await etymologyApi.getEtymologyList(params);
                setEtymologyList(res.data.data);
                setTotal(res.data.total);
                setHasMore(res.data.data.length < res.data.total);
                setOffset(res.data.data.length);
            } else {
                const res = await etymologyApi.getFavorites({ limit: LIMIT, offset: 0 });
                setEtymologyList(res.data.data);
                setTotal(res.data.total);
                setHasMore(res.data.data.length < res.data.total);
                setOffset(res.data.data.length);
            }
        } catch (e) {
            console.error('Failed to fetch etymology data:', e);
        } finally {
            setLoading(false);
        }
    }, [activeTab, searchQuery, selectedRoot, difficultyFilter, sortBy]);

    const loadMore = async () => {
        if (!hasMore || loading) return;
        try {
            if (activeTab === 'all') {
                const params: any = {
                    limit: LIMIT,
                    offset,
                    sort_by: sortBy,
                };
                if (searchQuery) params.q = searchQuery;
                if (selectedRoot) params.root = selectedRoot;
                if (difficultyFilter) params.difficulty = difficultyFilter.toString();

                const res = await etymologyApi.getEtymologyList(params);
                setEtymologyList(prev => [...prev, ...res.data.data]);
                setHasMore(offset + res.data.data.length < res.data.total);
                setOffset(prev => prev + res.data.data.length);
            } else {
                const res = await etymologyApi.getFavorites({ limit: LIMIT, offset });
                setEtymologyList(prev => [...prev, ...res.data.data]);
                setHasMore(offset + res.data.data.length < res.data.total);
                setOffset(prev => prev + res.data.data.length);
            }
        } catch (e) {
            console.error('Failed to load more:', e);
        }
    };

    const fetchRoots = async () => {
        try {
            const res = await etymologyApi.getRoots({ limit: 20 });
            setRoots(res.data);
        } catch (e) {
            console.error('Failed to fetch roots:', e);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await etymologyApi.getStats();
            setStats(res.data);
        } catch (e) {
            console.error('Failed to fetch stats:', e);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchRoots();
        fetchStats();
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setOffset(0);
        fetchData();
    };

    const handleRootClick = (root: string) => {
        setSelectedRoot(prev => (prev === root ? null : root));
        setOffset(0);
    };

    const handleDifficultyClick = (level: number | null) => {
        setDifficultyFilter(prev => (prev === level ? null : level));
        setOffset(0);
        setShowFilterMenu(false);
    };

    const handleSortChange = (sort: SortType) => {
        setSortBy(sort);
        setShowSortMenu(false);
        setOffset(0);
    };

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setOffset(0);
        setSearchQuery('');
        setSelectedRoot(null);
        setDifficultyFilter(null);
    };

    const toggleFavorite = async (entry: EtymologyEntry, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            if (entry.is_favorited) {
                await etymologyApi.removeFavorite(entry.id);
                setEtymologyList(prev =>
                    prev.map(item =>
                        item.id === entry.id ? { ...item, is_favorited: 0 } : item
                    )
                );
                if (activeTab === 'favorites') {
                    setEtymologyList(prev => prev.filter(item => item.id !== entry.id));
                    setTotal(prev => prev - 1);
                }
                setStats(prev => ({ ...prev, favorite_count: prev.favorite_count - 1 }));
            } else {
                await etymologyApi.addFavorite(entry.id);
                setEtymologyList(prev =>
                    prev.map(item =>
                        item.id === entry.id ? { ...item, is_favorited: 1 } : item
                    )
                );
                setStats(prev => ({ ...prev, favorite_count: prev.favorite_count + 1 }));
            }
        } catch (e) {
            console.error('Failed to toggle favorite:', e);
        }
    };

    const playAudio = (text?: string) => {
        if (!text) return;
        const utter = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utter);
    };

    const getDifficultyColor = (level: number) => {
        const colors: Record<number, string> = {
            1: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            2: 'bg-green-500/20 text-green-400 border-green-500/30',
            3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            4: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
            5: 'bg-red-500/20 text-red-400 border-red-500/30',
            6: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        };
        return colors[level] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    };

    const getDifficultyLabel = (level: number) => {
        const labels: Record<number, string> = {
            1: '入门',
            2: '初级',
            3: '中级',
            4: '中高级',
            5: '高级',
            6: '专家',
        };
        return labels[level] || `Level ${level}`;
    };

    const getSortLabel = (sort: SortType) => {
        const labels: Record<SortType, string> = {
            difficulty: '按难度',
            alpha: '字母顺序',
            newest: '最新添加',
        };
        return labels[sort];
    };

    const getSortIcon = (sort: SortType) => {
        const icons: Record<SortType, React.ReactNode> = {
            difficulty: <Layers size={16} />,
            alpha: <ArrowUpAZ size={16} />,
            newest: <Clock size={16} />,
        };
        return icons[sort];
    };

    const getRootSummary = (entry: EtymologyEntry) => {
        if (!entry.components || entry.components.length === 0) return entry.root_meaning;
        return entry.components
            .map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                    {i > 0 && <span className="text-slate-500">+</span>}
                    <span className="font-mono text-primary">{c.part}</span>
                    <span className="text-slate-400 text-xs">({c.meaning})</span>
                </span>
            ));
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedRoot(null);
        setDifficultyFilter(null);
        setOffset(0);
    };

    const hasActiveFilters = searchQuery || selectedRoot || difficultyFilter;

    if (loading && etymologyList.length === 0) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-primary text-xl font-bold animate-pulse">
                    加载词源百科中...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <header className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 transition"
                    >
                        <ArrowLeft size={20} className="text-slate-300" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent flex items-center gap-3">
                            <BookOpen className="text-primary" size={28} />
                            词源百科
                        </h1>
                        <p className="text-slate-400">
                            探索单词的起源与演变，共收录 {stats.total_entries} 条词源，{stats.total_roots} 个词根
                        </p>
                    </div>
                    <div className="hidden md:flex items-center gap-6">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white">{stats.total_entries}</div>
                            <div className="text-xs text-slate-500">总词条</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-primary">{stats.favorite_count}</div>
                            <div className="text-xs text-slate-500">已收藏</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-emerald-400">{stats.learned_with_etymology}</div>
                            <div className="text-xs text-slate-500">已学习</div>
                        </div>
                    </div>
                </header>

                <div className="glass-panel rounded-2xl p-4 mb-6">
                    <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索单词或解释..."
                                className="input-field pl-12"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowFilterMenu(!showFilterMenu);
                                        setShowSortMenu(false);
                                    }}
                                    className={`btn-secondary flex items-center gap-2 ${
                                        difficultyFilter ? 'border-primary/50 bg-primary/10' : ''
                                    }`}
                                >
                                    <Filter size={18} className={difficultyFilter ? 'text-primary' : ''} />
                                    <span className="hidden sm:inline">
                                        {difficultyFilter ? `难度 ${difficultyFilter}` : '难度'}
                                    </span>
                                    <ChevronDown size={16} />
                                </button>
                                <AnimatePresence>
                                    {showFilterMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute right-0 top-full mt-2 w-48 glass-panel rounded-xl p-2 z-30 shadow-xl"
                                        >
                                            <button
                                                onClick={() => handleDifficultyClick(null)}
                                                className={`w-full text-left px-3 py-2 rounded-lg transition ${
                                                    difficultyFilter === null
                                                        ? 'bg-primary/20 text-primary'
                                                        : 'text-slate-300 hover:bg-slate-700'
                                                }`}
                                            >
                                                全部难度
                                            </button>
                                            {[1, 2, 3, 4, 5, 6].map((level) => (
                                                <button
                                                    key={level}
                                                    onClick={() => handleDifficultyClick(level)}
                                                    className={`w-full text-left px-3 py-2 rounded-lg transition flex items-center gap-2 ${
                                                        difficultyFilter === level
                                                            ? 'bg-primary/20 text-primary'
                                                            : 'text-slate-300 hover:bg-slate-700'
                                                    }`}
                                                >
                                                    <Star size={14} />
                                                    {getDifficultyLabel(level)} ({level}级)
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSortMenu(!showSortMenu);
                                        setShowFilterMenu(false);
                                    }}
                                    className="btn-secondary flex items-center gap-2"
                                >
                                    {getSortIcon(sortBy)}
                                    <span className="hidden sm:inline">{getSortLabel(sortBy)}</span>
                                    <ChevronDown size={16} />
                                </button>
                                <AnimatePresence>
                                    {showSortMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute right-0 top-full mt-2 w-44 glass-panel rounded-xl p-2 z-30 shadow-xl"
                                        >
                                            {(['newest', 'difficulty', 'alpha'] as SortType[]).map((sort) => (
                                                <button
                                                    key={sort}
                                                    onClick={() => handleSortChange(sort)}
                                                    className={`w-full text-left px-3 py-2 rounded-lg transition flex items-center gap-2 ${
                                                        sortBy === sort
                                                            ? 'bg-primary/20 text-primary'
                                                            : 'text-slate-300 hover:bg-slate-700'
                                                    }`}
                                                >
                                                    {getSortIcon(sort)}
                                                    {getSortLabel(sort)}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <button type="submit" className="btn-primary">
                                搜索
                            </button>
                        </div>
                    </form>

                    {hasActiveFilters && (
                        <div className="mt-4 flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-slate-400">筛选条件:</span>
                            {searchQuery && (
                                <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm flex items-center gap-1">
                                    搜索: {searchQuery}
                                    <button onClick={() => setSearchQuery('')} className="hover:text-white ml-1">
                                        <X size={14} />
                                    </button>
                                </span>
                            )}
                            {selectedRoot && (
                                <span className="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm flex items-center gap-1">
                                    词根: {selectedRoot}
                                    <button onClick={() => setSelectedRoot(null)} className="hover:text-white ml-1">
                                        <X size={14} />
                                    </button>
                                </span>
                            )}
                            {difficultyFilter && (
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm flex items-center gap-1">
                                    难度: {getDifficultyLabel(difficultyFilter)}
                                    <button onClick={() => handleDifficultyClick(null)} className="hover:text-white ml-1">
                                        <X size={14} />
                                    </button>
                                </span>
                            )}
                            <button
                                onClick={clearFilters}
                                className="text-sm text-slate-400 hover:text-white transition"
                            >
                                清除全部
                            </button>
                        </div>
                    )}
                </div>

                {activeTab === 'all' && (
                    <div className="glass-panel rounded-2xl p-4 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Hash size={18} className="text-accent" />
                            <h2 className="text-lg font-bold text-white">常用词根前缀</h2>
                            <span className="text-sm text-slate-500">点击筛选相关词源</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {roots.slice(0, 15).map((root) => (
                                <motion.button
                                    key={root.id}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleRootClick(root.root)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                                        selectedRoot === root.root
                                            ? 'bg-gradient-to-r from-accent to-primary text-white shadow-lg shadow-accent/30'
                                            : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700 border border-slate-700'
                                    }`}
                                >
                                    <Globe size={14} />
                                    <span className="font-mono">{root.root}</span>
                                    <span className="text-xs opacity-75">({root.meaning})</span>
                                    <span className="text-xs opacity-50">{root.example_count}词</span>
                                </motion.button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-4 mb-6">
                    <div className="flex bg-slate-800 rounded-xl p-1">
                        <button
                            onClick={() => handleTabChange('all')}
                            className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                                activeTab === 'all'
                                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Globe size={18} />
                            全部词源
                        </button>
                        <button
                            onClick={() => handleTabChange('favorites')}
                            className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                                activeTab === 'favorites'
                                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Heart size={18} />
                            我的收藏
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/20">
                                {stats.favorite_count}
                            </span>
                        </button>
                    </div>
                    <div className="text-slate-400 text-sm ml-auto">
                        共 <span className="text-white font-bold">{total}</span> 条结果
                    </div>
                </div>

                {etymologyList.length === 0 ? (
                    <div className="glass-panel rounded-2xl p-12 text-center">
                        <Sparkles size={64} className="text-slate-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">
                            {activeTab === 'favorites' ? '还没有收藏的词源' : '暂无匹配的词源'}
                        </h3>
                        <p className="text-slate-400 mb-6">
                            {activeTab === 'favorites'
                                ? '浏览词源百科，点击心形图标收藏感兴趣的内容'
                                : '试试调整搜索条件或筛选器'}
                        </p>
                        {activeTab === 'favorites' && (
                            <button
                                onClick={() => handleTabChange('all')}
                                className="btn-primary inline-flex items-center gap-2"
                            >
                                <Globe size={18} />
                                去浏览词源
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            {etymologyList.map((entry, index) => (
                                <motion.div
                                    key={entry.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    onClick={() => navigate(`/etymology/${entry.id}`)}
                                    className="glass-panel rounded-2xl p-5 cursor-pointer hover:border-primary/50 transition-all duration-300 group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-accent opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`px-2 py-1 rounded-lg text-xs font-bold border ${getDifficultyColor(
                                                    entry.difficulty_level
                                                )}`}
                                            >
                                                {getDifficultyLabel(entry.difficulty_level)}
                                            </span>
                                            <span className="text-xs text-slate-500 font-mono">
                                                #{entry.id}
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => toggleFavorite(entry, e)}
                                            className="p-1.5 rounded-full hover:bg-slate-700/50 transition group/fav"
                                        >
                                            {entry.is_favorited ? (
                                                <BookmarkCheck
                                                    size={20}
                                                    className="text-rose-500 fill-rose-500"
                                                />
                                            ) : (
                                                <BookmarkPlus
                                                    size={20}
                                                    className="text-slate-400 group-hover/fav:text-rose-400 transition"
                                                />
                                            )}
                                        </button>
                                    </div>

                                    <div className="mb-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-2xl font-bold text-white group-hover:text-primary transition">
                                                {entry.word}
                                            </h3>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    playAudio(entry.word);
                                                }}
                                                className="p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-primary transition"
                                            >
                                                <Volume2 size={16} />
                                            </button>
                                        </div>
                                        {entry.pronunciation && (
                                            <p className="text-sm text-primary font-mono">
                                                {entry.pronunciation}
                                            </p>
                                        )}
                                        {entry.pos && (
                                            <span className="text-xs text-slate-500 italic">
                                                {entry.pos}
                                            </span>
                                        )}
                                    </div>

                                    <div className="bg-slate-800/50 rounded-xl p-3 mb-3 border border-slate-700/50">
                                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                                            <Layers size={12} />
                                            词根拆解
                                        </div>
                                        <div className="text-sm text-slate-300 leading-relaxed">
                                            {getRootSummary(entry)}
                                        </div>
                                    </div>

                                    {entry.definition && (
                                        <p className="text-slate-400 text-sm mb-3 line-clamp-2">
                                            {entry.definition}
                                        </p>
                                    )}

                                    {entry.word_cloud && entry.word_cloud.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {entry.word_cloud.slice(0, 5).map((tag, i) => (
                                                <span
                                                    key={i}
                                                    className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded-md hover:bg-primary/20 hover:text-primary transition"
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
                                            {entry.word_cloud.length > 5 && (
                                                <span className="px-2 py-0.5 text-slate-500 text-xs">
                                                    +{entry.word_cloud.length - 5}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>

                        {hasMore && (
                            <div className="text-center">
                                <button
                                    onClick={loadMore}
                                    disabled={loading}
                                    className="btn-secondary px-8 py-3 inline-flex items-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                            加载中...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={18} />
                                            加载更多
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {(showFilterMenu || showSortMenu) && (
                <div
                    className="fixed inset-0 z-20"
                    onClick={() => {
                        setShowFilterMenu(false);
                        setShowSortMenu(false);
                    }}
                />
            )}
        </div>
    );
};

export default EtymologyPage;
