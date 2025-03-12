'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WordCloudChart } from '@/components/analysis/WordCloudChart';
import { ClusterList } from '@/components/analysis/ClusterList';
import { getSurveyAnalysisSummary, getWordCloud, getClusterCloud, analyzeResponses, processAllResponses } from '@/lib/services/analysis-service';
import { SurveyAnalysisSummary, WordCloudItem } from '@/types/analysis';
import { Loader2, BanIcon, PieChart, BarChart, GlobeIcon, CloudIcon, CloudOffIcon } from 'lucide-react';
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
  Line,
  Sector
} from 'recharts';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { handleAuthError } from '@/lib/auth-utils';
import { getCookie } from 'cookies-next';
import { useLanguage } from '@/contexts/language-context';
import { Badge } from '@/components/ui/badge';

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
  // Calculate NPS categories based on the average
  const promoters = Math.round(Math.max(0, Math.min(100, (average - 6) * 25))); // Estimation of promoters percentage
  const detractors = Math.round(Math.max(0, Math.min(100, (7 - average) * 16.7))); // Estimation of detractors percentage
  const passives = 100 - promoters - detractors;
  
  // Estimate NPS score
  const npsScore = promoters - detractors;
  
  // Colors for the chart
  const colors = {
    promoters: '#4ade80', // green
    passives: '#fbbf24',  // yellow
    detractors: '#ef4444', // red
  };
  
  // Gauge chart data
  const gaugeData = [
    { name: 'Detractors', value: detractors, color: colors.detractors },
    { name: 'Passives', value: passives, color: colors.passives },
    { name: 'Promoters', value: promoters, color: colors.promoters },
  ];
  
  // Bar chart data for details
  const barData = [
    { name: 'Detractors (0-6)', value: detractors, color: colors.detractors },
    { name: 'Passives (7-8)', value: passives, color: colors.passives },
    { name: 'Promoters (9-10)', value: promoters, color: colors.promoters },
  ];

  return (
    <div className="space-y-4">
      {/* NPS Score */}
      <div className="text-center">
        <div className="text-sm text-gray-500 mb-1">NPS Score</div>
        <div className="text-4xl font-bold" style={{ 
          color: npsScore > 50 ? colors.promoters : 
                 npsScore > 0 ? colors.passives : 
                 colors.detractors 
        }}>
          {npsScore}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Range: -100 to 100
        </div>
      </div>
      
      {/* Gauge Chart */}
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <RechartPieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="50%"
              startAngle={180}
              endAngle={0}
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {gaugeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value) => [`${value}%`, 'Percentage']}
              labelFormatter={(name) => `${name}`}
            />
          </RechartPieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      {/* <div className="flex justify-between text-sm">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: colors.detractors }}></div>
          <span>Detractors (0-6)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: colors.passives }}></div>
          <span>Passives (7-8)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: colors.promoters }}></div>
          <span>Promoters (9-10)</span>
        </div>
      </div> */}
      
      {/* Additional details */}
      {/* <div className="mt-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 p-2 rounded shadow-sm">
            <div className="text-xs text-gray-500">Average</div>
            <div className="font-semibold">{average.toFixed(1)}</div>
          </div>
          <div className="bg-gray-50 p-2 rounded shadow-sm">
            <div className="text-xs text-gray-500">Median</div>
            <div className="font-semibold">{median.toFixed(1)}</div>
          </div>
          <div className="bg-gray-50 p-2 rounded shadow-sm">
            <div className="text-xs text-gray-500">Confidence</div>
            <div className="font-semibold">{low.toFixed(1)}-{high.toFixed(1)}</div>
          </div>
        </div>
      </div> */}
    </div>
  );
};

