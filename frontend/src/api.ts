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

export default api;
