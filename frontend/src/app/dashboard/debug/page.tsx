'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DebugPage() {
  const [templateId, setTemplateId] = useState('1');
  const [templateResults, setTemplateResults] = useState<any>(null);
  const [clustersResults, setClustersResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testTemplateApi = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/debug/templates?id=${templateId}`);
      const data = await response.json();
      setTemplateResults(data);
    } catch (error) {
      console.error('Error testing template API:', error);
    } finally {
      setLoading(false);
    }
  };

  const testClustersApi = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/clusters');
      const data = await response.json();
      setClustersResults(data);
    } catch (error) {
      console.error('Error testing clusters API:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">API Debug Tool</h1>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="templates">Templates API</TabsTrigger>
          <TabsTrigger value="clusters">Clusters API</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Test Templates API</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-center mb-4">
                <div className="flex-grow max-w-sm">
                  <Input
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    placeholder="Template ID (default: 1)"
                  />
                </div>
                <Button onClick={testTemplateApi} disabled={loading}>
                  {loading ? 'Testing...' : 'Test Template API'}
                </Button>
              </div>

              {templateResults && (
                <div className="mt-4 space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Templates List</h3>
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-64">
                      {JSON.stringify(templateResults.templatesListResponse, null, 2)}
                    </pre>
                  </div>

                  {templateResults.templateDetailResponse && (
                    <div>
                      <h3 className="text-lg font-medium">Template Detail</h3>
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-64">
                        {JSON.stringify(templateResults.templateDetailResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clusters">
          <Card>
            <CardHeader>
              <CardTitle>Test Clusters API</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-center mb-4">
                <Button onClick={testClustersApi} disabled={loading}>
                  {loading ? 'Testing...' : 'Test Clusters API'}
                </Button>
              </div>

              {clustersResults && (
                <div className="mt-4 space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Clusters List</h3>
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-64">
                      {JSON.stringify(clustersResults.clustersListResponse, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium">Active Clusters</h3>
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-64">
                      {JSON.stringify(clustersResults.activeClustersResponse, null, 2)}
                    </pre>
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