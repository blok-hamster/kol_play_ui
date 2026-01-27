'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Users, TrendingUp, DollarSign, Clock, Loader2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TokenService } from '@/services/token.service';
import SolanaService from '@/services/solana.service';
import { useTokenStore } from '@/stores/use-token-store';
import { useLoading } from '@/stores/use-ui-store';
import { useNotifications } from '@/stores/use-ui-store';
import { formatNumber, formatRelativeTime, cn } from '@/lib/utils';
import { executeInstantBuy, checkTradeConfig } from '@/lib/trade-utils';
import TokenDetailModal from './token-detail-modal';
import TradeConfigPrompt from '@/components/ui/trade-config-prompt';
import { usePumpPortalStream, type PumpPortalNewToken } from '@/hooks';
import type { TokenFilters } from '@/types';
type DiscoveryItem = {
  token: {
    name: string;
    symbol: string;
    mint: string;
    uri?: string;
    decimals: number;
    hasFileMetaData?: boolean;
    image?: string;
    createdOn?: string;
    twitter?: string;
    website?: string;
    strictSocials?: Record<string, string>;
    creation?: { creator: string; created_tx: string; created_time: number };
  };
  pools: Array<{
    poolId?: string;
    liquidity?: { quote?: number; usd?: number };
    price?: { quote?: number; usd?: number };
    tokenSupply?: number;
    lpBurn?: number;
    tokenAddress?: string;
    marketCap?: { quote?: number; usd?: number };
    market?: string;
    quoteToken?: string;
    decimals?: number;
    security?: { freezeAuthority?: string | null; mintAuthority?: string | null };
    lastUpdated?: number;
    createdAt?: number;
    deployer?: string | null;
    txns?: { buys?: number; sells?: number; total?: number; volume?: number; volume24h?: number };
  }>;
  events?: Record<string, { priceChangePercentage: number | null }>;
  risk?: any;
  buysCount?: number;
  sellsCount?: number;
  buys?: number;
  sells?: number;
  txns?: number;
  holders?: number;
};

interface TokenListProps {
  category: 'trending' | 'volume' | 'latest';
  title: string;
  description?: string;
  className?: string;
  limit?: number;
  showFilters?: boolean;
  timeframe?: '5m' | '15m' | '30m' | '1h' | '6h' | '12h' | '24h' | '7d' | '30d';
}

interface TokenListFilters extends TokenFilters {
  sortBy?:
  | 'marketCap'
  | 'volume'
  | 'price'
  | 'liquidity'
  | 'name'
  | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  timeframe?: '5m' | '15m' | '30m' | '1h' | '6h' | '12h' | '24h' | '7d' | '30d';
}

