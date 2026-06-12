import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    title,
    message,
    confirmText = '确认',
    cancelText = '取消',
    variant = 'danger',
    onConfirm,
    onCancel,
    loading = false
}) => {
    const variantStyles = {
        danger: {
            icon: 'bg-red-500/20 text-red-400',
            button: 'bg-red-500 hover:bg-red-600'
        },
        warning: {
            icon: 'bg-amber-500/20 text-amber-400',
            button: 'bg-amber-500 hover:bg-amber-600'
        },
        info: {
            icon: 'bg-primary/20 text-primary',
            button: 'bg-primary hover:bg-indigo-600'
        }
    };

    const styles = variantStyles[variant];

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={onCancel}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="glass-panel bg-slate-900 p-6 rounded-2xl w-full max-w-md"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={`w-12 h-12 rounded-full ${styles.icon} flex items-center justify-center`}>
                                <AlertTriangle size={24} />
                            </div>
                            <button
                                onClick={onCancel}
                                className="text-slate-400 hover:text-white transition"
                                disabled={loading}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                        <p className="text-slate-400 mb-6">{message}</p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={onCancel}
                                className="btn-secondary"
                                disabled={loading}
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={onConfirm}
                                className={`px-6 py-2 rounded-xl font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${styles.button}`}
                                disabled={loading}
                            >
                                {loading ? '处理中...' : confirmText}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmDialog;
