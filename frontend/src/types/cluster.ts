export interface CustomWordCluster {
  id: number;
  name: string;
  description?: string;
  keywords?: string[];
  is_active: boolean;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  word_count: number;
  last_processed: string | null;
  associated_words: AssociatedWord[];
  // Multilingual fields
  names?: {[key: string]: string};
  descriptions?: {[key: string]: string};
  multilingual_keywords?: {[key: string]: string[]};
}

export interface AssociatedWord {
  word: string;
  count: number;
}

export interface CreateCustomWordClusterPayload {
  name: string;
  description?: string;
  keywords?: string[];
  is_active?: boolean;
  // Multilingual fields
  names?: {[key: string]: string};
  descriptions?: {[key: string]: string};
  multilingual_keywords?: {[key: string]: string[]};
} 