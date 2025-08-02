'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { SwapService } from '@/services';
import { useLiveTradesFeed, useLoading, useNotifications } from '@/stores';
import { useRealTimeUpdates } from '@/hooks/use-realtime-updates';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import MindShareWidget from './mind-share-widget';

interface LiveTradesFeedProps {
  className?: string;
  limit?: number;
  showHeader?: boolean;
  compactMode?: boolean;
  autoRefresh?: boolean;
}

interface QuickTradeState {
  tradeId: string;
  isExecuting: boolean;
  type: 'buy' | 'sell';
}

export default function LiveTradesFeed({
  className = '',
  limit = 50,
  showHeader = true,
  compactMode = false,
  autoRefresh = true,
}: LiveTradesFeedProps) {
  const { liveTradesFeed, addLiveTrade, clearLiveTradesFeed } =
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

  // Get subscribed KOL wallets for filtering
  const subscribedKOLWallets = useMemo(
    () => liveTradesFeed.map(trade => trade.kolWallet),
    [liveTradesFeed]
  );

  // Real-time updates for subscribed KOLs
  useRealTimeUpdates({
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

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: Date | number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  }, []);

  // Format currency
  const formatCurrency = useCallback((amount: number, decimals = 4) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(amount);
  }, []);

  // Get KOL display name
  const getKOLDisplayName = useCallback((trade: KOLTrade) => {
    return trade.kolName || `${trade.kolWallet.slice(0, 8)}...`;
  }, []);

  // Render trade item
  const renderTradeItem = useCallback(
    (trade: KOLTrade, index: number) => {
      const isBuy = trade.tradeType === 'buy';
      const buyTradeState = quickTrades.get(`${trade.id}-buy`);
      const sellTradeState = quickTrades.get(`${trade.id}-sell`);

      // Find KOL data from subscription for sharing
      const kolSubscription = liveTradesFeed.find(
        t => t.kolWallet === trade.kolWallet
      );
      const kolData = kolSubscription
        ? {
            name: trade.kolName || `${trade.kolWallet.slice(0, 8)}...`,
            walletAddress: trade.kolWallet,
            winRate: undefined, // Not available in subscription data
            totalPnL: undefined, // Not available in subscription data
            avatar: undefined, // Not available in subscription data
          }
        : undefined;

      return (
        <div
          key={`${trade.id}-${index}`}
          className={`
          bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 
          hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200
          ${compactMode ? 'p-3' : 'p-4'}
        `}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div
                className={`
              w-2 h-2 rounded-full ${isBuy ? 'bg-green-500' : 'bg-red-500'}
            `}
              />

              <div>
                <h4
                  className={`font-semibold text-gray-900 dark:text-white ${
                    compactMode ? 'text-sm' : 'text-base'
                  }`}
                >
                  {getKOLDisplayName(trade)}
                </h4>
                <p
                  className={`text-gray-500 dark:text-gray-400 ${
                    compactMode ? 'text-xs' : 'text-sm'
                  }`}
                >
                  {formatTimestamp(trade.timestamp)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`
              inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
              ${
                isBuy
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }
            `}
              >
                {isBuy ? 'BUY' : 'SELL'}
              </span>

              <MindShareWidget
                trade={trade}
                kolData={kolData}
                variant="inline"
                className="ml-2"
              />
            </div>
          </div>

          {/* Trade Details */}
          <div
            className={`grid gap-3 mb-4 ${compactMode ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}
          >
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Token
              </p>
              <p
                className={`font-mono font-medium text-gray-900 dark:text-white ${
                  compactMode ? 'text-sm' : 'text-base'
                }`}
              >
                {trade.tokenOut || trade.tokenIn || 'Unknown'}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Amount
              </p>
              <p
                className={`font-medium text-gray-900 dark:text-white ${
                  compactMode ? 'text-sm' : 'text-base'
                }`}
              >
                {formatCurrency(trade.amountOut || trade.amountIn || 0)}
              </p>
            </div>

            {!compactMode && (
              <>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Value (SOL)
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(trade.amountIn || 0, 4)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Signature
                  </p>
                  <p className="font-mono text-sm text-gray-600 dark:text-gray-400 truncate">
                    {trade.signature
                      ? `${trade.signature.slice(0, 8)}...`
                      : 'N/A'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Quick Trade Buttons */}
          {kolSubscription && (
            <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Quick Trade
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleQuickTrade(trade, 'buy')}
                  disabled={buyTradeState?.isExecuting}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded text-xs font-medium transition-colors flex items-center space-x-1"
                >
                  {buyTradeState?.isExecuting && (
                    <svg
                      className="animate-spin h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  <span>Buy</span>
                </button>

                <button
                  onClick={() => handleQuickTrade(trade, 'sell')}
                  disabled={sellTradeState?.isExecuting}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded text-xs font-medium transition-colors flex items-center space-x-1"
                >
                  {sellTradeState?.isExecuting && (
                    <svg
                      className="animate-spin h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  <span>Sell</span>
                </button>
              </div>
            </div>
          )}

          {/* Not Subscribed Message */}
          {!kolSubscription && (
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Subscribe to this KOL to enable quick trading
              </p>
            </div>
          )}
        </div>
      );
    },
    [
      compactMode,
      quickTrades,
      formatTimestamp,
      formatCurrency,
      getKOLDisplayName,
      handleQuickTrade,
      liveTradesFeed,
    ]
  );

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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Live Trades Feed
          </h2>
        )}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                  <div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-1 w-24"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                  </div>
                </div>
                <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-12"></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j}>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded mb-1"></div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Live Trades Feed
            </h2>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredTrades.length} recent trades
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z"
                />
              </svg>
              <span>Filters</span>
            </button>

            <button
              onClick={() => clearLiveTradesFeed()}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trade Type
              </label>
              <select
                value={filters.tradeType}
                onChange={e =>
                  handleFilterChange({ tradeType: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Trades</option>
                <option value="buy">Buy Only</option>
                <option value="sell">Sell Only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time Range
              </label>
              <select
                value={filters.timeRange}
                onChange={e =>
                  handleFilterChange({ timeRange: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="1h">Last Hour</option>
                <option value="4h">Last 4 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={e =>
                    handleFilterChange({ sortBy: e.target.value as any })
                  }
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="timestamp">Time</option>
                  <option value="amount">Amount</option>
                  <option value="kolName">KOL Name</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Order
                </label>
                <select
                  value={filters.sortOrder}
                  onChange={e =>
                    handleFilterChange({ sortOrder: e.target.value as any })
                  }
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
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
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Trades List */}
      <div className="space-y-4">{filteredTrades.map(renderTradeItem)}</div>

      {/* Empty State */}
      {filteredTrades.length === 0 && !isLoading('liveTradesFeed') && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No live trades
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {subscribedKOLWallets.length === 0
              ? 'Subscribe to KOLs to see their live trades here'
              : 'No recent trades from your subscribed KOLs'}
          </p>
        </div>
      )}

      {/* Real-time Status */}
      {autoRefresh && (
        <div className="flex items-center justify-center pt-4">
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live updates active</span>
          </div>
        </div>
      )}
    </div>
  );
}
