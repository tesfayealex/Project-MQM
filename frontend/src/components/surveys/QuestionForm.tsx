import React, { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

// Define the language type
interface Language {
  code: string;
  name: string;
}

// Available languages - define locally to avoid import issues
const AVAILABLE_LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
];

// Define the schema (must match the parent form's schema)
const questionSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  order: z.number(),
  type: z.enum(['nps', 'free_text']),
  questions: z.record(z.string(), z.string()),
  language: z.string().optional(),
  is_required: z.boolean().default(true),
  placeholder: z.string().optional(),
  placeholders: z.record(z.string(), z.string()).optional(),
  hasAnswers: z.boolean().optional(),
  answerCount: z.number().optional(),
});

type QuestionFormValues = {
  questions: z.infer<typeof questionSchema>[];
};

// Interface for questions with answers
interface QuestionWithAnswers {
  id: number;
  questions: Record<string, string>;
  answer_count: number;
}

interface QuestionFormProps {
  languages: string[];
  questionsWithAnswers?: QuestionWithAnswers[];
  hasResponses?: boolean;
  showDeleteWarning?: boolean;
}

export default function QuestionForm({ 
  languages, 
  questionsWithAnswers = [], 
  hasResponses = false,
  showDeleteWarning = false
}: QuestionFormProps) {
  const { t } = useTranslation('surveys');
  const { control, register, getValues, setValue, watch, formState } = useFormContext<QuestionFormValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "questions"
  });

  // State for deletion confirmation dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<{index: number, id?: number | string, hasAnswers: boolean}>({
    index: -1,
    id: undefined,
    hasAnswers: false
  });
  
  // Log question validation state
  React.useEffect(() => {
    console.log('QuestionForm validation state:', {
      fields: fields,
      errors: formState.errors.questions,
      isValid: !formState.errors.questions
    });
  }, [fields, formState.errors.questions]);
  
  // Ensure question IDs are always preserved in form data
  React.useEffect(() => {
    // For each field, check if it has a "real" database ID (from initialData)
    fields.forEach((field, index) => {
      // Access the actual question data to see if it has a real ID
      const question = getValues(`questions.${index}`);
      
      // If the question has a real ID (from the database), make sure it's set
      // We need to distinguish between React Hook Form's internal IDs and database IDs
      if (question && question.id && typeof question.id === 'number') {
        console.log(`Found database ID ${question.id} for question at index ${index}`);
      } else {
        // This is a field without a real ID
        console.log(`No database ID for question at index ${index}, field id: ${field.id}`);
      }
    });
  }, [fields, getValues]);

  // Create a new question with all required fields
  const createNewQuestion = () => {
    const newQuestion = {
      order: fields.length,
      type: 'nps' as const,
      questions: languages.reduce((obj, lang) => ({...obj, [lang]: ''}), {}),
      is_required: true,
      placeholders: languages.reduce((obj, lang) => ({...obj, [lang]: ''}), {})
    };
    console.log('Creating new question:', newQuestion);
    return newQuestion;
  };

  // Helper to add a new question
  const addQuestion = () => {
    const newQuestion = createNewQuestion();
    console.log('Adding new question:', newQuestion);
    
    // Log the current state of all questions for debugging
    console.log('Current questions before adding:', fields.map(field => ({
      id: field.id,
      reactHookFormId: field.id, // This is the React Hook Form internal ID
      questionId: field.id, // This may be the database ID if it exists
      type: field.type
    })));
    
    append(newQuestion);
    
    // Log the updated state after adding
    setTimeout(() => {
      console.log('Questions after adding new one:', getValues('questions').map((q, index) => ({
        index,
        id: q.id,
        type: q.type
      })));
      
      // Also print full form data to see if IDs are being preserved
      console.log('Full form data:', getValues());
    }, 0);
  };
  
  // Check if a question has answers attached
  const hasAnswers = (questionId?: number | string) => {
    // If no ID or no responses, return false immediately
    if (!questionId || !hasResponses) {
      console.log('hasAnswers: No questionId or no responses', { questionId, hasResponses });
      return false;
    }
    
    // Check if this is likely a React Hook Form internal ID
    if (typeof questionId === 'string' && (questionId.startsWith('field_') || questionId.length > 10)) {
      console.log('This appears to be a React Hook Form internal ID, not a real database ID:', questionId);
      
      // Since this is an internal ID, let's try to get the actual question data
      const questionIndex = fields.findIndex(f => f.id === questionId);
      if (questionIndex >= 0) {
        const questionData = getValues(`questions.${questionIndex}`);
        // Check if the question has the direct hasAnswers flag
        if (questionData && questionData.hasAnswers) {
          console.log('Question has answers according to direct flag:', questionData);
          return true;
        }
      }
      
      return false;
    }
    
    // Convert questionId to a number for comparison
    const questionIdNum = Number(questionId);
    
    // If conversion failed and we have a NaN, this can't be a real ID
    if (isNaN(questionIdNum)) {
      console.log('Could not convert ID to number, likely not a real database ID:', questionId);
      return false;
    }
    
    // Check if the question has answers
    const hasAnswersAttached = questionsWithAnswers.some(q => q.id === questionIdNum);
    
    // Log the result for debugging
    console.log('hasAnswers check:', { 
      questionId, 
      questionIdNum,
      hasAnswersAttached,
      questionsWithAnswers: questionsWithAnswers.map(q => q.id)
    });
    
    return hasAnswersAttached;
  };
  
  // Handle question deletion with confirmation if needed
  const handleDeleteQuestion = (index: number) => {
    const question = fields[index];
    
    // Access the actual question data to get the real ID
    const questionData = getValues(`questions.${index}`);
    const questionId = questionData?.id || question.id;
    
    console.log('Question being deleted:', {
      index,
      questionId,
      fieldId: question.id,
      dataId: questionData?.id,
      fieldIdType: typeof question.id,
      dataIdType: typeof questionData?.id,
      questionData
    });
    
    // First check if the question data itself indicates it has answers
    let questionHasAnswers = questionData?.hasAnswers === true;
    
    // If not, then use the normal hasAnswers check
    if (!questionHasAnswers) {
      questionHasAnswers = hasAnswers(questionId);
    }
    
    console.log('handleDeleteQuestion:', {
      index,
      questionId,
      questionHasAnswers,
      showDeleteWarning,
      shouldShowWarning: questionHasAnswers && showDeleteWarning,
      directHasAnswers: questionData?.hasAnswers
    });
    
    // If the question has answers and warnings are enabled, show confirmation
    if (questionHasAnswers && showDeleteWarning) {
      setQuestionToDelete({
        index,
        id: questionId,
        hasAnswers: true
      });
      setDeleteConfirmOpen(true);
      console.log('Opening delete confirmation dialog for question with answers');
    } else {
      // Otherwise just delete it
      console.log('Deleting question without confirmation');
      remove(index);
    }
  };
  
  // Confirmed deletion after warning
  const confirmDelete = () => {
    if (questionToDelete.index >= 0) {
      remove(questionToDelete.index);
      setDeleteConfirmOpen(false);
      setQuestionToDelete({ index: -1, id: undefined, hasAnswers: false });
    }
  };

  // Log validation errors for debugging
  React.useEffect(() => {
    if (formState.errors.questions) {
      console.log('Question validation details:', {
        errors: formState.errors.questions,
        currentQuestions: getValues('questions'),
        languages: languages
      });
    }
  }, [formState.errors.questions, getValues, languages]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">{t('questions.title')}</h3>
        <Button 
          type="button" 
          onClick={addQuestion}
          variant="outline"
          size="sm"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          {t('questions.add')}
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="py-4 text-center text-gray-500">
          {t('questions.empty')}
        </div>
      ) : (
        fields.map((field, index) => (
          <Card key={field.id} className="relative">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">
                  {t('questions.questionNumber', { number: index + 1 })}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => index > 0 && move(index, index - 1)}
                    disabled={index === 0}
                    aria-label={t('questions.moveUp')}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => index < fields.length - 1 && move(index, index + 1)}
                    disabled={index === fields.length - 1}
                    aria-label={t('questions.moveDown')}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => handleDeleteQuestion(index)}
                    aria-label={t('questions.remove')}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`questions.${index}.type`}>{t('questions.type')}</Label>
                  <Select
                    value={watch(`questions.${index}.type`)}
                    onValueChange={(value) => setValue(`questions.${index}.type`, value as 'nps' | 'free_text')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('questions.selectType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nps">{t('questions.types.nps')}</SelectItem>
                      <SelectItem value="free_text">{t('questions.types.text')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id={`questions.${index}.is_required`}
                    checked={watch(`questions.${index}.is_required`)}
                    onCheckedChange={(checked) => setValue(`questions.${index}.is_required`, checked)}
                  />
                  <Label htmlFor={`questions.${index}.is_required`}>{t('questions.required')}</Label>
                </div>
              </div>

              {/* Question text for each language */}
              {languages.map(lang => (
                <div key={`${field.id}-${lang}`} className="space-y-2">
                  <Label htmlFor={`questions.${index}.questions.${lang}`}>
                    {t('questions.textWithLanguage', { 
                      language: AVAILABLE_LANGUAGES.find((l) => l.code === lang)?.name || lang.toUpperCase() 
                    })}
                  </Label>
                  <Textarea
                    id={`questions.${index}.questions.${lang}`}
                    {...register(`questions.${index}.questions.${lang}`, {
                      required: true
                    })}
                    placeholder={t('questions.textPlaceholder', { 
                      language: AVAILABLE_LANGUAGES.find((l) => l.code === lang)?.name || lang.toUpperCase() 
                    })}
                    className="min-h-[80px]"
                  />
                </div>
              ))}

              {/* Placeholder for each language */}
              {languages.map(lang => (
                <div key={`${field.id}-${lang}-placeholder`} className="space-y-2">
                  <Label htmlFor={`questions.${index}.placeholders.${lang}`}>
                    {t('questions.placeholderWithLanguage', { 
                      language: AVAILABLE_LANGUAGES.find((l) => l.code === lang)?.name || lang.toUpperCase() 
                    })}
                  </Label>
                  <Textarea
                    id={`questions.${index}.placeholders.${lang}`}
                    {...register(`questions.${index}.placeholders.${lang}`)}
                    placeholder={t('questions.placeholderInputText', { 
                      language: AVAILABLE_LANGUAGES.find((l) => l.code === lang)?.name || lang.toUpperCase() 
                    })}
                    className="min-h-[80px]"
                  />
                </div>
              ))}

              {/* Hidden fields */}
              <input 
                type="hidden" 
                {...register(`questions.${index}.order`)} 
                value={index} 
              />
              
              {/* Important: Preserve the real database ID if it exists */}
              {field.id && (
                <>
                  {(() => {
                    // Access the real question data to get the real ID
                    const question = getValues(`questions.${index}`);
                    const realId = question?.id;
                    
                    // Check if this is a real database ID
                    if (realId && typeof realId === 'number') {
                      console.log(`Setting real database ID ${realId} for question ${index}`);
                      // Set the ID explicitly to ensure it's sent to the backend
                      setValue(`questions.${index}.id`, realId);
                      return (
                        <input 
                          type="hidden" 
                          {...register(`questions.${index}.id`)}
                          value={String(realId)} 
                        />
                      );
                    } else {
                      // This is a new question with a React Hook Form generated ID, don't send ID to backend
                      console.log(`Skipping ID for new question ${index}, React id: ${field.id}`);
                      return null;
                    }
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {fields.length > 0 && (
        <div className="flex justify-center mt-4">
          <Button 
            type="button" 
            onClick={addQuestion}
            variant="outline"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            {t('questions.addAnother')}
          </Button>
        </div>
      )}

      {/* Deletion confirmation dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('questions.deleteWarningTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('questions.deleteWarningDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('questions.deleteWarningCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('questions.deleteWarningConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}