import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from "@/components/ui/card";
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
import QuestionForm from './QuestionForm';
import { format } from 'date-fns';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

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
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  headlines: z.record(z.string(), z.string()).optional(),
  survey_texts: z.record(z.string(), z.string()).optional(),
  is_active: z.boolean().default(true),
  languages: z.array(z.string()).min(1, "At least one language is required"),
  questions: z.array(questionSchema).default([]),
  end_survey_title: z.string().optional(),
  end_survey_text: z.string().optional(),
  end_survey_titles: z.record(z.string(), z.string()).optional(),
  end_survey_texts: z.record(z.string(), z.string()).optional(),
  expired_survey_title: z.string().optional(),
  expired_survey_text: z.string().optional(),
  expired_survey_titles: z.record(z.string(), z.string()).optional(),
  expired_survey_texts: z.record(z.string(), z.string()).optional(),
  expiry_date: z.date().optional().nullable(),
  // Project info fields
  building_name: z.string().optional(),
  project_name: z.string().optional(),
  project_description: z.string().optional(),
  // Address fields
  street: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
});

type SurveyFormValues = z.infer<typeof surveySchema>;

interface SurveyFormProps {
  initialData?: Partial<Survey>;
  onSubmit: (data: SurveyFormValues) => void;
  isLoading?: boolean;
}

