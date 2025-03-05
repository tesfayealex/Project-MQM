import React from 'react';
import { WordCluster } from '@/types/analysis';
import { Card } from '@/components/ui/card';
import { BarChart, ChevronUp, ChevronDown } from 'lucide-react';

interface ClusterListProps {
    clusters: WordCluster[];
    title: string;
    showVisualizations?: boolean;
    positiveTheme?: boolean;
    negativeTheme?: boolean;
    neutralTheme?: boolean;
    showCategoryInfo?: boolean;
}

export function ClusterList({ 
    clusters = [], 
    title,
    showVisualizations = false,
    positiveTheme = false,
    negativeTheme = false,
    neutralTheme = false,
    showCategoryInfo = true
}: ClusterListProps) {
    const themeColor = positiveTheme 
        ? "text-green-700 dark:text-green-400" 
        : negativeTheme 
            ? "text-red-700 dark:text-red-400" 
            : neutralTheme 
                ? "text-orange-600 dark:text-orange-400" 
                : "text-gray-700 dark:text-gray-400";

    return (
        <div className="w-full">
            <h3 className={`text-lg font-semibold mb-3 ${themeColor}`}>{title}</h3>
            {showCategoryInfo && (
                <div className="mb-4 text-xs text-gray-500 border-l-2 pl-2">
                    <p>Clusters are categorized based on NPS scores from responses:</p>
                    <ul className="list-disc list-inside mt-1">
                        <li className="text-green-600">Positive: NPS ≥ 9 (Promoters)</li>
                        <li className="text-red-600">Negative: NPS ≤ 6 (Detractors)</li>
                        <li className="text-yellow-600">Neutral: NPS 7-8 (Passives)</li>
                    </ul>
                </div>
            )}
            {clusters.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm border rounded-md">
                    No clusters found
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="grid grid-cols-12 text-xs text-gray-500 font-medium px-3 py-1 bg-gray-50 rounded-t-md">
                        <div className="col-span-5">Cluster Name</div>
                        <div className="col-span-2 text-center">Frequency</div>
                        <div className="col-span-3 text-center">Sentiment</div>
                        <div className="col-span-2 text-center">Category</div>
                    </div>
                    {clusters.map((cluster, index) => (
                        <div 
                            key={cluster.id || index} 
                            className="grid grid-cols-12 border rounded-md px-3 py-2 hover:bg-gray-50 transition-colors"
                        >
                            <div className="col-span-5 font-medium truncate">
                                {index + 1}. {cluster.name}
                            </div>
                            <div className="col-span-2 text-center">
                                {cluster.frequency}
                                {showVisualizations && (
                                    <div className="h-1.5 w-full bg-gray-200 rounded-full mt-1">
                                        <div 
                                            style={{width: `${Math.min(cluster.frequency / 10, 100)}%`}} 
                                            className={`h-full rounded-full ${
                                                cluster.is_positive ? "bg-green-500" : 
                                                cluster.is_negative ? "bg-red-500" : 
                                                "bg-yellow-500"
                                            }`}
                                        ></div>
                                    </div>
                                )}
                            </div>
                            <div className="col-span-3 text-center">
                                <span className={
                                    cluster.sentiment_score > 0 ? "text-green-600" :
                                    cluster.sentiment_score < 0 ? "text-red-600" :
                                    "text-gray-600"
                                }>
                                    {cluster.sentiment_score.toFixed(2)}
                                </span>
                            </div>
                            <div className="col-span-2 text-center">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                    cluster.is_positive ? "bg-green-100 text-green-800" : 
                                    cluster.is_negative ? "bg-red-100 text-red-800" : 
                                    "bg-yellow-100 text-yellow-800"
                                }`}>
                                    {cluster.is_positive ? "Positive" : 
                                    cluster.is_negative ? "Negative" : 
                                    "Neutral"}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
} 