'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Target,
  RefreshCw,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { PortfolioService } from '@/services/portfolio.service';
import { SolanaService } from '@/services/solana.service';
import { useNotifications } from '@/stores/use-ui-store';
import AuthService from '@/services/auth.service';
import { useTokenLazyLoading } from '@/hooks/use-token-lazy-loading';
import { useEnhancedWebSocket } from '@/hooks/use-enhanced-websocket';
import {
  formatCurrency,
  formatPercentage,
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
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [solPrice, setSolPrice] = useState<number>(0);

  const token = AuthService.getToken();
  const { connect, disconnect } = useEnhancedWebSocket({
    auth: {
      token: token || undefined
    }
  });

  // Connect WebSocket on mount (ONCE)
  useEffect(() => {
    console.log('🔌 [OpenPositions] Mounting and connecting WebSocket...');
    connect();

    return () => {
      console.log('🔌 [OpenPositions] Unmounting and disconnecting...');
      disconnect();
    };
  }, []); // Empty dependency array is CRITICAL to avoid loops

  // Paper Balance State
  const [paperBalance, setPaperBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const { showError, showSuccess } = useNotifications();
  const [sellingTradeId, setSellingTradeId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Helper: Fetch Balance
  const fetchPaperBalance = async () => {
    try {
      setBalanceLoading(true);
      setBalanceError(null);
      const res = await PortfolioService.getPaperBalance();
      console.log('💰 Paper Balance Response:', res);

      if (res.data && res.data.SOL !== undefined) {
        setPaperBalance(res.data.SOL);
      } else {
        // Fallback or just ignore if structure is weird, but log it
        console.warn('Paper Balance response missing SOL key:', res.data);
      }
    } catch (e: any) {
      console.error('Failed to fetch paper balance', e);
      setBalanceError('Failed to load');
      setPaperBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleResetPaper = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to reset your Paper Trading wallet to 100 SOL? This cannot be undone.')) return;

    setIsResetting(true);
    try {
      await PortfolioService.resetPaperAccount();
      showSuccess('Reset Successful', 'Paper wallet reset to 100 SOL.');
      fetchPaperBalance();
    } catch (err: any) {
      showError('Reset Failed', err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleInstantSell = async (trade: TradeHistoryEntry) => {
    try {
      setSellingTradeId(trade.id);

      // Calculate amount to sell (sell entire position)
      // Note: In real scenarios, might want a modal to choose amount. For now: 100%.
      const amountToSell = trade.entryAmount; // Or current token balance if tracked differently

      await PortfolioService.performSwap({
        tradeType: 'sell',
        mint: trade.tokenMint,
        amount: amountToSell, // Sell 100%
        tradeId: trade.id,
      });

      showSuccess('Order Placed', `Sell order for ${trade.tokenMint.slice(0, 4)}... sent successfully.`);

      // Optimistically remove from list or wait for refresh? 
      // Waiting for refresh is safer for sync.
      // But let's trigger a refresh after a short delay
      setTimeout(() => {
        fetchOpenTrades();
        fetchPaperBalance();
      }, 2000);

    } catch (err: any) {
      console.error('Failed to sell:', err);
      showError('Sell Failed', err.message || 'Could not execute sell order');
    } finally {
      setSellingTradeId(null);
    }
  };

  // Fetch SOL price & Paper Balance
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
    // Intentionally delay balance fetch slightly to let auth settle if needed
    setTimeout(fetchPaperBalance, 500);
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
      console.log('📥 [API] Initial trades:', { count: trades.length, firstTrade: trades[0] });

      // Dedup trades based on ID
      const uniqueTrades = Array.from(new Map(trades.map((t: TradeHistoryEntry) => [t.id, t])).values());

      setOpenTrades(uniqueTrades as TradeHistoryEntry[]);

      // Load token metadata
      const tokenMints = trades.map(trade => trade.tokenMint).filter(Boolean);
      if (tokenMints.length > 0) {
        loadTokens(tokenMints);
      }

      // Also refresh balance when trades update
      fetchPaperBalance();

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

  // Listen for Real-Time Updates
  useEffect(() => {
    console.log('🔌 [WebSocket] Setting up event listener for kolplay_user_event');

    const handleUserEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const event = customEvent.detail;

      if (!event || !event.type) return;

      console.log('📡 [WebSocket] Event received:', event.type);
      console.log('📊 [WebSocket] Full data:', JSON.stringify(event.data, null, 2));

      if (event.type === 'POSITION_UPDATE') {
        const { tradeId, pnl, pnlPercent, currentPrice } = event.data;
        console.log(`🔄 [POSITION_UPDATE] Detailed:`, {
          tradeId,
          pnl,
          pnlPercent,
          currentPrice,
          dataType: typeof currentPrice
        });
        setOpenTrades(prev => prev.map(t => {
          if (t.id === tradeId || t.originalTradeId === tradeId) {
            console.log(`✅ [POSITION_UPDATE] Matched trade ${tradeId}! Updating from:`, {
              oldPrice: t.currentPrice,
              newPrice: currentPrice,
              oldPnL: t.unrealizedPnL,
              newPnL: pnl
            });
            return {
              ...t,
              currentPrice: currentPrice,
              unrealizedPnL: pnl, // Backend sends absolute PnL
              unrealizedPnLPercentage: pnlPercent,
              // Note: enrichedTrades will recalculate based on these
            };
          }
          return t;
        }));
      } else if (event.type === 'TRADE_OPENED') {
        // Add new trade to list from WebSocket (real-time)
        const { trade } = event.data;
        console.log(`✨ [TRADE_OPENED] Trade details:`, {
          id: trade.id,
          tokenMint: trade.tokenMint,
          entryPrice: trade.entryPrice,
          currentPrice: trade.currentPrice,
          entryAmount: trade.entryAmount
        });

        // Check if trade already exists to prevent duplicates
        setOpenTrades(prev => {
          const exists = prev.some(t => t.id === trade.id);
          if (exists) {
            console.log(`  Trade ${trade.id} already in list, skipping`);
            return prev;
          }

          // Add new trade to the beginning of the list
          const newTrade: TradeHistoryEntry = {
            ...trade,
            openedAt: new Date(trade.openedAt), // Convert string to Date
          };

          return [newTrade, ...prev];
        });

        // Load token metadata for the new trade
        if (trade.tokenMint) {
          loadTokens([trade.tokenMint]);
        }

        // Refresh balance
        fetchPaperBalance();

      } else if (event.type === 'POSITION_CLOSED') {
        const { tradeId } = event.data;
        console.log(`🔒 [POSITION_CLOSED] Removing trade:`, tradeId);
        setOpenTrades(prev => {
          const before = prev.length;
          const filtered = prev.filter(t => t.id !== tradeId && t.originalTradeId !== tradeId);
          console.log(`   ✅ Removed. Trades: ${before} → ${filtered.length}`);
          return filtered;
        });
        showSuccess('Position Closed', 'Trade closed successfully via automation.');
        fetchPaperBalance();
      } else if (event.type === 'TRADE_SUBMITTED') {
        // Optional: Refresh list or add optimistic trade
        // For now, let's just refresh to be safe and avoid "double calling" logic
        // fetchOpenTrades(); 
        // But simpler to ignore if we trust fetchOpenTrades works on mount
        setTimeout(fetchPaperBalance, 1000);
      }
    };

    window.addEventListener('kolplay_user_event', handleUserEvent);
    return () => window.removeEventListener('kolplay_user_event', handleUserEvent);
  }, []);

  // Calculate unrealized P&L and enrich with token data
  const enrichedTrades = useMemo(() => {
    return openTrades.map(trade => {
      const tokenDetail = getToken(trade.tokenMint);

      // Use values directly from trade if updated via WebSocket, otherwise calculate
      const currentPrice = trade.currentPrice || trade.entryPrice;
      const currentValue = trade.currentValue || (trade.entryAmount * currentPrice);

      // Prioritize the PnL from the backend/WebSocket as it's the source of truth
      const unrealizedPnL = trade.unrealizedPnL !== undefined ? trade.unrealizedPnL : (currentValue - trade.entryValue);
      const unrealizedPnLPercentage = trade.unrealizedPnLPercentage !== undefined ? trade.unrealizedPnLPercentage : ((unrealizedPnL / trade.entryValue) * 100);

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

  // Header Logic
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
          <span className="text-xs font-medium text-muted-foreground">
            Paper Bal: <span className="text-foreground font-bold">
              {balanceLoading ? (
                <RefreshCw className="h-3 w-3 animate-spin inline ml-1" />
              ) : paperBalance !== null ? (
                formatCurrency(paperBalance)
              ) : balanceError ? (
                <span className="text-destructive">Err</span>
              ) : (
                '...'
              )}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetPaper}
            disabled={isResetting || balanceLoading}
            className="h-5 px-1.5 text-[10px] hover:bg-muted"
            title="Reset Paper Wallet to 100 SOL"
          >
            {isResetting ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Reset'}
          </Button>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { fetchOpenTrades(); fetchPaperBalance(); }}
        className="text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Refresh
      </Button>
    </div>
  );

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
      <div className="space-y-2">
        {showHeader && renderHeader()}
        <div className="text-center py-6">
          <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No open positions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showHeader && renderHeader()}

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
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground font-mono">
                      <span>${(trade.entryPrice || 0).toFixed(8)} → ${(trade.currentPrice || 0).toFixed(8)}</span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {trade.holdTime}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-0.5 font-mono">
                      <span>Val: {safeFormatAmount(trade.entryValue, 4)} SOL → {safeFormatAmount(trade.currentValue || (trade.entryAmount * (trade.currentPrice || trade.entryPrice)), 4)} SOL</span>
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

                {/* Right: P&L & Actions */}
                <div className="text-right flex-shrink-0 flex items-center gap-3">
                  <div>
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

                  {/* Sell Button */}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 px-3"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent row click
                      handleInstantSell(trade);
                    }}
                    disabled={sellingTradeId === trade.id}
                  >
                    {sellingTradeId === trade.id ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      "Sell"
                    )}
                  </Button>
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