// Enhanced SentimentChart - Doughnut chart with interactivity
const SentimentChart = ({ positive, negative, neutral, improved = false }: SentimentChartProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
  const data = [
    { name: 'Positive', value: positive, color: '#22C55E', description: 'Responses with positive sentiment' },
    { name: 'Neutral', value: neutral, color: '#F59E0B', description: 'Responses with neutral sentiment' },
    { name: 'Negative', value: negative, color: '#EF4444', description: 'Responses with negative sentiment' },
  ];

  const handlePieClick = (data: any, index: number) => {
    setActiveIndex(index === activeIndex ? null : index);
  };

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;

  return (
      <g>
        <text x={cx} y={cy} dy={-20} textAnchor="middle" fill={fill} className="text-lg font-bold">
          {payload.name}
        </text>
        <text x={cx} y={cy} dy={10} textAnchor="middle" fill="#333" className="text-xl font-bold">
          {value.toFixed(1)}%
        </text>
        <text x={cx} y={cy} dy={30} textAnchor="middle" fill="#666" className="text-xs">
          ({(percent * 100).toFixed(1)}% of total)
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 10}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 6}
          outerRadius={outerRadius + 10}
          fill={fill}
        />
      </g>
    );
  };

  return (
    <div className="space-y-4">
      <div className="h-56 w-full">
      <ResponsiveContainer>
          <RechartPieChart>
            <Pie
              activeIndex={activeIndex !== null ? activeIndex : undefined}
              activeShape={renderActiveShape}
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              onClick={handlePieClick}
              onMouseEnter={(_, index) => !activeIndex && setActiveIndex(index)}
              onMouseLeave={() => !activeIndex && setActiveIndex(null)}
              paddingAngle={2}
              animationBegin={200}
              animationDuration={1000}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color} 
                  stroke={activeIndex === index ? '#fff' : 'none'}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => {
                if (typeof value === 'number') {
                  return [`${value.toFixed(1)}%`, 'Percentage'];
                }
                return [value, 'Percentage'];
              }}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '8px'
              }}
            />
          </RechartPieChart>
      </ResponsiveContainer>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-center">
        {data.map((item, index) => (
          <div 
            key={index} 
            className={`p-2 rounded-md cursor-pointer transition-all duration-200 ${activeIndex === index ? 'bg-gray-100 shadow-sm' : 'hover:bg-gray-50'}`}
            onClick={() => handlePieClick(null, index)}
          >
            <div className="text-sm font-medium" style={{ color: item.color }}>{item.name}</div>
            <div className="text-lg font-bold">{item.value.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">{(item.value * data.reduce((a,b) => a + b.value, 0) / 100).toFixed(0)} responses</div>
          </div>
        ))}
      </div>
      
      <div className="text-xs text-gray-600 text-center mt-1">
        Based on sentence-level sentiment analysis • Click segments for details
      </div>
    </div>
  );
};

