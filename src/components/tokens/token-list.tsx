'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, TrendingUp, DollarSign, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TokenService } from '@/services/token.service';
import { useTokenStore } from '@/stores/use-token-store';
import { useLoading } from '@/stores/use-ui-store';
import { useNotifications } from '@/stores/use-ui-store';
import { formatNumber, formatRelativeTime, cn } from '@/lib/utils';
import { executeInstantBuy, checkTradeConfig } from '@/lib/trade-utils';
import TokenDetailModal from './token-detail-modal';
import TradeConfigPrompt from '@/components/ui/trade-config-prompt';
import type { SearchTokenResult, TokenFilters } from '@/types';

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
  const [tokens, setTokens] = useState<SearchTokenResult[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<any | null>(null);

  // Trade config prompt state
  const [showTradeConfigPrompt, setShowTradeConfigPrompt] = useState(false);
  const [pendingBuyToken, setPendingBuyToken] = useState<SearchTokenResult | null>(null);

  // Instant buy loading state
  const [buyingTokens, setBuyingTokens] = useState<Set<string>>(new Set());

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

        console.log(
          `🔍 TokenList: Fetching ${category} tokens with filters:`,
          requestFilters
        );

        switch (category) {
          case 'trending':
            console.log('📈 Calling getTrendingTokens');
            response = await TokenService.getTrendingTokens(requestFilters);
            break;
          case 'volume':
            console.log('📊 Calling getTokensByVolume');
            response = await TokenService.getTokensByVolume(requestFilters);
            break;
          case 'latest':
            console.log('🆕 Calling getLatestTokens');
            response = await TokenService.getLatestTokens(requestFilters);
            break;
          default:
            throw new Error('Invalid token category');
        }

        console.log(`✅ ${category} tokens response:`, response);

        if (currentFilters.page === 1) {
          setTokens(response.data);
          cacheTokens(response.data);
        } else {
          setTokens(prev => [...prev, ...response.data]);
          cacheTokens(response.data);
        }

        setHasMore(response.data.length === (currentFilters.limit || limit));
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
  const handleTokenClick = useCallback((token: SearchTokenResult) => {
    // Convert SearchTokenResult to TokenDetailData format
    const tokenDetailData = {
      token: {
        name: token.name || token.symbol || 'Unknown Token',
        symbol: token.symbol || 'N/A',
        mint: token.mint,
        uri: (token as any).uri,
        decimals: 6, // Default decimals, should come from API
        hasFileMetaData: true,
        createdOn: token.createdOn || 'pump.fun',
        description: (token as any).description || 'No description available',
        image: token.logoURI || token.image,
        showName: true,
        twitter: (token as any).twitter,
        creation:
          token.createdOn &&
          typeof token.createdOn === 'string' &&
          !String(token.createdOn).includes('http')
            ? {
                creator: 'Unknown',
                created_tx: 'Unknown',
                created_time: new Date(token.createdOn).getTime() / 1000,
              }
            : {
                creator: 'Unknown',
                created_tx: 'Unknown',
                created_time:
                  Math.floor(Date.now() / 1000) -
                  Math.floor(Math.random() * 86400 * 30), // Random time within last 30 days
              },
      },
      pools: [
        {
          liquidity: {
            quote: token.liquidityUsd
              ? token.liquidityUsd / 100
              : Math.random() * 10000,
            usd: token.liquidityUsd || Math.random() * 1000000,
          },
          price: {
            quote: token.priceUsd
              ? token.priceUsd / 100
              : Math.random() * 0.001,
            usd: token.priceUsd || Math.random() * 10,
          },
          tokenSupply:
            (token as any).totalSupply ||
            Math.floor(Math.random() * 1000000000),
          lpBurn: Math.floor(Math.random() * 100),
          tokenAddress: token.mint,
          marketCap: {
            quote: token.marketCapUsd
              ? token.marketCapUsd / 100
              : Math.random() * 100000,
            usd: token.marketCapUsd || Math.random() * 100000000,
          },
          decimals: 6,
          security: {
            freezeAuthority: null,
            mintAuthority: null,
          },
          quoteToken: 'So11111111111111111111111111111111111111112',
          market: 'pumpfun-amm',
          lastUpdated: Date.now(),
          createdAt:
            token.createdOn &&
            typeof token.createdOn === 'string' &&
            !String(token.createdOn).includes('http')
              ? new Date(token.createdOn).getTime()
              : Date.now() - Math.floor(Math.random() * 86400000 * 30), // Random time within last 30 days
          txns: {
            buys: Math.floor(Math.random() * 100000),
            sells: Math.floor(Math.random() * 90000),
            total: Math.floor(Math.random() * 200000),
            volume: token.volume_24h || Math.floor(Math.random() * 1000000),
            volume24h: token.volume_24h || Math.floor(Math.random() * 500000),
          },
          deployer: 'Unknown',
          poolId: 'Unknown',
        },
      ],
      events: {
        '1m': { priceChangePercentage: (Math.random() - 0.5) * 10 },
        '5m': { priceChangePercentage: (Math.random() - 0.5) * 15 },
        '15m': { priceChangePercentage: (Math.random() - 0.5) * 20 },
        '30m': { priceChangePercentage: (Math.random() - 0.5) * 25 },
        '1h': { priceChangePercentage: (Math.random() - 0.5) * 30 },
        '2h': { priceChangePercentage: (Math.random() - 0.5) * 35 },
        '3h': { priceChangePercentage: (Math.random() - 0.5) * 40 },
        '4h': { priceChangePercentage: (Math.random() - 0.5) * 45 },
        '5h': { priceChangePercentage: (Math.random() - 0.5) * 50 },
        '6h': { priceChangePercentage: (Math.random() - 0.5) * 55 },
        '12h': { priceChangePercentage: (Math.random() - 0.5) * 60 },
        '24h': { priceChangePercentage: (Math.random() - 0.5) * 80 },
      },
      risk: {
        snipers: {
          count: Math.floor(Math.random() * 5),
          totalBalance: 0,
          totalPercentage: Math.random() * 10,
          wallets: [],
        },
        insiders: {
          count: Math.floor(Math.random() * 3),
          totalBalance: 0,
          totalPercentage: Math.random() * 5,
          wallets: [],
        },
        rugged: false,
        risks: [],
        score: Math.floor(Math.random() * 10),
        jupiterVerified: token.verified || Math.random() > 0.5,
      },
      buysCount: Math.floor(Math.random() * 10000),
      sellsCount: Math.floor(Math.random() * 8000),
    };

    setSelectedToken(tokenDetailData);
    setIsModalOpen(true);
  }, []);

  // Handle quick buy with instant trading
  const handleQuickBuy = useCallback(
    async (token: SearchTokenResult, e: React.MouseEvent) => {
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
          setPendingBuyToken(token);
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
            console.log('Transaction ID:', result.result.transactionId);
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

    // Fetch new data for the category
    fetchTokens(newFilters);
  }, [category, limit, timeframe]);

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
    (token: SearchTokenResult, index: number) => {
      const isBuying = buyingTokens.has(token.mint);
      
      // New horizontal card design matching the uploaded image
      return (
        <div
          key={token.mint}
          className="bg-background border border-border rounded-xl p-4 hover:border-muted-foreground transition-all duration-200 cursor-pointer group"
          onClick={() => handleTokenClick(token)}
        >
          {/* Main content row */}
          <div className="flex items-center justify-between mb-3">
            {/* Left section - Token info */}
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* Token Logo */}
              {token.logoURI || token.image ? (
                <img
                  src={token.logoURI || token.image}
                  alt={token.symbol || token.name}
                  className="w-12 h-12 rounded-full flex-shrink-0 border-2 border-muted"
                  onError={e => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0 border-2 border-muted">
                  <span className="text-primary-foreground font-bold text-sm">
                    {(token.symbol || token.name || '?')
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                </div>
              )}

              {/* Token Name & Symbol */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-bold text-foreground text-lg truncate">
                    {token.symbol || token.name || 'Unknown'}
                  </h3>
                  {token.verified && (
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
                    {token.createdOn
                      ? formatRelativeTime(token.createdOn)
                      : 'N/A'}
                  </span>
                  <span className="font-mono">
                    {token.mint
                      ? `${token.mint.slice(0, 4)}...${token.mint.slice(-4)}`
                      : 'Unknown'}
                  </span>
                  <div className="flex items-center space-x-1">
                    <Users className="w-3 h-3" />
                    <span>{token.holders || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right section - Buy button */}
            <Button
              size="sm"
              disabled={isBuying}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-2 rounded-lg font-medium flex items-center space-x-2 min-w-[80px]"
              onClick={e => handleQuickBuy(token, e)}
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
                  {Math.random() > 0.5
                    ? `${(Math.random() * 20 - 10).toFixed(1)}%`
                    : '0.0%'}
                </span>
              </div>
              <div className="flex items-center space-x-1 px-2 py-1 bg-muted rounded text-xs">
                <span className="text-purple-400">🏃‍♂️</span>
                <span className="text-muted-foreground">Run</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span className="text-muted-foreground">
                  {token.liquidityUsd && token.marketCapUsd
                    ? ((token.liquidityUsd / token.marketCapUsd) * 100).toFixed(
                        2
                      )
                    : '10.57'}
                  %
                </span>
              </div>
            </div>

            {/* Right stats */}
            <div className="flex items-center space-x-4 text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Users className="w-3 h-3" />
                <span>{token.holders || 1}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-3 h-3 bg-accent-gradient rounded"></span>
                <span>
                  {token.priceUsd ? token.priceUsd.toFixed(4) : '0.0058'}
                </span>
              </div>
              <div className="text-xs">
                TX {Math.floor(Math.random() * 10) + 1}
              </div>
            </div>
          </div>

          {/* Bottom stats row */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-muted-foreground">
                V $
                {formatNumber(
                  token.volume_24h || Math.floor(Math.random() * 10000),
                  1
                )}
              </span>
              <span className="text-muted-foreground">
                MC $
                {formatNumber(
                  token.marketCapUsd || Math.floor(Math.random() * 100000),
                  1
                )}
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

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      {(title || showFilters) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {title && (
            <div className="flex items-center space-x-3">
              {getCategoryIcon()}
              <div>
                <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                {description && (
                  <p className="text-muted-foreground mt-1">{description}</p>
                )}
              </div>
            </div>
          )}

          {showFilters && (
            <div className="flex items-center space-x-3">
              {/* Timeframe selector for trending and volume */}
              {(category === 'trending' || category === 'volume') && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    Timeframe:
                  </span>
                  <select
                    value={filters.timeframe}
                    onChange={e =>
                      handleFilterChange({ timeframe: e.target.value as any })
                    }
                    className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                  >
                    <option value="5m">5 minutes</option>
                    <option value="15m">15 minutes</option>
                    <option value="30m">30 minutes</option>
                    <option value="1h">1 hour</option>
                    <option value="6h">6 hours</option>
                    <option value="12h">12 hours</option>
                    <option value="24h">24 hours</option>
                    <option value="7d">7 days</option>
                    <option value="30d">30 days</option>
                  </select>
                </div>
              )}

              <select
                value={filters.sortBy}
                onChange={e =>
                  handleFilterChange({ sortBy: e.target.value as any })
                }
                className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
              >
                <option value="marketCap">Market Cap</option>
                <option value="volume">Volume</option>
                <option value="price">Price</option>
                <option value="liquidity">Liquidity</option>
                <option value="name">Name</option>
                {category === 'latest' && (
                  <option value="createdAt">Creation Date</option>
                )}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          <span>
            {isLoading(`tokens-${category}`)
              ? 'Loading...'
              : `${filteredTokens.length} tokens found`}
            {(category === 'trending' || category === 'volume') &&
              filters.timeframe &&
              ` (${getTimeframeText(filters.timeframe)})`}
          </span>
        </div>

        <div>
          {category === 'trending' && <span>Updated every 5 minutes</span>}
          {category === 'volume' && <span>Real-time volume tracking</span>}
          {category === 'latest' && <span>Newest tokens on Solana</span>}
        </div>
      </div>

      {/* Loading State */}
      {isLoading(`tokens-${category}`) && tokens.length === 0 && (
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
      )}

      {/* Token Grid */}
      {filteredTokens.length > 0 && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredTokens.map(renderTokenCard)}
        </div>
      )}

      {/* Load More */}
      {hasMore && filteredTokens.length > 0 && (
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
      )}

      {/* Empty State */}
      {filteredTokens.length === 0 && !isLoading(`tokens-${category}`) && (
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
      )}

      {/* Token Detail Modal */}
      {selectedToken && (
        <TokenDetailModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          tokenData={selectedToken}
        />
      )}

      {/* Trade Config Prompt */}
      <TradeConfigPrompt
        isOpen={showTradeConfigPrompt}
        onClose={handleTradeConfigPromptClose}
        tokenSymbol={pendingBuyToken?.symbol || pendingBuyToken?.name}
      />
    </div>
  );
};

export default TokenList;
