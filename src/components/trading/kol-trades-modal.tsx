'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Copy,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Activity,
  Zap,
  LayoutGrid,
  List as ListIcon,
} from 'lucide-react';
import {
  TradingService,
  KOLTrade,
  KOLHistoryResponse,
} from '@/services/trading.service';
import { useNotifications, useLoading } from '@/stores/use-ui-store';
import { formatNumber, copyToClipboard } from '@/lib/utils';
import { useKOLTradeSocket } from '@/hooks/use-kol-trade-socket';
import { KOLTradeCard } from './kol-trade-card';
import SubscriptionControls from './subscription-controls';
import type { KOLWallet, TopTrader } from '@/types';
import { useKOLStore } from '@/stores';
import { SolanaService } from '@/services/solana.service';

// Helpers to unify avatar resolution similar to other KOL components
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
  const base = `https://unavatar.io/twitter/${encodeURIComponent(username)}`;
  if (fallbackSeed && fallbackSeed.trim().length > 0) {
    const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackSeed)}`;
    return `${base}?fallback=${encodeURIComponent(fallback)}`;
  }
  return base;
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

interface KOLTradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  kol?: KOLWallet | null;
  trader?: TopTrader;
  walletAddress: string;
}

interface TradeStats {
  totalTrades: number;
  totalVolume: number;
  winRate: number;
  totalPnL: number;
  avgTradeSize: number;
  buyTrades: number;
  sellTrades: number;
}

type ViewMode = 'historical' | 'realtime';
type RealtimeView = 'cards' | 'list';

const KOLTradesModal: React.FC<KOLTradesModalProps> = ({
  isOpen,
  onClose,
  kol,
  trader,
  walletAddress,
}) => {
  const [trades, setTrades] = useState<KOLTrade[]>([]);
  const [enrichedTrades, setEnrichedTrades] = useState<KOLTrade[]>([]);
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  const [viewMode, setViewMode] = useState<ViewMode>('realtime');
  const [realtimeView, setRealtimeView] = useState<RealtimeView>('list');
  const [pagination, setPagination] = useState<{
    hasMore: boolean;
  }>({ hasMore: false });

  const { showSuccess, showError } = useNotifications();
  const { isLoading, setLoading } = useLoading();

  // Pull KOL details from store for consistent header/avatar across app
  const { getKOL, ensureKOL } = useKOLStore();
  const [resolvedKOL, setResolvedKOL] = useState<KOLWallet | null>(kol || null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ensured = await ensureKOL(walletAddress);
        if (!mounted) return;
        if (ensured) {
          setResolvedKOL(ensured);
        } else {
          const cached = getKOL(walletAddress);
          if (cached) setResolvedKOL(cached);
        }
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [walletAddress, ensureKOL, getKOL]);

  // Real-time trade data
  const { recentTrades, isConnected: isTradeSocketConnected } = useKOLTradeSocket();

  // Filter real-time trades for this specific KOL
  const kolRealtimeTrades = useMemo(() => {
    return recentTrades.filter(trade =>
      trade.kolWallet?.toLowerCase() === walletAddress.toLowerCase()
    );
  }, [recentTrades, walletAddress]);

  // Calculate stats from trades (use enriched trades for display)
  const stats: TradeStats = useMemo(() => {
    const tradesData = enrichedTrades.length > 0 ? enrichedTrades : trades;

    if (!tradesData.length) {
      return {
        totalTrades: 0,
        totalVolume: 0,
        winRate: 0,
        totalPnL: 0,
        avgTradeSize: 0,
        buyTrades: 0,
        sellTrades: 0,
      };
    }

    const buyTrades = tradesData.filter(t => t.tradeType === 'buy').length;
    const sellTrades = tradesData.filter(t => t.tradeType === 'sell').length;
    const totalVolume = tradesData.reduce((sum, t) => sum + t.solAmount, 0);
    const avgTradeSize = tradesData.length > 0 ? totalVolume / tradesData.length : 0;

    // Simple PnL calculation from the visible trades
    const totalPnL = tradesData.reduce((sum, t) => {
      return sum + (t.tradeType === 'sell' ? t.solAmount : -t.solAmount);
    }, 0);

    const winRate =
      tradesData.length > 0 ? (sellTrades / tradesData.length) * 100 : 0;

    return {
      totalTrades: tradesData.length,
      totalVolume,
      winRate,
      totalPnL,
      avgTradeSize,
      buyTrades,
      sellTrades,
    };
  }, [trades, enrichedTrades]);

  // Real-time stats for this specific KOL
  const kolRealtimeStats = useMemo(() => {
    const kolTrades = kolRealtimeTrades;
    if (!kolTrades.length) {
      return {
        totalTrades: 0,
        totalVolume: 0,
        buyTrades: 0,
        sellTrades: 0,
      };
    }

    const buyTrades = kolTrades.filter(t => (t.tradeData?.tradeType ?? 'sell') === 'buy').length;
    const sellTrades = kolTrades.filter(t => (t.tradeData?.tradeType ?? 'sell') === 'sell').length;

    // Calculate total volume in SOL correctly based on trade type
    const totalVolume = kolTrades.reduce((sum, t) => {
      const isBuy = (t.tradeData?.tradeType ?? 'sell') === 'buy';
      if (isBuy) {
        // For buy trades: count SOL spent (amountOut)
        return sum + (t.tradeData?.amountOut || 0);
      } else {
        // For sell trades: count SOL received (amountIn)
        return sum + (t.tradeData?.amountIn || 0);
      }
    }, 0);

    return {
      totalTrades: kolTrades.length,
      totalVolume,
      buyTrades,
      sellTrades,
    };
  }, [kolRealtimeTrades]);

  // Enrich trades with token metadata using SolanaService
  const enrichTradesWithMetadata = async (tradesData: ParsedSwap[]) => {
    if (!tradesData.length) {
      setEnrichedTrades([]);
      return;
    }

    try {
      // Extract unique token mint addresses
      const uniqueMints = Array.from(new Set(tradesData.map(trade => trade.mint || (trade.tradeType === 'buy' ? trade.tokenIn : trade.tokenOut)).filter(Boolean)));

      if (uniqueMints.length === 0) {
        setEnrichedTrades(tradesData);
        return;
      }

      console.log('Fetching metadata for', uniqueMints.length, 'tokens:', uniqueMints);

      // Use SolanaService to fetch token metadata in batch
      const metadataMap = await SolanaService.fetchTokenMetadataBatch(uniqueMints);

      console.log('Received metadata for', metadataMap.size, 'tokens:', metadataMap);

      // Enrich trades with metadata
      const enriched = tradesData.map(trade => {
        const tokenMint = trade.mint || (trade.tradeType === 'buy' ? trade.tokenIn : trade.tokenOut);
        const metadata = metadataMap.get(tokenMint);
        const enrichedTrade = {
          ...trade,
          name: metadata?.name || trade.name || 'Unknown Token',
          symbol: metadata?.symbol || trade.symbol,
          image: metadata?.logoURI || trade.image,
        };

        console.log(`Enriching trade for ${trade.tokenMint}:`, {
          original: trade.name,
          metadata: metadata?.name,
          final: enrichedTrade.name
        });

        return enrichedTrade;
      });

      console.log('Enriched trades:', enriched);
      setEnrichedTrades(enriched);
    } catch (error) {
      console.warn('Failed to enrich trades with metadata:', error);
      // Fallback to original trades if enrichment fails
      setEnrichedTrades(tradesData);
    }
  };

  // Fetch trades based on timeframe
  const fetchTrades = async (timeframeParam: string = timeframe) => {
    try {
      setLoading('kolTrades', true);

      const response = await TradingService.getKOLTradeHistory(walletAddress, timeframeParam);
      const tradesData = response.data.trades || [];

      console.log('Fetched', tradesData.length, 'trades:', tradesData);

      setTrades(tradesData);
      setPagination({ hasMore: false }); // Analytics service currently returns all at once

      // Enrich trades with token metadata
      await enrichTradesWithMetadata(tradesData);
    } catch (error: any) {
      showError('Load Error', error.message || 'Failed to load trades');
      console.error('Failed to fetch trades:', error);
    } finally {
      setLoading('kolTrades', false);
    }
  };

  // Load trades when modal opens or timeframe changes
  useEffect(() => {
    if (isOpen && walletAddress && viewMode === 'historical') {
      fetchTrades();
    }
  }, [isOpen, walletAddress, timeframe, viewMode]);

  const handleTimeframeChange = (newTimeframe: '24h' | '7d' | '30d') => {
    setTimeframe(newTimeframe);
  };

  const handleViewModeChange = (newViewMode: ViewMode) => {
    setViewMode(newViewMode);
  };

  const handleCopyAddress = () => {
    copyToClipboard(walletAddress);
    showSuccess('Copied!', 'Wallet address copied to clipboard');
  };

  const handleViewOnExplorer = () => {
    window.open(`https://solscan.io/account/${walletAddress}`, '_blank');
  };

  const handleLoadMore = () => {
    // Implementation for loading more trades
  };

  const getTradeIcon = (side: 'buy' | 'sell') => {
    return side === 'buy' ? (
      <ArrowUpRight className="w-4 h-4 text-green-500" />
    ) : (
      <ArrowDownRight className="w-4 h-4 text-red-500" />
    );
  };

  const getTradeColor = (side: 'buy' | 'sell') => {
    return side === 'buy'
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
  };

  // Resolve title and avatar consistently from store data
  const resolvedName = resolvedKOL?.name || (trader ? `Trader #${walletAddress.slice(0, 8)}` : `KOL ${walletAddress.slice(0, 8)}`);
  const twitterUrl = findTwitterUrlFromKOL(resolvedKOL || undefined);
  const twitterAvatar = getTwitterAvatarUrl(twitterUrl, resolvedName || walletAddress);
  const preferredAvatar = twitterAvatar ?? resolvedKOL?.avatar;

  const title = resolvedName;

  // Current stats based on view mode
  const currentStats = viewMode === 'realtime' ? kolRealtimeStats : stats;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={`Trading history and stats for ${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}`}
      size="xl"
    >
      <div className="space-y-4 sm:space-y-6 h-full flex flex-col">
        {/* Header Info */}
        <div className="pb-4 border-b border-border space-y-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              {preferredAvatar ? (
                <img
                  src={preferredAvatar}
                  alt={resolvedName || 'KOL Avatar'}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-muted"
                />
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center border-2 border-muted">
                  <span className="text-primary-foreground font-bold text-xs sm:text-sm">
                    {(resolvedName || walletAddress).slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-foreground text-base sm:text-lg truncate">{title}</h3>
                <div className="flex items-center space-x-2 text-xs sm:text-sm text-muted-foreground">
                  <span className="font-mono truncate">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-6)}
                  </span>
                  <button
                    onClick={handleCopyAddress}
                    className="hover:text-foreground transition-colors flex-shrink-0"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleViewOnExplorer}
                    className="hover:text-foreground transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  {/* Real-time connection indicator */}
                  {isTradeSocketConnected && (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs text-green-600">Live</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Subscribe Button - show for both KOLs and traders */}
            {walletAddress && (
              <div className="flex-shrink-0">
                <SubscriptionControls
                  kolWallet={walletAddress}
                  kolName={resolvedName}
                  size="sm"
                  variant="button"
                  showSettings={true}
                  className="px-3 sm:px-4 py-2 rounded-lg font-medium text-sm"
                />
              </div>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center bg-muted rounded-lg p-1 w-full sm:w-auto">
              <button
                onClick={() => handleViewModeChange('realtime')}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center sm:justify-start space-x-2 ${viewMode === 'realtime'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Zap className="w-4 h-4" />
                <span>Live Trades</span>
                {kolRealtimeTrades.length > 0 && (
                  <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full ml-1">
                    {kolRealtimeTrades.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleViewModeChange('historical')}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center sm:justify-start space-x-2 ${viewMode === 'historical'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Historical</span>
              </button>
            </div>

            {/* Timeframe Selector - only show for historical */}
            {viewMode === 'historical' && (
              <div className="flex items-center space-x-1 bg-muted rounded-lg p-1 w-full sm:w-auto">
                {(['24h', '7d', '30d'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => handleTimeframeChange(tf)}
                    className={`flex-1 sm:flex-none px-3 py-1 text-sm rounded transition-colors ${timeframe === tf
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto space-y-6 min-h-0">
          {/* Stats Grid - Show different stats based on view mode */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {viewMode === 'realtime' ? 'Live Trades' : 'Total Trades'}
                </span>
              </div>
              <span className="text-lg sm:text-xl font-bold text-foreground">
                {currentStats.totalTrades}
              </span>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {viewMode === 'realtime' ? 'Live Volume' : 'Total Volume'}
                </span>
              </div>
              <div>
                <span className="text-lg sm:text-xl font-bold text-foreground">
                  {formatNumber(currentStats.totalVolume, 3)}
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground ml-1">SOL</span>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" />
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {viewMode === 'realtime' ? 'Buy Trades' : 'Win Rate'}
                </span>
              </div>
              <span className="text-lg sm:text-xl font-bold text-foreground">
                {viewMode === 'realtime'
                  ? currentStats.buyTrades
                  : `${formatNumber(stats.winRate, 1)}%`
                }
              </span>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {viewMode === 'realtime' ? 'Sell Trades' : 'Avg Trade'}
                </span>
              </div>
              <div>
                <span className="text-lg sm:text-xl font-bold text-foreground">
                  {viewMode === 'realtime'
                    ? currentStats.sellTrades
                    : formatNumber(stats.avgTradeSize, 3)
                  }
                </span>
                {viewMode === 'historical' && (
                  <span className="text-xs sm:text-sm text-muted-foreground ml-1">SOL</span>
                )}
              </div>
            </div>
          </div>

          {/* Historical PnL Stats - only show for historical view */}
          {viewMode === 'historical' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" />
                  <span className="text-xs sm:text-sm text-muted-foreground">Net PnL</span>
                </div>
                <div>
                  <span
                    className={`text-lg sm:text-xl font-bold ${stats.totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                  >
                    {stats.totalPnL >= 0 ? '+' : ''}
                    {formatNumber(stats.totalPnL, 3)}
                  </span>
                  <span className="text-xs sm:text-sm text-muted-foreground ml-1">SOL</span>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500" />
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Trade Split
                  </span>
                </div>
                <div className="text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-600 dark:text-green-400">
                      {stats.buyTrades} Buys
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                      {stats.sellTrades} Sells
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Trades List */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h4 className="text-base sm:text-lg font-semibold text-foreground flex items-center space-x-2">
                {viewMode === 'realtime' ? (
                  <>
                    <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Live Trades</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Historical Trades</span>
                  </>
                )}
              </h4>
              {viewMode === 'realtime' && (
                <div className="flex items-center space-x-2">
                  <div className="flex items-center bg-muted rounded-lg p-1">
                    <button
                      onClick={() => setRealtimeView('cards')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1 ${realtimeView === 'cards'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span className="hidden sm:inline">Cards</span>
                    </button>
                    <button
                      onClick={() => setRealtimeView('list')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1 ${realtimeView === 'list'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      <ListIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">List</span>
                    </button>
                  </div>
                  <div className="flex items-center space-x-1 text-xs sm:text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>{kolRealtimeTrades.length} recent trades</span>
                  </div>
                </div>
              )}
              {viewMode === 'historical' && (
                <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                    <span>{currentStats.buyTrades} Buys</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <ArrowDownRight className="w-3 h-3 text-red-500" />
                    <span>{currentStats.sellTrades} Sells</span>
                  </div>
                </div>
              )}
            </div>

            {/* Real-time Trades */}
            {viewMode === 'realtime' && (
              <>
                {!isTradeSocketConnected ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Connecting to live trade feed...</p>
                  </div>
                ) : kolRealtimeTrades.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No live trades yet for this KOL</p>
                    <p className="text-sm mt-1">Trades will appear here in real-time</p>
                  </div>
                ) : (
                  <div className={realtimeView === 'cards' ? 'grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
                    {kolRealtimeTrades.map((trade) => (
                      <KOLTradeCard
                        key={trade.id}
                        trade={trade}
                        variant={realtimeView === 'list' ? 'list' : 'card'}
                        hideKOLInfo
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Historical Trades */}
            {viewMode === 'historical' && (
              <>
                {isLoading('kolTrades') ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-muted/20 rounded-lg p-4 animate-pulse"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-muted rounded-full" />
                            <div className="space-y-1">
                              <div className="w-20 h-4 bg-muted rounded" />
                              <div className="w-32 h-3 bg-muted rounded" />
                            </div>
                          </div>
                          <div className="w-24 h-4 bg-muted rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : trades.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No trades found for the selected timeframe</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {(enrichedTrades.length > 0 ? enrichedTrades : trades).map((trade, index) => (
                      <KOLTradeCard
                        key={`${trade.signature}-${index}`}
                        trade={trade}
                        variant="list"
                        hideKOLInfo
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Load More Button - only for historical */}
          {viewMode === 'historical' && pagination.hasMore && (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoading('kolTrades')}
              >
                Load More Trades
              </Button>
            </div>
          )}
        </div>{' '}
        {/* End scrollable content area */}
      </div>
    </Modal>
  );
};

export default KOLTradesModal;