// Enhanced SentimentDivergenceChart component
const SentimentDivergenceChart = ({ divergence, positivePercentage, negativePercentage, neutralPercentage }: SentimentDivergenceChartProps) => {
  const data = [
    { name: 'Positive', value: positivePercentage, color: '#22C55E' },
    { name: 'Neutral', value: neutralPercentage, color: '#F59E0B' },
    { name: 'Negative', value: negativePercentage, color: '#EF4444' },
  ];

  // Calculate sentiment balance based on percentages
  const sentimentBalance = positivePercentage - negativePercentage;
  
  // Determine sentiment direction based on the balance
  const sentimentDirection = sentimentBalance > 0 ? 'Positive' : sentimentBalance < 0 ? 'Negative' : 'Neutral';
  const divergenceColor = sentimentBalance > 0 ? '#22C55E' : sentimentBalance < 0 ? '#EF4444' : '#F59E0B';
  
  // Use the max of divergence and calculated balance for display (handle if backend value is incorrect)
  const displayDivergence = divergence > 0.1 ? divergence : Math.abs(sentimentBalance / 100);
  
  // Scale for visualization (0-100 scale)
  const visualScale = Math.min(Math.abs(sentimentBalance), 100);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-2 flex items-center">
        <BarChart className="w-5 h-5 mr-2 text-blue-500" />
        Sentiment Distribution
      </h3>
      
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
            <Bar dataKey="value">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </RechartBarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="space-y-2">
      <div className="flex items-center justify-between">
          <div className="text-sm font-medium flex items-center">
            <span>Sentiment Balance: </span> 
            <span className="ml-1 font-bold" style={{ color: divergenceColor }}>
              {sentimentBalance.toFixed(1)}% {sentimentDirection}
            </span>
        </div>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden flex">
          <div
            className="h-4 rounded-l-full transition-all duration-300"
            style={{ 
              width: `${sentimentBalance < 0 ? visualScale : 0}%`,
              backgroundColor: '#EF4444'
            }}
          ></div>
          <div
            className="h-4 transition-all duration-300"
            style={{ 
              width: `${100 - visualScale}%`,
              backgroundColor: '#F59E0B'
            }}
          ></div>
          <div
            className="h-4 rounded-r-full transition-all duration-300"
            style={{ 
              width: `${sentimentBalance > 0 ? visualScale : 0}%`,
              backgroundColor: '#22C55E'
            }}
          ></div>
        </div>
        
        <div className="text-xs text-gray-500">
          Sentiment balance measures the difference between positive and negative sentiment percentages.
          {sentimentBalance > 0
            ? ` With a +${sentimentBalance.toFixed(1)}% balance, responses tend to be more positive.`
            : sentimentBalance < 0
            ? ` With a ${sentimentBalance.toFixed(1)}% balance, responses tend to be more negative.`
            : ` With a balanced sentiment, positive and negative responses are equally distributed.`}
        </div>
      </div>
    </div>
  );
};

interface SurveyAnalysisProps {
  surveyId: string;
}

