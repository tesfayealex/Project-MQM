'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Survey } from '@/types/survey';
import { createSurvey, updateSurvey } from '@/lib/services/survey-service';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { handleAuthError } from '@/lib/auth-utils';

// Define the form schema
const surveySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  languages: z.array(z.string()).min(1, 'At least one language is required'),
  format: z.enum(['online', 'face_to_face']),
  type: z.enum(['friends_family', 'public', 'professional', 'single_company', 'intracompany']),
  max_participants: z.number().optional(),
  end_date: z.string().optional(),
  analysis_end_date: z.string().optional(),
  analysis_cluster: z.enum(['Standard', 'CoreNet Event', 'Event & Conference', 'HomeOffice']).optional(),
  building_name: z.string().optional(),
  short_id: z.string().optional(),
  project_description: z.string().optional(),
  street_number: z.string().optional(),
  city_code: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  token: z.string().optional(),
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
  initialData?: Survey;
  onSuccess?: () => void;
}

export default function SurveyForm({ initialData, onSuccess }: SurveyFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [endDate, setEndDate] = useState<Date | undefined>(
    initialData?.end_date ? new Date(initialData.end_date) : undefined
  );
  const [analysisEndDate, setAnalysisEndDate] = useState<Date | undefined>(
    initialData?.analysis_end_date ? new Date(initialData.analysis_end_date) : undefined
  );

  const form = useForm<SurveyFormValues>({
    resolver: zodResolver(surveySchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      languages: initialData?.languages || ['en'],
      format: initialData?.format || 'online',
      type: initialData?.type || 'public',
      max_participants: initialData?.max_participants || 100,
      end_date: initialData?.end_date,
      analysis_end_date: initialData?.analysis_end_date,
      analysis_cluster: initialData?.analysis_cluster || 'Standard',
      building_name: initialData?.building_name || '',
      short_id: initialData?.short_id || '',
      project_description: initialData?.project_description || '',
      street_number: initialData?.street_number || '',
      city_code: initialData?.city_code || '',
      city: initialData?.city || '',
      country: initialData?.country || '',
      token: initialData?.token || '',
      is_active: initialData?.is_active ?? true,
      questions: initialData?.questions || []
    }
  });

  const onSubmit = async (data: SurveyFormValues) => {
    setIsSubmitting(true);
    try {
      // Convert dates to ISO strings if they exist
      const formattedData = {
        ...data,
        end_date: endDate?.toISOString(),
        analysis_end_date: analysisEndDate?.toISOString()
      };

      if (initialData?.id) {
        await updateSurvey(initialData.id, formattedData);
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
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/dashboard/surveys');
      }
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            {...form.register('title')}
            placeholder="Enter survey title"
          />
          {form.formState.errors.title && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.title.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...form.register('description')}
            placeholder="Enter survey description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="format">Format</Label>
            <select
              id="format"
              {...form.register('format')}
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
              {...form.register('type')}
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
            <Label htmlFor="end_date">End Date</Label>
            <DatePicker
              date={endDate}
              setDate={(date) => {
                setEndDate(date);
                form.setValue('end_date', date?.toISOString());
              }}
            />
          </div>

          <div>
            <Label htmlFor="analysis_end_date">Analysis End Date</Label>
            <DatePicker
              date={analysisEndDate}
              setDate={(date) => {
                setAnalysisEndDate(date);
                form.setValue('analysis_end_date', date?.toISOString());
              }}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="max_participants">Maximum Participants</Label>
          <Input
            id="max_participants"
            type="number"
            {...form.register('max_participants', { valueAsNumber: true })}
          />
        </div>

        <div>
          <Label>
            <input
              type="checkbox"
              {...form.register('is_active')}
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