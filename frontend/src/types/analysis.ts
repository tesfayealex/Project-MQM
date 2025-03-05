export interface WordCluster {
    id: number;
    name: string;
    description: string;
    sentiment_score: number;
    frequency: number;
    is_positive: boolean;
    is_negative: boolean;
    is_neutral: boolean;
    created_at: string;
    updated_at: string;
}

export interface ResponseWord {
    id: number;
    word: string;
    original_text: string;
    frequency: number;
    sentiment_score: number;
    language: string;
    clusters: WordCluster[];
    created_at: string;
}

export interface SurveyAnalysisSummary {
    id: number;
    survey: number;
    survey_title: string;
    response_count: number;
    average_satisfaction: number;
    median_satisfaction: number;
    satisfaction_confidence_low: number;
    satisfaction_confidence_high: number;
    satisfaction_score: number;
    language_breakdown: Record<string, number>;
    positive_percentage: number;
    negative_percentage: number;
    neutral_percentage: number;
    top_clusters: number[];
    top_clusters_data: WordCluster[];
    top_positive_clusters: number[];
    top_positive_clusters_data: WordCluster[];
    top_negative_clusters: number[];
    top_negative_clusters_data: WordCluster[];
    top_neutral_clusters: number[];
    top_neutral_clusters_data: WordCluster[];
    sentiment_divergence: number;
    last_updated: string;
}

export interface WordCloudItem {
    text: string;
    value: number;
    sentiment: number;
} 