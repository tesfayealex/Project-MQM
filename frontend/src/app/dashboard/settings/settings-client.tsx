"use client";

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { CustomWordCluster } from '@/types/cluster';
import { getCustomClusters, createCustomCluster, deleteCustomCluster, toggleClusterStatus } from '@/lib/services/cluster-service';
import { Trash2, ChevronDown, ChevronUp, BarChart, Edit, Languages } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { handleAuthError } from '@/lib/auth-utils';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchClient } from '@/lib/fetch-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { Switch } from '@/components/ui/switch';
import ClusterEditForm from '@/components/clusters/ClusterEditForm';

interface ProcessTextResponse {
  original_text: string;
  language: string;
  processed_words: string[];
  structured_words: StructuredWord[];
  word_count: number;
  sentences?: {
    text: string;
    sentiment: number;
    index: number;
  }[];
}

interface StructuredWord {
  word: string;
  assigned_cluster: string;
  sentence_index?: number;
}

async function processText(text: string, language: string, useOpenAI: boolean = true): Promise<ProcessTextResponse> {
  try {
    return await fetchClient<ProcessTextResponse>('api/surveys/process-text/', {
      method: 'POST',
      body: { text, language, use_openai: useOpenAI }
    });
  } catch (error) {
    console.error('Error processing text:', error);
    throw error;
  }
}

