'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Target,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Twitter,
  Globe,
  Activity,
  DollarSign,
} from 'lucide-react';
import { PortfolioService } from '@/services/portfolio.service';
import { SolanaService } from '@/services/solana.service';
import { useNotifications } from '@/stores/use-ui-store';
import { useTradingStore } from '@/stores/use-trading-store';
import AuthService from '@/services/auth.service';
import { useTokenLazyLoading } from '@/hooks/use-token-lazy-loading';
import { useEnhancedWebSocket } from '@/hooks/use-enhanced-websocket';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  safeFormatAmount,
  cn,
} from '@/lib/utils';
import type { TradeHistoryEntry } from '@/types';

interface OpenPositionsProps {
  onTradeClick?: (trade: TradeHistoryEntry) => void;
  limit?: number;
  showHeader?: boolean;
  defaultExpanded?: boolean;
}

const OpenPositions: React.FC<OpenPositionsProps> = ({
  onTradeClick,
  limit,
  showHeader = true,
  defaultExpanded = false,
}) => {
  const [openTrades, setOpenTrades] = useState<TradeHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isPaperTrading } = useTradingStore();
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [solPrice, setSolPrice] = useState<number>(0);

  const token = AuthService.getToken();
  const { connect, disconnect } = useEnhancedWebSocket({
    auth: token ? { token } : {}
  });

  // Paper Balance State Removed

  const { showError, showSuccess } = useNotifications();
  const [sellingTradeId, setSellingTradeId] = useState<string | null>(null);

  const fetchOpenTrades = async () => {
    try {
      setIsLoading(true);
      setError(null);

      setError(null);

      const response = await PortfolioService.getOpenTrades(isPaperTrading);
      const trades = response.data || [];
      const uniqueTrades = Array.from(new Map(trades.map((t: TradeHistoryEntry) => [t.id, t])).values());
      setOpenTrades(uniqueTrades as TradeHistoryEntry[]);

      const tokenMints = trades.map(trade => trade.tokenMint).filter(Boolean);
      if (tokenMints.length > 0) {
        loadTokens(tokenMints);
      }
    } catch (err: any) {
      console.error('Failed to fetch open trades:', err);
      setError(err.message || 'Failed to load open positions');
      showError('Error', 'Failed to load open positions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstantSell = async (trade: TradeHistoryEntry) => {
    try {
      setSellingTradeId(trade.id);
      const amountToSell = trade.entryAmount;
      await PortfolioService.performSwap({
        tradeType: 'sell',
        mint: trade.tokenMint,
        amount: amountToSell,
        tradeId: trade.id,
        priority: 'high',
      });
      showSuccess('Order Placed', `Sell order for ${trade.tokenMint.slice(0, 4)}... sent successfully.`);
      // No need to re-fetch — the POSITION_CLOSED WebSocket event will update the list
    } catch (err: any) {
      console.error('Failed to sell:', err);
      showError('Sell Failed', err.message || 'Could not execute sell order');
    } finally {
      setSellingTradeId(null);
    }
  };

  // Connect WebSocket on mount
  useEffect(() => {
    connect().catch(err => {
      console.warn('⚠️ WebSocket initial connection failed (expected in some environments):', err);
    });
    return () => disconnect();
  }, [connect, disconnect]);

  // Initial Data Fetch
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const price = await SolanaService.getSolPrice();
        setSolPrice(price);
      } catch (error) {
        console.error('Failed to fetch SOL price:', error);
      }
    };
    fetchSolPrice();
    fetchOpenTrades();
  }, [isPaperTrading]);

  // Listen for Real-Time Updates
  useEffect(() => {
    const handleUserEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const event = customEvent.detail;
      if (!event || !event.type) return;

      if (event.type === 'POSITION_UPDATE') {
        const { tradeId, pnl, pnlPercent, currentPrice } = event.data;
        setOpenTrades(prev => prev.map(t => {
          if (t.id === tradeId || t.originalTradeId === tradeId) {
            return {
              ...t,
              currentPrice: currentPrice,
              unrealizedPnL: pnl,
              unrealizedPnLPercentage: pnlPercent,
            };
          }
          return t;
        }));
      } else if (event.type === 'TRADE_OPENED') {
        const { trade } = event.data;
        setOpenTrades(prev => {
          if (prev.some(t => t.id === trade.id)) return prev;
          const newTrade: TradeHistoryEntry = {
            ...trade,
            openedAt: new Date(trade.openedAt),
          };
          return [newTrade, ...prev];
        });
        if (trade.tokenMint) loadTokens([trade.tokenMint]);
      } else if (event.type === 'POSITION_CLOSED') {
        const { tradeId } = event.data;
        setOpenTrades(prev => prev.filter(t => t.id !== tradeId && t.originalTradeId !== tradeId));
        showSuccess('Position Closed', 'Trade closed successfully.');
      }
    };

    window.addEventListener('kolplay_user_event', handleUserEvent);
    return () => window.removeEventListener('kolplay_user_event', handleUserEvent);
  }, []);

  // Token lazy loading for metadata
  const { tokens: tokenDetails, loadTokens, getToken } = useTokenLazyLoading({
    batchSize: 10,
    maxConcurrentBatches: 2,
    cacheEnabled: true,
  });

  // Enrich with token data
  const enrichedTrades = useMemo(() => {
    return openTrades.map(trade => {
      const tokenDetail = getToken(trade.tokenMint);
      const currentPrice = trade.currentPrice || trade.entryPrice;
      const currentValue = trade.currentValue || (trade.entryAmount * currentPrice);
      const unrealizedPnL = trade.unrealizedPnL !== undefined ? trade.unrealizedPnL : (currentValue - trade.entryValue);
      const unrealizedPnLPercentage = trade.unrealizedPnLPercentage !== undefined ? trade.unrealizedPnLPercentage : ((unrealizedPnL / trade.entryValue) * 100);

      const openedAt = new Date(trade.openedAt);
      const now = new Date();
      const diffMs = now.getTime() - openedAt.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const holdTime = hours > 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${minutes}m`;

      return {
        ...trade,
        tokenSymbol: tokenDetail?.token?.symbol || `${trade.tokenMint.slice(0, 4)}...${trade.tokenMint.slice(-4)}`,
        tokenName: tokenDetail?.token?.name || `${trade.tokenMint.slice(0, 8)}...${trade.tokenMint.slice(-8)}`,
        tokenImage: tokenDetail?.token?.image || tokenDetail?.token?.logoURI,
        verified: tokenDetail?.token?.verified || false,
        marketCap: tokenDetail?.pools?.[0]?.marketCap?.usd || tokenDetail?.token?.marketCapUsd || 0,
        liquidityUsd: tokenDetail?.pools?.[0]?.liquidity?.usd || tokenDetail?.token?.liquidityUsd || 0,
        priceChange24h: tokenDetail?.events?.['24h']?.priceChangePercentage || (tokenDetail?.token as any)?.priceChange24h || 0,
        twitter: tokenDetail?.token?.twitter,
        website: tokenDetail?.token?.website,
        currentPrice,
        currentValue,
        unrealizedPnL,
        unrealizedPnLPercentage,
        holdTime,
      };
    });
  }, [openTrades, tokenDetails, getToken]);

  const displayedTrades = limit ? enrichedTrades.slice(0, limit) : enrichedTrades;

  const renderHeader = () => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
        >
          <h3 className="text-lg font-semibold text-foreground">
            Open Positions
            <span className="ml-2 text-sm text-muted-foreground font-normal">
              ({displayedTrades.length})
            </span>
          </h3>
          <ChevronDown
            className={cn(
              'h-5 w-5 text-muted-foreground transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </button>

        <div className="flex items-center space-x-2 bg-muted/30 px-2 py-1 rounded-md border border-border/50">
          <span className="text-xs font-medium text-muted-foreground mr-1">
            Manage via Top Bar
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { fetchOpenTrades(); }}
        className="text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Refresh
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {showHeader && renderHeader()}
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-muted/20 border border-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-muted rounded-full"></div>
                  <div className="space-y-1">
                    <div className="h-4 bg-muted rounded w-16"></div>
                    <div className="h-3 bg-muted rounded w-24"></div>
                  </div>
                </div>
                <div className="h-6 bg-muted rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive font-medium">Failed to load open positions</p>
        </div>
        <p className="text-sm text-destructive/80 mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchOpenTrades}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  if (displayedTrades.length === 0) {
    return (
      <div className="space-y-2">
        {showHeader && renderHeader()}
        <div className="text-center py-10 bg-muted/10 border border-dashed rounded-xl">
          <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
          <p className="text-sm text-muted-foreground">No open positions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showHeader && renderHeader()}

      {isExpanded && (
        <div className="space-y-2">
          {displayedTrades.map(trade => (
            <div
              key={trade.id}
              className={cn(
                'bg-muted/20 border border-border rounded-lg p-4 transition-all duration-200',
                onTradeClick && 'cursor-pointer hover:bg-muted/40 hover:border-muted-foreground'
              )}
              onClick={() => onTradeClick?.(trade)}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Token Info */}
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 border border-border/50">
                    {trade.tokenImage ? (
                      <img
                        src={trade.tokenImage}
                        alt={trade.tokenSymbol}
                        className="w-full h-full object-cover"
                        onError={e => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = `<span class="text-primary-foreground font-bold text-xs">${trade.tokenSymbol.charAt(0)}</span>`;
                        }}
                      />
                    ) : (
                      <span className="text-primary-foreground font-bold text-xs">
                        {trade.tokenSymbol.charAt(0)}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-foreground">{trade.tokenSymbol}</span>
                      {trade.verified && (
                        <div className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center" title="Verified">
                          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-muted-foreground mt-0.5 font-mono">
                      <span>${(trade.entryPrice || 0).toFixed(8)} → ${(trade.currentPrice || 0).toFixed(8)}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] text-muted-foreground mt-1 bg-background/40 px-2 py-0.5 rounded-md inline-block">
                      <Clock className="w-3 h-3 mr-1" />
                      {trade.holdTime}
                      <span className="mx-1">•</span>
                      {safeFormatAmount(trade.entryValue, 4)} → {safeFormatAmount(trade.currentValue || (trade.entryAmount * (trade.currentPrice || trade.entryPrice)), 4)} SOL
                    </div>

                    {/* Rich Metadata Metrics */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3 pt-3 border-t border-border/40 text-[10px] text-muted-foreground">
                      {trade.marketCap > 0 && (
                        <div className="flex items-center" title="Market Cap">
                          <Activity className="w-3 h-3 mr-1.5 text-blue-500/60" />
                          <span>MCap: <span className="text-foreground/80 font-medium">${formatNumber(trade.marketCap)}</span></span>
                        </div>
                      )}
                      {trade.liquidityUsd > 0 && (
                        <div className="flex items-center" title="Liquidity">
                          <DollarSign className="w-3 h-3 mr-1.5 text-orange-500/60" />
                          <span>Liq: <span className="text-foreground/80 font-medium">${formatNumber(trade.liquidityUsd)}</span></span>
                        </div>
                      )}
                      {trade.priceChange24h !== 0 && (
                        <div className={cn(
                          "flex items-center font-medium",
                          trade.priceChange24h > 0 ? "text-green-500/70" : "text-red-500/70"
                        )} title="24h Change">
                          {trade.priceChange24h > 0 ? <TrendingUp className="w-3 h-3 mr-1.5" /> : <TrendingDown className="w-3 h-3 mr-1.5" />}
                          <span>24h: {trade.priceChange24h > 0 ? '+' : ''}{trade.priceChange24h.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Access Links */}
                    <div className="flex items-center space-x-4 mt-3">
                      <a
                        href={`https://solscan.io/token/${trade.tokenMint}`}
                        target="_blank" rel="noopener noreferrer"
                        className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={`https://dexscreener.com/solana/${trade.tokenMint}`}
                        target="_blank" rel="noopener noreferrer"
                        className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        <Globe className="w-3.5 h-3.5" />
                      </a>
                      {trade.twitter && (
                        <a
                          href={trade.twitter}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <Twitter className="w-3.5 h-3.5 text-blue-400" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions & P&L */}
                <div className="flex flex-col items-end justify-between self-stretch">
                  <div className="text-right">
                    <div className={cn(
                      'text-lg sm:text-xl font-bold leading-none',
                      trade.unrealizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {trade.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(trade.unrealizedPnL * solPrice)}
                    </div>
                    <div className={cn(
                      'text-xs sm:text-sm font-medium mt-1',
                      trade.unrealizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {trade.unrealizedPnL >= 0 ? '+' : ''}{formatPercentage(trade.unrealizedPnLPercentage)}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 mt-auto">
                    {/* Sell Conditions Tooltips/Indicators */}
                    {(trade.sellConditions.takeProfitPercentage || trade.sellConditions.stopLossPercentage) && (
                      <div className="hidden sm:flex space-x-1 mr-2 bg-muted/30 p-1 rounded">
                        {trade.sellConditions.takeProfitPercentage && <span className="text-[9px] text-green-500 font-bold" title="TP">+{trade.sellConditions.takeProfitPercentage}%</span>}
                        {trade.sellConditions.stopLossPercentage && <span className="text-[9px] text-red-500 font-bold" title="SL">-{trade.sellConditions.stopLossPercentage}%</span>}
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm font-bold shadow-lg"
                      onClick={e => { e.stopPropagation(); handleInstantSell(trade); }}
                      disabled={sellingTradeId === trade.id}
                    >
                      {sellingTradeId === trade.id ? <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : 'Sell Now'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {limit && enrichedTrades.length > limit && (
        <Button variant="outline" className="w-full mt-2" size="sm">
          View All {enrichedTrades.length} Positions
        </Button>
      )}
    </div>
  );
};

export default OpenPositions;
