import React, { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Survey, SurveyQuestion } from '@/types/survey';
import { Template } from '@/types/template';
import QuestionForm from './QuestionForm';
import { format } from 'date-fns';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from 'react-i18next';
import { getCookie } from 'cookies-next';
import { useLanguage } from '@/contexts/language-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTemplates } from '@/lib/services/template-service';
import { checkSurveyHasResponses, debugSurveyQuestions } from '@/lib/services/survey-service';
import { useRouter } from 'next/navigation';
import { useToast } from "@/components/ui/use-toast";

// Available languages
const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
];

const questionSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  order: z.number(),
  type: z.enum(['nps', 'free_text']),
  questions: z.record(z.string(), z.string()),
  language: z.string().optional(),
  is_required: z.boolean().default(true),
  placeholders: z.record(z.string(), z.string()).optional().default({}),
});

type QuestionType = z.infer<typeof questionSchema>;

// Validation schema
const surveySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  headlines: z.record(z.string()).optional(),
  survey_texts: z.record(z.string()).optional(),
  start_survey_titles: z.record(z.string()).optional(),
  start_survey_texts: z.record(z.string()).optional(),
  start_survey_title: z.string().optional(),
  start_survey_text: z.string().optional(),
  end_survey_titles: z.record(z.string()).optional(),
  end_survey_texts: z.record(z.string()).optional(),
  expired_survey_titles: z.record(z.string()).optional(),
  expired_survey_texts: z.record(z.string()).optional(),
  end_survey_title: z.string().optional(),
  end_survey_text: z.string().optional(),
  expired_survey_title: z.string().optional(),
  expired_survey_text: z.string().optional(),
  languages: z.array(z.string()).min(1, "At least one language is required"),
  format: z.string(),
  type: z.string(),
  start_datetime: z.string().optional(),
  expiry_date: z.string().optional(),
  analysis_cluster: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  token: z.string().optional(), // Legacy token field
  tokens: z.array(
    z.object({
      id: z.number().optional(),
      token: z.string(),
      description: z.string()
    })
  ).optional(),
  is_active: z.boolean().default(true),
  questions: z.array(questionSchema).default([]),
  template: z.union([z.number(), z.string(), z.null()]).optional() // Allow null values
});

type SurveyFormValues = z.infer<typeof surveySchema>;

interface SurveyFormProps {
  initialData?: Partial<Survey>;
  onSubmit: (data: SurveyFormValues) => void;
  isLoading?: boolean;
}

