"use client"

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Template } from "@/types/template";
import { Pen, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

interface TemplateTableProps {
  templates: Template[];
  onDelete: (id: string) => void;
}

// Helper function to safely format dates
const safeFormatDate = (dateString?: string) => {
  if (!dateString) return '-';
  return formatDate(dateString);
};

export default function TemplateTable({ templates = [], onDelete }: TemplateTableProps) {
  const { t } = useTranslation('templates');
  
  if (!Array.isArray(templates)) {
    console.error('templates prop is not an array:', templates);
    return null;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('list.title')}</TableHead>
            <TableHead>{t('list.languages')}</TableHead>
            <TableHead>{t('list.type')}</TableHead>
            <TableHead>{t('list.created')}</TableHead>
            <TableHead>{t('list.status')}</TableHead>
            <TableHead className="text-right">{t('list.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                {t('list.no_templates')}
              </TableCell>
            </TableRow>
          ) : (
            templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">
                  <Link 
                    href={`/dashboard/templates/${template.id}`}
                    className="hover:underline"
                  >
                    {template.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {template.languages.map(lang => (
                      <Badge key={lang} variant="outline" className="text-xs">
                        {lang.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{template.type || '-'}</TableCell>
                <TableCell>{safeFormatDate(template.created_at)}</TableCell>
                <TableCell>
                  <Badge variant={template.is_active ? 'default' : 'secondary'}>
                    {template.is_active ? t('status.active') : t('status.inactive')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <Link href={`/dashboard/templates/${template.id}`}>
                      <Button size="icon" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/dashboard/templates/${template.id}/edit`}>
                      <Button size="icon" variant="ghost">
                        <Pen className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => onDelete(template.id.toString())}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
} 