// This is a Server Component
import { SurveyStatsClient } from "./SurveyStatsClient";

export default function SurveyStatsPage({ params }: { params: { id: string } }) {
  // Extract the id in a Server Component, which is safe
  return <SurveyStatsClient surveyId={params.id} />;
} 