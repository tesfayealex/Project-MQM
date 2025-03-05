import { Metadata } from 'next';
import SurveyAnalysisClient from './survey-analysis-client';

export const metadata: Metadata = {
  title: 'Survey Analysis',
  description: 'Analyze survey responses, sentiment, and word patterns',
};

export default function AnalysisPage({ params }: { params: { id: string } }) {
  // We don't need to await params.id - it's already available in the server component
  return <SurveyAnalysisClient surveyId={params.id} />;
} 