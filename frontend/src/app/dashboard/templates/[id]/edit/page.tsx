import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';
import TemplateEditFormClient from './template-edit-form-client';

export const metadata = {
  title: 'Edit Template | myQuickMessage',
  description: 'Edit your template details and settings',
};

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  // Note: useTranslation cannot be used directly in Server Components
  // The actual translation will be handled in the client component
  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/templates">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Templates
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Edit Template</h1>
        </div>
      </div>
      
      <Card className="p-6">
        <TemplateEditFormClient params={params} />
      </Card>
    </div>
  );
} 