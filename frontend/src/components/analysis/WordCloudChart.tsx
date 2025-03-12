import React, { useState, useEffect } from 'react';
import { TagCloud } from 'react-tagcloud';
import { WordCloudItem } from '@/types/analysis';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// Custom CSS for the word cloud
const wordCloudStyles = `
.compact-cloud {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.25rem;
  max-width: 100%;
  line-height: 1 !important;
}

.compact-cloud span {
  display: inline-block;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.compact-cloud span:hover {
  transform: scale(1.1);
  filter: brightness(1.1);
  z-index: 10;
}
`;

interface WordCloudChartProps {
    words: WordCloudItem[];
    displayMode?: 'words' | 'clusters';
    colorBy?: 'sentiment' | 'nps';
    onColorByChange?: (colorBy: 'sentiment' | 'nps') => void;
}

// Define CSS for our horizontal cloud layout
const customStyles = `
.horizontal-cloud {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.5rem; /* Increased gap between words for better spacing */
  padding: 1.5rem;
  width: 100%;
  margin: 0 auto;
  line-height: 1.3 !important;
  overflow: hidden; /* Ensure content stays within bounds */
  max-height: 100%;
  min-height: 400px;
}

.horizontal-cloud span {
  display: inline-block;
  transition: transform 0.3s ease, filter 0.3s ease;
  font-weight: bold;
  padding: 5px; /* Increased padding */
  margin: 3px; /* Added margin */
  cursor: pointer;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.05);
}

.horizontal-cloud span:hover {
  transform: scale(1.2);
  filter: brightness(1.1);
  z-index: 10;
  background-color: rgba(255, 255, 255, 0.1);
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

.word-item {
  animation: fadeIn 0.5s ease forwards;
  animation-delay: calc(var(--index) * 0.02s); /* Slightly faster animation */
  opacity: 0;
  border-radius: 4px;
}

.word-item:hover {
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  background-color: rgba(0,0,0,0.02);
}
`;

// Define position templates for the word cloud
const positions = [
    { x: 50, y: 50, z: 10 }, // Center
    { x: 30, y: 40, z: 9 },  // Mid left
    { x: 70, y: 40, z: 9 },  // Mid right 
    { x: 40, y: 30, z: 8 },  // Upper left mid
    { x: 60, y: 30, z: 8 },  // Upper right mid
    { x: 25, y: 60, z: 8 },  // Lower left mid
    { x: 75, y: 60, z: 8 },  // Lower right mid
    { x: 35, y: 70, z: 7 },  // Lower left
    { x: 65, y: 70, z: 7 },  // Lower right
    { x: 20, y: 40, z: 7 },  // Left
    { x: 80, y: 40, z: 7 },  // Right
    { x: 40, y: 20, z: 7 },  // Upper left
    { x: 60, y: 20, z: 7 },  // Upper right
    { x: 30, y: 80, z: 6 },  // Bottom left
    { x: 70, y: 80, z: 6 },  // Bottom right
    { x: 20, y: 20, z: 6 },  // Top left
    { x: 80, y: 20, z: 6 },  // Top right
    // Add more positions as needed for larger clouds
];

