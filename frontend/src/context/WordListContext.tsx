import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';
import type { WordList } from '../api';

interface WordListContextType {
    activeList: WordList | null;
    setActiveList: (list: WordList | null) => void;
    clearActiveList: () => void;
    refreshActiveList: () => Promise<void>;
}

const WordListContext = createContext<WordListContextType | undefined>(undefined);

const STORAGE_KEY = 'active_word_list';

export const WordListProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeList, setActiveListState] = useState<WordList | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setActiveListState(parsed);
            } catch {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }, []);

    const setActiveList = useCallback((list: WordList | null) => {
        setActiveListState(list);
        if (list) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    const clearActiveList = useCallback(() => {
        setActiveListState(null);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    const refreshActiveList = useCallback(async () => {
        if (!activeList) return;
        try {
            const res = await api.get(`/word-lists/${activeList.id}`);
            setActiveListState(res.data);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(res.data));
        } catch (e) {
            console.error(e);
        }
    }, [activeList]);

    return (
        <WordListContext.Provider value={{ activeList, setActiveList, clearActiveList, refreshActiveList }}>
            {children}
        </WordListContext.Provider>
    );
};

export const useWordList = () => {
    const context = useContext(WordListContext);
    if (!context) throw new Error('useWordList must be used within a WordListProvider');
    return context;
};
