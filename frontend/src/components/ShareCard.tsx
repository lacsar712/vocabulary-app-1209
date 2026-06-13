import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Download, Copy, Palette, Eye, EyeOff, Share2, Clock, Award, BookOpen, Sparkles, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

interface ShareCardProps {
    onClose: () => void;
}

type ShareDimension = 'weekly' | 'test' | 'custom';
type TemplateType = 'purple' | 'blue' | 'gold';

interface WeeklyData {
    weekWords: number;
    vocabSize: number;
    streakDays: number;
}

interface TestData {
    vocabSize: number;
    accuracy: number;
    correctCount: number;
    totalQuestions: number;
}

interface ShareRecord {
    id: string;
    timestamp: number;
    imageDataUrl: string;
    dimension: ShareDimension;
    template: TemplateType;
    title: string;
}

const STORAGE_KEY_RECORDS = 'vocab_share_records';

const templateColors: Record<TemplateType, {
    bgStart: string;
    bgEnd: string;
    primaryText: string;
    secondaryText: string;
    accent: string;
    cardBg: string;
    border: string;
    name: string;
}> = {
    purple: {
        bgStart: '#4c1d95',
        bgEnd: '#7c3aed',
        primaryText: '#ffffff',
        secondaryText: '#e9d5ff',
        accent: '#f0abfc',
        cardBg: 'rgba(88, 28, 135, 0.6)',
        border: 'rgba(196, 181, 253, 0.3)',
        name: '简约紫',
    },
    blue: {
        bgStart: '#0c4a6e',
        bgEnd: '#06b6d4',
        primaryText: '#ffffff',
        secondaryText: '#cffafe',
        accent: '#7dd3fc',
        cardBg: 'rgba(8, 47, 73, 0.6)',
        border: 'rgba(103, 232, 249, 0.3)',
        name: '渐变蓝',
    },
    gold: {
        bgStart: '#1c1917',
        bgEnd: '#78350f',
        primaryText: '#fef3c7',
        secondaryText: '#fde68a',
        accent: '#fbbf24',
        cardBg: 'rgba(41, 37, 36, 0.7)',
        border: 'rgba(251, 191, 36, 0.3)',
        name: '暗金',
    },
};