export default function SurveyForm({ initialData, onSubmit, isLoading = false }: SurveyFormProps) {
  // Form methods
  const methods = useForm<SurveyFormValues>({
    resolver: zodResolver(surveySchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      headlines: initialData?.headlines || {},
      survey_texts: initialData?.survey_texts || {},
      is_active: initialData?.is_active ?? true,
      languages: initialData?.languages || ['en'],
      questions: initialData?.questions?.map((q, index) => {
        // Ensure each question has all required fields properly initialized
        const questions = { ...q.questions };
        const placeholders = { ...q.placeholders };
        
        // Initialize empty strings for any missing language
        (initialData?.languages || ['en']).forEach(lang => {
          if (!questions[lang]) questions[lang] = '';
          if (!placeholders[lang]) placeholders[lang] = '';
        });
        
        return {
          ...q,
          id: q.id,
          order: index + 1,
          questions: questions,
          is_required: q.is_required ?? true,
          placeholders: placeholders,
          type: q.type || 'nps'
        };
      }) || [],
      end_survey_title: initialData?.end_survey_title || '',
      end_survey_text: initialData?.end_survey_text || '',
      end_survey_titles: initialData?.end_survey_titles || {},
      end_survey_texts: initialData?.end_survey_texts || {},
      expired_survey_title: initialData?.expired_survey_title || '',
      expired_survey_text: initialData?.expired_survey_text || '',
      expired_survey_titles: initialData?.expired_survey_titles || {},
      expired_survey_texts: initialData?.expired_survey_texts || {},
      expiry_date: initialData?.expiry_date ? 
        typeof initialData.expiry_date === 'string' ? 
          new Date(initialData.expiry_date) : 
          initialData.expiry_date : 
        undefined,
      building_name: initialData?.building_name || '',
      project_name: initialData?.project_name || '',
      project_description: initialData?.project_description || '',
      street: initialData?.street || '',
      city: initialData?.city || '',
      postal_code: initialData?.postal_code || '',
      country: initialData?.country || '',
    },
    mode: 'onChange'
  });

  const selectedLanguages = methods.watch('languages');
  const formState = methods.formState;

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

  // Handle form submission
  const handleSubmit = async (data: SurveyFormValues) => {
    console.log('Form submission started');
    console.log('Raw form data:', data);
    
    // Validate questions have text for all languages
    const hasValidQuestions = data.questions.every((q, qIndex) => {
      return data.languages.every(lang => {
        const hasText = q.questions[lang] && q.questions[lang].trim() !== '';
        if (!hasText) {
          methods.setError(`questions.${qIndex}.questions.${lang}`, {
            type: 'custom',
            message: `Question ${qIndex + 1} is missing text for language: ${lang}`
          });
        }
        return hasText;
      });
    });

    if (!hasValidQuestions) {
      console.log('Question validation failed');
      return;
    }
    
    // Format the data for submission
    const formattedData = {
      ...data,
      questions: data.questions.map((q, index) => {
        // Clean up empty strings in questions and placeholders
        const questions = Object.fromEntries(
          Object.entries(q.questions).filter(([_, value]) => value.trim() !== '')
        );
        
        const placeholders = Object.fromEntries(
          Object.entries(q.placeholders || {}).filter(([_, value]) => value.trim() !== '')
        );
        
        return {
          ...q,
          order: index + 1,
          questions: questions,
          is_required: q.is_required ?? true,
          placeholders: placeholders
        };
      })
    };
    
    console.log('Formatted data for submission:', formattedData);
    await onSubmit(formattedData);
  };

  // Handle language toggle
  const toggleLanguage = (langCode: string) => {
    const currentLangs = methods.getValues('languages');
    if (currentLangs.includes(langCode)) {
      if (currentLangs.length > 1) { // Ensure at least one language remains selected
        methods.setValue('languages', currentLangs.filter(code => code !== langCode));
      }
    } else {
      methods.setValue('languages', [...currentLangs, langCode]);
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} className="space-y-8">
        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General Info</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="end-messages">End Messages</TabsTrigger>
            <TabsTrigger value="project-info">Project Info</TabsTrigger>
          </TabsList>

          {/* General Info Tab */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="languages">Survey Languages</Label>
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
                  <Label htmlFor="title">Title</Label>
                  <Input 
                    id="title" 
                    placeholder="Survey Title" 
                    {...methods.register('title')} 
                  />
                  {methods.formState.errors.title && (
                    <p className="text-sm text-red-500 mt-1">
                      {methods.formState.errors.title.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Survey Description" 
                    {...methods.register('description')} 
                  />
                </div>

                {/* Multilingual titles and descriptions */}
                {selectedLanguages.length > 0 && selectedLanguages.map(lang => (
                  <React.Fragment key={`lang-${lang}`}>
                    {lang !== 'en' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`headlines.${lang}`}>
                            Title - {AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name}
                          </Label>
                          <Input 
                            id={`headlines.${lang}`}
                            placeholder={`Title in ${AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name}`}
                            {...methods.register(`headlines.${lang}`)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`survey_texts.${lang}`}>
                            Description - {AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name}
                          </Label>
                          <Textarea 
                            id={`survey_texts.${lang}`}
                            placeholder={`Description in ${AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name}`}
                            {...methods.register(`survey_texts.${lang}`)}
                          />
                        </div>
                      </>
                    )}
                  </React.Fragment>
                ))}

                <div className="space-y-2">
                  <Label htmlFor="expiry_date">Expiry Date (Optional)</Label>
                  <DatePicker 
                    date={methods.watch('expiry_date') || undefined}
                    setDate={(date) => methods.setValue('expiry_date', date || undefined)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={methods.watch('is_active')}
                    onCheckedChange={(checked) => methods.setValue('is_active', checked)}
                  />
                  <Label htmlFor="is_active">Active Survey</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions">
            <QuestionForm languages={selectedLanguages} />
            {methods.formState.errors.questions && (
              <p className="text-sm text-red-500 mt-1">
                {methods.formState.errors.questions.message}
              </p>
            )}
          </TabsContent>

          {/* End Messages Tab */}
          <TabsContent value="end-messages" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <h3 className="text-lg font-medium">Completion Messages</h3>

                <div className="space-y-2">
                  <Label htmlFor="end_survey_title">End Survey Title</Label>
                  <Input 
                    id="end_survey_title" 
                    placeholder="Thank you for your feedback" 
                    {...methods.register('end_survey_title')} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_survey_text">End Survey Message</Label>
                  <Textarea 
                    id="end_survey_text" 
                    placeholder="Your feedback is valuable to us" 
                    {...methods.register('end_survey_text')} 
                  />
                </div>

                {/* Multilingual end messages */}
                {selectedLanguages.length > 0 && selectedLanguages.map(lang => (
                  <React.Fragment key={`end-${lang}`}>
                    {lang !== 'en' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`end_survey_titles.${lang}`}>
                            End Title - {AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name}
                          </Label>
                          <Input 
                            id={`end_survey_titles.${lang}`}
                            placeholder={`End title in ${AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name}`}
                            {...methods.register(`end_survey_titles.${lang}`)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`end_survey_texts.${lang}`}>
                            End Message - {AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name}
                          </Label>
                          <Textarea 
                            id={`end_survey_texts.${lang}`}
                            placeholder={`End message in ${AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name}`}
                            {...methods.register(`end_survey_texts.${lang}`)}
                          />
                        </div>
                      </>
                    )}
                  </React.Fragment>
                ))}

                <h3 className="text-lg font-medium mt-8">Expired Survey Messages</h3>

                <div className="space-y-2">
                  <Label htmlFor="expired_survey_title">Expired Survey Title</Label>
                  <Input 
                    id="expired_survey_title" 
                    placeholder="Survey Expired" 
                    {...methods.register('expired_survey_title')} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expired_survey_text">Expired Survey Message</Label>
                  <Textarea 
                    id="expired_survey_text" 
                    placeholder="This survey is no longer available" 
                    {...methods.register('expired_survey_text')} 
                  />
                </div>

                {/* Multilingual expired messages */}
                {selectedLanguages.length > 0 && selectedLanguages.map(lang => (
                  <React.Fragment key={`expired-${lang}`}>
                    {lang !== 'en' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`expired_survey_titles.${lang}`}>
                            Expired Title - {AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name}
                          </Label>
                          <Input 
                            id={`expired_survey_titles.${lang}`}
                            placeholder={`Expired title in ${AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name}`}
                            {...methods.register(`expired_survey_titles.${lang}`)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`expired_survey_texts.${lang}`}>
                            Expired Message - {AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name}
                          </Label>
                          <Textarea 
                            id={`expired_survey_texts.${lang}`}
                            placeholder={`Expired message in ${AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name}`}
                            {...methods.register(`expired_survey_texts.${lang}`)}
                          />
                        </div>
                      </>
                    )}
                  </React.Fragment>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Project Info Tab */}
          <TabsContent value="project-info" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-medium">Project Information</h3>

                <div className="space-y-2">
                  <Label htmlFor="building_name">Building Name</Label>
                  <Input 
                    id="building_name" 
                    placeholder="Building Name" 
                    {...methods.register('building_name')} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project_name">Project Name</Label>
                  <Input 
                    id="project_name" 
                    placeholder="Project Name" 
                    {...methods.register('project_name')} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project_description">Project Description</Label>
                  <Textarea 
                    id="project_description" 
                    placeholder="Project Description" 
                    {...methods.register('project_description')} 
                  />
                </div>

                <h3 className="text-lg font-medium mt-6">Address</h3>

                <div className="space-y-2">
                  <Label htmlFor="street">Street</Label>
                  <Input 
                    id="street" 
                    placeholder="Street" 
                    {...methods.register('street')} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input 
                      id="city" 
                      placeholder="City" 
                      {...methods.register('city')} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input 
                      id="postal_code" 
                      placeholder="Postal Code" 
                      {...methods.register('postal_code')} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input 
                    id="country" 
                    placeholder="Country" 
                    {...methods.register('country')} 
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          {/* Show any form-level errors */}
          {Object.keys(formState.errors).length > 0 && (
            <div className="text-red-500 text-sm">
              <p>Please fix the following errors:</p>
              <ul className="list-disc list-inside">
                {Object.entries(formState.errors).map(([key, error]) => (
                  <li key={key}>{error?.message?.toString() || `Invalid ${key}`}</li>
                ))}
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
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
} 