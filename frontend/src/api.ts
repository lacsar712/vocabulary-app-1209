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

// ==================== Etymology Types ====================

export interface EtymologyComponent {
    part: string;
    meaning: string;
    origin: string;
}

export interface EtymologyRoot {
    id: number;
    root: string;
    meaning: string;
    language: string;
    example_count: number;
    created_at: string;
}

export interface EtymologyEntry {
    id: number;
    word_id: number;
    word: string;
    language_origin: string;
    root_meaning: string;
    components: EtymologyComponent[];
    explanation: string;
    related_words: string[];
    word_cloud: string[];
    difficulty_level: number;
    created_at: string;
    is_favorited: number;
    pronunciation?: string;
    pos?: string;
    definition?: string;
    example?: string;
    rank?: number;
    frequency?: number;
    favorited_at?: string;
}

export interface EtymologyListResponse {
    total: number;
    limit: number;
    offset: number;
    data: EtymologyEntry[];
}

export interface EtymologyWordCheckResponse {
    has_etymology: boolean;
    message?: string;
    recommendations?: EtymologyEntry[];
    id?: number;
    word_id?: number;
    word?: string;
    language_origin?: string;
    root_meaning?: string;
    components?: EtymologyComponent[];
    explanation?: string;
    related_words?: string[];
    word_cloud?: string[];
    difficulty_level?: number;
    is_favorited?: number;
    pronunciation?: string;
    pos?: string;
    definition?: string;
}

export interface EtymologyStats {
    total_entries: number;
    total_roots: number;
    favorite_count: number;
    learned_with_etymology: number;
}

export interface EtymologyRootEntriesResponse {
    root: string;
    total: number;
    data: EtymologyEntry[];
}

export interface EtymologyFavoritesResponse {
    total: number;
    data: EtymologyEntry[];
}

export const etymologyApi = {
    getEtymologyList: (params?: {
        q?: string;
        difficulty?: string;
        root?: string;
        limit?: number;
        offset?: number;
        sort_by?: 'difficulty' | 'alpha' | 'newest';
    }) =>
        api.get<EtymologyListResponse>('/etymology', { params }),
    
    getEtymologyDetail: (id: number) =>
        api.get<EtymologyEntry>(`/etymology/${id}`),
    
    getEtymologyByWordId: (wordId: number) =>
        api.get<EtymologyWordCheckResponse>(`/etymology/word/${wordId}`),
    
    getRoots: (params?: { language?: string; limit?: number }) =>
        api.get<EtymologyRoot[]>('/etymology/roots/list', { params }),
    
    getRootEntries: (root: string, params?: { limit?: number; offset?: number }) =>
        api.get<EtymologyRootEntriesResponse>(`/etymology/roots/${encodeURIComponent(root)}`, { params }),
    
    getFavorites: (params?: { limit?: number; offset?: number }) =>
        api.get<EtymologyFavoritesResponse>('/etymology/favorites/list', { params }),
    
    addFavorite: (id: number) =>
        api.post<{ success: boolean; is_favorited: number; message: string }>(`/etymology/favorites/${id}`),
    
    removeFavorite: (id: number) =>
        api.delete<{ success: boolean; is_favorited: number; message: string }>(`/etymology/favorites/${id}`),
    
    getStats: () =>
        api.get<EtymologyStats>('/etymology/stats/summary'),
};

export interface CrosswordClue {
    row: number;
    col: number;
    direction: 'across' | 'down';
    clue: string;
    word_length: number;
    word_id: number | null;
}

export interface CrosswordSubmission {
    time_spent: number;
    hints_used: number;
    is_correct: number;
}

export interface CrosswordResponse {
    date: string;
    grid: (string | null)[][];
    clues_across: CrosswordClue[];
    clues_down: CrosswordClue[];
    submission: CrosswordSubmission | null;
}

export interface CrosswordCellResult {
    expected: string;
    actual: string;
    correct: boolean;
    empty: boolean;
}

export interface CrosswordSubmitResponse {
    is_correct: boolean;
    cell_results: CrosswordCellResult[][];
    time_spent: number;
    hints_used: number;
}

export interface CrosswordBestScore {
    best_time: number | null;
    best_hints: number | null;
    best_date: string | null;
}

export interface CrosswordHintCell {
    hint: string | null;
}

