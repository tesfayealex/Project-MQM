import { Metadata } from "next"
import SurveyDetail from './survey-detail'
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Survey Detail',
  description: 'View and manage survey details',
}

export default async function SurveyDetailPage({ params }: { params: { id: string } }) {
  // Use async/await with the params to satisfy Next.js requirements
  const id = await Promise.resolve(params.id);
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Survey Details</h1>
        <div className="space-x-4">
          <Button asChild variant="outline">
            <Link href={`/dashboard/surveys/${id}/analysis`}>
              View Analysis
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dashboard/surveys/${id}/edit`}>
              Edit Survey
            </Link>
          </Button>
        </div>
      </div>
      <SurveyDetail params={{ id }} />
    </div>
  );
} 