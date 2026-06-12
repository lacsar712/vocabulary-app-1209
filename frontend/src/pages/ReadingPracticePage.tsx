import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { readingApi, type ReadingWord } from '../api';
import { 
    Volume2, Mic, Play, Pause, SkipForward, Heart, HeartOff, 
    ChevronDown, ChevronUp, Home, ListTodo, ArrowLeft, 
    RefreshCw, Info, VolumeX, BookOpen 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AudioLevel {
    value: number;
    timestamp: number;
}

const ReadingPracticePage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    
    const [currentWord, setCurrentWord] = useState<ReadingWord | null>(null);
    const [loading, setLoading] = useState(true);
    const [practicedCount, setPracticedCount] = useState(0);
    const [showTranslation, setShowTranslation] = useState(false);
    const [showFavorites, setShowFavorites] = useState(false);
    const [favorites, setFavorites] = useState<ReadingWord[]>([]);
    const [stats, setStats] = useState({ practiced_today: 0, total_practices: 0, total_favorites: 0 });
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState<1 | 0.75>(1);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [audioLevels, setAudioLevels] = useState<AudioLevel[]>([]);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);
    const [hasMicrophone, setHasMicrophone] = useState<boolean | null>(null);
    const [textMode, setTextMode] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
    
    const wordListId = location.state?.wordListId as number | undefined;
    
    const checkMicrophone = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            setHasMicrophone(true);
            setTextMode(false);
        } catch (err) {
            console.warn('Microphone not available:', err);
            setHasMicrophone(false);
            setTextMode(true);
        }
    }, []);
    
    useEffect(() => {
        checkMicrophone();
        loadData();
        return () => {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, []);
    
    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [wordRes, statsRes, favRes] = await Promise.all([
                readingApi.getRandomExample(wordListId),
                readingApi.getStats(),
                readingApi.getFavorites()
            ]);
            setCurrentWord(wordRes.data);
            setStats(statsRes.data);
            setFavorites(favRes.data);
        } catch (err: any) {
            console.error('Failed to load data:', err);
            setError(err.response?.data?.error || '加载数据失败');
        } finally {
            setLoading(false);
        }
    };
    
    const loadNextExample = async (excludeCurrent: boolean = true) => {
        try {
            setLoading(true);
            setError(null);
            resetAudioState();
            const res = await readingApi.getRandomExample(
                wordListId,
                excludeCurrent ? currentWord?.id : undefined
            );
            setCurrentWord(res.data);
            setShowTranslation(false);
        } catch (err: any) {
            console.error('Failed to load next example:', err);
            setError(err.response?.data?.error || '加载下一句失败');
        } finally {
            setLoading(false);
        }
    };
    
    const loadFavoriteExample = async (word: ReadingWord) => {
        try {
            setLoading(true);
            setError(null);
            resetAudioState();
            const res = await readingApi.getWordExample(word.id);
            setCurrentWord(res.data);
            setShowFavorites(false);
            setShowTranslation(false);
        } catch (err: any) {
            console.error('Failed to load favorite example:', err);
            setError(err.response?.data?.error || '加载失败');
        } finally {
            setLoading(false);
        }
    };
    
    const resetAudioState = () => {
        setAudioLevels([]);
        setRecordedBlob(null);
        setRecordingDuration(0);
        setIsRecording(false);
        setIsPlayingRecorded(false);
        setTextInput('');
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
        }
    };
    
    const playExample = (speed: 1 | 0.75 = 1) => {
        if (!currentWord) return;
        
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(currentWord.example);
        utter.lang = 'en-US';
        utter.rate = speed;
        utter.pitch = 1;
        
        utter.onstart = () => setIsPlaying(true);
        utter.onend = () => setIsPlaying(false);
        utter.onerror = () => setIsPlaying(false);
        
        window.speechSynthesis.speak(utter);
    };
    
    const startRecording = async () => {
        if (!hasMicrophone) {
            setError('未检测到麦克风，请检查权限设置');
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { echoCancellation: true, noiseSuppression: true } 
            });
            
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setRecordedBlob(blob);
                stream.getTracks().forEach(track => track.stop());
                if (audioContextRef.current) audioContextRef.current.close();
            };
            
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingDuration(0);
            setAudioLevels([]);
            
            recordingTimerRef.current = window.setInterval(() => {
                setRecordingDuration(prev => prev + 0.1);
            }, 100);
            
            updateAudioLevels();
            
        } catch (err: any) {
            console.error('Failed to start recording:', err);
            setError(err.message || '录音启动失败，请检查麦克风权限');
            setHasMicrophone(false);
            setTextMode(true);
        }
    };
    
    const updateAudioLevels = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalizedValue = average / 255;
        
        setAudioLevels(prev => [...prev.slice(-50), { 
            value: normalizedValue, 
            timestamp: Date.now() 
        }]);
        
        animationFrameRef.current = requestAnimationFrame(updateAudioLevels);
    };
    
    const stopRecording = async () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
        }
        
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        
        setIsRecording(false);
        
        if (currentWord) {
            try {
                await readingApi.recordPractice(currentWord.id);
                setPracticedCount(prev => prev + 1);
                setCurrentWord(prev => prev ? { ...prev, practice_count: prev.practice_count + 1 } : null);
                setStats(prev => ({ 
                    ...prev, 
                    practiced_today: prev.practiced_today + 1,
                    total_practices: prev.total_practices + 1
                }));
            } catch (err) {
                console.error('Failed to record practice:', err);
            }
        }
    };
    
    const playRecordedAudio = () => {
        if (!recordedBlob) return;
        
        if (isPlayingRecorded) {
            recordedAudioRef.current?.pause();
            setIsPlayingRecorded(false);
            return;
        }
        
        const audioUrl = URL.createObjectURL(recordedBlob);
        recordedAudioRef.current = new Audio(audioUrl);
        
        recordedAudioRef.current.onended = () => {
            setIsPlayingRecorded(false);
            URL.revokeObjectURL(audioUrl);
        };
        
        recordedAudioRef.current.play();
        setIsPlayingRecorded(true);
    };
    
    const submitTextPractice = async () => {
        if (!textInput.trim() || !currentWord) return;
        
        try {
            await readingApi.recordPractice(currentWord.id);
            setPracticedCount(prev => prev + 1);
            setCurrentWord(prev => prev ? { ...prev, practice_count: prev.practice_count + 1 } : null);
            setStats(prev => ({ 
                ...prev, 
                practiced_today: prev.practiced_today + 1,
                total_practices: prev.total_practices + 1
            }));
            setTextInput('');
        } catch (err) {
            console.error('Failed to record practice:', err);
        }
    };
    
    const toggleFavorite = async () => {
        if (!currentWord) return;
        
        try {
            if (currentWord.is_favorited) {
                await readingApi.removeFavorite(currentWord.id);
                setCurrentWord(prev => prev ? { ...prev, is_favorited: 0 } : null);
                setFavorites(prev => prev.filter(w => w.id !== currentWord.id));
                setStats(prev => ({ ...prev, total_favorites: prev.total_favorites - 1 }));
            } else {
                await readingApi.addFavorite(currentWord.id);
                setCurrentWord(prev => prev ? { ...prev, is_favorited: 1 } : null);
                setFavorites(prev => [currentWord, ...prev]);
                setStats(prev => ({ ...prev, total_favorites: prev.total_favorites + 1 }));
            }
        } catch (err) {
            console.error('Failed to toggle favorite:', err);
        }
    };
    
    const removeFavorite = async (wordId: number) => {
        try {
            await readingApi.removeFavorite(wordId);
            setFavorites(prev => prev.filter(w => w.id !== wordId));
            setStats(prev => ({ ...prev, total_favorites: prev.total_favorites - 1 }));
            if (currentWord?.id === wordId) {
                setCurrentWord(prev => prev ? { ...prev, is_favorited: 0 } : null);
            }
        } catch (err) {
            console.error('Failed to remove favorite:', err);
        }
    };
    
    const highlightTargetWord = (sentence: string, targetWord: string) => {
        const regex = new RegExp(`\\b${targetWord}\\b`, 'gi');
        const parts = sentence.split(regex);
        const matches = sentence.match(regex) || [];
        
        return (
            <span>
                {parts.map((part, index) => (
                    <React.Fragment key={index}>
                        {part}
                        {matches[index] && (
                            <span className="bg-gradient-to-r from-primary/30 to-accent/30 text-white font-bold px-2 py-1 rounded-md border border-primary/50">
                                {matches[index]}
                            </span>
                        )}
                    </React.Fragment>
                ))}
            </span>
        );
    };
    
    const renderWaveform = () => {
        const levels = audioLevels.length > 0 ? audioLevels : Array(30).fill({ value: 0.1, timestamp: 0 });
        
        return (
            <div className="flex items-end justify-center gap-1 h-24 px-4">
                {levels.slice(-30).map((level, index) => (
                    <motion.div
                        key={index}
                        className="w-2 bg-gradient-to-t from-primary to-accent rounded-full"
                        initial={{ height: 4 }}
                        animate={{ 
                            height: Math.max(4, level.value * 100),
                            opacity: isRecording ? 1 : 0.6
                        }}
                        transition={{ duration: 0.1 }}
                    />
                ))}
            </div>
        );
    };
    
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    if (loading && !currentWord) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw size={48} className="text-primary animate-spin mx-auto mb-4" />
                    <p className="text-white text-xl">加载跟读练习中...</p>
                </div>
            </div>
        );
    }
    
    if (error && !currentWord) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <Info size={48} className="text-red-400 mx-auto mb-4" />
                    <p className="text-white text-xl mb-4">加载失败</p>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button onClick={loadData} className="btn-primary inline-flex items-center gap-2">
                        <RefreshCw size={18} />
                        重试
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-slate-900 p-4 md:p-8">
            <header className="max-w-4xl mx-auto mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/')}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                        >
                            <ArrowLeft size={20} className="text-slate-400" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                                跟读练习
                            </h1>
                            <p className="text-slate-400 text-sm">
                                本次已练习: <span className="text-white font-bold">{practicedCount}</span> 句
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="bg-slate-800 rounded-lg px-4 py-2 text-sm">
                            <span className="text-slate-400">今日已练:</span>
                            <span className="text-white font-bold ml-2">{stats.practiced_today}</span>
                        </div>
                        <button
                            onClick={() => setShowFavorites(!showFavorites)}
                            className={`p-2 rounded-lg transition ${
                                showFavorites ? 'bg-primary text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                            }`}
                            title="练习收藏"
                        >
                            <ListTodo size={20} />
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                            title="返回主页"
                        >
                            <Home size={20} className="text-slate-400" />
                        </button>
                    </div>
                </div>
                
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4"
                        >
                            <p className="text-red-400">{error}</p>
                        </motion.div>
                    )}
                </AnimatePresence>
                
                <AnimatePresence>
                    {showFavorites && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="glass-panel rounded-2xl p-4 mb-6 overflow-hidden"
                        >
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <BookOpen size={20} className="text-primary" />
                                练习收藏
                                <span className="text-slate-400 text-sm font-normal">({favorites.length})</span>
                            </h3>
                            {favorites.length > 0 ? (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {favorites.map(word => (
                                        <div 
                                            key={word.id}
                                            className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition cursor-pointer group"
                                        >
                                            <div 
                                                className="flex-1 min-w-0"
                                                onClick={() => loadFavoriteExample(word)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-medium">{word.word}</span>
                                                    <span className="text-slate-500 text-xs">{word.pos}</span>
                                                    <span className="text-slate-500 text-xs">已练{word.practice_count}次</span>
                                                </div>
                                                <p className="text-slate-400 text-sm truncate">{word.example}</p>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeFavorite(word.id); }}
                                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition"
                                                title="移除收藏"
                                            >
                                                <HeartOff size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 text-center py-4">暂无收藏的例句</p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>
            
            <div className="max-w-4xl mx-auto">
                {currentWord && (
                    <motion.div
                        key={currentWord.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="glass-panel p-6 md:p-10 rounded-3xl relative overflow-hidden"
                    >
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                            <button
                                onClick={toggleFavorite}
                                className={`p-2 rounded-lg transition ${
                                    currentWord.is_favorited 
                                        ? 'bg-red-500/20 text-red-400' 
                                        : 'bg-slate-800/50 text-slate-500 hover:text-red-400'
                                }`}
                                title={currentWord.is_favorited ? '取消收藏' : '添加收藏'}
                            >
                                {currentWord.is_favorited ? <Heart size={20} fill="currentColor" /> : <Heart size={20} />}
                            </button>
                            <div className="bg-slate-800/50 rounded-lg px-3 py-1.5 text-xs text-slate-400">
                                已练 {currentWord.practice_count} 次
                            </div>
                        </div>
                        
                        <div className="mb-8">
                            <div className="flex items-baseline gap-4 mb-2">
                                <h2 className="text-5xl font-bold text-white tracking-tight">{currentWord.word}</h2>
                                <span className="text-xl text-slate-400 italic font-serif">{currentWord.pos}</span>
                            </div>
                            <div 
                                className="flex items-center gap-2 text-primary cursor-pointer hover:text-indigo-400 transition"
                                onClick={() => playExample(playbackSpeed)}
                            >
                                <Volume2 size={20} />
                                <span className="text-lg font-mono">{currentWord.pronunciation}</span>
                            </div>
                            <p className="text-xl text-slate-200 font-light mt-3">{currentWord.definition}</p>
                        </div>
                        
                        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-6 md:p-8 rounded-2xl border border-slate-700/50 mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                                    例句
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPlaybackSpeed(1)}
                                        className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                                            playbackSpeed === 1 
                                                ? 'bg-primary text-white' 
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                        }`}
                                    >
                                        常速
                                    </button>
                                    <button
                                        onClick={() => setPlaybackSpeed(0.75)}
                                        className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                                            playbackSpeed === 0.75 
                                                ? 'bg-primary text-white' 
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                        }`}
                                    >
                                        慢速
                                    </button>
                                    <button
                                        onClick={() => playExample(playbackSpeed)}
                                        disabled={isPlaying}
                                        className="p-2 rounded-lg bg-primary hover:bg-primary/80 disabled:bg-slate-700 disabled:cursor-not-allowed transition flex items-center gap-1 text-white"
                                    >
                                        {isPlaying ? <VolumeX size={18} /> : <Play size={18} />}
                                        {isPlaying ? '停止' : '播放'}
                                    </button>
                                </div>
                            </div>
                            <p className="text-2xl text-indigo-200 font-serif leading-relaxed">
                                "{highlightTargetWord(currentWord.example, currentWord.word)}"
                            </p>
                            
                            <div className="mt-4 pt-4 border-t border-slate-700/50">
                                <button
                                    onClick={() => setShowTranslation(!showTranslation)}
                                    className="flex items-center gap-2 text-slate-400 hover:text-slate-300 transition text-sm"
                                >
                                    {showTranslation ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    中文翻译
                                </button>
                                <AnimatePresence>
                                    {showTranslation && (
                                        <motion.p
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="text-slate-300 mt-2 overflow-hidden"
                                        >
                                            （翻译功能需要接入翻译API，此处可扩展）
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                        
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                                    {textMode ? '文字跟读' : '录音跟读'}
                                </h3>
                                {hasMicrophone !== null && (
                                    <button
                                        onClick={() => setTextMode(!textMode)}
                                        className="text-xs text-primary hover:text-indigo-400 transition"
                                    >
                                        {textMode ? '切换到录音模式' : '切换到文字模式'}
                                    </button>
                                )}
                            </div>
                            
                            {textMode ? (
                                <div className="space-y-4">
                                    <textarea
                                        value={textInput}
                                        onChange={(e) => setTextInput(e.target.value)}
                                        placeholder="请在此处输入您朗读的句子..."
                                        className="w-full h-32 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-primary resize-none"
                                    />
                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={submitTextPractice}
                                            disabled={!textInput.trim()}
                                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                                        >
                                            <CheckCircle size={18} />
                                            提交练习
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-slate-800/50 rounded-xl p-4">
                                        <div className="flex items-center justify-center gap-4 mb-4">
                                            {isRecording ? (
                                                <div className="flex items-center gap-3">
                                                    <motion.div
                                                        animate={{ scale: [1, 1.2, 1] }}
                                                        transition={{ repeat: Infinity, duration: 1 }}
                                                        className="w-3 h-3 bg-red-500 rounded-full"
                                                    />
                                                    <span className="text-red-400 font-mono text-xl">
                                                        录音中 {formatDuration(recordingDuration)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">
                                                    {recordedBlob ? '录音完成' : '点击开始录制您的跟读'}
                                                </span>
                                            )}
                                        </div>
                                        {renderWaveform()}
                                        {recordedBlob && !isRecording && (
                                            <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-slate-700/50">
                                                <span className="text-slate-400 text-sm">
                                                    录音时长: {formatDuration(recordingDuration)}
                                                </span>
                                                <button
                                                    onClick={playRecordedAudio}
                                                    className="btn-secondary inline-flex items-center gap-2"
                                                >
                                                    {isPlayingRecorded ? (
                                                        <><Pause size={16} /> 停止回放</>
                                                    ) : (
                                                        <><Play size={16} /> 回放对比</>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex justify-center gap-4">
                                        {!isRecording ? (
                                            <button
                                                onClick={startRecording}
                                                className="btn-primary px-8 py-4 text-lg inline-flex items-center gap-3"
                                            >
                                                <Mic size={24} />
                                                开始录音
                                            </button>
                                        ) : (
                                            <button
                                                onClick={stopRecording}
                                                className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 text-lg rounded-xl font-medium inline-flex items-center gap-3 transition"
                                            >
                                                <StopCircle size={24} />
                                                结束录音
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={() => loadNextExample(false)}
                                className="btn-secondary inline-flex items-center gap-2"
                            >
                                <RefreshCw size={18} />
                                换一句
                            </button>
                            <button
                                onClick={() => loadNextExample(true)}
                                className="btn-primary inline-flex items-center gap-2"
                            >
                                <SkipForward size={18} />
                                下一句
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

const StopCircle: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className={className}
    >
        <circle cx="12" cy="12" r="10" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
);

const CheckCircle: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className={className}
    >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

export default ReadingPracticePage;