export default function SettingsClient() {
  const { t } = useTranslation('settings');
  const [clusters, setClusters] = useState<CustomWordCluster[]>([]);
  const [newClusterName, setNewClusterName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [textToProcess, setTextToProcess] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [useOpenAI, setUseOpenAI] = useState(true);
  const [processedWords, setProcessedWords] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [structuredWords, setStructuredWords] = useState<StructuredWord[]>([]);
  const [sentences, setSentences] = useState<{text: string; sentiment: number; index: number}[]>([]);
  const [editingCluster, setEditingCluster] = useState<CustomWordCluster | null>(null);
  const { toast } = useToast();

  // Get sentiment color based on score
  const getSentimentColor = (score: number) => {
    if (score > 0.05) return "bg-green-100 border-green-400"; // Positive
    if (score < -0.05) return "bg-red-100 border-red-400";   // Negative
    return "bg-gray-100 border-gray-400";                    // Neutral
  };

  // Get sentiment label based on score
  const getSentimentLabel = (score: number) => {
    if (score > 0.05) return "Positive";
    if (score < -0.05) return "Negative";
    return "Neutral";
  };

  useEffect(() => {
    loadClusters();
  }, []);

  const loadClusters = async () => {
    try {
      setLoading(true);
      const data = await getCustomClusters();
      setClusters(data);
    } catch (error: any) {
      console.error('Error loading clusters:', error);
      await handleAuthError(error);
      toast({
        title: t('general.error'),
        description: 'Failed to load word clusters. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newClusterName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Cluster name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsAdding(true);
      await createCustomCluster({ name: newClusterName.trim() });
      toast({
        title: 'Success',
        description: 'Cluster added successfully',
      });
      setNewClusterName('');
      await loadClusters();
    } catch (error: any) {
      console.error('Error adding cluster:', error);
      await handleAuthError(error);
      toast({
        title: t('general.error'),
        description: 'Failed to add cluster. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this cluster?')) {
      return;
    }

    try {
      setLoading(true);
      await deleteCustomCluster(id);
      toast({
        title: 'Success',
        description: 'Cluster deleted successfully',
      });
      await loadClusters();
    } catch (error: any) {
      console.error('Error deleting cluster:', error);
      await handleAuthError(error);
      toast({
        title: t('general.error'),
        description: 'Failed to delete cluster. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessText = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!textToProcess.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter some text to process.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsProcessing(true);
      const result = await processText(textToProcess, selectedLanguage, useOpenAI);
      
      // Log the response for debugging
      console.log('Process Text API Response:', result);
      console.log('Sentences data:', result.sentences);
      
      setProcessedWords(result.processed_words || []);
      setStructuredWords(result.structured_words || []);
      setSentences(result.sentences || []);
      
      toast({
        title: 'Text Processed Successfully',
        description: `${result.word_count} words extracted.`,
      });
    } catch (error: any) {
      console.error('Error processing text:', error);
      await handleAuthError(error);
      toast({
        title: t('general.error'),
        description: error.message || 'Failed to process text. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditCluster = (cluster: CustomWordCluster) => {
    setEditingCluster(cluster);
  };

  const handleClusterUpdated = (updatedCluster: CustomWordCluster) => {
    // Update the clusters list
    setClusters(prevClusters => prevClusters.map(c => 
      c.id === updatedCluster.id ? updatedCluster : c
    ));
  };

  const handleToggleStatus = async (id: number) => {
    try {
      setLoading(true);
      await toggleClusterStatus(id);
      await loadClusters(); // Reload all clusters to get updated status
      toast({
        title: 'Success',
        description: 'Cluster status updated successfully',
      });
    } catch (error: any) {
      console.error('Error toggling cluster status:', error);
      await handleAuthError(error);
      toast({
        title: t('general.error'),
        description: 'Failed to update cluster status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <h1 className="text-3xl font-bold mb-6">{t('settings.title')}</h1>

      <Tabs defaultValue="clusters">
        <TabsList className="mb-4">
          <TabsTrigger value="clusters">Word Clusters</TabsTrigger>
          <TabsTrigger value="text-processor">Text Processor</TabsTrigger>
        </TabsList>

        <TabsContent value="clusters">
          <Card>
            <CardHeader>
              <CardTitle>Manage Custom Word Clusters</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="mb-6">
                <div className="flex items-end space-x-2">
                  <div className="flex-1">
                    <Label htmlFor="cluster-name">New Cluster Name</Label>
                    <Input
                      id="cluster-name"
                      placeholder="Enter cluster name"
                      value={newClusterName}
                      onChange={(e) => setNewClusterName(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={isAdding || !newClusterName.trim()}>
                    {isAdding ? 'Adding...' : 'Add Cluster'}
                  </Button>
                </div>
              </form>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Keywords</TableHead>
                      <TableHead>Languages</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && !clusters.length ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          Loading clusters...
                        </TableCell>
                      </TableRow>
                    ) : !clusters.length ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          No custom clusters added yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      clusters.map((cluster) => (
                        <TableRow key={cluster.id}>
                          <TableCell className="font-medium">{cluster.name}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {cluster.description || 'No description'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {cluster.keywords && cluster.keywords.length > 0 ? (
                                cluster.keywords.slice(0, 3).map((keyword, idx) => (
                                  <Badge key={idx} variant="secondary">{keyword}</Badge>
                                ))
                              ) : (
                                cluster.multilingual_keywords && Object.keys(cluster.multilingual_keywords).length > 0 ? (
                                  // If no default keywords but has language-specific ones
                                  Object.values(cluster.multilingual_keywords)[0].slice(0, 3).map((keyword, idx) => (
                                    <Badge key={idx} variant="secondary">{keyword}</Badge>
                                  ))
                                ) : (
                                  <span className="text-gray-500 text-sm">No keywords</span>
                                )
                              )}
                              {cluster.keywords && cluster.keywords.length > 3 && (
                                <Badge variant="outline">+{cluster.keywords.length - 3} more</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {/* Display supported languages */}
                            <div className="flex gap-1">
                              {cluster.multilingual_keywords && Object.keys(cluster.multilingual_keywords).length > 0 ? (
                                Object.keys(cluster.multilingual_keywords).map(lang => (
                                  <Badge key={lang} variant="outline" className="uppercase">{lang}</Badge>
                                ))
                              ) : (
                                <Badge variant="outline">Default</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{cluster.created_by_name}</TableCell>
                          <TableCell>
                            <Switch
                              checked={cluster.is_active}
                              onCheckedChange={() => handleToggleStatus(cluster.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleEditCluster(cluster)}
                              >
                                <Edit className="h-4 w-4 mr-1" /> Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(cluster.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text-processor">
          <Card>
            <CardHeader>
              <CardTitle>Text Processing Test Tool</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <form onSubmit={handleProcessText} className="space-y-4">
                  <div>
                    <Label htmlFor="language-select">Language</Label>
                    <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                      <SelectTrigger id="language-select">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="use-openai"
                      checked={useOpenAI}
                      onCheckedChange={setUseOpenAI}
                    />
                    <Label htmlFor="use-openai">
                      Use OpenAI for sentiment analysis 
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {useOpenAI ? 'OpenAI (more accurate)' : 'NLTK (faster)'}
                      </span>
                    </Label>
                  </div>
                  
                  <div>
                    <Label htmlFor="text-to-process">Text to Process</Label>
                    <Textarea 
                      id="text-to-process"
                      placeholder="Enter text to extract and cluster words"
                      value={textToProcess}
                      onChange={(e) => setTextToProcess(e.target.value)}
                      rows={5}
                    />
                  </div>
                  
                  <Button type="submit" disabled={isProcessing || !textToProcess.trim()}>
                    {isProcessing ? 'Processing...' : 'Process Text'}
                  </Button>
                </form>
              </div>
              
              {sentences.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">
                    Sentences with Sentiment Analysis
                    <span className="ml-2 text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                      {useOpenAI ? 'OpenAI Analysis' : 'NLTK Analysis'}
                    </span>
                  </h3>
                  
                  {/* Sentiment summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <Card className="bg-green-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {sentences.filter(s => s.sentiment > 0.05).length}
                          </div>
                          <div className="text-sm text-gray-600">
                            Positive Sentences
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gray-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-600">
                            {sentences.filter(s => s.sentiment >= -0.05 && s.sentiment <= 0.05).length}
                          </div>
                          <div className="text-sm text-gray-600">
                            Neutral Sentences
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-red-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {sentences.filter(s => s.sentiment < -0.05).length}
                          </div>
                          <div className="text-sm text-gray-600">
                            Negative Sentences
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {sentences.length > 1 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium mb-2">Sentiment Trend</h4>
                      <div className="h-64 w-full border p-4 rounded-md bg-white">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={sentences.map(s => ({
                              index: s.index + 1,
                              sentiment: s.sentiment,
                              text: s.text.length > 30 ? s.text.substring(0, 30) + '...' : s.text
                            }))}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="index" label={{ value: 'Sentence Index', position: 'insideBottomRight', offset: -10 }} />
                            <YAxis label={{ value: 'Sentiment Score', angle: -90, position: 'insideLeft' }} domain={[-1, 1]} />
                            <Tooltip 
                              formatter={(value: number) => [value.toFixed(2), 'Sentiment']}
                              labelFormatter={(label) => `Sentence ${label}`}
                              content={({ active, payload, label }: any) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-white p-2 border rounded shadow">
                                      <p className="font-bold">{`Sentence ${label}`}</p>
                                      <p className="text-sm">{`Sentiment: ${data.sentiment.toFixed(2)}`}</p>
                                      <p className="text-xs">{data.text}</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <ReferenceLine y={0} stroke="#666" />
                            <ReferenceLine y={0.05} stroke="#22c55e" strokeDasharray="3 3" />
                            <ReferenceLine y={-0.05} stroke="#ef4444" strokeDasharray="3 3" />
                            <Line 
                              type="monotone" 
                              dataKey="sentiment" 
                              stroke="#3b82f6" 
                              activeDot={{ r: 8 }}
                              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  
                  {/* Sentences list */}
                  <div className="space-y-3 max-h-80 overflow-y-auto p-2">
                    {sentences.map((sentence, index) => (
                      <div key={index} className={`p-3 border rounded-md ${getSentimentColor(sentence.sentiment)}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold">Sentence {sentence.index + 1}</span>
                          <Badge variant={
                            sentence.sentiment > 0.05 ? "default" : 
                            sentence.sentiment < -0.05 ? "destructive" : "secondary"
                          }>
                            {getSentimentLabel(sentence.sentiment)} ({sentence.sentiment.toFixed(2)})
                          </Badge>
                        </div>
                        <p className="text-sm">{sentence.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {processedWords.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Processed Words</h3>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-60 overflow-y-auto">
                    {processedWords.map((word, index) => (
                      <Badge key={index} variant="outline">{word}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {structuredWords.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Word Clusters</h3>
                  <div className="border rounded-md max-h-80 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Word</TableHead>
                          <TableHead>Assigned Cluster</TableHead>
                          <TableHead>Sentence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {structuredWords.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.word}</TableCell>
                            <TableCell>
                              <Badge>{item.assigned_cluster}</Badge>
                            </TableCell>
                            <TableCell>
                              {item.sentence_index !== undefined 
                                ? <Badge variant="outline">Sentence {item.sentence_index + 1}</Badge> 
                                : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cluster Edit Dialog */}
      {editingCluster && (
        <ClusterEditForm
          cluster={editingCluster}
          isOpen={Boolean(editingCluster)}
          onClose={() => setEditingCluster(null)}
          onClusterUpdated={handleClusterUpdated}
        />
      )}
    </div>
  );
} 