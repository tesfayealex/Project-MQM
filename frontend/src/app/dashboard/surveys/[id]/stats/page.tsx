// This is a Server Component
import { SurveyStatsClient } from "./SurveyStatsClient";

// Simplified approach - no server-side access to params
export default function SurveyStatsPage() {
  // The client component will automatically get the ID from the route using useParams
  return <SurveyStatsClient />;
} 