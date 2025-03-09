'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import SurveyForm from '@/components/surveys/SurveyForm';
import { updateSurvey } from '@/lib/services/survey-service';
import { Survey } from '@/types/survey';
import { useTranslation } from 'react-i18next';

interface EditSurveyFormClientProps {
  initialData: Survey;
}

export default function EditSurveyFormClient({ initialData }: EditSurveyFormClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation('surveys');

  const handleSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      // Ensure the template field is included
      const surveyData = {
        ...data,
        template: data.template || null
      };
      
      const response = await updateSurvey(initialData.id.toString(), surveyData);
      
      toast({
        title: t('success.updated'),
        description: t('success.surveyUpdated'),
      });
      
      router.push(`/dashboard/surveys`);
      router.refresh();
    } catch (error: any) {
      console.error('Error updating survey:', error);
      
      toast({
        variant: 'destructive',
        title: t('errors.error'),
        description: error.message || t('errors.updateFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SurveyForm
      initialData={initialData}
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  );
} 