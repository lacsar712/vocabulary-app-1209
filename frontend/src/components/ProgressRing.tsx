import React from 'react';

interface ProgressRingProps {
    progress: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
    bgColor?: string;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
    progress,
    size = 48,
    strokeWidth = 4,
    color = '#8b5cf6',
    bgColor = '#334155'
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={bgColor}
                strokeWidth={strokeWidth}
                fill="none"
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-500"
            />
            <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="central"
                className="transform rotate-90 origin-center"
                style={{ fill: '#f8fafc', fontSize: size * 0.25, fontWeight: 'bold' }}
            >
                {Math.round(progress)}%
            </text>
        </svg>
    );
};

export default ProgressRing;
