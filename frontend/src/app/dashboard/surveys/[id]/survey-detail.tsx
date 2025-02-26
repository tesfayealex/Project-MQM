'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftIcon, PencilIcon } from '@heroicons/react/24/outline';
import { getSurvey } from '@/lib/services/survey-service';
import { Survey } from '@/types/survey';
import { handleAuthError } from '@/lib/auth-utils';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

export default function SurveyDetail({ params }: { params: { id: string } | { value: string } | string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surveyId, setSurveyId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSurvey() {
      // Parse the params if it's a string
      let parsedId;
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
          setError('Invalid survey ID');
          setLoading(false);
          return;
        }

        setSurveyId(parsedId);
        setLoading(true);
        console.log('Fetching survey with ID:', parsedId);
        const data = await getSurvey(parsedId);
        console.log('Survey data received:', data);
        setSurvey(data);
      } catch (error: any) {
        console.error('Error fetching survey:', error);
        
        // Handle authentication errors
        const isAuthError = await handleAuthError(error);
        if (!isAuthError) {
          const errorMessage = error.data?.detail || error.message || 'Failed to load survey';
          setError(errorMessage);
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
      }
    }

    fetchSurvey();
  }, [params, toast]);

  if (loading) {
    return (
      <div className="container mx-auto py-10 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/surveys">
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to Surveys
              </Button>
            </Link>
            <div className="h-8 w-32 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </div>
        <Card className="p-6">
          <div className="space-y-4">
            <div className="h-6 w-3/4 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-4 w-1/2 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="container mx-auto py-10 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/surveys">
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to Surveys
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Error</h1>
          </div>
        </div>
        <Card className="p-6">
          <p className="text-red-500">{error || 'Failed to load survey'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/surveys">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Surveys
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{survey.title}</h1>
        </div>
        {surveyId && (
          <Link href={`/dashboard/surveys/${surveyId}/edit`}>
            <Button>
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit Survey
            </Button>
          </Link>
        )}
      </div>
      
      <div className="grid gap-6">
        {/* Basic Info */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="grid gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Description</h3>
              <p className="mt-1">{survey.description || 'No description provided'}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Status</h3>
                <Badge variant={survey.is_active ? "default" : "secondary"} className="mt-1">
                  {survey.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Languages</h3>
                <div className="flex gap-2 mt-1">
                  {survey.languages.map(lang => (
                    <Badge key={lang} variant="outline">{lang.toUpperCase()}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Questions */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Questions</h2>
            <Badge variant="secondary">{survey.questions.length} Questions</Badge>
          </div>
          <div className="space-y-4">
            {survey.questions.map((question, index) => (
              <div key={question.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Question {index + 1}</span>
                      {question.is_required && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                    </div>
                    <h3 className="font-medium">{question.questions?.[survey.languages[0]] || 'Untitled Question'}</h3>
                    {question.placeholders?.[survey.languages[0]] && (
                      <p className="text-sm text-gray-500">
                        Placeholder: {question.placeholders[survey.languages[0]]}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">
                    {question.type === 'nps' ? 'NPS' : 'Free Text'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Project Details */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Project Details</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Building Name</h3>
              <p className="mt-1">{survey.building_name || '-'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Short ID</h3>
              <p className="mt-1">{survey.short_id || '-'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Project Description</h3>
              <p className="mt-1">{survey.project_description || '-'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Token</h3>
              <p className="mt-1">{survey.token || '-'}</p>
            </div>
          </div>
        </Card>

        {/* Location */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Location</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Street Number</h3>
              <p className="mt-1">{survey.street_number || '-'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">City Code</h3>
              <p className="mt-1">{survey.city_code || '-'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">City</h3>
              <p className="mt-1">{survey.city || '-'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Country</h3>
              <p className="mt-1">{survey.country || '-'}</p>
            </div>
          </div>
        </Card>

        {/* Survey Settings */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Survey Settings</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Format</h3>
              <Badge variant="outline" className="mt-1">
                {survey.format.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Type</h3>
              <Badge variant="outline" className="mt-1">
                {survey.type.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Max Participants</h3>
              <p className="mt-1">{survey.max_participants || 'Unlimited'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Analysis Cluster</h3>
              <p className="mt-1">{survey.analysis_cluster || 'Standard'}</p>
            </div>
          </div>
        </Card>

        {/* Dates */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Important Dates</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Created</h3>
              <p className="mt-1">{format(new Date(survey.created_at), 'PPP')}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Last Updated</h3>
              <p className="mt-1">{format(new Date(survey.updated_at), 'PPP')}</p>
            </div>
            {survey.end_date && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">End Date</h3>
                <p className="mt-1">{format(new Date(survey.end_date), 'PPP')}</p>
              </div>
            )}
            {survey.analysis_end_date && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Analysis End Date</h3>
                <p className="mt-1">{format(new Date(survey.analysis_end_date), 'PPP')}</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
} 