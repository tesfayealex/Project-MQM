'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Survey } from '@/types/survey';
import { createSurvey, updateSurvey } from '@/lib/services/survey-service';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { handleAuthError } from '@/lib/auth-utils';

// Define the form schema
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
  start_datetime: z.string().optional(),
  expiry_date: z.string().optional(),
  analysis_cluster: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  token: z.string().optional(), // Legacy token field
  tokens: z.array(
    z.object({
      id: z.number(),
      token: z.string(),
      description: z.string()
    })
  ).optional(),
  is_active: z.boolean().default(true),
  questions: z.array(z.object({
    type: z.enum(['nps', 'free_text']),
    question: z.string(),
    questions: z.record(z.string()),
    placeholders: z.record(z.string()).optional(),
    is_required: z.boolean().default(true),
    language: z.string(),
    order: z.number()
  })).default([])
});

type SurveyFormValues = z.infer<typeof surveySchema>;

interface SurveyFormProps {
  initialData?: Partial<Survey>;
  onSubmit: (data: Partial<Survey>) => void;
  isLoading?: boolean;
}

export default function SurveyForm({ initialData, onSubmit, isLoading = false }: SurveyFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      format: initialData?.format || 'online',
      type: initialData?.type || 'public',
      start_datetime: initialData?.start_datetime || '',
      expiry_date: initialData?.expiry_date || '',
      analysis_cluster: initialData?.analysis_cluster || 'Standard',
      city: initialData?.city || '',
      country: initialData?.country || '',
      token: initialData?.token || '',
      tokens: initialData?.tokens?.map(token => ({
        ...token,
        id: token.id
      })) || []
    }
  });

  const handleSubmit = async (data: SurveyFormValues) => {
    setIsSubmitting(true);
    try {
      const formattedData: Partial<Survey> = {
        ...data,
        tokens: data.tokens?.map(token => ({
          ...token,
          id: token.id
        }))
      };
      
      if (initialData?.id) {
        await updateSurvey(initialData.id.toString(), formattedData);
        toast({
          title: "Success",
          description: "Survey updated successfully",
        });
      } else {
        await createSurvey(formattedData);
        toast({
          title: "Success",
          description: "Survey created successfully",
        });
      }
      
      await onSubmit(formattedData);
    } catch (error: any) {
      console.error('Error submitting survey:', error);
      
      const isAuthError = await handleAuthError(error);
      if (!isAuthError) {
        toast({
          title: "Error",
          description: error.message || "Failed to save survey",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={methods.handleSubmit(handleSubmit)} className="space-y-8">
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            {...methods.register('title')}
            placeholder="Enter survey title"
          />
          {methods.formState.errors.title && (
            <p className="text-sm text-red-500 mt-1">{methods.formState.errors.title.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...methods.register('description')}
            placeholder="Enter survey description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="format">Format</Label>
            <select
              id="format"
              {...methods.register('format')}
              className="w-full p-2 border rounded"
            >
              <option value="online">Online</option>
              <option value="face_to_face">Face to Face</option>
            </select>
          </div>

          <div>
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              {...methods.register('type')}
              className="w-full p-2 border rounded"
            >
              <option value="public">Public</option>
              <option value="friends_family">Friends and Family</option>
              <option value="professional">Professional</option>
              <option value="single_company">Single Company</option>
              <option value="intracompany">Intracompany</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start_datetime">Start Date & Time</Label>
            <Input
              type="datetime-local"
              id="start_datetime"
              {...methods.register('start_datetime')}
            />
          </div>
          <div>
            <Label htmlFor="expiry_date">End Date & Time</Label>
            <Input
              type="datetime-local"
              id="expiry_date"
              {...methods.register('expiry_date')}
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
            Active
          </Label>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : initialData ? 'Update Survey' : 'Create Survey'}
      </Button>
    </form>
  );
} 