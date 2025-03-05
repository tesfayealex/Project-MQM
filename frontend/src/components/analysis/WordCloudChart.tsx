import React from 'react';
import { TagCloud } from 'react-tagcloud';
import { WordCloudItem } from '@/types/analysis';

interface WordCloudChartProps {
    words: WordCloudItem[];
    displayMode?: 'words' | 'clusters';
}

export function WordCloudChart({ words = [], displayMode = 'words' }: WordCloudChartProps) {
    // Handle empty words array
    if (!words || words.length === 0) {
        return (
            <div className="w-full h-[400px] flex items-center justify-center">
                <p className="text-gray-500">No {displayMode} available for cloud visualization</p>
            </div>
        );
    }

    // Convert our words to the format expected by react-tagcloud
    const tagCloudData = words.map(word => {
        // Default coloring for words based on sentiment score
        let color = '#9E9E9E'; // default neutral gray
        
        if (displayMode === 'words') {
            // For words, color based on sentiment
            if (word.sentiment > 0.2) {
                color = '#4CAF50'; // green for positive
            } else if (word.sentiment < -0.2) {
                color = '#F44336'; // red for negative
            }
        } else {
            // For clusters, check explicit categorization flags if available
            if ('is_positive' in word && word.is_positive) {
                color = '#4CAF50'; // green for positive
            } else if ('is_negative' in word && word.is_negative) {
                color = '#F44336'; // red for negative
            } else if ('is_neutral' in word && word.is_neutral) {
                color = '#9E9E9E'; // gray for neutral
            } else {
                // Fall back to sentiment-based coloring if flags are not available
                if (word.sentiment > 0.2) {
                    color = '#4CAF50'; // green for positive
                } else if (word.sentiment < -0.2) {
                    color = '#F44336'; // red for negative
                }
            }
        }
        
        return {
            value: word.text,
            count: word.value,
            color: color,
        };
    });

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