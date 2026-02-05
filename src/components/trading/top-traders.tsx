'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp,
  Award,
  Copy,
  ExternalLink,
  Grid3X3,
  TableProperties,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TradingService } from '@/services/trading.service';
import { useNotifications } from '@/stores/use-ui-store';
import { formatNumber, copyToClipboard, formatWalletAddress } from '@/lib/utils';
import KOLTradesModal from './kol-trades-modal';
import type { TopTrader } from '@/types';
import { useKOLStore } from '@/stores/use-kol-store';
import { AnalyticsService } from '@/services/analytics.service';

interface TopTradersProps {
  limit?: number;
  title?: string;
  className?: string;
  filterWallets?: string[] | null;
  compactMode?: boolean;
}

interface ViewTab {
  id: 'cards' | 'table';
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TopTraders: React.FC<TopTradersProps> = ({
  limit = 50,
  title = 'Top Solana Traders',
  className = '',
  filterWallets,
  compactMode = false,
}) => {
  const [traders, setTraders] = useState<TopTrader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'cards' | 'table'>('cards');

  const [selectedTrader, setSelectedTrader] = useState<TopTrader | null>(null);
  const [isTraderModalOpen, setIsTraderModalOpen] = useState(false);

  const { showSuccess, showError } = useNotifications();
  const { getKOLMetadata, ensureKOLs } = useKOLStore();
  const isCurrentlyFetching = useRef(false);

  const viewTabs: ViewTab[] = [
    {
      id: 'cards',
      label: 'Cards View',
      icon: <Grid3X3 className="w-5 h-5" />,
      description: 'Grid layout with detailed trader cards',
    },
    {
      id: 'table',
      label: 'Table View',
      icon: <TableProperties className="w-5 h-5" />,
      description: 'Compact table format for quick comparison',
    },
  ];

  const fetchTopTraders = useCallback(async () => {
    if (isCurrentlyFetching.current) return;
    isCurrentlyFetching.current = true;

    try {
      setIsLoading(true);
      setError(null);
      setTraders([]); // Clear previous data

      const { authenticatedRequest } = await import('@/lib/request-manager');
      // AnalyticsService is already imported at top level, but dynamic import pattern was used before.
      // We can use the top-level import now.

      let resultTraders: TopTrader[] = [];

      if (filterWallets && Array.isArray(filterWallets)) {
        // MODE: Subscribed Only (Filtered)
        if (filterWallets.length === 0) {
          // Fallback: Load all available KOLs when no subscriptions
          console.log('[TopTraders] No subscriptions found, loading all KOLs as fallback');
          try {
            await useKOLStore.getState().loadAllKOLs();
            const allKOLs = Object.values(useKOLStore.getState().kolByWallet);

            // Create trader entries from KOL data (with default stats)
            resultTraders = allKOLs.map(kol => ({
              wallet: kol.walletAddress,
              summary: {
                realized: 0,
                unrealized: 0,
                total: 0,
                totalInvested: 0,
                totalWins: 0,
                totalLosses: 0,
                averageBuyAmount: 0,
                winPercentage: 0,
                lossPercentage: 0,
                neutralPercentage: 0
              }
            }));
          } catch (kolError) {
            console.warn('[TopTraders] Failed to load KOLs for empty subscriptions:', kolError);
            // If loading KOLs fails, just show empty state
            resultTraders = [];
          }

          setTraders(resultTraders);
          setIsLoading(false);
          isCurrentlyFetching.current = false;
          return;
        }


        // Fetch stats for each wallet in parallel
        const statsPromises = filterWallets.map(async (wallet) => {
          try {
            const stats = await AnalyticsService.getWalletStats(wallet);
            if (stats) {
              return {
                wallet,
                summary: {
                  realized: stats.totalPnL,
                  unrealized: 0, // Not available in simple stats
                  total: stats.totalPnL,
                  totalInvested: stats.totalVolume,
                  totalWins: Math.round(stats.totalTrades * stats.winRate),
                  totalLosses: Math.round(stats.totalTrades * (1 - stats.winRate)),
                  averageBuyAmount: stats.avgTradeSize,
                  winPercentage: stats.winRate * 100,
                  lossPercentage: (1 - stats.winRate) * 100,
                  neutralPercentage: 0
                }
              } as TopTrader;
            }
          } catch (statsError) {
            console.warn(`[TopTraders] Failed to fetch stats for wallet ${wallet}:`, statsError);
          }
          return null;
        });

        const results = await Promise.all(statsPromises);
        resultTraders = results.filter((t): t is TopTrader => t !== null);

        // Sort by PnL Descending
        resultTraders.sort((a, b) => b.summary.total - a.summary.total);

      } else {
        // MODE: Global Leaderboard
        try {
          const response = await authenticatedRequest(
            () => TradingService.getLeaderboard(limit),
            { priority: 'low', timeout: 15000 }
          );

          if (Array.isArray(response.data) && response.data.length > 0) {
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
          } else {
            // Fallback: Load all available KOLs when leaderboard is empty
            console.log('[TopTraders] Leaderboard empty, loading all KOLs as fallback');
            await useKOLStore.getState().loadAllKOLs();
            const allKOLs = Object.values(useKOLStore.getState().kolByWallet);

            resultTraders = allKOLs.map(kol => ({
              wallet: kol.walletAddress,
              summary: {
                realized: 0,
                unrealized: 0,
                total: 0,
                totalInvested: 0,
                totalWins: 0,
                totalLosses: 0,
                averageBuyAmount: 0,
                winPercentage: 0,
                lossPercentage: 0,
                neutralPercentage: 0
              }
            }));
          }
        } catch (leaderboardError) {
          // If leaderboard fails, fallback to all KOLs
          console.log('[TopTraders] Leaderboard failed, loading all KOLs as fallback:', leaderboardError);
          await useKOLStore.getState().loadAllKOLs();
          const allKOLs = Object.values(useKOLStore.getState().kolByWallet);

          resultTraders = allKOLs.map(kol => ({
            wallet: kol.walletAddress,
            summary: {
              realized: 0,
              unrealized: 0,
              total: 0,
              totalInvested: 0,
              totalWins: 0,
              totalLosses: 0,
              averageBuyAmount: 0,
              winPercentage: 0,
              lossPercentage: 0,
              neutralPercentage: 0
            }
          }));
        }
      }

      // Metadata loading
      if (resultTraders.length > 0) {
        const addresses = resultTraders.map(t => t.wallet);
        await ensureKOLs(addresses);
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

  // Render trader card - Compact list format
  const renderTraderCard = (trader: TopTrader, index: number) => {
    const { wallet, summary } = trader;
    const metadata = getKOLMetadata(wallet);
    const displayName = metadata?.name || formatWalletAddress(wallet);
    const avatarUrl = metadata?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${wallet}`;
    const twitterHandle = metadata?.socialLinks?.twitter
      ? metadata.socialLinks.twitter.replace('https://twitter.com/', '@').replace('https://x.com/', '@')
      : null;

    const isPositive = summary.total >= 0;
    const roi = summary.totalInvested > 0 ? (summary.total / summary.totalInvested) * 100 : 0;
    const totalTrades = summary.totalWins + summary.totalLosses;

    return (
      <div
        key={wallet}
        className="bg-muted/20 backdrop-blur-sm border border-border/50 rounded-lg p-2.5 hover:border-primary/30 hover:bg-muted/30 transition-all duration-200 cursor-pointer group"
        onClick={() => handleViewProfile(wallet)}
      >
        <div className="flex items-center gap-3">
          {/* Rank Badge */}
          <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${index === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
            index === 1 ? 'bg-gray-400/20 text-gray-400 border border-gray-400/30' :
              index === 2 ? 'bg-amber-600/20 text-amber-600 border border-amber-600/30' :
                'bg-muted/40 text-muted-foreground border border-border/30'
            }`}>
            #{index + 1}
          </div>

          {/* Avatar */}
          <div className="w-9 h-9 rounded-lg bg-black/40 overflow-hidden border border-white/5 group-hover:border-primary/20 transition-colors shrink-0">
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${wallet}`;
              }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-xs truncate group-hover:text-primary transition-colors">
              {displayName}
            </h3>
            {twitterHandle ? (
              <p className="text-[10px] text-blue-400/80 truncate">{twitterHandle}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground font-mono truncate opacity-60">
                {formatWalletAddress(wallet)}
              </p>
            )}
          </div>

          {/* Stats - Compact */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Win Rate */}
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Win</p>
              <p className="text-xs font-semibold">{formatNumber(summary.winPercentage, 0)}%</p>
            </div>

            {/* Trades */}
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Trades</p>
              <p className="text-xs font-semibold">{totalTrades}</p>
            </div>

            {/* PnL */}
            <div className="text-right min-w-[60px]">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">PnL</p>
              <p className={`text-xs font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{summary.total.toFixed(1)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); handleCopyWallet(wallet); }}
              >
                <Copy className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); window.open(`https://solscan.io/account/${wallet}`, '_blank'); }}
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render table view
  const renderTableView = () => (
    <div className="bg-background border border-border rounded-xl overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30 border-b border-border">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-4 font-semibold">Rank</th>
              <th className="px-6 py-4 font-semibold">Trader</th>
              <th className="px-6 py-4 font-semibold text-right">Total PnL (SOL)</th>
              <th className="px-6 py-4 font-semibold text-right">ROI</th>
              <th className="px-6 py-4 font-semibold text-right">Win Rate</th>
              <th className="px-6 py-4 font-semibold text-right">Trades</th>
              <th className="px-6 py-4 font-semibold text-right">Volume (SOL)</th>
              <th className="px-6 py-4 font-semibold text-center">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td colSpan={8} className="px-6 py-4">
                    <div className="h-8 bg-muted/50 rounded animate-pulse w-full" />
                  </td>
                </tr>
              ))
            ) : traders.length > 0 ? (
              traders.map((trader, index) => {
                const { wallet, summary } = trader;
                const metadata = getKOLMetadata(wallet);
                const displayName = metadata?.name || formatWalletAddress(wallet);
                const avatarUrl = metadata?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${wallet}`;

                const isPositive = summary.total >= 0;
                const roi = summary.totalInvested > 0 ? (summary.total / summary.totalInvested) * 100 : 0;

                return (
                  <tr
                    key={wallet}
                    className="hover:bg-muted/20 transition-colors cursor-pointer group"
                    onClick={() => handleViewProfile(wallet)}
                  >
                    {/* Rank */}
                    <td className="px-6 py-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-yellow-500/10 text-yellow-500' :
                        index === 1 ? 'bg-gray-400/10 text-gray-400' :
                          index === 2 ? 'bg-amber-600/10 text-amber-600' :
                            'text-muted-foreground'
                        }`}>
                        #{index + 1}
                      </div>
                    </td>

                    {/* Trader */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={avatarUrl}
                          className="w-8 h-8 rounded-full bg-muted object-cover"
                          alt={displayName}
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${wallet}`; }}
                        />
                        <div>
                          <p className="font-semibold text-sm text-foreground">{displayName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{formatWalletAddress(wallet)}</p>
                        </div>
                      </div>
                    </td>

                    {/* Total PnL */}
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{summary.total.toFixed(2)}
                      </span>
                    </td>

                    {/* ROI */}
                    <td className="px-6 py-4 text-right">
                      <span className={`font-medium ${roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {roi >= 0 ? '+' : ''}{formatNumber(roi, 1)}%
                      </span>
                    </td>

                    {/* Win Rate */}
                    <td className="px-6 py-4 text-right font-medium">
                      {formatNumber(summary.winPercentage, 1)}%
                    </td>

                    {/* Trades */}
                    <td className="px-6 py-4 text-right text-muted-foreground">
                      {summary.totalWins + summary.totalLosses}
                    </td>

                    {/* Volume */}
                    <td className="px-6 py-4 text-right font-mono text-xs">
                      {formatNumber(summary.totalInvested, 2)}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleCopyWallet(wallet); }}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); window.open(`https://solscan.io/account/${wallet}`, '_blank'); }}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                  No traders found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-800 dark:text-red-200 mb-4">{error}</p>
          <Button onClick={fetchTopTraders} variant="outline">Try Again</Button>
        </div>
      </div>
    );
  }

  const activeTab = viewTabs.find(tab => tab.id === activeView)!;

  return (
    <div className={`space-y-4 sm:space-y-6 ${className}`}>
      {/* Page Header - Hidden in Compact Mode */}
      {!compactMode && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {title}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
              Explore top performing traders on Solana with detailed analytics
            </p>
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">Updated every hour</div>
        </div>
      )}

      {/* View Selection - Hidden in Compact Mode */}
      {!compactMode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {viewTabs.map(tab => (
            <button
              key={tab.id}
              className={`text-left p-3 sm:p-4 rounded-lg border-2 transition-all duration-200 ${activeView === tab.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-muted-foreground bg-background'
                }`}
              onClick={() => setActiveView(tab.id)}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${activeView === tab.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {tab.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">{tab.label}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{tab.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Active View Display */}
      <div className={compactMode ? "" : "bg-background rounded-lg border border-border"}>
        {!compactMode && (
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">{activeTab.icon}</div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">{activeTab.label}</h2>
                <p className="text-sm text-muted-foreground">{activeTab.description}</p>
              </div>
            </div>
          </div>
        )}

        <div className={compactMode ? "space-y-3" : "p-3 sm:p-6"}>
          {activeView === 'cards' ? (
            isLoading ? (
              <div className={compactMode ? "space-y-3" : "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={compactMode ? "h-24 bg-muted/20 animate-pulse rounded-xl" : "h-64 bg-muted/20 animate-pulse rounded-xl border border-border/50"} />
                ))}
              </div>
            ) : traders.length > 0 ? (
              <div className={compactMode ? "space-y-3" : "grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}>
                {traders.map(renderTraderCard)}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">No traders found</div>
            )
          ) : (
            renderTableView()
          )}
        </div>
      </div>

      {/* KOL Trades Modal */}
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
