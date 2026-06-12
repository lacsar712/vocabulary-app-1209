import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Home } from 'lucide-react';

const NoPermissionPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="glass-panel p-8 md:p-12 rounded-3xl text-center max-w-md w-full">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                    <ShieldAlert size={48} className="text-red-400" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-4">无权限访问</h1>
                <p className="text-slate-400 mb-8">
                    抱歉，您没有访问此页面的权限。该页面仅管理员可访问。
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="btn-primary inline-flex items-center gap-2"
                >
                    <Home size={20} />
                    返回主页
                </button>
            </div>
        </div>
    );
};

export default NoPermissionPage;
