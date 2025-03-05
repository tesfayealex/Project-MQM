import React from 'react';
import { TagCloud } from 'react-tagcloud';
import { WordCloudItem } from '@/types/analysis';

interface WordCloudChartProps {
    words: WordCloudItem[];
}

export function WordCloudChart({ words = [] }: WordCloudChartProps) {
    // Handle empty words array
    if (!words || words.length === 0) {
        return (
            <div className="w-full h-[400px] flex items-center justify-center">
                <p className="text-gray-500">No words available for cloud visualization</p>
            </div>
        );
    }

    // Convert our words to the format expected by react-tagcloud
    const tagCloudData = words.map(word => ({
        value: word.text,
        count: word.value,
        // Add a color class based on sentiment
        color: word.sentiment > 0.2 
            ? '#4CAF50'  // green for positive
            : word.sentiment < -0.2 
            ? '#F44336'  // red for negative
            : '#9E9E9E', // gray for neutral
    }));

    // Custom renderer with proper typing
    const customRenderer = (tag: any, size: number, color: string) => (
        <span 
            key={tag.value} 
            style={{
                fontSize: `${size}px`,
                color: tag.color,
                margin: '3px',
                padding: '3px',
                display: 'inline-block',
            }}
        >
            {tag.value}
        </span>
    );

    const options = {
        luminosity: 'light' as 'light',
        hue: 'blue',
    };

    return (
        <div className="w-full h-[400px] flex items-center justify-center">
            <TagCloud
                minSize={12}
                maxSize={35}
                tags={tagCloudData}
                colorOptions={options}
                renderer={customRenderer}
            />
        </div>
    );
} 