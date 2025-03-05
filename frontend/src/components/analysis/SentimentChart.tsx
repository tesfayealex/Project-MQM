import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface SentimentChartProps {
    positive: number;
    negative: number;
    neutral: number;
}

const COLORS = ['#4CAF50', '#F44336', '#9E9E9E'];

export function SentimentChart({ positive, negative, neutral }: SentimentChartProps) {
    const data = [
        { name: 'Positive', value: positive },
        { name: 'Negative', value: negative },
        { name: 'Neutral', value: neutral }
    ];

    return (
        <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip 
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                    />
                </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-4">
                {data.map((entry, index) => (
                    <div key={entry.name} className="flex items-center">
                        <div 
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: COLORS[index] }}
                        />
                        <span className="text-sm text-gray-600">
                            {entry.name}: {entry.value.toFixed(1)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
} 