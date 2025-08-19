'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useProgressiveLoading } from '@/hooks/use-progressive-loading';
import { useKOLTradeSocketContext } from '@/contexts/kol-trade-socket-context';
import { KOLTradeCard } from './kol-trade-card';
import { UnifiedKOLMindmap } from './unified-kol-mindmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TradeListSkeleton, 
  MindmapSkeleton, 
  HeaderSkeleton,
  ProgressiveLoadingIndicator 
} from '@/components/ui/skeleton-loaders';
import { cn } from '@/lib/utils';
import { 
  Activity, 
  Network,
  TrendingUp,
  Zap,
  Users,
  CircleDollarSign,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface ProgressiveKOLTradesProps {
  maxTrades?: number;
  showFilters?: boolean;
  className?: string;
  activeView?: 'live-trades' | 'network-maps' | 'both';
}

export const ProgressiveKOLTrades: React.FC<ProgressiveKOLTradesProps> = ({
  maxTrades = 25,
  showFilters = true,
  className,
  activeView = 'both'
}) => {
  // Use progressive loading for initial load phases
  const {
    loadingState,
    essentialData,
    mindmapData: progressiveMindmapData,
    isPhaseComplete,
    loadEssentialData,
    loadEnhancedData,
    loadBackgroundData,
    retryFailedRequests,
  } = useProgressiveLoading({
    maxRetries: 3,
    retryDelay: 1000,
    enableCache: true,
    cacheTTL: 300000, // 5 minutes
  });

  // Use socket context for real-time updates
  const {
    recentTrades: socketTrades,
    allMindmapData: socketMindmapData,
    trendingTokens: socketTrendingTokens,
    stats: socketStats,
    isConnected: socketConnected,
    isLoadingInitialData: socketLoading,
  } = useKOLTradeSocketContext();

  const [showLoadingDetails, setShowLoadingDetails] = useState(false);

  // Compute final data - prioritize real-time socket data over progressive loading data
  const finalTrades = socketTrades.length > 0 ? socketTrades : (essentialData?.trades || []);
  const finalStats = socketStats.totalTrades > 0 ? socketStats : (essentialData?.stats || {
    totalTrades: 0,
    uniqueKOLs: 0,
    uniqueTokens: 0,
    totalVolume: 0,
  });
  const finalTrendingTokens = socketTrendingTokens.length > 0 ? socketTrendingTokens : (essentialData?.trendingTokens || []);
  
  // Merge both socket and progressive mindmap data for maximum coverage
  const finalMindmapData = {
    ...progressiveMindmapData,
    ...socketMindmapData, // Socket data takes priority
  };
  
  const finalIsLoading = socketLoading && (loadingState.trades === 'loading' || loadingState.trades === 'idle');
  
  // Check if we have mindmap data available
  const hasMindmapData = Object.keys(finalMindmapData).length > 0;
  const mindmapTokenCount = Object.keys(finalMindmapData).length;

  // Debug mindmap data
  React.useEffect(() => {
    console.log('🔄 Progressive component mindmap data:', {
      socketMindmapCount: Object.keys(socketMindmapData).length,
      progressiveMindmapCount: Object.keys(progressiveMindmapData).length,
      finalMindmapCount: mindmapTokenCount,
      hasMindmapData,
      socketKeys: Object.keys(socketMindmapData).slice(0, 5),
      progressiveKeys: Object.keys(progressiveMindmapData).slice(0, 5),
      finalKeys: Object.keys(finalMindmapData).slice(0, 5)
    });
  }, [socketMindmapData, progressiveMindmapData, finalMindmapData, mindmapTokenCount, hasMindmapData]);



  // Start progressive loading on mount
  useEffect(() => {
    const startProgressiveLoading = async () => {
      try {
        // Phase 1: Essential data (< 500ms target)
        await loadEssentialData();
        
        // Phase 2: Enhanced data (< 2s target) - start immediately after essential
        setTimeout(() => {
          loadEnhancedData();
        }, 100);
        
        // Phase 3: Background data - start after enhanced is complete or after delay
        setTimeout(() => {
          loadBackgroundData();
        }, 2000);
        
      } catch (error) {
        console.error('Progressive loading failed:', error);
      }
    };

    startProgressiveLoading();
  }, [loadEssentialData, loadEnhancedData, loadBackgroundData]);

  // Handle retry
  const handleRetry = useCallback(async () => {
    await retryFailedRequests();
  }, [retryFailedRequests]);

  // Check if we have any errors
  const hasErrors = Object.values(loadingState).some(state => state === 'error');
  const isEssentialComplete = isPhaseComplete('essential');
  const isEnhancedComplete = isPhaseComplete('enhanced');
  const isBackgroundComplete = isPhaseComplete('background');

  // Render loading state for initial load
  if (!isEssentialComplete && !hasErrors) {
    return (
      <div className={cn('space-y-4', className)}>
        <HeaderSkeleton />
        
        {/* Loading progress indicator */}
        <Card>
          <CardContent className="py-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <span className="text-lg font-medium">Loading KOL Trading Data</span>
              </div>
              
              <div className="space-y-2 w-full max-w-md">
                <ProgressiveLoadingIndicator
                  phase="essential"
                  isComplete={isEssentialComplete}
                  hasError={loadingState.trades === 'error' || loadingState.stats === 'error' || loadingState.trending === 'error'}
                />
                <ProgressiveLoadingIndicator
                  phase="enhanced"
                  isComplete={isEnhancedComplete}
                  hasError={loadingState.mindmap === 'error'}
                />
                <ProgressiveLoadingIndicator
                  phase="background"
                  isComplete={isBackgroundComplete}
                  hasError={false}
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLoadingDetails(!showLoadingDetails)}
                className="text-muted-foreground"
              >
                {showLoadingDetails ? 'Hide' : 'Show'} Details
              </Button>

              {showLoadingDetails && (
                <div className="text-xs text-muted-foreground space-y-1 text-center">
                  <div>Trades: {loadingState.trades}</div>
                  <div>Stats: {loadingState.stats}</div>
                  <div>Trending: {loadingState.trending}</div>
                  <div>Mindmap: {loadingState.mindmap}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Show skeleton loaders */}
        {(activeView === 'live-trades' || activeView === 'both') && (
          <TradeListSkeleton count={6} />
        )}
        
        {(activeView === 'network-maps' || activeView === 'both') && (
          <Card>
            <CardContent>
              <MindmapSkeleton />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Render error state
  if (hasErrors && !essentialData) {
    return (
      <div className={cn('space-y-4', className)}>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Failed to Load Data</h3>
            <p className="text-muted-foreground mb-4 text-center">
              We encountered an error while loading the trading data. Please try again.
            </p>
            <div className="flex items-center space-x-2">
              <Button onClick={handleRetry} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLoadingDetails(!showLoadingDetails)}
              >
                {showLoadingDetails ? 'Hide' : 'Show'} Error Details
              </Button>
            </div>
            
            {showLoadingDetails && (
              <div className="mt-4 p-4 bg-muted/20 rounded-lg text-xs text-left">
                <div className="font-semibold mb-2">Error Details:</div>
                <div>Trades: {loadingState.trades}</div>
                <div>Stats: {loadingState.stats}</div>
                <div>Trending: {loadingState.trending}</div>
                <div>Mindmap: {loadingState.mindmap}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render main content with progressive enhancement
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with stats */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Live KOL Trades</span>
              </CardTitle>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-muted-foreground">
                  {finalTrades.length || 0} trades loaded
                </span>
              </div>
              {!isBackgroundComplete && (
                <div className="animate-bounce bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  Loading...
                </div>
              )}
            </div>

            {/* Stats display */}
            {finalStats && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Users className="h-3 w-3" />
                  <span className="font-medium">{finalStats.uniqueKOLs}</span>
                  <span className="hidden sm:inline">KOLs</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CircleDollarSign className="h-3 w-3" />
                  <span className="font-medium">{finalStats.uniqueTokens}</span>
                  <span className="hidden sm:inline">tokens</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Activity className="h-3 w-3" />
                  <span className="font-medium">{finalStats.totalTrades}</span>
                  <span className="hidden sm:inline">total</span>
                </div>
              </div>
            )}

            {/* Connection status indicator */}
            <div className="flex items-center space-x-2">
              {socketConnected ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs">Live Updates</span>
                </div>
              ) : isBackgroundComplete ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs">Complete</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-blue-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Loading...</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Live Trades Section */}
      {(activeView === 'live-trades' || activeView === 'both') && (
        <div>
          {finalTrades.length ? (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {finalTrades.slice(0, maxTrades).map((trade, index) => (
                <KOLTradeCard
                  key={`${trade.id}-${index}`}
                  trade={trade}
                  onClick={() => {}}
                  variant="card"
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {loadingState.trades === 'error' ? 'API Temporarily Unavailable' : 'No trades available'}
                </h3>
                <p className="text-muted-foreground text-center">
                  {loadingState.trades === 'error' 
                    ? 'The trading data service is currently unavailable. The page will automatically retry when the service is restored.'
                    : 'Waiting for live trading data...'
                  }
                </p>
                {loadingState.trades === 'error' && (
                  <Button onClick={handleRetry} size="sm" className="mt-4">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Network Maps Section */}
      {(activeView === 'network-maps' || activeView === 'both') && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Network className="h-5 w-5" />
                <span>KOL Network Maps</span>
              </CardTitle>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>{mindmapTokenCount} tokens mapped</span>
                {socketConnected && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span>Live</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {hasMindmapData ? (
              <UnifiedKOLMindmap 
                tokensData={finalMindmapData}
                trendingTokens={finalTrendingTokens || []}
              />
            ) : (loadingState.mindmap === 'loading' || socketLoading) ? (
              <MindmapSkeleton />
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Network className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {loadingState.mindmap === 'error' ? 'Network Map Error' : 'Building Network Maps'}
                </h3>
                <p className="text-muted-foreground text-center">
                  {loadingState.mindmap === 'error' 
                    ? 'Failed to load network data. The maps will update automatically when data becomes available.'
                    : 'Building KOL-token relationship maps from live trade data...'
                  }
                </p>
                {loadingState.mindmap === 'error' && (
                  <Button onClick={handleRetry} size="sm" className="mt-4">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Progress indicator for background loading */}
      {!isBackgroundComplete && isEssentialComplete && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm text-muted-foreground">
                  {hasMindmapData 
                    ? 'Expanding network maps with live data...'
                    : 'Loading network data in background...'
                  }
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {mindmapTokenCount} / {finalTrendingTokens.length || 0} tokens mapped
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};