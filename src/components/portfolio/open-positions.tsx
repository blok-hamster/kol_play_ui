'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Shield,
  RefreshCw,
  Eye,
  AlertCircle,
  Info,
} from 'lucide-react';
import { PortfolioService } from '@/services/portfolio.service';
import { useNotifications } from '@/stores/use-ui-store';
import { useTokenLazyLoading } from '@/hooks/use-token-lazy-loading';
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
  safeFormatAmount,
  cn,
} from '@/lib/utils';
import type { TradeHistoryEntry } from '@/types';

interface OpenPositionsProps {
  onTradeClick?: (trade: TradeHistoryEntry) => void;
  limit?: number;
  showHeader?: boolean;
}

const OpenPositions: React.FC<OpenPositionsProps> = ({
  onTradeClick,
  limit,
  showHeader = true,
}) => {
  const [openTrades, setOpenTrades] = useState<TradeHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { showError, showSuccess } = useNotifications();

  // Token lazy loading for metadata
  const { tokens: tokenDetails, loadTokens, getToken } = useTokenLazyLoading({
    batchSize: 10,
    maxConcurrentBatches: 2,
    cacheEnabled: true,
  });

  const fetchOpenTrades = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await PortfolioService.getOpenTrades();
      const trades = response.data || [];

      setOpenTrades(trades);

      // Load token metadata
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

  useEffect(() => {
    fetchOpenTrades();
  }, []);

  // Calculate unrealized P&L and enrich with token data
  const enrichedTrades = useMemo(() => {
    return openTrades.map(trade => {
      const tokenDetail = getToken(trade.tokenMint);
      const currentPrice = trade.currentPrice || trade.entryPrice;
      const currentValue = trade.entryAmount * currentPrice;
      const unrealizedPnL = currentValue - trade.entryValue;
      const unrealizedPnLPercentage = (unrealizedPnL / trade.entryValue) * 100;

      // Calculate hold time
      const openedAt = new Date(trade.openedAt);
      const now = new Date();
      const diffMs = now.getTime() - openedAt.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const holdTime =
        hours > 24
          ? `${Math.floor(hours / 24)}d ${hours % 24}h`
          : `${hours}h ${minutes}m`;

      return {
        ...trade,
        tokenSymbol: tokenDetail?.token?.symbol || 'UNKNOWN',
        tokenName: tokenDetail?.token?.name || 'Unknown Token',
        tokenImage: tokenDetail?.token?.image || tokenDetail?.token?.logoURI,
        verified: tokenDetail?.token?.verified || false,
        currentPrice,
        currentValue,
        unrealizedPnL,
        unrealizedPnLPercentage,
        holdTime,
      };
    });
  }, [openTrades, tokenDetails]);

  const displayedTrades = limit ? enrichedTrades.slice(0, limit) : enrichedTrades;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {showHeader && (
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              Open Positions
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
            Failed to load open positions
          </p>
        </div>
        <p className="text-sm text-destructive/80">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOpenTrades}
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
        <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground mb-2">No open positions</p>
        <p className="text-sm text-muted-foreground">
          Your active trades will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Open Positions
            <span className="ml-2 text-sm text-muted-foreground font-normal">
              ({displayedTrades.length})
            </span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchOpenTrades}
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
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {trade.tokenName}
                  </p>
                </div>
              </div>

              {/* Unrealized P&L */}
              <div className="text-right ml-2">
                <div
                  className={cn(
                    'text-lg font-bold',
                    trade.unrealizedPnL >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {trade.unrealizedPnL >= 0 ? '+' : ''}
                  {formatCurrency(trade.unrealizedPnL)}
                </div>
                <div
                  className={cn(
                    'text-sm',
                    trade.unrealizedPnL >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {trade.unrealizedPnL >= 0 ? '+' : ''}
                  {formatPercentage(trade.unrealizedPnLPercentage)}
                </div>
              </div>
            </div>

            {/* Price Info */}
            <div className="grid grid-cols-3 gap-3 mb-3 p-3 bg-background/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Entry</p>
                <p className="text-sm font-medium text-foreground">
                  {formatCurrency(trade.entryPrice)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Current</p>
                <p className="text-sm font-medium text-foreground">
                  {formatCurrency(trade.currentPrice)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Amount</p>
                <p className="text-sm font-medium text-foreground">
                  {safeFormatAmount(trade.entryAmount, 2)}
                </p>
              </div>
            </div>

            {/* Sell Conditions & Hold Time */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {trade.sellConditions.takeProfitPercentage && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded">
                  <Target className="w-3 h-3" />
                  <span>TP: +{trade.sellConditions.takeProfitPercentage}%</span>
                </div>
              )}
              {trade.sellConditions.stopLossPercentage && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded">
                  <Shield className="w-3 h-3" />
                  <span>SL: -{trade.sellConditions.stopLossPercentage}%</span>
                </div>
              )}
              {trade.sellConditions.trailingStopPercentage && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                  <TrendingUp className="w-3 h-3" />
                  <span>Trail: {trade.sellConditions.trailingStopPercentage}%</span>
                </div>
              )}
              <div className="flex items-center space-x-1 px-2 py-1 bg-muted rounded text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{trade.holdTime}</span>
              </div>
            </div>

            {/* Tags */}
            {trade.tags && trade.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-2">
                {trade.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {limit && enrichedTrades.length > limit && (
        <Button variant="outline" className="w-full">
          <Eye className="h-4 w-4 mr-2" />
          View All {enrichedTrades.length} Positions
        </Button>
      )}
    </div>
  );
};

export default OpenPositions;
