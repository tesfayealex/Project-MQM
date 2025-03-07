'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import SurveyForm from '@/components/surveys/SurveyForm';
import { getSurvey, updateSurvey } from '@/lib/services/survey-service';
import { handleAuthError } from '@/lib/auth-utils';
import { Survey } from '@/types/survey';
import { useTranslation } from 'react-i18next';

interface EditSurveyFormClientProps {
  params: { id: string } | { value: string } | string;
}

export default function EditSurveyFormClient({ params }: EditSurveyFormClientProps) {
  const router = useRouter();
  const { t, i18n } = useTranslation('surveys', { useSuspense: false });
  const [isLoading, setIsLoading] = useState(true);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [surveyId, setSurveyId] = useState<string | null>(null);

  useEffect(() => {
    i18n.loadNamespaces('surveys').catch(err => 
      console.error('Failed to load surveys namespace:', err)
    );
  }, [i18n]);

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
          throw new Error(t('errors.invalidSurveyId'));
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
  }, [params, router, t]);

  const handleSubmit = async (data: any) => {
    if (!surveyId) {
      toast({
        title: t('errors.error'),
        description: t('errors.missingSurveyId'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      await updateSurvey(surveyId, data);
      toast({
        title: t('success.updated'),
        description: t('success.surveyUpdated'),
      });
      router.push('/dashboard/surveys');
    } catch (error) {
      console.error('Error updating survey:', error);
      handleAuthError(error);
      toast({
        title: t('errors.error'),
        description: t('errors.updateFailed'),
        variant: 'destructive',
      });
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