export default function SurveyAnalysisClient({ surveyId }: SurveyAnalysisProps) {
  const { t, i18n } = useTranslation(['surveys', 'common'], { useSuspense: false });
  const { toast } = useToast();
  const router = useRouter();
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
  const [colorBy, setColorBy] = useState<'sentiment' | 'nps'>('sentiment');

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
      console.log('Loaded word cloud data:', words);
      
      // The API now returns data with arrays of sentences
      const transformedWords = words.map(word => {
        // Check if the data already has the correct format with sentence arrays
        const transformed = {
          text: word.text || '',
          value: word.value || 1,
          sentiment: word.sentiment || 0,
          
          // Handle sentence data in new format
          sentence_texts: word.sentence_texts || [],
          sentence_indices: word.sentence_indices || [],
          sentence_sentiments: word.sentence_sentiments || [],
          
          // For backwards compatibility
          sentence_text: word.sentence_text || null,
          sentence_index: word.sentence_index || null,
          
          // NPS data
          nps_score: word.nps_score || null,
          
          // For debugging/filtering
          word: word.word || word.text || '',
          frequency: word.frequency || word.value || 1,
          sentiment_score: word.sentiment_score || word.sentiment || 0
        };
        
        return transformed;
      });
      
      setWordCloud(transformedWords);
    } catch (error: any) {
      console.error('Error loading word cloud:', error);
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
      console.log("Loaded cluster cloud data:", clusters);
      
      // Transform data with support for sentence arrays
      const transformedClusters = clusters.map(cluster => {
        return {
          text: cluster.text || cluster.name || '',
          value: cluster.value || cluster.frequency || 1,
          sentiment: cluster.sentiment || cluster.sentiment_score || 0,
          
          // Boolean flags for each sentiment category
          is_positive: Boolean(cluster.is_positive),
          is_negative: Boolean(cluster.is_negative),
          is_neutral: Boolean(cluster.is_neutral),
          
          // Handle sentence arrays
          sentences: cluster.sentences || [],
          sentence_sentiments: cluster.sentence_sentiments || [],
          
          // Other data
          nps_score: cluster.nps_score || null,
          keywords: cluster.keywords || [],
          
          // For debugging/filtering
          name: cluster.name || cluster.text || '',
          frequency: cluster.frequency || cluster.value || 1,
          sentiment_score: cluster.sentiment_score || cluster.sentiment || 0
        };
      });
      
      setClusterCloud(transformedClusters);
    } catch (error: any) {
      console.error('Error loading cluster cloud:', error);
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
      // Specifically reload cluster data
      await loadClusterCloud();
      // Reload word cloud data
      await loadWordCloud();
      
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
        title: "Processing Error",
        description: error.message || "An error occurred while processing responses",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  }

  // Add a function to handle color change
  const handleColorByChange = (newColorBy: 'sentiment' | 'nps') => {
    console.log('Parent component changing color by to:', newColorBy);
    
    // Update the state with the new color mode
    setColorBy(newColorBy);
    
    // Show toast notification for feedback
    toast({
      title: `Coloring by ${newColorBy === 'sentiment' ? 'Sentiment' : 'NPS'}`,
      description: newColorBy === 'sentiment' 
        ? "Words are now colored by sentiment (positive, neutral, negative)"
        : "Words are now colored by NPS (promoters, passives, detractors)",
      duration: 3000,
    });
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
          {/* <TabsTrigger value="detailed">Detailed Analysis</TabsTrigger> */}
          <TabsTrigger value="clusters">Custom Clusters</TabsTrigger>
          <TabsTrigger value="responses">All Responses</TabsTrigger>
          {/* <TabsTrigger value="competitors">Competitors</TabsTrigger> */}
        </TabsList>

        {/* SUMMARY TAB */}
        <TabsContent value="summary" className="space-y-10">
          <div className="grid gap-8 grid-cols-1 md:grid-cols-3">
            <Card className="p-4 min-h-[250px] flex flex-col">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <BarChart className="w-5 h-5 mr-2 text-blue-500" />
                Response Overview
              </h3>
              <div className="text-center py-2 flex-grow">
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

            <Card className="p-4 min-h-[250px] flex flex-col">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <PieChart className="w-5 h-5 mr-2 text-blue-500" />
                Satisfaction Metrics
              </h3>
              <div className="flex-grow">
                <SatisfactionMetricsChart 
                  average={summary.average_satisfaction}
                  median={summary.median_satisfaction}
                  low={summary.satisfaction_confidence_low}
                  high={summary.satisfaction_confidence_high}
                />
                <div className="text-xs text-gray-500 mt-2 text-center">
                  95% confidence interval: {summary.satisfaction_confidence_low.toFixed(1)} - {summary.satisfaction_confidence_high.toFixed(1)}
                </div>
              </div>
              <div className="mt-3 text-center">
                <div className="bg-gray-100 rounded p-2">
                  <div className="text-sm font-medium">Satisfaction Score</div>
                  <div className="text-2xl font-bold text-blue-600">{summary.satisfaction_score.toFixed(1)}</div>
                </div>
              </div>
            </Card>

            <Card className="p-4 min-h-[250px] flex flex-col">
              <h3 className="text-lg font-semibold mb-4">Sentiment Overview</h3>
              <div className="flex-grow">
                <SentimentChart
                  positive={summary.positive_percentage}
                  negative={summary.negative_percentage}
                  neutral={summary.neutral_percentage}
                  improved={true}
                />
              </div>
            </Card>
          </div>

          <Card className="p-6 h-auto">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center space-x-3">
                <CloudIcon className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-medium">{wordCloudMode === 'words' ? 'Word Cloud' : 'Cluster Cloud'}</h3>
              </div>
              <div className="flex items-center space-x-3">
                {/* Color mode selector */}
                <div className="flex items-center px-2 py-1 border rounded-lg bg-white shadow-sm mr-2">
                  <span className="text-xs text-gray-600 font-medium mr-2">Color by:</span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleColorByChange('sentiment')}
                      className={`px-2 py-1 text-xs rounded-md ${
                        colorBy === 'sentiment'
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Sentiment
                    </button>
                    <button
                      onClick={() => handleColorByChange('nps')}
                      className={`px-2 py-1 text-xs rounded-md ${
                        colorBy === 'nps'
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      NPS
                    </button>
                  </div>
                </div>
                
                {/* Language Selector - Only show for Words mode */}
                {wordCloudMode === 'words' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      // Simple language toggle between available languages
                      const languages = Object.keys(summary?.language_breakdown || {});
                      if (languages.length) {
                        const currentIndex = languages.indexOf(selectedLanguage);
                        const nextIndex = (currentIndex + 1) % languages.length;
                        setSelectedLanguage(languages[nextIndex]);
                      }
                    }}
                  >
                    <GlobeIcon className="w-4 h-4 mr-1" />
                    {selectedLanguage ? selectedLanguage.toUpperCase() : 'Language'} 
                    {wordCloud.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1">{wordCloud.length}</Badge>}
                  </Button>
                )}
                <div className="flex items-center space-x-2 text-sm">
                    <button
                    className={`px-3 py-1 rounded-md transition-colors ${
                      wordCloudMode === 'words'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-primary/20'
                    }`}
                      onClick={() => setWordCloudMode('words')}
                  >
                    Words {wordCloud.length > 0 && (
                      <span className="ml-1 text-xs bg-blue-100 text-blue-800 rounded-full px-1.5">
                        {wordCloud.length}
                      </span>
                    )}
                    </button>
                    <button
                    className={`px-3 py-1 rounded-md transition-colors ${
                      wordCloudMode === 'clusters'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-primary/20'
                    }`}
                      onClick={() => setWordCloudMode('clusters')}
                  >
                    Clusters {clusterCloud.length > 0 && (
                      <span className="ml-1 text-xs bg-blue-100 text-blue-800 rounded-full px-1.5">
                        {clusterCloud.length}
                      </span>
                    )}
                    </button>
                </div>
              </div>
            </div>
            <div className="min-h-[450px]">
              <WordCloudChart 
                words={wordCloudMode === 'words' ? wordCloud : clusterCloud} 
                displayMode={wordCloudMode} 
                colorBy={colorBy}
                onColorByChange={handleColorByChange}
              />
            </div>
            {wordCloudMode === 'clusters' && clusterCloud.length === 0 && (
              <div className="text-center text-muted-foreground mt-2">
                <p>No clusters available. Process responses to generate clusters.</p>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-5 flex items-center">
                <BarChart className="w-5 h-5 mr-2 text-blue-500" />
                Top Custom Clusters by Frequency
              </h3>
              <div className="overflow-auto max-h-[400px] pr-2">
                <table className="min-w-full">
                  <thead className="bg-gray-50 sticky top-0 z-10">
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

            <Card className="p-6 flex flex-col">
              <h3 className="text-lg font-semibold mb-5">Sentiment Divergence</h3>
              <div className="flex-grow">
                <SentimentDivergenceChart
                  divergence={summary.sentiment_divergence}
                  positivePercentage={summary.positive_percentage}
                  negativePercentage={summary.negative_percentage}
                  neutralPercentage={summary.neutral_percentage}
                />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="p-6 min-h-[400px] flex flex-col">
              <div className="flex-grow">
                <ClusterList
                  clusters={summary.top_positive_clusters_data?.slice(0, 6) || []}
                  title="Positive Clusters"
                  positiveTheme={true}
                />
              </div>
            </Card>

            <Card className="p-6 min-h-[400px] flex flex-col">
              <div className="flex-grow">
                <ClusterList
                  clusters={summary.top_negative_clusters_data?.slice(0, 6) || []}
                  title="Negative Clusters"
                  negativeTheme={true}
                />
              </div>
            </Card>

            <Card className="p-6 min-h-[400px] flex flex-col">
              <div className="flex-grow">
                <ClusterList
                  clusters={summary.top_neutral_clusters_data?.slice(0, 6) || []}
                  title="Neutral Clusters"
                  neutralTheme={true}
                />
              </div>
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