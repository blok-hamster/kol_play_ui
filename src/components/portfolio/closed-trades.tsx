'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  RefreshCw,
  Eye,
  AlertCircle,
  ExternalLink,
  Activity,
  Globe,
  Twitter,
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
  formatNumber,
  formatPercentage,
  formatRelativeTime,
  safeFormatAmount,
  cn,
} from '@/lib/utils';
import type { TradeHistoryEntry } from '@/types';

interface ClosedTradesProps {
  onTradeClick?: (trade: TradeHistoryEntry) => void;
  limit?: number;
  showHeader?: boolean;
  defaultExpanded?: boolean;
  showViewAll?: boolean;
}

const ClosedTrades: React.FC<ClosedTradesProps> = ({
  onTradeClick,
  limit = 5,
  showHeader = true,
  defaultExpanded = true,
  showViewAll = true,
}) => {
  const [closedTrades, setClosedTrades] = useState<TradeHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [solPrice, setSolPrice] = useState<number>(0);
  const { isPaperTrading } = useTradingStore();
  const token = AuthService.getToken();
  const { connect, disconnect } = useEnhancedWebSocket({
    auth: token ? { token } : {}
  });

  const { showError } = useNotifications();

  // Fetch SOL price
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
  }, []);

  // Token lazy loading for metadata
  const { tokens: tokenDetails, loadTokens, getToken } = useTokenLazyLoading({
    batchSize: 10,
    maxConcurrentBatches: 2,
    cacheEnabled: true,
  });

  const fetchClosedTrades = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await PortfolioService.getUserTrades('closed', isPaperTrading);
      const trades = response.data || [];

      // Sort by closedAt descending (most recent first)
      const sortedTrades = trades.sort((a, b) => {
        const dateA = new Date(a.closedAt || a.updatedAt).getTime();
        const dateB = new Date(b.closedAt || b.updatedAt).getTime();
        return dateB - dateA;
      });

      setClosedTrades(sortedTrades);

      // Load token metadata
      const tokenMints = trades.map(trade => trade.tokenMint).filter(Boolean);
      if (tokenMints.length > 0) {
        loadTokens(tokenMints);
      }
    } catch (err: any) {
      console.error('Failed to fetch closed trades:', err);
      setError(err.message || 'Failed to load closed trades');
      showError('Error', 'Failed to load closed trades');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClosedTrades();
    connect().catch(err => {
      console.warn('⚠️ WebSocket initial connection failed in ClosedTrades:', err);
    });

    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === 'POSITION_CLOSED') {
        const { trade } = customEvent.detail.data || {};
        if (trade) {
          // Insert the closed trade directly into state — no full re-fetch
          setClosedTrades(prev => {
            if (prev.some(t => t.id === trade.id)) return prev;
            return [trade, ...prev];
          });
          if (trade.tokenMint) loadTokens([trade.tokenMint]);
        } else {
          // Fallback if event payload doesn't include the trade object
          fetchClosedTrades();
        }
      }
    };

    window.addEventListener('kolplay_user_event', handleEvent);

    return () => {
      window.removeEventListener('kolplay_user_event', handleEvent);
      disconnect();
    };
  }, [isPaperTrading]);

  // Enrich trades with token data
  const enrichedTrades = useMemo(() => {
    return closedTrades.map(trade => {
      const tokenDetail = getToken(trade.tokenMint);

      // Calculate hold time
      const openedAt = new Date(trade.openedAt);
      const closedAt = new Date(trade.closedAt || trade.updatedAt);
      const diffMs = closedAt.getTime() - openedAt.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const holdTime =
        hours > 24
          ? `${Math.floor(hours / 24)}d ${hours % 24}h`
          : `${hours}h ${minutes}m`;

      return {
        ...trade,
        tokenSymbol: tokenDetail?.token?.symbol || `${trade.tokenMint.slice(0, 4)}...${trade.tokenMint.slice(-4)}`,
        tokenName: tokenDetail?.token?.name || `${trade.tokenMint.slice(0, 8)}...${trade.tokenMint.slice(-8)}`,
        tokenImage: tokenDetail?.token?.image || tokenDetail?.token?.logoURI,
        verified: tokenDetail?.token?.verified || false,
        marketCap: tokenDetail?.pools?.[0]?.marketCap?.usd || tokenDetail?.token?.marketCapUsd || 0,
        priceChange24h: tokenDetail?.events?.['24h']?.priceChangePercentage || (tokenDetail?.token as any)?.priceChange24h || 0,
        twitter: tokenDetail?.token?.twitter,
        holdTime,
      };
    });
  }, [closedTrades, tokenDetails]);

  const displayedTrades = (showAll || !limit) ? enrichedTrades : enrichedTrades.slice(0, limit);

  const getSellReasonLabel = (reason?: string) => {
    const labels: Record<string, string> = {
      take_profit: 'Take Profit',
      stop_loss: 'Stop Loss',
      trailing_stop: 'Trailing Stop',
      manual: 'Manual',
      max_hold_time: 'Max Hold Time',
    };
    return labels[reason || ''] || 'Closed';
  };

  const getSellReasonColor = (reason?: string) => {
    const colors: Record<string, string> = {
      take_profit: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
      stop_loss: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400',
      trailing_stop: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
      manual: 'bg-gray-100 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400',
      max_hold_time: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    };
    return colors[reason || ''] || 'bg-gray-100 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {showHeader && (
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              Recent Closed Trades
            </h3>
          </div>
        )}
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-muted/30 border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-muted rounded-full"></div>
                  <div>
                    <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-32"></div>
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
          <p className="text-sm text-destructive font-medium">
            Failed to load closed trades
          </p>
        </div>
        <p className="text-sm text-destructive/80">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchClosedTrades}
          className="mt-3"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (displayedTrades.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground mb-2">No closed trades</p>
        <p className="text-sm text-muted-foreground">
          Your completed trades will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Recent Closed Trades
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchClosedTrades}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {displayedTrades.map(trade => (
          <div
            key={trade.id}
            onClick={() => onTradeClick?.(trade)}
            className={cn(
              'bg-muted/30 border border-border rounded-xl p-4',
              'hover:border-muted-foreground transition-all duration-200',
              onTradeClick && 'cursor-pointer'
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Token Icon */}
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 border-2 border-muted">
                  {trade.tokenImage ? (
                    <img
                      src={trade.tokenImage}
                      alt={trade.tokenSymbol}
                      className="w-full h-full object-cover"
                      onError={e => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement!.innerHTML = `<span class="text-primary-foreground font-bold">${trade.tokenSymbol.charAt(0)}</span>`;
                      }}
                    />
                  ) : (
                    <span className="text-primary-foreground font-bold">
                      {trade.tokenSymbol.charAt(0)}
                    </span>
                  )}
                </div>

                {/* Token Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-bold text-foreground text-lg">
                      {trade.tokenSymbol}
                    </h4>
                    {trade.verified && (
                      <div
                        className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
                        title="Verified Token"
                      >
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
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        getSellReasonColor(trade.sellReason)
                      )}
                    >
                      {getSellReasonLabel(trade.sellReason)}
                    </span>
                    {trade.isSimulation && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                        Paper
                      </span>
                    )}
                    {trade.reconciledStatus === 'verified' && (
                      <div className="w-4 h-4 text-green-500 rounded-full flex items-center justify-center border border-green-500" title="On-Chain Verified">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatRelativeTime(new Date(trade.closedAt || trade.updatedAt))}
                  </p>

                  {/* Metadata Indicators */}
                  <div className="flex items-center space-x-3 mt-1 text-[10px] text-muted-foreground">
                    {trade.marketCap > 0 && (
                      <div className="flex items-center" title="Market Cap">
                        <Activity className="w-2.5 h-2.5 mr-1 text-blue-500/70" />
                        <span>${formatNumber(trade.marketCap)}</span>
                      </div>
                    )}
                    {trade.priceChange24h !== 0 && (
                      <div className={cn(
                        "flex items-center font-medium",
                        trade.priceChange24h > 0 ? "text-green-500/70" : "text-red-500/70"
                      )} title="24h Change">
                        {trade.priceChange24h > 0 ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                        <span>{trade.priceChange24h > 0 ? '+' : ''}{trade.priceChange24h.toFixed(1)}%</span>
                      </div>
                    )}

                    {/* External Quick Links */}
                    <div className="flex items-center space-x-2 ml-2 pl-2 border-l border-border/50">
                      <a href={`https://solscan.io/token/${trade.tokenMint}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:text-foreground">
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                      <a href={`https://dexscreener.com/solana/${trade.tokenMint}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:text-foreground">
                        <Globe className="w-2.5 h-2.5" />
                      </a>
                      {trade.twitter && (
                        <a href={trade.twitter} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:text-foreground">
                          <Twitter className="w-2.5 h-2.5 text-blue-400" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Realized P&L */}
              <div className="text-right flex flex-col justify-between self-stretch">
                <div>
                  <div
                    className={cn(
                      'text-lg sm:text-xl font-bold leading-none',
                      (trade.realizedPnL || 0) >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {(trade.realizedPnL || 0) >= 0 ? '+' : ''}
                    {formatCurrency((trade.realizedPnL || 0) * solPrice)}
                  </div>
                  <div
                    className={cn(
                      'text-xs sm:text-sm font-medium mt-1',
                      (trade.realizedPnL || 0) >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {(trade.realizedPnLPercentage || 0) >= 0 ? '+' : ''}
                    {formatPercentage(trade.realizedPnLPercentage || 0)}
                  </div>
                </div>

                {trade.isSimulation && (
                  <div className="mt-auto pt-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 uppercase tracking-tight">
                      Paper
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Trade Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-background/50 rounded-lg text-xs">
              <div>
                <p className="text-muted-foreground mb-1">Price</p>
                <div className="flex flex-col">
                  <div className="flex items-center space-x-1 font-medium text-foreground">
                    <span>${formatNumber(trade.entryPrice, 8)}</span>
                    <span className="text-muted-foreground text-[10px]">→</span>
                    <span className={cn(
                      (trade.exitPrice || 0) >= trade.entryPrice ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}>
                      ${formatNumber(trade.exitPrice || 0, 8)}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Value (SOL)</p>
                <div className="flex flex-col">
                  <div className="flex items-center space-x-1 font-medium text-foreground">
                    <span>{safeFormatAmount(trade.entryValue, 4)}</span>
                    <span className="text-muted-foreground text-[10px]">→</span>
                    <span className={cn(
                      (trade.exitValue || 0) >= trade.entryValue ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {trade.exitValue ? safeFormatAmount(trade.exitValue, 4) : '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Amount</p>
                <p className="font-medium text-foreground">
                  {safeFormatAmount(trade.entryAmount, 2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Hold Time</p>
                <p className="font-medium text-foreground flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {trade.holdTime}
                </p>
              </div>
            </div>

            {/* Transaction Links */}
            {(trade.buyTransactionId || trade.sellTransactionId) && (
              <div className="flex items-center gap-2 mt-3 text-xs">
                {trade.buyTransactionId && (
                  <a
                    href={`https://solscan.io/tx/${trade.buyTransactionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center space-x-1 px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/30"
                  >
                    <span>Buy TX</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {trade.sellTransactionId && (
                  <a
                    href={`https://solscan.io/tx/${trade.sellTransactionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center space-x-1 px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/30"
                  >
                    <span>Sell TX</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {showViewAll && limit && enrichedTrades.length > limit && !showAll && (
        <Button
          variant="outline"
          className="w-full mt-2"
          size="sm"
          onClick={() => setShowAll(true)}
        >
          <Eye className="h-4 w-4 mr-2" />
          View All {enrichedTrades.length} Closed Trades
        </Button>
      )}

      {showViewAll && showAll && enrichedTrades.length > limit && (
        <Button
          variant="outline"
          className="w-full mt-2"
          size="sm"
          onClick={() => setShowAll(false)}
        >
          <Eye className="h-4 w-4 mr-2" />
          Show Less
        </Button>
      )}
    </div>
  );
};

export default ClosedTrades;
