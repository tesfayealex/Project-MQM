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
import { Survey } from "@/types/survey";
import { 
  PencilIcon, 
  TrashIcon, 
  ChartBarIcon,
  ClipboardIcon,
  EyeIcon
} from "@heroicons/react/24/outline";
import Link from 'next/link';
import { format } from 'date-fns';

interface SurveyTableProps {
  surveys: Survey[];
  onDelete: (id: string) => void;
}

export default function SurveyTable({ surveys = [], onDelete }: SurveyTableProps) {
  const { t } = useTranslation('surveys');
  
  if (!Array.isArray(surveys)) {
    console.error('surveys prop is not an array:', surveys);
    return null;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('list.columns.name')}</TableHead>
            <TableHead>{t('list.columns.created')}</TableHead>
            <TableHead>{t('list.columns.status')}</TableHead>
            <TableHead>Languages</TableHead>
            <TableHead>{t('list.columns.responses')}</TableHead>
            <TableHead className="text-right">{t('list.columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {surveys.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                {t('list.empty')}
              </TableCell>
            </TableRow>
          ) : (
            surveys.map((survey) => (
              <TableRow key={survey.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <Link 
                      href={`/dashboard/surveys/${survey.id}`}
                      className="hover:underline"
                    >
                      {survey.title && (
                        <p className="text-sm text-gray-500 truncate">
                          {survey.title}
                        </p>
                      )}
                    </Link>
                  </div>
                </TableCell>
                <TableCell>
                  {survey.created_at && format(new Date(survey.created_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={survey.is_active ? "default" : "secondary"}
                    className={survey.is_active ? "bg-green-500" : ""}
                  >
                    {survey.is_active ? t('list.status.active') : t('list.status.draft')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {survey.languages.map(lang => (
                      <Badge key={lang} variant="outline">{lang.toUpperCase()}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{survey.response_count || 0}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/dashboard/surveys/${survey.id}`}>
                      <Button size="sm" variant="ghost" onClick={() => console.log('View survey:', survey.id)}>
                        <EyeIcon className="h-4 w-4 mr-1" />
                        {t('actions.view')}
                      </Button>
                    </Link>
                    <Link href={`/dashboard/surveys/${survey.id}/edit`}>
                      <Button size="sm" variant="ghost" onClick={() => console.log('Edit survey:', survey.id)}>
                        <PencilIcon className="h-4 w-4 mr-1" />
                        {t('actions.edit')}
                      </Button>
                    </Link>
                    <Link href={`/dashboard/surveys/${survey.id}/stats`}>
                      <Button size="sm" variant="ghost">
                        <ChartBarIcon className="h-4 w-4 mr-1" />
                        {t('actions.stats')}
                      </Button>
                    </Link>
                    <Link href={`/dashboard/surveys/${survey.id}/analysis`}>
                      <Button size="sm" variant="ghost">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 mr-1">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21a48.25 48.25 0 0 1-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                        </svg>
                        {t('analysis.title')}
                      </Button>
                    </Link>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-red-500 hover:text-red-700"
                      onClick={() => onDelete(survey.id.toString())}
                    >
                      <TrashIcon className="h-4 w-4" />
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