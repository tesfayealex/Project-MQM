"use client"

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { getSurvey, getSurveyStats, getSurveyResponses } from '@/lib/services/survey-service';
import { Survey, SurveyStats } from '@/types/survey';
import { useToast } from '@/components/ui/use-toast';
import { handleAuthError } from '@/lib/auth-utils';
import Link from 'next/link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';

interface Response {
  id: string;
  created_at: string;
  language: string;
  session_id: string;
  answers: Array<{
    id: string;
    question: {
      id: string;
      type: string;
      questions: Record<string, string>;
      order: number;
    };
    nps_rating?: number;
    text_answer?: string;
    sentiment_score?: number;
  }>;
}

interface SurveyStatsClientProps {
  surveyId?: string; // Make surveyId optional
}

export function SurveyStatsClient({ surveyId: propsSurveyId }: SurveyStatsClientProps) {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  // Get surveyId from props or from route params
  const surveyId = propsSurveyId || (params?.id as string);
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchSurveyAndStats() {
      try {
        setLoading(true);
        setError(null);
        
        // First fetch the survey data
        const surveyData = await getSurvey(surveyId);
        console.log('Survey data:', surveyData);
        setSurvey(surveyData);
        
        // Then fetch the statistics
        const statsData = await getSurveyStats(surveyId);
        console.log('Stats data (raw received):', statsData);
        console.log('Stats data (detailed):', JSON.stringify(statsData, null, 2));
        
        // Add type checking for debugging
        console.log('Stats data types:', {
          nps_average: typeof statsData.nps_average,
          nps_score: typeof statsData.nps_score,
          promoters: typeof statsData.promoters,
          passives: typeof statsData.passives,
          detractors: typeof statsData.detractors
        });
        
        // Validate and ensure stats data has expected properties
        const validatedStats = {
          ...statsData,
          // Use nullish coalescing to preserve 0 values but replace null/undefined
          total_responses: statsData?.total_responses ?? 0,
          promoters: statsData?.promoters ?? 0,
          passives: statsData?.passives ?? 0,
          detractors: statsData?.detractors ?? 0,
          // These can be null/undefined if no data, which is expected
          nps_average: statsData?.nps_average,
          nps_score: statsData?.nps_score,
          completion_rate: statsData?.completion_rate ?? 0,
        };
        
        console.log('Validated stats data to be used:', validatedStats);
        setStats(validatedStats);
        
        // Finally fetch responses for this survey
        const responsesData = await getSurveyResponses(surveyId);
        console.log('Responses data (raw):', JSON.stringify(responsesData, null, 2));
        
        // Ensure each response has an answers array
        const processedResponses = responsesData.map(response => {
          // Check if answers exists and is an array
          if (!response.answers || !Array.isArray(response.answers)) {
            console.warn(`Response ${response.id} has no answers or answers is not an array`);
            return {...response, answers: []};
          }
          return response;
        });
        
        setResponses(processedResponses);
      } catch (error: any) {
        console.error('Error fetching survey data:', error);
        setError(error.message || 'Failed to load survey data');
        
        // Handle authentication errors
        const isAuthError = await handleAuthError(error);
        if (!isAuthError) {
          toast({
            title: 'Error',
            description: 'Failed to load survey data. Please try again.',
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
      }
    }
    
    fetchSurveyAndStats();
  }, [surveyId, toast]);

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center text-lg text-muted-foreground">
          Loading survey statistics...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex flex-col items-center">
          <div className="text-lg text-red-500 mb-4">Error: {error}</div>
          <Button onClick={() => router.push('/dashboard/surveys')}>
            Return to Surveys
          </Button>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center text-lg text-muted-foreground">
          Survey not found or you don't have permission to view it.
        </div>
      </div>
    );
  }

  // Calculate NPS categories if available
  const promoters = stats?.promoters ?? 0;
  const passives = stats?.passives ?? 0;
  const detractors = stats?.detractors ?? 0;
  const totalResponses = stats?.total_responses ?? 0;
  const totalNpsResponses = promoters + passives + detractors;
  
  // Ensure NPS score calculation is displayed correctly
  let npsScore: number | string = 'N/A';
  if (stats?.nps_score !== undefined && stats?.nps_score !== null) {
    npsScore = stats.nps_score;
  } else if (totalNpsResponses > 0) {
    // Calculate it ourselves if the backend didn't provide it
    npsScore = Math.round(((promoters - detractors) / totalNpsResponses) * 100);
  }
  
  const npsAverage = stats?.nps_average !== undefined && stats?.nps_average !== null ? stats.nps_average : 'N/A';

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link href={`/dashboard/surveys/${surveyId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Survey
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{survey.title} - Statistics</h1>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="responses">All Responses ({totalResponses})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          {!stats ? (
            <Card>
              <CardContent className="py-6">
                <div className="flex flex-col items-center justify-center">
                  <p className="text-muted-foreground mb-2">No statistics available yet</p>
                  <p className="text-sm text-muted-foreground">This could be because there are no responses or the data is still loading.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">Total Responses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{totalResponses}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">NPS Average</CardTitle>
                    <CardDescription>Average rating (0-10)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{npsAverage}</div>
                    <div className="text-sm text-muted-foreground">
                      Based on {totalNpsResponses} NPS responses
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">NPS Score</CardTitle>
                    <CardDescription>Net Promoter Score (-100 to 100)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{npsScore}</div>
                    <div className="text-sm text-muted-foreground">
                      {promoters} promoters, {passives} passives, {detractors} detractors
                    </div>
                  </CardContent>
                </Card>

                {stats?.completion_rate !== undefined && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl">Completion Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{stats.completion_rate}%</div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {stats?.nps_score !== undefined && (
                <Card>
                  <CardHeader>
                    <CardTitle>NPS Breakdown</CardTitle>
                    <CardDescription>Distribution of NPS responses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted-foreground">Promoters (9-10)</div>
                        <div className="text-2xl font-bold text-green-500">{promoters}</div>
                        <div className="text-sm font-medium">{totalResponses > 0 ? Math.round((promoters / totalResponses) * 100) : 0}%</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted-foreground">Passives (7-8)</div>
                        <div className="text-2xl font-bold text-yellow-500">{passives}</div>
                        <div className="text-sm font-medium">{totalResponses > 0 ? Math.round((passives / totalResponses) * 100) : 0}%</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted-foreground">Detractors (0-6)</div>
                        <div className="text-2xl font-bold text-red-500">{detractors}</div>
                        <div className="text-sm font-medium">{totalResponses > 0 ? Math.round((detractors / totalResponses) * 100) : 0}%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {stats?.responses_by_language && stats.responses_by_language.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Responses by Language</CardTitle>
                    <CardDescription>Distribution of responses across languages</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Language</TableHead>
                          <TableHead>Responses</TableHead>
                          <TableHead>Percentage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.responses_by_language.map((item: any) => (
                          <TableRow key={item.language}>
                            <TableCell>
                              <Badge variant="outline">{item.language.toUpperCase()}</Badge>
                            </TableCell>
                            <TableCell>{item.count}</TableCell>
                            <TableCell>
                              {totalResponses > 0 ? Math.round((item.count / totalResponses) * 100) : 0}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="responses">
          {responses.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No responses yet for this survey.</p>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="single" collapsible className="space-y-4">
              {responses.map((response, index) => {
                // Log the full response for debugging
                if (index === 0) {
                  console.log(`Response ${index} (${response.id}):`, response);
                  console.log(`Response ${index} answers:`, response.answers);
                }
                
                // Safely access answers and handle empty arrays
                const hasAnswers = response.answers && Array.isArray(response.answers) && response.answers.length > 0;
                
                // Sort answers by question order if available
                const sortedAnswers = hasAnswers
                  ? [...response.answers].sort((a, b) => (a.question?.order || 0) - (b.question?.order || 0))
                  : [];
                  
                return (
                  <AccordionItem value={`item-${response.id}`} key={response.id} className="border rounded-md p-2">
                    <AccordionTrigger className="px-4">
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center space-x-4">
                          <span className="font-medium">Response #{index + 1}</span>
                          <Badge variant="outline">{response.language.toUpperCase()}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(response.created_at), 'MMM d, yyyy HH:mm')}
                          </span>
                          {!hasAnswers && (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                              No answers
                            </Badge>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pt-2">
                      {sortedAnswers.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Question</TableHead>
                              <TableHead>Answer</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedAnswers.map((answer) => (
                              <TableRow key={answer.id}>
                                <TableCell className="align-top">
                                  {answer.question?.questions ? 
                                    (answer.question.questions[response.language] || 
                                     answer.question.questions.en || 
                                     Object.values(answer.question.questions)[0] || 
                                     'Untitled Question') : 'Question data unavailable'}
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    // Debug logs outside JSX
                                    if (answer.question?.type === 'nps') {
                                      console.log(`NPS Rating for answer ${answer.id}:`, answer.nps_rating);
                                    } else {
                                      console.log(`Text answer for ${answer.id}:`, answer.text_answer, typeof answer.text_answer);
                                    }
                                    
                                    return answer.question?.type === 'nps' ? (
                                      <div className="flex items-center space-x-2">
                                        <span className="text-lg font-bold">{answer.nps_rating !== undefined ? answer.nps_rating : 'No rating'}</span>
                                        {answer.nps_rating !== undefined && (
                                          <Badge 
                                            className={
                                              answer.nps_rating >= 9 ? "bg-green-500" : 
                                              answer.nps_rating >= 7 ? "bg-yellow-500" : 
                                              "bg-red-500"
                                            }
                                          >
                                            {answer.nps_rating >= 9 ? "Promoter" : 
                                             answer.nps_rating >= 7 ? "Passive" : 
                                             "Detractor"}
                                          </Badge>
                                        )}
                                      </div>
                                    ) : (
                                      <div>
                                        {answer.text_answer !== undefined ? answer.text_answer : <span className="text-muted-foreground">No answer</span>}
                                        {answer.sentiment_score !== undefined && (
                                          <div className="mt-1">
                                            <Badge variant="outline" className={
                                              answer.sentiment_score > 0.3 ? "text-green-500 border-green-200" :
                                              answer.sentiment_score < -0.3 ? "text-red-500 border-red-200" :
                                              "text-yellow-500 border-yellow-200"
                                            }>
                                              Sentiment: {
                                                answer.sentiment_score > 0.3 ? "Positive" :
                                                answer.sentiment_score < -0.3 ? "Negative" :
                                                "Neutral"
                                              }
                                            </Badge>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="py-4 text-center text-muted-foreground">
                          <p className="mb-2">No answers in this response</p>
                          <p className="text-sm">Response ID: {response.id}</p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 