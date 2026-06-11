import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import type { NewAchievement } from '../api';

interface AchievementPopupProps {
    achievements: NewAchievement[];
    onClose: () => void;
}

const AchievementPopup: React.FC<AchievementPopupProps> = ({ achievements, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (achievements.length > 0) {
            setVisible(true);
        }
    }, [achievements]);

    useEffect(() => {
        if (visible && achievements.length > 0) {
            const timer = setTimeout(() => {
                handleNext();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [visible, currentIndex, achievements.length]);

    const handleNext = () => {
        if (currentIndex < achievements.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            handleClose();
        }
    };

    const handleClose = () => {
        setVisible(false);
        setTimeout(() => {
            onClose();
            setCurrentIndex(0);
        }, 300);
    };

    if (achievements.length === 0) return null;

    const currentAchievement = achievements[currentIndex];

    return (
        <AnimatePresence>
            {visible && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
                        onClick={handleClose}
                    />

                    <motion.div
                        key={currentIndex}
                        initial={{ scale: 0.5, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: -50 }}
                        transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                        className="relative z-10 pointer-events-auto"
                    >
                        <div className="relative">
                            <motion.div
                                animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, -10, 0],
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    repeatDelay: 0.5,
                                }}
                                className="absolute -top-8 -left-8 text-4xl"
                            >
                                ✨
                            </motion.div>
                            <motion.div
                                animate={{
                                    scale: [1, 1.3, 1],
                                    rotate: [0, -10, 10, 0],
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    repeatDelay: 0.7,
                                }}
                                className="absolute -top-6 -right-6 text-3xl"
                            >
                                🎉
                            </motion.div>
                            <motion.div
                                animate={{
                                    scale: [1, 1.1, 1],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                }}
                                className="absolute -bottom-4 -left-4 text-2xl"
                            >
                                ⭐
                            </motion.div>
                            <motion.div
                                animate={{
                                    scale: [1, 1.15, 1],
                                }}
                                transition={{
                                    duration: 1.8,
                                    repeat: Infinity,
                                    repeatDelay: 0.3,
                                }}
                                className="absolute -bottom-2 -right-8 text-3xl"
                            >
                                🏆
                            </motion.div>
                        </div>

                        <div className="glass-panel rounded-3xl p-8 text-center max-w-sm mx-4 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-purple-500/10" />
                            
                            <motion.div
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex items-center justify-center gap-2 mb-4"
                            >
                                <Sparkles size={20} className="text-amber-400" />
                                <span className="text-amber-400 font-bold uppercase tracking-wider text-sm">
                                    成就解锁！
                                </span>
                                <Sparkles size={20} className="text-amber-400" />
                            </motion.div>

                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', delay: 0.3, stiffness: 200 }}
                                className="text-7xl mb-4"
                            >
                                {currentAchievement.icon}
                            </motion.div>

                            <motion.h2
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="text-2xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-orange-400"
                            >
                                {currentAchievement.name}
                            </motion.h2>

                            <motion.p
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="text-slate-400 mb-6"
                            >
                                {currentAchievement.description}
                            </motion.p>

                            <motion.button
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.7 }}
                                onClick={handleClose}
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:from-amber-400 hover:to-orange-400 transition shadow-lg shadow-amber-500/30"
                            >
                                太棒了！
                            </motion.button>

                            {achievements.length > 1 && (
                                <div className="flex justify-center gap-2 mt-4">
                                    {achievements.map((_, i) => (
                                        <div
                                            key={i}
                                            className={`w-2 h-2 rounded-full transition-colors ${
                                                i === currentIndex ? 'bg-amber-400' : 'bg-slate-600'
                                            }`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-700/50 text-slate-400 hover:text-white transition z-20"
                        >
                            <X size={20} />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default AchievementPopup;
