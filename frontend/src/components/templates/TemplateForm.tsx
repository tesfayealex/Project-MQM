'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Template } from '@/types/template';
import { CustomWordCluster } from '@/types/cluster';
import { QuestionType } from '@/types/survey';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from 'react-i18next';
import { getCookie } from 'cookies-next';
import { useLanguage } from '@/contexts/language-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getActiveClusters, createCustomCluster } from '@/lib/services/cluster-service';

// Available languages
const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
];

// Define our own question type to match the zod schema
interface TemplateQuestion {
  id?: string | number;
  order: number;
  type: QuestionType;
  questions: Record<string, string>;
  language?: string;
  is_required: boolean;
  placeholders: Record<string, string>;
}

// Question schema for the form
const questionSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  order: z.number(),
  type: z.enum(['nps', 'free_text']),
  questions: z.record(z.string(), z.string()),
  language: z.string().optional(),
  is_required: z.boolean().default(true),
  placeholders: z.record(z.string(), z.string()).default({})
});

// Validation schema
const templateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  headlines: z.record(z.string()).optional(),
  survey_texts: z.record(z.string()).optional(),
  start_survey_titles: z.record(z.string()).optional(),
  start_survey_texts: z.record(z.string()).optional(),
  end_survey_titles: z.record(z.string()).optional(),
  end_survey_texts: z.record(z.string()).optional(),
  expired_survey_titles: z.record(z.string()).optional(),
  expired_survey_texts: z.record(z.string()).optional(),
  languages: z.array(z.string()).min(1, "At least one language is required"),
  format: z.string(),
  type: z.string(),
  analysis_cluster: z.string().optional(),
  is_active: z.boolean().default(true),
  clusters: z.array(z.any()).optional(),
  questions: z.array(questionSchema).default([])
});

interface TemplateFormDataWithDynamicFields extends z.infer<typeof templateSchema> {
  [key: string]: any;
}

type TemplateFormValues = z.infer<typeof templateSchema>;

interface TemplateFormProps {
  initialData?: Partial<Template>;
  onSubmit: (data: TemplateFormValues) => void;
  isLoading?: boolean;
}

