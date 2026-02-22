'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TradingService, KOLWallet, RecentKOLTradesRequest } from '@/services';
import { useSubscriptions, useLoading, useNotifications, useKOLStore } from '@/stores';
import { useLiveTradesUpdates } from '@/hooks';
import { useKOLTradeSocket } from '@/hooks/use-kol-trade-socket';
import { KOLTrade } from '@/types';
import { APP_CONFIG } from '@/lib/constants';
import SubscriptionControls from './subscription-controls';
import MindShareWidget from './mind-share-widget';
import { Copy, Clock } from 'lucide-react';
import React from 'react';
import { LazyAvatar } from '@/components/ui/lazy-avatar';

// Helpers to derive Twitter avatar URL (same logic as kol-list)
function extractTwitterUsername(profileUrl?: string): string | null {
  if (!profileUrl) return null;
  try {
    const url = new URL(profileUrl);
    const hostname = url.hostname.toLowerCase();
    const isTwitter = hostname === 'twitter.com' || hostname === 'www.twitter.com';
    const isX = hostname === 'x.com' || hostname === 'www.x.com';
    if (!isTwitter && !isX) return null;

    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) return null;
    const username = pathParts[0];
    if (!username) return null;
    return username.replace(/\.json$/i, '');
  } catch {
    return null;
  }
}

function getTwitterAvatarUrl(twitterUrl?: string, fallbackSeed?: string): string | undefined {
  const username = extractTwitterUsername(twitterUrl);
  if (!username) return undefined;
  // Let LazyAvatar handle the dicebear fallback locally
  return `https://unavatar.io/twitter/${encodeURIComponent(username)}`;
}

function findTwitterUrlFromText(text?: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+/i);
  return match ? match[0] : undefined;
}

function findTwitterUrlFromKOL(kol?: { socialLinks?: { twitter?: string }; description?: string }): string | undefined {
  if (!kol) return undefined;
  return kol.socialLinks?.twitter || findTwitterUrlFromText(kol.description);
}

// Custom component to show real-time trades for a specific KOL
interface KOLRealtimeTradesFilteredProps {
  kolWallet: string;
  maxTrades?: number;
  showFilters?: boolean;
  className?: string;
}

