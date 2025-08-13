'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { formatCurrency, formatWalletAddress, cn, safeFormatAmount, safeToFixed } from '@/lib/utils';
import { KOLTrade as SocketKOLTrade } from '@/hooks/use-kol-trade-socket';
import { KOLTrade as TypesKOLTrade } from '@/types';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  ExternalLink,
  Copy,
  Clock,
  DollarSign,
  ArrowRightLeft,
  Zap,
  Link,
  Brain,
  Target
} from 'lucide-react';
import { useNotifications } from '@/stores/use-ui-store';
import { Button } from '@/components/ui/button';
import { useKOLStore } from '@/stores';
import type { KOLWallet } from '@/types';

// Local helpers to derive Twitter avatar URL similar to other components
function extractTwitterUsername(profileUrl?: string): string | null {
  if (!profileUrl) return null;
  try {
    const url = new URL(profileUrl);
    const hostname = url.hostname.toLowerCase();
    const isTwitter = hostname === 'twitter.com' || hostname === 'www.twitter.com';
    const isX = hostname === 'x.com' || hostname === 'www.x.com';
    if (!isTwitter && !isX) return null;
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) return null;
    const username = pathParts[0];
    if (!username) return null;
    return username.replace(/\.json$/i, '');
  } catch {
    return null;
  }
}

