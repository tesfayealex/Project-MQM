export interface WordCluster {
    id: number;
    survey: number;
    name: string;
    description: string;
    sentiment_score: number;
    frequency: number;
    is_positive: boolean;
    is_negative: boolean;
    is_neutral: boolean;
    nps_score: number | null;
    custom_cluster_id: number | null;
    created_at: string;
    updated_at: string;
    /**
     * Indicates how the cluster is categorized.
     * Clusters are categorized based on NPS scores from associated responses:
     * - Positive: Associated with responses having NPS >= 9 (Promoters)
     * - Negative: Associated with responses having NPS <= 6 (Detractors)
     * - Neutral: Associated with responses having NPS 7-8 (Passives)
     * 
     * If no NPS score is available, categorization is based on sentiment score:
     * - Positive: sentiment > 0.3
     * - Negative: sentiment < -0.3
     * - Neutral: -0.3 <= sentiment <= 0.3
     */
    category?: string;
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
    word?: string;
    frequency?: number;
    sentiment_score?: number;
    name?: string;
    is_positive?: boolean;
    is_negative?: boolean;
    is_neutral?: boolean;
    sentence_text?: string | null;
    sentence_index?: number | null;
    sentence_texts?: string[];
    sentence_indices?: number[];
    sentence_sentiments?: number[];
    nps_score?: number | null;
    sentences?: string[];
    keywords?: string[];
} 