import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Edit } from 'lucide-react';
import TemplateDetailClient from './template-detail-client';

export const metadata: Metadata = {
  title: 'Template Details | myQuickMessage',
  description: 'View and manage your template details',
};

export default async function TemplateDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/templates">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Templates
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Template Details</h1>
        </div>
        <div className="flex space-x-4">
          <Link href={`/dashboard/templates/${params.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Template
            </Button>
          </Link>
        </div>
      </div>
      
      <TemplateDetailClient id={params.id} />
    </div>
  );
} 