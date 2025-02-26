'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import SurveyForm from '@/components/surveys/SurveyForm';
import { getSurvey, updateSurvey } from '@/lib/services/survey-service';
import { handleAuthError } from '@/lib/auth-utils';
import { Survey } from '@/types/survey';

interface EditSurveyFormClientProps {
  params: { id: string } | { value: string } | string;
}

export default function EditSurveyFormClient({ params }: EditSurveyFormClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [surveyId, setSurveyId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSurvey() {
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
          throw new Error('Invalid survey ID');
        }

        setSurveyId(parsedId);
        const data = await getSurvey(parsedId);
        console.log('Fetched survey data:', data);
        
        // Ensure questions have the correct structure
        const formattedSurvey = {
          ...data,
          questions: data.questions?.map((q: any, index: number) => ({
            ...q,
            order: index + 1,
            questions: q.questions || {},
            is_required: q.is_required ?? true,
          })) || []
        };
        
        console.log('Formatted survey data:', formattedSurvey);
        setSurvey(formattedSurvey);
      } catch (error: any) {
        console.error('Error fetching survey:', error);
        
        // Handle authentication errors
        const isAuthError = await handleAuthError(error);
        if (!isAuthError) {
          toast({
            variant: 'destructive',
            title: 'Error Loading Survey',
            description: error.message || 'Failed to load survey. Please try again.',
          });
          router.push('/dashboard/surveys');
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchSurvey();
  }, [params, router, toast]);

  const handleSubmit = async (data: any) => {
    if (!surveyId) return;
    
    setIsLoading(true);
    try {
      console.log('Submitting survey data:', data);
      
      // Format data for the backend
      const surveyData = {
        ...data,
        // Ensure required fields are set
        title: data.title || 'Untitled Survey',
        languages: data.languages && data.languages.length ? data.languages : ['en'],
        is_active: data.is_active !== undefined ? data.is_active : true,
        
        // If questions are provided, ensure they have required fields
        questions: data.questions?.map((q: any, index: number) => ({
          ...q,
          order: index + 1,
          type: q.type || 'free_text',
          is_required: q.is_required !== undefined ? q.is_required : true,
          language: q.language || 'en'
        })) || []
      };
      
      console.log('Formatted survey data:', surveyData);
      const response = await updateSurvey(surveyId, surveyData);
      console.log('Survey updated successfully:', response);
      
      toast({
        title: 'Survey Updated',
        description: 'Your survey has been updated successfully.',
      });
      
      router.push(`/dashboard/surveys/${surveyId}`);
    } catch (error: any) {
      console.error('Error updating survey:', error);
      
      // Handle authentication errors
      const isAuthError = await handleAuthError(error);
      if (!isAuthError) {
        // Get a more detailed error message
        let errorMessage = 'Failed to update survey. Please try again.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        // Show error toast
        toast({
          variant: 'destructive',
          title: 'Error Updating Survey',
          description: errorMessage,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !survey) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-3/4 bg-gray-200 animate-pulse rounded"></div>
        <div className="h-4 w-1/2 bg-gray-200 animate-pulse rounded"></div>
      </div>
    );
  }

  return (
    <SurveyForm
      initialData={survey}
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  );
} 