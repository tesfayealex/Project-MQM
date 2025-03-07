'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import SurveyForm from '@/components/surveys/SurveyForm';
import { createSurvey } from '@/lib/services/survey-service';
import { handleAuthError } from '@/lib/auth-utils';
import { useTranslation } from 'react-i18next';

export default function SurveyFormClient() {
  const router = useRouter();
  const { t, i18n } = useTranslation('surveys', { useSuspense: false });

  useEffect(() => {
    i18n.loadNamespaces('surveys').catch(err => 
      console.error('Failed to load surveys namespace:', err)
    );
  }, [i18n]);

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      console.log('Submitting survey data:', data);
      
      // Format data for the backend
      const surveyData = {
        ...data,
        // Ensure required fields are set
        title: data.title || t('defaults.untitledSurvey'),
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
        title: t('success.created'),
        description: t('success.surveyCreated'),
      });
      
      router.push(`/dashboard/surveys`);
    } catch (error: any) {
      console.error('Error creating survey:', error);
      
      // Handle authentication errors
      handleAuthError(error);
      
      // Get a more detailed error message
      let errorMessage = t('errors.createFailed');
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Show error toast
      toast({
        variant: 'destructive',
        title: t('errors.error'),
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return <SurveyForm onSubmit={handleSubmit} isLoading={isLoading} />;
} 