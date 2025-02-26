'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { getSurvey } from '@/lib/services/survey-service';
import { Survey } from '@/types/survey';
import { handleAuthError } from '@/lib/auth-utils';
import { useToast } from '@/components/ui/use-toast';
import SurveyForm from '@/components/surveys/survey-form';

export default function EditSurveyForm({ params }: { params: { id: string } | { value: string } | string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surveyId, setSurveyId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSurvey() {
      // Parse the params if it's a string
      let parsedId;
      try {
        if (typeof params === 'string') {
          const parsedParams = JSON.parse(params);
          parsedId = parsedParams.id;
        } else if ('value' in params) {
          const parsedValue = JSON.parse(params.value);
          parsedId = parsedValue.id;
        } else if ('id' in params) {
          parsedId = params.id;
        }

        if (!parsedId || parsedId === 'undefined') {
          setError('Invalid survey ID');
          setLoading(false);
          return;
        }

        setSurveyId(parsedId);
        setLoading(true);
        console.log('Fetching survey with ID:', parsedId);
        const data = await getSurvey(parsedId);
        console.log('Survey data received:', data);
        setSurvey(data);
      } catch (error: any) {
        console.error('Error fetching survey:', error);
        
        // Handle authentication errors
        const isAuthError = await handleAuthError(error);
        if (!isAuthError) {
          const errorMessage = error.data?.detail || error.message || 'Failed to load survey';
          setError(errorMessage);
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
      }
    }

    fetchSurvey();
  }, [params, toast]);

  const handleBackClick = () => {
    if (surveyId) {
      router.push(`/dashboard/surveys/${surveyId}`);
    } else {
      router.push('/dashboard/surveys');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBackClick}>
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Survey
            </Button>
            <div className="h-8 w-32 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </div>
        <Card className="p-6">
          <div className="space-y-4">
            <div className="h-6 w-3/4 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-4 w-1/2 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="container mx-auto py-10 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBackClick}>
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Survey
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Error</h1>
          </div>
        </div>
        <Card className="p-6">
          <p className="text-red-500">{error || 'Failed to load survey'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBackClick}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Survey
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Edit Survey</h1>
        </div>
      </div>
      
      <Card className="p-6">
        <SurveyForm 
          initialData={survey}
          onSuccess={() => {
            toast({
              title: "Success",
              description: "Survey updated successfully",
            });
            if (surveyId) {
              router.push(`/dashboard/surveys/${surveyId}`);
            } else {
              router.push('/dashboard/surveys');
            }
          }}
        />
      </Card>
    </div>
  );
} 