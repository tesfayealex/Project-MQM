'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
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

interface SurveyTableClientProps {
  initialSurveys: Survey[];
}

export default function SurveyTableClient({ initialSurveys }: SurveyTableClientProps) {
  const router = useRouter();
  const [surveys, setSurveys] = useState<Survey[]>(initialSurveys);
  const [isDeleting, setIsDeleting] = useState(false);
  const [surveyToDelete, setSurveyToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!surveyToDelete) return;

    setIsDeleting(true);
    try {
      await deleteSurvey(surveyToDelete);
      
      // Update local state
      setSurveys(surveys.filter(survey => survey.id !== surveyToDelete));
      
      toast({
        title: 'Survey Deleted',
        description: 'The survey has been deleted successfully.',
      });

      // Reset state
      setSurveyToDelete(null);
      
      // Refresh the page data
      router.refresh();
    } catch (error: any) {
      console.error('Error deleting survey:', error);
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete survey. Please try again.',
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
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the survey and all its associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 