const KOLRealtimeTradesFiltered: React.FC<KOLRealtimeTradesFilteredProps> = ({
  kolWallet,
  maxTrades = 50,
  className
}) => {
  const { recentTrades, isConnected, isLoadingInitialData } = useKOLTradeSocket();
  const { getKOL, ensureKOL } = useKOLStore();
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  // Filter trades for this specific KOL and convert to proper format
  const kolTrades = useMemo(() => {
    return recentTrades
      .filter(trade => trade.kolWallet.toLowerCase() === kolWallet.toLowerCase())
      .map(trade => {
        const details = getKOL(trade.kolWallet.toLowerCase());
        const twitterUrl = findTwitterUrlFromKOL(details);
        const avatar = details?.avatar ?? getTwitterAvatarUrl(twitterUrl, details?.name || trade.kolWallet);
        const name = details?.name || `KOL ${trade.kolWallet?.slice(0, 4)}...${trade.kolWallet?.slice(-4)}`;
        return ({
          id: trade.id,
          kolWallet: trade.kolWallet,
          signature: trade.signature,
          timestamp: trade.timestamp,
          tradeType: trade.tradeData.tradeType ?? 'sell',
          tokenIn: trade.tradeData.tokenIn,
          tokenOut: trade.tradeData.tokenOut,
          amountIn: trade.tradeData.amountIn,
          amountOut: trade.tradeData.amountOut,
          mint: trade.tradeData.mint,
          dexProgram: trade.tradeData.dexProgram,
          fee: trade.tradeData.fee,
          prediction: trade.prediction, // Include prediction data
          kolDetails: details,
          kolName: name,
          kolAvatar: avatar,
        } as KOLTrade & { kolDetails?: any; kolName?: string; kolAvatar?: string | undefined });
      })
      .slice(0, maxTrades);
  }, [recentTrades, kolWallet, maxTrades, getKOL]);

  useEffect(() => {
    // Ensure current KOL details are cached
    (async () => { await ensureKOL(kolWallet); })();
  }, [kolWallet, ensureKOL]);

  // Helper function to get correct amounts based on trade type
  const getTradeAmounts = (trade: KOLTrade) => {
    const isBuy = trade.tradeType === 'buy';
    if (isBuy) {
      return {
        solAmount: trade.amountOut || 0, // SOL spent
        tokensAmount: trade.amountIn || 0, // Tokens bought
        label: { sol: 'SOL Spent', tokens: 'Tokens Bought' }
      };
    } else {
      return {
        solAmount: trade.amountIn || 0, // SOL received
        tokensAmount: trade.amountOut || 0, // Tokens sold
        label: { sol: 'SOL Received', tokens: 'Tokens Sold' }
      };
    }
  };

  // Helper to format numbers
  const formatAmount = (amount: number, decimals = 4) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(amount);
  };

  // Helper to convert lamports to SOL
  const lamportsToSol = (lamports: number) => {
    return lamports / 1_000_000_000;
  };

  if (isLoadingInitialData) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Loading live trades...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Trades</h3>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`} />
              <span className="text-sm text-muted-foreground">
                {isConnected ? `${kolTrades.length} trades` : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${viewMode === 'cards'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${viewMode === 'list'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Trades Display */}
      {kolTrades.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No live trades</h3>
            <p className="text-muted-foreground">
              This KOL hasn't made any recent trades. Live trades will appear here when they occur.
            </p>
          </div>
        </div>
      ) : (
        <div>
          {viewMode === 'cards' ? (
            // Cards View - Custom layout to match list view
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {kolTrades.map((trade, index) => {
                const amounts = getTradeAmounts(trade);
                const shouldShowPrediction = trade.prediction && trade.tradeType === 'buy';
                const displayName = trade.kolName || `KOL ${trade.kolWallet?.slice(0, 4)}...${trade.kolWallet?.slice(-4)}`;

                return (
                  <div
                    key={`${trade.id}-${index}`}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
                  >
                    {/* Card Layout */}
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {trade.kolAvatar ? (
                            <LazyAvatar src={trade.kolAvatar} fallbackSeed={displayName} alt={displayName} className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-xs">{(displayName?.slice(0, 2) || 'KO').toUpperCase()}</span>
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white text-sm">
                              {displayName}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(trade.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${trade.tradeType === 'buy' ? 'bg-green-500' : 'bg-red-500'
                            }`}>
                            <span>{trade.tradeType?.toUpperCase() || 'UNKNOWN'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-center">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {formatAmount(amounts.solAmount)} SOL
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatAmount(amounts.tokensAmount)} tokens
                        </div>
                      </div>

                      {/* AI Prediction */}
                      {shouldShowPrediction && trade.prediction ? (
                        <div className="flex items-center justify-center space-x-2">
                          <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-medium">
                            <span>AI Prediction (Buy)</span>
                          </div>
                          <div className="flex items-center space-x-1 px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded text-xs font-medium">
                            <span>{trade.prediction.classLabel}</span>
                            <span>{(trade.prediction.probability * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      ) : null}

                      {/* Footer */}
                      <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-1">
                          <span>Token:</span>
                          <span className="font-mono">{trade.mint?.slice(0, 4)}...{trade.mint?.slice(-4)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // List View - Custom non-responsive layout for modal
            <div className="space-y-3">
              {kolTrades.map((trade, index) => {
                const amounts = getTradeAmounts(trade);
                const shouldShowPrediction = trade.prediction && trade.tradeType === 'buy';
                const displayName = trade.kolName || `KOL ${trade.kolWallet?.slice(0, 6)}...${trade.kolWallet?.slice(-4)}`;

                return (
                  <div
                    key={`${trade.id}-${index}`}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
                  >
                    {/* Single Row Layout */}
                    <div className="flex items-center justify-between">
                      {/* Left: KOL Avatar and Info */}
                      <div className="flex items-center space-x-3 flex-shrink-0">
                        {trade.kolAvatar ? (
                          <LazyAvatar src={trade.kolAvatar} fallbackSeed={displayName} alt={displayName} className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-xs">
                              {(displayName?.slice(0, 2) || 'KO').toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white text-sm">
                            {displayName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {trade.kolWallet?.slice(0, 8)}...{trade.kolWallet?.slice(-4)}
                          </div>
                        </div>
                      </div>

                      {/* Center: Amount */}
                      <div className="flex-1 text-center">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {formatAmount(amounts.solAmount)} SOL
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatAmount(amounts.tokensAmount)} tokens
                        </div>
                      </div>

                      {/* Center Right: AI Prediction */}
                      <div className="flex-shrink-0 min-w-[140px]">
                        {shouldShowPrediction && trade.prediction ? (
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-medium">
                              <span>AI Prediction (Buy)</span>
                            </div>
                            <div className="flex items-center space-x-1 px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded text-xs font-medium">
                              <span>{trade.prediction.classLabel}</span>
                              <span>{(trade.prediction.probability * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        ) : (
                          <div></div>
                        )}
                      </div>

                      {/* Right: Token, Time, and Trade Type */}
                      <div className="flex items-center space-x-4 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Token:</div>
                          <div className="text-xs font-mono text-gray-700 dark:text-gray-300 flex items-center space-x-1">
                            <span>{trade.mint?.slice(0, 6)}...{trade.mint?.slice(-6)}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (trade.mint) {
                                  navigator.clipboard.writeText(trade.mint);
                                }
                              }}
                              className="hover:text-gray-900 dark:hover:text-white transition-colors"
                              title="Copy token address"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(trade.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${trade.tradeType === 'buy' ? 'bg-green-500' : 'bg-red-500'
                            }`}>
                            <span>{trade.tradeType?.toUpperCase() || 'UNKNOWN'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface KOLDetailProps {
  walletAddress: string;
  className?: string;
}

interface TradeHistoryFilters {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  sortOrder?: 'asc' | 'desc';
  tradeType?: 'buy' | 'sell' | 'all';
  dateRange?: '24h' | '7d' | '30d' | '60d' | 'all' | 'live';
}

export default function KOLDetail({
  walletAddress,
  className = '',
}: KOLDetailProps) {
  const router = useRouter();
  const { isSubscribedToKOL, getSubscription } = useSubscriptions();
  const { isLoading, setLoading } = useLoading();
  const { showError } = useNotifications();
  const { getKOL, setKOL, ensureKOL } = useKOLStore();

  // Get real-time KOL trade data
  const { recentTrades: allRecentTrades, isLoadingInitialData, isConnected } = useKOLTradeSocket();

  // Debug WebSocket connection and data
  useEffect(() => {
    void 0 && (`🔌 WebSocket Status:`, {
      isConnected,
      isLoadingInitialData,
      totalTrades: allRecentTrades.length,
      walletAddress,
      firstTrade: allRecentTrades[0]
    });
  }, [isConnected, isLoadingInitialData, allRecentTrades.length, walletAddress, allRecentTrades]);

  // State
  const [kolData, setKolData] = useState<KOLWallet | null>(null);
  const [tradeHistory, setTradeHistory] = useState<KOLTrade[]>([]);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'trades' | 'live-trades' | 'network-map' | 'analytics'
  >('live-trades');
  const [tradeFilters, setTradeFilters] = useState<TradeHistoryFilters>({
    page: 1,
    limit: APP_CONFIG.DEFAULT_PAGE_SIZE,
    sortBy: 'timestamp',
    sortOrder: 'desc',
    tradeType: 'all',
    dateRange: 'live',
  });
  const [hasMoreTrades, setHasMoreTrades] = useState(false);

  // Real-time updates for this specific KOL
  useLiveTradesUpdates({
    kolWallets: [walletAddress],
    throttle: 500,
  });

  // Filter real-time trades for this specific KOL
  const kolRealtimeTrades = useMemo(() => {
    void 0 && (`🔍 Filtering trades for KOL ${walletAddress}:`);
    void 0 && (`📥 Total trades from socket: ${allRecentTrades.length}`);

    const filtered = allRecentTrades.filter(trade => {
      const matches = trade.kolWallet.toLowerCase() === walletAddress.toLowerCase();
      if (matches) {
        void 0 && (`✅ Found matching trade for KOL:`, trade);
      }
      return matches;
    });

    void 0 && (`🎯 Filtered trades for this KOL: ${filtered.length}`);

    const mapped = filtered.map(trade => ({
      id: trade.id,
      kolWallet: trade.kolWallet,
      signature: trade.signature,
      timestamp: trade.timestamp,
      tradeType: trade.tradeData.tradeType ?? 'sell',
      tokenIn: trade.tradeData.tokenIn,
      tokenOut: trade.tradeData.tokenOut,
      amountIn: trade.tradeData.amountIn,
      amountOut: trade.tradeData.amountOut,
      mint: trade.tradeData.mint,
      dexProgram: trade.tradeData.dexProgram,
      fee: trade.tradeData.fee
    } as KOLTrade));

    void 0 && (`📊 Final mapped trades: ${mapped.length}`);
    return mapped;
  }, [allRecentTrades, walletAddress]);

  // Check subscription status
  const isSubscribed = useMemo(
    () => isSubscribedToKOL(walletAddress),
    [isSubscribedToKOL, walletAddress]
  );

  // Fetch KOL data
  const fetchKOLData = useCallback(async () => {
    try {
      setLoading('kolDetail', true);
      // Try from cache first
      const cached = getKOL(walletAddress);
      if (cached) {
        setKolData(cached);
        return;
      }
      // Ensure via store to avoid duplicate calls
      const ensured = await ensureKOL(walletAddress);
      if (ensured) {
        setKolData(ensured);
      } else {
        throw new Error('KOL not found');
      }
    } catch (error: any) {
      showError('Load Error', error.message || 'Failed to load KOL data');
      console.error('Failed to fetch KOL data:', error);
    } finally {
      setLoading('kolDetail', false);
    }
  }, [walletAddress, setLoading, showError]);

  // Fetch trade history
  const fetchTradeHistory = useCallback(
    async (newFilters?: Partial<TradeHistoryFilters>) => {
      // Always prioritize real-time data when available
      if (kolRealtimeTrades.length > 0) {
        void 0 && ('✅ Using real-time trade data instead of API call');
        return;
      }

      // Only make API calls for historical data when no real-time data is available
      if (tradeFilters.dateRange === 'live') {
        void 0 && ('⏳ Live mode selected but no real-time data yet, waiting...');
        return;
      }

      const currentFilters = { ...tradeFilters, ...newFilters };

      try {
        setLoading('tradeHistory', true);
        void 0 && ('📡 Fetching historical trade data from API...');

        const request: RecentKOLTradesRequest = {
          walletAddress,
          page: currentFilters.page,
          limit: currentFilters.limit,
          ...(currentFilters.sortBy && { sortBy: currentFilters.sortBy }),
          ...(currentFilters.sortOrder && {
            sortOrder: currentFilters.sortOrder,
          }),
        };

        // Check if requests should be blocked due to authentication
        const { requestManager } = await import('@/lib/request-manager');
        if (requestManager.shouldBlockRequest()) {
          console.log('🚫 KOL Detail - Fetch blocked during authentication');
          return;
        }

        // Use authenticated request wrapper
        const { authenticatedRequest } = await import('@/lib/request-manager');

        let response;

        // If specific timeframe selected (excluding 'live'), use the new historical endpoint
        if (['1d', '7d', '30d', '60d'].includes(currentFilters.dateRange || '')) {
          // Map 24h to 1d for backend consistency if needed, or keep as is if backend supports it. 
          // Backend supports: '1d', '7d', '30d', '60d'.
          const timeframe = currentFilters.dateRange === '24h' ? '1d' : currentFilters.dateRange;

          response = await authenticatedRequest(
            () => TradingService.getKOLTradeHistory(walletAddress, timeframe),
            { priority: 'medium', timeout: 15000 }
          );

          // The response.data has { trades, stats, timeframe }
          // We need to set tradeHistory to trades
          // And ideally update stats somewhere, but for now just trades.
          // Note: response is ApiResponse<KOLHistoryResponse>, so response.data is the object.
          // We need to wrap it to match the rest of the flow or handle it here.

          // Actually, let's normalize the response structure here
          const historicalData = response.data;
          // Set trades
          setTradeHistory(historicalData.trades || []);
          // We assume 'hasMore' is false for full history fetches unless implemented otherwise
          setHasMoreTrades(false);

          return; // Exit early since we handled it
        } else {
          // Fallback to recent trades (paginated)
          response = await authenticatedRequest(
            () => TradingService.getRecentKOLTrades(request),
            { priority: 'medium', timeout: 15000 }
          );

          if (currentFilters.page === 1) {
            setTradeHistory(response.data);
          } else {
            setTradeHistory(prev => [...prev, ...response.data]);
          }

          setHasMoreTrades(response.data.length === currentFilters.limit);
        }
      } catch (error: any) {
        showError(
          'Load Error',
          error.message || 'Failed to load trade history'
        );
        console.error('Failed to fetch trade history:', error);
      } finally {
        setLoading('tradeHistory', false);
      }
    },
    [walletAddress, tradeFilters, kolRealtimeTrades.length, setLoading, showError]
  );

  // Update trade history with real-time data when available
  useEffect(() => {
    if (kolRealtimeTrades.length > 0 && (activeTab === 'trades' || activeTab === 'analytics')) {
      void 0 && (`📊 Setting ${kolRealtimeTrades.length} real-time trades for KOL: ${walletAddress}`);
      setTradeHistory(kolRealtimeTrades);
    } else if (kolRealtimeTrades.length === 0 && !isLoadingInitialData && (activeTab === 'trades' || activeTab === 'analytics') && tradeFilters.dateRange !== 'live') {
      // Only fallback to API for non-live historical data
      void 0 && ('📡 No real-time trades available, falling back to API call for historical data');
      fetchTradeHistory();
    }
  }, [kolRealtimeTrades, activeTab, isLoadingInitialData, fetchTradeHistory, walletAddress, tradeFilters.dateRange]);

  // Filter trade history based on local filters
  const filteredTrades = useMemo(() => {
    // Use real-time data when "live" is selected, otherwise use tradeHistory
    const sourceData = tradeFilters.dateRange === 'live' ? kolRealtimeTrades : tradeHistory;
    let filtered = [...sourceData];

    // Filter by trade type
    if (tradeFilters.tradeType !== 'all') {
      filtered = filtered.filter(
        trade => trade.tradeType === tradeFilters.tradeType
      );
    }

    // Filter by date range (skip for live as it's already real-time)
    if (tradeFilters.dateRange !== 'all' && tradeFilters.dateRange !== 'live') {
      const now = Date.now();
      const ranges = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };

      const cutoff =
        now - ranges[tradeFilters.dateRange as keyof typeof ranges];
      filtered = filtered.filter(
        trade => new Date(trade.timestamp).getTime() >= cutoff
      );
    }

    return filtered;
  }, [tradeHistory, kolRealtimeTrades, tradeFilters.tradeType, tradeFilters.dateRange]);

  // Calculate analytics
  const analytics = useMemo(() => {
    if (filteredTrades.length === 0) {
      return {
        totalTrades: 0,
        buyTrades: 0,
        sellTrades: 0,
        totalVolume: 0,
        avgTradeSize: 0,
        uniqueTokens: 0,
        timeRange: '30d',
      };
    }

    const buyTrades = filteredTrades.filter(t => t.tradeType === 'buy');
    const sellTrades = filteredTrades.filter(t => t.tradeType === 'sell');
    const totalVolume = filteredTrades.reduce(
      (sum, t) => sum + (t.amountIn || 0),
      0
    );
    const uniqueTokens = new Set(
      filteredTrades.map(t => t.tokenIn || t.tokenOut)
    ).size;

    return {
      totalTrades: filteredTrades.length,
      buyTrades: buyTrades.length,
      sellTrades: sellTrades.length,
      totalVolume,
      avgTradeSize: totalVolume / filteredTrades.length,
      uniqueTokens,
      timeRange: tradeFilters.dateRange,
    };
  }, [filteredTrades, tradeFilters.dateRange]);

  // Handle tab changes
  const handleTabChange = useCallback(
    (tab: 'overview' | 'trades' | 'live-trades' | 'network-map' | 'analytics') => {
      setActiveTab(tab);
    },
    []
  );

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<TradeHistoryFilters>) => {
      setTradeFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
    },
    []
  );

  // Load more trades
  const handleLoadMoreTrades = useCallback(() => {
    if (!isLoading('tradeHistory') && hasMoreTrades) {
      const nextPage = tradeFilters.page + 1;
      setTradeFilters(prev => ({ ...prev, page: nextPage }));
      fetchTradeHistory({ page: nextPage });
    }
  }, [tradeFilters.page, hasMoreTrades, isLoading, fetchTradeHistory]);

  // Format currency
  const formatCurrency = useCallback((amount: number, decimals = 4) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(amount);
  }, []);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: Date | number) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }, []);

  // Effects
  useEffect(() => {
    fetchKOLData();
  }, [fetchKOLData]);

  useEffect(() => {
    if ((activeTab === 'trades' || activeTab === 'analytics') && kolRealtimeTrades.length === 0 && !isLoadingInitialData) {
      // Only fetch from API if we don't have real-time data and initial loading is complete
      fetchTradeHistory();
    }
  }, [
    activeTab,
    kolRealtimeTrades.length,
    isLoadingInitialData,
    fetchTradeHistory,
    tradeFilters.page,
    tradeFilters.sortBy,
    tradeFilters.sortOrder,
  ]);

  // Loading state
  if ((isLoading('kolDetail') && !kolData) || (isLoadingInitialData && kolRealtimeTrades.length === 0)) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-20 h-20 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div className="flex-1">
                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="text-center">
                  <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!kolData) {
    return (
      <div className={`text-center py-12 ${className}`}>
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          KOL Not Found
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          The requested KOL wallet could not be found.
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to KOLs
        </button>

        {isSubscribed && (
          <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">Subscribed</span>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            {(() => {
              const twitterUrl = findTwitterUrlFromKOL(kolData);
              const twitterAvatar = getTwitterAvatarUrl(twitterUrl, kolData.name || kolData.walletAddress);
              const preferredAvatar = twitterAvatar ?? kolData.avatar;
              if (preferredAvatar) {
                return (
                  <img
                    src={preferredAvatar}
                    alt={kolData.name || 'KOL Avatar'}
                    className="w-20 h-20 rounded-full"
                  />
                );
              }
              return (
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">
                    {(kolData.name || kolData.walletAddress.slice(0, 2)).toUpperCase()}
                  </span>
                </div>
              );
            })()}

            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {kolData.name || `${kolData.walletAddress.slice(0, 8)}...`}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 font-mono">
                {kolData.walletAddress}
              </p>
              {kolData.description && (
                <p className="text-gray-600 dark:text-gray-300 mt-2 max-w-md">
                  {kolData.description}
                </p>
              )}
            </div>
          </div>

          {/* Social Links */}
          {kolData.socialLinks &&
            Object.keys(kolData.socialLinks).length > 0 && (
              <div className="flex items-center space-x-3">
                {kolData.socialLinks.twitter && (
                  <a
                    href={kolData.socialLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 transition-colors"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                    </svg>
                  </a>
                )}
                {kolData.socialLinks.telegram && (
                  <a
                    href={kolData.socialLinks.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 transition-colors"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                  </a>
                )}
                {kolData.socialLinks.discord && (
                  <a
                    href={kolData.socialLinks.discord}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-500 hover:text-indigo-600 transition-colors"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0002 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.4189-2.1568 2.4189Z" />
                    </svg>
                  </a>
                )}
              </div>
            )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {kolData.subscriberCount.toLocaleString()}
            </p>
            <p className="text-gray-500 dark:text-gray-400">Subscribers</p>
          </div>

          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {kolData.totalTrades?.toLocaleString() || 'N/A'}
            </p>
            <p className="text-gray-500 dark:text-gray-400">Total Trades</p>
          </div>

          <div className="text-center">
            <p
              className={`text-2xl font-bold ${kolData.winRate != null && !isNaN(kolData.winRate)
                ? (kolData.winRate >= 60
                  ? 'text-green-600 dark:text-green-400'
                  : kolData.winRate >= 40
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400')
                : 'text-gray-500 dark:text-gray-400'
                }`}
            >
              {safeToFixed(kolData.winRate, 1, 'N/A') !== 'N/A' ? `${safeToFixed(kolData.winRate, 1)}%` : 'N/A'}
            </p>
            <p className="text-gray-500 dark:text-gray-400">Win Rate</p>
          </div>

          <div className="text-center">
            <p
              className={`text-2xl font-bold ${kolData.totalPnL != null && !isNaN(kolData.totalPnL)
                ? (kolData.totalPnL >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400')
                : 'text-gray-500 dark:text-gray-400'
                }`}
            >
              {safeToFixed(kolData.totalPnL, 2, 'N/A') !== 'N/A'
                ? `${kolData.totalPnL && kolData.totalPnL >= 0 ? '+' : ''}${safeToFixed(kolData.totalPnL, 2)} SOL`
                : 'N/A'}
            </p>
            <p className="text-gray-500 dark:text-gray-400">Total PnL</p>
          </div>
        </div>

        {/* Subscription Controls */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <SubscriptionControls
            kolWallet={walletAddress}
            {...(kolData.name && { kolName: kolData.name })}
            variant="card"
            showSettings={true}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { id: 'live-trades', label: '🔴 Live Trades' },
            { id: 'overview', label: 'Overview' },
            { id: 'trades', label: 'Trade History' },
            { id: 'network-map', label: 'Network Map' },
            { id: 'analytics', label: 'Analytics' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Performance Overview
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Detailed performance metrics and recent activity will be
                displayed here. This could include charts, recent trades
                summary, and other key insights.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'live-trades' && (
          <div className="py-6">
            <KOLRealtimeTradesFiltered
              kolWallet={walletAddress}
              maxTrades={50}
            />
          </div>
        )}

        {activeTab === 'network-map' && (
          <div className="py-6">
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {kolData?.name || 'KOL'} Network Map
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Interactive network visualization showing token relationships and trading patterns for this KOL.
                </p>
                {/* We'll show a placeholder or find tokens this KOL trades */}
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Network map will be available when this KOL has recent trading activity.</p>
                  <p className="text-sm mt-2">Check the Live Trades tab for real-time updates.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Trade Type
                  </label>
                  <select
                    value={tradeFilters.tradeType}
                    onChange={e =>
                      handleFilterChange({ tradeType: e.target.value as any })
                    }
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
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
                  <div className="flex items-center space-x-2">
                    <select
                      value={tradeFilters.dateRange}
                      onChange={e =>
                        handleFilterChange({ dateRange: e.target.value as any })
                      }
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="live">🔴 Live</option>
                      <option value="24h">Last 24 Hours</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                      <option value="all">All Time</option>
                    </select>
                    {tradeFilters.dateRange !== 'live' && kolRealtimeTrades.length > 0 && (
                      <button
                        onClick={() => handleFilterChange({ dateRange: 'live' })}
                        className="px-3 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-800 dark:text-green-200 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1"
                      >
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>View Live ({kolRealtimeTrades.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="ml-auto">
                  <div className="flex items-center space-x-4">
                    {tradeFilters.dateRange === 'live' && (
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${kolRealtimeTrades.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                          }`}></div>
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">
                          {kolRealtimeTrades.length > 0 ? 'Live data' : 'Waiting for trades...'}
                        </span>
                      </div>
                    )}
                    {kolRealtimeTrades.length > 0 && tradeFilters.dateRange !== 'live' && (
                      <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium">Real-time available</span>
                      </div>
                    )}
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {filteredTrades.length} trades
                    </span>
                    {/* Debug info */}
                    <div className="text-xs text-gray-400 border-l pl-4">
                      <div>Socket: {allRecentTrades.length} total</div>
                      <div>KOL: {kolRealtimeTrades.length} filtered</div>
                      <div>Loading: {isLoadingInitialData ? 'Yes' : 'No'}</div>
                      <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
                      <button
                        onClick={() => {
                          void 0 && ('🧪 Test: Adding fake trade data');
                          const testTrade = {
                            id: `test-${Date.now()}`,
                            kolWallet: walletAddress,
                            signature: 'test-signature',
                            timestamp: new Date(),
                            tradeType: 'buy' as const,
                            tokenIn: 'SOL',
                            tokenOut: 'USDC',
                            amountIn: 1.5,
                            amountOut: 150,
                            mint: 'test-mint',
                            dexProgram: 'Test DEX',
                            fee: 0.01
                          };
                          setTradeHistory([testTrade]);
                        }}
                        className="mt-1 px-2 py-1 bg-blue-500 text-white text-xs rounded"
                      >
                        Test UI
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trade History */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Token
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Value (SOL)
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Share
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredTrades.map((trade, index) => (
                      <tr
                        key={`${trade.id}-${index}`}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatTimestamp(trade.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${trade.tradeType === 'buy'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}
                          >
                            {trade.tradeType.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-mono">
                          {trade.tokenOut || trade.tokenIn || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                          {formatCurrency(
                            trade.amountOut || trade.amountIn || 0
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                          {formatCurrency(trade.amountIn || 0, 4)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <MindShareWidget trade={trade} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Load More */}
              {hasMoreTrades && tradeFilters.dateRange !== 'live' && (
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleLoadMoreTrades}
                    disabled={isLoading('tradeHistory')}
                    className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isLoading('tradeHistory')
                      ? 'Loading...'
                      : 'Load More Trades'}
                  </button>
                </div>
              )}

              {/* Empty State */}
              {filteredTrades.length === 0 && !isLoading('tradeHistory') && (
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
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    {tradeFilters.dateRange === 'live' ? 'No live trades yet' : 'No trades found'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {tradeFilters.dateRange === 'live'
                      ? 'This KOL hasn\'t made any trades recently. Live trades will appear here when they occur.'
                      : 'No trades match the current filters.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Trade Summary
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Total Trades:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {analytics.totalTrades}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Buy Trades:
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {analytics.buyTrades}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Sell Trades:
                    </span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {analytics.sellTrades}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Volume Analysis
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Total Volume:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(analytics.totalVolume)} SOL
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Avg Trade Size:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(analytics.avgTradeSize)} SOL
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Unique Tokens:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {analytics.uniqueTokens}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Time Range
                </h4>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {analytics.timeRange?.toUpperCase() || 'N/A'}
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                  Current filter range
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
