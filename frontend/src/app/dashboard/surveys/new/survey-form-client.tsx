'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import SurveyForm from '@/components/surveys/SurveyForm';
import { createSurvey } from '@/lib/services/survey-service';
import { handleAuthError } from '@/lib/auth-utils';

export default function SurveyFormClient() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: any) => {
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
      const response = await createSurvey(surveyData);
      console.log('Survey created successfully:', response);
      
      toast({
        title: 'Survey Created',
        description: 'Your survey has been created successfully.',
      });
      
      router.push(`/dashboard/surveys`);
    } catch (error: any) {
      console.error('Error creating survey:', error);
      
      // Handle authentication errors
      const isAuthError = await handleAuthError(error);
      if (!isAuthError) {
        // Get a more detailed error message
        let errorMessage = 'Failed to create survey. Please try again.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        // Show error toast
        toast({
          variant: 'destructive',
          title: 'Error Creating Survey',
          description: errorMessage,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SurveyForm
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  );
} 