export default function SurveyForm({ initialData, onSubmit, isLoading = false }: SurveyFormProps) {
  const { t, i18n } = useTranslation(['surveys', 'common']);
  const { locale: currentLanguage } = useLanguage();
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("general");
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [hasResponses, setHasResponses] = useState(false);
  const [questionsWithAnswers, setQuestionsWithAnswers] = useState<{ id: number; questions: Record<string, string>; answer_count: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Fetch templates on component mount
  useEffect(() => {
    async function loadTemplates() {
      try {
        setIsLoadingTemplates(true);
        const templatesData = await getTemplates();
        setTemplates(templatesData);

        // If initialData includes a template, select it
        if (initialData?.template) {
          const templateId = String(initialData.template);
          setSelectedTemplateId(templateId);
          const template = templatesData.find(t => t.id.toString() === templateId);
          if (template) {
            setSelectedTemplate(template);
          }
        }
      } catch (error) {
        console.error('Error loading templates:', error);
        toast({
          title: "Error loading templates",
          description: "There was a problem loading the templates. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoadingTemplates(false);
      }
    }
    
    loadTemplates();
  }, [initialData?.template, toast]);

  // Helper function to format ISO datetime strings for datetime-local input
  const formatDateForInput = (dateString: string): string => {
    try {
      // Create a date object from the string
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateString);
        return '';
      }
      
      // Format the date as YYYY-MM-DDThh:mm (format required by datetime-local input)
      // Use padStart to ensure proper zero-padding for single digits
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };
  
  const methods = useForm<SurveyFormValues>({
    resolver: zodResolver(surveySchema),
    defaultValues: {
      ...initialData,
      languages: initialData?.languages || ['en'],
      title: initialData?.title || '',
      description: initialData?.description || '',
      headlines: initialData?.headlines || {},
      survey_texts: initialData?.survey_texts || {},
      is_active: initialData?.is_active ?? true,
      questions: initialData?.questions?.map((q, index) => {
        // Ensure IDs are properly preserved
        console.log(`Mapping question ${index} with ID:`, q.id, typeof q.id);
        return {
          ...q,
          // Explicitly preserve the ID as is (don't convert to string)
          id: q.id,
          order: index + 1,
          questions: { ...q.questions },
          is_required: q.is_required ?? true,
          placeholders: { ...q.placeholders },
          type: q.type || 'nps'
        };
      }) || [],
      start_survey_title: initialData?.start_survey_titles?.[currentLanguage] || '',
      start_survey_text: initialData?.start_survey_texts?.[currentLanguage] || '',
      start_survey_titles: initialData?.start_survey_titles || {},
      start_survey_texts: initialData?.start_survey_texts || {},
      end_survey_title: initialData?.end_survey_titles?.[currentLanguage] || '',
      end_survey_text: initialData?.end_survey_texts?.[currentLanguage] || '',
      end_survey_titles: initialData?.end_survey_titles || {},
      end_survey_texts: initialData?.end_survey_texts || {},
      expired_survey_title: initialData?.expired_survey_titles?.[currentLanguage] || '',
      expired_survey_text: initialData?.expired_survey_texts?.[currentLanguage] || '',
      expired_survey_titles: initialData?.expired_survey_titles || {},
      expired_survey_texts: initialData?.expired_survey_texts || {},
      format: initialData?.format || 'online',
      type: initialData?.type || 'public',
      start_datetime: initialData?.start_datetime ? formatDateForInput(initialData.start_datetime) : '',
      expiry_date: initialData?.expiry_date ? formatDateForInput(initialData.expiry_date) : '',
      analysis_cluster: initialData?.analysis_cluster || 'Standard',
      city: initialData?.city || '',
      country: initialData?.country || '',
      token: initialData?.token || '',
      tokens: initialData?.tokens || [],
    }
  });

  const selectedLanguages = methods.watch('languages') || ['en'];
  const formState = methods.formState;

  useEffect(() => {
    // Load translations and set initial language
    const savedLocale = getCookie('NEXT_LOCALE') as string;
    if (savedLocale && ['en', 'fr', 'es', 'de'].includes(savedLocale)) {
      i18n.changeLanguage(savedLocale);
    }
  }, [i18n]);

  useEffect(() => {
    // Update language when cookie changes
    const checkLanguage = () => {
      const newLocale = getCookie('NEXT_LOCALE') as string;
      if (newLocale && newLocale !== currentLanguage) {
        i18n.changeLanguage(newLocale);
      }
    };

    const interval = setInterval(checkLanguage, 1000);
    return () => clearInterval(interval);
  }, [currentLanguage, i18n]);

  // Log form state changes for debugging
  React.useEffect(() => {
    console.log('Form validation state:', {
      isValid: formState.isValid,
      isDirty: formState.isDirty,
      errors: formState.errors,
      touchedFields: formState.touchedFields,
      dirtyFields: formState.dirtyFields
    });
  }, [formState]);

  // Function to generate a token
  const generateToken = () => {
    return Math.random().toString(36).substring(2, 15);
  };
  
  // State for managing tokens
  const [tokens, setTokens] = useState<{id?: number, token: string, description: string}[]>(
    initialData?.tokens && initialData.tokens.length > 0 
      ? initialData.tokens 
      : initialData?.token 
        ? [{ token: initialData.token, description: 'Default Token' }] 
        : [{ token: generateToken(), description: 'Default Token' }]
  );
  
  // Add a new token
  const addToken = () => {
    setTokens([...tokens, { token: generateToken(), description: 'New Token' }]);
  };
  
  // Remove a token
  const removeToken = (index: number) => {
    // Prevent removing the last token
    if (tokens.length <= 1) {
      return;
    }
    const newTokens = [...tokens];
    newTokens.splice(index, 1);
    setTokens(newTokens);
  };
  
  // Update token value
  const updateToken = (index: number, field: 'token' | 'description', value: string) => {
    const newTokens = [...tokens];
    newTokens[index] = { ...newTokens[index], [field]: value };
    setTokens(newTokens);
  };

  // Check if questions with answers have been deleted without a warning
  const checkDeletedQuestionsWithAnswers = (currentQuestions: any[]): boolean => {
    // If we don't have initial data or no previous questions, nothing to check
    if (!initialData?.questions || !initialData.questions.length) {
      return false;
    }
    
    // Get a map of all question IDs that have answers
    const questionsWithAnswersMap = new Map<number, boolean>();
    questionsWithAnswers.forEach(q => {
      questionsWithAnswersMap.set(q.id, true);
    });
    
    // Get a map of all current question IDs
    const currentQuestionIds = new Set(
      currentQuestions
        .filter(q => q.id && typeof q.id === 'number')
        .map(q => Number(q.id))
    );
    
    // Check if any question with answers is missing
    let missingQuestionWithAnswers = false;
    
    initialData.questions.forEach(q => {
      if (q.id && questionsWithAnswersMap.has(Number(q.id)) && !currentQuestionIds.has(Number(q.id))) {
        console.warn(`Question with ID ${q.id} has answers but was removed without confirmation`);
        missingQuestionWithAnswers = true;
      }
    });
    
    return missingQuestionWithAnswers;
  };

  // Handle form submission
  const validateForm = () => {
    const errors = formState.errors;
    const hasErrors = Object.keys(errors).length > 0;

    if (hasErrors) {
      console.error('Form validation errors:', errors);
      toast({
        title: "Validation Error",
        description: "Please check the form for errors",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (data: SurveyFormValues) => {
    // Enhanced debugging for question IDs
    console.log('Survey form submission data (DETAILED):', {
      formData: data,
      questionIDs: data.questions?.map(q => ({
        id: q.id,
        idType: typeof q.id,
        idValue: q.id,
        order: q.order,
        type: q.type
      })) || [],
      originalQuestions: initialData?.questions?.map(q => ({
        id: q.id,
        idType: typeof q.id,
        idValue: q.id
      })) || []
    });
    
    // Check if questions have IDs before submitting
    const hasAnyQuestionIds = data.questions?.some(q => q.id !== undefined && q.id !== null);
    console.log('Has any question IDs:', hasAnyQuestionIds);
    
    // If we're editing and no questions have IDs, we should fix it
    if (initialData?.id && initialData?.questions && initialData.questions.length > 0 && !hasAnyQuestionIds) {
      console.warn('No question IDs detected in form data but we are editing existing questions. This will cause all questions to be recreated.');
      
      // Try to correct the data by matching questions by position and adding IDs
      if (initialData.questions && data.questions && data.questions.length >= initialData.questions.length) {
        const updatedQuestions = data.questions.map((q, index) => {
          if (initialData.questions && index < initialData.questions.length) {
            // Copy the question data but add the original ID
            return {
              ...q,
              id: initialData.questions[index].id
            };
          }
          return q;
        });
        
        console.log('Fixed questions with IDs:', updatedQuestions.map(q => ({
          id: q.id,
          idType: typeof q.id
        })));
        
        // Update the data with fixed questions
        data.questions = updatedQuestions;
      }
    }
    
    // Check if any questions with answers have been deleted without confirmation
    if (data.questions && checkDeletedQuestionsWithAnswers(data.questions)) {
      // Show a confirmation dialog
      const confirmed = window.confirm(
        t('questions.deleteWarningDescription') || 
        "Warning: You are about to delete questions that have answers. This will preserve the answer data but break the connection to the question. Are you sure you want to continue?"
      );
      
      if (!confirmed) {
        console.log('Submission cancelled due to unconfirmed deletion of questions with answers');
        return;
      }
      
      console.log('User confirmed deletion of questions with answers, proceeding with submission');
    }
    
    // Check if we have at least one token
    if (tokens.length === 0) {
      setTokens([{ token: generateToken(), description: 'Default Token' }]);
      toast({
        title: "Token Required",
        description: "A default token has been generated for you.",
        variant: "default"
      });
      return; // Don't submit until we have a token
    }
    
    // Validate that all tokens have values
    const invalidTokens = tokens.filter(t => !t.token || !t.description);
    if (invalidTokens.length > 0) {
      toast({
        title: "Invalid Tokens",
        description: "All tokens must have both a token value and description.",
        variant: "destructive"
      });
      return; // Don't submit with invalid tokens
    }
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Use the tokens from local state instead of from the form data
      // This prevents duplicate token creation
      data.tokens = tokens;
      
      // Format the data for submission
      const submissionData = {
        ...data,
        // Make sure to explicitly include questions
        questions: data.questions || [],
        // Normalize the template field value
        template: data.template === "" || data.template === undefined ? null : 
                 (typeof data.template === 'string' && !isNaN(Number(data.template)) ? 
                 Number(data.template) : data.template),
        // Do not include the token field as we're using tokens array
        expiry_date: data.expiry_date || undefined,
        start_datetime: data.start_datetime || undefined,
        // Make sure to add the English title to headlines
        headlines: {
          ...data.headlines,
          en: data.title || ''
        },
        // Make sure to add the English description to survey_texts
        survey_texts: {
          ...data.survey_texts,
          en: data.description || ''
        },
        start_survey_titles: {
          ...data.start_survey_titles,
          [data.languages[0]]: data.start_survey_title || ''
        },
        start_survey_texts: {
          ...data.start_survey_texts,
          [data.languages[0]]: data.start_survey_text || ''
        },
        end_survey_titles: {
          ...data.end_survey_titles,
          [data.languages[0]]: data.end_survey_title || ''
        },
        end_survey_texts: {
          ...data.end_survey_texts,
          [data.languages[0]]: data.end_survey_text || ''
        },
        expired_survey_titles: {
          ...data.expired_survey_titles,
          [data.languages[0]]: data.expired_survey_title || ''
        },
        expired_survey_texts: {
          ...data.expired_survey_texts,
          [data.languages[0]]: data.expired_survey_text || ''
        },
        tokens: tokens
      };
      
      console.log('Formatted data for submission:', submissionData);
      console.log('Questions being sent to backend:', JSON.stringify(submissionData.questions, null, 2));
      
      // Submit the form
      const result = await onSubmit(submissionData);
      
      // Log the result
      console.log('Survey form submission result:', result);
      
      return result;
    } catch (error) {
      console.error('Error submitting survey form:', error);
      toast({
        title: t('form.submitError'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle language toggle with proper state updates
  const toggleLanguage = (langCode: string) => {
    const currentLangs = methods.getValues('languages');
    
    // Save all current values before changing languages
    const savedValues = {
      start_survey_titles: methods.getValues('start_survey_titles'),
      start_survey_texts: methods.getValues('start_survey_texts'),
      end_survey_titles: methods.getValues('end_survey_titles'),
      end_survey_texts: methods.getValues('end_survey_texts'),
      expired_survey_titles: methods.getValues('expired_survey_titles'),
      expired_survey_texts: methods.getValues('expired_survey_texts'),
      headlines: methods.getValues('headlines'),
      survey_texts: methods.getValues('survey_texts')
    };

    if (currentLangs.includes(langCode)) {
      // Removing a language
      if (currentLangs.length > 1 && langCode !== 'en') {
        // Don't remove English as it's the primary language
        methods.setValue('languages', currentLangs.filter(code => code !== langCode));
      } else {
        // Show warning if trying to remove the last language or English
        toast({
          title: "Cannot remove language",
          description: langCode === 'en' ? "English is the primary language and cannot be removed." : "At least one language is required.",
          variant: "destructive"
        });
      }
    } else {
      // Adding a language
      methods.setValue('languages', [...currentLangs, langCode]);
    }
    
    // Restore saved values after language change
    methods.setValue('start_survey_titles', savedValues.start_survey_titles);
    methods.setValue('start_survey_texts', savedValues.start_survey_texts);
    methods.setValue('end_survey_titles', savedValues.end_survey_titles);
    methods.setValue('end_survey_texts', savedValues.end_survey_texts);
    methods.setValue('expired_survey_titles', savedValues.expired_survey_titles);
    methods.setValue('expired_survey_texts', savedValues.expired_survey_texts);
    methods.setValue('headlines', savedValues.headlines);
    methods.setValue('survey_texts', savedValues.survey_texts);
  };

  // Make sure English is always included in the language list
  useEffect(() => {
    const currentLangs = methods.getValues('languages');
    if (!currentLangs.includes('en')) {
      methods.setValue('languages', ['en', ...currentLangs.filter(l => l !== 'en')]);
    }
  }, [methods]);

  useEffect(() => {
    // Update form values when language changes
    if (currentLanguage) {
      methods.setValue('start_survey_title', methods.getValues(`start_survey_titles.${currentLanguage}`) || '');
      methods.setValue('start_survey_text', methods.getValues(`start_survey_texts.${currentLanguage}`) || '');
      methods.setValue('end_survey_title', methods.getValues(`end_survey_titles.${currentLanguage}`) || '');
      methods.setValue('end_survey_text', methods.getValues(`end_survey_texts.${currentLanguage}`) || '');
      methods.setValue('expired_survey_title', methods.getValues(`expired_survey_titles.${currentLanguage}`) || '');
      methods.setValue('expired_survey_text', methods.getValues(`expired_survey_texts.${currentLanguage}`) || '');
    }
  }, [currentLanguage, methods, selectedLanguages]);

  // Function to handle template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id.toString() === templateId) || null;
    setSelectedTemplate(template);
  };

  // Function to apply template data to form
  const applyTemplateData = () => {
    setIsTemplateDialogOpen(true);
  };

  // Function to confirm and apply template data
  const confirmApplyTemplate = () => {
    if (!selectedTemplate) return;
    
    // Update form values with template data
    methods.setValue('title', selectedTemplate.title);
    methods.setValue('description', selectedTemplate.description || '');
    methods.setValue('languages', selectedTemplate.languages);
    methods.setValue('format', selectedTemplate.format || 'online');
    methods.setValue('type', selectedTemplate.type || 'public');
    methods.setValue('analysis_cluster', selectedTemplate.analysis_cluster || 'Standard');
    
    // Multilingual content - make sure to include English
    const headlines = {
      ...selectedTemplate.headlines || {},
      en: selectedTemplate.title || ''
    };
    
    const surveyTexts = {
      ...selectedTemplate.survey_texts || {},
      en: selectedTemplate.description || ''
    };
    
    methods.setValue('headlines', headlines);
    methods.setValue('survey_texts', surveyTexts);
    
    // Start, end and expired messages
    methods.setValue('start_survey_titles', selectedTemplate.start_survey_titles || {});
    methods.setValue('start_survey_texts', selectedTemplate.start_survey_texts || {});
    methods.setValue('end_survey_titles', selectedTemplate.end_survey_titles || {});
    methods.setValue('end_survey_texts', selectedTemplate.end_survey_texts || {});
    methods.setValue('expired_survey_titles', selectedTemplate.expired_survey_titles || {});
    methods.setValue('expired_survey_texts', selectedTemplate.expired_survey_texts || {});
    
    // Update current language fields
    if (currentLanguage) {
      methods.setValue('start_survey_title', selectedTemplate.start_survey_titles?.[currentLanguage] || '');
      methods.setValue('start_survey_text', selectedTemplate.start_survey_texts?.[currentLanguage] || '');
      methods.setValue('end_survey_title', selectedTemplate.end_survey_titles?.[currentLanguage] || '');
      methods.setValue('end_survey_text', selectedTemplate.end_survey_texts?.[currentLanguage] || '');
      methods.setValue('expired_survey_title', selectedTemplate.expired_survey_titles?.[currentLanguage] || '');
      methods.setValue('expired_survey_text', selectedTemplate.expired_survey_texts?.[currentLanguage] || '');
    }
    
    // Add questions from template
    if (selectedTemplate.questions && selectedTemplate.questions.length > 0) {
      const formattedQuestions = selectedTemplate.questions.map((q, index) => ({
        id: undefined, // New ID for the survey question
        order: index + 1,
        type: q.type,
        questions: { ...q.questions },
        is_required: q.is_required,
        placeholders: { ...q.placeholders },
        language: q.language || 'en'
      }));
      
      methods.setValue('questions', formattedQuestions);
    }
    
    // Set template relationship
    methods.setValue('template', selectedTemplate.id);
    
    setIsTemplateDialogOpen(false);
    
    toast({
      title: t('success.templateApplied'),
      description: t('success.templateAppliedDesc'),
    });
  };

  // Check if the survey has responses when editing
  useEffect(() => {
    if (initialData?.id) {
      checkForResponses(initialData.id.toString());
    }
  }, [initialData?.id]);
  
  // Function to check if a survey has responses
  const checkForResponses = async (surveyId: string) => {
    try {
      const responseInfo = await checkSurveyHasResponses(surveyId);
      setHasResponses(responseInfo.has_responses);
      setQuestionsWithAnswers(responseInfo.questions_with_answers || []);
      
      // Enhanced debugging
      console.log('Survey responses info:', {
        surveyId,
        hasResponses: responseInfo.has_responses,
        responseCount: responseInfo.response_count,
        questionsWithAnswers: responseInfo.questions_with_answers,
        canDeleteSafely: responseInfo.can_delete_safely
      });

      // If we have the form already loaded with questions, let's mark questions that have answers
      if (responseInfo.questions_with_answers && responseInfo.questions_with_answers.length > 0) {
        const currentQuestions = methods.getValues('questions') || [];
        
        if (currentQuestions.length > 0) {
          // Create a map of database ID -> answer count for quick lookup
          const questionAnswersMap = new Map();
          responseInfo.questions_with_answers.forEach(q => {
            questionAnswersMap.set(q.id, q.answer_count);
          });
          
          // Update each question with a hasAnswers flag for direct checking
          const updatedQuestions = currentQuestions.map(q => {
            // Check if this question has a database ID and has answers
            if (q.id && typeof q.id === 'number' && questionAnswersMap.has(q.id)) {
              return {
                ...q,
                hasAnswers: true,
                answerCount: questionAnswersMap.get(q.id)
              };
            }
            return q;
          });
          
          // Update the form with this enhanced data
          methods.setValue('questions', updatedQuestions);
          console.log('Enhanced question data with answer info:', updatedQuestions);
        }
      }
    } catch (error) {
      console.error('Failed to check for survey responses:', error);
      // Default to safe values
      setHasResponses(false);
      setQuestionsWithAnswers([]);
    }
  };

  // Debug function to examine questions in a survey
  const debugQuestions = async (surveyId?: string) => {
    if (!surveyId) {
      console.error("Cannot debug questions - no survey ID provided");
      return;
    }
    
    try {
      console.log(`Debugging questions for survey ${surveyId}...`);
      const result = await debugSurveyQuestions(surveyId);
      console.log("DEBUG QUESTIONS RESULT:", result);
      
      if (result.questions?.length > 0) {
        console.table(result.questions.map((q: any) => ({
          id: q.id,
          order: q.order,
          type: q.type,
          text: q.first_question_text?.substring(0, 30) + (q.first_question_text?.length > 30 ? '...' : ''),
          answers: q.answer_count
        })));
      }
    } catch (error) {
      console.error("Error debugging questions:", error);
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} className="space-y-8">
        {/* Template Selection */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="templateSelect">{t('form.templateSelect')}</Label>
                <Select 
                  value={selectedTemplateId} 
                  onValueChange={handleTemplateSelect}
                >
                  <SelectTrigger id="templateSelect">
                    <SelectValue placeholder={t('form.selectTemplate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                onClick={applyTemplateData}
                disabled={!selectedTemplateId}
              >
                {t('form.applyTemplate')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">{t('form.tabs.general')}</TabsTrigger>
            <TabsTrigger value="questions">{t('form.tabs.questions')}</TabsTrigger>
            <TabsTrigger value="end-messages">{t('form.tabs.endMessages')}</TabsTrigger>
            <TabsTrigger value="project-info">{t('form.tabs.projectInfo')}</TabsTrigger>
          </TabsList>

          {/* General Info Tab */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="languages">{t('form.fields.languages')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_LANGUAGES.map(lang => (
                      <Badge 
                        key={lang.code}
                        variant={selectedLanguages.includes(lang.code) ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/90"
                        onClick={() => toggleLanguage(lang.code)}
                      >
                        {lang.name}
                        {selectedLanguages.includes(lang.code) && (
                          <XMarkIcon className="w-3 h-3 ml-1" />
                        )}
                      </Badge>
                    ))}
                  </div>
                  {methods.formState.errors.languages && (
                    <p className="text-sm text-red-500 mt-1">
                      {methods.formState.errors.languages.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">{t('form.fields.title')}</Label>
                  <Input
                    id="title"
                    {...methods.register('title')}
                    placeholder={t('form.placeholders.title')}
                  />
                  {formState.errors.title && (
                    <p className="text-sm text-red-500">{formState.errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t('form.fields.description')}</Label>
                  <Textarea
                    id="description"
                    {...methods.register('description')}
                    placeholder={t('form.placeholders.description')}
                  />
                </div>

                {/* Multilingual titles and descriptions */}
                {selectedLanguages.length > 0 && selectedLanguages.map(lang => (
                  <React.Fragment key={`lang-${lang}`}>
                    {lang !== 'en' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`headlines.${lang}`}>
                            {t('form.fields.titleWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                          </Label>
                          <Input 
                            id={`headlines.${lang}`}
                            placeholder={t('form.placeholders.titleWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                            {...methods.register(`headlines.${lang}`)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`survey_texts.${lang}`}>
                            {t('form.fields.descriptionWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                          </Label>
                          <Textarea 
                            id={`survey_texts.${lang}`}
                            placeholder={t('form.placeholders.descriptionWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                            {...methods.register(`survey_texts.${lang}`)}
                          />
                        </div>
                      </>
                    )}
                  </React.Fragment>
                ))}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="format">{t('form.fields.format')}</Label>
                    <select
                      id="format"
                      {...methods.register('format')}
                      className="w-full p-2 border rounded"
                    >
                      <option value="online">{t('form.options.format.online')}</option>
                      <option value="face_to_face">{t('form.options.format.faceToFace')}</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="type">{t('form.fields.type')}</Label>
                    <select
                      id="type"
                      {...methods.register('type')}
                      className="w-full p-2 border rounded"
                    >
                      <option value="public">{t('form.options.type.public')}</option>
                      <option value="friends_family">{t('form.options.type.friendsFamily')}</option>
                      <option value="professional">{t('form.options.type.professional')}</option>
                      <option value="single_company">{t('form.options.type.singleCompany')}</option>
                      <option value="intracompany">{t('form.options.type.intracompany')}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_datetime">{t('form.fields.startDateTime')}</Label>
                    <Input
                      type="datetime-local"
                      id="start_datetime"
                      {...methods.register('start_datetime', {
                        setValueAs: (value) => value || undefined // Ensure empty strings are converted to undefined
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="expiry_date">{t('form.fields.expiryDate')}</Label>
                    <Input
                      type="datetime-local"
                      id="expiry_date"
                      {...methods.register('expiry_date', {
                        setValueAs: (value) => value || undefined // Ensure empty strings are converted to undefined
                      })}
                    />
                  </div>
                </div>

                <div>
                  <Label>
                    <input
                      type="checkbox"
                      {...methods.register('is_active')}
                      className="mr-2"
                    />
                    {t('form.fields.isActive')}
                  </Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions">
            <Card>
              <CardHeader>
                <CardTitle>{t('questions.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <QuestionForm 
                  languages={selectedLanguages} 
                  questionsWithAnswers={questionsWithAnswers}
                  hasResponses={hasResponses}
                  showDeleteWarning={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* End Messages Tab */}
          <TabsContent value="end-messages" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-medium">{t('form.sections.startMessages')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('form.sections.startMessages')} {t('form.fieldsDescription')}
                </p>

                <div className="space-y-2">
                  <Label htmlFor="start_survey_title">
                    {t('form.fields.startTitle')}
                  </Label>
                  <Input 
                    id="start_survey_title" 
                    placeholder={t('form.placeholders.startTitle')}
                    {...methods.register('start_survey_title')} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_survey_text">
                    {t('form.fields.startMessage')}
                  </Label>
                  <Textarea 
                    id="start_survey_text" 
                    placeholder={t('form.placeholders.startMessage')}
                    {...methods.register('start_survey_text')} 
                  />
                </div>

                {selectedLanguages.length > 0 && selectedLanguages.filter(lang => lang !== 'en').map((lang: string) => (
                  <React.Fragment key={`start-${lang}`}>
                    <div className="space-y-2">
                      <Label htmlFor={`start_survey_titles.${lang}`}>
                        {t('form.fields.startTitleWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                      </Label>
                      <Input 
                        id={`start_survey_titles.${lang}`}
                        placeholder={t('form.placeholders.startTitleWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                        {...methods.register(`start_survey_titles.${lang}`)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`start_survey_texts.${lang}`}>
                        {t('form.fields.startMessageWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                      </Label>
                      <Textarea 
                        id={`start_survey_texts.${lang}`}
                        placeholder={t('form.placeholders.startMessageWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                        {...methods.register(`start_survey_texts.${lang}`)}
                      />
                    </div>
                  </React.Fragment>
                ))}

                <h3 className="text-lg font-medium mt-8">{t('form.sections.endMessages')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('form.sections.endMessages')} {t('form.fieldsDescription')}
                </p>

                <div className="space-y-2">
                  <Label htmlFor="end_survey_title">
                    {t('form.fields.endTitle')}
                  </Label>
                  <Input 
                    id="end_survey_title" 
                    placeholder={t('form.placeholders.endTitle')}
                    {...methods.register('end_survey_title')} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_survey_text">
                    {t('form.fields.endMessage')}
                  </Label>
                  <Textarea 
                    id="end_survey_text" 
                    placeholder={t('form.placeholders.endMessage')}
                    {...methods.register('end_survey_text')} 
                  />
                </div>

                {selectedLanguages.length > 0 && selectedLanguages.filter(lang => lang !== 'en').map((lang: string) => (
                  <React.Fragment key={`end-${lang}`}>
                    <div className="space-y-2">
                      <Label htmlFor={`end_survey_titles.${lang}`}>
                        {t('form.fields.endTitleWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                      </Label>
                      <Input 
                        id={`end_survey_titles.${lang}`}
                        placeholder={t('form.placeholders.endTitleWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                        {...methods.register(`end_survey_titles.${lang}`)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`end_survey_texts.${lang}`}>
                        {t('form.fields.endMessageWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                      </Label>
                      <Textarea 
                        id={`end_survey_texts.${lang}`}
                        placeholder={t('form.placeholders.endMessageWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                        {...methods.register(`end_survey_texts.${lang}`)}
                      />
                    </div>
                  </React.Fragment>
                ))}

                <h3 className="text-lg font-medium mt-8">{t('form.sections.expiredMessages')}</h3>

                <div className="space-y-2">
                  <Label htmlFor="expired_survey_title">
                    {t('form.fields.expiredTitle')}
                  </Label>
                  <Input 
                    id="expired_survey_title" 
                    placeholder={t('form.placeholders.expiredTitle')}
                    {...methods.register('expired_survey_title')} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expired_survey_text">
                    {t('form.fields.expiredMessage')}
                  </Label>
                  <Textarea 
                    id="expired_survey_text" 
                    placeholder={t('form.placeholders.expiredMessage')}
                    {...methods.register('expired_survey_text')} 
                  />
                </div>

                {selectedLanguages.length > 0 && selectedLanguages.filter(lang => lang !== 'en').map((lang: string) => (
                  <React.Fragment key={`expired-${lang}`}>
                    <div className="space-y-2">
                      <Label htmlFor={`expired_survey_titles.${lang}`}>
                        {t('form.fields.expiredTitleWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                      </Label>
                      <Input 
                        id={`expired_survey_titles.${lang}`}
                        placeholder={t('form.placeholders.expiredTitleWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                        {...methods.register(`expired_survey_titles.${lang}`)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`expired_survey_texts.${lang}`}>
                        {t('form.fields.expiredMessageWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                      </Label>
                      <Textarea 
                        id={`expired_survey_texts.${lang}`}
                        placeholder={t('form.placeholders.expiredMessageWithLanguage', { language: AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name })}
                        {...methods.register(`expired_survey_texts.${lang}`)}
                      />
                    </div>
                  </React.Fragment>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Project Info Tab */}
          <TabsContent value="project-info" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>
                      {t('form.fields.publicAccessTokens')}
                      <span className="ml-2 text-sm text-gray-500">
                        {t('form.fields.publicAccessTokensHint')}
                      </span>
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addToken}
                    >
                      {t('form.actions.addToken')}
                    </Button>
                  </div>
                  
                  <div className="space-y-4 mt-2">
                    {tokens.map((token, index) => (
                      <div key={index} className="flex gap-2 items-start border p-3 rounded-md bg-gray-50">
                        <div className="flex-1 space-y-2">
                          <div>
                            <Label htmlFor={`token-${index}`}>{t('form.fields.token')}</Label>
                            <div className="flex gap-2">
                              <Input
                                id={`token-${index}`}
                                value={token.token}
                                onChange={(e) => updateToken(index, 'token', e.target.value)}
                                placeholder={t('form.placeholders.token')}
                                className="text-sm"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => updateToken(index, 'token', generateToken())}
                              >
                                {t('form.actions.generate')}
                              </Button>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor={`description-${index}`}>{t('form.fields.tokenDescription')}</Label>
                            <Input
                              id={`description-${index}`}
                              value={token.description}
                              onChange={(e) => updateToken(index, 'description', e.target.value)}
                              placeholder={t('form.placeholders.tokenDescription')}
                              className="text-sm"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeToken(index)}
                          disabled={tokens.length <= 1}
                        >
                          {t('form.actions.remove')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {initialData?.id && (
                  <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                    <h3 className="text-sm font-medium mb-2">{t('form.sections.publicAccessInfo')}</h3>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        {t('form.messages.qrCodesAvailable')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-medium mb-4">{t('form.sections.locationInfo')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">{t('form.fields.city')}</Label>
                      <Input
                        id="city"
                        {...methods.register('city')}
                        placeholder={t('form.placeholders.city')}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">{t('form.fields.country')}</Label>
                      <Input
                        id="country"
                        {...methods.register('country')}
                        placeholder={t('form.placeholders.country')}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Template Apply Dialog */}
        <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('form.applyTemplateConfirmTitle')}</DialogTitle>
              <DialogDescription>
                {t('form.applyTemplateConfirm')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
                {t('actions.cancel')}
              </Button>
              <Button onClick={confirmApplyTemplate}>
                {t('form.applyTemplate')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="space-y-4">
          {/* Show any form-level errors */}
          {Object.keys(formState.errors).length > 0 && (
            <div className="text-red-500 text-sm">
              <p>{t('form.messages.pleaseFixErrors')}</p>
              <ul className="list-disc list-inside">
                {Object.entries(formState.errors).map(([key, error]) => {
                  // Map field keys to translation keys
                  const fieldMap: Record<string, string> = {
                    title: 'form.fields.title',
                    description: 'form.fields.description',
                    languages: 'form.fields.languages',
                    format: 'form.fields.format',
                    type: 'form.fields.type',
                    token: 'form.fields.token',
                    tokens: 'form.fields.tokens',
                    questions: 'form.fields.questions',
                    expiry_date: 'form.fields.expiryDate',
                    analysis_cluster: 'form.fields.analysisCluster',
                    city: 'form.fields.city',
                    country: 'form.fields.country',
                    template: 'form.fields.template',
                    start_survey_titles: 'form.fields.start_survey_titles',
                    start_survey_texts: 'form.fields.start_survey_texts',
                    end_survey_titles: 'form.fields.end_survey_titles',
                    end_survey_texts: 'form.fields.end_survey_texts',
                    expired_survey_titles: 'form.fields.expired_survey_titles',
                    expired_survey_texts: 'form.fields.expired_survey_texts'
                  };

                  // Get a human-readable field name
                  const getFieldName = (key: string): string => {
                    // Check if it's a nested field (contains dots)
                    if (key.includes('.')) {
                      const parts = key.split('.');
                      // Handle language-specific fields like start_survey_titles.de
                      if (parts.length === 2) {
                        const fieldKey = parts[0];
                        const lang = parts[1];
                        const field = t(fieldMap[fieldKey] || fieldKey);
                        const langName = AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name || lang.toUpperCase();
                        return `${field} (${langName})`;
                      }
                      // Handle nested fields in arrays like tokens[0].token
                      if (parts[0] === 'tokens' && parts.length === 3) {
                        const index = parseInt(parts[1]) + 1;
                        const field = parts[2] === 'token' ? 'Token Value' : 
                                     parts[2] === 'description' ? 'Description' : parts[2];
                        return `Token ${index} ${field}`;
                      }
                    }
                    
                    // Regular field
                    return t(fieldMap[key] || key);
                  };
                  
                  // Generate appropriate error message
                  let errorMessage = '';
                  
                  if (error?.message) {
                    // Use error message from validation if available
                    errorMessage = `${getFieldName(key)}: ${error.message.toString()}`;
                  } else if (key === 'tokens') {
                    // Handle tokens array validation
                    errorMessage = t('form.errors.tokensValidation');
                  } else if (key === 'template') {
                    // Handle template field specifically
                    errorMessage = t('form.errors.templateRequired');
                  } else if (key.includes('.')) {
                    // Handle nested fields
                    const parts = key.split('.');
                    if (parts.length === 2) {
                      // Field with language code like start_survey_titles.de
                      const fieldKey = parts[0];
                      const lang = parts[1];
                      const field = t(fieldMap[fieldKey] || fieldKey);
                      const langName = AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name || lang.toUpperCase();
                      
                      errorMessage = t('form.errors.requiredLanguageField', { 
                        field, 
                        language: langName 
                      });
                    } else if (parts[0] === 'tokens' && parts.length === 3) {
                      // Handle token array items
                      const index = parseInt(parts[1]) + 1;
                      const field = parts[2] === 'token' ? 'value' : parts[2];
                      errorMessage = t('form.errors.tokenFieldRequired', { index, field });
                    } else {
                      // Default for other nested fields
                      errorMessage = t('form.errors.fieldRequired', { field: getFieldName(key) });
                    }
                  } else {
                    // Default for simple fields
                    errorMessage = t('form.errors.fieldRequired', { field: getFieldName(key) });
                  }
                  
                  return <li key={key}>{errorMessage}</li>;
                })}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('form.actions.saving')}
                </span>
              ) : (
                t(initialData ? 'form.actions.update' : 'form.actions.create')
              )}
            </Button>
          </div>
        </div>

        {/* Debug button - only in development */}
        {process.env.NODE_ENV === 'development' && initialData?.id && (
          <Card className="mb-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{t('survey.title')}</CardTitle>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => debugQuestions(initialData.id?.toString())}
                >
                  Debug Questions
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}
      </form>
    </FormProvider>
  );
} 