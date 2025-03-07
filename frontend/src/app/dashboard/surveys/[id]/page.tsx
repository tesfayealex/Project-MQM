import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  ChartBarIcon as BarChart3Icon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import SurveyDetail from './survey-detail';
import { useTranslation } from 'react-i18next';

export const metadata: Metadata = {
  title: 'Survey Details | myQuickMessage',
  description: 'View and manage your survey details',
};

export default async function SurveyDetailPage({ params }: { params: { id: string } }) {
  // Note: useTranslation cannot be used directly in Server Components
  // The actual translation will be handled in the client component
  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Survey Details</h1>
        <div className="flex space-x-4">
          <Link href={`/dashboard/surveys/${params.id}/analysis`}>
            <Button variant="outline">
              <BarChart3Icon className="h-4 w-4 mr-2" />
              View Analysis
            </Button>
          </Link>
          <Link href={`/dashboard/surveys/${params.id}/edit`}>
            <Button>
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit Survey
            </Button>
          </Link>
        </div>
      </div>
      
      <SurveyDetail params={params} />
    </div>
  );
} 