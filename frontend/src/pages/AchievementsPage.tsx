import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Lock, Calendar, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import type { Achievement } from '../api';

const AchievementsPage: React.FC = () => {
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
    const navigate = useNavigate();

    const categoryNames: Record<string, string> = {
        learning: '学习成就',
        streak: '连续学习',
        test: '测试成就',
        milestone: '里程碑',
    };

    const categoryColors: Record<string, string> = {
        learning: 'from-emerald-500 to-teal-500',
        streak: 'from-orange-500 to-red-500',
        test: 'from-blue-500 to-indigo-500',
        milestone: 'from-purple-500 to-pink-500',
    };

    useEffect(() => {
        fetchAchievements();
    }, []);

    const fetchAchievements = async () => {
        try {
            const res = await api.get('/achievements');
            setAchievements(res.data);
            await api.post('/achievements/mark-read');
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const groupedAchievements = achievements.reduce((acc, ach) => {
        if (!acc[ach.category]) {
            acc[ach.category] = [];
        }
        acc[ach.category].push(ach);
        return acc;
    }, {} as Record<string, Achievement[]>);

    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const totalCount = achievements.length;
    const progress = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-primary text-xl font-bold animate-pulse">
                    加载成就中...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <header className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 transition"
                    >
                        <ArrowLeft size={20} className="text-slate-300" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                            成就徽章
                        </h1>
                        <p className="text-slate-400">已解锁 {unlockedCount} / {totalCount} 枚徽章</p>
                    </div>
                </header>

                <div className="glass-panel p-6 rounded-2xl mb-8">
                    <div className="flex items-center gap-4 mb-4">
                        <Trophy size={24} className="text-amber-400" />
                        <span className="text-white font-semibold">收集进度</span>
                        <span className="ml-auto text-amber-400 font-bold">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                        />
                    </div>
                </div>

                <div className="space-y-8">
                    {Object.entries(groupedAchievements).map(([category, achs]) => (
                        <div key={category}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-1 h-6 rounded-full bg-gradient-to-b ${categoryColors[category]}`}></div>
                                <h2 className="text-xl font-bold text-white">
                                    {categoryNames[category] || category}
                                </h2>
                                <span className="text-slate-500 text-sm">
                                    {achs.filter(a => a.unlocked).length}/{achs.length}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {achs.map((achievement) => (
                                    <motion.div
                                        key={achievement.id}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setSelectedAchievement(achievement)}
                                        className={`
                                            relative p-4 rounded-2xl cursor-pointer transition-all duration-300
                                            ${achievement.unlocked
                                                ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-primary/50'
                                                : 'bg-slate-900/50 border border-slate-800 opacity-60 hover:opacity-80'
                                            }
                                        `}
                                    >
                                        {achievement.unlocked && achievement.is_read === 0 && (
                                            <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                        )}
                                        
                                        <div className="text-center">
                                            <div className={`
                                                text-4xl mb-3
                                                ${!achievement.unlocked && 'grayscale opacity-50'}
                                            `}>
                                                {achievement.icon}
                                            </div>
                                            <h3 className={`
                                                font-bold text-sm mb-1
                                                ${achievement.unlocked ? 'text-white' : 'text-slate-500'}
                                            `}>
                                                {achievement.name}
                                            </h3>
                                            {achievement.unlocked ? (
                                                <div className="flex items-center justify-center gap-1 text-xs text-emerald-400">
                                                    <Award size={12} />
                                                    <span>已解锁</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
                                                    <Lock size={12} />
                                                    <span>未解锁</span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <AnimatePresence>
                    {selectedAchievement && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                            onClick={() => setSelectedAchievement(null)}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="glass-panel rounded-3xl p-8 max-w-md w-full text-center"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className={`
                                    text-7xl mb-6
                                    ${!selectedAchievement.unlocked && 'grayscale opacity-50'}
                                `}>
                                    {selectedAchievement.icon}
                                </div>
                                
                                <h2 className="text-2xl font-bold text-white mb-2">
                                    {selectedAchievement.name}
                                </h2>
                                
                                <p className="text-slate-400 mb-6">
                                    {selectedAchievement.description}
                                </p>

                                {selectedAchievement.unlocked && selectedAchievement.unlocked_at ? (
                                    <div className="flex items-center justify-center gap-2 text-emerald-400 bg-emerald-500/10 rounded-xl py-3 px-4">
                                        <Calendar size={18} />
                                        <span>解锁于 {formatDate(selectedAchievement.unlocked_at)}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2 text-slate-500 bg-slate-800/50 rounded-xl py-3 px-4">
                                        <Lock size={18} />
                                        <span>尚未解锁，继续努力！</span>
                                    </div>
                                )}

                                <button
                                    onClick={() => setSelectedAchievement(null)}
                                    className="mt-6 w-full py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                                >
                                    关闭
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default AchievementsPage;
