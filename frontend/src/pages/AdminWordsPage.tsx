import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    adminApi,
    type AdminWord,
    type AdminWordFormData,
    type AdminTag,
    type AdminCsvImportResult
} from '../api';
import {
    Search, Plus, Edit2, Trash2, ArrowUpDown, ChevronLeft, ChevronRight,
    X, Download, Upload, Shield, Home, LogOut, Filter, Check, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from '../components/ConfirmDialog';

const DIFFICULTY_OPTIONS = [
    { value: '', label: '全部难度' },
    { value: '1', label: '基础' },
    { value: '2', label: '初级' },
    { value: '3', label: '中级' },
    { value: '4', label: '中高级' },
    { value: '5', label: '高级' },
    { value: '6', label: '专业' },
];

const DIFFICULTY_LABELS: Record<number, string> = {
    1: '基础', 2: '初级', 3: '中级', 4: '中高级', 5: '高级', 6: '专业'
};

const DIFFICULTY_BADGE: Record<number, string> = {
    1: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    2: 'bg-green-500/20 text-green-400 border-green-500/30',
    3: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    4: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    5: 'bg-red-500/20 text-red-400 border-red-500/30',
    6: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

interface WordFormErrors {
    word?: string;
    definition?: string;
}

const AdminWordsPage: React.FC = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [words, setWords] = useState<AdminWord[]>([]);
    const [total, setTotal] = useState(0);
    const [tags, setTags] = useState<AdminTag[]>([]);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState('');
    const [difficulty, setDifficulty] = useState('');
    const [tagFilter, setTagFilter] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [sortBy, setSortBy] = useState<'id' | 'word' | 'difficulty_level' | 'frequency' | 'rank' | 'updated_at'>('id');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showForm, setShowForm] = useState(false);
    const [editingWord, setEditingWord] = useState<AdminWord | null>(null);

    const [formData, setFormData] = useState<AdminWordFormData>({
        word: '',
        pronunciation: '',
        pos: '',
        definition: '',
        example: '',
        rank: null,
        frequency: 5,
        difficulty_level: 3,
        tags: ''
    });
    const [formErrors, setFormErrors] = useState<WordFormErrors>({});
    const [formSubmitting, setFormSubmitting] = useState(false);

    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; wordId?: number; wordName?: string; batch?: boolean }>({ open: false });
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [importResult, setImportResult] = useState<AdminCsvImportResult | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const fetchWords = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.getWords({
                q: search,
                difficulty,
                tag: tagFilter,
                limit: pageSize,
                offset: (page - 1) * pageSize,
                sort_by: sortBy,
                sort_order: sortOrder
            });
            setWords(res.data.data);
            setTotal(res.data.total);
        } catch (e) {
            console.error(e);
            const err = e as { response?: { data?: { error?: string } } };
            showToast('error', err.response?.data?.error || '加载单词列表失败');
        } finally {
            setLoading(false);
        }
    }, [search, difficulty, tagFilter, page, sortBy, sortOrder]);

    const fetchTags = useCallback(async () => {
        try {
            const res = await adminApi.getTags();
            setTags(res.data);
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        fetchWords();
        fetchTags();
    }, [fetchWords, fetchTags]);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSort = (column: typeof sortBy) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === words.length && words.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(words.map(w => w.id)));
        }
    };

    const openAddForm = () => {
        setEditingWord(null);
        setFormData({
            word: '',
            pronunciation: '',
            pos: '',
            definition: '',
            example: '',
            rank: null,
            frequency: 5,
            difficulty_level: 3,
            tags: ''
        });
        setFormErrors({});
        setShowForm(true);
    };

    const openEditForm = (word: AdminWord) => {
        setEditingWord(word);
        setFormData({
            word: word.word,
            pronunciation: word.pronunciation,
            pos: word.pos,
            definition: word.definition,
            example: word.example,
            rank: word.rank,
            frequency: word.frequency,
            difficulty_level: word.difficulty_level,
            tags: word.tags
        });
        setFormErrors({});
        setShowForm(true);
    };

    const validateForm = (): boolean => {
        const errors: WordFormErrors = {};
        if (!formData.word || formData.word.trim() === '') {
            errors.word = '单词不能为空';
        }
        if (!formData.definition || formData.definition.trim() === '') {
            errors.definition = '释义不能为空';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setFormSubmitting(true);
        try {
            if (editingWord) {
                await adminApi.updateWord(editingWord.id, formData);
                showToast('success', '单词更新成功');
            } else {
                await adminApi.createWord(formData);
                showToast('success', '单词创建成功');
            }
            setShowForm(false);
            fetchWords();
        } catch (e) {
            console.error(e);
            const err = e as { response?: { data?: { error?: string } } };
            showToast('error', err.response?.data?.error || '保存失败');
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleDeleteConfirm = async () => {
        setDeleteLoading(true);
        try {
            if (deleteConfirm.batch) {
                await adminApi.batchDeleteWords(Array.from(selectedIds));
                showToast('success', `已删除 ${selectedIds.size} 个单词`);
                setSelectedIds(new Set());
            } else if (deleteConfirm.wordId) {
                await adminApi.deleteWord(deleteConfirm.wordId);
                showToast('success', '单词已删除');
            }
            setDeleteConfirm({ open: false });
            fetchWords();
        } catch (e) {
            console.error(e);
            const err = e as { response?: { data?: { error?: string } } };
            showToast('error', err.response?.data?.error || '删除失败');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const res = await adminApi.exportCsv({
                difficulty,
                tag: tagFilter,
                q: search
            });
            const blob = new Blob([res.data as unknown as BlobPart], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vocabulary_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('success', '导出成功');
        } catch (e) {
            console.error(e);
            const err = e as { response?: { data?: { error?: string } } };
            showToast('error', err.response?.data?.error || '导出失败');
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const res = await adminApi.importCsv(text);
            setImportResult(res.data);
            fetchWords();
            fetchTags();
        } catch (err) {
            console.error(err);
            const e = err as { response?: { data?: { error?: string } } };
            showToast('error', e.response?.data?.error || '导入失败');
        } finally {
            e.target.value = '';
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="min-h-screen bg-slate-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                            <Shield size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-white">词库管理</h1>
                            <p className="text-slate-400 text-sm">共 {total} 个单词</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/admin')}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition text-slate-300 hover:text-white hidden sm:block"
                            title="管理首页"
                        >
                            <Home size={20} />
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition text-slate-300 hover:text-white"
                            title="返回学习主页"
                        >
                            <Home size={20} />
                        </button>
                        <button
                            onClick={() => { logout(); navigate('/login'); }}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-400 transition"
                            title="退出登录"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>

                <div className="glass-panel p-4 md:p-6 rounded-2xl mb-6">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-slate-400 text-sm mb-1">搜索关键词</label>
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                                    placeholder="搜索单词、释义、音标..."
                                    className="input-field pl-10"
                                />
                            </div>
                        </div>
                        <div className="min-w-[140px]">
                            <label className="block text-slate-400 text-sm mb-1">难度等级</label>
                            <select
                                value={difficulty}
                                onChange={e => { setDifficulty(e.target.value); setPage(1); }}
                                className="input-field appearance-none pr-8 cursor-pointer"
                            >
                                {DIFFICULTY_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="min-w-[140px]">
                            <label className="block text-slate-400 text-sm mb-1">主题标签</label>
                            <select
                                value={tagFilter}
                                onChange={e => { setTagFilter(e.target.value); setPage(1); }}
                                className="input-field appearance-none pr-8 cursor-pointer"
                            >
                                <option value="">全部标签</option>
                                {tags.map(t => (
                                    <option key={t.id} value={t.tag}>{t.tag}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
                                <Download size={18} />
                                导出
                            </button>
                            <button onClick={handleImportClick} className="btn-secondary flex items-center gap-2">
                                <Upload size={18} />
                                导入
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <button onClick={openAddForm} className="btn-primary flex items-center gap-2">
                                <Plus size={18} />
                                新增
                            </button>
                        </div>
                    </div>

                    {selectedIds.size > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between">
                            <p className="text-slate-400">已选择 <span className="text-white font-bold">{selectedIds.size}</span> 个单词</p>
                            <button
                                onClick={() => setDeleteConfirm({ open: true, batch: true })}
                                className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-medium flex items-center gap-2 transition"
                            >
                                <Trash2 size={16} />
                                批量删除
                            </button>
                        </div>
                    )}
                </div>

                <div className="glass-panel rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-800/50">
                                <tr>
                                    <th className="p-4 text-left w-12">
                                        <input
                                            type="checkbox"
                                            checked={words.length > 0 && selectedIds.size === words.length}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-primary focus:ring-primary"
                                        />
                                    </th>
                                    {[
                                        { key: 'word' as const, label: '单词' },
                                        { key: 'difficulty_level' as const, label: '难度' },
                                        { key: 'frequency' as const, label: '词频' },
                                        { key: 'rank' as const, label: 'Rank' },
                                    ].map(col => (
                                        <th
                                            key={col.key}
                                            className="p-4 text-left text-slate-400 text-sm font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition select-none"
                                            onClick={() => handleSort(col.key)}
                                        >
                                            <div className="flex items-center gap-1">
                                                {col.label}
                                                <ArrowUpDown size={14} className={`transition ${sortBy === col.key ? 'text-primary' : 'opacity-50'}`} />
                                            </div>
                                        </th>
                                    ))}
                                    <th className="p-4 text-left text-slate-400 text-sm font-semibold uppercase tracking-wider">标签</th>
                                    <th
                                        className="p-4 text-left text-slate-400 text-sm font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition select-none"
                                        onClick={() => handleSort('updated_at')}
                                    >
                                        <div className="flex items-center gap-1">
                                            更新时间
                                            <ArrowUpDown size={14} className={`transition ${sortBy === 'updated_at' ? 'text-primary' : 'opacity-50'}`} />
                                        </div>
                                    </th>
                                    <th className="p-4 text-right text-slate-400 text-sm font-semibold uppercase tracking-wider">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center text-slate-500">加载中...</td>
                                    </tr>
                                ) : words.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center text-slate-500">
                                            <Filter size={32} className="mx-auto mb-3 opacity-50" />
                                            未找到匹配的单词
                                        </td>
                                    </tr>
                                ) : (
                                    words.map(word => (
                                        <tr
                                            key={word.id}
                                            className={`border-t border-slate-700/30 hover:bg-slate-800/30 transition ${
                                                selectedIds.has(word.id) ? 'bg-primary/5' : ''
                                            }`}
                                        >
                                            <td className="p-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(word.id)}
                                                    onChange={() => toggleSelect(word.id)}
                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-primary focus:ring-primary"
                                                />
                                            </td>
                                            <td className="p-4">
                                                <div>
                                                    <p className="text-white font-bold text-lg">{word.word}</p>
                                                    {word.pronunciation && (
                                                        <p className="text-primary text-sm font-mono">{word.pronunciation}</p>
                                                    )}
                                                    {word.definition && (
                                                        <p className="text-slate-400 text-sm mt-1 line-clamp-1">{word.pos ? `${word.pos} ` : ''}{word.definition}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-block px-2.5 py-1 rounded-lg border text-xs font-semibold ${DIFFICULTY_BADGE[word.difficulty_level] || DIFFICULTY_BADGE[3]}`}>
                                                    {DIFFICULTY_LABELS[word.difficulty_level] || '未知'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-0.5">
                                                    {[...Array(5)].map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className={`w-2 h-4 rounded-sm ${
                                                                i < Math.ceil((word.frequency || 0) / 2)
                                                                    ? 'bg-emerald-400'
                                                                    : 'bg-slate-700'
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-300 font-mono text-sm">
                                                {word.rank || '-'}
                                            </td>
                                            <td className="p-4 max-w-[180px]">
                                                {word.tags ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {word.tags.split(/[,，]/).map((t, i) => t.trim() && (
                                                            <span key={i} className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs">
                                                                {t.trim()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-600">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-slate-400 text-sm">
                                                {new Date(word.updated_at).toLocaleDateString('zh-CN', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openEditForm(word)}
                                                        className="p-2 rounded-lg bg-slate-800 hover:bg-primary/20 hover:text-primary transition"
                                                        title="编辑"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirm({ open: true, wordId: word.id, wordName: word.word })}
                                                        className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-400 transition"
                                                        title="删除"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="p-4 border-t border-slate-700/50 flex items-center justify-between">
                            <p className="text-slate-400 text-sm">
                                第 {page} / {totalPages} 页，共 {total} 条
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum: number;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (page <= 3) {
                                        pageNum = i + 1;
                                    } else if (page >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = page - 2 + i;
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setPage(pageNum)}
                                            className={`w-9 h-9 rounded-lg font-semibold transition ${
                                                page === pageNum
                                                    ? 'bg-primary text-white'
                                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowForm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="glass-panel bg-slate-900 p-6 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">
                                    {editingWord ? '编辑单词' : '新增单词'}
                                </h2>
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="text-slate-400 hover:text-white transition"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleFormSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-slate-400 text-sm mb-1">
                                            单词 <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.word}
                                            onChange={e => setFormData({ ...formData, word: e.target.value })}
                                            placeholder="如: apple"
                                            className={`input-field ${formErrors.word ? 'border-red-500/50 focus:ring-red-500/30' : ''}`}
                                        />
                                        {formErrors.word && (
                                            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                                <AlertCircle size={12} />{formErrors.word}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-slate-400 text-sm mb-1">音标</label>
                                        <input
                                            type="text"
                                            value={formData.pronunciation}
                                            onChange={e => setFormData({ ...formData, pronunciation: e.target.value })}
                                            placeholder="如: /ˈæpəl/"
                                            className="input-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-400 text-sm mb-1">词性</label>
                                        <input
                                            type="text"
                                            value={formData.pos}
                                            onChange={e => setFormData({ ...formData, pos: e.target.value })}
                                            placeholder="如: n., v., adj."
                                            className="input-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-400 text-sm mb-1">难度等级</label>
                                        <select
                                            value={formData.difficulty_level || 3}
                                            onChange={e => setFormData({ ...formData, difficulty_level: parseInt(e.target.value) })}
                                            className="input-field appearance-none pr-8 cursor-pointer"
                                        >
                                            {DIFFICULTY_OPTIONS.filter(o => o.value !== '').map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">
                                        释义 <span className="text-red-400">*</span>
                                    </label>
                                    <textarea
                                        value={formData.definition}
                                        onChange={e => setFormData({ ...formData, definition: e.target.value })}
                                        placeholder="输入中文释义"
                                        rows={2}
                                        className={`input-field resize-none ${formErrors.definition ? 'border-red-500/50 focus:ring-red-500/30' : ''}`}
                                    />
                                    {formErrors.definition && (
                                        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                            <AlertCircle size={12} />{formErrors.definition}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">例句</label>
                                    <textarea
                                        value={formData.example}
                                        onChange={e => setFormData({ ...formData, example: e.target.value })}
                                        placeholder="输入英文例句"
                                        rows={2}
                                        className="input-field resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-slate-400 text-sm mb-1">词频 (1-10)</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={formData.frequency ?? 5}
                                            onChange={e => setFormData({ ...formData, frequency: parseInt(e.target.value) || 5 })}
                                            className="input-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-400 text-sm mb-1">Rank 排名</label>
                                        <input
                                            type="number"
                                            value={formData.rank ?? ''}
                                            onChange={e => setFormData({ ...formData, rank: e.target.value ? parseInt(e.target.value) : null })}
                                            placeholder="如: 1500"
                                            className="input-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-400 text-sm mb-1">标签 (逗号分隔)</label>
                                        <input
                                            type="text"
                                            value={formData.tags}
                                            onChange={e => setFormData({ ...formData, tags: e.target.value })}
                                            placeholder="如: 托福, 学术词汇"
                                            className="input-field"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 justify-end pt-4 border-t border-slate-700/50">
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="btn-secondary"
                                        disabled={formSubmitting}
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-primary flex items-center gap-2"
                                        disabled={formSubmitting}
                                    >
                                        <Check size={18} />
                                        {formSubmitting ? '保存中...' : (editingWord ? '保存修改' : '创建单词')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {importResult && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setImportResult(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="glass-panel bg-slate-900 p-6 rounded-2xl w-full max-w-md"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="text-center mb-6">
                                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                                    importResult.error_count === 0
                                        ? 'bg-emerald-500/20'
                                        : 'bg-amber-500/20'
                                }`}>
                                    <Check size={32} className={importResult.error_count === 0 ? 'text-emerald-400' : 'text-amber-400'} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">导入完成</h3>
                                <p className="text-slate-400 text-sm">
                                    成功 <span className="text-emerald-400 font-bold">{importResult.success_count}</span> 条，
                                    失败 <span className="text-red-400 font-bold">{importResult.error_count}</span> 条
                                </p>
                            </div>
                            {importResult.errors.length > 0 && (
                                <div className="bg-slate-800/50 rounded-xl p-4 mb-4 max-h-48 overflow-y-auto">
                                    <p className="text-red-400 text-sm font-semibold mb-2">错误详情：</p>
                                    <ul className="text-slate-400 text-xs space-y-1">
                                        {importResult.errors.map((e, i) => (
                                            <li key={i}>• {e}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <button
                                onClick={() => setImportResult(null)}
                                className="btn-primary w-full"
                            >
                                确定
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ConfirmDialog
                open={deleteConfirm.open}
                title={deleteConfirm.batch ? '批量删除确认' : '删除确认'}
                message={
                    deleteConfirm.batch
                        ? `确定要删除选中的 ${selectedIds.size} 个单词吗？此操作不可撤销。`
                        : `确定要删除单词 "${deleteConfirm.wordName}" 吗？此操作不可撤销。`
                }
                confirmText="删除"
                cancelText="取消"
                variant="danger"
                loading={deleteLoading}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteConfirm({ open: false })}
            />

            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
                            toast.type === 'success'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-red-500 text-white'
                        }`}
                    >
                        {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminWordsPage;
