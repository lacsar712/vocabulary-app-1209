import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    order: number;
    unlocked: boolean;
    unlocked_at: string | null;
    is_read: number;
}

export interface NewAchievement {
    id: number;
    achievement_id: string;
    user_id: number;
    unlocked_at: string;
    is_read: number;
    name: string;
    description: string;
    icon: string;
}

export interface Word {
    id: number;
    word: string;
    pronunciation: string;
    pos: string;
    definition: string;
    example: string;
    rank: number;
    frequency: number;
    difficulty_level: number;
    learn_status?: string | null;
    learned_at?: string | null;
}

export interface WordList {
    id: number;
    user_id: number;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
    word_count: number;
    learned_count: number;
}

export interface WordListFormData {
    name: string;
    description: string;
}

export interface ReadingWord {
    id: number;
    word: string;
    pronunciation: string;
    pos: string;
    definition: string;
    example: string;
    rank: number;
    frequency: number;
    difficulty_level: number;
    is_favorited: number;
    practice_count: number;
}

export interface ReadingStats {
    practiced_today: number;
    total_practices: number;
    total_favorites: number;
}

export const readingApi = {
    getRandomExample: (wordListId?: number, excludeWordId?: number) =>
        api.get<ReadingWord>('/reading/random', { 
            params: { 
                word_list_id: wordListId, 
                exclude_word_id: excludeWordId 
            } 
        }),
    
    getWordExample: (wordId: number) =>
        api.get<ReadingWord>(`/reading/word/${wordId}`),
    
    recordPractice: (wordId: number) =>
        api.post<{ success: boolean; practice_count: number }>('/reading/record', { word_id: wordId }),
    
    getFavorites: () =>
        api.get<ReadingWord[]>('/reading/favorites'),
    
    addFavorite: (wordId: number) =>
        api.post<{ success: boolean; is_favorited: number; message: string }>(`/reading/favorites/${wordId}`),
    
    removeFavorite: (wordId: number) =>
        api.delete<{ success: boolean; is_favorited: number; message: string }>(`/reading/favorites/${wordId}`),
    
    getStats: () =>
        api.get<ReadingStats>('/reading/stats'),
};

export type QuestionType = 'word_choice' | 'definition_fill' | 'audio_recognition';

export interface ChallengeWord {
    id: number;
    word: string;
    pronunciation: string;
    pos: string;
    definition: string;
    example: string;
    rank: number;
    difficulty_level: number;
}

export interface ChallengeQuestion {
    id: number;
    index: number;
    type: QuestionType;
    word: ChallengeWord;
    options: string[] | null;
    correct_answer?: string;
}

export interface ChallengeAnswer {
    question_index: number;
    question_type: QuestionType;
    word_id: number;
    word: string;
    definition: string;
    user_answer: string;
    correct_answer: string;
    is_correct: boolean;
}

export interface ChallengeSubmission {
    score: number;
    total_questions: number;
    time_spent: number;
    answers: ChallengeAnswer[];
    submitted_at?: string;
}

export interface DailyChallengeResponse {
    status: 'available' | 'completed';
    questions: ChallengeQuestion[];
    submission?: ChallengeSubmission;
}

export interface DailyChallengeStats {
    date: string;
    completed_count: number;
    avg_score: number;
    avg_time: number;
}

export const dailyChallengeApi = {
    getChallenge: () =>
        api.get<DailyChallengeResponse>('/daily-challenge'),
    
    submitChallenge: (answers: string[], timeSpent: number) =>
        api.post<ChallengeSubmission>('/daily-challenge/submit', { answers, time_spent: timeSpent }),
    
    getStats: () =>
        api.get<DailyChallengeStats>('/daily-challenge/stats'),
};

export default api;
