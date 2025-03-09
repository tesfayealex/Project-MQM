'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { TemplateDetail } from './template-detail';
import { Template } from '@/types/template';
import { handleAuthError } from '@/lib/auth-utils';
import { getTemplate } from '@/lib/services/template-service';

interface TemplateDetailClientProps {
  id: string;
}

export default function TemplateDetailClient({ id }: TemplateDetailClientProps) {
  const router = useRouter();
  const { t } = useTranslation(['templates', 'dashboard', 'common'], { useSuspense: false });
  const { toast } = useToast();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch template data
  useEffect(() => {
    let isMounted = true;
    
    async function fetchTemplate() {
      try {
        setLoading(true);
        console.log(`Fetching template details for ID: ${id}`);
        const data = await getTemplate(id);
        
        if (isMounted) {
          console.log('Template data received');
          setTemplate(data);
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Error fetching template:', error);
        
        if (isMounted) {
          const isAuthError = await handleAuthError(error);
          if (!isAuthError) {
            setError(error.message || 'Failed to load template');
            toast({
              variant: 'destructive',
              title: t('templates:errors.error'),
              description: error.message || t('templates:errors.fetchFailed')
            });
          }
          setLoading(false);
        }
      }
    }

    if (id) {
      fetchTemplate();
    }
    
    return () => {
      isMounted = false;
    };
  }, [id, router, toast, t]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/2 bg-gray-200 animate-pulse rounded"></div>
        <div className="h-32 bg-gray-100 animate-pulse rounded"></div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold text-red-600">{t('templates:errors.fetchFailed')}</h2>
          <p className="text-gray-600">{error}</p>
          <Button onClick={() => router.push('/dashboard/templates')}>
            {t('templates:detail.back')}
          </Button>
        </div>
      </Card>
    );
  }

  return <TemplateDetail template={template} />;
} 