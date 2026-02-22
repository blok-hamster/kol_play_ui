'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import { TradingService } from '@/services/trading.service';
import { useSubscriptions, useLoading, useNotifications, useKOLStore } from '@/stores';
import { useLiveTradesUpdates } from '@/hooks';
import { useKOLTradeSocket } from '@/hooks/use-kol-trade-socket';
import { APP_CONFIG } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingUp,
  Users,
  Star,
  Copy,
  ExternalLink,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Search,
  SortAsc,
  SortDesc,
  Eye,
  Activity,
  Brain,
  Target,
  Twitter as TwitterIcon,
  Send as TelegramIcon,
  MessageCircle as DiscordIcon,
  Circle as CircleIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import KOLTradesModal from './kol-trades-modal';
import type { SearchFilters, KOLTrade, KOLWallet } from '@/types';

interface KOLListProps {
  className?: string;
  limit?: number;
  showHeader?: boolean;
  compactMode?: boolean;
  viewMode?: 'grid' | 'list';
}

interface KOLListFilters extends SearchFilters {
  sortBy?: 'subscriberCount' | 'totalTrades' | 'totalPnL' | 'winRate';
}

// Add interface for KOL with recent trades
interface KOLWithTrades extends KOLWallet {
  recentTrades?: KOLTrade[];
  tradesLoading?: boolean;
}

// Helper: extract Twitter/X username from URL and build an avatar URL via Unavatar
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

    // Strip possible trailing ".json" or other artifacts
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

function findTwitterUrlFromKOL(kol: KOLWallet): string | undefined {
  // Prefer explicit social link, otherwise parse any Twitter/X URL from description.
  return kol.socialLinks?.twitter || findTwitterUrlFromText(kol.description);
}