const TokenList: React.FC<TokenListProps> = ({
  category,
  title,
  description,
  className = '',
  limit = 50,
  showFilters = true,
  timeframe = '24h',
}) => {
  const router = useRouter();
  const { isLoading, setLoading } = useLoading();
  const { showError, showSuccess } = useNotifications();
  const { cacheTokens } = useTokenStore();

  // Component state
  const [tokens, setTokens] = useState<DiscoveryItem[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<any | null>(null);

  // Trade config prompt state
  const [showTradeConfigPrompt, setShowTradeConfigPrompt] = useState(false);
  const [pendingBuyToken, setPendingBuyToken] = useState<DiscoveryItem | null>(null);

  // Instant buy loading state
  const [buyingTokens, setBuyingTokens] = useState<Set<string>>(new Set());

  // Real-time streaming state
  const [isLiveEnabled, setIsLiveEnabled] = useState(category === 'latest');
  const [newTokensCount, setNewTokensCount] = useState(0);
  const maxTokensRef = useRef(200); // Limit tokens to prevent memory issues

  // PumpPortal WebSocket hook (only for latest category)
  const pumpPortal = usePumpPortalStream({
    autoConnect: category === 'latest' && isLiveEnabled,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
  });

  // Filter state
  const [filters, setFilters] = useState<TokenListFilters>({
    page: 1,
    limit: limit,
    sortBy:
      category === 'trending'
        ? 'marketCap'
        : category === 'volume'
          ? 'volume'
          : 'createdAt',
    sortOrder: 'desc',
    timeframe: timeframe,
  });

  // Fetch tokens based on category
  const fetchTokens = useCallback(
    async (newFilters?: Partial<TokenListFilters>) => {
      const currentFilters = { ...filters, ...newFilters };

      try {
        setLoading(`tokens-${category}`, true);

        let response;
        const requestFilters: any = {
          page: currentFilters.page || 1,
          limit: currentFilters.limit || limit,
          timeframe: currentFilters.timeframe || timeframe,
        };

        // Add optional properties only if they have values
        if (currentFilters.sortBy)
          requestFilters.sortBy = currentFilters.sortBy;
        if (currentFilters.sortOrder)
          requestFilters.sortOrder = currentFilters.sortOrder;

        void 0 && (
          `🔍 TokenList: Fetching ${category} tokens with filters:`,
          requestFilters
        );

        switch (category) {
          case 'trending':
            void 0 && ('📈 Calling SolanaService.getTrendingTokens');
            response = { data: await SolanaService.getTrendingTokens() };
            break;
          case 'volume':
            void 0 && ('📊 Calling SolanaService.getHighVolumeTokens');
            response = { data: await SolanaService.getHighVolumeTokens() };
            break;
          case 'latest':
            void 0 && ('🆕 Calling SolanaService.getNewTokens');
            response = { data: await SolanaService.getNewTokens() };
            break;
          default:
            throw new Error('Invalid token category');
        }

        void 0 && (`✅ ${category} tokens response:`, response);

        // Normalize to DiscoveryItem[] regardless of backend shape
        const normalize = (arr: any[]): DiscoveryItem[] => {
          return arr.map((it: any) => {
            if (it && typeof it === 'object' && 'token' in it && it.token && it.pools) {
              // Already in nested discovery shape
              return it as DiscoveryItem;
            }
            // Fallback: transform flattened SearchTokenResult into DiscoveryItem
            const token = {
              name: it.name || it.symbol || 'Unknown',
              symbol: it.symbol || 'N/A',
              mint: it.mint,
              uri: it.uri,
              decimals: typeof it.decimals === 'number' ? it.decimals : 6,
              hasFileMetaData: Boolean(it.hasFileMetaData),
              image: it.logoURI || it.image,
              createdOn: it.createdOn,
              twitter: it.twitter,
              website: it.website,
              strictSocials: it.strictSocials,
              creation: it.creation,
            };
            const pool = {
              poolId: it.poolId,
              liquidity: { usd: it.liquidityUsd },
              price: { usd: it.priceUsd },
              tokenSupply: it.totalSupply,
              lpBurn: it.lpBurn,
              tokenAddress: it.mint,
              marketCap: { usd: it.marketCapUsd },
              market: it.market,
              quoteToken: it.quoteToken,
              decimals: typeof it.decimals === 'number' ? it.decimals : 6,
              security: { freezeAuthority: null, mintAuthority: null },
              lastUpdated: it.lastUpdated,
              createdAt: it.createdAt,
              deployer: it.deployer,
              txns: { buys: it.buys, sells: it.sells, total: it.txns, volume: it.volume, volume24h: it.volume_24h },
            };
            const events: Record<string, { priceChangePercentage: number | null }> = it.events || {};
            const risk = it.risk || { jupiterVerified: it.verified || false };
            return {
              token,
              pools: [pool],
              events,
              risk,
              buysCount: it.buysCount,
              sellsCount: it.sellsCount,
              buys: it.buys,
              sells: it.sells,
              txns: it.txns,
              holders: it.holders,
            } as DiscoveryItem;
          });
        };

        const normalized: DiscoveryItem[] = normalize(response.data || []);

        if (currentFilters.page === 1) {
          setTokens(normalized);
          cacheTokens(normalized as any);
        } else {
          setTokens(prev => [...prev, ...normalized]);
          cacheTokens(normalized as any);
        }

        setHasMore(normalized.length === (currentFilters.limit || limit));
        setFilters(currentFilters);
      } catch (error: any) {
        showError(
          'Load Error',
          error.message || `Failed to load ${category} tokens`
        );
        console.error(`Failed to fetch ${category} tokens:`, error);
      } finally {
        setLoading(`tokens-${category}`, false);
      }
    },
    [category, filters, limit, timeframe, setLoading, showError, cacheTokens]
  );

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<TokenListFilters>) => {
      const updatedFilters = { ...filters, ...newFilters, page: 1 };
      // Remove undefined values
      Object.keys(updatedFilters).forEach(key => {
        if (updatedFilters[key as keyof TokenListFilters] === undefined) {
          delete updatedFilters[key as keyof TokenListFilters];
        }
      });
      fetchTokens(updatedFilters);
    },
    [filters, fetchTokens]
  );

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (!isLoading(`tokens-${category}`) && hasMore && filters.page) {
      const nextPage = filters.page + 1;
      fetchTokens({ page: nextPage });
    }
  }, [category, filters.page, hasMore, isLoading, fetchTokens]);

  // Handle token click
  const handleTokenClick = useCallback((item: DiscoveryItem) => {
    const tokenDetailData = {
      token: item.token,
      pools: item.pools || [],
      events: item.events || {},
      risk: item.risk || { snipers: { count: 0 }, insiders: { count: 0 }, rugged: false, risks: [], score: 0, jupiterVerified: false },
      buysCount: item.buysCount ?? item.buys ?? 0,
      sellsCount: item.sellsCount ?? item.sells ?? 0,
    } as any;
    setSelectedToken(tokenDetailData);
    setIsModalOpen(true);
  }, []);

  // Handle quick buy with instant trading
  const handleQuickBuy = useCallback(
    async (token: { mint: string; symbol?: string }, e: React.MouseEvent) => {
      e.stopPropagation();

      // Check if already buying this token
      if (buyingTokens.has(token.mint)) {
        return;
      }

      try {
        // First check if user has trade config
        const configCheck = await checkTradeConfig();

        if (!configCheck.hasConfig) {
          // Show trade config prompt
          setPendingBuyToken({ token: { mint: token.mint, symbol: token.symbol, name: token.symbol || 'Token', decimals: 6 }, pools: [] } as any);
          setShowTradeConfigPrompt(true);
          return;
        }

        // Add token to buying set
        setBuyingTokens(prev => new Set(prev).add(token.mint));

        // Execute instant buy
        const result = await executeInstantBuy(token.mint, token.symbol);

        if (result.success) {
          showSuccess(
            'Buy Order Executed',
            `Successfully bought ${token.symbol || 'token'} for ${configCheck.config?.tradeConfig?.minSpend || 'N/A'} SOL`
          );

          // Optional: Show transaction details
          if (result.result?.transactionId) {
            void 0 && ('Transaction ID:', result.result.transactionId);
          }
        } else {
          showError(
            'Buy Order Failed',
            result.error || 'Failed to execute buy order'
          );
        }
      } catch (error: any) {
        console.error('Buy order error:', error);
        showError(
          'Buy Order Error',
          error.message || 'An unexpected error occurred'
        );
      } finally {
        // Remove token from buying set
        setBuyingTokens(prev => {
          const newSet = new Set(prev);
          newSet.delete(token.mint);
          return newSet;
        });
      }
    },
    [buyingTokens, showError, showSuccess]
  );

  // Handle trade config prompt close
  const handleTradeConfigPromptClose = useCallback(() => {
    setShowTradeConfigPrompt(false);
    setPendingBuyToken(null);
  }, []);

  // Get timeframe display text
  const getTimeframeText = useCallback((timeframe: string) => {
    const timeframes: Record<string, string> = {
      '5m': '5 min',
      '15m': '15 min',
      '30m': '30 min',
      '1h': '1 hour',
      '6h': '6 hours',
      '12h': '12 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };
    return timeframes[timeframe] || timeframe;
  }, []);

  // Get category icon
  const getCategoryIcon = useCallback(() => {
    switch (category) {
      case 'trending':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'volume':
        return <DollarSign className="w-5 h-5 text-blue-500" />;
      case 'latest':
        return <Clock className="w-5 h-5 text-purple-500" />;
      default:
        return null;
    }
  }, [category]);

  // Use tokens directly since we removed local filtering
  const filteredTokens = useMemo(() => tokens, [tokens]);

  // Reset tokens and filters when category changes
  useEffect(() => {
    // Reset tokens to prevent showing stale data
    setTokens([]);

    // Reset filters to category-appropriate defaults
    const newFilters: TokenListFilters = {
      page: 1,
      limit: limit,
      sortBy:
        category === 'trending'
          ? 'marketCap'
          : category === 'volume'
            ? 'volume'
            : 'createdAt',
      sortOrder: 'desc',
      timeframe: timeframe,
    };

    setFilters(newFilters);
    setHasMore(true);

    // Initial fetch on mount or category change
  }, [category, limit, timeframe]);

  // Initial fetch on mount or category change
  useEffect(() => {
    fetchTokens({ page: 1 });
  }, [category, timeframe]);

  // Subscribe to real-time new tokens (only for 'latest' category)
  useEffect(() => {
    if (category !== 'latest' || !isLiveEnabled || !pumpPortal.isConnected) {
      return;
    }

    console.log('🔔 Subscribing to real-time new tokens...');

    const unsubscribe = pumpPortal.subscribeNewTokens((newToken: PumpPortalNewToken) => {
      console.log('🆕 New token received:', newToken);

      // Transform PumpPortal token to DiscoveryItem
      const token = {
        name: newToken.name,
        symbol: newToken.symbol,
        mint: newToken.mint,
        decimals: 6,
        ...(newToken.uri && { uri: newToken.uri }),
        ...(newToken.image && { image: newToken.image }),
        ...(newToken.twitter && { twitter: newToken.twitter }),
        ...(newToken.website && { website: newToken.website }),
        createdOn: new Date(newToken.created_timestamp || Date.now()).toISOString(),
      };

      const discoveryItem: DiscoveryItem = {
        token: token as any,
        pools: [],
        events: {},
        risk: { isPumpFun: true },
      };

      // Prepend to token list (limit to maxTokensRef)
      setTokens((prev) => {
        const updated = [discoveryItem, ...prev];
        if (updated.length > maxTokensRef.current) {
          return updated.slice(0, maxTokensRef.current);
        }
        return updated;
      });

      // Increment new tokens counter for UI indication
      setNewTokensCount((prev) => prev + 1);
    });

    return () => {
      console.log('🔕 Unsubscribing from new tokens');
      unsubscribe();
    };
  }, [category, isLiveEnabled, pumpPortal.isConnected, pumpPortal]);

  // Toggle live mode
  const toggleLiveMode = useCallback(() => {
    if (!isLiveEnabled && category === 'latest') {
      pumpPortal.connect();
      setNewTokensCount(0);
    } else if (isLiveEnabled) {
      pumpPortal.disconnect();
    }
    setIsLiveEnabled((prev) => !prev);
  }, [category, isLiveEnabled, pumpPortal]);

  // Re-fetch when fetchTokens function changes (but not on category change to avoid double fetch)
  useEffect(() => {
    // Only fetch if we have tokens (meaning category effect already ran)
    if (tokens.length === 0 && filters.page === 1) {
      return; // Let the category effect handle initial fetch
    }
    // This will handle cases where fetchTokens dependencies change but category stays the same
  }, [fetchTokens]);

  // Render token card
  const renderTokenCard = useCallback(
    (item: DiscoveryItem, index: number) => {
      const t = item.token;
      const primaryPool = item.pools && item.pools.length > 0 ? item.pools[0] : undefined;
      const isBuying = buyingTokens.has(t.mint);

      // New horizontal card design matching the uploaded image
      return (
        <div
          key={t.mint}
          className="bg-background border border-border rounded-xl p-4 hover:border-muted-foreground transition-all duration-200 cursor-pointer group"
          onClick={() => handleTokenClick(item)}
        >
          {/* Main content row */}
          <div className="flex items-center justify-between mb-3">
            {/* Left section - Token info */}
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* Token Logo */}
              {t.image ? (
                <img
                  src={t.image}
                  alt={t.symbol || t.name}
                  className="w-12 h-12 rounded-full flex-shrink-0 border-2 border-muted"
                  onError={e => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0 border-2 border-muted">
                  <span className="text-primary-foreground font-bold text-sm">
                    {(t.symbol || t.name || '?')
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                </div>
              )}

              {/* Token Name & Symbol */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-bold text-foreground text-lg truncate">
                    {t.symbol || t.name || 'Unknown'}
                  </h3>
                  {item.risk?.jupiterVerified && (
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-2.5 h-2.5 text-white"
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
                </div>
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <span>
                    {t.creation?.created_time
                      ? formatRelativeTime(new Date(t.creation.created_time * 1000))
                      : 'N/A'}
                  </span>
                  <span className="font-mono">
                    {t.mint
                      ? `${t.mint.slice(0, 4)}...${t.mint.slice(-4)}`
                      : 'Unknown'}
                  </span>
                  <div className="flex items-center space-x-1">
                    <Users className="w-3 h-3" />
                    <span>{item.holders || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right section - Buy button */}
            <Button
              size="sm"
              disabled={isBuying}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-2 rounded-lg font-medium flex items-center space-x-2 min-w-[80px]"
              onClick={e => handleQuickBuy({ mint: t.mint, symbol: t.symbol } as any, e)}
            >
              {isBuying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Buying...</span>
                </>
              ) : (
                <>
                  <span className="w-4 h-4 bg-green-400 rounded-full flex items-center justify-center">
                    <span className="text-green-900 font-bold text-xs">⚡</span>
                  </span>
                  <span>Buy</span>
                </>
              )}
            </Button>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between text-sm">
            {/* Left stats */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                <span className="text-muted-foreground">
                  {primaryPool?.price?.usd ? `${formatNumber(primaryPool.price.usd, 4)} USD` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center space-x-1 px-2 py-1 bg-muted rounded text-xs">
                <span className="text-muted-foreground">Buys</span>
                <span className="font-medium">{primaryPool?.txns?.buys ?? item.buys ?? 0}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span className="text-muted-foreground">
                  {primaryPool?.liquidity?.usd && primaryPool?.marketCap?.usd
                    ? `${formatNumber((primaryPool.liquidity.usd / primaryPool.marketCap.usd) * 100, 2)}%`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Right stats */}
            <div className="flex items-center space-x-4 text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Users className="w-3 h-3" />
                <span>{item.holders || 0}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-3 h-3 bg-accent-gradient rounded"></span>
                <span>{primaryPool?.price?.usd ? formatNumber(primaryPool.price.usd, 6) : 'N/A'}</span>
              </div>
              <div className="text-xs">
                TX {primaryPool?.txns?.total ?? item.txns ?? 0}
              </div>
            </div>
          </div>

          {/* Bottom stats row */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-muted-foreground">
                V ${formatNumber(primaryPool?.txns?.volume24h || 0, 0)}
              </span>
              <span className="text-muted-foreground">
                MC ${formatNumber(primaryPool?.marketCap?.usd || 0, 0)}
              </span>
            </div>
            {category === 'trending' && (
              <div className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded text-xs font-medium">
                #{index + 1}
              </div>
            )}
          </div>
        </div>
      );
    },
    [category, handleTokenClick, handleQuickBuy, buyingTokens]
  );

  const getTimeframeText = (tf: string): string => {
    const map: Record<string, string> = {
      '5m': '5 minutes',
      '15m': '15 minutes',
      '30m': '30 minutes',
      '1h': '1 hour',
      '6h': '6 hours',
      '12h': '12 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };
    return map[tf] || tf;
  };

  return (
    <div className={cn('space-y-6', className)}>
      filters.timeframe &&
      ` (${getTimeframeText(filters.timeframe)})`}
    </span>
    </div >

  <div>
    {category === 'trending' && <span>Updated every 5 minutes</span>}
    {category === 'volume' && <span>Real-time volume tracking</span>}
    {category === 'latest' && <span>Newest tokens on Solana</span>}
  </div>
  </div >

  {/* Loading State */ }
{
  isLoading(`tokens-${category}`) && tokens.length === 0 && (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-background rounded-lg border border-border p-6 animate-pulse"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-muted rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-muted rounded mb-2"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j}>
                <div className="h-3 bg-muted rounded mb-1"></div>
                <div className="h-4 bg-muted rounded"></div>
              </div>
            ))}
          </div>
          <div className="h-8 bg-muted rounded"></div>
        </div>
      ))}
    </div>
  )
}

{/* Token Grid */ }
{
  filteredTokens.length > 0 && (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {filteredTokens.map(renderTokenCard)}
    </div>
  )
}

{/* Load More */ }
{
  hasMore && filteredTokens.length > 0 && (
    <div className="flex justify-center">
      <Button
        onClick={handleLoadMore}
        disabled={isLoading(`tokens-${category}`)}
        className="px-6 py-3"
      >
        {isLoading(`tokens-${category}`) && (
          <svg
            className="animate-spin h-4 w-4 mr-2"
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
        {isLoading(`tokens-${category}`)
          ? 'Loading...'
          : 'Load More Tokens'}
      </Button>
    </div>
  )
}

{/* Empty State */ }
{
  filteredTokens.length === 0 && !isLoading(`tokens-${category}`) && (
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
        No tokens found
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Try adjusting your filters or check back later.
      </p>
    </div>
  )
}

{/* Token Detail Modal */ }
{
  selectedToken && (
    <TokenDetailModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      tokenData={selectedToken}
    />
  )
}

{/* Trade Config Prompt */ }
<TradeConfigPrompt
  isOpen={showTradeConfigPrompt}
  onClose={handleTradeConfigPromptClose}
  tokenSymbol={pendingBuyToken?.token?.symbol || pendingBuyToken?.token?.name}
/>
    </div >
  );
};

export default TokenList;
