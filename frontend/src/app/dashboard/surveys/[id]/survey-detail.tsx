'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftIcon, PencilIcon, QrCodeIcon } from '@heroicons/react/24/outline';
import { getSurvey, getSurveyQRCodeData } from '@/lib/services/survey-service';
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
  const [qrCodeData, setQrCodeData] = useState<{survey_url: string, token: string, qr_code_url: string} | null>(null);

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
        
        // Fetch QR code data if survey has token
        if (data.token) {
          try {
            const qrData = await getSurveyQRCodeData(parsedId);
            setQrCodeData(qrData);
          } catch (qrError) {
            console.error('Error fetching QR code data:', qrError);
            // Don't set error state, just log it - not critical
          }
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching survey:', err);
        setError(err.message || 'Failed to load survey');
        setLoading(false);
        handleAuthError(err);
      }
    }

    fetchSurvey();
  }, [params, router, toast]);

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
              <p className="mt-1">{survey.title.substring(0, 10) || '-'}</p>
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

        {/* QR Code & Public Access */}
        {survey.token && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Public Access</h2>
              <Badge variant="outline">
                {qrCodeData ? 'Available' : 'QR Code Unavailable'}
              </Badge>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Survey Token</h3>
                  <div className="flex items-center mt-1 gap-2">
                    <Badge variant="secondary" className="text-md px-3 py-1">
                      {survey.token}
                    </Badge>
                  </div>
                </div>
                
                {qrCodeData && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Public Survey Link</h3>
                    <div className="mt-1">
                      <a 
                        href={`/survey/${survey.token}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {window.location.origin}/survey/{survey.token}
                      </a>
                    </div>
                  </div>
                )}
                
                {/* Debug Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      // Test direct API access
                      const qrUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/surveys/surveys/${surveyId}/qr_code/`;
                      window.open(qrUrl, '_blank');
                      
                      toast({
                        title: "Debug Info",
                        description: `Opening QR code directly from: ${qrUrl}`,
                      });
                    } catch (err: any) {
                      toast({
                        title: "Debug Error",
                        description: err.message,
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  Debug: Open QR Code Directly
                </Button>
                
                <p className="text-sm text-gray-500 mt-2">
                  Share this link or QR code for participants to access the survey without logging in.
                </p>
              </div>
              
              {qrCodeData && (
                <div className="flex justify-center items-center border rounded-lg p-4">
                  <div className="text-center">
                    <div className="mb-2">
                      <a href={qrCodeData.qr_code_url} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={qrCodeData.qr_code_url} 
                          alt="Survey QR Code" 
                          className="max-w-[200px] mx-auto"
                          onError={(e) => {
                            e.currentTarget.onerror = null; 
                            toast({
                              title: "QR Code Error",
                              description: `Failed to load image from: ${qrCodeData.qr_code_url}`,
                              variant: "destructive"
                            });
                            e.currentTarget.src = "data:image/svg+xml;charset=utf-8,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui'%3EImage Error%3C/text%3E%3C/svg%3E";
                          }}
                        />
                      </a>
                    </div>
                    <p className="text-sm text-gray-500">
                      Scan to access survey
                    </p>
                    <p className="text-xs text-blue-500 mt-2">
                      <a href={qrCodeData.qr_code_url} target="_blank" rel="noopener noreferrer">
                        Open QR code in new tab
                      </a>
                    </p>
                  </div>
                </div>
              )}
              
              {!qrCodeData && survey.token && (
                <div className="flex justify-center items-center border rounded-lg p-4 bg-gray-50">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">
                      QR Code data could not be loaded.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={async () => {
                        try {
                          const data = await getSurveyQRCodeData(surveyId || '');
                          setQrCodeData(data);
                          toast({
                            title: "Success",
                            description: "QR code data loaded successfully",
                          });
                        } catch (err: any) {
                          toast({
                            title: "Error",
                            description: err.message || "Failed to load QR code data",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Location */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Location</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Street</h3>
              <p className="mt-1">{survey.street || '-'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Postal Code</h3>
              <p className="mt-1">{survey.postal_code || '-'}</p>
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