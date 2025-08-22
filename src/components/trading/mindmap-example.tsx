'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KOLMindmap } from './kol-mindmap';
import { UnifiedKOLMindmap } from './unified-kol-mindmap';
import { useKOLTradeSocket } from '@/hooks/use-kol-trade-socket';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Network, Globe } from 'lucide-react';

/**
 * Example component demonstrating the enhanced mindmap components
 * with subscription filtering functionality
 */
export const MindmapExample: React.FC = () => {
  const { allMindmapData, trendingTokens } = useKOLTradeSocket();

  // Get a sample token for the single token view
  const sampleTokenMint = Object.keys(allMindmapData)[0];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Enhanced KOL Network Maps</h2>
        <p className="text-muted-foreground">
          Toggle between viewing all KOLs or just the ones you're subscribed to
        </p>
      </div>

      <Tabs defaultValue="unified" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="unified" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Unified Network
          </TabsTrigger>
          <TabsTrigger value="single" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Single Token
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unified" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Unified KOL Network Map
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                View the complete network of all tokens and their KOL connections.
                Use the "Subscribed" filter to focus on KOLs you're following.
              </p>
            </CardHeader>
            <CardContent>
              <UnifiedKOLMindmap
                tokensData={allMindmapData}
                trendingTokens={trendingTokens}
                className="h-[600px]"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="single" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Single Token Network Map
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Focus on a specific token's KOL network.
                Toggle between all KOLs and your subscribed KOLs.
              </p>
            </CardHeader>
            <CardContent>
              {sampleTokenMint ? (
                <KOLMindmap
                  tokenMint={sampleTokenMint}
                  className="h-[600px]"
                />
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  <div className="text-center space-y-2">
                    <Network className="h-12 w-12 mx-auto" />
                    <p>No token data available</p>
                    <p className="text-sm">Connect to see KOL network data</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold">Subscription Filtering</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Toggle between "All KOLs" and "Subscribed KOLs"</li>
                <li>• Real-time subscription status integration</li>
                <li>• Empty states for no subscribed KOLs</li>
                <li>• Dynamic stats based on filter</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Interactive Features</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Click nodes for detailed information</li>
                <li>• Hover for quick previews (desktop)</li>
                <li>• Zoom and pan controls</li>
                <li>• Mobile-optimized interactions</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MindmapExample;