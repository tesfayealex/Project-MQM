"use client";

import React, { useState, useEffect } from 'react';
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
        title: 'Error',
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
        title: 'Error',
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
        title: 'Error',
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
        title: 'Error',
        description: error.message || 'Failed to process text. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      
      <Tabs defaultValue="clusters">
        <TabsList className="mb-6">
          <TabsTrigger value="clusters">Word Clusters</TabsTrigger>
          <TabsTrigger value="text-processing">Text Processing</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
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
        
        <TabsContent value="text-processing">
          <Card>
            <CardHeader>
              <CardTitle>Text Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProcessText} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="language">Select Language</Label>
                  <Select
                    value={selectedLanguage}
                    onValueChange={setSelectedLanguage}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="textToProcess">Enter Text to Process</Label>
                  <Textarea
                    id="textToProcess"
                    value={textToProcess}
                    onChange={(e) => setTextToProcess(e.target.value)}
                    placeholder="Enter text here..."
                    rows={5}
                    className="w-full"
                  />
                </div>
                
                <Button type="submit" disabled={isProcessing || !textToProcess.trim()}>
                  {isProcessing ? (
                    <>Processing...</>
                  ) : (
                    <>Process Text</>
                  )}
                </Button>
              </form>
              
              {processedWords.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Processed Words:</h3>
                  <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Words</h4>
                        <div className="space-y-1">
                          {processedWords.map((word, index) => (
                            <Badge key={index} variant="outline" className="mr-2 mb-2">
                              {word}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Cluster Assignments</h4>
                        <div className="space-y-1">
                          {structuredWords.map((item, index) => (
                            <div key={index} className="flex items-center space-x-2 mb-2">
                              <Badge variant="outline">{item.word}</Badge>
                              <span>→</span>
                              <Badge variant="secondary">{item.assigned_cluster}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="py-4 text-center text-muted-foreground">
                Account settings feature coming soon.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="py-4 text-center text-muted-foreground">
                Preferences feature coming soon.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 