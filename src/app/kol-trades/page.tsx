'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { KOLRealtimeTrades } from '@/components/trading/kol-realtime-trades';
import { KOLMindmapGrid } from '@/components/trading/kol-mindmap-grid';
import { APITest } from '@/components/debug/api-test';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Network, 
  TrendingUp,
  Zap,
  Users
} from 'lucide-react';
import RequireAuth from '@/components/auth/require-auth';

type ActiveView = 'live-trades' | 'network-maps' | 'both' | 'debug';

export default function KOLTradesPage() {
  const [activeView, setActiveView] = useState<ActiveView>('both');

  return (
    <RequireAuth title="Sign In Required" message="Please sign in to view live trades and network maps.">
      <AppLayout>
      <div className="p-6">
        {/* View Toggle (header title/description removed) */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 bg-muted/30 p-1 rounded-lg w-fit">
            <Button
              variant={activeView === 'live-trades' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('live-trades')}
              className="flex items-center space-x-2"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Live Trades</span>
            </Button>
            <Button
              variant={activeView === 'network-maps' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('network-maps')}
              className="flex items-center space-x-2"
            >
              <Network className="h-4 w-4" />
              <span>Network Maps</span>
            </Button>
            <Button
              variant={activeView === 'both' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('both')}
              className="flex items-center space-x-2"
            >
              <Zap className="h-4 w-4" />
              <span>Full View</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {activeView === 'debug' && (
            <div>
              <APITest />
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Debug Instructions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 text-sm">
                    <p><strong>Step 1:</strong> Click "Run API Test" above to check your API connectivity.</p>
                    <p><strong>Step 2:</strong> Open your browser's Developer Tools (F12) and check the Console tab for detailed logs.</p>
                    <p><strong>Step 3:</strong> Look for messages starting with 🔄, ✅, ⚠️, or ❌ to see what's happening.</p>
                    <p><strong>Common Issues:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Missing <code>NEXT_PUBLIC_API_URL</code> environment variable</li>
                      <li>Backend server not running on the specified URL</li>
                      <li>CORS issues (check browser network tab)</li>
                      <li>API endpoints returning unexpected data format</li>
                      <li>Missing authentication (user not logged in)</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {(activeView === 'live-trades' || activeView === 'both') && (
            <div>
              <KOLRealtimeTrades 
                maxTrades={50} 
                showFilters={true}
                className="w-full"
              />
            </div>
          )}

          {(activeView === 'network-maps' || activeView === 'both') && (
            <div>
              <Card>
                <CardContent>
                  <KOLMindmapGrid />
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Info Banner (unchanged) */}
        <div className="mt-12 bg-gradient-to-r from-primary/10 to-accent-to/10 rounded-xl p-6 border border-primary/20">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-primary/20 rounded-lg flex-shrink-0">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Real-time KOL Trading Intelligence
              </h3>
              <p className="text-muted-foreground mb-4">
                This page displays live trading data from top Solana KOLs and traders. 
                All trades, network maps, and statistics are updated in real-time as they happen on-chain.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-green-500/20 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
                  Live Data
                </span>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                  Real-time Updates
                </span>
                <span className="px-3 py-1 bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                  Network Analysis
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </AppLayout>
    </RequireAuth>
  );
} 