import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import EditSurveyFormClient from './edit-form-client';
import { useTranslation } from 'react-i18next';

export const metadata = {
  title: 'Edit Survey | myQuickMessage',
  description: 'Edit your survey details and questions',
};

export default async function EditSurveyPage({ params }: { params: { id: string } }) {
  // Note: useTranslation cannot be used directly in Server Components
  // The actual translation will be handled in the client component
  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/surveys">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Surveys
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Edit Survey</h1>
        </div>
      </div>
      
      <Card className="p-6">
        <EditSurveyFormClient params={params} />
      </Card>
    </div>
  );
} 