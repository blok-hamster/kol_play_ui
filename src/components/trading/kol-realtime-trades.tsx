'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useKOLTradeSocketContext } from '@/contexts/kol-trade-socket-context';
import { useKOLTradeStore } from '@/stores/use-kol-trade-store';
import { KOLTradeCard } from './kol-trade-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { 
  Activity, 
  Loader2, 
  Search,
  Filter,
  LayoutGrid,
  List,
  RefreshCw,
  Users,
  UserCheck,
  CircleDollarSign
} from 'lucide-react';
import { useKOLStore } from '@/stores';
import { useSubscriptions } from '@/stores/use-trading-store';

interface KOLRealtimeTradesProps {
  maxTrades?: number;
  showFilters?: boolean;
  className?: string;
}

type ViewMode = 'cards' | 'list';

export const KOLRealtimeTrades: React.FC<KOLRealtimeTradesProps> = ({
  maxTrades = 50,
  showFilters = true,
  className
}) => {
  const {
    isConnected,
    recentTrades,
    isLoadingInitialData,
    stats
  } = useKOLTradeSocketContext();

  const { filters, setFilters, clearFilters, setSelectedTrade } = useKOLTradeStore();
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [lastTradeCount, setLastTradeCount] = useState(0);
  const [showNewTradeAlert, setShowNewTradeAlert] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0);
  const [activeTab, setActiveTab] = useState<'featured' | 'subscribed'>('featured');
  const { getKOL, ensureKOL } = useKOLStore();
  const { isSubscribedToKOL, subscriptions } = useSubscriptions();

  // Force update mechanism for when React doesn't detect changes
  const forceUpdate = useCallback(() => {
    setForceUpdateCounter(prev => prev + 1);
  }, []);

  const handleTradeClick = useCallback((trade: any) => {
    setSelectedTrade(trade);
    // Could open a modal or navigate to trade details
  }, [setSelectedTrade]);

  // Detect new trades for visual feedback
  React.useEffect(() => {
    if (recentTrades.length > lastTradeCount && lastTradeCount > 0) {
      setShowNewTradeAlert(true);
      forceUpdate(); // Force re-render when new trades arrive
      const timer = setTimeout(() => setShowNewTradeAlert(false), 2000);
      return () => clearTimeout(timer);
    }
    setLastTradeCount(recentTrades.length);
  }, [recentTrades.length, lastTradeCount, forceUpdate]);

  // Force update whenever the trades array reference changes
  React.useEffect(() => {
    forceUpdate();
  }, [recentTrades, forceUpdate]);

  const filteredTrades = useMemo(() => {
    return recentTrades
      .filter(trade => {
        // Tab-based filtering
        if (activeTab === 'subscribed' && !isSubscribedToKOL(trade.kolWallet)) {
          return false;
        }
        
        // Regular filters
        if (filters.tradeType !== 'all' && (trade.tradeData.tradeType ?? 'sell') !== filters.tradeType) return false;
        if (filters.selectedKOL && !trade.kolWallet.toLowerCase().includes(filters.selectedKOL.toLowerCase())) return false;
        if (filters.minAmount) {
          const isBuy = (trade.tradeData.tradeType ?? 'sell') === 'buy';
          const solAmount = isBuy ? trade.tradeData.amountOut : trade.tradeData.amountIn;
          if (solAmount < parseFloat(filters.minAmount)) return false;
        }
        return true;
      })
      .slice(0, maxTrades);
  }, [recentTrades, filters, maxTrades, activeTab, isSubscribedToKOL]);

  // Prefetch KOL details for displayed wallets to avoid repeated endpoint calls
  const displayedWallets = useMemo(() => {
    const set = new Set<string>();
    for (const t of filteredTrades) {
      if (t.kolWallet) set.add(t.kolWallet.toLowerCase());
    }
    return Array.from(set);
  }, [filteredTrades]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const promises: Promise<any>[] = [];
      for (const wallet of displayedWallets) {
        if (!getKOL(wallet)) {
          promises.push(ensureKOL(wallet));
        }
      }
      if (promises.length) {
        try {
          await Promise.allSettled(promises);
          if (!cancelled) setForceUpdateCounter(prev => prev + 1);
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [displayedWallets, getKOL, ensureKOL]);

  // Enrich trades with KOL details for downstream components that can use them
  const enrichedTrades = useMemo(() => {
    return filteredTrades.map(t => ({
      ...t,
      kolDetails: getKOL(t.kolWallet.toLowerCase()),
    }));
  }, [filteredTrades, getKOL, forceUpdateCounter]);

  if (isLoadingInitialData) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading recent KOL trades...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Live KOL Trades</span>
              </CardTitle>
              
              {/* Tab Toggle */}
              <div className="flex items-center bg-muted rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('featured')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1',
                    activeTab === 'featured'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Featured</span>
                </button>
                <button
                  onClick={() => setActiveTab('subscribed')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1',
                    activeTab === 'subscribed'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <UserCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Subscribed</span>
                  <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full ml-1">
                    {Object.keys(subscriptions).length}
                  </span>
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                )} />
                <span className="text-sm text-muted-foreground">
                  {isConnected ? `${filteredTrades.length} live trades` : 'Disconnected'}
                  {activeTab === 'subscribed' && ' (subscribed)'}
                </span>
              </div>
              {showNewTradeAlert && (
                <div className="animate-bounce bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  New!
                </div>
              )}
            </div>

            {/* Tab-specific Statistics Display */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {activeTab === 'featured' ? (
                <>
                  <div className="flex items-center space-x-1">
                    <Users className="h-3 w-3" />
                    <span className="font-medium">{stats.uniqueKOLs}</span>
                    <span className="hidden sm:inline">KOLs</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <CircleDollarSign className="h-3 w-3" />
                    <span className="font-medium">{stats.uniqueTokens}</span>
                    <span className="hidden sm:inline">tokens</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Activity className="h-3 w-3" />
                    <span className="font-medium">{stats.totalTrades}</span>
                    <span className="hidden sm:inline">total trades</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-1">
                    <UserCheck className="h-3 w-3" />
                    <span className="font-medium">{Object.keys(subscriptions).length}</span>
                    <span className="hidden sm:inline">subscribed KOLs</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Activity className="h-3 w-3" />
                    <span className="font-medium">{filteredTrades.length}</span>
                    <span className="hidden sm:inline">subscribed trades</span>
                  </div>
                </>
              )}
              {/* Debug info */}
              <div className="flex items-center space-x-1 text-blue-500">
                <RefreshCw className="h-3 w-3" />
                <span className="font-medium">{recentTrades.length}</span>
                <span className="hidden sm:inline">live</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* View Toggle */}
              <div className="flex items-center bg-muted rounded-lg p-1">
                <button
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1',
                    viewMode === 'cards'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1',
                    viewMode === 'list'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>

              {showFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                  className="flex items-center space-x-2"
                >
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                </Button>
              )}
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && showFiltersPanel && (
            <div className="mt-4 p-4 bg-muted/30 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Trade Type
                  </label>
                  <select
                    value={filters.tradeType}
                    onChange={(e) => setFilters({ ...filters, tradeType: e.target.value as 'all' | 'buy' | 'sell' })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                  >
                    <option value="all">All Trades</option>
                    <option value="buy">Buy Only</option>
                    <option value="sell">Sell Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    KOL Filter
                  </label>
                  <Input
                    placeholder="Search KOL wallet..."
                    value={filters.selectedKOL || ''}
                    onChange={(e) => setFilters({ ...filters, selectedKOL: e.target.value || undefined })}
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Min Amount (SOL)
                  </label>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={filters.minAmount || ''}
                    onChange={(e) => setFilters({ ...filters, minAmount: e.target.value || undefined })}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  {filteredTrades.length} of {recentTrades.length} trades shown
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Trades Display */}
      <div>
        {filteredTrades.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              {activeTab === 'subscribed' ? (
                <>
                  <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No subscribed KOL trades</h3>
                  <p className="text-muted-foreground text-center">
                    {Object.keys(subscriptions).length === 0 
                      ? 'You haven\'t subscribed to any KOLs yet. Switch to Featured to see all trades.'
                      : 'None of your subscribed KOLs have made trades recently.'
                    }
                  </p>
                  {Object.keys(subscriptions).length === 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('featured')}
                      className="mt-4"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      View Featured Trades
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No trades available</h3>
                  <p className="text-muted-foreground">
                    {!isConnected ? 'Connecting to live feed...' : 'No trades match your current filters'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className={cn(
            viewMode === 'cards' 
              ? 'grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' 
              : 'space-y-4'
          )}>
            {enrichedTrades.map((trade, index) => (
              <KOLTradeCard
                key={`${trade.id}-${trade.timestamp ? new Date(trade.timestamp).getTime() : Date.now()}-${forceUpdateCounter}`}
                trade={trade}
                onClick={handleTradeClick}
                variant={viewMode === 'list' ? 'list' : 'card'}
              />
            ))}
          </div>
        )}
      </div>

      {/* Load More Indicator */}
      {filteredTrades.length === maxTrades && recentTrades.length > maxTrades && (
        <Card>
          <CardContent className="text-center py-6">
            <p className="text-muted-foreground mb-2">
              Showing {maxTrades} of {recentTrades.length} trades
            </p>
            <p className="text-sm text-muted-foreground">
              More trades are being loaded automatically as they come in
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 