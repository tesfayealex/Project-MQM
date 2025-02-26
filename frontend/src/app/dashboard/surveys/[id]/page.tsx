import { Metadata } from "next"
import SurveyDetail from './survey-detail'

export const metadata: Metadata = {
  title: 'Survey Details | myQuickMessage',
  description: 'View and manage your survey details',
}

export default function SurveyDetailPage({ params }: { params: { id: string } }) {
  return <SurveyDetail params={params} />
} 