export default function TemplateForm({ initialData, onSubmit, isLoading = false }: TemplateFormProps) {
  const { t, i18n } = useTranslation(['templates', 'common']);
  const { locale: currentLanguage } = useLanguage();
  
  // Add debugging for initialData
  console.log('TemplateForm received initialData:', JSON.stringify(initialData, null, 2));
  
  const [availableClusters, setAvailableClusters] = useState<CustomWordCluster[]>([]);
  const [selectedClusters, setSelectedClusters] = useState<CustomWordCluster[]>(
    initialData?.clusters || []
  );
  const [questions, setQuestions] = useState<TemplateQuestion[]>(
    initialData?.questions?.map(q => ({
      ...q,
      placeholders: q.placeholders || {}
    })) || []
  );
  const [newClusterName, setNewClusterName] = useState<string>('');
  const clustersLoaded = useRef(false);
  const initCalled = useRef(false);
  
  // Memoize the form's default values to prevent unnecessary recalculations
  const defaultValues = useMemo(() => {
    const values = {
      ...initialData,
      languages: initialData?.languages || ['en'],
      title: initialData?.title || '',
      description: initialData?.description || '',
      headlines: initialData?.headlines || {},
      survey_texts: initialData?.survey_texts || {},
      is_active: initialData?.is_active ?? true,
      start_survey_titles: initialData?.start_survey_titles || {},
      start_survey_texts: initialData?.start_survey_texts || {},
      end_survey_titles: initialData?.end_survey_titles || {},
      end_survey_texts: initialData?.end_survey_texts || {},
      expired_survey_titles: initialData?.expired_survey_titles || {},
      expired_survey_texts: initialData?.expired_survey_texts || {},
      format: initialData?.format || 'online',
      type: initialData?.type || 'public',
      analysis_cluster: initialData?.analysis_cluster || 'Standard',
      clusters: initialData?.clusters || [],
      questions: initialData?.questions?.map((q, index) => ({
        ...q,
        id: q.id,
        order: index + 1,
        questions: { ...q.questions },
        is_required: q.is_required ?? true,
        placeholders: q.placeholders || {},
        type: q.type || 'free_text'
      })) || [],
    };
    console.log('TemplateForm defaultValues calculated:', JSON.stringify(values, null, 2));
    return values;
  }, [initialData]);
  
  // Load available clusters only once
  useEffect(() => {
    // Only load clusters if they haven't been loaded yet
    if (!clustersLoaded.current) {
      clustersLoaded.current = true; // Mark as loaded immediately to prevent multiple calls
      
      async function loadClusters() {
        try {
          const clusters = await getActiveClusters();
          setAvailableClusters(clusters);
        } catch (error) {
          console.error("Error loading clusters:", error);
        }
      }
      
      loadClusters();
    }
  }, []);
  
  // Initialize i18n only once
  useEffect(() => {
    if (!initCalled.current) {
      initCalled.current = true;
      
      // Load translations and set initial language
      const savedLocale = getCookie('NEXT_LOCALE') as string;
      if (savedLocale && ['en', 'fr', 'es', 'de'].includes(savedLocale)) {
        i18n.changeLanguage(savedLocale);
      }
    }
  }, [i18n]);
  
  const methods = useForm<TemplateFormDataWithDynamicFields>({
    resolver: zodResolver(templateSchema),
    defaultValues
  });

  const selectedLanguages = methods.watch('languages') || ['en'];
  const formState = methods.formState;

  // Add a cluster to the selected clusters
  const addCluster = (clusterId: string) => {
    const cluster = availableClusters.find(c => c.id.toString() === clusterId);
    if (cluster && !selectedClusters.some(c => c.id === cluster.id)) {
      setSelectedClusters([...selectedClusters, cluster]);
    }
  };
  
  // Remove a cluster from the selected clusters
  const removeCluster = (clusterId: number) => {
    setSelectedClusters(selectedClusters.filter(c => c.id !== clusterId));
  };

  // Handle questions
  const addQuestion = () => {
    const newQuestion: TemplateQuestion = {
      order: questions.length + 1,
      type: 'free_text',
      questions: { en: '' },
      language: 'en',
      is_required: true,
      placeholders: {}
    };
    
    setQuestions([...questions, newQuestion]);
    
    // Update form values
    const currentQuestions = methods.getValues('questions') || [];
    methods.setValue('questions', [...currentQuestions, newQuestion], { shouldValidate: true });
  };
  
  const removeQuestion = (index: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions.splice(index, 1);
    
    // Re-order questions
    const reorderedQuestions = updatedQuestions.map((q, i) => ({
      ...q,
      order: i + 1
    }));
    
    setQuestions(reorderedQuestions);
    methods.setValue('questions', reorderedQuestions, { shouldValidate: true });
  };
  
  const updateQuestion = (index: number, field: string, value: any) => {
    const updatedQuestions = [...questions];
    
    if (field.includes('.')) {
      // Handle nested fields like 'questions.en'
      const [parent, child] = field.split('.');
      if (parent === 'questions' || parent === 'placeholders') {
        updatedQuestions[index] = {
          ...updatedQuestions[index],
          [parent]: {
            ...updatedQuestions[index][parent],
            [child]: value
          }
        };
      }
    } else {
      // Handle direct fields
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        [field]: value
      };
    }
    
    setQuestions(updatedQuestions);
    methods.setValue('questions', updatedQuestions, { shouldValidate: true });
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

  const handleSubmit = (data: TemplateFormDataWithDynamicFields) => {
    if (!validateForm()) return;

    // Add selected clusters to the data
    data.clusters = selectedClusters;
    
    // Add questions to the data
    data.questions = questions;
    
    // Make sure to add the English title to headlines
    data.headlines = {
      ...data.headlines,
      en: data.title || ''
    };
    
    // Make sure to add the English description to survey_texts
    data.survey_texts = {
      ...data.survey_texts,
      en: data.description || ''
    };
    
    // Submit the form data
    onSubmit(data);
  };

  const toggleLanguage = (langCode: string) => {
    const currentLanguages = methods.getValues('languages') || [];
    let newLanguages;
    
    if (currentLanguages.includes(langCode)) {
      // Remove language if there are more than one selected
      if (currentLanguages.length > 1) {
        newLanguages = currentLanguages.filter(lang => lang !== langCode);
      } else {
        toast({
          title: "Language Required",
          description: "At least one language must be selected",
          variant: "destructive"
        });
        return;
      }
    } else {
      // Add the language
      newLanguages = [...currentLanguages, langCode];
    }
    
    methods.setValue('languages', newLanguages, {
      shouldValidate: true,
      shouldDirty: true
    });
  };

  const createAndAddCluster = async (name: string) => {
    try {
      // Check if a cluster with this name already exists
      const existingCluster = availableClusters.find(
        c => c.name.toLowerCase() === name.toLowerCase()
      );
      
      if (existingCluster) {
        if (!selectedClusters.some(c => c.id === existingCluster.id)) {
          setSelectedClusters([...selectedClusters, existingCluster]);
          toast({
            title: t('messages.clusterAdded', 'Cluster added'),
            description: t('messages.existingClusterAdded', 'Existing cluster with same name was added'),
          });
        } else {
          toast({
            title: t('messages.clusterAlreadyAdded', 'Cluster already added'),
            description: t('messages.clusterAlreadyAddedDesc', 'This cluster is already in your selection'),
            variant: 'destructive',
          });
        }
        return;
      }
      
      // Create new cluster
      const newCluster = await createCustomCluster({
        name
      });
      
      toast({
        title: t('messages.clusterCreated', 'Cluster created'),
        description: t('messages.clusterCreatedDesc', 'New cluster was created and added to your selection'),
      });
      
      // Add to selected clusters and available clusters
      // This avoids having to reload all clusters and causing a re-render loop
      setSelectedClusters([...selectedClusters, newCluster]);
      setAvailableClusters([...availableClusters, newCluster]);
    } catch (error) {
      console.error("Error creating cluster:", error);
      toast({
        title: t('messages.clusterCreateError', 'Error creating cluster'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} className="space-y-8">
        <Tabs defaultValue="basic-info">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic-info">{t('form.tabs.basicInfo')}</TabsTrigger>
            <TabsTrigger value="questions">{t('form.tabs.questions')}</TabsTrigger>
            <TabsTrigger value="clusters">{t('form.tabs.clusters')}</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic-info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('form.basicInfo')}</CardTitle>
                <CardDescription>{t('form.basicInfoDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">{t('form.title')} *</Label>
                  <Input 
                    id="title" 
                    {...methods.register('title')}
                  />
                  {formState.errors.title && (
                    <p className="text-red-500 text-sm mt-1">{formState.errors.title.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="description">{t('form.description')}</Label>
                  <Textarea 
                    id="description" 
                    {...methods.register('description')}
                  />
                </div>
                
                <div>
                  <Label>{t('form.languages')} *</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {AVAILABLE_LANGUAGES.map(language => (
                      <Badge 
                        key={language.code}
                        variant={selectedLanguages.includes(language.code) ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/90"
                        onClick={() => toggleLanguage(language.code)}
                      >
                        {language.name}
                        {selectedLanguages.includes(language.code) && (
                          <XMarkIcon className="h-3 w-3 ml-1" />
                        )}
                      </Badge>
                    ))}
                  </div>
                  {formState.errors.languages && (
                    <p className="text-red-500 text-sm mt-1">{formState.errors.languages.message}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="format">{t('form.format')}</Label>
                    <Select 
                      onValueChange={(value) => methods.setValue('format', value, { shouldValidate: true })}
                      value={methods.watch('format')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.selectFormat')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online">{t('format.online')}</SelectItem>
                        <SelectItem value="face_to_face">{t('format.faceToFace')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="type">{t('form.type')}</Label>
                    <Select 
                      onValueChange={(value) => methods.setValue('type', value, { shouldValidate: true })}
                      value={methods.watch('type')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.selectType')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">{t('type.public')}</SelectItem>
                        <SelectItem value="friends_family">{t('type.friendsFamily')}</SelectItem>
                        <SelectItem value="professional">{t('type.professional')}</SelectItem>
                        <SelectItem value="single_company">{t('type.singleCompany')}</SelectItem>
                        <SelectItem value="intracompany">{t('type.intracompany')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="analysis_cluster">{t('form.analysisCluster')}</Label>
                  <Select 
                    onValueChange={(value) => methods.setValue('analysis_cluster', value, { shouldValidate: true })}
                    value={methods.watch('analysis_cluster')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('form.selectCluster')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">{t('analysisCluster.standard')}</SelectItem>
                      <SelectItem value="CoreNet Event">{t('analysisCluster.corenetEvent')}</SelectItem>
                      <SelectItem value="Event & Conference">{t('analysisCluster.eventConference')}</SelectItem>
                      <SelectItem value="HomeOffice">{t('analysisCluster.homeOffice')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch 
                    id="is_active" 
                    checked={methods.watch('is_active')}
                    onCheckedChange={(checked) => methods.setValue('is_active', checked, { shouldValidate: true })}
                  />
                  <Label htmlFor="is_active">{t('form.isActive')}</Label>
                </div>
              </CardContent>
            </Card>

            {/* Multilingual Content */}
            <Card>
              <CardHeader>
                <CardTitle>{t('form.multilingualContent')}</CardTitle>
                <CardDescription>{t('form.multilingualContentDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue={selectedLanguages[0]} className="w-full">
                  <TabsList className="mb-4">
                    {selectedLanguages.map(lang => (
                      <TabsTrigger key={lang} value={lang}>
                        {AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name || lang.toUpperCase()}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {selectedLanguages.map(lang => (
                    <TabsContent key={lang} value={lang} className="space-y-4">
                      <div>
                        <Label htmlFor={`headlines.${lang}`}>{t('form.headline')}</Label>
                        <Input 
                          id={`headlines.${lang}`} 
                          {...methods.register(`headlines.${lang}`)} 
                          defaultValue={initialData?.headlines?.[lang] || ''}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`survey_texts.${lang}`}>{t('form.content')}</Label>
                        <Textarea 
                          id={`survey_texts.${lang}`} 
                          {...methods.register(`survey_texts.${lang}`)} 
                          defaultValue={initialData?.survey_texts?.[lang] || ''}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`start_survey_titles.${lang}`}>{t('form.startTitle')}</Label>
                        <Input 
                          id={`start_survey_titles.${lang}`} 
                          {...methods.register(`start_survey_titles.${lang}`)} 
                          defaultValue={initialData?.start_survey_titles?.[lang] || ''}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`start_survey_texts.${lang}`}>{t('form.startText')}</Label>
                        <Textarea 
                          id={`start_survey_texts.${lang}`} 
                          {...methods.register(`start_survey_texts.${lang}`)} 
                          defaultValue={initialData?.start_survey_texts?.[lang] || ''}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`end_survey_titles.${lang}`}>{t('form.endTitle')}</Label>
                        <Input 
                          id={`end_survey_titles.${lang}`} 
                          {...methods.register(`end_survey_titles.${lang}`)} 
                          defaultValue={initialData?.end_survey_titles?.[lang] || ''}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`end_survey_texts.${lang}`}>{t('form.endText')}</Label>
                        <Textarea 
                          id={`end_survey_texts.${lang}`} 
                          {...methods.register(`end_survey_texts.${lang}`)} 
                          defaultValue={initialData?.end_survey_texts?.[lang] || ''}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`expired_survey_titles.${lang}`}>{t('form.expiredTitle')}</Label>
                        <Input 
                          id={`expired_survey_titles.${lang}`} 
                          {...methods.register(`expired_survey_titles.${lang}`)} 
                          defaultValue={initialData?.expired_survey_titles?.[lang] || ''}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`expired_survey_texts.${lang}`}>{t('form.expiredText')}</Label>
                        <Textarea 
                          id={`expired_survey_texts.${lang}`} 
                          {...methods.register(`expired_survey_texts.${lang}`)} 
                          defaultValue={initialData?.expired_survey_texts?.[lang] || ''}
                        />
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t('form.questions')}</CardTitle>
                  <CardDescription>{t('form.questionsDesc')}</CardDescription>
                </div>
                <Button type="button" onClick={addQuestion} size="sm">
                  <PlusIcon className="h-4 w-4 mr-1" />
                  {t('form.addQuestion')}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {questions.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">{t('form.noQuestions')}</div>
                  ) : (
                    questions.map((question, index) => (
                      <Card key={index} className="relative">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => removeQuestion(index)}
                        >
                          <TrashIcon className="h-4 w-4 text-red-500" />
                        </Button>
                        <CardContent className="pt-6 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>{t('form.questionType')}</Label>
                              <Select
                                value={question.type}
                                onValueChange={(value) => updateQuestion(index, 'type', value as QuestionType)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="free_text">{t('form.questionType_freeText')}</SelectItem>
                                  <SelectItem value="nps">{t('form.questionType_nps')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                id={`question-${index}-required`}
                                checked={question.is_required}
                                onCheckedChange={(checked) => updateQuestion(index, 'is_required', checked)}
                              />
                              <Label htmlFor={`question-${index}-required`}>{t('form.isRequired')}</Label>
                            </div>
                          </div>

                          {/* Question text for each language */}
                          <div className="space-y-4">
                            {selectedLanguages.map(lang => (
                              <div key={`${index}-${lang}`}>
                                <Label>{t('form.questionText')} ({AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name})</Label>
                                <Input
                                  value={question.questions[lang] || ''}
                                  onChange={(e) => updateQuestion(index, `questions.${lang}`, e.target.value)}
                                  placeholder={t('form.questionTextPlaceholder')}
                                />
                              </div>
                            ))}
                          </div>

                          {/* Placeholder text for each language (if free text question) */}
                          <div className="space-y-4">
                            {selectedLanguages.map(lang => (
                              <div key={`${index}-${lang}-placeholder`}>
                                <Label>{t('form.placeholderText')} ({AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name})</Label>
                                <Input
                                  value={question.placeholders?.[lang] || ''}
                                  onChange={(e) => updateQuestion(index, `placeholders.${lang}`, e.target.value)}
                                  placeholder={t('form.placeholderTextPlaceholder')}
                                />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clusters Tab */}
          <TabsContent value="clusters" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('form.wordClusters')}</CardTitle>
                <CardDescription>{t('form.wordClustersDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t('form.selectedClusters')}</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedClusters.length === 0 ? (
                      <p className="text-muted-foreground">{t('form.noClustersSelected')}</p>
                    ) : (
                      selectedClusters.map(cluster => (
                        <Badge 
                          key={cluster.id}
                          variant="default"
                          className="flex items-center gap-1"
                        >
                          {cluster.name}
                          <XMarkIcon 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => removeCluster(cluster.id)}
                          />
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="add_cluster">{t('form.addCluster')}</Label>
                  <div className="flex gap-2">
                    <Select 
                      onValueChange={(value) => {
                        if (value === 'create_new') {
                          // Do nothing here, we'll use the input below
                        } else {
                          addCluster(value);
                        }
                      }}
                      value=""
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t('form.selectClusterToAdd')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="create_new">{t('form.createNewCluster', 'Create new cluster')}</SelectItem>
                        {availableClusters
                          .filter(cluster => !selectedClusters.some(c => c.id === cluster.id))
                          .map(cluster => (
                            <SelectItem key={cluster.id} value={cluster.id.toString()}>
                              {cluster.name}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mt-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder={t('form.newClusterName', 'New cluster name')}
                        value={newClusterName}
                        onChange={(e) => setNewClusterName(e.target.value)}
                      />
                      <Button 
                        type="button" 
                        onClick={() => {
                          if (newClusterName.trim()) {
                            createAndAddCluster(newClusterName.trim());
                            setNewClusterName('');
                          }
                        }}
                        disabled={!newClusterName.trim()}
                        size="sm"
                      >
                        {t('form.addNewCluster', 'Add')}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  <h3 className="text-lg font-medium">{t('form.clusterList')}</h3>
                  
                  {selectedClusters.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">{t('form.noClusterAssigned')}</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedClusters.map(cluster => (
                        <Card key={cluster.id} className="relative">
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold">{cluster.name}</h4>
                                <p className="text-sm text-muted-foreground">{cluster.description}</p>
                              </div>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeCluster(cluster.id)}
                              >
                                <TrashIcon className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                            
                            {cluster.keywords && cluster.keywords.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-muted-foreground mb-1">{t('form.keywords')}</p>
                                <div className="flex flex-wrap gap-1">
                                  {cluster.keywords.slice(0, 5).map((keyword, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {keyword}
                                    </Badge>
                                  ))}
                                  {cluster.keywords.length > 5 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{cluster.keywords.length - 5} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t('form.saving') : t('form.save')}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
} 