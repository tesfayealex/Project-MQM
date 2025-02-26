import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import SurveyFormClient from './survey-form-client';

export const metadata = {
  title: 'Create Survey | myQuickMessage',
};

export default function NewSurveyPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Create Survey</h1>
        </div>
      </div>
      
      <Card className="p-6">
        <SurveyFormClient />
      </Card>
    </div>
  );
} 