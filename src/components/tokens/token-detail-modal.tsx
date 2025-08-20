'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ExternalLink,
  Copy,
  Zap,
  Users,
  TrendingUp,
  DollarSign,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Twitter,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/stores/use-ui-store';
import TradeConfigPrompt from '@/components/ui/trade-config-prompt';
import { Skeleton } from '@/components/ui/skeleton-loaders';

// Loading skeleton components for better UX
const ChartLoadingSkeleton = () => (
  <div className="h-[420px] flex flex-col items-center justify-center text-center p-6 space-y-4">
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-64 w-full" />
      <div className="flex justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  </div>
);

const StatCardSkeleton = () => (
  <div className="bg-muted/30 border border-border rounded-xl p-4">
    <div className="text-center space-y-2">
      <Skeleton className="h-8 w-8 mx-auto" />
      <Skeleton className="h-6 w-16 mx-auto" />
      <Skeleton className="h-3 w-12 mx-auto" />
    </div>
  </div>
);

const ErrorFallback = ({ 
  title, 
  message, 
  onRetry, 
  icon: Icon = AlertTriangle 
}: { 
  title: string; 
  message: string; 
  onRetry?: () => void;
  icon?: React.ComponentType<any>;
}) => (
  <div className="text-center py-8">
    <Icon className="w-12 h-12 text-orange-500 mx-auto mb-4" />
    <h4 className="text-lg font-semibold text-foreground mb-2">{title}</h4>
    <p className="text-muted-foreground mb-4">{message}</p>
    {onRetry && (
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="border-border hover:bg-muted"
      >
        Retry
      </Button>
    )}
  </div>
);
import {
  copyToClipboard,
  formatCurrency,
  formatNumber,
  formatRelativeTime,
} from '@/lib/utils';
import { executeInstantBuy, checkTradeConfig } from '@/lib/trade-utils';

// Updated interfaces to handle incomplete data gracefully
interface TokenData {
  name?: string;
  symbol: string;
  mint: string;
  uri?: string;
  decimals?: number;
  hasFileMetaData?: boolean;
  createdOn?: string;
  description?: string;
  image?: string;
  showName?: boolean;
  twitter?: string;
  creation?: {
    creator?: string;
    created_tx?: string;
    created_time?: number;
  };
}

interface PoolData {
  liquidity?: {
    quote?: number;
    usd?: number;
  };
  price?: {
    quote?: number;
    usd?: number;
  };
  tokenSupply?: number;
  lpBurn?: number;
  tokenAddress?: string;
  marketCap?: {
    quote?: number;
    usd?: number;
  };
  decimals?: number;
  security?: {
    freezeAuthority?: string | null;
    mintAuthority?: string | null;
  };
  quoteToken?: string;
  market?: string;
  lastUpdated?: number;
  createdAt?: number;
  txns?: {
    buys?: number;
    sells?: number;
    total?: number;
    volume?: number;
    volume24h?: number;
  };
  deployer?: string;
  poolId?: string;
}

interface PriceEvents {
  [key: string]: {
    priceChangePercentage?: number;
  };
}

interface RiskData {
  snipers?: {
    count?: number;
    totalBalance?: number;
    totalPercentage?: number;
    wallets?: any[];
  };
  insiders?: {
    count?: number;
    totalBalance?: number;
    totalPercentage?: number;
    wallets?: any[];
  };
  rugged?: boolean;
  risks?: any[];
  score?: number;
  jupiterVerified?: boolean;
}

interface LoadingStates {
  chart?: boolean;
  priceData?: boolean;
  riskData?: boolean;
  poolData?: boolean;
}

interface ErrorStates {
  chart?: string;
  priceData?: string;
  riskData?: string;
  poolData?: string;
}

interface TokenDetailData {
  token: TokenData;
  pools?: PoolData[];
  events?: PriceEvents;
  risk?: RiskData;
  buysCount?: number;
  sellsCount?: number;
  // Add loading and error states
  isLoading?: LoadingStates;
  errors?: ErrorStates;
}

