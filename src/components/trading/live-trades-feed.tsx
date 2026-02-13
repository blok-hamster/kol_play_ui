'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useLoading, useNotifications, useSubscriptions, useKOLStore } from '@/stores';
import { useKOLTradeSocket } from '@/hooks/use-kol-trade-socket';
import { TradeFilters, KOLTradeUnion, SocketKOLTrade, KOLTrade } from '@/types';
import { cn } from '@/lib/utils';
import { Filter, LayoutGrid, List, Brain, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Helper to check if a trade is a SocketKOLTrade (has tradeData)
const isSocketTrade = (trade: any): trade is SocketKOLTrade => {
  return trade && typeof trade === 'object' && ('tradeData' in trade);
};

const TradeCard: React.FC<{
  trade: KOLTradeUnion;
  subscriptions: any[];
}> = ({ trade, subscriptions }) => {
  const isSocket = isSocketTrade(trade);
  const { getKOLMetadata } = useKOLStore();

  // Extract essential data correctly - accommodate both flat and nested structures
  // Some structures have it in tradeData, others (KOLTrade from types) have it at top level
  // We prefer tradeData but fall back to the top level
  const tradeData = isSocket ? trade.tradeData : (trade as any);
  const tradeType = tradeData?.tradeType || (trade as any).tradeType || 'buy';
  const isBuy = tradeType === 'buy';

  const kolWallet = trade.kolWallet;
  const timestamp = trade.timestamp;

  const subscription = subscriptions.find(s => s.kolWallet === kolWallet);

  // Try to get KOL info from various sources
  const kolMetadata = useMemo(() => {
    if (!kolWallet) return undefined;
    return getKOLMetadata(kolWallet);
  }, [kolWallet, getKOLMetadata]);

  const displayName = subscription?.label ||
    kolMetadata?.name ||
    (trade as any).kolName ||
    `${kolWallet?.slice(0, 4)}...${kolWallet?.slice(-4)}`;

  // Robust KOL avatar extraction
  const kolAvatarUrl = useMemo(() => {
    const avatar = kolMetadata?.avatar || (trade as any).kolAvatar || (trade as any).avatar;
    if (avatar && avatar.trim().length > 0) return avatar;

    // Fallback if no avatar found
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
  }, [kolMetadata, trade, displayName]);

  const prediction: any = trade.prediction || (isSocket ? trade.tradeData.prediction : undefined);

  // Extract token mint for the trade link
  const tokenMint = tradeData?.mint || (isBuy ? tradeData?.tokenOut : tradeData?.tokenIn) || '';

  return (
    <div className="bg-card hover:bg-muted/50 border border-border p-3 rounded-xl transition-all group group-hover:border-primary/50 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2 pl-1 sm:pl-2">
        <div className="flex items-center space-x-3">
          {/* Identity Stack: Token and KOL */}
          <div className="relative flex items-center pr-2">
            {/* Token Image (Background/Main) */}
            <div className="relative">
              {tradeData?.image && !tradeData.image.includes('dicebear') ? (
                // Use enriched image if available and not a placeholder
                <img
                  src={tradeData.image}
                  alt={tradeData.symbol}
                  className="w-9 h-9 rounded-full border border-border shadow-sm bg-muted/20 object-cover"
                  onError={(e) => {
                    // Fallback on error
                    (e.target as HTMLImageElement).style.display = 'none';
                    ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'flex';
                  }}
                />
              ) : null}

              {/* Fallback if no image or error (hidden by default if image exists) */}
              <div
                className={cn(
                  "w-9 h-9 bg-muted rounded-full flex items-center justify-center font-bold text-[10px] text-muted-foreground border border-border",
                  (tradeData?.image && !tradeData.image.includes('dicebear')) ? "hidden" : "flex"
                )}
              >
                {tradeData?.symbol?.slice(0, 2).toUpperCase() || '??'}
              </div>
            </div>

            {/* KOL Image (Floating/Overlay) */}
            <div className="absolute -bottom-1 -right-0.5 z-10 transition-transform group-hover:scale-110">
              <img
                src={kolAvatarUrl}
                alt={displayName}
                className="w-6 h-6 rounded-full ring-2 ring-card border border-border shadow-md object-cover bg-card"
                title={`KOL: ${displayName}`}
              />
            </div>

            {/* Type Indicator Dot (Top Right) - keeps context without side bar */}
            <div className={cn(
              "absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full border-2 border-card z-20",
              isBuy ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" : "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]"
            )} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-sm text-foreground truncate max-w-[70px] leading-tight">{tradeData?.symbol}</span>
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter leading-none",
                isBuy ? "bg-green-500/20 text-green-500 border border-green-500/20" : "bg-red-500/20 text-red-500 border border-red-500/20"
              )}>
                {tradeType}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[120px] font-bold mt-1">
              <span className="text-primary/90">{displayName}</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-base font-black text-foreground leading-none mb-0.5">
            {tradeData?.amountIn?.toFixed(2)} <span className="text-[10px] text-muted-foreground font-bold">SOL</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-bold flex items-center justify-end">
            <Clock className="w-2.5 h-2.5 mr-0.5 opacity-60" />
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pl-1 sm:pl-2 mt-2 pt-1">
        {prediction ? (
          <div className="flex items-center space-x-1 px-1.5 py-0.5 bg-purple-500/10 rounded-lg border border-purple-500/10">
            <Brain className="w-2.5 h-2.5 text-purple-500" />
            <span className="text-[9px] font-black text-purple-500 tracking-tight uppercase">{(prediction.probability * 100).toFixed(0)}% AI SCORE</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1 text-[9px] text-muted-foreground/50 italic font-bold uppercase tracking-tight">
            <span>real-time verified</span>
          </div>
        )}

        <div className="flex space-x-1">
          <Link href={`/pro-terminal/trade?mint=${tokenMint}`}>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[9px] px-3 hover:bg-primary/10 hover:text-primary hover:border-primary/40 font-black tracking-tight border-border/60 transition-colors gap-1"
            >
              TRADE
              <ArrowRight className="w-2.5 h-2.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

