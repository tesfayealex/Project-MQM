'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import TemplateForm from '@/components/templates/TemplateForm';
import { handleAuthError } from '@/lib/auth-utils';
import { useTranslation } from 'react-i18next';
import { createTemplate } from '@/lib/services/template-service';

export default function TemplateFormClient() {
  const router = useRouter();
  const { t } = useTranslation(['templates', 'common'], { useSuspense: false });
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    
    try {
      // Use template service instead of direct fetch
      const newTemplate = await createTemplate(data);
      
      toast({
        title: t('templates:success.created'),
        description: t('templates:success.templateCreated')
      });
      
      // Redirect to the newly created template
      router.push(`/dashboard/templates/${newTemplate.id}`);
    } catch (error: any) {
      console.error('Error creating template:', error);
      
      // Handle authentication errors
      const isAuthError = await handleAuthError(error);
      if (!isAuthError) {
        toast({
          variant: 'destructive',
          title: t('templates:errors.createFailed'),
          description: error.message || t('templates:errors.error')
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TemplateForm onSubmit={handleSubmit} isLoading={isSubmitting} />
  );
} 