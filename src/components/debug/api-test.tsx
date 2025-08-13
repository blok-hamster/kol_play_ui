'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserStore } from '@/stores/use-user-store';

export const APITest: React.FC = () => {
  const [testResults, setTestResults] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUserStore();

  const runAPITest = async () => {
    setIsLoading(true);
    const results: any = {};
    
    // Get auth token from localStorage
    const authToken = localStorage.getItem('authToken');
    
    // Environment check
    results.environment = {
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'undefined',
      wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'undefined',
      hasUser: !!user,
      hasAuthToken: !!authToken,
      authTokenPreview: authToken ? `${authToken.substring(0, 20)}...` : 'none'
    };

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Test each endpoint
    const endpoints = [
      '/api/kol-trades/recent?limit=5',
      '/api/kol-trades/stats',
      '/api/kol-trades/trending-tokens?limit=5'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${apiUrl}${endpoint}`, { headers });
        results[endpoint] = {
          status: response.status,
          ok: response.ok,
          data: response.ok ? await response.json() : await response.text()
        };
      } catch (error) {
        results[endpoint] = {
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    setTestResults(results);
    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>KOL Trades API Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runAPITest} disabled={isLoading}>
          {isLoading ? 'Testing...' : 'Run API Test'}
        </Button>
        
        {Object.keys(testResults).length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Test Results:</h3>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96">
              {JSON.stringify(testResults, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 