function getTwitterAvatarUrl(twitterUrl?: string, fallbackSeed?: string): string | undefined {
  const username = extractTwitterUsername(twitterUrl);
  if (!username) return undefined;
  const base = `https://unavatar.io/twitter/${encodeURIComponent(username)}`;
  if (fallbackSeed && fallbackSeed.trim().length > 0) {
    const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackSeed)}`;
    return `${base}?fallback=${encodeURIComponent(fallback)}`;
  }
  return base;
}

function findTwitterUrlFromText(text?: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+/i);
  return match ? match[0] : undefined;
}

function findTwitterUrlFromKOL(kol?: { socialLinks?: { twitter?: string }; description?: string }): string | undefined {
  if (!kol) return undefined;
  return kol.socialLinks?.twitter || findTwitterUrlFromText(kol.description);
}

// Union type to handle both interface structures
type KOLTradeUnion = SocketKOLTrade | TypesKOLTrade;

interface KOLTradeCardProps {
  trade: KOLTradeUnion;
  onClick?: (trade: KOLTradeUnion) => void;
  className?: string;
  variant?: 'card' | 'list';
  hideKOLInfo?: boolean;
  compact?: boolean;
}

export const KOLTradeCard: React.FC<KOLTradeCardProps> = ({ 
  trade, 
  onClick,
  className,
  variant = 'card',
  hideKOLInfo = false,
  compact = false
}) => {
  console.log('🚀 KOLTradeCard component rendered');
  
  const { showSuccess, showError } = useNotifications();
  const { getKOL } = useKOLStore();

  // Helper function to check if trade has nested tradeData structure
  const hasNestedTradeData = (trade: KOLTradeUnion): trade is SocketKOLTrade => {
    return 'tradeData' in trade;
  };

  // Extract trade data regardless of structure
  const getTradeData = (trade: KOLTradeUnion) => {
    if (hasNestedTradeData(trade)) {
      return {
        tokenIn: trade.tradeData?.tokenIn || 'Unknown',
        tokenOut: trade.tradeData?.tokenOut || 'Unknown',
        amountIn: trade.tradeData?.amountIn || 0,
        amountOut: trade.tradeData?.amountOut || 0,
        tradeType: trade.tradeData?.tradeType ?? 'sell',
        mint: trade.tradeData?.mint || '',
        source: trade.tradeData?.dexProgram || 'Unknown', // Socket interface uses 'dexProgram' in tradeData
        fee: trade.tradeData?.fee || 0,
        // new optional token metadata fields
        name: trade.tradeData?.name,
        symbol: trade.tradeData?.symbol,
        image: trade.tradeData?.image,
        metadataUri: trade.tradeData?.metadataUri,
        // Get prediction from either top-level or nested in tradeData
        prediction: trade.prediction || (trade.tradeData as any)?.prediction,
      };
    } else {
      return {
        tokenIn: trade.tokenIn || 'Unknown',
        tokenOut: trade.tokenOut || 'Unknown',
        amountIn: trade.amountIn || 0,
        amountOut: trade.amountOut || 0,
        tradeType: trade.tradeType ?? 'sell',
        mint: (trade as any).mint || '',
        source: (trade as any).dexProgram || 'Unknown', // Types interface uses 'dexProgram' at top level
        fee: (trade as any).fee || 0,
        // Keep shape parity by including optional fields if provided on flat type
        name: (trade as any).name,
        symbol: (trade as any).symbol,
        image: (trade as any).image,
        metadataUri: (trade as any).metadataUri,
        // Get prediction from trade object
        prediction: (trade as any).prediction,
      };
    }
  };

  // Extract additional data
  const getAdditionalData = (trade: KOLTradeUnion) => {
    if (hasNestedTradeData(trade)) {
      return {
        affectedUsers: trade.affectedUsers || [],
        mindmapContribution: trade.mindmapContribution,
      };
    } else {
      return {
        affectedUsers: [],
        mindmapContribution: undefined,
      };
    }
  };

  // Helper function to get the correct display amounts based on trade type
  const getTradeAmounts = (tradeData: any) => {
    const isBuy = (tradeData.tradeType ?? 'sell') === 'buy';
    
    if (isBuy) {
      // For buy trades: amountIn = tokens bought, amountOut = SOL spent
      return {
        tokensAmount: tradeData.amountIn || 0,
        solAmount: tradeData.amountOut || 0,
        description: {
          tokens: 'Tokens Bought',
          sol: 'SOL Spent'
        }
      };
    } else {
      // For sell trades: amountOut = tokens sold, amountIn = SOL received
      return {
        tokensAmount: tradeData.amountOut || 0,
        solAmount: tradeData.amountIn || 0,
        description: {
          tokens: 'Tokens Sold',
          sol: 'SOL Received'
        }
      };
    }
  };

  // Helper function to convert lamports to SOL
  const lamportsToSol = (lamports: number) => {
    return lamports / 1_000_000_000; // 1 SOL = 1,000,000,000 lamports
  };

  const tradeData = React.useMemo(() => getTradeData(trade), [trade]);
  const additionalData = React.useMemo(() => getAdditionalData(trade), [trade]);
  const { kolWallet, timestamp, id } = trade;

  // Get the correct amounts based on trade type
  const tradeAmounts = React.useMemo(() => getTradeAmounts(tradeData), [tradeData]);
  
  // Convert fee from lamports to SOL if it exists
  const feeInSol = React.useMemo(() => {
    return tradeData.fee ? lamportsToSol(tradeData.fee) : 0;
  }, [tradeData.fee]);

  // Get the prediction from the extracted trade data
  const prediction = tradeData.prediction;
  
  // Only show prediction for buy trades
  const shouldShowPrediction = prediction && (tradeData.tradeType === 'buy');

  // Debug logging for trade data
  React.useEffect(() => {
    console.log('🔍 KOLTradeCard rendered with trade:', {
      id: trade.id,
      kolWallet: hasNestedTradeData(trade) ? trade.kolWallet : 'N/A',
      timestamp: trade.timestamp,
      hasTradeData: hasNestedTradeData(trade),
      tradeData: hasNestedTradeData(trade) ? trade.tradeData : 'No nested tradeData',
      topLevelPrediction: trade.prediction,
      nestedPrediction: hasNestedTradeData(trade) ? (trade.tradeData as any)?.prediction : 'No nested data',
      extractedPrediction: prediction,
      tradeType: tradeData.tradeType,
      shouldShowPrediction: shouldShowPrediction,
      predictionReason: !shouldShowPrediction ? 
        (!prediction ? 'No prediction data - showing skeleton' : 'Not a buy trade (showing skeleton placeholder)') : 
        'Will show prediction',
      hasPrediction: !!prediction,
      predictionDetails: prediction ? {
        classLabel: prediction.classLabel,
        probability: prediction.probability,
        taskType: prediction.taskType,
        classIndex: prediction.classIndex
      } : 'No prediction',
      rawTrade: trade
    });

    // Additional debug for prediction specifically
    if (prediction) {
      console.log('🧠 ML Prediction found:', {
        classLabel: prediction.classLabel,
        probability: prediction.probability,
        probabilityPercentage: (prediction.probability * 100).toFixed(1) + '%',
        taskType: prediction.taskType,
        classIndex: prediction.classIndex,
        tradeType: tradeData.tradeType,
        shouldShowPrediction: shouldShowPrediction,
        showReason: shouldShowPrediction ? 'Buy trade - will show' : 'Sell trade - showing skeleton placeholder (buy trades only)',
        allProbabilities: prediction.probabilities
      });
    } else {
      console.log('❌ No ML prediction found in trade data');
      console.log('🔍 Checking both locations:', {
        topLevel: trade.prediction,
        nested: hasNestedTradeData(trade) ? (trade.tradeData as any)?.prediction : 'No nested data'
      });
    }
  }, [trade, prediction, shouldShowPrediction]);

  // Safely convert timestamp to Date object
  const tradeDate = React.useMemo(() => {
    if (!timestamp) return null;
    try {
      return timestamp instanceof Date ? timestamp : new Date(timestamp);
    } catch (error) {
      console.warn('Invalid timestamp:', timestamp);
      return null;
    }
  }, [timestamp]);

  // Debug the extracted data
  React.useEffect(() => {
    console.log('🔍 Extracted trade data:', {
      tradeData,
      tradeAmounts,
      feeInSol,
      additionalData,
      kolWallet,
      timestamp,
      tradeDate,
      id,
      displayName: hasNestedTradeData(trade) ? 
        `KOL ${formatWalletAddress(kolWallet)}` : 
        (trade.kolName || `KOL ${formatWalletAddress(kolWallet)}`)
    });
  }, [tradeData, tradeAmounts, feeInSol, additionalData, kolWallet, timestamp, tradeDate, id]);

  const getInfluenceLevel = (score: number) => {
    if (score >= 80) return { level: 'High', color: 'bg-red-500', textColor: 'text-red-500' };
    if (score >= 60) return { level: 'Medium', color: 'bg-orange-500', textColor: 'text-orange-500' };
    if (score >= 40) return { level: 'Low', color: 'bg-green-500', textColor: 'text-green-500' };
    return { level: 'New', color: 'bg-gray-500', textColor: 'text-gray-500' };
  };

  const influence = React.useMemo(() => 
    additionalData.mindmapContribution ? getInfluenceLevel(additionalData.mindmapContribution.kolInfluenceScore) : null,
    [additionalData.mindmapContribution]
  );

  // Get KOL details from enriched trade or store, then compute display name and avatar
  const kolDetails: KOLWallet | undefined = React.useMemo(() => {
    const fromTrade = (trade as any)?.kolDetails as KOLWallet | undefined;
    return fromTrade || (kolWallet ? getKOL(kolWallet) : undefined);
  }, [trade, kolWallet, getKOL]);

  const displayName = React.useMemo(() => {
    const nameFromStore = kolDetails?.name;
    const nameFromTrade = (trade as any)?.kolName as string | undefined;
    return nameFromStore || nameFromTrade || `KOL ${formatWalletAddress(kolWallet)}`;
  }, [kolDetails, trade, kolWallet]);
 
  const avatarUrl = React.useMemo(() => {
    const avatarFromTrade = (trade as any)?.kolAvatar as string | undefined;
    const storeAvatar = kolDetails?.avatar;
    if (avatarFromTrade && avatarFromTrade.trim().length > 0) return avatarFromTrade;
    if (storeAvatar && storeAvatar.trim().length > 0) return storeAvatar;
    const twitterHelperArg = kolDetails
      ? {
          ...(kolDetails.socialLinks?.twitter ? { socialLinks: { twitter: kolDetails.socialLinks.twitter } } : {}),
          ...(kolDetails.description ? { description: kolDetails.description } : {}),
        }
      : undefined;
    const twitterUrl = findTwitterUrlFromKOL(twitterHelperArg);
    const twitterAvatar = getTwitterAvatarUrl(twitterUrl, displayName || kolWallet);
    if (twitterAvatar) return twitterAvatar;
    // Final fallback to initials avatar
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName || kolWallet || 'KOL')}`;
  }, [trade, kolDetails, kolWallet, displayName]);

  const handleCopyKOL = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (kolWallet) {
      await navigator.clipboard.writeText(kolWallet);
      showSuccess('Copied', 'KOL wallet address copied to clipboard');
    } else {
      showError('Error', 'KOL wallet address not available');
    }
  };

  const handleCopyToken = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tradeData.mint) {
      await navigator.clipboard.writeText(tradeData.mint);
      showSuccess('Copied', 'Token address copied to clipboard');
    }
  };

  const handleViewOnExplorer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (kolWallet) {
      window.open(`https://solscan.io/account/${kolWallet}`, '_blank');
    } else {
      showError('Error', 'KOL wallet address not available');
    }
  };

  // Helper function to get prediction color based on probability
  const getPredictionColor = (probability: number) => {
    if (probability >= 0.8) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900';
    if (probability >= 0.6) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900';
    return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900';
  };

  // Helper function to get prediction icon
  const getPredictionIcon = (classLabel: string) => {
    switch (classLabel.toLowerCase()) {
      case 'bullish':
      case 'buy':
      case 'positive':
        return <TrendingUp className="w-3 h-3" />;
      case 'bearish':
      case 'sell':
      case 'negative':
        return <TrendingDown className="w-3 h-3" />;
      default:
        return <Target className="w-3 h-3" />;
    }
  };

  if (variant === 'list') {
    // Simplified list layout when hiding KOL info (used in modal realtime view)
    if (hideKOLInfo) {
      return (
        <div
          className={cn(
            'bg-background border border-border rounded-lg p-3 sm:p-3 hover:border-muted-foreground transition-all duration-200 cursor-pointer border-l-4',
            (tradeData.tradeType ?? 'sell') === 'buy' ? 'border-l-green-500' : 'border-l-red-500',
            className
          )}
          onClick={() => onClick?.(trade)}
        >
          <div className="flex items-center justify-between gap-3">
            {/* Left: Type + Token */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  'inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium text-white',
                  (tradeData.tradeType ?? 'sell') === 'buy' ? 'bg-green-500' : 'bg-red-500'
                )}
              >
                {(tradeData.tradeType ?? 'UNKNOWN').toUpperCase()}
              </div>
              {(tradeData.symbol || tradeData.name || tradeData.mint) && (
                <div className="flex items-center space-x-1 min-w-0">
                  <span className="text-xs font-medium truncate">
                    {(() => {
                      const name = tradeData.name?.trim();
                      const symbol = tradeData.symbol?.trim();
                      if (name && symbol) return `${name} (${symbol})`;
                      if (name) return name;
                      if (symbol) return symbol;
                      return tradeData.mint ? `${tradeData.mint.slice(0,6)}...${tradeData.mint.slice(-4)}` : 'Token';
                    })()}
                  </span>
                </div>
              )}
            </div>

            {/* Middle: Amounts */}
            <div className="flex-1 flex items-center justify-center gap-3 text-xs">
              <span className="font-semibold text-foreground whitespace-nowrap">
                {safeFormatAmount(tradeAmounts.solAmount)} SOL
              </span>
              <span className="text-muted-foreground whitespace-nowrap">
                {safeFormatAmount(tradeAmounts.tokensAmount)} tokens
              </span>
            </div>

            {/* Right: Time */}
            <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
              <Clock className="h-3 w-3 mr-1" />
              {tradeDate ? formatDistanceToNow(tradeDate, { addSuffix: true }).replace(' ago', '') : 'Now'}
            </div>
          </div>

          {/* AI Prediction (minimal) */}
          {shouldShowPrediction && prediction && (
            <div className="mt-2 flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Brain className="w-3 h-3 text-purple-500" />
                <span>AI Prediction</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
                    getPredictionColor(prediction.probability)
                  )}
                >
                  {getPredictionIcon(prediction.classLabel)}
                  <span>{prediction.classLabel}</span>
                </div>
                <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400">
                  {(prediction.probability * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div 
        className={cn(
          'bg-background border border-border rounded-lg p-3 sm:p-4 hover:border-muted-foreground transition-all duration-200 cursor-pointer border-l-4',
          (tradeData.tradeType ?? 'sell') === 'buy' ? 'border-l-green-500' : 'border-l-red-500',
          className
        )}
        onClick={() => onClick?.(trade)}
      >
        {/* Mobile Layout */}
        <div className="block sm:hidden">
          <div className="flex items-center justify-between mb-2">
            {/* Left: KOL Info */}
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-foreground font-bold text-xs">
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-foreground text-sm truncate">
                  {displayName}
                </h3>
                <div className="text-xs text-muted-foreground font-mono">
                  {kolWallet?.slice(0, 6)}...{kolWallet?.slice(-4)}
                </div>
              </div>
            </div>

            {/* Right: Trade Type */}
            <div className={cn(
              'flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium text-white flex-shrink-0',
              (tradeData.tradeType ?? 'sell') === 'buy' ? 'bg-green-500' : 'bg-red-500'
            )}>
              {(tradeData.tradeType ?? 'sell') === 'buy' ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{tradeData.tradeType?.toUpperCase() || 'UNKNOWN'}</span>
            </div>
          </div>

          {/* Token pill (mobile) */}
          {(tradeData.symbol || tradeData.name || tradeData.image || tradeData.mint) && (
            <div className="mb-2 flex items-center space-x-2">
              {tradeData.image && (
                <img src={tradeData.image} alt={tradeData.symbol || tradeData.name || 'Token'} className="w-4 h-4 rounded" />
              )}
              <span className="text-xs font-medium text-foreground">
                {(() => {
                  const name = tradeData.name?.trim();
                  const symbol = tradeData.symbol?.trim();
                  if (name && symbol) return `${name} (${symbol})`;
                  if (name) return name;
                  if (symbol) return symbol;
                  return tradeData.mint ? `${tradeData.mint.slice(0,6)}...${tradeData.mint.slice(-4)}` : 'Token';
                })()}
              </span>
            </div>
          )}

          {/* ML Prediction - Mobile (with skeleton for sell trades) */}
          {shouldShowPrediction ? (
            <div className="mb-2 p-2 bg-muted/20 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <Brain className="w-3 h-3 text-purple-500" />
                  <span className="text-xs font-medium text-muted-foreground">AI Prediction (Buy):</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={cn(
                    'flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium',
                    getPredictionColor(prediction.probability)
                  )}>
                    {getPredictionIcon(prediction.classLabel)}
                    <span>{prediction.classLabel}</span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {(prediction.probability * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // Skeleton placeholder for consistent layout
            <div className="mb-2 p-2 bg-muted/10 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-muted/40 rounded animate-pulse" />
                  <div className="w-20 h-3 bg-muted/40 rounded animate-pulse" />
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-16 h-5 bg-muted/40 rounded-full animate-pulse" />
                  <div className="w-8 h-3 bg-muted/40 rounded animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {/* Bottom: Amount and Time */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-3">
              <span className="font-semibold text-foreground">
                {safeFormatAmount(tradeAmounts.solAmount)} SOL
              </span>
              <span className="text-muted-foreground">
                {safeFormatAmount(tradeAmounts.tokensAmount)} tokens
              </span>
            </div>
            <div className="flex items-center text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              <span>
                {tradeDate ? formatDistanceToNow(tradeDate, { addSuffix: true }).replace(' ago', '') : 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-between">
          {/* Left: KOL Info */}
          <div className="flex items-center space-x-3 flex-1 min-w-0 max-w-[300px]">
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-primary-foreground font-bold text-xs">
                  {displayName.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-foreground text-sm truncate">
                  {displayName}
                </h3>
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <span className="font-mono">
                  {kolWallet?.slice(0, 8)}...{kolWallet?.slice(-4)}
                </span>
                <button
                  onClick={handleCopyKOL}
                  className="hover:text-foreground transition-colors"
                  title="Copy address"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={handleViewOnExplorer}
                  className="hover:text-foreground transition-colors"
                  title="View on Solscan"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Center: Trade Details - Fixed width for consistent alignment */}
          <div className="flex items-center space-x-4 text-sm flex-shrink-0 min-w-[400px] justify-center">
            <div className={cn(
              'flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-semibold text-white',
              (tradeData.tradeType ?? 'sell') === 'buy' ? 'bg-green-500' : 'bg-red-500'
            )}>
              {(tradeData.tradeType ?? 'sell') === 'buy' ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{tradeData.tradeType?.toUpperCase() || 'UNKNOWN'}</span>
            </div>

            {/* Token pill (desktop) */}
            {(tradeData.symbol || tradeData.name || tradeData.image || tradeData.mint) && (
              <div className="flex items-center space-x-2 min-w-[120px]">
                {tradeData.image && (
                  <img src={tradeData.image} alt={tradeData.symbol || tradeData.name || 'Token'} className="w-5 h-5 rounded" />
                )}
                <span className="text-xs font-medium">
                  {(() => {
                    const name = tradeData.name?.trim();
                    const symbol = tradeData.symbol?.trim();
                    if (name && symbol) return `${name} (${symbol})`;
                    if (name) return name;
                    if (symbol) return symbol;
                    return tradeData.mint ? `${tradeData.mint.slice(0,8)}...${tradeData.mint.slice(-4)}` : 'Token';
                  })()}
                </span>
              </div>
            )}

            <div className="text-center min-w-[80px]">
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="font-semibold text-foreground">
                {safeFormatAmount(tradeAmounts.solAmount)} SOL
              </p>
              <p className="text-xs text-muted-foreground">
                {safeFormatAmount(tradeAmounts.tokensAmount)} tokens
              </p>
            </div>

            {/* ML Prediction - Desktop */}
            {shouldShowPrediction ? (
              <div className="text-center min-w-[120px]">
                <p className="text-xs text-muted-foreground flex items-center justify-center space-x-1">
                  <Brain className="w-3 h-3 text-purple-500" />
                  <span>AI Prediction (Buy)</span>
                </p>
                <div className="flex items-center justify-center space-x-1">
                  <div className={cn(
                    'flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium',
                    getPredictionColor(prediction.probability)
                  )}>
                    {getPredictionIcon(prediction.classLabel)}
                    <span>{prediction.classLabel}</span>
                  </div>
                  <span className="text-xs font-medium text-purple-600">
                    {(prediction.probability * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ) : (
              // Skeleton placeholder for consistent desktop layout
              <div className="text-center min-w-[120px]">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <div className="w-3 h-3 bg-muted/40 rounded animate-pulse" />
                  <div className="w-16 h-3 bg-muted/40 rounded animate-pulse" />
                </div>
                <div className="flex items-center justify-center space-x-1">
                  <div className="w-12 h-5 bg-muted/40 rounded-full animate-pulse" />
                  <div className="w-6 h-3 bg-muted/40 rounded animate-pulse" />
                </div>
              </div>
            )}

            {tradeData.mint && tradeData.mint.length > 12 && (
              <div className="flex items-center space-x-1 min-w-[100px]">
                <span className="text-muted-foreground">Token:</span>
                <span className="font-mono text-xs">
                  {tradeData.mint.slice(0, 8)}...{tradeData.mint.slice(-4)}
                </span>
                <button
                  onClick={handleCopyToken}
                  className="hover:text-foreground transition-colors"
                  title="Copy token address"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Time & Stats - Fixed width */}
          <div className="text-right flex-shrink-0 min-w-[150px]">
            <div className="flex items-center justify-end text-xs text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              {tradeDate ? formatDistanceToNow(tradeDate, { addSuffix: true }) : 'Unknown time'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Card variant
  if (hideKOLInfo) {
    return (
      <div
        className={cn(
          'bg-background border border-border rounded-lg p-3 hover:border-muted-foreground transition-all duration-200 cursor-pointer group border-l-4',
          (tradeData.tradeType ?? 'sell') === 'buy' ? 'border-l-green-500' : 'border-l-red-500',
          className
        )}
        onClick={() => onClick?.(trade)}
      >
        {/* Top row: Type and Time */}
        <div className="flex items-center justify-between mb-2">
          <div className={cn(
            'inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium text-white',
            (tradeData.tradeType ?? 'sell') === 'buy' ? 'bg-green-500' : 'bg-red-500'
          )}>
            {(tradeData.tradeType ?? 'sell') === 'buy' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{tradeData.tradeType?.toUpperCase() || 'UNKNOWN'}</span>
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            {tradeDate ? formatDistanceToNow(tradeDate, { addSuffix: true }) : 'Now'}
          </div>
        </div>

        {/* Amounts */}
        <div className="text-center mb-2">
          <div className="font-semibold text-foreground">
            {safeFormatAmount(tradeAmounts.solAmount)} SOL
          </div>
          <div className="text-xs text-muted-foreground">
            {safeFormatAmount(tradeAmounts.tokensAmount)} tokens
          </div>
        </div>

        {/* Token info */}
        {(tradeData.symbol || tradeData.name || tradeData.mint) && (
          <div className="text-center text-xs">
            <span className="font-medium">
              {(() => {
                const name = tradeData.name?.trim();
                const symbol = tradeData.symbol?.trim();
                if (name && symbol) return `${name} (${symbol})`;
                if (name) return name;
                if (symbol) return symbol;
                return tradeData.mint ? `${tradeData.mint.slice(0,6)}...${tradeData.mint.slice(-4)}` : 'Token';
              })()}
            </span>
          </div>
        )}

        {/* AI Prediction minimal */}
        {shouldShowPrediction && prediction && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
              getPredictionColor(prediction.probability)
            )}>
              {getPredictionIcon(prediction.classLabel)}
              <span>{prediction.classLabel}</span>
            </div>
            <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400">
              {(prediction.probability * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'bg-background border border-border rounded-lg p-4 hover:border-muted-foreground transition-all duration-200 cursor-pointer group border-l-4',
        (tradeData.tradeType ?? 'sell') === 'buy' ? 'border-l-green-500' : 'border-l-red-500',
        className
      )}
      onClick={() => onClick?.(trade)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {/* Avatar */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-xs">
                {displayName.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-bold text-foreground text-sm truncate">
                {displayName}
              </h3>
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span className="font-mono truncate">
                {kolWallet?.slice(0, 8)}...{kolWallet?.slice(-4)}
              </span>
              <button
                onClick={handleCopyKOL}
                className="hover:text-foreground transition-colors flex-shrink-0"
                title="Copy address"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={handleViewOnExplorer}
                className="hover:text-foreground transition-colors flex-shrink-0"
                title="View on Solscan"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Trade Type & Time */}
        <div className="flex flex-col items-end space-y-1 flex-shrink-0">
          <div className={cn(
            'flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium text-white',
            (tradeData.tradeType ?? 'sell') === 'buy' ? 'bg-green-500' : 'bg-red-500'
          )}>
            {(tradeData.tradeType ?? 'sell') === 'buy' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{tradeData.tradeType?.toUpperCase() || 'UNKNOWN'}</span>
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            {tradeDate ? formatDistanceToNow(tradeDate, { addSuffix: true }) : 'Unknown time'}
          </div>
        </div>
      </div>

      {/* ML Prediction Section - Card View (with skeleton for sell trades) */}
      {shouldShowPrediction ? (
        <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Brain className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                AI Prediction (Buy Trade)
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className={cn(
                'flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium',
                getPredictionColor(prediction.probability)
              )}>
                {getPredictionIcon(prediction.classLabel)}
                <span>{prediction.classLabel}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                  {(prediction.probability * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">confidence</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Skeleton placeholder for consistent card layout
        <div className="mb-4 p-3 bg-muted/10 rounded-lg border border-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-muted/40 rounded animate-pulse" />
              <div className="w-32 h-4 bg-muted/40 rounded animate-pulse" />
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-20 h-6 bg-muted/40 rounded-full animate-pulse" />
              <div className="text-right">
                <div className="w-10 h-4 bg-muted/40 rounded animate-pulse mb-1" />
                <div className="w-16 h-3 bg-muted/40 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trade Details */}
      <div className="space-y-3">
        {/* Amounts */}
        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center">
                <DollarSign className="w-3 h-3 mr-1" />
                {tradeAmounts.description.sol}:
              </span>
              <span className="font-semibold text-foreground">
                {safeFormatAmount(tradeAmounts.solAmount)} SOL
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center">
                <ArrowRightLeft className="w-3 h-3 mr-1" />
                {tradeAmounts.description.tokens}:
              </span>
              <span className="font-semibold text-foreground">
                {safeFormatAmount(tradeAmounts.tokensAmount)}
              </span>
            </div>
            {feeInSol > 0 && (
              <div className="flex items-center justify-between sm:col-span-2">
                <span className="text-muted-foreground">Fee:</span>
                <span className="font-semibold text-orange-600">
                  {safeFormatAmount(feeInSol)} SOL
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Token & Source Info */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <span className="text-muted-foreground">Source:</span>
              <span className="font-medium text-foreground">
                {tradeData.source}
              </span>
            </div>
            {/* Token pill with fallback to mint */}
            {(tradeData.symbol || tradeData.name || tradeData.image || tradeData.mint) && (
              <div className="flex items-center space-x-2">
                {tradeData.image && (
                  <img src={tradeData.image} alt={tradeData.symbol || tradeData.name || 'Token'} className="w-4 h-4 rounded" />
                )}
                <span className="text-foreground font-medium">
                  {(() => {
                    const name = tradeData.name?.trim();
                    const symbol = tradeData.symbol?.trim();
                    if (name && symbol) return `${name} (${symbol})`;
                    if (name) return name;
                    if (symbol) return symbol;
                    return tradeData.mint ? `${tradeData.mint.slice(0, 8)}...${tradeData.mint.slice(-4)}` : 'Token';
                  })()}
                </span>
                {tradeData.mint && (
                  <button
                    onClick={handleCopyToken}
                    className="hover:text-foreground transition-colors"
                    title="Copy token address"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            #{id?.slice(-6) || 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}; 