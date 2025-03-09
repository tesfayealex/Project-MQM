"use client"

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '@heroicons/react/24/outline';
import TemplateTableClient from './template-table-client';
import { Template } from '@/types/template';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { handleAuthError } from '@/lib/auth-utils';
import { useTranslation } from 'react-i18next';
import { getTemplates } from '@/lib/services/template-service';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const { t } = useTranslation('templates');

  useEffect(() => {
    async function fetchTemplates() {
      try {
        setLoading(true);
        console.log('Fetching templates...');
        const data = await getTemplates();
        console.log('Templates fetched:', data.length);
        setTemplates(data);
      } catch (error: any) {
        console.error('Error fetching templates:', error);
        
        // Handle authentication errors
        const isAuthError = await handleAuthError(error);
        if (!isAuthError) {
          // Only show error toast if it's not an auth error (auth errors redirect)
          toast({
            title: t('messages.error'),
            description: t('messages.error'),
            variant: "destructive",
          });
          setTemplates([]);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchTemplates();
  }, [toast, router, t]);

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">{t('list.title')}</h1>
        <Link href="/dashboard/templates/new">
          <Button>
            <PlusIcon className="h-4 w-4 mr-2" />
            {t('list.create')}
          </Button>
        </Link>
      </div>
      
      <div>
        <p className="text-muted-foreground mb-6">
          {t('list.description')}
        </p>
        
        {loading ? (
          <div className="py-10 text-center">{t('list.loading')}</div>
        ) : (
          <TemplateTableClient initialTemplates={templates} />
        )}
      </div>
    </div>
  );
} 