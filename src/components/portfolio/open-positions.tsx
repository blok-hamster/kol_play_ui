'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Clock,
  Target,
  Shield,
  RefreshCw,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { PortfolioService } from '@/services/portfolio.service';
import { SolanaService } from '@/services/solana.service';
import { useNotifications } from '@/stores/use-ui-store';
import { useTokenLazyLoading } from '@/hooks/use-token-lazy-loading';
import {
  formatCurrency,
  formatPercentage,
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
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [solPrice, setSolPrice] = useState<number>(0);

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
        tokenSymbol: tokenDetail?.token?.symbol || `${trade.tokenMint.slice(0, 4)}...${trade.tokenMint.slice(-4)}`,
        tokenName: tokenDetail?.token?.name || `${trade.tokenMint.slice(0, 8)}...${trade.tokenMint.slice(-8)}`,
        tokenImage: tokenDetail?.token?.image || tokenDetail?.token?.logoURI,
        verified: tokenDetail?.token?.verified || false,
        currentPrice,
        currentValue,
        unrealizedPnL, // This is in SOL
        unrealizedPnLPercentage,
        holdTime,
      };
    });
  }, [openTrades, tokenDetails]);

  const displayedTrades = limit ? enrichedTrades.slice(0, limit) : enrichedTrades;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {showHeader && (
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-foreground">
              Open Positions
            </h3>
          </div>
        )}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-muted/20 border border-border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div>
                  <div className="h-4 bg-muted rounded w-16 mb-1"></div>
                  <div className="h-3 bg-muted rounded w-24"></div>
                </div>
              </div>
              <div className="h-4 bg-muted rounded w-16"></div>
            </div>
          </div>
        ))}
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
      <div className="text-center py-6">
        <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No open positions</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center justify-between">
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

      {isExpanded && (
        <div className="space-y-1">
          {displayedTrades.map(trade => (
            <div
              key={trade.id}
              onClick={() => onTradeClick?.(trade)}
              className={cn(
                'bg-muted/20 border border-border rounded-lg p-3',
                'hover:bg-muted/40 hover:border-muted-foreground transition-all duration-200',
                onTradeClick && 'cursor-pointer'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left: Token Info */}
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  {/* Token Icon - Smaller */}
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
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

                  {/* Token Symbol & Price Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1">
                      <span className="font-semibold text-foreground text-sm">
                        {trade.tokenSymbol}
                      </span>
                      {trade.verified && (
                        <div className="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center" title="Verified">
                          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <span>{formatCurrency(trade.entryPrice)} → {formatCurrency(trade.currentPrice)}</span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {trade.holdTime}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle: Sell Conditions */}
                <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                  {trade.sellConditions.takeProfitPercentage && (
                    <div className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded text-xs">
                      TP: +{trade.sellConditions.takeProfitPercentage}%
                    </div>
                  )}
                  {trade.sellConditions.stopLossPercentage && (
                    <div className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-xs">
                      SL: -{trade.sellConditions.stopLossPercentage}%
                    </div>
                  )}
                </div>

                {/* Right: P&L */}
                <div className="text-right flex-shrink-0">
                  <div
                    className={cn(
                      'text-sm font-bold',
                      trade.unrealizedPnL >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {trade.unrealizedPnL >= 0 ? '+' : ''}
                    {formatCurrency(trade.unrealizedPnL * solPrice)}
                  </div>
                  <div
                    className={cn(
                      'text-xs',
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
