'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp,
  Award,
  Eye,
  Copy,
  ExternalLink,
  Grid3X3,
  TableProperties,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TradingService } from '@/services/trading.service';
import { useNotifications } from '@/stores/use-ui-store';
import { formatCurrency, formatNumber, copyToClipboard } from '@/lib/utils';
import KOLTradesModal from './kol-trades-modal';
import type { TopTrader } from '@/types';

interface TopTradersProps {
  limit?: number;
  title?: string;
  className?: string;
}

interface ViewTab {
  id: 'cards' | 'table';
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TopTraders: React.FC<TopTradersProps> = ({
  limit = 10,
  title = 'Top Solana Traders',
  className = '',
}) => {
  const [traders, setTraders] = useState<TopTrader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'cards' | 'table'>('cards');

  // Modal state
  const [selectedTrader, setSelectedTrader] = useState<TopTrader | null>(null);
  const [isTraderModalOpen, setIsTraderModalOpen] = useState(false);

  // Track loading and prevent multiple calls
  const hasLoadedInitialData = useRef(false);
  const isCurrentlyFetching = useRef(false);

  const { showWarning, showSuccess, showError } = useNotifications();

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
    // Prevent multiple simultaneous calls only if already loading
    if (isCurrentlyFetching.current) {
      return;
    }

    isCurrentlyFetching.current = true;

    try {
      setIsLoading(true);
      setError(null);

      const response = await TradingService.getTopTraders();
      setTraders(response.data.slice(0, limit));
      hasLoadedInitialData.current = true;
    } catch (err: any) {
      console.error('Failed to fetch top traders:', err);

      // Use mock data as fallback
      const mockTraders: TopTrader[] = [
        {
          wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          summary: {
            realized: 45000,
            unrealized: 12000,
            total: 57000,
            totalInvested: 25000,
            totalWins: 42,
            totalLosses: 18,
            averageBuyAmount: 1250,
            winPercentage: 70.0,
            lossPercentage: 30.0,
            neutralPercentage: 0.0,
          },
        },
        {
          wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          summary: {
            realized: 32000,
            unrealized: 8000,
            total: 40000,
            totalInvested: 18000,
            totalWins: 35,
            totalLosses: 15,
            averageBuyAmount: 980,
            winPercentage: 70.0,
            lossPercentage: 30.0,
            neutralPercentage: 0.0,
          },
        },
        {
          wallet: 'Bbe7U8d4tGVfcbPz4rJWvGiMzSoEdgeJmZPx2LAb2mRD',
          summary: {
            realized: 28000,
            unrealized: 5000,
            total: 33000,
            totalInvested: 15000,
            totalWins: 28,
            totalLosses: 12,
            averageBuyAmount: 750,
            winPercentage: 70.0,
            lossPercentage: 30.0,
            neutralPercentage: 0.0,
          },
        },
        {
          wallet: '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S',
          summary: {
            realized: 22000,
            unrealized: 3000,
            total: 25000,
            totalInvested: 12000,
            totalWins: 24,
            totalLosses: 16,
            averageBuyAmount: 600,
            winPercentage: 60.0,
            lossPercentage: 40.0,
            neutralPercentage: 0.0,
          },
        },
        {
          wallet: 'DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6zDqNrbs4bFkCkSAB',
          summary: {
            realized: 18000,
            unrealized: 2000,
            total: 20000,
            totalInvested: 10000,
            totalWins: 20,
            totalLosses: 12,
            averageBuyAmount: 500,
            winPercentage: 62.5,
            lossPercentage: 37.5,
            neutralPercentage: 0.0,
          },
        },
        {
          wallet: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
          summary: {
            realized: 15000,
            unrealized: 1500,
            total: 16500,
            totalInvested: 8000,
            totalWins: 18,
            totalLosses: 14,
            averageBuyAmount: 400,
            winPercentage: 56.25,
            lossPercentage: 43.75,
            neutralPercentage: 0.0,
          },
        },
      ];

      setTraders(mockTraders.slice(0, limit));
      showWarning('Info', 'Using demo data for top traders');
      setError('Failed to load live data, showing demo traders');
    } finally {
      setIsLoading(false);
      isCurrentlyFetching.current = false;
    }
  }, [limit, showWarning]);

  useEffect(() => {
    fetchTopTraders();
  }, []);

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

  // Render trader card (mobile-optimized)
  const renderTraderCard = (trader: TopTrader, index: number) => {
    const { wallet, summary } = trader;
    const isPositive = summary.total >= 0;
    const roi =
      summary.totalInvested > 0
        ? (summary.total / summary.totalInvested) * 100
        : 0;

    return (
      <div
        key={wallet}
        className="bg-background border border-border rounded-xl p-3 sm:p-4 hover:border-muted-foreground transition-all duration-200 cursor-pointer group"
        onClick={() => handleViewProfile(wallet)}
      >
        {/* Header - Rank and PnL */}
        <div className="flex items-center justify-between mb-3">
          {/* Rank Badge */}
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm border-2 border-muted ${
              index === 0
                ? 'bg-yellow-500 text-yellow-900'
                : index === 1
                  ? 'bg-gray-400 text-gray-900'
                  : index === 2
                    ? 'bg-orange-500 text-orange-900'
                    : 'bg-gradient-to-br from-primary to-secondary text-primary-foreground'
            }`}
          >
            {index < 3 ? (
              <Award className="w-4 h-4 sm:w-6 sm:h-6" />
            ) : (
              <span className="text-xs sm:text-sm">#{index + 1}</span>
            )}
          </div>

          {/* Total PnL - Most Important Info */}
          <div className="text-right">
            <div
              className={`font-bold text-lg sm:text-xl ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
            >
              {isPositive ? '+' : ''}
              {formatCurrency(summary.total)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatNumber(roi, 1)}% ROI
            </div>
          </div>
        </div>

        {/* Essential Stats */}
        <div className="space-y-2">
          {/* Win Rate and Trades */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-foreground">
                {formatNumber(summary.winPercentage, 1)}% win rate
              </span>
              <span className="text-muted-foreground">
                ({summary.totalWins + summary.totalLosses} trades)
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 sm:px-3"
              onClick={e => {
                e.stopPropagation();
                handleViewProfile(wallet);
              }}
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">View</span>
            </Button>
          </div>

          {/* Wallet Address - Hidden on very small screens */}
          <div className="hidden sm:flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono">
              {wallet.slice(0, 6)}...{wallet.slice(-4)}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleCopyWallet(wallet);
                }}
                className="p-1 hover:text-foreground transition-colors"
                title="Copy wallet address"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  window.open(`https://solscan.io/account/${wallet}`, '_blank');
                }}
                className="p-1 hover:text-foreground transition-colors"
                title="View on Solscan"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Additional Details - Hidden on mobile, shown on larger screens */}
        <div className="hidden sm:block mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-3">
              <span>Avg: {formatCurrency(summary.averageBuyAmount)}</span>
              <span>Invested: {formatCurrency(summary.totalInvested)}</span>
            </div>
            <div className="flex items-center space-x-3">
              <span>R: {formatCurrency(summary.realized)}</span>
              <span>U: {formatCurrency(summary.unrealized)}</span>
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
          {/* Table Header */}
          <thead className="bg-muted/30 border-b border-border">
            <tr className="text-left">
              <th className="px-6 py-4 text-sm font-semibold text-foreground">
                Rank
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-foreground">
                Trader
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-foreground text-right">
                Total PnL
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-foreground text-right">
                ROI
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-foreground text-right">
                Win Rate
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-foreground text-right">
                Trades
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-foreground text-right">
                Avg Buy
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-foreground text-right">
                Invested
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-foreground text-center">
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-border">
            {isLoading ? (
              // Loading skeleton rows
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="w-8 h-8 bg-muted rounded-full animate-pulse"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded w-32 animate-pulse"></div>
                      <div className="h-3 bg-muted rounded w-24 animate-pulse"></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="h-4 bg-muted rounded w-20 animate-pulse ml-auto"></div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="h-4 bg-muted rounded w-16 animate-pulse ml-auto"></div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="h-4 bg-muted rounded w-16 animate-pulse ml-auto"></div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="h-4 bg-muted rounded w-12 animate-pulse ml-auto"></div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="h-4 bg-muted rounded w-16 animate-pulse ml-auto"></div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="h-4 bg-muted rounded w-20 animate-pulse ml-auto"></div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="h-8 bg-muted rounded w-16 animate-pulse mx-auto"></div>
                  </td>
                </tr>
              ))
            ) : traders.length > 0 ? (
              traders.map((trader, index) => {
                const { wallet, summary } = trader;
                const isPositive = summary.total >= 0;
                const roi =
                  summary.totalInvested > 0
                    ? (summary.total / summary.totalInvested) * 100
                    : 0;

                return (
                  <tr
                    key={wallet}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => handleViewProfile(wallet)}
                  >
                    {/* Rank */}
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0
                              ? 'bg-yellow-500 text-yellow-900'
                              : index === 1
                                ? 'bg-gray-400 text-gray-900'
                                : index === 2
                                  ? 'bg-orange-500 text-orange-900'
                                  : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {index + 1}
                        </div>
                        {index < 3 && (
                          <Award
                            className={`w-4 h-4 ${
                              index === 0
                                ? 'text-yellow-500'
                                : index === 1
                                  ? 'text-gray-400'
                                  : 'text-orange-500'
                            }`}
                          />
                        )}
                      </div>
                    </td>

                    {/* Trader */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-mono font-semibold text-foreground">
                          {wallet.slice(0, 6)}...{wallet.slice(-4)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Trader #{index + 1}
                        </div>
                      </div>
                    </td>

                    {/* Total PnL */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span
                          className={`w-2 h-2 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                        ></span>
                        <span
                          className={`font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                        >
                          {isPositive ? '+' : ''}
                          {formatCurrency(summary.total)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        R: {formatCurrency(summary.realized)} | U:{' '}
                        {formatCurrency(summary.unrealized)}
                      </div>
                    </td>

                    {/* ROI */}
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`font-semibold ${roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                      >
                        {roi >= 0 ? '+' : ''}
                        {formatNumber(roi, 1)}%
                      </span>
                    </td>

                    {/* Win Rate */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span className="font-semibold text-foreground">
                          {formatNumber(summary.winPercentage, 1)}%
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {summary.totalWins}W / {summary.totalLosses}L
                      </div>
                    </td>

                    {/* Trades */}
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-foreground">
                        {summary.totalWins + summary.totalLosses}
                      </span>
                    </td>

                    {/* Average Buy */}
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-foreground">
                        {formatCurrency(summary.averageBuyAmount)}
                      </span>
                    </td>

                    {/* Total Invested */}
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-foreground">
                        {formatCurrency(summary.totalInvested)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            handleViewProfile(wallet);
                          }}
                          className="p-1 h-auto hover:bg-muted rounded-lg"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            handleCopyWallet(wallet);
                          }}
                          className="p-1 h-auto hover:bg-muted rounded-lg"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            window.open(
                              `https://solscan.io/account/${wallet}`,
                              '_blank'
                            );
                          }}
                          className="p-1 h-auto hover:bg-muted rounded-lg"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    No traders found
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Top traders data is currently unavailable
                  </p>
                  <Button onClick={fetchTopTraders} variant="outline">
                    Refresh
                  </Button>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-800 dark:text-red-200 mb-4">{error}</p>
          <Button onClick={fetchTopTraders} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const activeTab = viewTabs.find(tab => tab.id === activeView)!;

  return (
    <div className={`space-y-4 sm:space-y-6 ${className}`}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {title}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Explore top performing traders on Solana with detailed analytics
          </p>
        </div>

        <div className="text-xs sm:text-sm text-muted-foreground">
          Updated every hour
        </div>
      </div>

      {/* View Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {viewTabs.map(tab => (
          <button
            key={tab.id}
            className={`
              text-left p-3 sm:p-4 rounded-lg border-2 transition-all duration-200
              ${
                activeView === tab.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-muted-foreground bg-background'
              }
            `}
            onClick={() => setActiveView(tab.id)}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`
                p-2 rounded-lg
                ${
                  activeView === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }
              `}
              >
                {tab.icon}
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm sm:text-base">
                  {tab.label}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {tab.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Active View Display */}
      <div className="bg-background rounded-lg border border-border">
        {/* View Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              {activeTab.icon}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {activeTab.label}
              </h2>
              <p className="text-sm text-muted-foreground">
                {activeTab.description}
              </p>
            </div>
          </div>
        </div>

        {/* View Content */}
        <div className="p-3 sm:p-6">
          {activeView === 'cards' ? (
            isLoading ? (
              <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-background border border-border rounded-xl p-3 sm:p-4 animate-pulse"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-full"></div>
                      <div className="text-right">
                        <div className="h-5 bg-muted rounded mb-1 w-20"></div>
                        <div className="h-3 bg-muted rounded w-16"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded w-full"></div>
                      <div className="h-3 bg-muted rounded w-3/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : traders.length > 0 ? (
              <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {traders.map(renderTraderCard)}
              </div>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No traders found
                </h3>
                <p className="text-muted-foreground mb-4">
                  Top traders data is currently unavailable
                </p>
                <Button onClick={fetchTopTraders} variant="outline">
                  Refresh
                </Button>
              </div>
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
