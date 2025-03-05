import React from 'react';
import { WordCluster } from '@/types/analysis';
import { Card } from '@/components/ui/card';

interface ClusterListProps {
    clusters: WordCluster[];
    title: string;
}

export function ClusterList({ clusters = [], title }: ClusterListProps) {
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            {clusters && clusters.length > 0 ? (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                    {clusters.map(cluster => (
                        <Card key={cluster.id} className="p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium">{cluster.name}</h4>
                                    <p className="text-sm text-gray-600">{cluster.description}</p>
                                </div>
                                <div className="text-right">
                                    <div className={`text-sm font-medium ${
                                        cluster.sentiment_score > 0 ? 'text-green-600' :
                                        cluster.sentiment_score < 0 ? 'text-red-600' :
                                        'text-gray-600'
                                    }`}>
                                        {cluster.sentiment_score.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {cluster.frequency} mentions
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <p className="text-gray-500">No {title.toLowerCase()} available</p>
            )}
        </div>
    );
} 