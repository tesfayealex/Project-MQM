"use client"

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { Loader2, BarChart2, ArrowDownIcon, ArrowUpIcon, ListFilter, CheckIcon, EditIcon, Download } from 'lucide-react';
import { getSurvey, getSurveyStats, getSurveyResponses, getSurveyResponseWords, updateWordCluster, exportSurveyResponses, exportSurveyClusters, testExportEndpoint } from '@/lib/services/survey-service';
import { processSurveyResponses } from '@/lib/services/cluster-service';
import { getActiveClusters } from '@/lib/services/cluster-service';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useTranslation } from 'react-i18next';

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
    sentence_sentiments?: Array<{
      text: string;
      sentiment: number;
      index?: number;
    }>;
  }>;
}

interface SurveyStatsClientProps {
  surveyId?: string; // Make surveyId optional
}

export function SurveyStatsClient({ surveyId: propsSurveyId }: SurveyStatsClientProps) {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const { t, i18n } = useTranslation('surveys', { useSuspense: false });
  
  // Get surveyId from props or from route params
  const surveyId = propsSurveyId || (params?.id as string);
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "enhanced">("table");
  const [extractedWordsMap, setExtractedWordsMap] = useState<Record<string, any[]>>({});
  const [loadingExtractedWords, setLoadingExtractedWords] = useState<Record<string, boolean>>({});
  const [availableClusters, setAvailableClusters] = useState<string[]>([]);
  const [editingWordId, setEditingWordId] = useState<number | null>(null);
  const [updatingCluster, setUpdatingCluster] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingClusters, setExportingClusters] = useState(false);
  const [expandedResponseId, setExpandedResponseId] = useState<string | null>(null);
  const [responseWords, setResponseWords] = useState<Record<string, any[]>>({});
  const [clusters, setClusters] = useState<any[]>([]);
  
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

  // Load available clusters for dropdown
  useEffect(() => {
    async function loadAvailableClusters() {
      try {
        const clusters = await getActiveClusters();
        setAvailableClusters(clusters.map(cluster => cluster.name));
      } catch (error) {
        console.error("Error loading clusters:", error);
      }
    }
    
    loadAvailableClusters();
  }, []);

  // Make sure the surveys namespace is loaded
  useEffect(() => {
    i18n.loadNamespaces('surveys').catch(err => 
      console.error('Failed to load surveys namespace:', err)
    );
  }, [i18n]);

  // Function to handle cluster update
  const handleUpdateCluster = async (wordId: number, clusterId: number, wordIndex: number, responseId: string, newCluster: string) => {
    try {
      setUpdatingCluster(true);
      setEditingWordId(wordId);
      
      await updateWordCluster(wordId, newCluster);
      
      // Update local state
      setExtractedWordsMap(prev => {
        const words = [...prev[responseId]];
        words[wordIndex] = {
          ...words[wordIndex],
          assigned_cluster: newCluster
        };
        return { ...prev, [responseId]: words };
      });
      
      toast({
        title: "Cluster updated",
        description: "The word has been assigned to a new cluster.",
      });
    } catch (error) {
      console.error("Error updating cluster:", error);
      toast({
        title: "Error updating cluster",
        description: "There was a problem updating the cluster.",
        variant: "destructive"
      });
    } finally {
      setUpdatingCluster(false);
      setEditingWordId(null);
    }
  };

  // Add a function to handle processing all responses
  async function handleProcessAllResponses() {
    if (!surveyId) return;
    
    try {
      setProcessing(true);
      const result = await processSurveyResponses(surveyId);
      
      // Show success message
      toast({
        title: "Success",
        description: result.message || "Responses processed successfully",
      });
      
      // Reload responses to show updated data
      if (surveyId) {
        const newResponses = await getSurveyResponses(surveyId);
        setResponses(newResponses);
      }
      
    } catch (error: any) {
      console.error('Error processing responses:', error);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to process responses",
      });
      
      // Handle authentication errors
      handleAuthError(error);
      
    } finally {
      setProcessing(false);
    }
  }

  // Helper function to load extracted words for a response
  const loadExtractedWords = async (responseId: string) => {
    try {
      if (extractedWordsMap[responseId] || loadingExtractedWords[responseId]) {
        return; // Already loaded or loading
      }
      
      setLoadingExtractedWords(prev => ({ ...prev, [responseId]: true }));
      
      const words = await getSurveyResponseWords(responseId);
      
      setExtractedWordsMap(prev => ({
        ...prev,
        [responseId]: words
      }));
      
      setLoadingExtractedWords(prev => ({ ...prev, [responseId]: false }));
    } catch (error) {
      console.error(`Error loading extracted words for response ${responseId}:`, error);
      setLoadingExtractedWords(prev => ({ ...prev, [responseId]: false }));
    }
  };

  // Load extracted words when expanded
  const handleAccordionValueChange = (value: string) => {
    if (value && viewMode === "enhanced") {
      const responseId = value.replace('item-', '');
      loadExtractedWords(responseId);
    }
  };

  const handleExportResponses = async () => {
    setExporting(true);
    try {
      console.log(`Exporting responses for survey ID: ${surveyId} at ${new Date().toISOString()}`);
      const result = await exportSurveyResponses(surveyId);
      console.log(`Export result:`, result);
      toast({
        title: "Export Successful",
        description: "Responses have been exported to Excel.",
      });
    } catch (error) {
      console.error(`Export failed for survey ID: ${surveyId} at ${new Date().toISOString()}`, error);
      toast({
        title: "Export Failed",
        description: `There was an error exporting the responses: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      
      // Show more detailed error in console for debugging
      if (error instanceof Error) {
        console.error(`Export error details: ${error.stack || error.message}`);
      }
    } finally {
      setExporting(false);
    }
  };

  const handleExportClusters = async () => {
    setExportingClusters(true);
    try {
      console.log(`Exporting clusters for survey ID: ${surveyId} at ${new Date().toISOString()}`);
      const result = await exportSurveyClusters(surveyId);
      console.log(`Clusters export result:`, result);
      toast({
        title: "Export Successful",
        description: "Clusters have been exported to Excel.",
      });
    } catch (error) {
      console.error(`Clusters export failed for survey ID: ${surveyId} at ${new Date().toISOString()}`, error);
      toast({
        title: "Export Failed",
        description: `There was an error exporting the clusters: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setExportingClusters(false);
    }
  };

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
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-bold">All Responses ({responses.length})</h2>
              <div className="flex items-center border rounded-md overflow-hidden">
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none h-8"
                  onClick={() => setViewMode("table")}
                >
                  Table View
                </Button>
                <Button
                  variant={viewMode === "enhanced" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none h-8"
                  onClick={() => setViewMode("enhanced")}
                >
                  Enhanced View
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {/* Export to Excel button */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 lg:flex"
                    onClick={handleExportResponses}
                    disabled={exporting || !surveyId || responses.length === 0}
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Export to Excel
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download all responses as an Excel file</p>
                </TooltipContent>
              </Tooltip>

              {/* Replace test button with Export Clusters button */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleExportClusters} 
                    variant="outline"
                    size="sm"
                    className="h-8 lg:flex"
                    disabled={exportingClusters || !surveyId || responses.length === 0}
                  >
                    {exportingClusters ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Export Clusters
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download cluster analysis as an Excel file</p>
                </TooltipContent>
              </Tooltip>

              {/* Process All Responses button */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 lg:flex"
                    onClick={handleProcessAllResponses}
                    disabled={processing || !surveyId}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <BarChart2 className="mr-2 h-4 w-4" />
                        Process All Responses
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Process all responses to assign words to clusters</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          {responses.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No responses yet for this survey.</p>
              </CardContent>
            </Card>
          ) : viewMode === "table" ? (
            // Table View
            <Card>
              <CardContent className="pt-6 p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Language</TableHead>
                      {/* Dynamically generate columns based on first response's questions */}
                      {responses[0]?.answers?.map((answer: any) => {
                        const questionText = 
                          answer.question?.questions?.[responses[0].language] || 
                          answer.question?.questions?.en || 
                          (answer.question?.questions && Object.values(answer.question?.questions)[0]) || 
                          `Question ${answer.question?.order || ''}`;
                        
                        return (
                          <TableHead key={answer.question?.id}>
                            {answer.question?.type === 'nps' ? `NPS: ${questionText}` : questionText}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responses.map((response, index) => (
                      <TableRow key={response.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{format(new Date(response.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{response.language.toUpperCase()}</Badge>
                        </TableCell>
                        {/* Map each answer to its column, maintaining the order */}
                        {responses[0]?.answers?.map((firstAnswer: any) => {
                          const matchingAnswer = response.answers?.find(
                            (a: any) => a.question?.id === firstAnswer.question?.id
                          );
                          
                          if (!matchingAnswer) {
                            return <TableCell key={`empty-${firstAnswer.question?.id}`}>-</TableCell>;
                          }
                          
                          return (
                            <TableCell key={matchingAnswer.id}>
                              {matchingAnswer.question?.type === 'nps' ? (
                                <div className="flex items-center space-x-2">
                                  <span className={`text-lg font-bold ${
                                    matchingAnswer.nps_rating !== undefined ? (
                                      matchingAnswer.nps_rating >= 9 ? "text-green-500" : 
                                      matchingAnswer.nps_rating >= 7 ? "text-yellow-500" : 
                                      "text-red-500"
                                    ) : ""
                                  }`}>
                                    {matchingAnswer.nps_rating !== undefined ? matchingAnswer.nps_rating : '-'}
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  {matchingAnswer.text_answer || <span className="text-muted-foreground">-</span>}
                                  {/* {matchingAnswer.sentiment_score !== undefined && (
                                    <div className="mt-1">
                                      <Badge variant="outline" className={
                                        matchingAnswer.sentiment_score > 0.3 ? "text-green-500 border-green-200" :
                                        matchingAnswer.sentiment_score < -0.3 ? "text-red-500 border-red-200" :
                                        "text-yellow-500 border-yellow-200"
                                      }>
                                        Sentiment: {
                                          matchingAnswer.sentiment_score > 0.3 ? "Positive" :
                                          matchingAnswer.sentiment_score < -0.3 ? "Negative" :
                                          "Neutral"
                                        }
                                      </Badge>
                                    </div>
                                  )} */}
                                  
                                  {/* Display sentence-level sentiments if available */}
                                  {matchingAnswer.sentence_sentiments && matchingAnswer.sentence_sentiments.length > 0 && (
                                    <div className="mt-2">
                                      <Accordion type="single" collapsible className="w-full">
                                        <AccordionItem value="sentence-analysis" className="border-0">
                                          <AccordionTrigger className="py-1 px-0 text-sm font-medium">
                                            {t('stats.sentenceAnalysis')} ({matchingAnswer.sentence_sentiments?.length || 0})
                                          </AccordionTrigger>
                                          <AccordionContent className="pt-2 pb-0">
                                            <div className="space-y-2">
                                              {matchingAnswer.sentence_sentiments?.map((sentence, idx) => (
                                                <div key={idx} className="pl-2 border-l-2 border-gray-200 mt-1">
                                                  <p className="text-sm">{sentence.text}</p>
                                                  <Badge variant="outline" className={
                                                    sentence.sentiment > 0.3 ? "text-green-500 border-green-200" :
                                                    sentence.sentiment < -0.3 ? "text-red-500 border-red-200" :
                                                    "text-yellow-500 border-yellow-200"
                                                  }>
                                                    {sentence.sentiment > 0.3 ? t('stats.positive') :
                                                     sentence.sentiment < -0.3 ? t('stats.negative') :
                                                     t('stats.neutral')} ({sentence.sentiment.toFixed(2)})
                                                  </Badge>
                                                </div>
                                              ))}
                                            </div>
                                          </AccordionContent>
                                        </AccordionItem>
                                      </Accordion>
                                    </div>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            // Enhanced View (Original Accordion)
            <Accordion 
              type="single" 
              collapsible 
              className="space-y-4"
              onValueChange={handleAccordionValueChange}
            >
              {responses.map((response, index) => {
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
                        <div className="space-y-4">
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
                                          {/* {answer.sentiment_score !== undefined && (
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
                                          )} */}
                                          
                                          {/* Display sentence-level sentiments if available */}
                                          {answer.sentence_sentiments && answer.sentence_sentiments.length > 0 && (
                                            <div className="mt-2">
                                              <Accordion type="single" collapsible className="w-full">
                                                <AccordionItem value="sentence-analysis" className="border-0">
                                                  <AccordionTrigger className="py-1 px-0 text-sm font-medium">
                                                    {t('stats.sentenceAnalysis')} ({answer.sentence_sentiments?.length || 0})
                                                  </AccordionTrigger>
                                                  <AccordionContent className="pt-2 pb-0">
                                                    <div className="space-y-2">
                                                      {answer.sentence_sentiments?.map((sentence, idx) => (
                                                        <div key={idx} className="pl-2 border-l-2 border-gray-200 mt-1">
                                                          <p className="text-sm">{sentence.text}</p>
                                                          <Badge variant="outline" className={
                                                            sentence.sentiment > 0.3 ? "text-green-500 border-green-200" :
                                                            sentence.sentiment < -0.3 ? "text-red-500 border-red-200" :
                                                            "text-yellow-500 border-yellow-200"
                                                          }>
                                                            {sentence.sentiment > 0.3 ? t('stats.positive') :
                                                             sentence.sentiment < -0.3 ? t('stats.negative') :
                                                             t('stats.neutral')} ({sentence.sentiment.toFixed(2)})
                                                          </Badge>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </AccordionContent>
                                                </AccordionItem>
                                              </Accordion>
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
                          
                          {/* Extracted Words Section */}
                          <div className="mt-4">
                            <h3 className="text-lg font-semibold mb-2">Extracted Words</h3>
                            {loadingExtractedWords[response.id] ? (
                              <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                <span>Loading extracted words...</span>
                              </div>
                            ) : extractedWordsMap[response.id]?.length ? (
                              <div className="border rounded-md p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {extractedWordsMap[response.id].map((word, wordIndex) => (
                                    <div key={word.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-gray-50">
                                      <span className="font-medium">{word.word}</span>
                                      
                                      <Popover open={editingWordId === word.id}>
                                        <PopoverTrigger asChild>
                                          <div className="flex items-center">
                                            {word.assigned_cluster ? (
                                              <Badge 
                                                variant="outline" 
                                                className="ml-2 cursor-pointer hover:bg-gray-100 flex items-center"
                                                onClick={() => setEditingWordId(word.id)}
                                              >
                                                {word.assigned_cluster}
                                                <EditIcon className="h-3 w-3 ml-1" />
                                              </Badge>
                                            ) : (
                                              <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => setEditingWordId(word.id)}
                                                className="h-6 px-2"
                                              >
                                                <span className="text-xs">Assign Cluster</span>
                                              </Button>
                                            )}
                                          </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0 w-60" align="end">
                                          <Command>
                                            <CommandInput placeholder="Search for a cluster..." />
                                            <CommandList>
                                              <CommandEmpty>No clusters found.</CommandEmpty>
                                              <CommandGroup>
                                                {availableClusters.map(cluster => (
                                                  <CommandItem
                                                    key={cluster}
                                                    onSelect={() => {
                                                      handleUpdateCluster(word.id, word.id, wordIndex, response.id, cluster);
                                                    }}
                                                    className="cursor-pointer"
                                                  >
                                                    <span>{cluster}</span>
                                                    {word.assigned_cluster === cluster && (
                                                      <CheckIcon className="h-4 w-4 ml-auto" />
                                                    )}
                                                  </CommandItem>
                                                ))}
                                                {/* Option to create a new cluster */}
                                                <CommandItem
                                                  className="border-t cursor-pointer"
                                                  onSelect={() => {
                                                    const newCluster = prompt("Enter a name for the new cluster:");
                                                    if (newCluster) {
                                                      handleUpdateCluster(word.id, word.id, wordIndex, response.id, newCluster);
                                                    }
                                                  }}
                                                >
                                                  <span className="font-medium text-blue-600">+ Create new cluster</span>
                                                </CommandItem>
                                              </CommandGroup>
                                            </CommandList>
                                          </Command>
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center p-4 text-muted-foreground">
                                <p>No extracted words available</p>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="mt-2"
                                  onClick={() => loadExtractedWords(response.id)}
                                >
                                  Load Words
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
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

// ...existing code...