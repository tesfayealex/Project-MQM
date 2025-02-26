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

export interface Survey {
  id: string;
  title: string;
  description?: string;
  headlines?: Record<string, string>; // Multilingual headlines 
  survey_texts?: Record<string, string>; // Multilingual descriptions
  created_at: string;
  updated_at: string;
  is_active: boolean;
  questions: SurveyQuestion[];
  languages: string[];
  format: 'online' | 'face_to_face';
  type: 'friends_family' | 'public' | 'professional' | 'single_company' | 'intracompany';
  max_participants?: number;
  end_date?: string;
  analysis_end_date?: string;
  analysis_cluster?: 'Standard' | 'CoreNet Event' | 'Event & Conference' | 'HomeOffice';
  
  // End Survey Information
  end_survey_title?: string;
  end_survey_text?: string;
  end_survey_titles?: Record<string, string>; // Multilingual end titles
  end_survey_texts?: Record<string, string>; // Multilingual end texts
  expired_survey_title?: string;
  expired_survey_text?: string;
  expired_survey_titles?: Record<string, string>; // Multilingual expired titles
  expired_survey_texts?: Record<string, string>; // Multilingual expired texts
  
  // Project Information
  building_name?: string;
  project_name?: string;
  project_description?: string;
  
  // Project Address
  street?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  
  // Project Token
  token?: string;
  
  // Stats
  response_count?: number;
  
  // Additional fields
  expiry_date?: string | Date;
}

export interface SurveyStats {
  response_count: number;
  nps_score?: number;
  response_by_language: Record<string, number>;
  question_stats: Array<{
    question_id: string;
    question_text: string;
    avg_rating?: number; // For NPS questions
    responses?: number;
  }>;
} 