import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dailyChallengeApi } from '../api';
import type { DailyChallengeResponse, ChallengeQuestion, ChallengeSubmission, DailyChallengeStats, ChallengeAnswer } from '../api';
import { 
    ArrowLeft, Volume2, Clock, CheckCircle2, XCircle, Trophy, Users, 
    Target, Flame, ChevronRight, Home, Star, BookOpen, Mic, PenLine
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type GameState = 'intro' | 'playing' | 'result';

const QUESTION_TYPE_LABELS: Record<string, { name: string; icon: React.ReactNode; color: string }> = {
    word_choice: { name: '认词选择', icon: <BookOpen size={16} />, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    definition_fill: { name: '释义填空', icon: <PenLine size={16} />, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    audio_recognition: { name: '听音辨词', icon: <Mic size={16} />, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

const DailyChallengePage: React.FC = () => {
    const navigate = useNavigate();
    const [gameState, setGameState] = useState<GameState>('intro');
    const [challenge, setChallenge] = useState<DailyChallengeResponse | null>(null);
    const [stats, setStats] = useState<DailyChallengeStats | null>(null);
    const [submission, setSubmission] = useState<ChallengeSubmission | null>(null);
    const [loading, setLoading] = useState(true);
    
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<string[]>([]);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [startTime, setStartTime] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (gameState === 'playing') {
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [gameState, startTime]);

    const fetchData = async () => {
        try {
            const [challengeRes, statsRes] = await Promise.all([
                dailyChallengeApi.getChallenge(),
                dailyChallengeApi.getStats()
            ]);
            setChallenge(challengeRes.data);
            setStats(statsRes.data);
            
            if (challengeRes.data.status === 'completed' && challengeRes.data.submission) {
                setSubmission(challengeRes.data.submission);
                setGameState('result');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const startChallenge = () => {
        setCurrentIndex(0);
        setAnswers(new Array(challenge?.questions.length || 0).fill(''));
        setCurrentAnswer('');
        setStartTime(Date.now());
        setElapsedTime(0);
        setGameState('playing');
    };

    const playAudio = (text: string) => {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'en-US';
        window.speechSynthesis.speak(utter);
    };

    const handleAnswer = useCallback((answer: string) => {
        setCurrentAnswer(answer);
    }, []);

    const goToNext = () => {
        if (!challenge) return;
        
        const newAnswers = [...answers];
        newAnswers[currentIndex] = currentAnswer;
        setAnswers(newAnswers);

        if (currentIndex < challenge.questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setCurrentAnswer(newAnswers[currentIndex + 1] || '');
        }
    };

    const goToPrev = () => {
        if (currentIndex === 0) return;
        
        const newAnswers = [...answers];
        newAnswers[currentIndex] = currentAnswer;
        setAnswers(newAnswers);
        
        setCurrentIndex(currentIndex - 1);
        setCurrentAnswer(newAnswers[currentIndex - 1] || '');
    };

    const submitChallenge = async () => {
        if (!challenge) return;
        setSubmitting(true);
        
        const finalAnswers = [...answers];
        finalAnswers[currentIndex] = currentAnswer;
        
        try {
            const res = await dailyChallengeApi.submitChallenge(finalAnswers, elapsedTime);
            setSubmission(res.data);
            setGameState('result');
            
            const statsRes = await dailyChallengeApi.getStats();
            setStats(statsRes.data);
        } catch (e: any) {
            console.error(e);
            alert(e?.response?.data?.error || '提交失败，请重试');
        } finally {
            setSubmitting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
    };

    const getScoreComment = (score: number, total: number) => {
        const ratio = score / total;
        if (ratio === 1) return { text: '完美通关！太厉害了！', emoji: '🏆', color: 'text-amber-400' };
        if (ratio >= 0.8) return { text: '表现出色！继续保持！', emoji: '🌟', color: 'text-emerald-400' };
        if (ratio >= 0.6) return { text: '不错哦！还有提升空间！', emoji: '👍', color: 'text-blue-400' };
        if (ratio >= 0.4) return { text: '继续加油！多多练习！', emoji: '💪', color: 'text-purple-400' };
        return { text: '再接再厉！每天进步一点点！', emoji: '📚', color: 'text-slate-400' };
    };

    const renderQuestion = (question: ChallengeQuestion) => {
        if (question.type === 'word_choice') {
            return (
                <div className="space-y-6">
                    <div className="text-center p-8 bg-slate-800/30 rounded-2xl">
                        <div className="flex items-baseline justify-center gap-4 mb-3">
                            <h2 className="text-5xl font-bold text-white tracking-tight">{question.word.word}</h2>
                            <span className="text-xl text-slate-400 italic font-serif">{question.word.pos}</span>
                        </div>
                        <div 
                            className="flex items-center justify-center gap-2 text-primary cursor-pointer hover:text-indigo-400 transition"
                            onClick={() => playAudio(question.word.word)}
                        >
                            <Volume2 size={20} />
                            <span className="text-lg font-mono">{question.word.pronunciation}</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-slate-400 text-sm mb-3">请选择正确的释义：</h3>
                        <div className="space-y-2">
                            {question.options?.map((option, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(option)}
                                    className={`w-full p-4 rounded-xl text-left transition border ${
                                        currentAnswer === option
                                            ? 'bg-primary/20 border-primary text-white'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-200 hover:bg-slate-700/50 hover:border-slate-600'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                                            currentAnswer === option ? 'bg-primary text-white' : 'bg-slate-700 text-slate-400'
                                        }`}>
                                            {String.fromCharCode(65 + idx)}
                                        </span>
                                        <span className="pt-0.5">{option}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        if (question.type === 'definition_fill') {
            return (
                <div className="space-y-6">
                    <div className="p-6 bg-slate-800/30 rounded-2xl">
                        <h3 className="text-slate-400 text-sm mb-2">请根据释义拼写单词：</h3>
                        <p className="text-2xl text-white font-light leading-relaxed">{question.word.definition}</p>
                        {question.word.example && (
                            <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                                <p className="text-slate-400 text-sm mb-1">例句提示：</p>
                                <p className="text-lg text-indigo-200 italic font-serif">
                                    "{question.word.example.replace(new RegExp(question.word.word, 'gi'), '______')}"
                                </p>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="text-slate-400 text-sm mb-2 block">你的答案：</label>
                        <input
                            type="text"
                            value={currentAnswer}
                            onChange={(e) => handleAnswer(e.target.value)}
                            placeholder="请输入单词..."
                            className="w-full px-5 py-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-xl text-center font-mono focus:border-primary focus:outline-none transition"
                            autoFocus
                        />
                        <div className="mt-3 flex items-center justify-center gap-2 text-slate-500 text-sm">
                            <span>提示：共 {question.word.word.length} 个字母</span>
                            <span>·</span>
                            <span>词性：{question.word.pos}</span>
                        </div>
                    </div>
                </div>
            );
        }

        if (question.type === 'audio_recognition') {
            return (
                <div className="space-y-6">
                    <div className="text-center p-8 bg-slate-800/30 rounded-2xl">
                        <button
                            onClick={() => playAudio(question.word.word)}
                            className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 transition shadow-lg shadow-emerald-500/30 flex items-center justify-center mx-auto mb-4"
                        >
                            <Volume2 size={40} className="text-white" />
                        </button>
                        <p className="text-white font-medium">点击播放发音</p>
                        <p className="text-slate-500 text-sm mt-1">可多次点击收听</p>
                    </div>
                    <div>
                        <h3 className="text-slate-400 text-sm mb-3">请选择你听到的单词：</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {question.options?.map((option, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(option)}
                                    className={`p-5 rounded-xl text-center transition border ${
                                        currentAnswer === option
                                            ? 'bg-emerald-500/20 border-emerald-500 text-white'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-200 hover:bg-slate-700/50 hover:border-slate-600'
                                    }`}
                                >
                                    <span className="text-xl font-bold font-mono">{option}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    const renderAnswerReview = (answer: ChallengeAnswer, index: number) => {
        const typeInfo = QUESTION_TYPE_LABELS[answer.question_type];
        
        return (
            <div key={index} className="p-5 rounded-2xl border bg-slate-800/30 border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 ${typeInfo.color}`}>
                            {typeInfo.icon}
                            {typeInfo.name}
                        </span>
                        <span className="text-slate-500 text-sm">第 {index + 1} 题</span>
                    </div>
                    {answer.is_correct ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-sm font-medium">
                            <CheckCircle2 size={16} />
                            正确
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-red-400 text-sm font-medium">
                            <XCircle size={16} />
                            错误
                        </span>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="flex items-baseline gap-3">
                        <span className="text-2xl font-bold text-white">{answer.word}</span>
                        <span className="text-slate-400 text-sm">{answer.definition}</span>
                    </div>

                    {!answer.is_correct && (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <div className="text-red-400 text-xs mb-1">你的答案</div>
                                <div className="text-white font-medium">{answer.user_answer || '（未作答）'}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <div className="text-emerald-400 text-xs mb-1">正确答案</div>
                                <div className="text-white font-medium">{answer.correct_answer}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">加载中...</div>
            </div>
        );
    }

    if (gameState === 'intro' && challenge) {
        return (
            <div className="min-h-screen bg-slate-900 p-4 md:p-8">
                <div className="max-w-2xl mx-auto">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition mb-8"
                    >
                        <ArrowLeft size={20} />
                        返回主页
                    </button>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-panel p-8 rounded-3xl bg-gradient-to-br from-orange-500/10 via-red-500/5 to-pink-500/10 border border-orange-500/20"
                    >
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
                                <Flame size={40} className="text-white" />
                            </div>
                            <h1 className="text-3xl font-bold text-white mb-2">今日挑战</h1>
                            <p className="text-slate-400">每天零点更新 · 混合题型练习</p>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="p-4 bg-slate-800/50 rounded-xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <Target size={18} className="text-primary" />
                                    <span className="text-white font-medium">挑战内容</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                    <div className="p-3 bg-slate-700/50 rounded-lg">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-1.5">
                                            <BookOpen size={16} />
                                        </div>
                                        <div className="text-white font-medium">认词选择</div>
                                        <div className="text-slate-500 text-xs">选择正确释义</div>
                                    </div>
                                    <div className="p-3 bg-slate-700/50 rounded-lg">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-1.5">
                                            <PenLine size={16} />
                                        </div>
                                        <div className="text-white font-medium">释义填空</div>
                                        <div className="text-slate-500 text-xs">根据释义拼写</div>
                                    </div>
                                    <div className="p-3 bg-slate-700/50 rounded-lg">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1.5">
                                            <Mic size={16} />
                                        </div>
                                        <div className="text-white font-medium">听音辨词</div>
                                        <div className="text-slate-500 text-xs">听发音选单词</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                                    <div className="text-3xl font-bold text-white mb-1">{challenge.questions.length}</div>
                                    <div className="text-slate-400 text-sm">道题目</div>
                                </div>
                                {stats && (
                                    <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                                        <div className="text-3xl font-bold text-white mb-1">{stats.completed_count}</div>
                                        <div className="text-slate-400 text-sm">人已挑战</div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <div className="flex items-start gap-2">
                                    <span className="text-xl">⚠️</span>
                                    <div>
                                        <div className="text-amber-400 font-medium text-sm">温馨提示</div>
                                        <div className="text-slate-400 text-sm mt-0.5">每人每天只能提交一次成绩，请认真作答哦！</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={startChallenge}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-lg transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30"
                        >
                            开始挑战
                            <ChevronRight size={22} />
                        </button>
                    </motion.div>
                </div>
            </div>
        );
    }

    if (gameState === 'playing' && challenge) {
        const question = challenge.questions[currentIndex];
        const typeInfo = QUESTION_TYPE_LABELS[question.type];
        const progress = ((currentIndex + 1) / challenge.questions.length) * 100;
        const isLast = currentIndex === challenge.questions.length - 1;
        const canGoNext = currentAnswer.trim().length > 0;

        return (
            <div className="min-h-screen bg-slate-900 p-4 md:p-8">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => {
                                if (confirm('确定要退出挑战吗？当前进度将不会保存。')) {
                                    navigate('/');
                                }
                            }}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition"
                        >
                            <ArrowLeft size={20} />
                            退出
                        </button>
                        <div className="flex items-center gap-2 text-slate-300 bg-slate-800 px-4 py-2 rounded-full">
                            <Clock size={16} />
                            <span className="font-mono font-medium">{formatTime(elapsedTime)}</span>
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 ${typeInfo.color}`}>
                                    {typeInfo.icon}
                                    {typeInfo.name}
                                </span>
                            </div>
                            <span className="text-slate-400 text-sm">
                                {currentIndex + 1} / {challenge.questions.length}
                            </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.3 }}
                                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                            />
                        </div>
                    </div>

                    <div className="mb-2 flex gap-1.5">
                        {challenge.questions.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 flex-1 rounded-full transition ${
                                    idx < currentIndex
                                        ? 'bg-emerald-500'
                                        : idx === currentIndex
                                        ? 'bg-primary'
                                        : 'bg-slate-700'
                                }`}
                            />
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="glass-panel p-6 md:p-8 rounded-3xl mb-6"
                        >
                            {renderQuestion(question)}
                        </motion.div>
                    </AnimatePresence>

                    <div className="flex gap-3">
                        <button
                            onClick={goToPrev}
                            disabled={currentIndex === 0}
                            className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition flex items-center gap-2"
                        >
                            上一题
                        </button>
                        <div className="flex-1" />
                        {isLast ? (
                            <button
                                onClick={submitChallenge}
                                disabled={!canGoNext || submitting}
                                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition flex items-center gap-2 shadow-lg shadow-orange-500/30"
                            >
                                {submitting ? '提交中...' : '提交挑战'}
                            </button>
                        ) : (
                            <button
                                onClick={goToNext}
                                disabled={!canGoNext}
                                className="px-8 py-3.5 rounded-xl bg-primary hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition flex items-center gap-2"
                            >
                                下一题
                                <ChevronRight size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'result' && submission && challenge) {
        const comment = getScoreComment(submission.score, submission.total_questions);
        const percentage = Math.round((submission.score / submission.total_questions) * 100);

        return (
            <div className="min-h-screen bg-slate-900 p-4 md:p-8">
                <div className="max-w-2xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-panel p-8 rounded-3xl bg-gradient-to-br from-orange-500/10 via-red-500/5 to-pink-500/10 border border-orange-500/20 mb-6"
                    >
                        <div className="text-center mb-8">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', delay: 0.1 }}
                                className="text-7xl mb-4"
                            >
                                {comment.emoji}
                            </motion.div>
                            <h1 className={`text-3xl font-bold mb-2 ${comment.color}`}>{comment.text}</h1>
                            <p className="text-slate-400">每日挑战完成！</p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-8">
                            <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                                <Trophy size={24} className="text-amber-400 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-white">
                                    {submission.score}<span className="text-slate-500 text-lg">/{submission.total_questions}</span>
                                </div>
                                <div className="text-slate-400 text-sm">得分</div>
                            </div>
                            <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                                <Clock size={24} className="text-blue-400 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-white">{formatTime(submission.time_spent)}</div>
                                <div className="text-slate-400 text-sm">用时</div>
                            </div>
                            <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                                <Target size={24} className="text-emerald-400 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-white">{percentage}%</div>
                                <div className="text-slate-400 text-sm">正确率</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 mb-6">
                            {[...Array(submission.total_questions)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2 + i * 0.1 }}
                                >
                                    <Star
                                        size={28}
                                        className={i < submission.score ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
                                    />
                                </motion.div>
                            ))}
                        </div>

                        {stats && stats.completed_count > 0 && (
                            <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                                <div className="flex items-center gap-2 mb-3">
                                    <Users size={18} className="text-slate-400" />
                                    <span className="text-slate-300 font-medium">今日挑战概览</span>
                                </div>
                                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                                    <div>
                                        <div className="text-white font-bold text-lg">{stats.completed_count}</div>
                                        <div className="text-slate-500">完成人数</div>
                                    </div>
                                    <div>
                                        <div className="text-white font-bold text-lg">{stats.avg_score}分</div>
                                        <div className="text-slate-500">平均分</div>
                                    </div>
                                    <div>
                                        <div className="text-white font-bold text-lg">{formatTime(stats.avg_time)}</div>
                                        <div className="text-slate-500">平均用时</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>

                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Target size={20} className="text-primary" />
                            逐题解析
                        </h2>
                        <div className="space-y-4">
                            {submission.answers.map((answer, index) => renderAnswerReview(answer, index))}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="flex-1 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition flex items-center justify-center gap-2"
                        >
                            <Home size={20} />
                            返回主页
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default DailyChallengePage;
