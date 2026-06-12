import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dailyChallengeApi } from '../api';
import type { DailyChallengeResponse, DailyChallengeStats } from '../api';
import { Flame, Trophy, Target, Clock, Users, Zap, Play, CheckCircle2, Star } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
    compact?: boolean;
}

const DailyChallengeCard: React.FC<Props> = ({ compact = false }) => {
    const navigate = useNavigate();
    const [challenge, setChallenge] = useState<DailyChallengeResponse | null>(null);
    const [stats, setStats] = useState<DailyChallengeStats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [challengeRes, statsRes] = await Promise.all([
                dailyChallengeApi.getChallenge(),
                dailyChallengeApi.getStats()
            ]);
            setChallenge(challengeRes.data);
            setStats(statsRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getScoreComment = (score: number, total: number) => {
        const ratio = score / total;
        if (ratio === 1) return { text: '完美通关！', emoji: '🏆', color: 'text-amber-400' };
        if (ratio >= 0.8) return { text: '表现出色！', emoji: '🌟', color: 'text-emerald-400' };
        if (ratio >= 0.6) return { text: '不错哦！', emoji: '👍', color: 'text-blue-400' };
        if (ratio >= 0.4) return { text: '继续加油！', emoji: '💪', color: 'text-purple-400' };
        return { text: '再接再厉！', emoji: '📚', color: 'text-slate-400' };
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
    };

    if (loading) {
        return (
            <div className={`glass-panel p-6 rounded-2xl ${compact ? '' : 'bg-gradient-to-br from-orange-500/10 via-red-500/5 to-pink-500/10 border border-orange-500/20'}`}>
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-slate-700 rounded w-1/3"></div>
                    <div className="h-20 bg-slate-700 rounded"></div>
                    <div className="h-10 bg-slate-700 rounded"></div>
                </div>
            </div>
        );
    }

    if (!challenge) return null;

    const isCompleted = challenge.status === 'completed';
    const totalQuestions = challenge.questions.length;

    if (compact) {
        return (
            <button
                onClick={() => navigate('/daily-challenge')}
                className="w-full text-left glass-panel p-4 rounded-xl hover:bg-slate-700/50 transition group"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shrink-0">
                        <Flame size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-white font-bold">今日挑战</div>
                        <div className="text-slate-400 text-sm truncate">
                            {isCompleted 
                                ? `已完成 ${challenge.submission?.score}/${totalQuestions} 分`
                                : `${totalQuestions} 道混合题型等你挑战`
                            }
                        </div>
                    </div>
                    {isCompleted ? (
                        <CheckCircle2 size={20} className="text-emerald-400" />
                    ) : (
                        <Play size={20} className="text-orange-400 group-hover:translate-x-1 transition" />
                    )}
                </div>
            </button>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 via-red-500/5 to-pink-500/10 border border-orange-500/20"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Flame size={24} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            今日挑战
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-normal">
                                每日更新
                            </span>
                        </h3>
                        <p className="text-slate-400 text-sm">混合题型 · 每天零点刷新</p>
                    </div>
                </div>
                {stats && stats.completed_count > 0 && (
                    <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                        <Users size={16} />
                        <span>{stats.completed_count} 人已完成</span>
                    </div>
                )}
            </div>

            {isCompleted && challenge.submission ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className="text-4xl">
                                {getScoreComment(challenge.submission.score, challenge.submission.total_questions).emoji}
                            </div>
                            <div>
                                <div className={`text-lg font-bold ${getScoreComment(challenge.submission.score, challenge.submission.total_questions).color}`}>
                                    {getScoreComment(challenge.submission.score, challenge.submission.total_questions).text}
                                </div>
                                <div className="flex items-center gap-4 text-slate-400 text-sm mt-1">
                                    <span className="flex items-center gap-1">
                                        <Trophy size={14} />
                                        {challenge.submission.score}/{challenge.submission.total_questions} 分
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock size={14} />
                                        {formatTime(challenge.submission.time_spent)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {[...Array(challenge.submission.total_questions)].map((_, i) => (
                                <Star
                                    key={i}
                                    size={18}
                                    className={i < challenge.submission!.score ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
                                />
                            ))}
                        </div>
                    </div>

                    {stats && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-800/30 rounded-lg text-center">
                                <div className="text-slate-400 text-xs mb-1">今日平均分</div>
                                <div className="text-white font-bold text-lg">{stats.avg_score}分</div>
                            </div>
                            <div className="p-3 bg-slate-800/30 rounded-lg text-center">
                                <div className="text-slate-400 text-xs mb-1">平均用时</div>
                                <div className="text-white font-bold text-lg">{formatTime(stats.avg_time)}</div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => navigate('/daily-challenge')}
                        className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition flex items-center justify-center gap-2"
                    >
                        <Target size={18} />
                        查看详细解析
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="p-4 bg-slate-800/50 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={16} className="text-amber-400" />
                            <span className="text-white font-medium">题型一览</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                            <div className="p-2 bg-slate-700/50 rounded-lg">
                                <div className="text-white font-medium">认词选择</div>
                                <div className="text-slate-500 text-xs">选择释义</div>
                            </div>
                            <div className="p-2 bg-slate-700/50 rounded-lg">
                                <div className="text-white font-medium">释义填空</div>
                                <div className="text-slate-500 text-xs">拼写单词</div>
                            </div>
                            <div className="p-2 bg-slate-700/50 rounded-lg">
                                <div className="text-white font-medium">听音辨词</div>
                                <div className="text-slate-500 text-xs">听发音选词</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>共 {totalQuestions} 道题</span>
                        {stats && (
                            <span className="flex items-center gap-1">
                                <Users size={14} />
                                已有 {stats.completed_count} 人挑战
                            </span>
                        )}
                    </div>

                    <button
                        onClick={() => navigate('/daily-challenge')}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                    >
                        <Play size={20} />
                        开始挑战
                    </button>
                </div>
            )}
        </motion.div>
    );
};

export default DailyChallengeCard;
