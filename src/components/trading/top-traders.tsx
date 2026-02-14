'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Copy, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TradingService } from '@/services/trading.service';
import { useNotifications } from '@/stores/use-ui-store';
import { formatNumber, copyToClipboard, formatWalletAddress } from '@/lib/utils';
import KOLTradesModal from './kol-trades-modal';
import type { TopTrader } from '@/types';
import { useKOLStore } from '@/stores/use-kol-store';

interface TopTradersProps {
  limit?: number;
  className?: string;
  filterWallets?: string[] | null;
  compactMode?: boolean;
  viewMode?: 'grid' | 'list';
}

const TopTraders: React.FC<TopTradersProps> = ({
  limit = 50,
  className = '',
  filterWallets,
  viewMode = 'grid',
}) => {
  const [traders, setTraders] = useState<TopTrader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTrader, setSelectedTrader] = useState<TopTrader | null>(null);
  const [isTraderModalOpen, setIsTraderModalOpen] = useState(false);

  const { showSuccess, showError } = useNotifications();
  const { getKOLMetadata, ensureKOLs } = useKOLStore();
  const isCurrentlyFetching = useRef(false);

  const fetchTopTraders = useCallback(async () => {
    if (isCurrentlyFetching.current) return;
    isCurrentlyFetching.current = true;

    try {
      setIsLoading(true);
      setError(null);
      setTraders([]);

      const { authenticatedRequest } = await import('@/lib/request-manager');
      let resultTraders: TopTrader[] = [];

      if (filterWallets && Array.isArray(filterWallets)) {
        // Mode: Subscribed Only
        if (filterWallets.length === 0) {
          await useKOLStore.getState().loadAllKOLs();
          const allKOLs = Object.values(useKOLStore.getState().kolByWallet);
          resultTraders = allKOLs.map(kol => ({
            wallet: kol.walletAddress,
            summary: {
              realized: 0, unrealized: 0, total: 0, totalInvested: 0,
              totalWins: 0, totalLosses: 0, averageBuyAmount: 0,
              winPercentage: 0, lossPercentage: 0, neutralPercentage: 0
            }
          }));
        } else {
          resultTraders = filterWallets.map(wallet => ({
            wallet,
            summary: {
              realized: 0, unrealized: 0, total: 0, totalInvested: 0,
              totalWins: 0, totalLosses: 0, averageBuyAmount: 0,
              winPercentage: 0, lossPercentage: 0, neutralPercentage: 0
            }
          }));
        }
      } else {
        // Mode: Global Leaderboard
        const response = await authenticatedRequest(
          () => TradingService.getLeaderboard(limit),
          { priority: 'low', timeout: 15000 }
        );

        if (Array.isArray(response.data)) {
          resultTraders = response.data.map(item => ({
            wallet: item.address,
            summary: {
              realized: item.stats.totalPnL,
              unrealized: 0,
              total: item.stats.totalPnL,
              totalInvested: item.stats.totalVolume,
              totalWins: Math.round(item.stats.totalTrades * item.stats.winRate),
              totalLosses: Math.round(item.stats.totalTrades * (1 - item.stats.winRate)),
              averageBuyAmount: item.stats.avgTradeSize,
              winPercentage: item.stats.winRate * 100,
              lossPercentage: (1 - item.stats.winRate) * 100,
              neutralPercentage: 0
            }
          }));
        }
      }

      if (resultTraders.length > 0) {
        await ensureKOLs(resultTraders.map(t => t.wallet));
      }
      setTraders(resultTraders);
    } catch (err: any) {
      console.error('Failed to fetch top traders:', err);
      setError('Failed to load top traders data');
    } finally {
      setIsLoading(false);
      isCurrentlyFetching.current = false;
    }
  }, [limit, ensureKOLs, filterWallets]);

  useEffect(() => {
    fetchTopTraders();
  }, [fetchTopTraders]);

  const handleViewProfile = (wallet: string) => {
    const trader = traders.find(t => t.wallet === wallet);
    if (trader) {
      setSelectedTrader(trader);
      setIsTraderModalOpen(true);
    }
  };

  const handleCopyWallet = async (wallet: string) => {
    try {
      await copyToClipboard(wallet);
      showSuccess('Success', 'Wallet address copied to clipboard');
    } catch (err) {
      showError('Error', 'Failed to copy wallet address');
    }
  };

  const renderTraderCard = (trader: TopTrader, index: number) => {
    const { wallet, summary } = trader;
    const metadata = getKOLMetadata(wallet);
    const displayName = metadata?.name || formatWalletAddress(wallet);
    const avatarUrl = metadata?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${wallet}`;
    const twitterHandle = metadata?.socialLinks?.twitter
      ? metadata.socialLinks.twitter.replace('https://twitter.com/', '@').replace('https://x.com/', '@')
      : null;

    const isPositive = summary.total >= 0;

    if (viewMode === 'list') {
      return (
        <div
          key={wallet}
          className="bg-muted/10 border-b border-border/50 p-3 hover:bg-muted/20 transition-all cursor-pointer group flex items-center gap-4"
          onClick={() => handleViewProfile(wallet)}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${index === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
            index === 1 ? 'bg-gray-400/20 text-gray-400 border border-gray-400/30' :
              index === 2 ? 'bg-amber-600/20 text-amber-600 border border-amber-600/30' :
                'bg-muted/40 text-muted-foreground border border-border/30'
            }`}>
            {index + 1}
          </div>

          <div className="w-10 h-10 rounded-lg bg-black/40 overflow-hidden border border-white/5 shrink-0">
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${wallet}`; }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
              {displayName}
            </h3>
            <p className="text-xs text-muted-foreground truncate opacity-60">
              {twitterHandle || formatWalletAddress(wallet)}
            </p>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase">Win Rate</p>
              <p className="text-sm font-semibold">{formatNumber(summary.winPercentage, 0)}%</p>
            </div>
            <div className="text-right min-w-[80px]">
              <p className="text-[10px] text-muted-foreground uppercase">Total PnL</p>
              <p className={`text-sm font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{summary.total.toFixed(2)} SOL
              </p>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-all">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={(e) => { e.stopPropagation(); handleCopyWallet(wallet); }}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={wallet}
        className="bg-muted/20 backdrop-blur-sm border border-border/50 rounded-xl p-2.5 hover:border-primary/30 hover:bg-muted/30 transition-all duration-200 cursor-pointer group"
        onClick={() => handleViewProfile(wallet)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${index === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
            index === 1 ? 'bg-gray-400/20 text-gray-400 border border-gray-400/30' :
              index === 2 ? 'bg-amber-600/20 text-amber-600 border border-amber-600/30' :
                'bg-muted/40 text-muted-foreground border border-border/30'
            }`}>
            #{index + 1}
          </div>

          <div className="w-9 h-9 rounded-lg bg-black/40 overflow-hidden border border-white/5 shrink-0">
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${wallet}`; }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-xs truncate group-hover:text-primary transition-colors">
              {displayName}
            </h3>
            <p className="text-[10px] text-muted-foreground truncate opacity-60">
              {twitterHandle || formatWalletAddress(wallet)}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden xs:block">
              <p className="text-[9px] text-muted-foreground uppercase">Win</p>
              <p className="text-xs font-semibold">{formatNumber(summary.winPercentage, 0)}%</p>
            </div>
            <div className="text-right min-w-[60px]">
              <p className="text-[9px] text-muted-foreground uppercase">PnL</p>
              <p className={`text-xs font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{summary.total.toFixed(1)}
              </p>
            </div>
            <div className="hidden group-hover:block transition-all">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); handleCopyWallet(wallet); }}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className={className}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-800 dark:text-red-200 mb-4 text-sm">{error}</p>
          <Button onClick={fetchTopTraders} variant="outline" size="sm">Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {isLoading ? (
        <div className={viewMode === 'list' ? "space-y-3" : "grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={viewMode === 'list' ? "h-14 bg-muted/20 animate-pulse rounded-lg border border-border/50" : "h-20 bg-muted/20 animate-pulse rounded-xl border border-border/50"} />
          ))}
        </div>
      ) : traders.length > 0 ? (
        <div className={viewMode === 'list' ? "flex flex-col border border-border/50 rounded-xl overflow-hidden bg-background/50 backdrop-blur-sm" : "grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}>
          {traders.map(renderTraderCard)}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border/50 rounded-2xl">
          <Award className="w-10 h-10 mx-auto mb-3 opacity-10" />
          <p className="font-bold uppercase tracking-widest text-[10px] opacity-40">No top traders found</p>
        </div>
      )}

      {selectedTrader && (
        <KOLTradesModal
          isOpen={isTraderModalOpen}
          onClose={() => setIsTraderModalOpen(false)}
          trader={selectedTrader}
          walletAddress={selectedTrader.wallet}
        />
      )}
    </div>
  );
};

export default TopTraders;
