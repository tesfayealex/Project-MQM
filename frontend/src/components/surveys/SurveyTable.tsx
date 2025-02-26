"use client"

import React from 'react';
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
  if (!Array.isArray(surveys)) {
    console.error('surveys prop is not an array:', surveys);
    return null;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Languages</TableHead>
            <TableHead>Responses</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {surveys.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No surveys found.
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
                      {survey.title}
                    </Link>
                    {survey.building_name && (
                      <span className="text-xs text-gray-500">
                        {survey.building_name}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {format(new Date(survey.created_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={survey.is_active ? "default" : "secondary"}
                    className={survey.is_active ? "bg-green-500" : ""}
                  >
                    {survey.is_active ? "Active" : "Inactive"}
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
                        View
                      </Button>
                    </Link>
                    <Link href={`/dashboard/surveys/${survey.id}/edit`}>
                      <Button size="sm" variant="ghost" onClick={() => console.log('Edit survey:', survey.id)}>
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </Link>
                    <Link href={`/dashboard/surveys/${survey.id}/stats`}>
                      <Button size="sm" variant="ghost">
                        <ChartBarIcon className="h-4 w-4 mr-1" />
                        Stats
                      </Button>
                    </Link>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/s/${survey.token}`);
                      }}
                    >
                      <ClipboardIcon className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-red-500 hover:text-red-700"
                      onClick={() => onDelete(survey.id)}
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