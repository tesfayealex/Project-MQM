'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SentimentChart } from '@/components/analysis/SentimentChart';
import { WordCloudChart } from '@/components/analysis/WordCloudChart';
import { ClusterList } from '@/components/analysis/ClusterList';
import { getSurveyAnalysisSummary, getWordCloud, getClusterCloud, analyzeResponses, processAllResponses } from '@/lib/services/analysis-service';
import { SurveyAnalysisSummary, WordCloudItem } from '@/types/analysis';
import { Loader2, BanIcon, PieChart, BarChart, GlobeIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  ResponsiveContainer,
  PieChart as RechartPieChart,
  Pie,
  Cell,
  BarChart as RechartBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { handleAuthError } from '@/lib/auth-utils';
import { getCookie } from 'cookies-next';
import { useLanguage } from '@/contexts/language-context';

// Define interfaces for chart components
interface LanguageBreakdown {
  [key: string]: number;
}

interface LanguageDistributionChartProps {
  breakdown: LanguageBreakdown;
}

interface SatisfactionMetricsChartProps {
  average: number;
  median: number;
  low: number;
  high: number;
}

interface SentimentDivergenceChartProps {
  divergence: number;
  positivePercentage: number;
  negativePercentage: number;
  neutralPercentage: number;
}

// Add interface definitions for component props
interface SentimentChartProps {
  positive: number;
  negative: number;
  neutral: number;
  improved?: boolean;
}

interface ClusterListProps {
  clusters: any[];
  title: string;
  showVisualizations?: boolean;
  positiveTheme?: boolean;
  negativeTheme?: boolean;
  neutralTheme?: boolean;
}

// New component to visualize language breakdown
const LanguageDistributionChart = ({ breakdown }: LanguageDistributionChartProps) => {
  const data = Object.entries(breakdown).map(([lang, count]) => ({
    name: lang.toUpperCase(),
    value: count,
  }));
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <RechartPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={70}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => {
            if (typeof value === 'number') {
              return [`${value.toFixed(1)}%`];
            }
            return [`${value}%`];
          }} />
        </RechartPieChart>
      </ResponsiveContainer>
    </div>
  );
};

// New component for satisfaction metrics visualization
const SatisfactionMetricsChart = ({ average, median, low, high }: SatisfactionMetricsChartProps) => {
  const data = [
    { name: 'Average', value: average },
    { name: 'Median', value: median }
  ];

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <RechartBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis domain={[0, 5]} />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#8884d8" />
          {/* Confidence interval overlay */}
          <line 
            x1="0%" 
            y1={100 - (low * 20)} 
            x2="100%" 
            y2={100 - (low * 20)} 
            stroke="red" 
            strokeWidth={1} 
            strokeDasharray="5 5" 
          />
          <line 
            x1="0%" 
            y1={100 - (high * 20)} 
            x2="100%" 
            y2={100 - (high * 20)} 
            stroke="red" 
            strokeWidth={1} 
            strokeDasharray="5 5" 
          />
        </RechartBarChart>
      </ResponsiveContainer>
    </div>
  );
};

