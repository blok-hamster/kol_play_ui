'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Wallet,
  Info,
  ExternalLink,
  TrendingDown,
  ChevronDown,
} from 'lucide-react';
import { PortfolioService } from '@/services/portfolio.service';
import { SolanaService } from '@/services/solana.service';
import { useUserStore } from '@/stores/use-user-store';
import { useNotifications } from '@/stores/use-ui-store';
import { useTokenLazyLoading } from '@/hooks/use-token-lazy-loading';
import { formatCurrency, formatNumber, formatRelativeTime, safeFormatAmount, safeToFixed, cn } from '@/lib/utils';
import { executeInstantSell, checkTradeConfig } from '@/lib/trade-utils';
import type { TransactionStats, Transaction, SolanaWalletBalance } from '@/types';

const PortfolioPage: React.FC = () => {
  const [tradeStats, setTradeStats] = useState<TransactionStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    []
  );
  const [enhancedWalletData, setEnhancedWalletData] = useState<(SolanaWalletBalance & { 
    totalValueUsd: number;
    solValueUsd: number;
    enrichedTokens?: boolean;
  }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingWalletData, setIsLoadingWalletData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sellingTokens, setSellingTokens] = useState<Set<string>>(new Set());
  const [showTradeConfigPrompt, setShowTradeConfigPrompt] = useState(false);

  // Mobile collapsible controls
  const [isMobile, setIsMobile] = useState(false);
  const [isOverviewCollapsed, setIsOverviewCollapsed] = useState(false);
  const [isTradingStatsCollapsed, setIsTradingStatsCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    // Auto-collapse on mobile; always expanded on larger screens
    if (isMobile) {
      setIsOverviewCollapsed(true);
      setIsTradingStatsCollapsed(true);
    } else {
      setIsOverviewCollapsed(false);
      setIsTradingStatsCollapsed(false);
    }
  }, [isMobile]);

  const { user, isAuthenticated } = useUserStore();
  const { showError, showSuccess } = useNotifications();

  // Initialize token lazy loading for detailed token information
  const {
    tokens: tokenDetails,
    loading: loadingTokenDetails,
    error: tokenDetailsError,
    progress: tokenProgress,
    loadTokens,
    getToken
  } = useTokenLazyLoading({
    batchSize: 15,
    maxConcurrentBatches: 3,
    cacheEnabled: true,
    onProgress: (loaded, total, currentBatch, totalBatches) => {
      console.log(`Loading token details: ${loaded}/${total} (batch ${currentBatch}/${totalBatches})`);
    },
    onError: (error) => {
      console.error('Token details loading error:', error);
    }
  });

  const fetchEnhancedWalletData = async (enrichTokens: boolean = false) => {
    if (!isAuthenticated || !user?.accountDetails?.address) return;

    try {
      setIsLoadingWalletData(true);
      console.log(`🔄 Fetching enhanced wallet data for ${user.accountDetails.address} (enrichTokens: ${enrichTokens})`);
      
      const walletData = await SolanaService.getWalletBalanceWithEnrichedTokens(
        user.accountDetails.address,
        enrichTokens
      );
      
      setEnhancedWalletData(walletData);
      console.log(`✅ Enhanced wallet data loaded:`, walletData);
      
      // Load token details for enrichment if we have tokens
      if (walletData.tokens.length > 0) {
        const tokenMints = walletData.tokens.map(token => token.mintAddress).filter(mint => mint && mint.length > 0);
        if (tokenMints.length > 0) {
          console.log(`🔄 Loading detailed token information for ${tokenMints.length} tokens`);
          loadTokens(tokenMints);
        }
      }
      
    } catch (err: any) {
      console.error('Failed to fetch enhanced wallet data:', err);
      showError('Error', 'Failed to load enhanced wallet data');
    } finally {
      setIsLoadingWalletData(false);
    }
  };

  const fetchPortfolioData = async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch trading stats, recent transactions, and enhanced wallet data in parallel
      const [statsResponse, transactionsResponse] = await Promise.all([
        PortfolioService.getUserTradeStats(),
        PortfolioService.getUserTransactions({ page: 1, limit: 5 }),
      ]);

      setTradeStats(statsResponse.data);
      
      // Sort recent transactions by timestamp/createdAt in descending order (newest first)
      const sortedRecentTransactions = transactionsResponse.data.sort((a, b) => {
        const dateA = a.timestamp || new Date(a.createdAt || 0).getTime();
        const dateB = b.timestamp || new Date(b.createdAt || 0).getTime();
        return dateB - dateA; // Descending order (newest first)
      });
      
      setRecentTransactions(sortedRecentTransactions);
      setLastUpdated(new Date());
      
      // Fetch enhanced wallet data separately
      await fetchEnhancedWalletData(true);
      
    } catch (err: any) {
      console.error('Failed to fetch portfolio data:', err);
      setError(err.message || 'Failed to load portfolio data');
      showError('Error', 'Failed to load portfolio data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, [isAuthenticated]);

  const handleRefresh = async () => {
    await fetchPortfolioData();
    showSuccess('Portfolio Updated', 'Latest data has been loaded');
  };

  // Handle instant sell
  const handleInstantSell = async (token: any, e: React.MouseEvent) => {
    e.stopPropagation();

    // Check if already selling this token
    if (sellingTokens.has(token.mintAddress)) {
      return;
    }

    try {
      // First check if user has trade config
      const configCheck = await checkTradeConfig();
      
      if (!configCheck.hasConfig) {
        // Show trade config prompt
        setShowTradeConfigPrompt(true);
        return;
      }

      // Add token to selling set
      setSellingTokens(prev => new Set(prev).add(token.mintAddress));

      // Execute instant sell
      const result = await executeInstantSell(token.mintAddress, token.detailedSymbol, token.uiAmount);

      if (result.success) {
        showSuccess(
          'Sell Order Executed',
          `Successfully sold ${token.detailedSymbol || 'token'} for ${result.result?.outputAmount?.toFixed(4) || 'N/A'} SOL`
        );

        // Refresh portfolio data to update balances
        await fetchEnhancedWalletData(true);

        // Optional: Show transaction details
        if (result.result?.transactionId) {
          console.log('Transaction ID:', result.result.transactionId);
        }
      } else {
        showError(
          'Sell Order Failed',
          result.error || 'Failed to execute sell order'
        );
      }
    } catch (error: any) {
      console.error('Sell order error:', error);
      showError(
        'Sell Order Error',
        error.message || 'An unexpected error occurred'
      );
    } finally {
      // Remove token from selling set
      setSellingTokens(prev => {
        const newSet = new Set(prev);
        newSet.delete(token.mintAddress);
        return newSet;
      });
    }
  };

  // Handle trade config prompt close
  const handleTradeConfigPromptClose = () => {
    setShowTradeConfigPrompt(false);
  };

  // Calculate portfolio metrics from enhanced wallet data and stats
  const portfolioMetrics = useMemo(() => {
    // Use enhanced wallet data if available, fallback to user account details
    const portfolioValue = enhancedWalletData?.totalValueUsd || 
      (user?.accountDetails ? 
        (user.accountDetails.totalValueUsd || 
         user.accountDetails.balance + user.accountDetails.tokens.reduce((sum, token) => sum + token.value, 0)
        ) : 0);
    
    const solValue = enhancedWalletData?.solValueUsd || user?.accountDetails?.solValueUsd || 0;
    const solBalance = enhancedWalletData?.solBalance || user?.accountDetails?.balance || 0;
    
    const totalPnL = tradeStats?.pnlStats?.totalPnL || 0;
    const totalPnLPercent = tradeStats?.pnlStats?.totalPnLPercent || 0;
    
    // Calculate average trade size
    const totalVolume = tradeStats?.totalVolume || 0;
    const totalTrades = tradeStats?.totalTrades || 0;
    const averageTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;

    // Check if we have enhanced wallet data vs basic account details
    const hasEnhancedData = !!enhancedWalletData;

    return {
      portfolioValue,
      solValue,
      solBalance,
      totalPnL,
      totalPnLPercent,
      averageTradeSize,
      hasEnhancedData,
    };
  }, [enhancedWalletData, user?.accountDetails, tradeStats]);

  // Enhanced tokens with detailed information
  const enrichedTokens = useMemo(() => {
    if (!enhancedWalletData?.tokens) return [];

    return enhancedWalletData.tokens.map(token => {
      const tokenDetail = getToken(token.mintAddress);
      
      return {
        ...token,
        // Enhanced data from token details
        detailedSymbol: tokenDetail?.token?.symbol || token.symbol || 'UNKNOWN',
        detailedName: tokenDetail?.token?.name || token.name || 'Unknown Token',
        image: tokenDetail?.token?.image || tokenDetail?.token?.logoURI,
        verified: tokenDetail?.token?.verified || false,
        holders: tokenDetail?.holders || 0,
        riskScore: tokenDetail?.risk?.score || 0,
        isRugged: tokenDetail?.risk?.rugged || false,
        website: tokenDetail?.token?.website,
        twitter: tokenDetail?.token?.twitter,
        telegram: tokenDetail?.token?.telegram,
        hasDetails: !!tokenDetail
      };
    });
  }, [enhancedWalletData?.tokens, tokenDetails]);

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background text-foreground">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center py-16">
              <Wallet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Portfolio Access Required
              </h1>
              <p className="text-muted-foreground mb-6">
                Please sign in to view your portfolio and trading statistics.
              </p>
              <Link href="/auth/signin">
                <Button>Sign In to Continue</Button>
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-8">
          {/* Error State */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <p className="text-sm text-destructive font-medium">
                  Failed to load portfolio data
                </p>
              </div>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
            </div>
          )}

          {/* Main Content */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8 mb-8">
            {/* Portfolio Overview */}
            <div className="bg-background border border-border rounded-xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                  Portfolio Overview
                </h2>
                <button
                  type="button"
                  className="md:hidden inline-flex items-center justify-center p-2 rounded-lg hover:bg-muted/50"
                  aria-label="Toggle Portfolio Overview"
                  aria-expanded={!isOverviewCollapsed}
                  aria-controls="overview-panel"
                  onClick={() => setIsOverviewCollapsed(prev => !prev)}
                >
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 transition-transform',
                      !isOverviewCollapsed && 'rotate-180'
                    )}
                  />
                </button>
              </div>
              {isLoading ? (
                <div className="space-y-4">
                  <div className="animate-pulse bg-muted/30 border border-border rounded-xl p-4">
                    <div className="h-8 w-32 bg-muted rounded mb-2"></div>
                    <div className="h-6 w-24 bg-muted rounded"></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="animate-pulse bg-muted/30 border border-border rounded-xl p-4"
                      >
                        <div className="h-4 bg-muted rounded w-16 mb-2"></div>
                        <div className="h-6 bg-muted rounded w-20"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div id="overview-panel" className={cn('space-y-4', isMobile && isOverviewCollapsed && 'hidden')}>
                  {/* Total Portfolio Value */}
                  <div className="bg-accent-gradient text-white rounded-xl p-4 sm:p-6 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/80 text-sm">
                          Total Portfolio Value
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold text-white">
                          {formatCurrency(portfolioMetrics.portfolioValue)}
                        </p>
                      </div>
                      <PieChart className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                  </div>

                  {/* Portfolio Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-muted/30 border border-border rounded-xl p-4 hover:border-muted-foreground transition-all duration-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-muted-foreground">SOL Balance</p>
                          <p className="text-base sm:text-lg font-bold text-foreground">
                            {safeToFixed(portfolioMetrics.solBalance, 4)} SOL
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(portfolioMetrics.solValue)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/30 border border-border rounded-xl p-4 hover:border-muted-foreground transition-all duration-200">
                      <div className="flex items-center space-x-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          portfolioMetrics.totalPnL >= 0 
                            ? "bg-green-100 dark:bg-green-900/20" 
                            : "bg-red-100 dark:bg-red-900/20"
                        )}>
                          {portfolioMetrics.totalPnL >= 0 ? (
                            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-muted-foreground">Total P&L</p>
                          <p className={cn(
                            "text-base sm:text-lg font-bold",
                            portfolioMetrics.totalPnL >= 0 
                              ? "text-green-600 dark:text-green-400" 
                              : "text-red-600 dark:text-red-400"
                          )}>
                            {portfolioMetrics.totalPnL >= 0 ? '+' : ''}
                            {formatCurrency(portfolioMetrics.totalPnL)}
                          </p>
                          <p className={cn(
                            "text-xs",
                            portfolioMetrics.totalPnL >= 0 
                              ? "text-green-600 dark:text-green-400" 
                              : "text-red-600 dark:text-red-400"
                          )}>
                            {portfolioMetrics.totalPnLPercent >= 0 ? '+' : ''}
                            {formatNumber(portfolioMetrics.totalPnLPercent, 2)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trading Statistics */}
                  <div className="border-t border-border pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base sm:text-lg font-semibold text-foreground">
                        Trading Statistics
                      </h3>
                      <button
                        type="button"
                        className="md:hidden inline-flex items-center justify-center p-2 rounded-lg hover:bg-muted/50"
                        aria-label="Toggle Trading Statistics"
                        aria-expanded={!isTradingStatsCollapsed}
                        aria-controls="trading-stats-panel"
                        onClick={() => setIsTradingStatsCollapsed(prev => !prev)}
                      >
                        <ChevronDown
                          className={cn(
                            'h-5 w-5 transition-transform',
                            !isTradingStatsCollapsed && 'rotate-180'
                          )}
                        />
                      </button>
                    </div>
                    <div id="trading-stats-panel" className={cn('grid grid-cols-2 gap-3 sm:gap-4', isMobile && isTradingStatsCollapsed && 'hidden')}>
                      <div className="bg-muted/30 border border-border rounded-xl p-3 sm:p-4 hover:border-muted-foreground transition-all duration-200">
                        <div className="text-center">
                          <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 mx-auto mb-2" />
                          <p className="text-lg sm:text-2xl font-bold text-foreground">
                            {tradeStats?.totalTrades || 0}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Total Trades
                          </p>
                        </div>
                      </div>

                      <div className="bg-muted/30 border border-border rounded-xl p-3 sm:p-4 hover:border-muted-foreground transition-all duration-200">
                        <div className="text-center">
                          <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 mx-auto mb-2" />
                          <p className="text-lg sm:text-2xl font-bold text-foreground">
                            {formatNumber(tradeStats?.winRate || 0, 1)}%
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground">Win Rate</p>
                        </div>
                      </div>

                      <div className="bg-muted/30 border border-border rounded-xl p-3 sm:p-4 hover:border-muted-foreground transition-all duration-200">
                        <div className="text-center">
                          <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500 mx-auto mb-2" />
                          <p className="text-lg sm:text-2xl font-bold text-foreground">
                            {safeFormatAmount(portfolioMetrics.averageTradeSize, 4)} SOL
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Avg Trade Size
                            {tradeStats && tradeStats.totalTrades > 0 && (
                              <span className="block text-xs opacity-75">
                                Based on {tradeStats.totalTrades} trades
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="bg-muted/30 border border-border rounded-xl p-3 sm:p-4 hover:border-muted-foreground transition-all duration-200">
                        <div className="text-center">
                          <PieChart className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500 mx-auto mb-2" />
                          <p className="text-lg sm:text-2xl font-bold text-foreground">
                            {tradeStats?.uniqueTokensTraded || 0}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Unique Tokens
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Token Holdings */}
            <div className="bg-background border border-border rounded-xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                  Token Holdings
                </h2>
                {enrichedTokens.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {enrichedTokens.length} token{enrichedTokens.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              
              {enrichedTokens.length > 0 ? (
                <div className="space-y-3">
                  {/* Token Holdings */}
                  {enrichedTokens.slice(0, 5).map((token, index) => (
                    <div
                      key={token.mintAddress}
                      className="bg-muted/30 border border-border rounded-xl p-3 sm:p-4 hover:border-muted-foreground transition-all duration-200 group"
                    >
                      <div className="flex items-start sm:items-center justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {/* Token Image or Icon */}
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 border-2 border-muted">
                            {token.image ? (
                              <img 
                                src={token.image} 
                                alt={token.detailedSymbol}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback to symbol initial if image fails
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  target.parentElement!.innerHTML = `<span class="text-primary-foreground font-bold text-sm">${token.detailedSymbol.charAt(0)}</span>`;
                                }}
                              />
                            ) : (
                              <span className="text-primary-foreground font-bold text-sm">
                                {token.detailedSymbol.charAt(0)}
                              </span>
                            )}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-1">
                              <h3 className="font-bold text-foreground text-base sm:text-lg truncate">
                                {token.detailedSymbol}
                              </h3>
                              
                              <div className="flex items-center space-x-1 mt-1 sm:mt-0">
                                {/* Verification badge */}
                                {token.verified && (
                                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center" title="Verified Token">
                                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                                
                                {/* Risk warning */}
                                {token.isRugged && (
                                  <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center" title="High Risk Token">
                                    <span className="text-xs font-bold text-white">!</span>
                                  </div>
                                )}
                                
                                {/* Info icon for tokens with details */}
                                {token.hasDetails && (
                                  <Info className="w-3 h-3 text-muted-foreground opacity-50" />
                                )}
                              </div>
                            </div>
                            
                            <div className="text-sm text-muted-foreground mb-1">
                              <span className="truncate block sm:inline">
                                {token.detailedName}
                              </span>
                              {token.hasDetails && token.holders > 0 && (
                                <span className="block sm:inline sm:ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="hidden sm:inline">•</span>
                                  <span className="sm:ml-1">{token.holders.toLocaleString()} holders</span>
                                </span>
                              )}
                            </div>
                            
                            <div className="text-sm text-muted-foreground">
                              <span>
                                {safeFormatAmount(token.uiAmount, 4)} {token.detailedSymbol}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-1">
                            <div className="text-base sm:text-lg font-bold text-foreground">
                              {formatCurrency(token.valueUsd || 0)}
                            </div>
                            {/* Auto Sell Button */}
                            <button
                              onClick={(e) => handleInstantSell(token, e)}
                              disabled={sellingTokens.has(token.mintAddress)}
                              className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 group-hover:opacity-100 opacity-0 mt-1 sm:mt-0"
                              title={`Auto sell ${token.detailedSymbol}`}
                            >
                              {sellingTokens.has(token.mintAddress) ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            Current
                          </div>
                          
                          {/* Social links on hover */}
                          {token.hasDetails && (token.website || token.twitter) && (
                            <div className="flex items-center justify-end space-x-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {token.website && (
                                <a
                                  href={token.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                                  title="Website"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              {token.twitter && (
                                <a
                                  href={token.twitter}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                                  title="Twitter"
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {enhancedWalletData ? 'No token holdings found' : 'No wallet data available'}
                  </p>
                  {!enhancedWalletData && user?.accountDetails?.address && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Click refresh to load wallet data
                    </p>
                  )}
                </div>
              )}
              
              {/* Enhanced data loading indicator */}
              {(isLoadingWalletData || loadingTokenDetails) && (
                <div className="mt-4 p-3 bg-muted/30 border border-border rounded-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground space-y-2 sm:space-y-0">
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>
                        {isLoadingWalletData ? 'Loading wallet data...' : 
                         loadingTokenDetails ? 'Enriching token details...' : ''}
                      </span>
                    </div>
                    {loadingTokenDetails && tokenProgress.total > 0 && (
                      <span>{tokenProgress.percentage}%</span>
                    )}
                  </div>
                  
                  {/* Progress bar for token loading */}
                  {loadingTokenDetails && tokenProgress.total > 0 && (
                    <div className="mt-2">
                      <div className="w-full bg-muted rounded-full h-1">
                        <div 
                          className="bg-primary h-1 rounded-full transition-all duration-300"
                          style={{ width: `${tokenProgress.percentage}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Enhanced data status */}
              {portfolioMetrics.hasEnhancedData && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm space-y-2 sm:space-y-0">
                    <div className="flex items-center space-x-2 text-green-800 dark:text-green-200">
                      <Wallet className="h-4 w-4" />
                      <span>Enhanced wallet data loaded</span>
                      {enrichedTokens.length > 0 && (
                        <span className="hidden sm:inline">
                          • {enrichedTokens.filter(t => t.hasDetails).length}/{enrichedTokens.length} tokens enriched
                        </span>
                      )}
                    </div>
                    {enrichedTokens.length > 0 && (
                      <span className="text-xs sm:hidden text-green-800 dark:text-green-200">
                        {enrichedTokens.filter(t => t.hasDetails).length}/{enrichedTokens.length} tokens enriched
                      </span>
                    )}
                    <button
                      onClick={() => fetchEnhancedWalletData(true)}
                      disabled={isLoadingWalletData}
                      className="p-1 rounded text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 transition-colors disabled:opacity-50"
                      title="Refresh enhanced data"
                    >
                      <RefreshCw className={cn('h-3 w-3', isLoadingWalletData && 'animate-spin')} />
                    </button>
                  </div>
                </div>
              )}
              
              {/* Token details error state */}
              {tokenDetailsError && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm space-y-2 sm:space-y-0">
                    <div className="flex items-center space-x-2 text-red-800 dark:text-red-200">
                      <AlertCircle className="h-4 w-4" />
                      <span>Failed to load some token details: {tokenDetailsError}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (enhancedWalletData?.tokens) {
                          const tokenMints = enhancedWalletData.tokens.map(token => token.mintAddress).filter(mint => mint && mint.length > 0);
                          if (tokenMints.length > 0) {
                            loadTokens(tokenMints);
                          }
                        }
                      }}
                      className="p-1 rounded text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 transition-colors"
                      title="Retry loading token details"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </div>
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
          </div>

          {/* Recent Transactions */}
          <div className="bg-background border border-border rounded-xl p-4 sm:p-6 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                Recent Transactions
              </h2>
              <Link href="/portfolio/transactions">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex-shrink-0">
                  <History className="h-4 w-4 mr-2" />
                  View All
                </Button>
              </Link>
            </div>
            
            <div className="space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="animate-pulse bg-muted/30 border border-border rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-full"></div>
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
                <div className="space-y-4">
                  {recentTransactions.map((transaction, index) => (
                    <div
                      key={transaction.id || index}
                      className="bg-muted/30 border border-border rounded-xl p-3 sm:p-4 hover:border-muted-foreground transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-start sm:items-center justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {/* Token Icon */}
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0 border-2 border-muted">
                            <span className="text-primary-foreground font-bold text-sm">
                              {transaction.mint?.slice(0, 1) || '?'}
                            </span>
                          </div>

                          {/* Transaction Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-1">
                              <h3 className="font-bold text-foreground text-base sm:text-lg">
                                {transaction.action === 'buy' ? 'Buy' : 'Sell'} Token
                              </h3>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 sm:mt-0 w-fit ${
                                  transaction.action === 'buy'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                                }`}
                              >
                                {transaction.action === 'buy' ? 'Buy' : 'Sell'}
                              </span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 text-sm text-muted-foreground space-y-1 sm:space-y-0">
                              <span>
                                {transaction.timestamp
                                  ? formatRelativeTime(
                                      new Date(transaction.timestamp)
                                    )
                                  : 'Recently'}
                              </span>
                              <span className="hidden sm:inline">
                                {transaction.timestamp
                                  ? new Date(transaction.timestamp).toLocaleDateString()
                                  : transaction.createdAt
                                  ? new Date(transaction.createdAt).toLocaleDateString()
                                  : 'Unknown date'}
                              </span>
                              <span className="font-mono text-xs">
                                {transaction.transactionHash
                                  ? `${transaction.transactionHash.slice(0, 8)}...`
                                  : 'No TX'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right section - Amounts */}
                        <div className="text-right ml-2">
                          <div className="text-base sm:text-lg font-bold text-foreground">
                            {formatNumber(transaction.amountOut || 0, 2)} Token
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatNumber(transaction.amountIn || 0, 4)} SOL
                          </div>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm space-y-2 sm:space-y-0">
                        {/* Left stats */}
                        <div className="flex flex-wrap items-center gap-2 sm:space-x-4 sm:gap-0">
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
                          <div className="flex items-center space-x-1 px-2 py-1 bg-muted rounded text-xs">
                            <span className="text-blue-400">💰</span>
                            <span className="text-muted-foreground">
                              {formatCurrency((transaction.amountIn || 0) * 200)}
                            </span>
                          </div>
                          {transaction.fees && (
                            <div className="flex items-center space-x-1 px-2 py-1 bg-muted rounded text-xs">
                              <span className="text-orange-400">⚡</span>
                              <span className="text-muted-foreground">
                                {formatNumber(transaction.fees, 6)} SOL
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Right stats - Actions */}
                        <div className="flex items-center justify-between sm:justify-end space-x-2">
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="p-1 h-auto hover:bg-muted rounded-lg"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {transaction.transactionHash && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  window.open(`https://solscan.io/tx/${transaction.transactionHash}`, '_blank');
                                }}
                                className="p-1 h-auto hover:bg-muted rounded-lg"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {transaction.status === 'success' ? (
                              <span className="text-green-600">✓ Success</span>
                            ) : (
                              <span className="text-red-600">✗ Failed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">
                    No transactions found
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Start trading to see your transaction history
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      
      {/* Trade Config Prompt Modal */}
      {showTradeConfigPrompt && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-popover border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Trade Configuration Required
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                You need to configure your trading settings before you can auto sell tokens. 
                This includes setting your preferred slippage, trade amounts, and risk management options.
              </p>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <Link href="/settings?tab=trading" className="flex-1">
                  <Button
                    onClick={handleTradeConfigPromptClose}
                    className="w-full"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Configure Trading
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={handleTradeConfigPromptClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </AppLayout>
  );
};

export default PortfolioPage;
