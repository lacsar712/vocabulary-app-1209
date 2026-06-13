import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api, { registerLogoutHandler } from '../api';

interface User {
    id: number;
    username: string;
    vocab_size: number;
    role?: string;
}

interface AuthContextType {
    user: User | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
    isAdmin: boolean;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const registered = useRef(false);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
    }, []);

    useEffect(() => {
        if (!registered.current) {
            registered.current = true;
            registerLogoutHandler(() => {
                logout();
            });
        }
    }, [logout]);

    useEffect(() => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
            api.get('/me').then(res => {
                setUser(res.data);
            }).catch(() => {
                localStorage.removeItem(TOKEN_KEY);
            }).finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = (token: string, user: User) => {
        localStorage.setItem(TOKEN_KEY, token);
        setUser(user);
    };

    const refreshUser = async () => {
        try {
            const res = await api.get('/me');
            setUser(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    const isAdmin = user?.role === 'admin';

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-background text-primary">Loading...</div>;

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isAdmin, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