// New component for sentiment divergence visualization
const SentimentDivergenceChart = ({ divergence, positivePercentage, negativePercentage, neutralPercentage }: SentimentDivergenceChartProps) => {
  const data = [
    { name: 'Positive', value: positivePercentage },
    { name: 'Negative', value: negativePercentage },
    { name: 'Neutral', value: neutralPercentage },
  ];

  // Create another dataset that shows the divergence
  const divergenceData = [
    { name: 'Sentiment Divergence', value: Math.abs(divergence) },
    { name: 'Baseline', value: 100 - Math.abs(divergence) }
  ];

  return (
    <div className="space-y-4">
      <div className="h-48 w-full">
        <ResponsiveContainer>
          <RechartBarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis type="category" dataKey="name" />
            <Tooltip formatter={(value) => {
              if (typeof value === 'number') {
                return [`${value.toFixed(1)}%`];
              }
              return [`${value}%`];
            }} />
            <Bar dataKey="value" fill="#8884d8" />
          </RechartBarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          Sentiment Divergence: {divergence.toFixed(1)}
        </div>
        <div className="w-2/3 bg-gray-200 rounded-full h-4">
          <div
            className="bg-blue-600 h-4 rounded-full"
            style={{ width: `${Math.min(Math.abs(divergence), 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

interface SurveyAnalysisProps {
  surveyId: string;
}

export default function SurveyAnalysisClient({ surveyId }: SurveyAnalysisProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { t, i18n } = useTranslation(['surveys', 'common'], { useSuspense: false });
  const { locale: currentLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [summary, setSummary] = useState<SurveyAnalysisSummary | null>(null);
  const [wordCloud, setWordCloud] = useState<WordCloudItem[]>([]);
  const [clusterCloud, setClusterCloud] = useState<WordCloudItem[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [wordCloudMode, setWordCloudMode] = useState<'words' | 'clusters'>('words');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load translations
    i18n.loadNamespaces(['surveys', 'common']).catch(err => 
      console.error('Failed to load namespaces:', err)
    );
  }, [i18n]);

  useEffect(() => {
    // Update selected language when global language changes
    if (currentLanguage && summary?.language_breakdown?.[currentLanguage]) {
      setSelectedLanguage(currentLanguage);
    }
  }, [currentLanguage, summary]);

  useEffect(() => {
    loadAnalysisData();
  }, [surveyId]);

  useEffect(() => {
    if (summary) {
      loadWordCloud();
      loadClusterCloud();
    }
  }, [selectedLanguage, summary]);

  async function loadAnalysisData() {
    if (!surveyId) return;

    try {
      setLoading(true);
      const data = await getSurveyAnalysisSummary(surveyId);
      
      // Verify response data accuracy
      if (data) {
        // Make sure to validate response count matches actual data
        console.log("Loaded analysis data:", data);
      }
      
      setSummary(data);
      
      // Set initial language with better error handling
      if (data?.language_breakdown && Object.keys(data.language_breakdown).length > 0) {
        const languages = Object.keys(data.language_breakdown);
        setSelectedLanguage(languages[0]);
      } else {
        // Default to English if no language data is available
        setSelectedLanguage('en');
      }
    } catch (error: any) {
      toast({
        title: "Error loading analysis",
        description: error.message || "Failed to load survey analysis",
        variant: "destructive"
      });
      handleAuthError(error);
      setError(t('errors.analysisLoadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function loadWordCloud() {
    if (!surveyId) return;

    try {
      const words = await getWordCloud(surveyId, selectedLanguage);
      setWordCloud(words || []);
    } catch (error: any) {
      setWordCloud([]);
      toast({
        title: "Error loading word cloud",
        description: error.message || "Failed to load word cloud data",
        variant: "destructive"
      });
    }
  }

  async function loadClusterCloud() {
    if (!surveyId) return;

    try {
      const clusters = await getClusterCloud(surveyId);
      setClusterCloud(clusters || []);
    } catch (error: any) {
      setClusterCloud([]);
      toast({
        title: "Error loading cluster cloud",
        description: error.message || "Failed to load cluster cloud data",
        variant: "destructive"
      });
    }
  }

  async function handleAnalyze(reset: boolean = false) {
    if (!surveyId) return;

    try {
      setAnalyzing(true);
      await analyzeResponses(surveyId, reset);
      await loadAnalysisData();
      toast({
        title: "Analysis Complete",
        description: "Survey responses have been analyzed successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze survey responses",
        variant: "destructive"
      });
      handleAuthError(error);
      setError(t('errors.analysisFailed'));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleProcessAllResponses() {
    if (!surveyId) return;

    try {
      setProcessing(true);
      const result = await processAllResponses(surveyId);
      
      // Show a more detailed toast with cluster information
      toast({
        title: "Processing Complete",
        description: `${result.message} Found ${result.cluster_count} custom clusters.`,
      });
      
      // Reload analysis data to reflect the changes
      await loadAnalysisData();
      
      // If there are clusters in the result, show them
      if (result.clusters && result.clusters.length > 0) {
        // Display info about the top 3 clusters
        const topClusters = result.clusters.slice(0, 3);
        const clusterInfo = topClusters.map(c => 
          `${c.name} (${c.response_frequencies} responses, avg NPS: ${c.avg_nps ? c.avg_nps.toFixed(1) : 'N/A'})`
        ).join(', ');
        
        toast({
          title: "Top Clusters",
          description: `Top clusters include: ${clusterInfo}`,
          duration: 5000,
        });
      }
    } catch (error: any) {
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process survey responses",
        variant: "destructive"
      });
      handleAuthError(error);
      setError(t('errors.processingFailed'));
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-10">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('errors.error')}</h3>
            <p className="text-gray-500">{error}</p>
            <Button 
              className="mt-4" 
              onClick={() => router.push('/dashboard/surveys')}
            >
              {t('actions.backToSurveys')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <div className="p-6">
        <Card className="p-4">
          <p className="text-center text-gray-600">No analysis data available</p>
          <div className="flex space-x-2 mb-4">
          <Button
            onClick={() => handleAnalyze(true)}
            disabled={analyzing}
              variant="outline"
            >
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>Reset & Analyze</>
              )}
            </Button>
            
            <Button 
              onClick={() => handleAnalyze()} 
              disabled={analyzing}
          >
            {analyzing ? (
              <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
              ) : (
                <>Analyze</>
              )}
            </Button>
            
            <Button 
              onClick={handleProcessAllResponses} 
              disabled={processing}
              variant="secondary"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>Process All Responses</>
              )}
          </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Placeholder component for tabs not yet implemented
  const ComingSoonPlaceholder = ({ title }: { title: string }) => (
    <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-gray-50">
      <BanIcon className="w-12 h-12 text-gray-400 mb-4" />
      <h3 className="text-xl font-medium text-gray-500">{title} Feature</h3>
      <p className="text-gray-400 mt-2">Coming soon in a future update</p>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Survey Analysis: {summary.survey_title}</h1>
        <Button
          onClick={() => handleAnalyze()}
          disabled={analyzing}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating Analysis...
            </>
          ) : "Update Analysis"}
        </Button>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Analysis</TabsTrigger>
          <TabsTrigger value="clusters">Custom Clusters</TabsTrigger>
          <TabsTrigger value="responses">All Responses</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
        </TabsList>

        {/* SUMMARY TAB */}
        <TabsContent value="summary" className="space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <BarChart className="w-5 h-5 mr-2 text-blue-500" />
                Response Overview
              </h3>
              <div className="text-center py-2">
                <div className="text-4xl font-bold text-blue-600">{summary.response_count}</div>
                <div className="text-sm text-gray-500">Total Responses</div>
              </div>
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-1 flex items-center">
                  <GlobeIcon className="w-4 h-4 mr-1 text-blue-500" />
                  Language Distribution
                </h4>
                <LanguageDistributionChart breakdown={summary.language_breakdown} />
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <PieChart className="w-5 h-5 mr-2 text-blue-500" />
                Satisfaction Metrics
              </h3>
              <SatisfactionMetricsChart 
                average={summary.average_satisfaction}
                median={summary.median_satisfaction}
                low={summary.satisfaction_confidence_low}
                high={summary.satisfaction_confidence_high}
              />
              <div className="text-xs text-gray-500 mt-2 text-center">
                95% confidence interval: {summary.satisfaction_confidence_low.toFixed(1)} - {summary.satisfaction_confidence_high.toFixed(1)}
              </div>
              <div className="mt-3 text-center">
                <div className="bg-gray-100 rounded p-2">
                  <div className="text-sm font-medium">Satisfaction Score</div>
                  <div className="text-2xl font-bold text-blue-600">{summary.satisfaction_score.toFixed(1)}</div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-2">Sentiment Overview</h3>
              <SentimentChart
                positive={summary.positive_percentage}
                negative={summary.negative_percentage}
                neutral={summary.neutral_percentage}
                improved={true}
              />
              {/* <div className="grid grid-cols-3 text-center mt-3">
                <div>
                  <div className="text-sm font-medium text-green-600">Positive</div>
                  <div className="text-lg font-bold">{summary.positive_percentage.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Neutral</div>
                  <div className="text-lg font-bold">{summary.neutral_percentage.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-red-500">Negative</div>
                  <div className="text-lg font-bold">{summary.negative_percentage.toFixed(1)}%</div>
                </div>
              </div> */}
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-3">Word Cloud</h3>
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <GlobeIcon className="w-5 h-5 text-blue-500" />
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="border rounded p-2"
                  >
                    {summary?.language_breakdown && Object.keys(summary.language_breakdown).length > 0 ? (
                      Object.keys(summary.language_breakdown).map(lang => (
                        <option key={lang} value={lang}>
                          {lang.toUpperCase()} ({summary.language_breakdown[lang]} responses)
                        </option>
                      ))
                    ) : (
                      <option value="en">EN</option>
                    )}
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="border rounded overflow-hidden flex">
                    <button
                      onClick={() => setWordCloudMode('words')}
                      className={`px-3 py-1 ${wordCloudMode === 'words' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                    >
                      Words
                    </button>
                    <button
                      onClick={() => setWordCloudMode('clusters')}
                      className={`px-3 py-1 ${wordCloudMode === 'clusters' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                    >
                      Clusters
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-64">
              <WordCloudChart 
                words={wordCloudMode === 'words' ? wordCloud : clusterCloud} 
                displayMode={wordCloudMode} 
              />
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <BarChart className="w-5 h-5 mr-2 text-blue-500" />
                Top Custom Clusters by Frequency
              </h3>
              <div className="overflow-auto max-h-64 pr-2">
                <table className="min-w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster Name</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Freq.</th>
                      {/* <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sentiment</th> */}
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">NPS</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {summary.top_clusters_data?.slice(0, 10).map((cluster, index) => (
                      <tr key={cluster.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                          <span className={`inline-block w-5 text-center ${
                            cluster.is_positive ? "text-green-600" : 
                            cluster.is_negative ? "text-red-600" : 
                            "text-yellow-600"
                          }`}>{index + 1}</span> {cluster.name}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right">{cluster.frequency}</td>
                        {/* <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                          <span className={
                            cluster.sentiment_score > 0 ? "text-green-600" :
                            cluster.sentiment_score < 0 ? "text-red-600" :
                            "text-gray-600"
                          }>
                            {cluster.sentiment_score.toFixed(2)}
                          </span>
                        </td> */}
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                          {cluster.nps_score !== null ? 
                            <span className={
                              cluster.nps_score >= 9 ? "text-green-600" :
                              cluster.nps_score <= 6 ? "text-red-600" :
                              "text-yellow-600"
                            }>
                              {cluster.nps_score.toFixed(1)}
                            </span> : 
                            <span className="text-gray-400">-</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-4">
              <SentimentDivergenceChart
                divergence={summary.sentiment_divergence}
                positivePercentage={summary.positive_percentage}
                negativePercentage={summary.negative_percentage}
                neutralPercentage={summary.neutral_percentage}
              />
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-4">
              <ClusterList
                clusters={summary.top_positive_clusters_data?.slice(0, 6) || []}
                title="Positive Clusters"
                positiveTheme={true}
              />
            </Card>

            <Card className="p-4">
              <ClusterList
                clusters={summary.top_negative_clusters_data?.slice(0, 6) || []}
                title="Negative Clusters"
                negativeTheme={true}
              />
            </Card>

            <Card className="p-4">
              <ClusterList
                clusters={summary.top_neutral_clusters_data?.slice(0, 6) || []}
                title="Neutral Clusters"
                neutralTheme={true}
              />
            </Card>
          </div>
        </TabsContent>

        {/* DETAILED ANALYSIS TAB */}
        <TabsContent value="detailed">
          <ComingSoonPlaceholder title="Detailed Analysis" />
        </TabsContent>

        {/* CLUSTERS TAB */}
        <TabsContent value="clusters" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">Top Custom Clusters by Frequency</h3>
              <div className="overflow-auto max-h-64 pr-2">
                <table className="min-w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster Name</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Freq.</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sentiment</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">NPS</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {summary.top_clusters_data?.slice(0, 10).map((cluster, index) => (
                      <tr key={cluster.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                          <span className={`inline-block w-5 text-center ${
                            cluster.is_positive ? "text-green-600" : 
                            cluster.is_negative ? "text-red-600" : 
                            "text-yellow-600"
                          }`}>{index + 1}</span> {cluster.name}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right">{cluster.frequency}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                          <span className={
                            cluster.sentiment_score > 0 ? "text-green-600" :
                            cluster.sentiment_score < 0 ? "text-red-600" :
                            "text-gray-600"
                          }>
                            {cluster.sentiment_score.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                          {cluster.nps_score !== null ? 
                            <span className={
                              cluster.nps_score >= 9 ? "text-green-600" :
                              cluster.nps_score <= 6 ? "text-red-600" :
                              "text-yellow-600"
                            }>
                              {cluster.nps_score.toFixed(1)}
                            </span> : 
                            <span className="text-gray-400">-</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-4 col-span-2">
              <h3 className="text-lg font-semibold mb-4">Custom Cluster Analysis</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Positive Custom Clusters</span>
                  <span className="font-semibold text-green-600">{summary.top_positive_clusters?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Negative Custom Clusters</span>
                  <span className="font-semibold text-red-600">{summary.top_negative_clusters?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Neutral Custom Clusters</span>
                  <span className="font-semibold text-yellow-600">{summary.top_neutral_clusters?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span>Total Custom Clusters</span>
                  <span className="font-semibold">{summary.top_clusters?.length || 0}</span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">All Custom Clusters in Survey Responses</h3>
            <div className="overflow-auto max-h-96">
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster Name</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sentiment</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {summary.top_clusters_data?.map((cluster, index) => (
                    <tr key={cluster.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">{index + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">{cluster.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right">{cluster.frequency}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                        <span className={
                          cluster.sentiment_score > 0 ? "text-green-600" :
                          cluster.sentiment_score < 0 ? "text-red-600" :
                          "text-gray-600"
                        }>
                          {cluster.sentiment_score.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          cluster.is_positive ? "bg-green-100 text-green-800" : 
                          cluster.is_negative ? "bg-red-100 text-red-800" : 
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {cluster.is_positive ? "Positive" : 
                          cluster.is_negative ? "Negative" : 
                          "Neutral"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4 text-green-700">Positive Custom Clusters</h3>
              <div className="overflow-auto max-h-96">
                <table className="min-w-full">
                  <thead className="bg-green-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Cluster Name</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-green-700 uppercase tracking-wider">Freq</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-green-700 uppercase tracking-wider">NPS</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {summary.top_positive_clusters_data?.map((cluster, index) => (
                      <tr key={cluster.id} className="hover:bg-green-50">
                        <td className="px-3 py-2 text-sm font-medium">{cluster.name}</td>
                        <td className="px-3 py-2 text-sm text-right">{cluster.frequency}</td>
                        <td className="px-3 py-2 text-sm text-right">
                          {cluster.nps_score !== null ? 
                            <span>{cluster.nps_score.toFixed(1)}</span> : 
                            <span className="text-gray-400">-</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4 text-red-700">Negative Custom Clusters</h3>
              <div className="overflow-auto max-h-96">
                <table className="min-w-full">
                  <thead className="bg-red-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Cluster Name</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-red-700 uppercase tracking-wider">Freq</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-red-700 uppercase tracking-wider">NPS</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {summary.top_negative_clusters_data?.map((cluster, index) => (
                      <tr key={cluster.id} className="hover:bg-red-50">
                        <td className="px-3 py-2 text-sm font-medium">{cluster.name}</td>
                        <td className="px-3 py-2 text-sm text-right">{cluster.frequency}</td>
                        <td className="px-3 py-2 text-sm text-right">
                          {cluster.nps_score !== null ? 
                            <span>{cluster.nps_score.toFixed(1)}</span> : 
                            <span className="text-gray-400">-</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4 text-yellow-700">Neutral Custom Clusters</h3>
              <div className="overflow-auto max-h-96">
                <table className="min-w-full">
                  <thead className="bg-yellow-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-yellow-700 uppercase tracking-wider">Cluster Name</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-yellow-700 uppercase tracking-wider">Freq</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-yellow-700 uppercase tracking-wider">NPS</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {summary.top_neutral_clusters_data?.map((cluster, index) => (
                      <tr key={cluster.id} className="hover:bg-yellow-50">
                        <td className="px-3 py-2 text-sm font-medium">{cluster.name}</td>
                        <td className="px-3 py-2 text-sm text-right">{cluster.frequency}</td>
                        <td className="px-3 py-2 text-sm text-right">
                          {cluster.nps_score !== null ? 
                            <span>{cluster.nps_score.toFixed(1)}</span> : 
                            <span className="text-gray-400">-</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ALL RESPONSES TAB */}
        <TabsContent value="responses">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">All Survey Responses</h2>
              <Button 
                onClick={handleProcessAllResponses} 
                disabled={processing}
                variant="secondary"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Responses...
                  </>
                ) : (
                  <>Process All Responses</>
                )}
              </Button>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-600">
                This feature allows you to process all unprocessed text responses in this survey. 
                The system will extract words and phrases from each response and associate them with 
                appropriate word clusters.
              </p>
              
              <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                <h3 className="font-medium text-blue-800 mb-2">About Word Processing</h3>
                <ul className="list-disc pl-5 text-blue-700 space-y-1">
                  <li>Words are extracted from text responses using natural language processing</li>
                  <li>Each word is matched against active custom word clusters</li>
                  <li>Words are stored with their original context for better analysis</li>
                  <li>Processing happens automatically for new responses, use this button for bulk processing</li>
                </ul>
              </div>
              
              <div className="mt-6">
                <h3 className="font-medium mb-2">Survey Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-md border">
                    <p className="text-gray-500 text-sm">Total Responses</p>
                    <p className="text-2xl font-bold">{summary.response_count}</p>
                  </div>
                  <div className="bg-white p-4 rounded-md border">
                    <p className="text-gray-500 text-sm">Languages</p>
                    <p className="text-2xl font-bold">{Object.keys(summary.language_breakdown || {}).length}</p>
                  </div>
                  <div className="bg-white p-4 rounded-md border">
                    <p className="text-gray-500 text-sm">Word Clusters</p>
                    <p className="text-2xl font-bold">{summary.top_clusters?.length || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-md border">
                    <p className="text-gray-500 text-sm">Sentiment Score</p>
                    <p className="text-2xl font-bold">{summary.satisfaction_score?.toFixed(1) || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* COMPETITORS TAB */}
        <TabsContent value="competitors">
          <ComingSoonPlaceholder title="Competitors Comparison" />
        </TabsContent>
      </Tabs>
    </div>
  );
}