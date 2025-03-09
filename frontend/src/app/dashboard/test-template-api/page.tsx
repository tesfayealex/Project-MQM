'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function TestTemplateApiPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [templateId, setTemplateId] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const testApi = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/test-template-api?id=${templateId}`);
      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      console.error('Error testing API:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Template API Test</h1>
      
      <div className="flex gap-4 items-center">
        <div className="flex-grow max-w-sm">
          <Input
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            placeholder="Template ID (default: 1)"
          />
        </div>
        <Button onClick={testApi} disabled={loading}>
          {loading ? 'Testing...' : 'Test Template API'}
        </Button>
      </div>
      
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 rounded text-red-700">
          {error}
        </div>
      )}
      
      {results && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Backend URL</h3>
                  <p className="text-sm font-mono">{results.backendUrl}</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium">Templates List Endpoint</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>Status:</strong></div>
                    <div className={results.results.templatesList.status === 200 ? 'text-green-600' : 'text-red-600'}>
                      {results.results.templatesList.status} {results.results.templatesList.statusText}
                    </div>
                    
                    {results.results.templatesList.error && (
                      <>
                        <div><strong>Error:</strong></div>
                        <div className="text-red-600 font-mono whitespace-pre-wrap">{results.results.templatesList.error}</div>
                      </>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium">Template Detail Endpoint (ID: {templateId})</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>Status:</strong></div>
                    <div className={results.results.templateDetail.status === 200 ? 'text-green-600' : 'text-red-600'}>
                      {results.results.templateDetail.status} {results.results.templateDetail.statusText}
                    </div>
                    
                    {results.results.templateDetail.error && (
                      <>
                        <div><strong>Error:</strong></div>
                        <div className="text-red-600 font-mono whitespace-pre-wrap">{results.results.templateDetail.error}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="text-xs text-gray-500">
            <pre className="whitespace-pre-wrap">{JSON.stringify(results, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
} 