export default function KOLList({
  className = '',
  limit,
  showHeader = true,
  compactMode = false,
  viewMode = 'grid',
}: KOLListProps) {
  void 0 && ('🚀 KOLList component initialized');

  const router = useRouter();
  const { isSubscribedToKOL, subscriptions } = useSubscriptions();
  const { isLoading, setLoading } = useLoading();
  const { showError } = useNotifications();

  // Add real-time trade data
  const { recentTrades: allRecentTrades, isConnected: isTradeSocketConnected } = useKOLTradeSocket();
  const { setKOLs } = useKOLStore();

  void 0 && ('🔍 KOLList state:', {
    allRecentTradesCount: allRecentTrades.length,
    isTradeSocketConnected,
    limit,
    showHeader
  });

  // State
  const [kolWallets, setKolWallets] = useState<KOLWithTrades[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<KOLListFilters>({
    page: 1,
    limit: limit || APP_CONFIG.DEFAULT_PAGE_SIZE,
    sortBy: 'subscriberCount',
    sortOrder: 'desc',
  });
  const [hasMore, setHasMore] = useState(false);

  // Modal state - store the selected KOL object
  const [selectedKOL, setSelectedKOL] = useState<KOLWithTrades | null>(null);
  const [isKOLTradesModalOpen, setIsKOLTradesModalOpen] = useState(false);

  // Track if we've already loaded initial data
  const hasLoadedInitialData = useRef(false);
  const isCurrentlyFetching = useRef(false);

  // Stable references to prevent unnecessary re-renders
  const stableShowError = useCallback((title: string, message: string) => {
    showError(title, message);
  }, [showError]);

  const stableSetLoading = useCallback((key: string, loading: boolean) => {
    setLoading(key, loading);
  }, [setLoading]);

  // Fetch data on mount and filter changes
  useEffect(() => {
    // Prevent multiple simultaneous calls
    if (isCurrentlyFetching.current || isLoading('kolList')) {
      return;
    }

    // Check if authentication is in progress and skip fetch
    const checkAuthAndFetch = async () => {
      try {
        const { requestManager } = await import('@/lib/request-manager');
        if (requestManager.shouldBlockRequest()) {
          console.log('🚫 KOL List - Effect skipped during authentication');
          return;
        }
      } catch (error) {
        console.error('Failed to check auth state:', error);
      }

      // Only fetch on initial load, page change, search change, or limit change
      // Don't fetch for sort changes (handled client-side)
      const shouldFetch = !hasLoadedInitialData.current ||
        (filters.page && filters.page > 1) ||
        searchQuery !== '';

      if (!shouldFetch) {
        return;
      }

      const fetchKOLWallets = async () => {
        isCurrentlyFetching.current = true;

        try {
          stableSetLoading('kolList', true);

          // Check if requests should be blocked due to authentication
          const { requestManager } = await import('@/lib/request-manager');
          if (requestManager.shouldBlockRequest()) {
            console.log('🚫 KOL List - Fetch blocked during authentication');
            return;
          }

          // Build search filters - only include what's necessary
          const searchFilters: Partial<SearchFilters> = {};

          if (filters.page) {
            searchFilters.page = filters.page;
          }

          if (filters.limit) {
            searchFilters.limit = filters.limit;
          }

          if (searchQuery.trim()) {
            searchFilters.query = searchQuery.trim();
          }

          // Use authenticated request wrapper
          const { authenticatedRequest } = await import('@/lib/request-manager');
          const response = await authenticatedRequest(
            () => TradingService.getKOLWallets(searchFilters as SearchFilters),
            { priority: 'medium', timeout: 15000 }
          );

          let newKOLs: KOLWithTrades[];
          if (filters.page === 1) {
            newKOLs = response.data.map(kol => {
              const twitterUrl = findTwitterUrlFromKOL(kol);
              const twitterAvatar = getTwitterAvatarUrl(
                twitterUrl,
                kol.name || kol.walletAddress || 'KOL'
              );
              const preferredAvatar = twitterAvatar ?? kol.avatar;
              return {
                ...kol,
                ...(preferredAvatar ? { avatar: preferredAvatar } as Partial<KOLWithTrades> : {}),
                recentTrades: [],
                tradesLoading: false,
              } as KOLWithTrades;
            });

            // Prime store with fetched KOLs (use original response to preserve exact shape)
            try { setKOLs(response.data); } catch { }

            setKolWallets(newKOLs);
          } else {
            newKOLs = response.data.map(kol => {
              const twitterUrl = findTwitterUrlFromKOL(kol);
              const twitterAvatar = getTwitterAvatarUrl(
                twitterUrl,
                kol.name || kol.walletAddress || 'KOL'
              );
              const preferredAvatar = twitterAvatar ?? kol.avatar;
              return {
                ...kol,
                ...(preferredAvatar ? { avatar: preferredAvatar } as Partial<KOLWithTrades> : {}),
                recentTrades: [],
                tradesLoading: false,
              } as KOLWithTrades;
            });
            try { setKOLs(response.data); } catch { }
            setKolWallets(prev => [...prev, ...newKOLs]);
          }

          setHasMore(response.data.length === filters.limit);
          hasLoadedInitialData.current = true;
        } catch (error: any) {
          const errorMessage = error.message || 'Failed to load KOL wallets';
          stableShowError('Load Error', errorMessage);

          // Suppress console error for offline/network issues to prevent spam
          const isNetworkError =
            errorMessage.includes('Unable to connect') ||
            errorMessage.includes('Network Error') ||
            errorMessage.includes('ERR_CONNECTION_REFUSED') ||
            error.code === 'ERR_NETWORK';

          if (!isNetworkError) {
            console.error('Failed to fetch KOL wallets:', error);
          }
        } finally {
          stableSetLoading('kolList', false);
          isCurrentlyFetching.current = false;
        }
      };

      fetchKOLWallets();
    };

    checkAuthAndFetch();
  }, [
    filters.page,
    filters.limit,
    searchQuery,
    stableSetLoading,
    stableShowError,
    isLoading,
    setKOLs
  ]);

  // Separate effect for sorting existing KOLs when subscription status might change
  const sortedKolWallets = useMemo(() => {
    const sorted = [...kolWallets];

    // Sort KOLs: subscribed first, then by selected criteria
    sorted.sort((a, b) => {
      const aIsSubscribed = isSubscribedToKOL(a.walletAddress || '');
      const bIsSubscribed = isSubscribedToKOL(b.walletAddress || '');

      // If subscription status is different, prioritize subscribed
      if (aIsSubscribed !== bIsSubscribed) {
        return bIsSubscribed ? 1 : -1;
      }

      // If both have same subscription status, sort by selected criteria
      const sortBy = filters.sortBy || 'subscriberCount';
      const sortOrder = filters.sortOrder || 'desc';

      let aValue: number = 0;
      let bValue: number = 0;

      switch (sortBy) {
        case 'subscriberCount':
          aValue = a.subscriberCount || 0;
          bValue = b.subscriberCount || 0;
          break;
        case 'totalTrades':
          aValue = a.totalTrades || 0;
          bValue = b.totalTrades || 0;
          break;
        case 'totalPnL':
          aValue = a.totalPnL || 0;
          bValue = b.totalPnL || 0;
          break;
        case 'winRate':
          aValue = a.winRate || 0;
          bValue = b.winRate || 0;
          break;
        default:
          aValue = a.subscriberCount || 0;
          bValue = b.subscriberCount || 0;
      }

      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });

    return sorted;
  }, [kolWallets, filters.sortBy, filters.sortOrder, isSubscribedToKOL]);

  // Real-time updates for live trades
  useLiveTradesUpdates({
    throttle: 1000,
  });

  // Handle KOL click
  const handleKOLClick = useCallback((kol: KOLWithTrades) => {
    setSelectedKOL(kol);
    setIsKOLTradesModalOpen(true);
  }, []);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setFilters(prev => ({ ...prev, page: 1 }));
  }, []);

  // Handle sort
  const handleSort = useCallback((sortBy: KOLListFilters['sortBy']) => {
    setFilters(prev => ({
      ...prev,
      sortBy: sortBy || 'subscriberCount',
      sortOrder:
        prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));
  }, []);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (!isLoading('kolList') && hasMore) {
      setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }));
    }
  }, [isLoading, hasMore]);

  // Function to get recent trades for a specific KOL
  const getKOLRecentTrades = useCallback((kolWallet: string) => {
    const filtered = allRecentTrades
      .filter(trade => trade.kolWallet?.toLowerCase() === kolWallet.toLowerCase())
      .slice(0, 3); // Show last 3 trades

    // Debug logging for recent trades
    void 0 && (`🔍 KOL List - Recent trades for ${kolWallet}:`, {
      totalTrades: allRecentTrades.length,
      filteredTrades: filtered.length,
      trades: filtered.map(trade => {
        // Get prediction from either top-level or nested in tradeData
        const prediction = trade.prediction || (trade.tradeData as any)?.prediction;
        const isBuyTrade = (trade.tradeData?.tradeType ?? 'sell') === 'buy';
        const shouldShowPrediction = prediction && isBuyTrade;
        return {
          id: trade.id,
          kolWallet: trade.kolWallet,
          tradeType: trade.tradeData?.tradeType,
          dexProgram: trade.tradeData?.dexProgram, // Add dexProgram info
          rawAmountIn: trade.tradeData?.amountIn,
          rawAmountOut: trade.tradeData?.amountOut,
          displayedSOLAmount: (() => {
            const isBuy = (trade.tradeData?.tradeType ?? 'sell') === 'buy';
            return isBuy ? trade.tradeData?.amountOut : trade.tradeData?.amountIn;
          })(),
          topLevelPrediction: trade.prediction,
          nestedPrediction: (trade.tradeData as any)?.prediction,
          extractedPrediction: prediction,
          isBuyTrade: isBuyTrade,
          shouldShowPrediction: shouldShowPrediction,
          hasPrediction: !!prediction,
          predictionDetails: prediction ? {
            classLabel: prediction.classLabel,
            probability: prediction.probability,
            probabilityPercentage: (prediction.probability * 100).toFixed(1) + '%'
          } : 'No prediction'
        };
      })
    });

    return filtered;
  }, [allRecentTrades]);

  // Render KOL card
  const renderKOLCard = useCallback(
    (kol: KOLWithTrades) => {
      const isSubscribed = isSubscribedToKOL(kol.walletAddress || '');
      // Find subscription to get custom label
      const subscription = subscriptions.find(s => s.kolWallet === kol.walletAddress);

      const recentTrades = kol.walletAddress ? getKOLRecentTrades(kol.walletAddress) : [];
      const twitterUrl = findTwitterUrlFromKOL(kol);

      return (
        <div
          key={kol.walletAddress || `kol-${Math.random()}`}
          className={`bg-background border rounded-xl p-3 sm:p-4 hover:border-muted-foreground transition-all duration-200 cursor-pointer group ${isSubscribed
            ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
            : 'border-border'
            }`}
          onClick={() => kol.walletAddress && handleKOLClick(kol)}
        >
          {/* Subscribed badge */}
          {isSubscribed && (
            <div className="mb-2 sm:mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 px-2 sm:px-3 py-0.5 sm:py-1 bg-primary/10 rounded-full">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-[10px] sm:text-xs font-medium text-primary">Subscribed</span>
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">
                  Priority KOL
                </div>
              </div>
            </div>
          )}

          {/* Main content row */}
          <div className="flex items-center justify-between mb-3">
            {/* Left section - KOL info */}
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* KOL Avatar */}
              {kol.avatar ? (
                <img
                  src={kol.avatar}
                  alt={subscription?.label || kol.name || 'KOL Avatar'}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0 border-2 ${isSubscribed ? 'border-primary' : 'border-muted'
                    }`}
                />
              ) : (
                <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0 border-2 ${isSubscribed ? 'border-primary' : 'border-muted'
                  }`}>
                  <span className="text-primary-foreground font-bold text-xs sm:text-sm">
                    {(
                      (subscription?.label && subscription.label !== kol.walletAddress)
                        ? subscription.label.slice(0, 2)
                        : (kol.name || (kol.walletAddress ? kol.walletAddress.slice(0, 2) : 'KO'))
                    ).toUpperCase()}
                  </span>
                </div>
              )}

              {/* KOL Name & Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2 mb-0.5 sm:mb-1">
                  <h3 className="font-bold text-foreground text-base sm:text-lg truncate">
                    {(subscription?.label && subscription.label !== kol.walletAddress)
                      ? subscription.label
                      : (kol.name || (kol.walletAddress ? `${kol.walletAddress.slice(0, 6)}...${kol.walletAddress.slice(-4)}` : 'Unknown KOL'))
                    }
                  </h3>
                  {isSubscribed && (
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-2 sm:w-2.5 h-2 sm:h-2.5 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                  {/* Real-time indicator */}
                  {isTradeSocketConnected && recentTrades.length > 0 && (
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse" title="Live trades available" />
                  )}
                </div>
                <div className="flex items-center space-x-3 text-[10px] sm:text-sm text-muted-foreground">
                  <span className="font-mono">
                    {kol.walletAddress
                      ? (
                        <>
                          <span className="sm:hidden">{`${kol.walletAddress.slice(0, 4)}...${kol.walletAddress.slice(-4)}`}</span>
                          <span className="hidden sm:inline">{`${kol.walletAddress.slice(0, 8)}...${kol.walletAddress.slice(-8)}`}</span>
                        </>
                      )
                      : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right section - Click indicator */}
            <div className="flex items-center space-x-1 sm:space-x-2">
              <div className="text-[10px] sm:text-sm text-muted-foreground flex items-center space-x-1">
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">View Details</span>
              </div>
            </div>
          </div>

          {/* Recent Trades Section - hide in list view */}
          {viewMode !== 'list' && recentTrades.length > 0 && (
            <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-muted/20 rounded-lg">
              <div className="flex items-center justify-between mb-1.5 sm:mb-2 text-[10px] sm:text-xs">
                <h4 className="font-medium text-muted-foreground flex items-center space-x-1">
                  <Activity className="w-3 h-3" />
                  <span>Recent Live Trades</span>
                </h4>
                <div className="flex items-center space-x-1 text-green-600">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span>Live</span>
                </div>
              </div>
              <div className="space-y-1 sm:space-y-2">
                {recentTrades.map((trade, idx) => (
                  <div key={`${trade.id}-${idx}`} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs">
                      <div className="flex items-center space-x-1.5 sm:space-x-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${(trade.tradeData?.tradeType ?? 'sell') === 'buy' ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                        {/* Token pill: image + symbol/name fallback to mint */}
                        {(trade.tradeData?.symbol || trade.tradeData?.name || trade.tradeData?.image || trade.tradeData?.mint) && (
                          <div className="flex items-center space-x-1">
                            {trade.tradeData?.image && (
                              <img src={trade.tradeData.image} alt={trade.tradeData.symbol || trade.tradeData.name || 'Token'} className="w-3 sm:w-3.5 h-3 sm:h-3.5 rounded" />
                            )}
                            <span className="font-medium truncate max-w-[80px] sm:max-w-none">
                              {(() => {
                                const name = trade.tradeData?.name?.trim();
                                const symbol = trade.tradeData?.symbol?.trim();
                                if (name && symbol) return symbol; // Simplified for mobile
                                if (name) return name;
                                if (symbol) return symbol;
                                return trade.tradeData?.mint ? `${trade.tradeData.mint.slice(0, 4)}...` : 'Token';
                              })()}
                            </span>
                          </div>
                        )}
                        <span className="text-muted-foreground">
                          {(trade.tradeData?.tradeType ?? 'sell').toUpperCase()}
                        </span>
                        <span className="font-medium">
                          {(() => {
                            const isBuy = (trade.tradeData?.tradeType ?? 'sell') === 'buy';
                            if (isBuy) {
                              // For buy: show SOL spent
                              return `${trade.tradeData?.amountOut?.toFixed(1) || '0.0'} SOL`;
                            } else {
                              // For sell: show SOL received
                              return `${trade.tradeData?.amountIn?.toFixed(1) || '0.0'} SOL`;
                            }
                          })()}
                        </span>
                      </div>
                      <span className="text-muted-foreground hidden xs:inline">
                        {trade.timestamp ?
                          new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                          'Now'
                        }
                      </span>
                    </div>
                    {/* ML Prediction for each trade - only for buy trades (with skeleton for consistent spacing) */}
                    {(() => {
                      const prediction = trade.prediction || (trade.tradeData as any)?.prediction;
                      const isBuyTrade = (trade.tradeData?.tradeType ?? 'sell') === 'buy';
                      const shouldShowPrediction = prediction && isBuyTrade;

                      return shouldShowPrediction ? (
                        <div className="flex items-center justify-between text-[10px] sm:text-xs bg-purple-50 dark:bg-purple-900/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                          <div className="flex items-center space-x-1">
                            <Brain className="w-2.5 h-2.5 text-purple-500" />
                            <span className="text-purple-700 dark:text-purple-300 font-medium">
                              {prediction.classLabel}
                            </span>
                          </div>
                          <span className="font-medium text-purple-600 dark:text-purple-400">
                            {(prediction.probability * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        // Skeleton placeholder for consistent spacing (for sell trades)
                        <div className="flex items-center justify-between text-[10px] sm:text-xs bg-muted/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded opacity-50">
                          <div className="flex items-center space-x-1">
                            <div className="w-2.5 h-2.5 bg-muted/40 rounded animate-pulse" />
                            <div className="w-12 h-2.5 bg-muted/40 rounded animate-pulse" />
                          </div>
                          <div className="w-6 h-2.5 bg-muted/40 rounded animate-pulse" />
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center justify-between mt-auto">
            {/* Left stats */}
            <div className="flex items-center">
              <div className="flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-muted rounded text-[10px] sm:text-xs">
                {isTradeSocketConnected && recentTrades.length > 0 ? (
                  <Activity className="w-3 h-3 text-green-500" />
                ) : (
                  <CircleIcon className="w-3 h-3 text-blue-500" />
                )}
                <span className="text-muted-foreground">
                  {isTradeSocketConnected && recentTrades.length > 0 ? 'Live' : 'Active'}
                </span>
              </div>
            </div>

            {/* Right stats - Social links */}
            <div className="flex items-center space-x-2 text-muted-foreground">
              {kol.socialLinks?.twitter && (
                <a
                  href={kol.socialLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 transition-colors"
                  onClick={e => e.stopPropagation()}
                  aria-label="Twitter profile"
                >
                  <TwitterIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </a>
              )}
              {kol.socialLinks?.telegram && (
                <a
                  href={kol.socialLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 transition-colors"
                  onClick={e => e.stopPropagation()}
                  aria-label="Telegram profile"
                >
                  <TelegramIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </a>
              )}
              {kol.socialLinks?.discord && (
                <a
                  href={kol.socialLinks.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-500 hover:text-indigo-600 transition-colors"
                  onClick={e => e.stopPropagation()}
                  aria-label="Discord profile"
                >
                  <DiscordIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </a>
              )}
              {!kol.socialLinks?.twitter && twitterUrl && (
                <a
                  href={twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 transition-colors"
                  onClick={e => e.stopPropagation()}
                  aria-label="Twitter profile"
                >
                  <TwitterIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      );
    },
    [isSubscribedToKOL, handleKOLClick, compactMode, isTradeSocketConnected, getKOLRecentTrades, viewMode]
  );

  // Render loading state
  if (isLoading('kolList') && kolWallets.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        {showHeader && (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">KOL Wallets</h2>
          </div>
        )}
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">
            Loading KOL wallets...
          </span>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!isLoading('kolList') && kolWallets.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        {showHeader && (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">KOL Wallets</h2>
          </div>
        )}
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No KOL wallets found matching your criteria.
          </p>
          <button
            onClick={() => {
              // Reset filters and reload
              setSearchQuery('');
              setFilters(prev => ({ ...prev, page: 1 }));
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Reset Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              KOL Wallets
            </h2>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span>Subscribed KOLs shown first</span>
              </div>
              <span>•</span>
              <span>{sortedKolWallets.filter(kol => isSubscribedToKOL(kol.walletAddress || '')).length} subscribed</span>
              <span>•</span>
              <span>{sortedKolWallets.length} total</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search KOLs..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="
                  pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  placeholder-gray-500 dark:placeholder-gray-400
                  w-64
                "
              />
            </div>

            {/* Sort */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <button
                onClick={() => handleSort('subscriberCount')}
                className={`
                  flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors
                  ${filters.sortBy === 'subscriberCount'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                <span className="text-sm font-medium">Subscribers</span>
                {filters.sortBy === 'subscriberCount' &&
                  (filters.sortOrder === 'desc' ? (
                    <SortDesc className="w-4 h-4" />
                  ) : (
                    <SortAsc className="w-4 h-4" />
                  ))}
              </button>

              <button
                onClick={() => handleSort('totalPnL')}
                className={`
                  flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors
                  ${filters.sortBy === 'totalPnL'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                <span className="text-sm font-medium">PnL</span>
                {filters.sortBy === 'totalPnL' &&
                  (filters.sortOrder === 'desc' ? (
                    <SortDesc className="w-4 h-4" />
                  ) : (
                    <SortAsc className="w-4 h-4" />
                  ))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KOL Grid/List */}
      <div className={viewMode === 'list' ? 'space-y-2' : 'grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}>
        {sortedKolWallets.map(renderKOLCard)}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-6">
          <button
            onClick={handleLoadMore}
            disabled={isLoading('kolList')}
            className="flex items-center space-x-2 px-6 py-3 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {isLoading('kolList') && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            <span>{isLoading('kolList') ? 'Loading...' : 'Load More'}</span>
          </button>
        </div>
      )}

      {/* KOL Trades Modal */}
      {selectedKOL && (
        <KOLTradesModal
          kol={selectedKOL}
          walletAddress={selectedKOL.walletAddress}
          isOpen={isKOLTradesModalOpen}
          onClose={() => setIsKOLTradesModalOpen(false)}
        />
      )}
    </div>
  );
}