export interface CrosswordHintClue {
    hint: {
        word: string;
        clue: string;
        direction: string;
        row: number;
        col: number;
    } | null;
}

export const crosswordApi = {
    getPuzzle: () =>
        api.get<CrosswordResponse>('/crossword'),

    submitPuzzle: (answers: string[][], timeSpent: number, hintsUsed: number) =>
        api.post<CrosswordSubmitResponse>('/crossword/submit', {
            answers,
            time_spent: timeSpent,
            hints_used: hintsUsed
        }),

    getBestScore: () =>
        api.get<CrosswordBestScore>('/crossword/best'),

    getHint: (type: 'cell' | 'clue', row?: number, col?: number) =>
        api.get<CrosswordHintCell | CrosswordHintClue>('/crossword/hint', {
            params: { type, row, col }
        }),
};

// ==================== Admin Types ====================

export interface AdminWord {
    id: number;
    word: string;
    pronunciation: string;
    pos: string;
    definition: string;
    example: string;
    rank: number | null;
    frequency: number;
    difficulty_level: number;
    tags: string;
    updated_at: string;
}

export interface AdminWordListResponse {
    total: number;
    limit: number;
    offset: number;
    data: AdminWord[];
}

export interface AdminWordFormData {
    word: string;
    pronunciation?: string;
    pos?: string;
    definition: string;
    example?: string;
    rank?: number | null;
    frequency?: number;
    difficulty_level?: number;
    tags?: string;
}

export interface AdminTag {
    id: number;
    tag: string;
    created_at: string;
}

export interface AdminAuditLog {
    id: number;
    admin_id: number;
    admin_username: string;
    action: string;
    target_type: string;
    target_id: number | null;
    details: Record<string, unknown> | null;
    created_at: string;
}

export interface AdminAuditLogResponse {
    total: number;
    limit: number;
    offset: number;
    data: AdminAuditLog[];
}

export interface AdminStats {
    total_words: number;
    difficulty_distribution: { difficulty_level: number; count: number }[];
    recent_changes: AdminAuditLog[];
}

export interface AdminCsvImportResult {
    success: boolean;
    success_count: number;
    error_count: number;
    errors: string[];
}

export const adminApi = {
    checkAdmin: () =>
        api.get<{ is_admin: boolean; user: { id: number; username: string; role: string } }>('/admin/check'),

    getStats: () =>
        api.get<AdminStats>('/admin/stats'),

    getAuditLog: (params?: { limit?: number; offset?: number; action?: string }) =>
        api.get<AdminAuditLogResponse>('/admin/audit-log', { params }),

    getTags: () =>
        api.get<AdminTag[]>('/admin/tags'),

    createTag: (tag: string) =>
        api.post<AdminTag>('/admin/tags', { tag }),

    deleteTag: (id: number) =>
        api.delete<{ success: boolean }>(`/admin/tags/${id}`),

    getWords: (params?: {
        q?: string;
        difficulty?: string;
        tag?: string;
        limit?: number;
        offset?: number;
        sort_by?: 'id' | 'word' | 'difficulty_level' | 'frequency' | 'rank' | 'updated_at';
        sort_order?: 'asc' | 'desc';
    }) =>
        api.get<AdminWordListResponse>('/admin/words', { params }),

    getWord: (id: number) =>
        api.get<AdminWord>(`/admin/words/${id}`),

    createWord: (data: AdminWordFormData) =>
        api.post<AdminWord>('/admin/words', data),

    updateWord: (id: number, data: AdminWordFormData) =>
        api.put<AdminWord>(`/admin/words/${id}`, data),

    deleteWord: (id: number) =>
        api.delete<{ success: boolean }>(`/admin/words/${id}`),

    batchDeleteWords: (ids: number[]) =>
        api.post<{ success: boolean; deleted_count: number }>('/admin/words/batch-delete', { ids }),

    exportCsv: (params?: { difficulty?: string; tag?: string; q?: string }) => {
        const query = new URLSearchParams();
        if (params?.difficulty) query.append('difficulty', params.difficulty);
        if (params?.tag) query.append('tag', params.tag);
        if (params?.q) query.append('q', params.q);
        return api.get(`/admin/words/export/csv?${query.toString()}`, {
            responseType: 'blob'
        });
    },

    importCsv: (content: string) =>
        api.post<AdminCsvImportResult>('/admin/words/import/csv', { content }),
};

export default api;
