import { CustomWordCluster } from './cluster';
import { SurveyQuestion } from "./survey";

export interface Template {
  id: number;
  title: string;
  description?: string;
  questions: SurveyQuestion[];
  languages: string[];
  format?: string;
  type?: string;
  analysis_cluster?: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  
  // Multilingual headlines 
  headlines?: Record<string, string>;
  
  // Multilingual descriptions
  survey_texts?: Record<string, string>;
  
  // Start Survey Information
  start_survey_titles?: Record<string, string>; // Multilingual start titles
  start_survey_texts?: Record<string, string>; // Multilingual start texts
  
  // End Survey Information
  end_survey_titles?: Record<string, string>; // Multilingual end titles
  end_survey_texts?: Record<string, string>; // Multilingual end texts
  expired_survey_titles?: Record<string, string>; // Multilingual expired titles
  expired_survey_texts?: Record<string, string>; // Multilingual expired texts
  
  // Clusters
  clusters: CustomWordCluster[];
} 