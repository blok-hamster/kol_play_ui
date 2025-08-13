'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { SwapService } from '@/services';
import { useLiveTradesFeed, useLoading, useNotifications } from '@/stores';
import { useLiveTradesUpdates } from '@/hooks/use-realtime-updates';
import { KOLTrade, TradeFilters } from '@/types';
import {
  formatCurrency,
  formatNumber,
  formatWalletAddress,
  cn,
} from '@/lib/utils';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Copy,
  ExternalLink,
  Filter,
  SortAsc,
  SortDesc,
  RefreshCw,
  Grid3X3,
  List,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import MindShareWidget from './mind-share-widget';
import { KOLTradeCard } from './kol-trade-card';

interface LiveTradesFeedProps {
  className?: string;
  limit?: number;
  showHeader?: boolean;
  compactMode?: boolean;
  autoRefresh?: boolean;
  hideEmptyState?: boolean;
  hideStatus?: boolean;
}

interface QuickTradeState {
  tradeId: string;
  isExecuting: boolean;
  type: 'buy' | 'sell';
}

type ViewMode = 'cards' | 'list';

export default function LiveTradesFeed({
  className = '',
  limit = 50,
  showHeader = true,
  compactMode = false,
  autoRefresh = true,
  hideEmptyState = false,
  hideStatus = false,
}: LiveTradesFeedProps) {
  const { liveTradesFeed, addLiveTrade } =
    useLiveTradesFeed();
  const { isLoading, setLoading } = useLoading();
  const { showSuccess, showError, showInfo } = useNotifications();

  // State
  const [filters, setFilters] = useState<TradeFilters>({
    tradeType: 'all',
    timeRange: '24h',
    sortBy: 'timestamp',
    sortOrder: 'desc',
  });
  const [quickTrades, setQuickTrades] = useState<Map<string, QuickTradeState>>(
    new Map()
  );
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  // Get subscribed KOL wallets for filtering
  const subscribedKOLWallets = useMemo(
    () => liveTradesFeed.map(trade => trade.kolWallet),
    [liveTradesFeed]
  );

  // Real-time updates for subscribed KOLs
  useLiveTradesUpdates({
    kolWallets: subscribedKOLWallets,
    throttle: 200, // More responsive for live feed
  });

  // Filter and sort trades
  const filteredTrades = useMemo(() => {
    let filtered = [...liveTradesFeed];

    // Filter by KOL wallet
    if (filters.kolWallet) {
      filtered = filtered.filter(
        trade => trade.kolWallet === filters.kolWallet
      );
    } else {
      // Only show trades from subscribed KOLs
      filtered = filtered.filter(trade =>
        subscribedKOLWallets.includes(trade.kolWallet)
      );
    }

    // Filter by trade type
    if (filters.tradeType !== 'all') {
      filtered = filtered.filter(
        trade => trade.tradeType === filters.tradeType
      );
    }

    // Filter by time range
    if (filters.timeRange !== 'all') {
      const now = Date.now();
      const ranges = {
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
      };

      const cutoff = now - ranges[filters.timeRange as keyof typeof ranges];
      filtered = filtered.filter(
        trade => new Date(trade.timestamp).getTime() >= cutoff
      );
    }

    // Filter by minimum amount
    if (filters.minAmount && filters.minAmount > 0) {
      filtered = filtered.filter(
        trade => (trade.amountIn || 0) >= filters.minAmount!
      );
    }

    // Filter by token
    if (filters.tokenFilter) {
      const tokenQuery = filters.tokenFilter.toLowerCase();
      filtered = filtered.filter(
        trade =>
          trade.tokenIn?.toLowerCase().includes(tokenQuery) ||
          trade.tokenOut?.toLowerCase().includes(tokenQuery)
      );
    }

    // Sort trades
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (filters.sortBy) {
        case 'timestamp':
          aValue = new Date(a.timestamp).getTime();
          bValue = new Date(b.timestamp).getTime();
          break;
        case 'amount':
          aValue = a.amountIn || 0;
          bValue = b.amountIn || 0;
          break;
        case 'kolName':
          aValue = a.kolName || a.kolWallet;
          bValue = b.kolName || b.kolWallet;
          break;
        default:
          return 0;
      }

      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Limit results
    return filtered.slice(0, limit);
  }, [liveTradesFeed, filters, subscribedKOLWallets, limit]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<TradeFilters>) => {
      const updatedFilters = { ...filters, ...newFilters };
      // Remove undefined values to avoid exactOptionalPropertyTypes issues
      Object.keys(updatedFilters).forEach(key => {
        if (updatedFilters[key as keyof TradeFilters] === undefined) {
          delete updatedFilters[key as keyof TradeFilters];
        }
      });
      setFilters(updatedFilters);
    },
    [filters]
  );

  // Handle quick trade execution
  const handleQuickTrade = useCallback(
    async (trade: KOLTrade, type: 'buy' | 'sell') => {
      const tradeKey = `${trade.id}-${type}`;

      try {
        setQuickTrades(
          prev =>
            new Map(
              prev.set(tradeKey, {
                tradeId: trade.id,
                isExecuting: true,
                type,
              })
            )
        );

        // Get user's subscription settings for this KOL
        const subscription = liveTradesFeed.find(
          t => t.kolWallet === trade.kolWallet
        );
        if (!subscription) {
          throw new Error('Not subscribed to this KOL');
        }

        // Determine trade amount based on subscription settings
        let tradeAmount = trade.amountIn || 0;

        if (subscription.copyPercentage && subscription.copyPercentage < 100) {
          tradeAmount = tradeAmount * (subscription.copyPercentage / 100);
        }

        // Apply min/max amount limits
        if (subscription.minAmount && tradeAmount < subscription.minAmount) {
          tradeAmount = subscription.minAmount;
        }
        if (subscription.maxAmount && tradeAmount > subscription.maxAmount) {
          tradeAmount = subscription.maxAmount;
        }

        // Execute the trade
        const swapRequest = {
          tradeType: type,
          amount: tradeAmount,
          mint: type === 'buy' ? trade.tokenOut || trade.tokenIn : 'SOL',
          slippagePercent: subscription.settings?.maxSlippagePercent || 1.0,
        };

        const result = await SwapService.performSwap(swapRequest);

        showSuccess(
          'Trade Executed',
          `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${swapRequest.mint} for ${tradeAmount.toFixed(4)} SOL`
        );

        // Add to recent transactions in trading store (if needed)
        // This would typically be handled by the swap service or real-time updates
      } catch (error: any) {
        showError(
          'Trade Failed',
          error.message || `Failed to execute ${type} trade`
        );
        console.error('Quick trade failed:', error);
      } finally {
        setQuickTrades(prev => {
          const newMap = new Map(prev);
          newMap.delete(tradeKey);
          return newMap;
        });
      }
    },
    [liveTradesFeed, showSuccess, showError]
  );

  // Handle trade card click
  const handleTradeClick = useCallback((trade: KOLTrade) => {
    // Could open a modal or navigate to trade details
    console.log('Trade clicked:', trade);
  }, []);

  // Get unique KOLs for filter dropdown
  const uniqueKOLs = useMemo(() => {
    const kolsMap = new Map();
    liveTradesFeed.forEach(trade => {
      if (subscribedKOLWallets.includes(trade.kolWallet)) {
        kolsMap.set(trade.kolWallet, {
          wallet: trade.kolWallet,
          name: trade.kolName || `${trade.kolWallet.slice(0, 8)}...`,
        });
      }
    });
    return Array.from(kolsMap.values());
  }, [liveTradesFeed, subscribedKOLWallets]);

  // Loading state
  if (isLoading('liveTradesFeed') && filteredTrades.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        {showHeader && (
          <h2 className="text-2xl font-bold text-foreground">
            Live Trades Feed
          </h2>
        )}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-background border border-border rounded-lg p-4 animate-pulse"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-muted rounded-full"></div>
                  <div>
                    <div className="h-4 bg-muted rounded mb-1 w-24"></div>
                    <div className="h-3 bg-muted rounded w-16"></div>
                  </div>
                </div>
                <div className="h-5 bg-muted rounded w-12"></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j}>
                    <div className="h-3 bg-muted rounded mb-1"></div>
                    <div className="h-4 bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-foreground">
              Live Trades Feed
            </h2>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground">
                {filteredTrades.length} recent trades
              </span>
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

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 border border-border rounded-lg bg-background text-foreground hover:bg-muted transition-colors flex items-center space-x-2"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-background border border-border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                KOL
              </label>
              <select
                value={filters.kolWallet || ''}
                onChange={e => {
                  const value = e.target.value;
                  const newFilters: Partial<TradeFilters> = {};
                  if (value) {
                    newFilters.kolWallet = value;
                  }
                  handleFilterChange(newFilters);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
              >
                <option value="">All KOLs</option>
                {uniqueKOLs.map(kol => (
                  <option key={kol.wallet} value={kol.wallet}>
                    {kol.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Trade Type
              </label>
              <select
                value={filters.tradeType}
                onChange={e =>
                  handleFilterChange({ tradeType: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
              >
                <option value="all">All Trades</option>
                <option value="buy">Buy Only</option>
                <option value="sell">Sell Only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Time Range
              </label>
              <select
                value={filters.timeRange}
                onChange={e =>
                  handleFilterChange({ timeRange: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
              >
                <option value="1h">Last Hour</option>
                <option value="4h">Last 4 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Min Amount (SOL)
              </label>
              <input
                type="number"
                placeholder="Min SOL amount"
                value={filters.minAmount || ''}
                onChange={e => {
                  const value = e.target.value;
                  const newFilters: Partial<TradeFilters> = {};
                  if (value) {
                    newFilters.minAmount = parseFloat(value);
                  }
                  handleFilterChange(newFilters);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Token Filter
              </label>
              <input
                type="text"
                placeholder="Token symbol/name"
                value={filters.tokenFilter || ''}
                onChange={e => {
                  const value = e.target.value;
                  const newFilters: Partial<TradeFilters> = {};
                  if (value) {
                    newFilters.tokenFilter = value;
                  }
                  handleFilterChange(newFilters);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={e =>
                    handleFilterChange({ sortBy: e.target.value as any })
                  }
                  className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                >
                  <option value="timestamp">Time</option>
                  <option value="amount">Amount</option>
                  <option value="kolName">KOL Name</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Order
                </label>
                <select
                  value={filters.sortOrder}
                  onChange={e =>
                    handleFilterChange({ sortOrder: e.target.value as any })
                  }
                  className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
            </div>

            <button
              onClick={() =>
                setFilters({
                  tradeType: 'all',
                  timeRange: '24h',
                  sortBy: 'timestamp',
                  sortOrder: 'desc',
                })
              }
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Trades List */}
      <div className={cn(
        viewMode === 'cards' 
          ? 'grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' 
          : 'space-y-4'
      )}>
        {filteredTrades.map((trade, index) => (
          <KOLTradeCard
            key={`${trade.id}-${index}`}
            trade={trade}
            onClick={handleTradeClick}
            variant={viewMode === 'list' ? 'list' : 'card'}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredTrades.length === 0 && !isLoading('liveTradesFeed') && !hideEmptyState && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-foreground">
            No live trades
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {subscribedKOLWallets.length === 0
              ? 'Subscribe to KOLs to see their live trades here'
              : 'No recent trades from your subscribed KOLs'}
          </p>
        </div>
      )}

      {/* Real-time Status */}
      {autoRefresh && !hideStatus && (
        <div className="flex items-center justify-center pt-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live updates active</span>
          </div>
        </div>
      )}
    </div>
  );
}
