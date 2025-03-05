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
import { toast } from "@/components/ui/use-toast";

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
  max_participants: z.string().transform(val => parseInt(val) || 100),
  expiry_date: z.date().nullable().optional(),
  analysis_end_date: z.date().nullable().optional(),
  analysis_cluster: z.string().optional(),
  building_name: z.string().optional(),
  short_id: z.string().optional(),
  project_description: z.string().optional(),
  street_number: z.string().optional(),
  city_code: z.string().optional(),
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
      // Get the first language's end survey messages from the respective objects
      end_survey_title: initialData?.end_survey_titles?.[initialData?.languages?.[0] || 'en'] || '',
      end_survey_text: initialData?.end_survey_texts?.[initialData?.languages?.[0] || 'en'] || '',
      end_survey_titles: initialData?.end_survey_titles || {},
      end_survey_texts: initialData?.end_survey_texts || {},
      // Get the first language's expired survey messages from the respective objects
      expired_survey_title: initialData?.expired_survey_titles?.[initialData?.languages?.[0] || 'en'] || '',
      expired_survey_text: initialData?.expired_survey_texts?.[initialData?.languages?.[0] || 'en'] || '',
      expired_survey_titles: initialData?.expired_survey_titles || {},
      expired_survey_texts: initialData?.expired_survey_texts || {},
      expiry_date: initialData?.expiry_date ? 
        typeof initialData.expiry_date === 'string' ? 
          new Date(initialData.expiry_date) : 
          initialData.expiry_date : 
        undefined,
      // Add default values for required fields
      format: initialData?.format || 'online',
      type: initialData?.type || 'public',
      max_participants: initialData?.max_participants?.toString() || '100',
      building_name: initialData?.building_name || '',
      project_name: initialData?.project_name || '',
      project_description: initialData?.project_description || '',
      token: initialData?.token || '',
      street: initialData?.street || '',
      city: initialData?.city || '',
      postal_code: initialData?.postal_code || '',
      country: initialData?.country || '',
      tokens: initialData?.tokens || [],
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

  // Handle form submission
  const handleSubmit = async (data: SurveyFormValues) => {
    console.log('Form submission started');
    
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
    
    console.log('Raw form data:', data);
    
    // Format the data for submission
    const formattedData = {
      ...data,
      // Format expiry_date to ISO string if it exists
      expiry_date: data.expiry_date ? new Date(data.expiry_date).toISOString() : null,
      // Save first language's end survey messages into the respective objects
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
      }),
      // Add the tokens from our state
      tokens: tokens
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

                {/* Add Survey Format field */}
                <div className="space-y-2">
                  <Label htmlFor="format">Survey Format</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    id="format" 
                    {...methods.register('format')}
                    defaultValue=""
                  >
                    <option value="" disabled>Select Format</option>
                    <option value="online">Online</option>
                    <option value="face_to_face">Face to Face</option>
                  </select>
                  {methods.formState.errors.format && (
                    <p className="text-sm text-red-500 mt-1">
                      {methods.formState.errors.format.message || "Survey Format is required"}
                    </p>
                  )}
                </div>

                {/* Add Survey Type field */}
                <div className="space-y-2">
                  <Label htmlFor="type">Survey Type</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    id="type" 
                    {...methods.register('type')}
                    defaultValue=""
                  >
                    <option value="" disabled>Select Type</option>
                    <option value="friends_family">Friends and Family</option>
                    <option value="public">Public</option>
                    <option value="professional">Professional</option>
                    <option value="single_company">Single Company</option>
                    <option value="intracompany">Intracompany</option>
                  </select>
                  {methods.formState.errors.type && (
                    <p className="text-sm text-red-500 mt-1">
                      {methods.formState.errors.type.message || "Survey Type is required"}
                    </p>
                  )}
                </div>

                {/* Add Maximum Participants field */}
                <div className="space-y-2">
                  <Label htmlFor="max_participants">Maximum Participants</Label>
                  <Input 
                    id="max_participants" 
                    type="number"
                    placeholder="100" 
                    {...methods.register('max_participants')} 
                  />
                  {methods.formState.errors.max_participants && (
                    <p className="text-sm text-red-500 mt-1">
                      {methods.formState.errors.max_participants.message || "Maximum Participants is required"}
                    </p>
                  )}
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
                <h3 className="text-lg font-medium">End Survey Messages</h3>

                <div className="space-y-2">
                  <Label htmlFor="end_survey_title">
                    End Survey Title ({selectedLanguages[0]?.toUpperCase()})
                  </Label>
                  <Input 
                    id="end_survey_title" 
                    placeholder={`Thank you for your feedback (${selectedLanguages[0]?.toUpperCase()})`}
                    {...methods.register('end_survey_title')} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_survey_text">
                    End Survey Message ({selectedLanguages[0]?.toUpperCase()})
                  </Label>
                  <Textarea 
                    id="end_survey_text" 
                    placeholder={`Your feedback is valuable to us (${selectedLanguages[0]?.toUpperCase()})`}
                    {...methods.register('end_survey_text')} 
                  />
                </div>

                {selectedLanguages.length > 0 && selectedLanguages.slice(1).map((lang: string) => (
                  <React.Fragment key={`end-${lang}`}>
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
                  </React.Fragment>
                ))}

                <h3 className="text-lg font-medium mt-8">Expired Survey Messages</h3>

                <div className="space-y-2">
                  <Label htmlFor="expired_survey_title">
                    Expired Survey Title ({selectedLanguages[0]?.toUpperCase()})
                  </Label>
                  <Input 
                    id="expired_survey_title" 
                    placeholder={`Survey Expired (${selectedLanguages[0]?.toUpperCase()})`}
                    {...methods.register('expired_survey_title')} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expired_survey_text">
                    Expired Survey Message ({selectedLanguages[0]?.toUpperCase()})
                  </Label>
                  <Textarea 
                    id="expired_survey_text" 
                    placeholder={`This survey is no longer available (${selectedLanguages[0]?.toUpperCase()})`}
                    {...methods.register('expired_survey_text')} 
                  />
                </div>

                {selectedLanguages.length > 0 && selectedLanguages.slice(1).map((lang: string) => (
                  <React.Fragment key={`expired-${lang}`}>
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
                  <Label htmlFor="building_name">Building Name</Label>
                  <Input
                    id="building_name"
                    {...methods.register('building_name')}
                    placeholder="Enter building name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project_name">Project Name</Label>
                  <Input
                    id="project_name"
                    {...methods.register('project_name')}
                    placeholder="Enter project name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project_description">Project Description</Label>
                  <Textarea
                    id="project_description"
                    {...methods.register('project_description')}
                    placeholder="Enter project description"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>
                      Public Access Tokens
                      <span className="ml-2 text-sm text-gray-500">
                        (Required for QR codes and public access)
                      </span>
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addToken}
                    >
                      Add Token
                    </Button>
                  </div>
                  
                  <div className="space-y-4 mt-2">
                    {tokens.map((token, index) => (
                      <div key={index} className="flex gap-2 items-start border p-3 rounded-md bg-gray-50">
                        <div className="flex-1 space-y-2">
                          <div>
                            <Label htmlFor={`token-${index}`}>Token</Label>
                            <div className="flex gap-2">
                              <Input
                                id={`token-${index}`}
                                value={token.token}
                                onChange={(e) => updateToken(index, 'token', e.target.value)}
                                placeholder="Enter token"
                                className="text-sm"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => updateToken(index, 'token', generateToken())}
                              >
                                Generate
                              </Button>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor={`description-${index}`}>Description</Label>
                            <Input
                              id={`description-${index}`}
                              value={token.description}
                              onChange={(e) => updateToken(index, 'description', e.target.value)}
                              placeholder="Enter description (e.g., Group A, Office Staff)"
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
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {initialData?.id && (
                  <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                    <h3 className="text-sm font-medium mb-2">Public Access Information</h3>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        QR Codes will be available after saving the survey in the survey details page.
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-medium mb-4">Location Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="street">Street</Label>
                      <Input
                        id="street"
                        {...methods.register('street')}
                        placeholder="Enter street"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        {...methods.register('city')}
                        placeholder="Enter city"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Postal Code</Label>
                      <Input
                        id="postal_code"
                        {...methods.register('postal_code')}
                        placeholder="Enter postal code"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        {...methods.register('country')}
                        placeholder="Enter country"
                      />
                    </div>
                  </div>
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
                {Object.entries(formState.errors).map(([key, error]) => {
                  // Map field keys to user-friendly names
                  const fieldMap: Record<string, string> = {
                    title: "Title",
                    description: "Description",
                    languages: "Languages",
                    format: "Survey Format",
                    type: "Survey Type",
                    max_participants: "Maximum Participants",
                    token: "Access Token",
                    tokens: "Access Tokens",
                    questions: "Questions",
                    expiry_date: "Expiry Date",
                    analysis_end_date: "Analysis End Date",
                    analysis_cluster: "Analysis Cluster",
                    building_name: "Building Name",
                    project_name: "Project Name",
                    project_description: "Project Description",
                    street: "Street",
                    postal_code: "Postal Code",
                    city: "City",
                    country: "Country",
                  };

                  // Get user-friendly field name or fallback to the key
                  const fieldName = fieldMap[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
                  
                  // Create a proper error message
                  let errorMessage = '';
                  
                  if (error?.message) {
                    // Use the provided error message if available
                    errorMessage = `${fieldName}: ${error.message.toString()}`;
                  } else if (key === 'tokens') {
                    // Special handling for tokens array
                    errorMessage = `${fieldName}: Please ensure all tokens have valid values and descriptions`;
                  } else {
                    // Default required message with field name
                    errorMessage = `The "${fieldName}" field is required`;
                  }
                  
                  // Handle nested errors (like tokens.0.token)
                  if (key.includes('.')) {
                    const parts = key.split('.');
                    if (parts[0] === 'tokens' && parts.length === 3) {
                      const index = parseInt(parts[1]) + 1;
                      const field = parts[2] === 'token' ? 'value' : parts[2];
                      errorMessage = `Token #${index}: The ${field} is required`;
                    }
                  }
                  
                  console.log(`Error for ${key}:`, error);
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