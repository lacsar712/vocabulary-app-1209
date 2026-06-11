import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Volume2, X, Calendar } from 'lucide-react';
import api from '../api';

interface DailyData {
    [date: string]: number;
}

interface WordDetail {
    id: number;
    word_id: number;
    word: string;
    pronunciation: string;
    pos: string;
    definition: string;
    example: string;
    updated_at: string;
}

interface CalendarDay {
    date: Date;
    dayNumber: number;
    isCurrentMonth: boolean;
    wordCount: number;
    isToday: boolean;
}

interface LearningCalendarProps {
    onClose: () => void;
}

const LearningCalendar: React.FC<LearningCalendarProps> = ({ onClose }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [dailyData, setDailyData] = useState<DailyData>({});
    const [hoveredDay, setHoveredDay] = useState<CalendarDay | null>(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedDayWords, setSelectedDayWords] = useState<WordDetail[]>([]);
    const [loadingWords, setLoadingWords] = useState(false);
    const [loadingCalendar, setLoadingCalendar] = useState(false);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const getWordCountLevel = (count: number): 'none' | 'low' | 'medium' | 'high' => {
        if (count === 0) return 'none';
        if (count <= 5) return 'low';
        if (count <= 15) return 'medium';
        return 'high';
    };

    const getLevelColor = (level: 'none' | 'low' | 'medium' | 'high'): string => {
        switch (level) {
            case 'none': return 'bg-slate-800/30 border-slate-700/30';
            case 'low': return 'bg-emerald-900/40 border-emerald-700/50';
            case 'medium': return 'bg-emerald-700/50 border-emerald-500/60';
            case 'high': return 'bg-emerald-500/60 border-emerald-400/70';
        }
    };

    const getLevelLabel = (level: 'none' | 'low' | 'medium' | 'high'): string => {
        switch (level) {
            case 'none': return '未学习';
            case 'low': return '少量';
            case 'medium': return '中等';
            case 'high': return '较多';
        }
    };

    const generateCalendarDays = (): CalendarDay[] => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        const today = new Date();

        const days: CalendarDay[] = [];

        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const date = new Date(year, month - 1, prevMonthLastDay - i);
            const dateStr = date.toISOString().split('T')[0];
            days.push({
                date,
                dayNumber: prevMonthLastDay - i,
                isCurrentMonth: false,
                wordCount: dailyData[dateStr] || 0,
                isToday: false,
            });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = date.toISOString().split('T')[0];
            const isToday = date.toDateString() === today.toDateString();
            days.push({
                date,
                dayNumber: i,
                isCurrentMonth: true,
                wordCount: dailyData[dateStr] || 0,
                isToday,
            });
        }

        const remainingDays = 42 - days.length;
        for (let i = 1; i <= remainingDays; i++) {
            const date = new Date(year, month + 1, i);
            const dateStr = date.toISOString().split('T')[0];
            days.push({
                date,
                dayNumber: i,
                isCurrentMonth: false,
                wordCount: dailyData[dateStr] || 0,
                isToday: false,
            });
        }

        return days;
    };

    const fetchCalendarData = useCallback(async () => {
        setLoadingCalendar(true);
        try {
            const res = await api.get('/calendar', {
                params: {
                    year: year,
                    month: month + 1,
                },
            });
            setDailyData(res.data.daily_data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingCalendar(false);
        }
    }, [year, month]);

    const fetchDayDetail = useCallback(async (dateStr: string) => {
        setLoadingWords(true);
        try {
            const res = await api.get('/calendar/day', {
                params: { date: dateStr },
            });
            setSelectedDayWords(res.data.words);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingWords(false);
        }
    }, []);

    useEffect(() => {
        fetchCalendarData();
    }, [fetchCalendarData]);

    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
        setSelectedDate(null);
        setSelectedDayWords([]);
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
        setSelectedDate(null);
        setSelectedDayWords([]);
    };

    const handleDayClick = (day: CalendarDay) => {
        if (!day.isCurrentMonth) return;
        const dateStr = day.date.toISOString().split('T')[0];
        setSelectedDate(dateStr);
        fetchDayDetail(dateStr);
    };

    const handleDayHover = (day: CalendarDay, e: React.MouseEvent) => {
        if (!day.isCurrentMonth) {
            setHoveredDay(null);
            return;
        }
        setHoveredDay(day);
        setHoverPosition({ x: e.clientX, y: e.clientY });
    };

    const playAudio = (text: string) => {
        const utter = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utter);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
        });
    };

    const days = generateCalendarDays();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="glass-panel rounded-3xl overflow-hidden">
                    <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
                        <div className="flex items-center gap-3">
                            <Calendar size={24} className="text-primary" />
                            <h2 className="text-2xl font-bold text-white">学习日历</h2>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700/50 transition text-slate-400 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex flex-col lg:flex-row">
                        <div className="flex-1 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <button
                                    onClick={handlePrevMonth}
                                    className="p-2 rounded-lg hover:bg-slate-700/50 transition text-slate-300 hover:text-white"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <h3 className="text-xl font-bold text-white">
                                    {year}年 {monthNames[month]}
                                </h3>
                                <button
                                    onClick={handleNextMonth}
                                    className="p-2 rounded-lg hover:bg-slate-700/50 transition text-slate-300 hover:text-white"
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </div>

                            <div className="flex justify-center gap-6 mb-4">
                                {(['none', 'low', 'medium', 'high'] as const).map(level => (
                                    <div key={level} className="flex items-center gap-2">
                                        <div className={`w-4 h-4 rounded ${getLevelColor(level)}`}></div>
                                        <span className="text-xs text-slate-400">{getLevelLabel(level)}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {weekDays.map(day => (
                                    <div key={day} className="text-center text-sm font-medium text-slate-400 py-2">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {loadingCalendar ? (
                                <div className="text-center py-12 text-slate-400">加载日历数据中...</div>
                            ) : (
                                <div className="grid grid-cols-7 gap-1">
                                    {days.map((day, index) => {
                                        const level = getWordCountLevel(day.wordCount);
                                        return (
                                            <div
                                                key={index}
                                                onClick={() => handleDayClick(day)}
                                                onMouseEnter={(e) => handleDayHover(day, e)}
                                                onMouseLeave={() => setHoveredDay(null)}
                                                className={`
                                                    aspect-square flex items-center justify-center rounded-lg
                                                    text-sm font-medium cursor-pointer transition-all duration-200
                                                    border ${getLevelColor(level)}
                                                    ${day.isCurrentMonth ? '' : 'opacity-30'}
                                                    ${day.isToday ? 'ring-2 ring-primary ring-offset-2 ring-offset-slate-900' : ''}
                                                    ${day.isCurrentMonth ? 'hover:scale-105 hover:shadow-lg' : ''}
                                                    ${selectedDate === day.date.toISOString().split('T')[0] ? 'ring-2 ring-accent' : ''}
                                                `}
                                            >
                                                <span className={day.isCurrentMonth ? 'text-white' : 'text-slate-500'}>
                                                    {day.dayNumber}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <AnimatePresence>
                            {selectedDate && (
                                <motion.div
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: 320, opacity: 1 }}
                                    exit={{ width: 0, opacity: 0 }}
                                    className="border-l border-slate-700/50 overflow-hidden"
                                >
                                    <div className="w-80 h-full flex flex-col">
                                        <div className="p-4 border-b border-slate-700/50">
                                            <h4 className="text-lg font-bold text-white mb-1">
                                                {formatDate(selectedDate)}
                                            </h4>
                                            <p className="text-sm text-slate-400">
                                                已掌握 <span className="text-primary font-bold">{selectedDayWords.length}</span> 个单词
                                            </p>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-4">
                                            {loadingWords ? (
                                                <div className="text-center py-8 text-slate-400">加载单词详情中...</div>
                                            ) : selectedDayWords.length > 0 ? (
                                                <div className="space-y-3">
                                                    {selectedDayWords.map((word) => (
                                                        <motion.div
                                                            key={word.id}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <h5 className="text-base font-bold text-white">{word.word}</h5>
                                                                    <p className="text-xs text-primary">{word.pos} {word.pronunciation}</p>
                                                                </div>
                                                                <button
                                                                    onClick={() => playAudio(word.word)}
                                                                    className="text-slate-400 hover:text-primary transition"
                                                                >
                                                                    <Volume2 size={16} />
                                                                </button>
                                                            </div>
                                                            <p className="text-sm text-slate-300 mt-2">{word.definition}</p>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-slate-500">
                                                    当天没有学习记录
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <AnimatePresence>
                    {hoveredDay && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="fixed pointer-events-none z-50 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl"
                            style={{
                                left: hoverPosition.x + 15,
                                top: hoverPosition.y + 15,
                            }}
                        >
                            <div className="text-sm text-white font-medium">
                                {hoveredDay.date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                            </div>
                            <div className="text-xs text-slate-400">
                                掌握单词: <span className="text-primary font-bold">{hoveredDay.wordCount}</span> 个
                            </div>
                            <div className="text-xs text-slate-500">
                                {getLevelLabel(getWordCountLevel(hoveredDay.wordCount))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default LearningCalendar;
