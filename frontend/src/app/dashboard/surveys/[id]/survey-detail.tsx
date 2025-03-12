'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftIcon, PencilIcon, QrCodeIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline';
import { getSurvey, getSurveyQRCodeData } from '@/lib/services/survey-service';
import { Survey } from '@/types/survey';
import { handleAuthError } from '@/lib/auth-utils';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { getCookie } from 'cookies-next';

export default function SurveyDetail({ params }: { params: { id: string } | { value: string } | string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t, i18n } = useTranslation('surveys', { useSuspense: false });
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [qrCodeData, setQrCodeData] = useState<{
    tokens: Array<{
      id: number|null,
      token: string,
      description: string,
      survey_url: string,
      qr_code_url: string
    }>,
    primary_token: string
  } | null>(null);
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Load translations and set initial language
    i18n.loadNamespaces(['surveys', 'common']).then(() => {
      const savedLocale = getCookie('NEXT_LOCALE') as string;
      if (savedLocale && ['en', 'fr', 'es', 'de'].includes(savedLocale)) {
        setCurrentLanguage(savedLocale);
        i18n.changeLanguage(savedLocale);
      }
    }).catch(err => console.error('Failed to load namespaces:', err));
  }, [i18n]);

  useEffect(() => {
    // Update language when cookie changes
    const checkLanguage = () => {
      const newLocale = getCookie('NEXT_LOCALE') as string;
      if (newLocale && newLocale !== currentLanguage) {
        setCurrentLanguage(newLocale);
        i18n.changeLanguage(newLocale);
      }
    };

    const interval = setInterval(checkLanguage, 1000);
    return () => clearInterval(interval);
  }, [currentLanguage, i18n]);

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
        if (data.tokens && data.tokens.length > 0) {
          try {
            const qrData = await getSurveyQRCodeData(parsedId);
            setQrCodeData(qrData);
          } catch (qrError) {
            console.error('Error fetching QR code data:', qrError);
            // Don't set error state, just log it - not critical
          }
        }
        
        // Get the public link if available
        if (data.primary_token) {
          // Construct public link directly using primary token
          const baseUrl = window.location.origin;
          const publicLink = `${baseUrl}/survey/${data.primary_token}`;
          setPublicLink(publicLink);
        } else {
          console.log('No primary token available for public link');
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
  }, [params, router, toast, t, i18n]);

  const copyToClipboard = () => {
    if (!publicLink) return;
    
    navigator.clipboard.writeText(publicLink)
      .then(() => {
        setCopied(true);
        toast({
          title: t('success.copied'),
          description: t('success.linkCopied'),
        });
        
        // Reset copied state after 2 seconds
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        toast({
          variant: 'destructive',
          title: t('errors.error'),
          description: t('errors.copyFailed'),
        });
      });
  };

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
          <div className="space-x-4">
            <Button
              onClick={() => router.push(`/dashboard/surveys/${surveyId}/analysis`)}
              variant="outline"
            >
              View Analysis
            </Button>
            <Button
              onClick={() => router.push(`/dashboard/surveys/${surveyId}/edit`)}
              variant="outline"
            >
              Edit Survey
            </Button>
          </div>
        )}
      </div>
      
      <div className="grid gap-6">
        {/* Basic Info */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Title</h3>
              <p className="text-gray-600">{survey.title}</p>
            </div>
            {survey.description && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Description</h3>
                <p className="text-gray-600">{survey.description}</p>
              </div>
            )}
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

        {/* Project Info */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Project Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Status</h3>
              <Badge variant={survey.is_active ? "default" : "secondary"}>
                {survey.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Languages</h3>
              <div className="flex gap-2">
                {survey.languages.map(lang => (
                  <Badge key={lang} variant="outline">{lang.toUpperCase()}</Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* QR Code & Public Access */}
        {((survey.token && qrCodeData) || (survey.tokens && survey.tokens.length > 0)) && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Public Access</h2>
              <Badge variant="outline">
                {qrCodeData ? 'Available' : 'QR Code Unavailable'}
              </Badge>
            </div>
            
            <div className="space-y-6">
              {qrCodeData ? (
                qrCodeData.tokens.map((tokenData, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-gray-50">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">
                            Token: <span className="font-bold">{tokenData.description}</span>
                          </h3>
                          <div className="flex items-center mt-1 gap-2">
                            <Badge variant="secondary" className="text-md px-3 py-1">
                              {tokenData.token}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(tokenData.token);
                                toast({
                                  title: "Token Copied",
                                  description: "Token copied to clipboard",
                                });
                              }}
                            >
                              Copy
                            </Button>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Public Survey Link</h3>
                          <div className="mt-1">
                            <a 
                              href={`/survey/${tokenData.token}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline break-all"
                            >
                              {window.location.origin}/survey/{tokenData.token}
                            </a>
                          </div>
                          <div className="mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/survey/${tokenData.token}`);
                                toast({
                                  title: "URL Copied",
                                  description: "Survey URL copied to clipboard",
                                });
                              }}
                            >
                              Copy URL
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center">
                        <h3 className="text-sm font-medium text-gray-500 mb-2">QR Code</h3>
                        <div className="border rounded p-2 bg-white">
                          <Image 
                            src={tokenData.qr_code_url} 
                            alt="QR Code for Survey" 
                            width={150} 
                            height={150}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            // Create a temporary anchor element
                            const a = document.createElement('a');
                            a.href = tokenData.qr_code_url;
                            a.download = `survey-qr-code-${tokenData.token}.png`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-6">
                  <p>QR Code data is unavailable</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Location Information */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Location Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">City</p>
              <p className="text-gray-600">{survey.city || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Country</p>
              <p className="text-gray-600">{survey.country || 'Not specified'}</p>
            </div>
          </div>
        </Card>

        {/* Survey Settings */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Survey Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Survey Format</h3>
              <p className="text-gray-600">{survey?.format || 'Not specified'}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Survey Type</h3>
              <p className="text-gray-600">{survey?.type || 'Not specified'}</p>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Survey Dates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Start Date & Time</p>
                <p className="text-gray-600">
                  {survey?.start_datetime 
                    ? new Date(survey.start_datetime).toLocaleString() 
                    : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">End Date & Time</p>
                <p className="text-gray-600">
                  {survey?.expiry_date 
                    ? new Date(survey.expiry_date).toLocaleString() 
                    : 'Not set'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Analysis Cluster */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Analysis Cluster</h2>
          <p className="mt-1">{survey.analysis_cluster || 'Standard'}</p>
        </Card>

        {/* Public Link */}
        {publicLink && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Public Link</h2>
              <Badge variant="outline">
                {copied ? <CheckIcon className="h-4 w-4 text-green-500" /> : 'Copy'}
              </Badge>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Public Survey Link</h3>
                <div className="mt-1">
                  <a 
                    href={publicLink}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {publicLink}
                  </a>
                </div>
                <div className="mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                  >
                    {copied ? t('success.copied') : t('actions.copy')}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
} 