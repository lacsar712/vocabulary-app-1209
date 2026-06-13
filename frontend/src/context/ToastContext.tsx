import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast';
import { registerErrorHandler } from '../api';

interface ToastContextType {
    showToast: (type: ToastType, message: string, duration?: number) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const registered = useRef(false);

    const showToast = useCallback((type: ToastType, message: string, duration?: number) => {
        const id = `toast-${++toastCounter}-${Date.now()}`;
        setToasts((prev) => [...prev, { id, type, message, duration }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    useEffect(() => {
        if (!registered.current) {
            registered.current = true;
            registerErrorHandler((type, message) => {
                showToast(type, message);
            });
        }
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onClose={removeToast} />
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};
