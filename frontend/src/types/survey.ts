export type QuestionType = 'nps' | 'free_text';

export interface SurveyQuestion {
  id?: string;
  order: number;
  type: 'nps' | 'free_text';
  questions: Record<string, string>;
  language?: string;
  is_required: boolean;
  placeholder?: string;
  placeholders?: Record<string, string>;
}

export interface SurveyToken {
  id: number;
  token: string;
  description: string;
  created_at?: string;
}

export interface Survey {
  id: number;
  title: string;
  description?: string;
  headlines?: Record<string, string>; // Multilingual headlines 
  survey_texts?: Record<string, string>; // Multilingual descriptions
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  // Template Relationship
  template?: number; // FK to Template
  template_detail?: any; // Detailed template information
  questions: SurveyQuestion[];
  languages: string[];
  format?: string;
  type?: string;
  start_datetime?: string;
  expiry_date?: string;
  analysis_cluster?: string;
  
  // Start Survey Information
  start_survey_title?: string;
  start_survey_text?: string;
  start_survey_titles?: Record<string, string>; // Multilingual start titles
  start_survey_texts?: Record<string, string>; // Multilingual start texts
  
  // End Survey Information
  end_survey_title?: string;
  end_survey_text?: string;
  end_survey_titles?: Record<string, string>; // Multilingual end titles
  end_survey_texts?: Record<string, string>; // Multilingual end texts
  expired_survey_title?: string;
  expired_survey_text?: string;
  expired_survey_titles?: Record<string, string>; // Multilingual expired titles
  expired_survey_texts?: Record<string, string>; // Multilingual expired texts
  
  // Project Address
  city?: string;
  country?: string;
  
  // Project Token (legacy)
  token?: string;
  // Project Tokens (new multi-token support)
  tokens?: SurveyToken[];
  // Primary token (convenience property)
  primary_token?: string;
  
  // Stats
  response_count?: number;
  
  // Additional fields
  created_by?: number;
  status?: 'active' | 'expired' | 'inactive' | 'full';
}

export interface SurveyStats {
  total_responses: number;
  responses_by_language: Array<{language: string, count: number}>;
  nps_average: number;
  nps_score: number;
  completion_rate: number;
  promoters: number;
  detractors: number;
  passives: number;
} 