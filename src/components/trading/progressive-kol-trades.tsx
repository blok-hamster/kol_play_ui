'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useProgressiveLoading } from '@/hooks/use-progressive-loading';
import { useKOLTradeSocketContext } from '@/contexts/kol-trade-socket-context';
import { KOLTradeCard } from './kol-trade-card';
import { UnifiedKOLMindmap } from './unified-kol-mindmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TradeListSkeleton,
  MindmapSkeleton,
  ProgressiveLoadingIndicator
} from '@/components/ui/skeleton-loaders';
import { cn } from '@/lib/utils';
import {
  Activity,
  Network,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface ProgressiveKOLTradesProps {
  maxTrades?: number;
  showFilters?: boolean;
  className?: string;
  activeView?: 'live-trades' | 'network-maps' | 'both';
}

export const ProgressiveKOLTrades: React.FC<ProgressiveKOLTradesProps> = ({
  maxTrades = 25,
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
  const [tradeSearch, setTradeSearch] = useState('');
  const [tokenAddressFilter, setTokenAddressFilter] = useState('');

  // State for load more
  const [visibleTrades, setVisibleTrades] = useState(maxTrades);

  // Update visible trades when maxTrades changes
  useEffect(() => {
    setVisibleTrades(maxTrades);
  }, [maxTrades]);

  const handleLoadMore = () => {
    setVisibleTrades(prev => prev + 50);
  };

  // Compute final data - prioritize real-time socket data over progressive loading data
  const finalTrades = socketTrades.length > 0 ? socketTrades : (essentialData?.trades || []);
  const finalStats = socketStats.totalTrades > 0 ? socketStats : (essentialData?.stats || {
    totalTrades: 0,
    uniqueKOLs: 0,
    uniqueTokens: 0,
    totalVolume: 0,
  });
  const finalTrendingTokens = socketTrendingTokens.length > 0 ? socketTrendingTokens : (essentialData?.trendingTokens || []);

  // Memoize merged mindmap data to avoid creating new references on every render
  const socketMindmapKeys = Object.keys(socketMindmapData).sort().join(',');
  const progressiveMindmapKeys = Object.keys(progressiveMindmapData).sort().join(',');
  const finalMindmapData = useMemo(() => ({
    ...progressiveMindmapData,
    ...socketMindmapData, // Socket data takes priority
  }), [socketMindmapKeys, progressiveMindmapKeys]);

  // Filtering logic
  const filteredTrades = useMemo(() => {
    let result = finalTrades;

    if (tradeSearch.trim()) {
      const query = tradeSearch.toLowerCase().trim();
      result = result.filter(trade =>
        trade.kolWallet?.toLowerCase().includes(query) ||
        trade.tradeData?.name?.toLowerCase().includes(query) ||
        trade.tradeData?.symbol?.toLowerCase().includes(query) ||
        trade.tradeData?.mint?.toLowerCase().includes(query)
      );
    }

    if (tokenAddressFilter.trim()) {
      const address = tokenAddressFilter.toLowerCase().trim();
      result = result.filter(trade =>
        trade.tradeData?.mint?.toLowerCase() === address
      );
    }

    return result;
  }, [finalTrades, tradeSearch, tokenAddressFilter]);

  const finalIsLoading = socketLoading && (loadingState.trades === 'loading' || loadingState.trades === 'idle');

  // Check if we have mindmap data available
  const hasMindmapData = Object.keys(finalMindmapData).length > 0;
  const mindmapTokenCount = Object.keys(finalMindmapData).length;


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

      {/* Live Trades Section */}
      {(activeView === 'live-trades' || activeView === 'both') && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search KOLs or Tokens..."
                value={tradeSearch}
                onChange={(e) => setTradeSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div className="relative flex-1">
              <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter by Token Mint..."
                value={tokenAddressFilter}
                onChange={(e) => setTokenAddressFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono text-sm"
              />
            </div>
            {(tradeSearch || tokenAddressFilter) && (
              <Button
                variant="ghost"
                onClick={() => { setTradeSearch(''); setTokenAddressFilter(''); }}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            )}
          </div>

          <div>
            {filteredTrades.length ? (
              <div className="space-y-6">
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                  {filteredTrades.slice(0, visibleTrades).map((trade, index) => (
                    <KOLTradeCard
                      key={`${trade.id}-${index}`}
                      trade={trade}
                      onClick={() => { }}
                      variant="card"
                    />
                  ))}
                </div>

                {filteredTrades.length > visibleTrades && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      className="min-w-[200px] bg-background/50 backdrop-blur-sm hover:bg-background/80"
                    >
                      Load More Trades ({filteredTrades.length - visibleTrades} remaining)
                    </Button>
                  </div>
                )}
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