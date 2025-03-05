'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SentimentChart } from '@/components/analysis/SentimentChart';
import { WordCloudChart } from '@/components/analysis/WordCloudChart';
import { ClusterList } from '@/components/analysis/ClusterList';
import { getSurveyAnalysisSummary, getWordCloud, analyzeResponses } from '@/lib/services/analysis-service';
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

// New component to visualize language breakdown
const LanguageDistributionChart = ({ breakdown }) => {
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
          <Tooltip formatter={(value) => [`${value} responses`, 'Count']} />
        </RechartPieChart>
      </ResponsiveContainer>
    </div>
  );
};

// New component for satisfaction metrics visualization
const SatisfactionMetricsChart = ({ average, median, low, high }) => {
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
const SentimentDivergenceChart = ({ divergence, positivePercentage, negativePercentage, neutralPercentage }) => {
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
            <Tooltip formatter={(value) => [`${value.toFixed(1)}%`]} />
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
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [summary, setSummary] = useState<SurveyAnalysisSummary | null>(null);
  const [wordCloud, setWordCloud] = useState<WordCloudItem[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');

  useEffect(() => {
    loadAnalysisData();
  }, [surveyId]);

  useEffect(() => {
    if (summary) {
      loadWordCloud();
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
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-6">
        <Card className="p-4">
          <p className="text-center text-gray-600">No analysis data available</p>
          <Button
            onClick={() => handleAnalyze(true)}
            disabled={analyzing}
            className="mt-4"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : "Start Analysis"}
          </Button>
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
          <TabsTrigger value="clusters">Clustered Items</TabsTrigger>
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
            </div>
            <div className="h-64">
              <WordCloudChart words={wordCloud} />
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-4">
              <ClusterList
                clusters={summary.top_clusters_data?.slice(0, 10) || []}
                title="Frequently Mentioned Clusters (Top 10)"
                showVisualizations={true}
              />
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

        {/* CLUSTERED ITEMS TAB */}
        <TabsContent value="clusters">
          <ComingSoonPlaceholder title="Clustered Items" />
        </TabsContent>

        {/* ALL RESPONSES TAB */}
        <TabsContent value="responses">
          <ComingSoonPlaceholder title="All Responses" />
        </TabsContent>

        {/* COMPETITORS TAB */}
        <TabsContent value="competitors">
          <ComingSoonPlaceholder title="Competitors Comparison" />
        </TabsContent>
      </Tabs>
    </div>
  );
}