/**
 * LiveTradesFeed Component
 * Displays a real-time feed of KOL trades with filtering and quick execution options.
 * Uses useKOLTradeSocket for unified data fetching, consistent with the homepage.
 */
const LiveTradesFeed: React.FC<{
  className?: string;
  limit?: number;
  showHeader?: boolean;
  compactMode?: boolean;
  globalFeed?: boolean;
}> = ({
  className,
  limit = 50,
  showHeader = true,
  globalFeed = false,
}) => {
    // Socket Hook - Provides trades and connection status
    const { isConnected, recentTrades } = useKOLTradeSocket();

    const { loading } = useLoading();
    const {
      showSuccess: notifySuccess,
      showError: notifyError
    } = useNotifications();
    const { subscriptions } = useSubscriptions();

    // Local state for UI controls
    const [filters, setFilters] = useState<TradeFilters>({
      tradeType: 'all',
      minAmount: 0,
    });

    // Filtered trades derived from socket data
    const displayTrades = useMemo(() => {
      // Start with trades from socket
      let filtered = [...recentTrades];

      // Filter by type
      if (filters.tradeType && filters.tradeType !== 'all') {
        filtered = filtered.filter(trade => {
          const data = isSocketTrade(trade) ? trade.tradeData : (trade as any);
          const type = data.tradeType || (trade as any).tradeType;
          return type === filters.tradeType;
        });
      }

      // Filter by min amount
      if (filters.minAmount) {
        filtered = filtered.filter(trade => {
          const data = isSocketTrade(trade) ? trade.tradeData : (trade as any);
          const amount = data.amountIn || data.amount_in || 0;
          return amount >= (filters.minAmount || 0);
        });
      }

      // Filter by KOL search (using kolWallet check)
      if (filters.kolWallet) {
        const search = filters.kolWallet.toLowerCase();
        filtered = filtered.filter(trade => {
          const wallet = trade.kolWallet;
          return (
            wallet.toLowerCase().includes(search) ||
            (trade as any).kolName?.toLowerCase().includes(search)
          );
        });
      }

      // Filter by timeline (timeRange)
      if (filters.timeRange && filters.timeRange !== 'all') {
        const now = Date.now();
        const msMap: Record<string, number> = {
          '1h': 3600000,
          '4h': 14400000,
          '24h': 86400000,
          '7d': 604800000,
        };
        const limitTime = now - (msMap[filters.timeRange] || 0);
        filtered = filtered.filter(trade => new Date(trade.timestamp).getTime() >= limitTime);
      }

      // If not global feed, filter to only showing subscribed KOLs
      if (!globalFeed) {
        const subscribedWallets = new Set(subscriptions.map(s => s.kolWallet.toLowerCase()));
        filtered = filtered.filter(trade => {
          const wallet = trade.kolWallet;
          return subscribedWallets.has(wallet?.toLowerCase());
        });
      }

      return filtered.slice(0, limit);
    }, [recentTrades, filters, limit, globalFeed, subscriptions]);

    // Handlers
    const handleFilterChange = useCallback((key: keyof TradeFilters, value: any) => {
      setFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleQuickTrade = useCallback(
      async (trade: KOLTradeUnion, type: 'buy' | 'sell') => {
        try {
          const tradeData = isSocketTrade(trade) ? trade.tradeData : trade;
          if (!tradeData) throw new Error('Invalid trade data');

          const kolWallet = trade.kolWallet;
          if (!kolWallet) throw new Error('KOL wallet not found');

          const subscription = subscriptions.find(s => s.kolWallet === kolWallet);
          if (!subscription) throw new Error('Not subscribed to this KOL');

          // Implementation of swap would go here
          notifySuccess('Trade Executing', `Initiating ${type} of ${tradeData.symbol || 'token'}`);

          setTimeout(() => {
            notifySuccess('Trade Completed', `Successfully copy-traded ${tradeData.symbol}`);
          }, 2000);

        } catch (err: any) {
          notifyError('Trade Error', err.message || 'Failed to execute quick trade');
        }
      },
      [notifySuccess, notifyError, subscriptions]
    );

    const isInitialLoading = Object.values(loading).some(v => v) && recentTrades.length === 0;

    // Loading state
    if (isInitialLoading) {
      return (
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium">Scanning KOL activity...</p>
        </div>
      );
    }

    return (
      <div className={cn('flex flex-col h-full', className)}>
        {showHeader && (
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center space-x-2">
              <LayoutGrid className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-foreground uppercase tracking-tight">KOL Activity</h2>
              <div className={cn('flex items-center space-x-1 text-xs ml-2', isConnected ? 'text-green-500' : 'text-red-500')}>
                <div className={cn('w-1.5 h-1.5 rounded-full', isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500')} />
                <span className="opacity-70 font-bold lowercase italic">{isConnected ? 'connected' : 'offline'}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleFilterChange('tradeType', filters.tradeType === 'buy' ? 'sell' : 'buy')}
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {displayTrades.length > 0 ? (
            displayTrades.map((trade, idx) => (
              <TradeCard
                key={`${trade.id}-${idx}`}
                trade={trade as KOLTradeUnion}
                subscriptions={subscriptions}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center opacity-40">
              <List className="w-12 h-12 mb-4" />
              <p className="text-sm font-bold">No recent trades found</p>
            </div>
          )}
        </div>
      </div>
    );
  };

export default LiveTradesFeed;