const ShareCard: React.FC<ShareCardProps> = ({ onClose }) => {
    const { user } = useAuth();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dimension, setDimension] = useState<ShareDimension>('weekly');
    const [template, setTemplate] = useState<TemplateType>('purple');
    const [title, setTitle] = useState('我的学习成果');
    const [showTitle, setShowTitle] = useState(true);
    const [showUsername, setShowUsername] = useState(true);
    const [showDate, setShowDate] = useState(true);
    const [showDataLabels, setShowDataLabels] = useState(true);
    const [customMotto, setCustomMotto] = useState('坚持每天学单词，词汇量稳步增长！');
    const [weeklyData, setWeeklyData] = useState<WeeklyData>({
        weekWords: 0,
        vocabSize: user?.vocab_size || 0,
        streakDays: 0,
    });
    const [testData, setTestData] = useState<TestData>({
        vocabSize: user?.vocab_size || 0,
        accuracy: 85,
        correctCount: 13,
        totalQuestions: 15,
    });
    const [records, setRecords] = useState<ShareRecord[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [copied, setCopied] = useState(false);
    const [saved, setSaved] = useState(false);

    const fetchData = useCallback(async () => {
        setLoadingData(true);
        try {
            const today = new Date();
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - 7);

            const calendarRes = await api.get('/calendar', {
                params: {
                    year: weekStart.getFullYear(),
                    month: weekStart.getMonth() + 1,
                },
            }).catch(() => ({ data: { daily_data: {} } }));

            const calendarRes2 = await api.get('/calendar', {
                params: {
                    year: today.getFullYear(),
                    month: today.getMonth() + 1,
                },
            }).catch(() => ({ data: { daily_data: {} } }));

            const dailyData = {
                ...(calendarRes.data?.daily_data || {}),
                ...(calendarRes2.data?.daily_data || {}),
            };

            let weekWords = 0;
            const dates: Date[] = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                dates.push(d);
                const dateStr = d.toISOString().split('T')[0];
                weekWords += dailyData[dateStr] || 0;
            }

            let streakDays = 0;
            for (let i = 0; i < 365; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                if ((dailyData[dateStr] || 0) > 0) {
                    streakDays++;
                } else {
                    break;
                }
            }

            setWeeklyData({
                weekWords,
                vocabSize: user?.vocab_size || 0,
                streakDays: streakDays || 1,
            });

            const meRes = await api.get('/me').catch(() => ({ data: { vocab_size: user?.vocab_size || 0 } }));
            const currentVocab = meRes.data?.vocab_size || user?.vocab_size || 0;
            setWeeklyData(prev => ({ ...prev, vocabSize: currentVocab }));
            setTestData(prev => ({ ...prev, vocabSize: currentVocab }));

        } catch (e) {
            console.error('Fetch share data error:', e);
        } finally {
            setLoadingData(false);
        }
    }, [user]);

    const loadRecords = useCallback(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
            if (raw) {
                const parsed = JSON.parse(raw);
                setRecords(Array.isArray(parsed) ? parsed.slice(0, 3) : []);
            }
        } catch (e) {
            console.error('Load records error:', e);
        }
    }, []);

    const saveRecord = useCallback((record: ShareRecord) => {
        const newRecords = [record, ...records].slice(0, 3);
        setRecords(newRecords);
        try {
            localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(newRecords));
        } catch (e) {
            console.error('Save records error:', e);
        }
    }, [records]);

    useEffect(() => {
        fetchData();
        loadRecords();
    }, [fetchData, loadRecords]);

    const drawShareImage = useCallback(async (): Promise<string | null> => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const size = 1080;
        canvas.width = size;
        canvas.height = size;
        const colors = templateColors[template];

        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, colors.bgStart);
        gradient.addColorStop(1, colors.bgEnd);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        ctx.globalAlpha = 0.08;
        for (let i = 0; i < 50; i++) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(
                Math.random() * size,
                Math.random() * size,
                Math.random() * 20 + 5,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.fillStyle = colors.cardBg;
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2;
        roundRect(ctx, 80, 80, size - 160, size - 160, 40);
        ctx.fill();
        ctx.stroke();

        if (showTitle) {
            ctx.fillStyle = colors.primaryText;
            ctx.font = 'bold 56px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(title, size / 2, 200);
        }

        const baseY = showTitle ? 280 : 180;

        if (showUsername) {
            ctx.fillStyle = colors.secondaryText;
            ctx.font = '36px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`@${user?.username || '学习者'}`, size / 2, baseY);
        }

        const dataStartY = baseY + 120;

        if (dimension === 'weekly') {
            drawWeeklyData(ctx, size, dataStartY, colors);
        } else if (dimension === 'test') {
            drawTestData(ctx, size, dataStartY, colors);
        } else {
            drawCustomMotto(ctx, size, dataStartY, colors);
        }

        const footerY = size - 160;

        if (showDate) {
            const now = new Date();
            const dateStr = now.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            ctx.fillStyle = colors.secondaryText;
            ctx.font = '28px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(dateStr, 140, footerY + 20);
        }

        ctx.fillStyle = colors.accent;
        ctx.font = 'bold 32px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('词汇学习助手', size - 140, footerY + 20);

        return canvas.toDataURL('image/png');
    }, [template, showTitle, title, showUsername, user, dimension, weeklyData, testData, customMotto, showDataLabels, showDate]);

    const drawWeeklyData = (
        ctx: CanvasRenderingContext2D,
        size: number,
        startY: number,
        colors: typeof templateColors.purple
    ) => {
        const items = [
            { value: weeklyData.weekWords, label: '本周掌握', unit: '词' },
            { value: weeklyData.vocabSize, label: '总词汇量', unit: '词' },
            { value: weeklyData.streakDays, label: '连续学习', unit: '天' },
        ];

        const cardWidth = 260;
        const gap = 40;
        const totalWidth = items.length * cardWidth + (items.length - 1) * gap;
        const startX = (size - totalWidth) / 2;

        items.forEach((item, i) => {
            const x = startX + i * (cardWidth + gap);
            const y = startY;

            ctx.fillStyle = colors.border;
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 2;
            roundRect(ctx, x, y, cardWidth, 280, 24);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = colors.primaryText;
            ctx.font = 'bold 80px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(item.value), x + cardWidth / 2, y + 120);

            ctx.fillStyle = colors.accent;
            ctx.font = '28px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.unit, x + cardWidth / 2, y + 165);

            if (showDataLabels) {
                ctx.fillStyle = colors.secondaryText;
                ctx.font = '30px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(item.label, x + cardWidth / 2, y + 230);
            }
        });

        if (weeklyData.streakDays >= 7) {
            const badgeY = startY + 360;
            ctx.fillStyle = colors.accent;
            ctx.font = '40px system-ui, sans-serif';
            ctx.textAlign = 'center';
            const badges = [];
            if (weeklyData.streakDays >= 30) badges.push('🏆 月度坚持');
            else if (weeklyData.streakDays >= 14) badges.push('🔥 双周达成');
            else badges.push('💪 周坚持者');
            ctx.fillText(badges.join('  '), size / 2, badgeY);
        }
    };

    const drawTestData = (
        ctx: CanvasRenderingContext2D,
        size: number,
        startY: number,
        colors: typeof templateColors.purple
    ) => {
        ctx.fillStyle = colors.border;
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2;
        roundRect(ctx, size / 2 - 300, startY, 600, 320, 28);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = colors.primaryText;
        ctx.font = 'bold 100px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(testData.vocabSize), size / 2, startY + 140);

        if (showDataLabels) {
            ctx.fillStyle = colors.accent;
            ctx.font = '32px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('当前词汇量', size / 2, startY + 190);
        }

        const statsY = startY + 260;
        ctx.fillStyle = colors.secondaryText;
        ctx.font = '28px system-ui, sans-serif';
        ctx.textAlign = 'center';
        if (showDataLabels) {
            ctx.fillText(
                `正确率 ${testData.accuracy}%  ·  答对 ${testData.correctCount}/${testData.totalQuestions} 题`,
                size / 2,
                statsY
            );
        } else {
            ctx.fillText(
                `${testData.accuracy}%  ·  ${testData.correctCount}/${testData.totalQuestions}`,
                size / 2,
                statsY
            );
        }

        const awardY = startY + 420;
        let level = '';
        if (testData.accuracy >= 90) level = '🏅 成绩卓越';
        else if (testData.accuracy >= 75) level = '🎯 表现优秀';
        else if (testData.accuracy >= 60) level = '👍 稳步进步';
        else level = '📚 继续加油';

        ctx.fillStyle = colors.accent;
        ctx.font = '36px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(level, size / 2, awardY);
    };

    const drawCustomMotto = (
        ctx: CanvasRenderingContext2D,
        size: number,
        startY: number,
        colors: typeof templateColors.purple
    ) => {
        const boxHeight = 400;
        ctx.fillStyle = colors.border;
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2;
        roundRect(ctx, size / 2 - 380, startY, 760, boxHeight, 28);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = colors.accent;
        ctx.font = '60px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💬', size / 2, startY + 90);

        const maxWidth = 660;
        const lineHeight = 56;
        const words = customMotto.split('');
        const lines: string[] = [];
        let currentLine = '';

        for (const char of words) {
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);

        ctx.fillStyle = colors.primaryText;
        ctx.font = '44px system-ui, sans-serif';
        ctx.textAlign = 'center';

        const textStartY = startY + 160;
        const totalTextHeight = lines.length * lineHeight;
        const offsetY = (boxHeight - totalTextHeight - 100) / 2;

        lines.forEach((line, i) => {
            ctx.fillText(line, size / 2, textStartY + offsetY + i * lineHeight);
        });

        ctx.fillStyle = colors.secondaryText;
        ctx.font = '28px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`—— 学习座右铭`, size / 2, startY + boxHeight - 40);
    };

    const roundRect = (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number
    ) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    };

    useEffect(() => {
        if (!loadingData) {
            drawShareImage();
        }
    }, [drawShareImage, loadingData]);

    const handleDownload = async () => {
        const dataUrl = await drawShareImage();
        if (!dataUrl) return;

        const record: ShareRecord = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            imageDataUrl: dataUrl,
            dimension,
            template,
            title,
        };
        saveRecord(record);

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `学习分享_${new Date().toLocaleDateString('zh-CN')}.png`;
        link.click();

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleCopy = async () => {
        const dataUrl = await drawShareImage();
        if (!dataUrl) return;

        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);

            const record: ShareRecord = {
                id: Date.now().toString(),
                timestamp: Date.now(),
                imageDataUrl: dataUrl,
                dimension,
                template,
                title,
            };
            saveRecord(record);

            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Copy to clipboard failed:', e);
            alert('复制失败，请尝试使用保存图片功能');
        }
    };

    const handleRecordAction = (record: ShareRecord) => {
        setDimension(record.dimension);
        setTemplate(record.template);
        setTitle(record.title);
    };

    const handleRecordDownload = (record: ShareRecord) => {
        const link = document.createElement('a');
        link.href = record.imageDataUrl;
        link.download = `学习分享_${new Date(record.timestamp).toLocaleDateString('zh-CN')}.png`;
        link.click();
    };

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor(diff / (1000 * 60));

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes} 分钟前`;
        if (hours < 24) return `${hours} 小时前`;
        return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    };

    const dimensionLabels: Record<ShareDimension, string> = {
        weekly: '学习数据',
        test: '测试成绩',
        custom: '座右铭',
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-6xl max-h-[92vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="glass-panel rounded-3xl overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
                        <div className="flex items-center gap-3">
                            <Share2 size={24} className="text-primary" />
                            <h2 className="text-xl font-bold text-white">学习分享卡片</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-700/50 transition text-slate-400 hover:text-white"
                        >
                            <X size={22} />
                        </button>
                    </div>

                    <div className="flex flex-col lg:flex-row max-h-[calc(92vh-70px)] overflow-y-auto">
                        <div className="flex-1 p-5 lg:p-6 flex flex-col items-center justify-center bg-gradient-to-br from-slate-800/30 to-slate-900/30">
                            <div className="relative w-full max-w-sm aspect-square shadow-2xl rounded-2xl overflow-hidden">
                                <canvas
                                    ref={canvasRef}
                                    className="w-full h-full rounded-2xl"
                                    style={{ imageRendering: 'auto' }}
                                />
                                {loadingData && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 rounded-2xl">
                                        <div className="text-white animate-pulse">加载数据中...</div>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-3">1080 × 1080 px · 预览实时更新</p>
                        </div>

                        <div className="flex-1 p-5 lg:p-6 space-y-5 border-t lg:border-t-0 lg:border-l border-slate-700/50">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                                    <Award size={16} />
                                    分享维度
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['weekly', 'test', 'custom'] as ShareDimension[]).map(dim => (
                                        <button
                                            key={dim}
                                            onClick={() => setDimension(dim)}
                                            className={`p-3 rounded-xl text-sm font-medium transition-all ${
                                                dimension === dim
                                                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/30'
                                                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 border border-slate-700'
                                            }`}
                                        >
                                            {dim === 'weekly' && <Clock size={18} className="mx-auto mb-1" />}
                                            {dim === 'test' && <Award size={18} className="mx-auto mb-1" />}
                                            {dim === 'custom' && <BookOpen size={18} className="mx-auto mb-1" />}
                                            {dimensionLabels[dim]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {dimension === 'custom' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">
                                        自定义座右铭
                                    </label>
                                    <textarea
                                        value={customMotto}
                                        onChange={e => setCustomMotto(e.target.value.slice(0, 50))}
                                        className="input-field resize-none h-20"
                                        placeholder="写下你的学习座右铭..."
                                    />
                                    <div className="text-xs text-slate-500 text-right mt-1">
                                        {customMotto.length}/50
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                                    <Palette size={16} />
                                    视觉模板
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(Object.keys(templateColors) as TemplateType[]).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setTemplate(t)}
                                            className={`p-3 rounded-xl text-sm font-medium transition-all border-2 ${
                                                template === t
                                                    ? 'border-white/60 shadow-lg'
                                                    : 'border-transparent hover:border-white/20'
                                            }`}
                                            style={{
                                                background: `linear-gradient(135deg, ${templateColors[t].bgStart}, ${templateColors[t].bgEnd})`,
                                                color: templateColors[t].primaryText,
                                            }}
                                        >
                                            <Sparkles size={18} className="mx-auto mb-1" />
                                            {templateColors[t].name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                                    <Sparkles size={16} />
                                    标题文案
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value.slice(0, 20))}
                                    className="input-field"
                                    placeholder="输入标题..."
                                />
                                <div className="text-xs text-slate-500 text-right mt-1">
                                    {title.length}/20
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                                    <Eye size={16} />
                                    显示项
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <DisplayToggle
                                        label="标题"
                                        checked={showTitle}
                                        onChange={setShowTitle}
                                    />
                                    <DisplayToggle
                                        label="用户名"
                                        checked={showUsername}
                                        onChange={setShowUsername}
                                    />
                                    <DisplayToggle
                                        label="生成日期"
                                        checked={showDate}
                                        onChange={setShowDate}
                                    />
                                    <DisplayToggle
                                        label="数据标签"
                                        checked={showDataLabels}
                                        onChange={setShowDataLabels}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleDownload}
                                    className="btn-primary flex-1 flex items-center justify-center gap-2 py-3"
                                >
                                    {saved ? <Check size={20} /> : <Download size={20} />}
                                    {saved ? '已保存' : '保存图片'}
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className="btn-secondary flex-1 flex items-center justify-center gap-2 py-3"
                                >
                                    {copied ? <Check size={20} /> : <Copy size={20} />}
                                    {copied ? '已复制' : '复制图片'}
                                </button>
                            </div>

                            <div className="pt-4 border-t border-slate-700/50">
                                <label className="block text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                                    <Clock size={16} />
                                    最近生成记录
                                </label>
                                {records.length === 0 ? (
                                    <div className="text-center py-6 text-sm text-slate-500 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
                                        暂无生成记录
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {records.map(record => (
                                            <div
                                                key={record.id}
                                                className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600 transition"
                                            >
                                                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-900">
                                                    <img
                                                        src={record.imageDataUrl}
                                                        alt="历史记录"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-white truncate">
                                                        {record.title}
                                                    </div>
                                                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                                        <span
                                                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                                            style={{
                                                                background: `linear-gradient(135deg, ${templateColors[record.template].bgStart}, ${templateColors[record.template].bgEnd})`,
                                                                color: templateColors[record.template].primaryText,
                                                            }}
                                                        >
                                                            {templateColors[record.template].name}
                                                        </span>
                                                        <span>{dimensionLabels[record.dimension]}</span>
                                                        <span>· {formatTime(record.timestamp)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 shrink-0">
                                                    <button
                                                        onClick={() => handleRecordAction(record)}
                                                        className="p-1.5 rounded-lg hover:bg-slate-700/70 text-slate-400 hover:text-primary transition"
                                                        title="应用设置"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRecordDownload(record)}
                                                        className="p-1.5 rounded-lg hover:bg-slate-700/70 text-slate-400 hover:text-white transition"
                                                        title="再次下载"
                                                    >
                                                        <Download size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

interface DisplayToggleProps {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}

const DisplayToggle: React.FC<DisplayToggleProps> = ({ label, checked, onChange }) => {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-sm transition-all ${
                checked
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'bg-slate-800/50 text-slate-500 border border-slate-700/60 hover:text-slate-400'
            }`}
        >
            {checked ? <Eye size={15} /> : <EyeOff size={15} />}
            {label}
        </button>
    );
};

export default ShareCard;
