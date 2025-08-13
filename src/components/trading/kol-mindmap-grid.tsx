'use client';

import React, { useState } from 'react';
import { useKOLTradeSocket } from '@/hooks/use-kol-trade-socket';
import { useKOLTradeStore } from '@/stores/use-kol-trade-store';
import { UnifiedKOLMindmap } from './unified-kol-mindmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { 
  Network,
  Grid3X3,
  Maximize2,
  Loader2,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Filter
} from 'lucide-react';

export const KOLMindmapGrid: React.FC = () => {
  const { 
    allMindmapData, 
    trendingTokens, 
    isConnected, 
    isLoadingInitialData,
    socket 
  } = useKOLTradeSocket();
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'trending' | 'high-activity'>('all');
  const [minConnections, setMinConnections] = useState<number>(1);

  const availableTokens = Object.keys(allMindmapData);

  // Debug logging
  React.useEffect(() => {
    void 0 && ('🔍 KOLMindmapGrid Debug:', {
      availableTokens: availableTokens.length,
      isLoadingInitialData,
      isConnected,
      allMindmapDataKeys: Object.keys(allMindmapData),
      trendingTokens: trendingTokens.length,
      searchTerm,
      filterMode,
      minConnections
    });
  }, [availableTokens.length, isLoadingInitialData, isConnected, allMindmapData, trendingTokens.length, searchTerm, filterMode, minConnections]);

  // Filter tokens based on search and filter criteria
  const filteredTokens = availableTokens.filter(tokenMint => {
    const data = allMindmapData[tokenMint];
    const kolCount = Object.keys(data.kolConnections || {}).length;
    const totalTrades = data.networkMetrics?.totalTrades || 0;
    
    // Search filter
    if (searchTerm && !tokenMint.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Connection count filter
    if (kolCount < minConnections) {
      return false;
    }
    
    // Mode filter
    switch (filterMode) {
      case 'trending':
        return trendingTokens.includes(tokenMint);
      case 'high-activity':
        return totalTrades >= 10;
      default:
        return true;
    }
  });

  // Debug filtered tokens
  React.useEffect(() => {
    void 0 && ('🔍 Filtered Tokens Debug:', {
      totalAvailable: availableTokens.length,
      afterFiltering: filteredTokens.length,
      filteredTokens: filteredTokens.slice(0, 5), // Show first 5
      filterCriteria: { searchTerm, filterMode, minConnections }
    });
  }, [availableTokens.length, filteredTokens.length, searchTerm, filterMode, minConnections]);

  // Auto-subscribe to mindmap updates for visible tokens
  React.useEffect(() => {
    if (socket && isConnected && availableTokens.length > 0) {
      void 0 && (`🗺️ Auto-subscribing to mindmap updates for ${availableTokens.length} available tokens`);
      availableTokens.forEach(tokenMint => {
        socket.emit('subscribe_mindmap', { tokenMint });
      });
      
      // Also request any additional tokens with KOL activity that might not be loaded yet
      socket.emit('request_all_active_tokens');
      void 0 && ('🔄 Requested all active tokens from server');
    }
  }, [socket, isConnected, availableTokens.length]);

  if (isLoadingInitialData) {
    return (
      <div className="mindmap-grid">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h3 className="text-lg font-semibold mb-2">Loading Network Data</h3>
          <p className="text-muted-foreground">Gathering token-KOL relationships...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mindmap-grid w-full">
      {/* Unified Mindmap Visualization */}
      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          {filteredTokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Network className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold mb-2 text-center">No Network Data</h3>
              <p className="text-muted-foreground text-center text-sm sm:text-base max-w-md px-4">
                {availableTokens.length === 0 
                  ? "Waiting for KOL trades to build network relationships..."
                  : "No tokens match your current filter criteria. Try adjusting your search or filters."
                }
              </p>
              {/* Temporary Debug Info */}
              <div className="mt-4 p-4 bg-muted/20 rounded-lg text-xs text-left max-w-lg">
                <div className="font-semibold mb-2">Debug Info:</div>
                <div>Available tokens: {availableTokens.length}</div>
                <div>Is loading: {isLoadingInitialData.toString()}</div>
                <div>Is connected: {isConnected.toString()}</div>
                <div>Filter mode: {filterMode}</div>
                <div>Min connections: {minConnections}</div>
                <div>Search term: "{searchTerm}"</div>
                {availableTokens.length > 0 && (
                  <div className="mt-2">
                    <div>Sample tokens:</div>
                    <div className="font-mono text-xs">{availableTokens.slice(0, 3).join(', ')}</div>
                  </div>
                )}
              </div>
              {searchTerm && (
                <Button 
                  variant="outline" 
                  onClick={() => setSearchTerm('')}
                  className="mt-4"
                  size="sm"
                >
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <UnifiedKOLMindmap 
              tokensData={filteredTokens.reduce((acc, tokenMint) => {
                acc[tokenMint] = allMindmapData[tokenMint];
                return acc;
              }, {} as { [key: string]: any })}
              trendingTokens={trendingTokens}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}; 