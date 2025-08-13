'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useUserStore } from '@/stores/use-user-store';
import { useTokenLazyLoading } from '@/hooks/use-token-lazy-loading';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  TrendingUp,
  Eye,
  EyeOff,
  Info,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import { WalletInfo } from '@/types';
import { useNotifications } from '@/stores/use-ui-store';
import {
  formatWalletAddress,
  formatCurrency,
  copyToClipboard,
  cn,
  safeFormatAmount,
} from '@/lib/utils';
import { executeInstantSell, checkTradeConfig } from '@/lib/trade-utils';
import QRCode from 'react-qr-code';

interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  value: number;
  change24h: number;
  // Enhanced properties from token details
  image?: string;
  verified?: boolean;
  holders?: number;
  riskScore?: number;
  isRugged?: boolean;
  website?: string;
  twitter?: string;
  telegram?: string;
  hasDetails?: boolean;
}

export function WalletDropdown() {
  const { user } = useUserStore();
  const { refreshAccountDetails } = useUserStore();
  const { showSuccess, showError } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sellingTokens, setSellingTokens] = useState<Set<string>>(new Set());
  const [showTradeConfigPrompt, setShowTradeConfigPrompt] = useState(false);
  const [pendingSellToken, setPendingSellToken] = useState<TokenBalance | null>(null);
  const [showFund, setShowFund] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize token lazy loading
  const {
    tokens: tokenDetails,
    loading: loadingTokenDetails,
    error: tokenDetailsError,
    progress: tokenProgress,
    loadTokens,
    getToken
  } = useTokenLazyLoading({
    batchSize: 10,
    maxConcurrentBatches: 2,
    cacheEnabled: true,
    onProgress: (loaded, total, currentBatch, totalBatches) => {
      console.log(`Loading token details: ${loaded}/${total} (batch ${currentBatch}/${totalBatches})`);
    },
    onError: (error) => {
      console.error('Token details loading error:', error);
    }
  });

  // Determine if user authenticated with wallet (has walletAddress)
  const isWalletAuthenticated = !!user?.walletAddress;

  // Get trading wallet data from user account details or fallback to empty data
  const tradingWallet = useMemo(() => {
    return user?.accountDetails
      ? {
          address: user.accountDetails.address,
          solBalance: user.accountDetails.balance || 0,
          solValueUsd: user.accountDetails.solValueUsd || 0,
          totalValue: user.accountDetails.totalValueUsd || 
            (user.accountDetails.tokens || []).reduce(
              (sum, token) => sum + (token.value || 0),
              0
            ) + (user.accountDetails.solValueUsd || (user.accountDetails.balance || 0)),
          tokens: (user.accountDetails.tokens || []).map(token => {
            // Debug: Log original token data
            console.log(`Original token data for ${token.mint}:`, {
              name: token.name,
              symbol: token.symbol,
              image: token.image,
              balance: token.balance,
              value: token.value
            });
            
            // Get detailed token information if available
            const tokenDetail = getToken(token.mint);
            
            // Debug logging
            if (tokenDetail) {
              console.log(`Token ${token.mint} details:`, {
                originalName: token.name,
                originalSymbol: token.symbol,
                detailName: tokenDetail.token?.name,
                detailSymbol: tokenDetail.token?.symbol,
                finalName: tokenDetail.token?.name || token.name || 'Unknown Token',
                finalSymbol: tokenDetail.token?.symbol || token.symbol || 'UNKNOWN'
              });
            }
            
            return {
              mint: token.mint,
              // Prioritize detailed token info for name and symbol
              symbol: tokenDetail?.token?.symbol || token.symbol || 'UNKNOWN',
              name: tokenDetail?.token?.name || token.name || 'Unknown Token',
              balance: token.balance || 0,
              value: token.value || 0,
              change24h: 0, // This would need to come from price data
              // Enhanced data from token details
              image: tokenDetail?.token?.image || tokenDetail?.token?.logoURI || token.image,
              verified: tokenDetail?.token?.verified || false,
              holders: tokenDetail?.holders || 0,
              riskScore: tokenDetail?.risk?.score || 0,
              isRugged: tokenDetail?.risk?.rugged || false,
              website: tokenDetail?.token?.website,
              twitter: tokenDetail?.token?.twitter,
              telegram: tokenDetail?.token?.telegram,
              hasDetails: !!tokenDetail
            };
          }),
          hasError: user.accountDetails._hasError || false,
          errorMessage: user.accountDetails._errorMessage || ''
        }
      : null;
  }, [user?.accountDetails, tokenDetails]); // Re-compute when token details change

  // Load token details when dropdown opens and tokens are available
  useEffect(() => {
    if (isOpen && tradingWallet && tradingWallet.tokens.length > 0) {
      const tokenMints = tradingWallet.tokens.map(token => token.mint).filter(mint => mint && mint.length > 0);
      if (tokenMints.length > 0) {
        console.log(`Loading details for ${tokenMints.length} tokens:`, tokenMints);
        loadTokens(tokenMints);
      }
    }
  }, [isOpen, tradingWallet?.tokens.length, loadTokens]);

  // Debug: Log when token details change
  useEffect(() => {
    if (tokenDetails.size > 0) {
      console.log(`Token details loaded for ${tokenDetails.size} tokens:`, Array.from(tokenDetails.entries()));
    }
  }, [tokenDetails]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }

    return undefined;
  }, [isOpen]);

  const handleCopyAddress = async (
    address: string,
    type: 'trading' | 'phantom'
  ) => {
    try {
      await copyToClipboard(address);
      showSuccess(
        'Address Copied',
        `${type === 'trading' ? 'Trading' : 'Phantom'} wallet address copied to clipboard`
      );
    } catch (error) {
      showError('Copy Failed', 'Failed to copy address to clipboard');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshAccountDetails();
      showSuccess('Account Details Updated', 'Wallet account details have been refreshed successfully');
    } catch (error: any) {
      console.error('Failed to refresh account details:', error);
      showError('Refresh Failed', error.message || 'Failed to refresh account details');
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleBalanceVisibility = () => {
    setIsBalanceVisible(!isBalanceVisible);
  };

  const formatBalanceDisplay = (amount: number) => {
    return isBalanceVisible ? formatCurrency(amount) : '••••••';
  };

  // Handle instant sell
  const handleInstantSell = async (token: TokenBalance, e: React.MouseEvent) => {
    e.stopPropagation();

    // Check if already selling this token
    if (sellingTokens.has(token.mint)) {
      return;
    }

    try {
      // First check if user has trade config
      const configCheck = await checkTradeConfig();
      
      if (!configCheck.hasConfig) {
        // Show trade config prompt
        setPendingSellToken(token);
        setShowTradeConfigPrompt(true);
        return;
      }

      // Add token to selling set
      setSellingTokens(prev => new Set(prev).add(token.mint));

      // Execute instant sell
      const result = await executeInstantSell(token.mint, token.symbol, token.balance);

      if (result.success) {
        showSuccess(
          'Sell Order Executed',
          `Successfully sold ${token.symbol || 'token'} for ${result.result?.outputAmount?.toFixed(4) || 'N/A'} SOL`
        );

        // Refresh account details to update balances
        await refreshAccountDetails();

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
        newSet.delete(token.mint);
        return newSet;
      });
    }
  };

  // Handle trade config prompt close
  const handleTradeConfigPromptClose = () => {
    setShowTradeConfigPrompt(false);
    setPendingSellToken(null);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Wallet Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label="Open wallet dropdown"
        aria-expanded={isOpen}
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline-block text-sm font-medium">
          {formatBalanceDisplay(tradingWallet?.totalValue || 0)}
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-lg shadow-lg z-[60]">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Your Wallets
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleBalanceVisibility}
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={
                    isBalanceVisible ? 'Hide balances' : 'Show balances'
                  }
                >
                  {isBalanceVisible ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={handleRefresh}
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  aria-label="Refresh balances"
                >
                  <RefreshCw
                    className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Trading Wallet */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-accent-gradient rounded-full flex items-center justify-center">
                  <Wallet className="h-3 w-3 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Trading Wallet
                  </p>
                </div>
              </div>
              <div className="text-right">
                {tradingWallet?.hasError ? (
                  <div className="flex items-center space-x-2">
                    <div>
                      <p className="text-sm font-semibold text-yellow-600">
                        Details Unavailable
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Click refresh to load
                      </p>
                    </div>
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="p-1 rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors disabled:opacity-50"
                      title="Refresh account details"
                    >
                      <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                    </button>
                  </div>
                ) : (
                  <>
                <p className="text-sm font-semibold text-foreground">
                  {formatBalanceDisplay(tradingWallet?.totalValue || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBalanceDisplay(tradingWallet?.solValueUsd || 0)} • {isBalanceVisible ? `${tradingWallet?.solBalance?.toFixed(4) || '0.0000'} SOL` : '•••• SOL'}
                </p>
                  </>
                )}
              </div>
            </div>

            {/* Address or Error Message */}
            {tradingWallet?.hasError ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex items-start space-x-2">
                  <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-white">!</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800">
                      Account Details Error
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      {tradingWallet.errorMessage || 'Unable to load account details'}
                    </p>
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="mt-2 px-3 py-1 text-xs bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300 transition-colors disabled:opacity-50"
                    >
                      {isRefreshing ? 'Refreshing...' : 'Refresh Account Details'}
                    </button>
                  </div>
                </div>
              </div>
            ) : tradingWallet?.address ? (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-mono">
                  {formatWalletAddress(tradingWallet.address)}
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() =>
                      handleCopyAddress(tradingWallet.address, 'trading')
                  }
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Copy trading wallet address"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="View on explorer"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
            ) : (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  No address available
                </span>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors disabled:opacity-50"
                  title="Refresh account details"
                >
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            )}

            {/* Fund Section Toggle */}
            {tradingWallet && !tradingWallet.hasError && tradingWallet.address && (
              <div className="mt-3">
                <Button size="sm" variant="outline" className="w-full" onClick={() => setShowFund(!showFund)}>
                  <DollarSign className="h-3 w-3 mr-1" />
                  {showFund ? 'Hide Funding Info' : 'Fund'}
                </Button>

                {showFund && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-md border border-border">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="bg-white p-2 rounded">
                        <QRCode value={tradingWallet.address} size={132} />
                      </div>
                      <div className="w-full flex items-center justify-between text-xs">
                        <span className="font-mono break-all">
                          {tradingWallet.address}
                        </span>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            onClick={() => handleCopyAddress(tradingWallet.address, 'trading')}
                            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Copy deposit address"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <a
                            href={`https://solscan.io/account/${tradingWallet.address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="View address on Solscan"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">
                        Use this address to deposit SOL or SPL tokens to your trading wallet.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Token Holdings */}
          {tradingWallet && !tradingWallet.hasError && tradingWallet.tokens.length > 0 && (
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Token Holdings ({tradingWallet.tokens.length})
                </h4>
                {loadingTokenDetails && (
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Loading details...</span>
                  </div>
                )}
              </div>
              
              {/* Progress bar for token loading */}
              {loadingTokenDetails && tokenProgress.total > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Loading token details</span>
                    <span>{tokenProgress.percentage}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1">
                    <div 
                      className="bg-primary h-1 rounded-full transition-all duration-300"
                      style={{ width: `${tokenProgress.percentage}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {tradingWallet.tokens.map(token => (
                  <div
                    key={token.mint || token.symbol}
                    className="flex items-center justify-between group hover:bg-muted/50 rounded-md p-1 transition-colors"
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      {/* Token Image */}
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                        {token.image ? (
                          <img 
                            src={token.image} 
                            alt={token.symbol}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to symbol initial if image fails
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.parentElement!.innerHTML = `<span class="text-xs font-bold text-muted-foreground">${token.symbol.charAt(0)}</span>`;
                            }}
                          />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">
                            {token.symbol.charAt(0)}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1">
                          <p className="text-xs font-medium text-foreground truncate">
                            {token.symbol}
                          </p>
                          
                          {/* Verification badge */}
                          {token.verified && (
                            <div className="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                          
                          {/* Risk warning */}
                          {token.isRugged && (
                            <div className="w-3 h-3 bg-red-500 rounded-full flex items-center justify-center" title="High Risk Token">
                              <span className="text-xs font-bold text-white">!</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <p className="text-xs text-muted-foreground truncate">
                            {token.name}
                          </p>
                          {token.hasDetails && (
                            <Info className="w-2 h-2 text-muted-foreground opacity-50" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center space-x-1 mb-1">
                        <p className="text-xs font-medium text-foreground">
                          {formatBalanceDisplay(token.value)}
                        </p>
                        {/* Auto Sell Button */}
                        <button
                          onClick={(e) => handleInstantSell(token, e)}
                          disabled={sellingTokens.has(token.mint)}
                          className="p-1 rounded bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 group-hover:opacity-100 opacity-0"
                          title={`Auto sell ${token.symbol}`}
                        >
                          {sellingTokens.has(token.mint) ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-end space-x-1">
                        <p className="text-xs text-muted-foreground">
                          {!isBalanceVisible ? '••••••' : `${safeFormatAmount(token.balance, 4, '0.0000')} ${token.symbol}`}
                        </p>
                        {token.change24h !== 0 && (
                          <span
                            className={cn(
                              'text-xs',
                              token.change24h >= 0
                                ? 'text-green-500'
                                : 'text-red-500'
                            )}
                          >
                            {token.change24h >= 0 ? '+' : ''}
                            {token.change24h.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      
                      {/* Additional info on hover */}
                      {token.hasDetails && token.holders && token.holders > 0 && (
                        <p className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          {token.holders.toLocaleString()} holders
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Error state for token loading */}
              {tokenDetailsError && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Failed to load token details: {tokenDetailsError}
                  </p>
                </div>
              )}
                {/* Token enrichment info */}
                {tradingWallet.tokens.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-muted">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <span>
                          {tradingWallet.tokens.filter(t => t.hasDetails).length}/{tradingWallet.tokens.length} enriched
                        </span>
                        {loadingTokenDetails && (
                          <div className="flex items-center space-x-1">
                            <span>•</span>
                            <span>Loading batch {tokenProgress.currentBatch}/{tokenProgress.totalBatches}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const tokenMints = tradingWallet.tokens.map(token => token.mint).filter(mint => mint && mint.length > 0);
                          if (tokenMints.length > 0) {
                            loadTokens(tokenMints);
                          }
                        }}
                        disabled={loadingTokenDetails}
                        className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        title="Refresh token details"
                      >
                        <RefreshCw className={cn('h-3 w-3', loadingTokenDetails && 'animate-spin')} />
                      </button>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Phantom Wallet Status (Only for wallet-authenticated users) */}
          {isWalletAuthenticated && user?.walletAddress && (
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">P</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Phantom Wallet
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Connected for auth
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600">Connected</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-muted-foreground font-mono">
                  {formatWalletAddress(user.walletAddress)}
                </span>
                <button
                  onClick={() =>
                    handleCopyAddress(user.walletAddress!, 'phantom')
                  }
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Copy phantom wallet address"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="px-4 py-3">
            <div className="flex space-x-2">
              <Button size="sm" variant="outline" className="flex-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                Portfolio
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                <ExternalLink className="h-3 w-3 mr-1" />
                History
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Trade Config Prompt Modal */}
      {showTradeConfigPrompt && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-popover border border-border rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Trade Configuration Required
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                You need to configure your trading settings before you can auto sell tokens. 
                This includes setting your preferred slippage, trade amounts, and risk management options.
              </p>
              <div className="flex space-x-3">
                <Button
                  onClick={() => {
                    handleTradeConfigPromptClose();
                    // Navigate to settings (you might want to use router here)
                    window.location.href = '/settings?tab=trading';
                  }}
                  className="flex-1"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Configure Trading
                </Button>
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
  );
}

export default WalletDropdown;