export function WordCloudChart({
    words = [],
    displayMode = 'words',
    colorBy = 'sentiment',
    onColorByChange
}: WordCloudChartProps) {
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [internalColorBy, setInternalColorBy] = useState(colorBy);
    
    // Sync internal state with prop
    useEffect(() => {
        setInternalColorBy(colorBy);
    }, [colorBy]);
    
    // Handle color change
    const handleColorChange = (newColorBy: 'sentiment' | 'nps') => {
        setInternalColorBy(newColorBy);
        if (onColorByChange) {
            onColorByChange(newColorBy);
        }
    };

    // Handle empty words array
    if (!words || words.length === 0) {
        return (
            <div className="w-full h-[350px] flex items-center justify-center">
                <p className="text-gray-500">No {displayMode} available for cloud visualization</p>
            </div>
        );
    }

    // Find the sentences for a given word
    const getSentencesForWord = (wordText: string): string[] => {
        const wordItem = words.find(w => w.text === wordText);
        
        // Check if the word has the new sentence_texts array
        if (wordItem?.sentence_texts && wordItem.sentence_texts.length > 0) {
            return wordItem.sentence_texts;
        }
        
        // Fall back to legacy sentence_text if available
        if (wordItem?.sentence_text) {
            return [wordItem.sentence_text];
        }
        
        // Fall back to sentences array for clusters
        if (wordItem?.sentences && wordItem.sentences.length > 0) {
            return wordItem.sentences;
        }
        
        return ['No sentence information available'];
    };
    
    // Get average sentiment for sentences containing this word
    const getAverageSentiment = (wordItem: WordCloudItem): number => {
        // If we have sentence_sentiments array, calculate the average
        if (wordItem.sentence_sentiments && wordItem.sentence_sentiments.length > 0) {
            const sum = wordItem.sentence_sentiments.reduce((a, b) => a + b, 0);
            return sum / wordItem.sentence_sentiments.length;
        }
        
        // Fall back to the word's sentiment
        return wordItem.sentiment;
    };
    
    // Get the color for a word based on sentiment or NPS
    const getWordColor = (word: WordCloudItem) => {
        if (displayMode === 'clusters') {
            // For clusters, explicitly check categorization flags
            if ('is_positive' in word && word.is_positive) {
                return '#22C55E'; // bright green for positive clusters
            } else if ('is_negative' in word && word.is_negative) {
                return '#EF4444'; // bright red for negative clusters
            } else if ('is_neutral' in word && word.is_neutral) {
                return '#F59E0B'; // amber for neutral clusters - more visible than gray
            }
            
            // If no flags but we have a sentiment score, use that
            if (word.sentiment_score !== undefined) {
                if (word.sentiment_score > 0.1) return '#22C55E';
                if (word.sentiment_score < -0.1) return '#EF4444';
                return '#F59E0B';
            }
        }
        
        if (internalColorBy === 'nps') {
            // Only use NPS if available and valid
            if (word.nps_score !== undefined && word.nps_score !== null) {
                if (word.nps_score >= 9) return '#22C55E'; // bright green for promoters
                if (word.nps_score <= 6) return '#EF4444'; // bright red for detractors
                return '#F59E0B'; // amber for passives (7-8)
            }
            
            // Fallback to sentiment if NPS not available
            const avgSentiment = getAverageSentiment(word);
            if (avgSentiment > 0.1) return '#22C55E';
            if (avgSentiment < -0.1) return '#EF4444';
            return '#F59E0B';
        }
        
        // Sentiment-based coloring with more visible colors
        const avgSentiment = getAverageSentiment(word);
        if (avgSentiment > 0.1) {
            return '#22C55E'; // bright green for positive
        } else if (avgSentiment < -0.1) {
            return '#EF4444'; // bright red for negative
        }
        return '#F59E0B'; // amber for neutral - more visible than gray
    };

    // Convert our words to the format expected by react-tagcloud
    const tagCloudData = words.map(word => {
        // Get appropriate color based on mode and word data
        const color = getWordColor(word);
        
        return {
            value: word.text,
            count: word.value,
            color: color,
            original: word, // Keep the original word data for reference
        };
    });

    // Force re-render when colorBy changes
    // Adding a key with the colorBy value ensures the TagCloud is re-rendered
    // when the colorBy value changes
    const cloudKey = `word-cloud-${internalColorBy}-${displayMode}`;

    // Custom renderer with proper typing and tooltip for sentence display
    const customRenderer = (tag: any, size: number, color: string, index: number) => {
        const wordText = tag.value || '';
        const sentences = getSentencesForWord(wordText);
        const uniqueKey = `word-${wordText}-${Math.random().toString(36).substring(2, 9)}`;
        
        // Use a larger size multiplier to make words bigger
        const adjustedSize = Math.max(16, size * 1.5);
        
        return (
            <TooltipProvider key={uniqueKey}>
                <Tooltip>
                    <TooltipTrigger asChild>
        <span 
                            className="word-item"
            style={{
                                fontSize: `${adjustedSize}px`,
                                color: tag.color, // Use the color from the tag
                                margin: '1px', // Reduced margin
                                padding: '1px', // Reduced padding
                display: 'inline-block',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                textShadow: '1px 1px 1px rgba(0,0,0,0.05)',
                                lineHeight: '1',
                                '--index': index,
                            } as React.CSSProperties}
                            onClick={() => setSelectedWord(wordText)}
                        >
                            {wordText || '(unknown)'}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent className="w-80 p-3 max-w-xs">
                        <div className="space-y-2">
                            <h4 className="font-medium">"{wordText}"</h4>
                            
                            {sentences.length > 0 && sentences[0] !== 'No sentence information available' && (
                                <div className="text-sm text-gray-700 mt-1">
                                    <p className="font-medium mb-1">Found in {sentences.length > 1 ? `${sentences.length} sentences` : 'sentence'}:</p>
                                    <div className="max-h-48 overflow-auto">
                                        {sentences.map((sentence, idx) => (
                                            <p key={idx} className="italic text-gray-600 bg-gray-50 p-2 rounded border text-xs mb-1">
                                                "{sentence}"
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {sentences[0] === 'No sentence information available' && (
                                <div className="text-sm text-gray-700 mt-1">
                                    <p className="font-medium mb-1">Found in sentence:</p>
                                    <p className="italic text-gray-600 bg-gray-50 p-2 rounded border text-xs">
                                        No sentence information provided
                                    </p>
                                </div>
                            )}
                            
                            {/* Display keywords for clusters */}
                            {displayMode === 'clusters' && tag.original?.keywords && tag.original.keywords.length > 0 && (
                                <div className="text-sm text-gray-700 mt-2">
                                    <p className="font-medium mb-1">Keywords:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {tag.original.keywords.map((keyword: string, index: number) => (
                                            <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                                {keyword}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {tag.original && (
                                <div className="flex justify-between text-xs mt-2">
                                    <div className="bg-gray-50 p-1 rounded">
                                        <span className="font-medium">Sentiment:</span>{' '}
                                        <span className={getAverageSentiment(tag.original) > 0 ? 'text-green-600' : getAverageSentiment(tag.original) < 0 ? 'text-red-600' : 'text-gray-600'}>
                                            {getAverageSentiment(tag.original).toFixed(2)}
                                        </span>
                                    </div>
                                    {tag.original.nps_score !== undefined && tag.original.nps_score !== null && (
                                        <div className="bg-gray-50 p-1 rounded ml-2">
                                            <span className="font-medium">NPS:</span>{' '}
                                            <span className={tag.original.nps_score >= 9 ? 'text-green-600' : tag.original.nps_score <= 6 ? 'text-red-600' : 'text-yellow-600'}>
                                                {tag.original.nps_score}
        </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    // Type assertion to fix the renderer parameter mismatch
    // react-tagcloud expects (tag, size, color) => JSX.Element but our function uses (tag, size, color, index)
    const rendererWithTypeAssertion = customRenderer as (tag: any, size: number, color: string) => React.JSX.Element;

    // Enhanced cloud options for a more compact and visually appealing layout
    const cloudOptions = {
        luminosity: 'light' as 'light',
        hue: 'blue',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        spiral: 'rectangular',
        deterministic: false, // Set to false for random word positioning
        randomRotation: false
    };

    return (
        <div className="w-full h-full">
            <style jsx global>{customStyles}</style>
            
            <div className="space-y-4">
                {onColorByChange && (
                    <div className="flex justify-end mb-2">
                        <div className="flex items-center space-x-4 text-sm">
                            <label className="flex items-center space-x-1 cursor-pointer">
                                <input 
                                    type="radio" 
                                    checked={internalColorBy === 'sentiment'} 
                                    onChange={() => handleColorChange('sentiment')} 
                                    className="h-3.5 w-3.5" 
                                />
                                <span>Color by Sentiment</span>
                            </label>
                            <label className="flex items-center space-x-1 cursor-pointer">
                                <input 
                                    type="radio" 
                                    checked={internalColorBy === 'nps'} 
                                    onChange={() => handleColorChange('nps')} 
                                    className="h-3.5 w-3.5" 
                                />
                                <span>Color by NPS</span>
                            </label>
                        </div>
                    </div>
                )}
                
                <div className="border rounded-md p-4 bg-white dark:bg-gray-950 min-h-[400px] h-auto relative">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="h-full overflow-auto py-4 px-2">
                            <TagCloud
                                key={cloudKey} // Add key to force re-render when colorBy changes
                                minSize={18}  
                                maxSize={48}  // Adjusted max size for words
                                tags={tagCloudData}
                                colorOptions={cloudOptions}
                                renderer={rendererWithTypeAssertion}
                                className="horizontal-cloud"
                                shuffle={true} // Enable shuffling for random positioning
                            />
                        </div>
                    </div>
                </div>
                
                {/* Add color legend to make it clearer what the colors mean */}
                <div className="text-xs text-gray-500 mt-4 mb-2">
                    {internalColorBy === 'nps' ? (
                        <div className="flex items-center gap-4 justify-center">
                            <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-[#EF4444] mr-1"></div>
                                Detractors (0-6)
                            </div>
                            <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-[#F59E0B] mr-1"></div>
                                Passives (7-8)
                            </div>
                            <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-[#22C55E] mr-1"></div>
                                Promoters (9-10)
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4 justify-center">
                            <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-[#EF4444] mr-1"></div>
                                Negative
                            </div>
                            <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-[#F59E0B] mr-1"></div>
                                Neutral
                            </div>
                            <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-[#22C55E] mr-1"></div>
                                Positive
                            </div>
                        </div>
                    )}
                </div>
                
                {selectedWord && (
                    <div className="mt-6 border rounded-md p-4 bg-white dark:bg-gray-950">
                        <h3 className="text-lg font-semibold mb-3">"{selectedWord}"</h3>
                        <div className="max-h-[250px] overflow-y-auto">
                            {getSentencesForWord(selectedWord).length > 0 && getSentencesForWord(selectedWord)[0] !== 'No sentence information available' ? (
                                <ul className="list-disc pl-5 space-y-3">
                                    {getSentencesForWord(selectedWord).map((sentence, i) => (
                                        <li key={i} className="text-sm">{sentence}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500">No example sentences available</p>
                            )}
                        </div>
                    </div>
                )}
                
            </div>
        </div>
    );
} 