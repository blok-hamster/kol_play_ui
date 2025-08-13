'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  PieChart,
  Target,
  Calendar,
  Coins,
  RefreshCw,
  Eye,
  Filter,
} from 'lucide-react';
import { PortfolioService } from '@/services/portfolio.service';
import { useNotifications } from '@/stores/use-ui-store';
import { formatCurrency, formatNumber, formatPercentage, safeFormatAmount } from '@/lib/utils';
import type { TransactionStats, TokenPnL } from '@/types';

interface TradingStatsProps {
  timeframe?: 'all' | '7d' | '30d' | '90d';
  showTokenBreakdown?: boolean;
}

interface TokenPnLWithMeta extends TokenPnL {
  tokenSymbol: string;
  tokenName: string;
  mint: string;
}

const TradingStats: React.FC<TradingStatsProps> = ({
  timeframe = 'all',
  showTokenBreakdown = true,
}) => {
  const [tradeStats, setTradeStats] = useState<TransactionStats | null>(null);
  const [tokenPnLs, setTokenPnLs] = useState<TokenPnLWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);
  const [showAllTokens, setShowAllTokens] = useState(false);

  const { showNotification } = useNotifications();

  const fetchTradingStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await PortfolioService.getUserTradeStats();
      setTradeStats(response.data);
    } catch (err: any) {
      console.error('Failed to fetch trading stats:', err);
      setError(err.message || 'Failed to load trading statistics');
      showNotification('Error', 'Failed to load trading statistics', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTokenPnLs = async () => {
    if (!showTokenBreakdown) return;

    try {
      setIsLoadingTokens(true);

      // In a real implementation, you'd get this list from somewhere
      // For now, we'll simulate with some common tokens
      const commonTokens = [
        {
          mint: 'So11111111111111111111111111111111111111112',
          symbol: 'SOL',
          name: 'Solana',
        },
        {
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          symbol: 'USDC',
          name: 'USD Coin',
        },
        {
          mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
          symbol: 'BONK',
          name: 'Bonk',
        },
        // Add more as needed
      ];

      const tokenPnLPromises = commonTokens.map(async token => {
        try {
          const response = await PortfolioService.getTokenPnL(token.mint);
          return {
            ...response.data,
            tokenSymbol: token.symbol,
            tokenName: token.name,
            mint: token.mint,
          };
        } catch (err) {
          return null;
        }
      });

      const results = await Promise.all(tokenPnLPromises);
      const validTokenPnLs = results.filter(Boolean) as TokenPnLWithMeta[];

      // Sort by total PnL descending
      validTokenPnLs.sort((a, b) => (b.totalPnL || 0) - (a.totalPnL || 0));

      setTokenPnLs(validTokenPnLs);
    } catch (err: any) {
      console.error('Failed to fetch token PnLs:', err);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  useEffect(() => {
    fetchTradingStats();
    fetchTokenPnLs();
  }, [selectedTimeframe]);

  const handleRefresh = async () => {
    await Promise.all([fetchTradingStats(), fetchTokenPnLs()]);
    showNotification(
      'Statistics Updated',
      'Latest trading data has been loaded'
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <Activity className="h-6 w-6 text-primary" />
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              Trading Statistics
            </h2>
          </div>
        </div>

        {/* Loading skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-muted/50 rounded-lg p-4 sm:p-6">
              <div className="animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-5 bg-muted rounded w-24"></div>
                  <div className="h-6 w-6 sm:h-8 sm:w-8 bg-muted rounded-full"></div>
                </div>
                <div className="h-6 sm:h-8 bg-muted rounded w-20 mb-2"></div>
                <div className="h-4 bg-muted rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-800 dark:text-red-200 mb-4">{error}</p>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const winRate = tradeStats?.winRate || 0;
  const totalTrades = tradeStats?.totalTrades || 0;
  const pnlStats = tradeStats?.pnlStats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-center space-x-3">
          <Activity className="h-6 w-6 text-primary" />
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            Trading Statistics
          </h2>
        </div>
        <div className="flex justify-end items-center space-x-2 sm:space-x-4">
          {/* Timeframe selector */}
          <select
            className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm flex-shrink-0"
            value={selectedTimeframe}
            onChange={e =>
              setSelectedTimeframe(e.target.value as typeof timeframe)
            }
          >
            <option value="all">All Time</option>
            <option value="90d">Last 90 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="7d">Last 7 Days</option>
          </select>
          <Button variant="ghost" size="sm" onClick={handleRefresh} className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex-shrink-0">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Trades */}
        <div className="bg-muted/50 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Total Trades
            </h3>
            <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">
            {formatNumber(totalTrades)}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mt-2 space-y-1 sm:space-y-0">
            <span className="text-sm text-muted-foreground">
              Buy: {formatNumber(tradeStats?.totalBuyTrades || 0)}
            </span>
            <span className="text-sm text-muted-foreground hidden sm:inline">•</span>
            <span className="text-sm text-muted-foreground">
              Sell: {formatNumber(tradeStats?.totalSellTrades || 0)}
            </span>
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-muted/50 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Win Rate
            </h3>
            <Target
              className={`h-6 w-6 sm:h-8 sm:w-8 ${winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}
            />
          </div>
          <p
            className={`text-2xl sm:text-3xl font-bold ${winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}
          >
            {formatPercentage(winRate)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {winRate >= 60
              ? 'Excellent'
              : winRate >= 50
                ? 'Good'
                : 'Needs improvement'}
          </p>
        </div>

        {/* Total P&L */}
        <div className="bg-muted/50 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Total P&L
            </h3>
            <div className="h-6 w-6 sm:h-8 sm:w-8 bg-accent-gradient rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xs sm:text-sm">$</span>
            </div>
          </div>
          <p
            className={`text-2xl sm:text-3xl font-bold ${(pnlStats?.totalPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {(pnlStats?.totalPnL || 0) >= 0 ? '+' : ''}
            {formatCurrency(pnlStats?.totalPnL || 0)}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mt-2 space-y-1 sm:space-y-0">
            <span className="text-xs text-green-600">
              Realized: {formatCurrency(pnlStats?.realizedPnL || 0)}
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
            <span className="text-xs text-orange-600">
              Unrealized: {formatCurrency(pnlStats?.unrealizedPnL || 0)}
            </span>
          </div>
        </div>

        {/* Unique Tokens */}
        <div className="bg-muted/50 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Unique Tokens
            </h3>
            <Coins className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">
            {formatNumber(tradeStats?.uniqueTokensTraded || 0)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">Traded tokens</p>
        </div>

        {/* Average Trade Size */}
        <div className="bg-muted/50 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Avg Trade Size
            </h3>
            <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">
            {(() => {
              const calculatedAverage = tradeStats && tradeStats.totalTrades > 0 
                ? tradeStats.totalSOLTraded / tradeStats.totalTrades 
                : 0;
              return `${safeFormatAmount(calculatedAverage, 4)} SOL`;
            })()}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Per transaction
            {tradeStats && tradeStats.totalTrades > 0 && (
              <span className="block text-xs opacity-75">
                Based on {tradeStats.totalTrades} trades
              </span>
            )}
          </p>
        </div>

        {/* SOL Spent */}
        <div className="bg-muted/50 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              SOL Spent
            </h3>
            <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-red-600">
            {formatNumber(pnlStats?.totalSOLSpent || 0, 2)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">SOL</p>
        </div>

        {/* SOL Received */}
        <div className="bg-muted/50 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              SOL Received
            </h3>
            <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">
            {formatNumber(pnlStats?.totalSOLReceived || 0, 2)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">SOL</p>
        </div>

        {/* Trading Period */}
        <div className="bg-muted/50 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Trading Period
            </h3>
            <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">
            {formatNumber(tradeStats?.tradingPeriodDays || 0)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">Days active</p>
        </div>
      </div>

      {/* Token-Specific P&L Breakdown */}
      {showTokenBreakdown && (
        <div className="bg-muted/50 rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-2 sm:space-y-0">
            <h3 className="text-lg sm:text-xl font-semibold text-foreground flex items-center">
              <PieChart className="h-5 w-5 mr-2" />
              Token Performance
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllTokens(!showAllTokens)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50 w-full sm:w-auto"
            >
              <Eye className="h-4 w-4 mr-2" />
              {showAllTokens ? 'Show Less' : 'Show All'}
            </Button>
          </div>

          {isLoadingTokens ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse bg-background rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-muted rounded-full"></div>
                      <div>
                        <div className="h-4 bg-muted rounded w-16 mb-1"></div>
                        <div className="h-3 bg-muted rounded w-24"></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="h-4 bg-muted rounded w-20 mb-1"></div>
                      <div className="h-3 bg-muted rounded w-16"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : tokenPnLs.length > 0 ? (
            <div className="space-y-4">
              {(showAllTokens ? tokenPnLs : tokenPnLs.slice(0, 5)).map(
                tokenPnL => (
                  <div
                    key={tokenPnL.mint}
                    className="bg-background rounded-lg p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-xs">
                            {tokenPnL.tokenSymbol.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {tokenPnL.tokenSymbol}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {tokenPnL.tokenName}
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p
                          className={`font-bold ${(tokenPnL.totalPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {(tokenPnL.totalPnL || 0) >= 0 ? '+' : ''}
                          {formatCurrency(tokenPnL.totalPnL || 0)}
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 text-xs text-muted-foreground space-y-1 sm:space-y-0">
                          <span>
                            Realized:{' '}
                            {formatCurrency(tokenPnL.realizedPnL || 0)}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span>
                            Unrealized:{' '}
                            {formatCurrency(tokenPnL.unrealizedPnL || 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Additional token metrics */}
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">
                          Holdings
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {formatNumber(tokenPnL.currentHoldings || 0, 2)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">
                          Avg Buy Price
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {formatCurrency(tokenPnL.averageBuyPrice || 0)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">
                          Invested
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {formatCurrency(tokenPnL.investedAmount || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No token performance data available
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Start trading to see token-specific analytics
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TradingStats;
