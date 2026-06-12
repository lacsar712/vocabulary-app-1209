import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import type { WordList, WordListFormData } from '../api';
import { useWordList } from '../context/WordListContext';
import ProgressRing from '../components/ProgressRing';
import { 
    Plus, ListTodo, Edit3, Copy, Trash2, X, Play, 
    ChevronLeft, Clock, BookOpen, CheckCircle2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const WordListsPage: React.FC = () => {
    const [lists, setLists] = useState<WordList[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingList, setEditingList] = useState<WordList | null>(null);
    const [formData, setFormData] = useState<WordListFormData>({ name: '', description: '' });
    const [confirmDelete, setConfirmDelete] = useState<WordList | null>(null);
    const { activeList, setActiveList, clearActiveList } = useWordList();
    const navigate = useNavigate();

    const fetchLists = async () => {
        try {
            const res = await api.get('/word-lists');
            setLists(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLists();
    }, []);

    const openCreateModal = () => {
        setEditingList(null);
        setFormData({ name: '', description: '' });
        setShowModal(true);
    };

    const openEditModal = (list: WordList) => {
        setEditingList(list);
        setFormData({ name: list.name, description: list.description });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        try {
            if (editingList) {
                await api.put(`/word-lists/${editingList.id}`, formData);
            } else {
                await api.post('/word-lists', formData);
            }
            setShowModal(false);
            fetchLists();
        } catch (e: any) {
            alert(e.response?.data?.error || '操作失败');
        }
    };

    const handleCopy = async (list: WordList) => {
        try {
            await api.post(`/word-lists/${list.id}/copy`);
            fetchLists();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (list: WordList) => {
        try {
            await api.delete(`/word-lists/${list.id}`);
            if (activeList?.id === list.id) {
                clearActiveList();
            }
            setConfirmDelete(null);
            fetchLists();
        } catch (e) {
            console.error(e);
        }
    };

    const startLearning = (list: WordList) => {
        setActiveList(list);
        navigate('/');
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getProgress = (list: WordList) => {
        if (list.word_count === 0) return 0;
        return Math.round((list.learned_count / list.word_count) * 100);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-primary text-xl font-bold animate-pulse">加载中...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
                        >
                            <ChevronLeft size={20} className="text-slate-300" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                                我的词单
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">创建和管理个性化单词学习清单</p>
                        </div>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus size={20} />
                        新建词单
                    </button>
                </div>

                {activeList && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-panel p-4 rounded-2xl mb-6 bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center">
                                    <Play size={18} className="text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">当前学习中</p>
                                    <p className="text-white font-bold">{activeList.name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => clearActiveList()}
                                className="btn-secondary text-sm py-2 px-4"
                            >
                                退出词单模式
                            </button>
                        </div>
                    </motion.div>
                )}

                {lists.length === 0 ? (
                    <div className="glass-panel p-16 rounded-3xl text-center">
                        <ListTodo size={64} className="text-slate-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">还没有词单</h2>
                        <p className="text-slate-400 mb-6">创建您的第一个个性化词单，按自己的节奏学习</p>
                        <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2">
                            <Plus size={20} />
                            创建第一个词单
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {lists.map((list) => (
                            <motion.div
                                key={list.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                whileHover={{ y: -4 }}
                                className="glass-panel rounded-2xl p-6 cursor-pointer group"
                                onClick={() => navigate(`/word-lists/${list.id}`)}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xl font-bold text-white mb-1 truncate">
                                            {list.name}
                                        </h3>
                                        {list.description && (
                                            <p className="text-slate-400 text-sm line-clamp-2">
                                                {list.description}
                                            </p>
                                        )}
                                    </div>
                                    <ProgressRing progress={getProgress(list)} size={56} />
                                </div>

                                <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
                                    <div className="flex items-center gap-1">
                                        <BookOpen size={16} className="text-secondary" />
                                        <span>{list.word_count} 词</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <CheckCircle2 size={16} className="text-emerald-400" />
                                        <span>{list.learned_count} 已掌握</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 text-xs text-slate-500 mb-4">
                                    <Clock size={14} />
                                    <span>创建于 {formatDate(list.created_at)}</span>
                                </div>

                                <div className="flex items-center gap-2 pt-4 border-t border-slate-700/50">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            startLearning(list);
                                        }}
                                        disabled={list.word_count === 0}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition ${
                                            list.word_count === 0
                                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                : activeList?.id === list.id
                                                    ? 'bg-primary/30 text-primary'
                                                    : 'bg-primary/20 text-primary hover:bg-primary/30'
                                        }`}
                                    >
                                        <Play size={16} />
                                        {activeList?.id === list.id ? '学习中' : '学习该词单'}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openEditModal(list);
                                        }}
                                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                                        title="编辑"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCopy(list);
                                        }}
                                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                                        title="复制词单"
                                    >
                                        <Copy size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDelete(list);
                                        }}
                                        className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                                        title="删除"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="glass-panel bg-slate-900 p-6 rounded-2xl w-full max-w-md"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white">
                                    {editingList ? '编辑词单' : '新建词单'}
                                </h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-slate-400 hover:text-white transition"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            词单名称
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="例如：考研核心词汇"
                                            className="input-field"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            描述（可选）
                                        </label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="简要描述这个词单的用途..."
                                            rows={3}
                                            className="input-field resize-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="btn-secondary flex-1"
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!formData.name.trim()}
                                        className="btn-primary flex-1"
                                    >
                                        {editingList ? '保存' : '创建'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {confirmDelete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setConfirmDelete(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="glass-panel bg-slate-900 p-6 rounded-2xl w-full max-w-sm"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                                    <Trash2 size={32} className="text-red-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">确认删除</h3>
                                <p className="text-slate-400">
                                    确定要删除词单「{confirmDelete.name}」吗？<br />
                                    此操作不可撤销。
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="btn-secondary flex-1"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={() => handleDelete(confirmDelete)}
                                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-xl transition"
                                >
                                    删除
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default WordListsPage;
