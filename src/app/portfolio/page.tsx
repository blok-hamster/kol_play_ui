'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import {
  PieChart,
  TrendingUp,
  DollarSign,
  Activity,
  RefreshCw,
  AlertCircle,
  History,
  Filter,
  Download,
  Eye,
} from 'lucide-react';
import { PortfolioService } from '@/services/portfolio.service';
import { useUserStore } from '@/stores/use-user-store';
import { useNotifications } from '@/stores/use-ui-store';
import { formatCurrency, formatNumber, formatRelativeTime } from '@/lib/utils';
import type { TransactionStats, Transaction } from '@/types';

const PortfolioPage: React.FC = () => {
  const [tradeStats, setTradeStats] = useState<TransactionStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { user, isAuthenticated } = useUserStore();
  const { showNotification } = useNotifications();

  const fetchPortfolioData = async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch trading stats and recent transactions in parallel
      const [statsResponse, transactionsResponse] = await Promise.all([
        PortfolioService.getUserTradeStats(),
        PortfolioService.getUserTransactions({ page: 1, limit: 5 }),
      ]);

      setTradeStats(statsResponse.data);
      setRecentTransactions(transactionsResponse.data);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Failed to fetch portfolio data:', err);
      setError(err.message || 'Failed to load portfolio data');
      showNotification('Error', 'Failed to load portfolio data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, [isAuthenticated]);

  const handleRefresh = async () => {
    await fetchPortfolioData();
    showNotification('Portfolio Updated', 'Latest data has been loaded');
  };

  // Calculate portfolio metrics from user account details and stats
  const portfolioValue = user?.accountDetails
    ? user.accountDetails.balance +
      user.accountDetails.tokens.reduce((sum, token) => sum + token.value, 0)
    : 0;

  const totalPnL = tradeStats?.pnlStats?.totalPnL || 0;
  const pnlPercentage =
    portfolioValue > 0 ? (totalPnL / portfolioValue) * 100 : 0;

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Please sign in to view your portfolio
          </h1>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <PieChart className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold text-foreground">
                  Portfolio
                </h1>
              </div>
              <p className="text-muted-foreground">
                Track your trading performance and holdings
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {lastUpdated && (
                <span className="text-sm text-muted-foreground">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-800 dark:text-red-200">{error}</span>
              <Button size="sm" variant="outline" onClick={handleRefresh}>
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Portfolio Value */}
        <div className="bg-background border border-border rounded-xl p-6 mb-8 shadow-lg">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-foreground mb-2">
              {formatCurrency(portfolioValue)}
            </h2>
            <div className="flex items-center justify-center space-x-2">
              <span
                className={`w-2 h-2 rounded-full ${totalPnL >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
              ></span>
              <p
                className={`font-medium ${totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
              >
                {totalPnL >= 0 ? '+' : ''}
                {formatCurrency(totalPnL)} ({pnlPercentage >= 0 ? '+' : ''}
                {formatNumber(pnlPercentage, 1)}%) total P&L
              </p>
            </div>
          </div>
        </div>

        {/* Holdings and Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Token Holdings */}
          <div className="bg-background border border-border rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Token Holdings
            </h2>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse bg-muted/30 border border-border rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-muted rounded-full"></div>
                        <div>
                          <div className="h-4 bg-muted rounded w-20 mb-2"></div>
                          <div className="h-3 bg-muted rounded w-24"></div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-16"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : user?.accountDetails?.tokens.length > 0 ? (
              <div className="space-y-4">
                {/* SOL Balance */}
                <div className="bg-muted/30 border border-border rounded-xl p-4 hover:border-muted-foreground transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0 border-2 border-muted">
                        <span className="text-primary-foreground font-bold text-sm">
                          ◎
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-bold text-foreground text-lg">
                            SOL
                          </h3>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span>
                            {formatNumber(user.accountDetails.balance, 4)} SOL
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-foreground">
                        {formatCurrency(user.accountDetails.balance * 100)}
                      </div>
                      <div className="text-sm text-muted-foreground">Base</div>
                    </div>
                  </div>
                </div>

                {/* Token Holdings */}
                {user.accountDetails.tokens.slice(0, 5).map((token, index) => (
                  <div
                    key={token.mint}
                    className="bg-muted/30 border border-border rounded-xl p-4 hover:border-muted-foreground transition-all duration-200"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0 border-2 border-muted">
                          <span className="text-primary-foreground font-bold text-sm">
                            {token.symbol.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-bold text-foreground text-lg">
                              {token.symbol}
                            </h3>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span>
                              {formatNumber(token.balance, 2)} {token.symbol}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-foreground">
                          {formatCurrency(token.value)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Current
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No token holdings found</p>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full mt-4 border-border hover:bg-muted rounded-xl"
            >
              <Eye className="h-4 w-4 mr-2" />
              View All Holdings
            </Button>
          </div>

          {/* Trading Stats */}
          <div className="bg-background border border-border rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Trading Statistics
            </h2>
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse bg-muted/30 border border-border rounded-xl p-4"
                  >
                    <div className="h-8 w-8 bg-muted rounded mx-auto mb-2"></div>
                    <div className="h-6 bg-muted rounded w-16 mx-auto mb-2"></div>
                    <div className="h-4 bg-muted rounded w-20 mx-auto"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 border border-border rounded-xl p-4 hover:border-muted-foreground transition-all duration-200">
                  <div className="text-center">
                    <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-foreground">
                      {tradeStats?.totalTrades || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total Trades
                    </p>
                  </div>
                </div>

                <div className="bg-muted/30 border border-border rounded-xl p-4 hover:border-muted-foreground transition-all duration-200">
                  <div className="text-center">
                    <Activity className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-foreground">
                      {formatNumber(tradeStats?.winRate || 0, 1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                  </div>
                </div>

                <div className="bg-muted/30 border border-border rounded-xl p-4 hover:border-muted-foreground transition-all duration-200">
                  <div className="text-center">
                    <DollarSign className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(tradeStats?.averageTradeSize || 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Avg Trade</p>
                  </div>
                </div>

                <div className="bg-muted/30 border border-border rounded-xl p-4 hover:border-muted-foreground transition-all duration-200">
                  <div className="text-center">
                    <PieChart className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-foreground">
                      {tradeStats?.uniqueTokensTraded || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Unique Tokens
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Transaction History Section */}
        <div className="mt-8 bg-background border border-border rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center">
              <History className="h-5 w-5 mr-2" />
              Recent Transactions
            </h2>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="border-border hover:bg-muted rounded-xl"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-border hover:bg-muted rounded-xl"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse bg-muted/30 border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-muted rounded-full"></div>
                      <div>
                        <div className="h-4 bg-muted rounded w-24 mb-1"></div>
                        <div className="h-3 bg-muted rounded w-32"></div>
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
          ) : recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {recentTransactions.map((transaction, index) => (
                <div
                  key={transaction.id || index}
                  className="bg-muted/30 border border-border rounded-xl p-4 hover:border-muted-foreground transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0 border-2 border-muted">
                        <span className="text-primary-foreground font-bold text-sm">
                          {transaction.tokenSymbol?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-bold text-foreground text-lg">
                            {transaction.action === 'buy' ? 'Buy' : 'Sell'}{' '}
                            {transaction.tokenSymbol || 'Token'}
                          </h3>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span>
                            {transaction.createdAt
                              ? formatRelativeTime(
                                  new Date(transaction.createdAt)
                                )
                              : 'Recently'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-foreground">
                        {transaction.action === 'buy' ? '+' : ''}
                        {formatNumber(transaction.tokenAmount || 0, 2)}{' '}
                        {transaction.tokenSymbol}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatNumber(transaction.solAmount || 0, 4)} SOL
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            transaction.action === 'buy'
                              ? 'bg-green-500'
                              : 'bg-red-500'
                          }`}
                        ></span>
                        <span className="text-muted-foreground">
                          {transaction.action === 'buy'
                            ? 'Buy Order'
                            : 'Sell Order'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      TX #{Math.floor(Math.random() * 1000) + 1}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No transactions found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start trading to see your transaction history
              </p>
            </div>
          )}

          <div className="flex items-center space-x-3 mt-6">
            <Button
              variant="outline"
              className="flex-1 border-border hover:bg-muted rounded-xl"
              asChild
            >
              <Link href="/portfolio/transactions">
                <History className="h-4 w-4 mr-2" />
                View Full Transaction History
              </Link>
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-border hover:bg-muted rounded-xl"
              asChild
            >
              <Link href="/portfolio/stats">
                <Activity className="h-4 w-4 mr-2" />
                View Trading Statistics
              </Link>
            </Button>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Portfolio tracking is live with real-time data!{' '}
              {user?.accountDetails
                ? 'Your wallet is connected.'
                : 'Connect your wallet for live data.'}
            </span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default PortfolioPage;
