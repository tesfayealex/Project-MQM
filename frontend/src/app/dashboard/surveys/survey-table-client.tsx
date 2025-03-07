'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast, useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SurveyTable from '@/components/surveys/SurveyTable';
import { deleteSurvey } from '@/lib/services/survey-service';
import { Survey } from '@/types/survey';
import { useTranslation } from 'react-i18next';

interface SurveyTableClientProps {
  initialSurveys: Survey[];
}

export default function SurveyTableClient({ initialSurveys }: SurveyTableClientProps) {
  const router = useRouter();
  const [surveys, setSurveys] = useState<Survey[]>(initialSurveys || []);
  const [isDeleting, setIsDeleting] = useState(false);
  const [surveyToDelete, setSurveyToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, i18n } = useTranslation('surveys', { useSuspense: false });
  
  useEffect(() => {
    i18n.loadNamespaces('surveys').catch(err => 
      console.error('Failed to load surveys namespace:', err)
    );
  }, [i18n]);

  const handleDelete = async () => {
    if (!surveyToDelete) return;

    setIsDeleting(true);
    try {
      await deleteSurvey(surveyToDelete);
      
      // Update local state
      setSurveys(surveys.filter(survey => survey.id.toString() !== surveyToDelete));
      
      toast({
        title: t('messages.deleted'),
        description: t('messages.deleted'),
      });

      // Reset state
      setSurveyToDelete(null);
      
      // Refresh the page data
      router.refresh();
    } catch (error: any) {
      console.error('Error deleting survey:', error);
      
      toast({
        variant: 'destructive',
        title: t('messages.error'),
        description: error.message || t('messages.error'),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const onDeleteClick = (id: string) => {
    setSurveyToDelete(id);
  };

  const cancelDelete = () => {
    setSurveyToDelete(null);
  };

  return (
    <>
      <SurveyTable surveys={surveys} onDelete={onDeleteClick} />
      
      <AlertDialog open={!!surveyToDelete} onOpenChange={cancelDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.confirm_delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('messages.confirm_delete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('create.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? t('actions.delete') + '...' : t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 