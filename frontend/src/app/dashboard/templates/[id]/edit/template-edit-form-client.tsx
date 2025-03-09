'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import TemplateForm from '@/components/templates/TemplateForm';
import { handleAuthError } from '@/lib/auth-utils';
import { useTranslation } from 'react-i18next';
import { Template } from '@/types/template';
import { getTemplate, updateTemplate } from '@/lib/services/template-service';

interface TemplateEditFormClientProps {
  params: { id: string } | { value: string } | string;
}

export default function TemplateEditFormClient({ params }: TemplateEditFormClientProps) {
  const router = useRouter();
  const { t } = useTranslation(['templates', 'common'], { useSuspense: false });
  const { toast } = useToast();
  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);

  // Fetch template data
  useEffect(() => {
    let isMounted = true;
    
    async function fetchTemplate() {
      let parsedId = '';
      
      try {
        if (typeof params === 'string') {
          const parsedParams = JSON.parse(params);
          parsedId = parsedParams.id;
        } else if ('value' in params) {
          const parsedValue = JSON.parse(params.value);
          parsedId = parsedValue.id;
        } else if ('id' in params) {
          parsedId = params.id;
        }

        if (!parsedId || parsedId === 'undefined') {
          throw new Error(t('errors.invalidTemplateId', 'Invalid template ID'));
        }

        setTemplateId(parsedId);
        console.log(`Fetching template with ID: ${parsedId}`);
        
        const data = await getTemplate(parsedId);
        console.log('Template data received successfully');
        
        if (isMounted) {
          // Ensure questions have the correct structure if present
          const formattedTemplate = {
            ...data,
            questions: data.questions?.map((q: any, index: number) => ({
              ...q,
              order: index + 1,
              questions: q.questions || {},
              is_required: q.is_required ?? true,
              placeholders: q.placeholders || {}
            })) || []
          };
          
          setTemplate(formattedTemplate);
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('Error fetching template:', error);
        
        if (isMounted) {
          const isAuthError = await handleAuthError(error);
          if (!isAuthError) {
            toast({
              variant: 'destructive',
              title: t('messages.loadError'),
              description: error.message || t('errors.generic', 'Failed to load template. Please try again.'),
            });
            router.push('/dashboard/templates');
          }
          
          setIsLoading(false);
        }
      }
    }

    fetchTemplate();
    
    return () => {
      isMounted = false;
    };
  }, [params, router, t, toast]);

  const handleUpdateTemplate = async (formData: any) => {
    if (!templateId) {
      toast({
        title: t('errors.error', 'Error'),
        description: t('errors.missingTemplateId', 'Missing template ID'),
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      await updateTemplate(templateId, formData);
      
      toast({
        title: t('messages.updateSuccess'),
        description: `${t('form.title')}: ${formData.title}`,
      });
      
      router.push(`/dashboard/templates/${templateId}`);
    } catch (error: any) {
      console.error('Error updating template:', error);
      
      const isAuthError = await handleAuthError(error);
      if (!isAuthError) {
        toast({
          variant: 'destructive',
          title: t('messages.updateError'),
          description: error.message || 'Something went wrong',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !template) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-3/4 bg-gray-200 animate-pulse rounded"></div>
        <div className="h-4 w-1/2 bg-gray-200 animate-pulse rounded"></div>
      </div>
    );
  }

  return (
    <TemplateForm 
      initialData={template} 
      onSubmit={handleUpdateTemplate} 
      isLoading={isSaving} 
    />
  );
} 