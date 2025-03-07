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
import { getCustomClusters, createCustomCluster, deleteCustomCluster } from '@/lib/services/cluster-service';
import { Trash2, ChevronDown, ChevronUp, BarChart } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { handleAuthError } from '@/lib/auth-utils';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchClient } from '@/lib/fetch-client';

interface ProcessTextResponse {
  original_text: string;
  language: string;
  processed_words: string[];
  structured_words: {
    word: string;
    assigned_cluster: string;
  }[];
  word_count: number;
}

async function processText(text: string, language: string): Promise<ProcessTextResponse> {
  try {
    return await fetchClient<ProcessTextResponse>('api/surveys/process-text/', {
      method: 'POST',
      body: { text, language }
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
  const [processedWords, setProcessedWords] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [structuredWords, setStructuredWords] = useState<{word: string; assigned_cluster: string}[]>([]);
  const { toast } = useToast();

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
      const result = await processText(textToProcess, selectedLanguage);
      setProcessedWords(result.processed_words || []);
      setStructuredWords(result.structured_words || []);
      
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

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">{t('general.title')}</h1>
      
      <Tabs defaultValue="clusters">
        <TabsList className="mb-6">
          <TabsTrigger value="clusters">Word Clusters</TabsTrigger>
          <TabsTrigger value="text-processing">Text Processing</TabsTrigger>
          <TabsTrigger value="account">{t('navigation.account')}</TabsTrigger>
          <TabsTrigger value="preferences">{t('navigation.appearance')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="clusters">
          <Card>
            <CardHeader>
              <CardTitle>Word Cluster Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <form onSubmit={handleSubmit} className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label htmlFor="cluster-name">Create New Cluster</Label>
                    <Input
                      id="cluster-name"
                      placeholder="Enter cluster name"
                      value={newClusterName}
                      onChange={(e) => setNewClusterName(e.target.value)}
                      disabled={isAdding}
                    />
                  </div>
                  <Button type="submit" disabled={isAdding || !newClusterName.trim()}>
                    {isAdding ? 'Adding...' : 'Add Cluster'}
                  </Button>
                </form>
              </div>
              
              <h3 className="text-lg font-semibold mb-4">Your Clusters</h3>
              {loading ? (
                <div className="text-center py-4">Loading clusters...</div>
              ) : clusters.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No word clusters defined yet. Create your first one above.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Created On</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clusters.map((cluster) => (
                      <TableRow key={cluster.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {cluster.name}
                          </div>
                        </TableCell>
                        <TableCell>{cluster.description}</TableCell>
                        <TableCell>{formatDate(cluster.created_at)}</TableCell>
                        <TableCell>{cluster.created_by_name}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(cluster.id);
                            }}
                            title="Delete cluster"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>{t('account.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">
                {t('account.profileInfo')}
              </p>
              
              {/* Account settings will go here */}
              <div className="space-y-4">
                <Button disabled>{t('account.changePassword')}</Button>
                <br />
                <Button variant="destructive" disabled>{t('account.deleteAccount')}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>{t('appearance.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>{t('appearance.theme')}</Label>
                  <Select defaultValue="system">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t('appearance.themes.light')}</SelectItem>
                      <SelectItem value="dark">{t('appearance.themes.dark')}</SelectItem>
                      <SelectItem value="system">{t('appearance.themes.system')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>{t('language.title')}</Label>
                  <Select defaultValue="en">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t('language.languages.en')}</SelectItem>
                      <SelectItem value="fr">{t('language.languages.fr')}</SelectItem>
                      <SelectItem value="es">{t('language.languages.es')}</SelectItem>
                      <SelectItem value="de">{t('language.languages.de')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button disabled>{t('general.save')}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="text-processing">
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {structuredWords.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.word}</TableCell>
                            <TableCell>
                              <Badge>{item.assigned_cluster}</Badge>
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
    </div>
  );
} 