import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminApi, type AdminStats } from '../api';
import {
    BookOpen, BarChart3, Clock, Shield, Home, List, Plus, LogOut, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const DIFFICULTY_LABELS: Record<number, string> = {
    1: '基础', 2: '初级', 3: '中级', 4: '中高级', 5: '高级', 6: '专业'
};

const DIFFICULTY_COLORS: Record<number, string> = {
    1: '#10b981', 2: '#22c55e', 3: '#eab308', 4: '#f97316', 5: '#ef4444', 6: '#a855f7'
};

const ACTION_LABELS: Record<string, string> = {
    create: '创建', update: '修改', delete: '删除',
    batch_delete: '批量删除', import: '导入'
};

const AdminDashboard: React.FC = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getStats();
            setStats(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const chartData = stats?.difficulty_distribution.map(d => ({
        name: DIFFICULTY_LABELS[d.difficulty_level] || `等级${d.difficulty_level}`,
        count: d.count,
        level: d.difficulty_level
    })) || [];

    return (
        <div className="min-h-screen bg-slate-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                            <Shield size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-white">词库管理后台</h1>
                            <p className="text-slate-400 text-sm">管理员控制面板</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition text-slate-300 hover:text-white"
                            title="返回学习主页"
                        >
                            <Home size={20} />
                        </button>
                        <button
                            onClick={fetchStats}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition text-slate-300 hover:text-white"
                            title="刷新数据"
                        >
                            <RefreshCw size={20} />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-400 transition"
                            title="退出登录"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <button
                        onClick={() => navigate('/admin/words')}
                        className="glass-panel p-6 rounded-2xl text-left hover:border-primary/50 transition group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition">
                                <BookOpen size={24} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-slate-400 text-sm">词库总量</p>
                                <p className="text-3xl font-bold text-white">
                                    {loading ? '...' : stats?.total_words || 0}
                                </p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/admin/words')}
                        className="glass-panel p-6 rounded-2xl text-left hover:border-secondary/50 transition group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center group-hover:bg-secondary/30 transition">
                                <List size={24} className="text-secondary" />
                            </div>
                            <div>
                                <p className="text-slate-400 text-sm">词条管理</p>
                                <p className="text-lg font-bold text-white mt-1">浏览 / 编辑 →</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/admin/words')}
                        className="glass-panel p-6 rounded-2xl text-left hover:border-emerald-500/50 transition group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/30 transition">
                                <Plus size={24} className="text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-slate-400 text-sm">新增词条</p>
                                <p className="text-lg font-bold text-white mt-1">添加单词 →</p>
                            </div>
                        </div>
                    </button>

                    <div className="glass-panel p-6 rounded-2xl">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                <BarChart3 size={24} className="text-amber-400" />
                            </div>
                            <div>
                                <p className="text-slate-400 text-sm">难度等级</p>
                                <p className="text-lg font-bold text-white mt-1">共 6 个等级</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="glass-panel p-6 rounded-2xl">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <BarChart3 size={20} className="text-secondary" />
                            各难度单词分布
                        </h2>
                        <div className="h-72">
                            {loading ? (
                                <div className="h-full flex items-center justify-center text-slate-500">加载中...</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1e293b',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: '#fff'
                                            }}
                                            formatter={(value: number) => [`${value} 词`, '数量']}
                                        />
                                        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                            {chartData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={DIFFICULTY_COLORS[entry.level] || '#6366f1'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    <div className="glass-panel p-6 rounded-2xl">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Clock size={20} className="text-primary" />
                            最近变更记录
                        </h2>
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                            {loading ? (
                                <div className="h-full flex items-center justify-center text-slate-500 py-12">加载中...</div>
                            ) : stats?.recent_changes && stats.recent_changes.length > 0 ? (
                                stats.recent_changes.map(log => (
                                    <div
                                        key={log.id}
                                        className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition"
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                            log.action === 'create' ? 'bg-emerald-500/20 text-emerald-400' :
                                            log.action === 'update' ? 'bg-primary/20 text-primary' :
                                            log.action === 'delete' || log.action === 'batch_delete' ? 'bg-red-500/20 text-red-400' :
                                            'bg-amber-500/20 text-amber-400'
                                        }`}>
                                            {log.action === 'create' && <Plus size={16} />}
                                            {log.action === 'update' && <RefreshCw size={16} />}
                                            {(log.action === 'delete' || log.action === 'batch_delete') && <List size={16} />}
                                            {log.action === 'import' && <BookOpen size={16} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-medium">
                                                <span className="text-slate-400">{log.admin_username}</span>
                                                {' '}
                                                <span className={`font-bold ${
                                                    log.action === 'create' ? 'text-emerald-400' :
                                                    log.action === 'update' ? 'text-primary' :
                                                    log.action === 'delete' || log.action === 'batch_delete' ? 'text-red-400' :
                                                    'text-amber-400'
                                                }`}>
                                                    {ACTION_LABELS[log.action] || log.action}
                                                </span>
                                                {' '}
                                                {log.target_type === 'word' ? '单词' : log.target_type === 'tag' ? '标签' : log.target_type}
                                            </p>
                                            {log.details && (
                                                <p className="text-slate-400 text-xs mt-1 truncate">
                                                    {typeof log.details === 'string' ? log.details :
                                                        log.details.word ||
                                                        (log.details.count ? `${log.details.count} 个` : '') ||
                                                        (log.details.success_count !== undefined ? `成功 ${log.details.success_count}，失败 ${log.details.error_count}` : '')}
                                                </p>
                                            )}
                                        </div>
                                        <p className="text-slate-500 text-xs shrink-0">
                                            {new Date(log.created_at).toLocaleString('zh-CN', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-slate-500 py-12">暂无变更记录</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