interface TokenDetailModalProps {
  tokenData: TokenDetailData | null;
  isOpen: boolean;
  onClose: () => void;
}

const TokenDetailModal: React.FC<TokenDetailModalProps> = ({
  tokenData,
  isOpen,
  onClose,
}) => {
  const { showError, showSuccess } = useNotifications();
  const [dexPair, setDexPair] = React.useState<string | null>(null);
  const [themeMode, setThemeMode] = React.useState<'dark' | 'light'>('dark');
  const [isBuying, setIsBuying] = React.useState(false);
  const [showTradeConfigPrompt, setShowTradeConfigPrompt] = React.useState(false);
  const [chartRetryCount, setChartRetryCount] = React.useState(0);
  const [localErrors, setLocalErrors] = React.useState<ErrorStates>({});

  // Focus management refs
  const modalRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  // Handle null tokenData
  if (!tokenData) {
    return null;
  }

  const { token, pools = [], events = {}, risk, isLoading = {}, errors = {} } = tokenData;
  
  // Validate essential token data
  if (!token) {
    return null;
  }

  // Ensure we have at least a mint address or symbol
  if (!token.mint && !token.symbol) {
    return null;
  }
  
  // Safe fallbacks for all data
  const safeRisk = risk || { 
    snipers: { count: 0, totalBalance: 0, totalPercentage: 0, wallets: [] }, 
    insiders: { count: 0, totalBalance: 0, totalPercentage: 0, wallets: [] }, 
    rugged: false, 
    risks: [], 
    score: 0, 
    jupiterVerified: false 
  };
  
  const primaryPool = pools.length > 0 ? pools[0] : null;
  
  // Check if we have minimal data to show the modal
  const hasMinimalData = token.symbol || token.name || token.mint;
  
  // Helper function to safely get nested values
  const safeGet = (obj: any, path: string, defaultValue: any = 0) => {
    return path.split('.').reduce((current, key) => current?.[key], obj) ?? defaultValue;
  };

  // Determine theme for embedded widget
  React.useEffect(() => {
    try {
      const isDark = document.documentElement.classList.contains('dark');
      setThemeMode(isDark ? 'dark' : 'light');
    } catch {}
  }, []);

  // Retry chart loading function
  const retryChartLoading = React.useCallback(() => {
    setChartRetryCount(prev => prev + 1);
    setLocalErrors(prev => ({ ...prev, chart: undefined }));
    setDexPair(null); // Reset to trigger re-fetch
  }, []);

  // Resolve DexScreener pair address to embed
  React.useEffect(() => {
    let cancelled = false;
    const resolvePair = async () => {
      if (!token?.mint) {
        if (!cancelled) {
          setLocalErrors(prev => ({ 
            ...prev, 
            chart: 'Token address is required to load chart' 
          }));
        }
        return;
      }

      try {
        // Prefer poolId if available in provided pools
        const poolWithId = pools.find(p => typeof p?.poolId === 'string' && p.poolId.length > 0);
        if (poolWithId?.poolId) {
          if (!cancelled) setDexPair(poolWithId.poolId);
          return;
        }
        
        // Fallback: query DexScreener for pairs by token address
        const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${token.mint}`);
        if (!res.ok) {
          if (!cancelled) {
            setLocalErrors(prev => ({ 
              ...prev, 
              chart: `Failed to fetch chart data (${res.status})` 
            }));
          }
          return;
        }
        
        const data = await res.json();
        const pairs = data?.pairs || data; // Handle different response formats
        
        if (Array.isArray(pairs) && pairs.length > 0) {
          // Pick by highest liquidity.usd
          const best = pairs
            .filter(p => p?.pairAddress)
            .sort((a, b) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0];
          if (!cancelled && best?.pairAddress) {
            setDexPair(best.pairAddress);
          } else if (!cancelled) {
            setLocalErrors(prev => ({ 
              ...prev, 
              chart: 'No valid trading pairs found for this token' 
            }));
          }
        } else if (!cancelled) {
          setLocalErrors(prev => ({ 
            ...prev, 
            chart: 'No trading pairs available for this token' 
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setLocalErrors(prev => ({ 
            ...prev, 
            chart: 'Failed to load chart data. Please try again.' 
          }));
        }
      }
    };
    
    resolvePair();
    
    return () => {
      cancelled = true;
    };
  }, [token?.mint, pools, chartRetryCount]);

  if (!isOpen) return null;

  const handleCopyAddress = async () => {
    const success = await copyToClipboard(token.mint);
    if (success) {
      showSuccess('Copied!', 'Token address copied to clipboard');
    } else {
      showError('Copy Failed', 'Failed to copy token address', 'error');
    }
  };

  const handleQuickBuy = async () => {
    try {
      // Check if we have required token data
      if (!token?.mint) {
        showError('Buy Order Failed', 'Token address is required to execute trade');
        return;
      }

      if (!token.symbol) {
        showError('Buy Order Failed', 'Token symbol is required to execute trade');
        return;
      }

      // First check if user has trade config
      const configCheck = await checkTradeConfig();
      
      if (!configCheck.hasConfig) {
        // Show trade config prompt instead of redirecting
        setShowTradeConfigPrompt(true);
        return;
      }

      // Execute instant buy
      setIsBuying(true);
      const result = await executeInstantBuy(token.mint, token.symbol);

      if (result.success) {
        showSuccess(
          'Buy Order Executed',
          `Successfully bought ${token.symbol} for ${configCheck.config?.tradeConfig?.minSpend || 'N/A'} SOL`
        );
        onClose();

        // Optional: Show transaction details
        if (result.result?.transactionId) {
          // Transaction completed successfully
        }
      } else {
        showError('Buy Order Failed', result.error || 'Failed to execute buy order');
      }
    } catch (error: any) {
      showError('Buy Order Error', error.message || 'An unexpected error occurred during the trade');
    } finally {
      setIsBuying(false);
    }
  };

  const handleViewOnExplorer = () => {
    if (!token?.mint) {
      showError('Navigation Error', 'Token address is required to view on explorer');
      return;
    }
    try {
      window.open(`https://solscan.io/token/${token.mint}`, '_blank');
    } catch (error) {
      showError('Navigation Error', 'Failed to open explorer link');
    }
  };

  const handleViewOnDexScreener = () => {
    if (!token?.mint) {
      showError('Navigation Error', 'Token address is required to view on DexScreener');
      return;
    }
    try {
      window.open(`https://dexscreener.com/solana/${token.mint}`, '_blank');
    } catch (error) {
      showError('Navigation Error', 'Failed to open DexScreener link');
    }
  };

  const handleTwitter = () => {
    if (!token?.twitter) {
      showError('Navigation Error', 'Twitter link is not available for this token');
      return;
    }
    try {
      window.open(token.twitter, '_blank');
    } catch (error) {
      showError('Navigation Error', 'Failed to open Twitter link');
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return formatRelativeTime(date);
  };

  const getPriceChangeColor = (percentage: number) => {
    if (percentage > 0) return 'text-green-600 dark:text-green-400';
    if (percentage < 0) return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground';
  };

  const getRiskColor = (score: number) => {
    if (score <= 2) return 'text-green-600 dark:text-green-400';
    if (score <= 5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Handle focus management and keyboard navigation
  React.useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      // Focus the modal
      setTimeout(() => {
        modalRef.current?.focus();
      }, 100);

      // Handle escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      // Handle tab trapping
      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key === 'Tab' && modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement?.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement?.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleEscape);
      document.addEventListener('keydown', handleTabKey);

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('keydown', handleTabKey);
      };
    } else {
      // Restore focus when modal closes
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen, onClose]);

  const renderModalContent = () => (
    <div>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-modal-title"
        aria-describedby="token-modal-description"
        tabIndex={-1}
        className="fixed inset-2 sm:inset-4 md:inset-8 lg:inset-16 xl:inset-24 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-[100] overflow-hidden flex flex-col max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] focus:outline-none"
        style={{ minHeight: '400px', minWidth: '300px' }}
      >


        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
            {/* Token Logo */}
            <div className="relative w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0">
              {token.image ? (
                <>
                  <img
                    src={token.image}
                    alt={token.symbol}
                    className="w-full h-full rounded-full border-2 border-muted object-cover"
                    onError={e => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      // Show fallback
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div 
                    className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center border-2 border-muted"
                    style={{ display: 'none' }}
                  >
                    <span className="text-primary-foreground font-bold text-lg sm:text-xl">
                      {token.symbol?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center border-2 border-muted">
                  <span className="text-primary-foreground font-bold text-lg sm:text-xl">
                    {token.symbol?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start space-x-2 sm:space-x-3">
                <h2 
                  id="token-modal-title"
                  className="text-lg sm:text-2xl font-bold text-foreground truncate"
                >
                  {token.name || token.symbol || (token.mint ? `Token ${token.mint.slice(0, 8)}...` : 'Unknown Token')}
                </h2>
                {safeRisk.jupiterVerified && (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                <p className="text-sm sm:text-lg text-muted-foreground font-medium">
                  {token.symbol || (token.mint ? token.mint.slice(0, 12) + '...' : 'N/A')}
                </p>
                {token.createdOn && (
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Created on {token.createdOn}
                  </span>
                )}
                {token.twitter && (
                  <button
                    onClick={handleTwitter}
                    className="text-blue-500 hover:text-blue-600 transition-colors self-start"
                    title="View on Twitter"
                  >
                    <Twitter className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="hover:bg-muted rounded-lg flex-shrink-0 ml-2"
            aria-label="Close token details modal"
            title="Close modal (Escape)"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6"
          id="token-modal-description"
        >
          {/* Screen reader description */}
          <div className="sr-only">
            Token details for {token.symbol || token.name}. 
            This modal contains live chart data, market statistics, price performance, 
            trading activity, and security analysis for the selected token.
            Use Tab to navigate between interactive elements, or press Escape to close.
          </div>

          {/* Data Completeness Indicator */}
          {(!primaryPool || !events || Object.keys(events).length === 0) && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Limited Data Available
                  </h4>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    Some market data may be incomplete or unavailable for this token. 
                    Information will be updated as it becomes available.
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* Live Chart (DexScreener) */}
          <div className="bg-muted/30 border border-border rounded-xl overflow-hidden">
            <div className="p-4 sm:p-6 pb-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg sm:text-xl font-semibold text-foreground">Live Chart</h3>
                {isLoading.chart && (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span>Loading chart...</span>
                  </div>
                )}
              </div>
            </div>
            <div className="w-full overflow-hidden" style={{ minHeight: 420 }}>
              {errors.chart || localErrors.chart ? (
                <ErrorFallback
                  title="Chart Unavailable"
                  message={errors.chart || localErrors.chart || 'Unable to load chart data at this time.'}
                  onRetry={retryChartLoading}
                />
              ) : isLoading.chart || !dexPair ? (
                <ChartLoadingSkeleton />
              ) : (
                <iframe
                  title={`Live price chart for ${token.symbol || token.name || 'token'} from DexScreener`}
                  src={`https://dexscreener.com/solana/${dexPair}?embed=1&theme=${themeMode}&chart=1&layout=chart&trades=0&info=0`}
                  className="w-full h-[460px] border-0 block"
                  allow="clipboard-write; encrypted-media"
                  aria-label={`Interactive price chart showing trading data for ${token.symbol || token.name || 'token'}`}
                  onError={() => {
                    setLocalErrors(prev => ({ 
                      ...prev, 
                      chart: 'Chart failed to load. Please try again.' 
                    }));
                  }}
                />
              )}
            </div>
          </div>

          {/* Price and Market Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Current Price */}
            <div className="col-span-2 lg:col-span-1 bg-muted/30 border border-border rounded-xl p-4">
              <div className="text-center">
                {isLoading.priceData ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-20 mx-auto" />
                    <Skeleton className="h-4 w-16 mx-auto" />
                    <Skeleton className="h-3 w-12 mx-auto" />
                  </div>
                ) : errors.priceData ? (
                  <div className="space-y-2">
                    <AlertTriangle className="h-6 w-6 text-orange-500 mx-auto" />
                    <div className="text-xs text-muted-foreground">Price unavailable</div>
                  </div>
                ) : (
                  <>
                    <div className="text-xl sm:text-2xl font-bold text-foreground mb-1">
                      {safeGet(primaryPool, 'price.usd') > 0 
                        ? formatCurrency(safeGet(primaryPool, 'price.usd'))
                        : 'N/A'
                      }
                    </div>
                    <div className="flex items-center justify-center space-x-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          (safeGet(events, '24h.priceChangePercentage') || 0) >= 0
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                      ></span>
                      <span
                        className={`text-sm font-medium ${getPriceChangeColor(safeGet(events, '24h.priceChangePercentage') || 0)}`}
                      >
                        {(safeGet(events, '24h.priceChangePercentage') || 0) >= 0 ? '+' : ''}
                        {formatNumber(safeGet(events, '24h.priceChangePercentage') || 0, 2)}
                        %
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      24h Change
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Market Cap */}
            {isLoading.poolData ? (
              <StatCardSkeleton />
            ) : (
              <div className="bg-muted/30 border border-border rounded-xl p-4">
                <div className="text-center">
                  <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 mx-auto mb-2" />
                  <div className="text-sm sm:text-lg font-bold text-foreground">
                    {safeGet(primaryPool, 'marketCap.usd') > 0 
                      ? formatCurrency(safeGet(primaryPool, 'marketCap.usd'))
                      : 'N/A'
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">Market Cap</div>
                </div>
              </div>
            )}

            {/* 24h Volume */}
            {isLoading.poolData ? (
              <StatCardSkeleton />
            ) : (
              <div className="bg-muted/30 border border-border rounded-xl p-4">
                <div className="text-center">
                  <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500 mx-auto mb-2" />
                  <div className="text-sm sm:text-lg font-bold text-foreground">
                    {safeGet(primaryPool, 'txns.volume24h') > 0 && safeGet(primaryPool, 'price.usd') > 0
                      ? formatCurrency(
                          safeGet(primaryPool, 'txns.volume24h') * safeGet(primaryPool, 'price.usd')
                        )
                      : 'N/A'
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">24h Volume</div>
                </div>
              </div>
            )}

            {/* Liquidity */}
            {isLoading.poolData ? (
              <StatCardSkeleton />
            ) : (
              <div className="bg-muted/30 border border-border rounded-xl p-4">
                <div className="text-center">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500 mx-auto mb-2" />
                  <div className="text-sm sm:text-lg font-bold text-foreground">
                    {safeGet(primaryPool, 'liquidity.usd') > 0 
                      ? formatCurrency(safeGet(primaryPool, 'liquidity.usd'))
                      : 'N/A'
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">Liquidity</div>
                </div>
              </div>
            )}
          </div>

          {/* Price Performance Over Time */}
          <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Price Performance
            </h3>
            {isLoading.priceData ? (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="text-center space-y-2">
                    <Skeleton className="h-3 w-8 mx-auto" />
                    <Skeleton className="h-4 w-12 mx-auto" />
                  </div>
                ))}
              </div>
            ) : Object.keys(events).length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {Object.entries(events).map(([timeframe, data]) => (
                  <div key={timeframe} className="text-center">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">
                      {timeframe.toUpperCase()}
                    </div>
                    <div
                      className={`text-sm sm:text-lg font-bold ${getPriceChangeColor(data.priceChangePercentage || 0)}`}
                    >
                      {(data.priceChangePercentage || 0) >= 0 ? '+' : ''}
                      {formatNumber(data.priceChangePercentage || 0, 2)}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Price performance data is not available for this token.
                </p>
              </div>
            )}
          </div>

          {/* Trading Activity */}
          <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4">
              Trading Activity
            </h3>
            {isLoading.poolData ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="text-center space-y-2">
                    <Skeleton className="h-6 w-16 mx-auto" />
                    <Skeleton className="h-3 w-12 mx-auto" />
                  </div>
                ))}
              </div>
            ) : primaryPool ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatNumber(safeGet(primaryPool, 'txns.buys') || 0)}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Total Buys
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">
                    {formatNumber(safeGet(primaryPool, 'txns.sells') || 0)}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Total Sells
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-foreground">
                    {formatNumber(safeGet(primaryPool, 'txns.total') || 0)}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Total Trades
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {safeGet(primaryPool, 'lpBurn') || 0}%
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    LP Burned
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Trading activity data is not available for this token.
                </p>
              </div>
            )}
          </div>

          {/* Security & Risk Analysis */}
          <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Security & Risk Analysis
            </h3>
            {isLoading.riskData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-24" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </div>
            ) : errors.riskData ? (
              <ErrorFallback
                title="Risk Data Unavailable"
                message={errors.riskData || 'Unable to load risk analysis at this time.'}
                icon={Shield}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Risk Score */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-muted-foreground">
                        Risk Score
                      </span>
                      <div
                        className={`text-xl sm:text-2xl font-bold ${getRiskColor(safeRisk.score || 0)}`}
                      >
                        {safeRisk.score || 0}/10
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span>Jupiter Verified</span>
                        {safeRisk.jupiterVerified ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span>Rugged</span>
                        {safeRisk.rugged ? (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Token Security */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Token Security
                    </h4>
                    {primaryPool?.security ? (
                      <div className="space-y-2 text-xs sm:text-sm">
                        <div className="flex items-center justify-between">
                          <span>Freeze Authority</span>
                          <span
                            className={
                              safeGet(primaryPool, 'security.freezeAuthority')
                                ? 'text-red-500'
                                : 'text-green-500'
                            }
                          >
                            {safeGet(primaryPool, 'security.freezeAuthority')
                              ? 'Present'
                              : 'Revoked'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Mint Authority</span>
                          <span
                            className={
                              safeGet(primaryPool, 'security.mintAuthority')
                                ? 'text-red-500'
                                : 'text-green-500'
                            }
                          >
                            {safeGet(primaryPool, 'security.mintAuthority')
                              ? 'Present'
                              : 'Revoked'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        Security information not available
                      </div>
                    )}
                  </div>
                </div>

                {/* Snipers & Insiders */}
                {((safeRisk.snipers?.count || 0) > 0 || (safeRisk.insiders?.count || 0) > 0) && (
                  <div className="mt-6 pt-4 border-t border-border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(safeRisk.snipers?.count || 0) > 0 && (
                        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                            <span className="font-medium text-orange-800 dark:text-orange-200">
                              Snipers Detected
                            </span>
                          </div>
                          <div className="text-sm text-orange-700 dark:text-orange-300">
                            {safeRisk.snipers?.count || 0} wallets holding{' '}
                            {formatNumber(safeRisk.snipers?.totalPercentage || 0, 2)}%
                          </div>
                        </div>
                      )}
                      {(safeRisk.insiders?.count || 0) > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span className="font-medium text-red-800 dark:text-red-200">
                              Insiders Detected
                            </span>
                          </div>
                          <div className="text-sm text-red-700 dark:text-red-300">
                            {safeRisk.insiders?.count || 0} wallets holding{' '}
                            {formatNumber(safeRisk.insiders?.totalPercentage || 0, 2)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Token Information */}
          <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4">
              Token Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Contract Address
                </label>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="bg-background border border-border rounded px-2 py-1 text-xs sm:text-sm font-mono text-foreground flex-1 truncate">
                    <span className="sm:hidden">
                      {token.mint.slice(0, 8)}...{token.mint.slice(-8)}
                    </span>
                    <span className="hidden sm:inline">{token.mint}</span>
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyAddress}
                    className="p-2 hover:bg-muted rounded-lg flex-shrink-0 focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
                    aria-label={`Copy token address ${token.mint} to clipboard`}
                    title="Copy address to clipboard"
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Copy address</span>
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Created
                </label>
                <div className="text-foreground mt-1 text-sm">
                  {token.creation?.created_time
                    ? formatTimeAgo(token.creation.created_time)
                    : token.createdOn || 'Unknown'}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Total Supply
                </label>
                <div className="text-foreground mt-1 text-sm">
                  {safeGet(primaryPool, 'tokenSupply') > 0 
                    ? formatNumber(safeGet(primaryPool, 'tokenSupply'), 0)
                    : 'N/A'
                  }
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Decimals
                </label>
                <div className="text-foreground mt-1 text-sm">
                  {token.decimals ?? 'N/A'}
                </div>
              </div>

              {token.creation?.creator && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Creator
                  </label>
                  <div className="text-foreground mt-1 font-mono text-xs sm:text-sm">
                    {token.creation.creator.slice(0, 8)}...
                    {token.creation.creator.slice(-8)}
                  </div>
                </div>
              )}

              {primaryPool?.poolId && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Pool ID
                  </label>
                  <div className="text-foreground mt-1 font-mono text-xs sm:text-sm">
                    {primaryPool.poolId.slice(0, 8)}...{primaryPool.poolId.slice(-8)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {token.description ? (
            <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4">
                Description
              </h3>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                {token.description}
              </p>
            </div>
          ) : (
            <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4">
                Description
              </h3>
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm">
                  No description available for this token.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-border bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewOnExplorer}
                className="border-border hover:bg-muted rounded-xl flex-1 sm:flex-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
                aria-label={`View ${token.symbol || 'token'} on Solscan explorer (opens in new tab)`}
                title="View on Solscan explorer"
              >
                <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Solscan</span>
                <span className="sm:hidden">Scan</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewOnDexScreener}
                className="border-border hover:bg-muted rounded-xl flex-1 sm:flex-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
                aria-label={`View ${token.symbol || 'token'} on DexScreener (opens in new tab)`}
                title="View on DexScreener"
              >
                <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">DexScreener</span>
                <span className="sm:hidden">Dex</span>
              </Button>
              {token.uri && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    try {
                      window.open(token.uri, '_blank');
                    } catch (error) {
                      showError('Navigation Error', 'Failed to open metadata link');
                    }
                  }}
                  className="border-border hover:bg-muted rounded-xl flex-1 sm:flex-none"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Metadata</span>
                  <span className="sm:hidden">Meta</span>
                </Button>
              )}
            </div>

            <Button
              onClick={handleQuickBuy}
              disabled={isBuying || !token.mint || !token.symbol}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white rounded-xl w-full sm:w-auto focus:ring-2 focus:ring-green-300 focus:ring-offset-2"
              aria-label={
                isBuying 
                  ? `Purchasing ${token.symbol || 'token'}, please wait`
                  : (!token.mint || !token.symbol) 
                    ? 'Cannot purchase token due to insufficient data'
                    : `Purchase ${token.symbol || 'token'} instantly`
              }
              aria-describedby={isBuying ? 'buy-status' : undefined}
            >
              <Zap className="h-4 w-4 mr-2" aria-hidden="true" />
              {isBuying ? 'Buying...' : (!token.mint || !token.symbol) ? 'Insufficient Data' : 'Buy Token'}
              {isBuying && (
                <span id="buy-status" className="sr-only">
                  Transaction in progress, please wait
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
      {/* Trade Config Prompt */}
      <TradeConfigPrompt
        isOpen={showTradeConfigPrompt}
        onClose={() => setShowTradeConfigPrompt(false)}
        tokenSymbol={token.symbol || token.name}
      />
    </div>
  );

  // Use portal to render modal at document body level
  return typeof document !== 'undefined' ? createPortal(renderModalContent(), document.body) : null;
};

export default TokenDetailModal;
