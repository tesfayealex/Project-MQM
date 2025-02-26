'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import SurveyForm from '@/components/surveys/SurveyForm';
import { updateSurvey } from '@/lib/services/survey-service';
import { Survey } from '@/types/survey';

interface EditSurveyFormClientProps {
  initialData: Survey;
}

export default function EditSurveyFormClient({ initialData }: EditSurveyFormClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const response = await updateSurvey(initialData.id, data);
      
      toast({
        title: 'Survey Updated',
        description: 'Your survey has been updated successfully.',
      });
      
      router.push(`/dashboard/surveys`);
      router.refresh();
    } catch (error: any) {
      console.error('Error updating survey:', error);
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update survey. Please try again.',
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