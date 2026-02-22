'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { formatCurrency, formatWalletAddress, cn, safeFormatAmount, safeToFixed } from '@/lib/utils';
import { KOLTrade, SocketKOLTrade, KOLTradeUnion, KOLWallet } from '@/types';
import {
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Copy,
  Clock,
  Zap,
} from 'lucide-react';
import { useNotifications } from '@/stores/use-ui-store';
import { Button } from '@/components/ui/button';
import { useKOLStore, useSubscriptions } from '@/stores';
import { PredictButton } from '@/components/features/predict-button';

// Local helpers to derive Twitter avatar URL similar to other components
import { LazyAvatar } from '@/components/ui/lazy-avatar';

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
  // Let LazyAvatar handle the dicebear fallback locally
  return `https://unavatar.io/twitter/${encodeURIComponent(username)}`;
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

// helper function for twitter extraction

interface KOLTradeCardProps {
  trade: KOLTradeUnion;
  onClick?: (trade: KOLTradeUnion) => void;
  onTradeClick?: (trade: KOLTradeUnion, type: 'buy' | 'sell') => void;
  className?: string;
  variant?: 'card' | 'list';
  hideKOLInfo?: boolean;
  compact?: boolean;
}

export const KOLTradeCard: React.FC<KOLTradeCardProps> = ({
  trade,
  onClick,
  onTradeClick,
  className,
  variant = 'card',
  hideKOLInfo = false,
  compact = false
}) => {

  const { showSuccess, showError } = useNotifications();
  const { getKOL } = useKOLStore();
  const { subscriptions } = useSubscriptions();

  // Helper function to check if trade has nested tradeData structure
  const hasNestedTradeData = (trade: KOLTradeUnion): trade is SocketKOLTrade => {
    return 'tradeData' in trade;
  };

  // Extract trade data regardless of structure
  const getTradeData = (trade: KOLTradeUnion) => {
    if (!trade) {
      console.warn('⚠️ No trade data provided to getTradeData');
      return {
        tokenIn: 'Unknown',
        tokenOut: 'Unknown',
        amountIn: 0,
        amountOut: 0,
        tradeType: 'sell' as const,
        mint: '',
        source: 'Unknown',
        fee: 0,
        name: undefined,
        symbol: undefined,
        image: undefined,
        metadataUri: undefined,
        prediction: undefined,
      };
    }

    if (hasNestedTradeData(trade)) {
      const tradeData = trade.tradeData;
      if (!tradeData) {
        console.warn('⚠️ Trade has nested structure but no tradeData');
        return {
          tokenIn: 'Unknown',
          tokenOut: 'Unknown',
          amountIn: 0,
          amountOut: 0,
          tradeType: 'sell' as const,
          mint: '',
          source: 'Unknown',
          fee: 0,
          name: undefined,
          symbol: undefined,
          image: undefined,
          metadataUri: undefined,
          prediction: trade.prediction,
        };
      }

      return {
        tokenIn: tradeData.tokenIn || 'Unknown',
        tokenOut: tradeData.tokenOut || 'Unknown',
        amountIn: typeof tradeData.amountIn === 'number' ? tradeData.amountIn : 0,
        amountOut: typeof tradeData.amountOut === 'number' ? tradeData.amountOut : 0,
        tradeType: tradeData.tradeType ?? 'sell',
        mint: tradeData.mint || '',
        source: tradeData.dexProgram || 'Unknown',
        fee: typeof tradeData.fee === 'number' ? tradeData.fee : 0,
        name: tradeData.name,
        symbol: tradeData.symbol,
        image: tradeData.image,
        metadataUri: tradeData.metadataUri,
        prediction: trade.prediction || (tradeData as any)?.prediction,
      };
    } else {
      return {
        tokenIn: trade.tokenIn || 'Unknown',
        tokenOut: trade.tokenOut || 'Unknown',
        amountIn: typeof trade.amountIn === 'number' ? trade.amountIn : 0,
        amountOut: typeof trade.amountOut === 'number' ? trade.amountOut : 0,
        tradeType: trade.tradeType ?? 'sell',
        mint: (trade as any).mint || '',
        source: (trade as any).dexProgram || 'Unknown',
        fee: typeof (trade as any).fee === 'number' ? (trade as any).fee : 0,
        name: (trade as any).name,
        symbol: (trade as any).symbol,
        image: (trade as any).image,
        metadataUri: (trade as any).metadataUri,
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

    // Convert lamports to SOL if needed (amounts > 1000000 are likely in lamports)
    const convertIfLamports = (amount: number) => {
      if (typeof amount !== 'number' || isNaN(amount)) return 0;
      return amount > 1000000 ? amount / 1_000_000_000 : amount;
    };

    // Based on the WebSocket data structure:
    // Sell: tokenIn=SOL, tokenOut=token, amountIn=SOL_received, amountOut=tokens_sold
    // Buy: tokenIn=SOL, tokenOut=token, amountIn=SOL_spent, amountOut=tokens_bought

    if (isBuy) {
      // For buy trades: amountIn = SOL spent, amountOut = tokens bought
      return {
        tokensAmount: tradeData.amountOut || 0,
        solAmount: convertIfLamports(tradeData.amountIn || 0),
        description: {
          tokens: 'Tokens Bought',
          sol: 'SOL Spent'
        }
      };
    } else {
      // For sell trades: amountIn = SOL received, amountOut = tokens sold
      return {
        tokensAmount: tradeData.amountOut || 0,
        solAmount: convertIfLamports(tradeData.amountIn || 0),
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

  // Early return if no trade data
  if (!trade) {
    console.warn('⚠️ KOLTradeCard: No trade data provided');
    return null;
  }

  const tradeData = React.useMemo(() => getTradeData(trade), [trade]);
  const additionalData = React.useMemo(() => getAdditionalData(trade), [getAdditionalData, trade]);
  const { kolWallet, timestamp, id } = trade;

  // Get the correct amounts based on trade type
  const tradeAmounts = React.useMemo(() => {
    try {
      return getTradeAmounts(tradeData);
    } catch (error) {
      console.error('Error calculating trade amounts:', error, tradeData);
      return {
        tokensAmount: 0,
        solAmount: 0,
        description: {
          tokens: 'Tokens',
          sol: 'SOL'
        }
      };
    }
  }, [tradeData]);

  // Convert fee from lamports to SOL if it exists
  const feeInSol = React.useMemo(() => {
    return tradeData.fee ? lamportsToSol(tradeData.fee) : 0;
  }, [tradeData.fee]);




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



  const getInfluenceLevel = (score: number) => {
    if (score >= 80) return { level: 'High', color: 'bg-red-500', textColor: 'text-red-500' };
    if (score >= 60) return { level: 'Medium', color: 'bg-orange-500', textColor: 'text-orange-500' };
    if (score >= 40) return { level: 'Low', color: 'bg-green-500', textColor: 'text-green-500' };
    return { level: 'New', color: 'bg-gray-500', textColor: 'text-gray-500' };
  };

  const influence = React.useMemo(() => {
    const contribution = additionalData.mindmapContribution;
    if (contribution && typeof contribution === 'object') {
      const score = (contribution as any).kolInfluenceScore;
      if (typeof score === 'number') {
        return getInfluenceLevel(score);
      }
    }
    return null;
  }, [additionalData.mindmapContribution]);

  // Get KOL details from enriched trade or store, then compute display name and avatar
  const kolDetails: KOLWallet | undefined = React.useMemo(() => {
    const fromTrade = (trade as any)?.kolDetails as KOLWallet | undefined;
    return fromTrade || (kolWallet ? getKOL(kolWallet) : undefined);
  }, [trade, kolWallet, getKOL]);

  const displayName = React.useMemo(() => {
    // Check if we have a custom label from subscription
    const subscription = subscriptions.find(s => s.kolWallet === kolWallet);
    if (subscription?.label && subscription.label !== kolWallet) {
      return subscription.label;
    }

    const nameFromStore = kolDetails?.name;
    const nameFromTrade = (trade as any)?.kolName as string | undefined;
    return nameFromStore || nameFromTrade || `KOL ${formatWalletAddress(kolWallet)}`;
  }, [kolDetails, trade, kolWallet, subscriptions]);

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
                      if (name && symbol && symbol !== 'UNK' && symbol !== 'Unknown') return `${name} (${symbol})`;
                      if (name) return name;
                      if (symbol) return symbol;
                      return tradeData.mint ? `${tradeData.mint.slice(0, 6)}...${tradeData.mint.slice(-4)}` : 'Token';
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

          <div className="mt-2 flex justify-end">
            <PredictButton
              mint={tradeData.mint}
              className="h-6 w-6 rounded-full"
              label=""
            />
          </div>
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
                <LazyAvatar
                  src={avatarUrl}
                  fallbackSeed={displayName}
                  alt={displayName}
                  className="w-8 h-8 rounded-full flex-shrink-0"
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
                  if (name && symbol && symbol !== 'UNK' && symbol !== 'Unknown') return `${name} (${symbol})`;
                  if (name) return name;
                  if (symbol) return symbol;
                  return tradeData.mint ? `${tradeData.mint.slice(0, 6)}...${tradeData.mint.slice(-4)}` : 'Token';
                })()}
              </span>
            </div>
          )}

          <div className="mb-2 flex justify-end">
            <PredictButton
              mint={tradeData.mint}
              className="h-5 w-5 rounded-full"
              label=""
            />
          </div>
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
        </div >

        {/* Desktop Layout */}
        < div className="hidden sm:flex items-center justify-between" >
          {/* Left: KOL Info */}
          < div className="flex items-center space-x-3 flex-1 min-w-0 max-w-[300px]" >
            {/* Avatar */}
            {
              avatarUrl ? (
                <LazyAvatar
                  src={avatarUrl}
                  fallbackSeed={displayName}
                  alt={displayName}
                  className="w-10 h-10 rounded-full flex-shrink-0 border bg-background"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-foreground font-bold text-xs">
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )
            }

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
          </div >

          {/* Center: Trade Details - Fixed width for consistent alignment */}
          < div className="flex items-center space-x-4 text-sm flex-shrink-0 min-w-[400px] justify-center" >
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
            {
              (tradeData.symbol || tradeData.name || tradeData.image || tradeData.mint) && (
                <div className="flex items-center space-x-2 min-w-[120px]">
                  {tradeData.image && (
                    <img src={tradeData.image} alt={tradeData.symbol || tradeData.name || 'Token'} className="w-5 h-5 rounded" />
                  )}
                  <span className="text-xs font-medium">
                    {(() => {
                      const name = tradeData.name?.trim();
                      const symbol = tradeData.symbol?.trim();
                      if (name && symbol && symbol !== 'UNK' && symbol !== 'Unknown') return `${name} (${symbol})`;
                      if (name) return name;
                      if (symbol) return symbol;
                      return tradeData.mint ? `${tradeData.mint.slice(0, 8)}...${tradeData.mint.slice(-4)}` : 'Token';
                    })()}
                  </span>
                </div>
              )
            }

            <div className="text-center min-w-[80px]">
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="font-semibold text-foreground">
                {safeFormatAmount(tradeAmounts.solAmount)} SOL
              </p>
              <p className="text-xs text-muted-foreground">
                {safeFormatAmount(tradeAmounts.tokensAmount)} tokens
              </p>
            </div>

            <div className="flex items-center justify-center min-w-[60px]">
              <PredictButton
                mint={tradeData.mint}
                className="h-6 w-6 rounded-full"
                label=""
              />
            </div>

            {
              tradeData.mint && tradeData.mint.length > 12 && (
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
              )
            }
          </div >

          {/* Right: Time & Stats - Fixed width */}
          < div className="text-right flex-shrink-0 min-w-[150px]" >
            <div className="flex items-center justify-end text-xs text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              {tradeDate ? formatDistanceToNow(tradeDate, { addSuffix: true }) : 'Unknown time'}
            </div>
          </div >
        </div >
      </div >
    );
  }

  // Card variant (Compact/List)
  if (hideKOLInfo) {
    return (
      <div
        className={cn(
          'group relative overflow-hidden rounded-lg border transition-all duration-300 cursor-pointer',
          'bg-card/40 hover:bg-card/60 backdrop-blur-md',
          'border-l-4 p-3 shadow-sm hover:shadow-md',
          (tradeData.tradeType ?? 'sell') === 'buy'
            ? 'border-l-green-500 border-y-border border-r-border'
            : 'border-l-red-500 border-y-border border-r-border',
          className
        )}
        onClick={() => onClick?.(trade)}
      >
        {/* Top row: Type and Time */}
        <div className="flex items-center justify-between mb-2">
          <div className={cn(
            'inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-sm',
            (tradeData.tradeType ?? 'sell') === 'buy'
              ? 'bg-green-500/10 text-green-500 border-green-500/20'
              : 'bg-red-500/10 text-red-500 border-red-500/20'
          )}>
            {(tradeData.tradeType ?? 'sell') === 'buy' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{tradeData.tradeType?.toUpperCase() || 'UNKNOWN'}</span>
          </div>
          <div className="flex items-center text-[10px] text-muted-foreground font-medium">
            <Clock className="h-3 w-3 mr-1 opacity-70" />
            {tradeDate ? formatDistanceToNow(tradeDate, { addSuffix: true }) : 'Now'}
          </div>
        </div>

        {/* Amounts */}
        <div className="text-center mb-1">
          <div className="font-bold text-lg text-foreground tracking-tight leading-none">
            {safeFormatAmount(tradeAmounts.solAmount)} <span className="text-xs text-muted-foreground font-semibold">SOL</span>
          </div>
          <div className="text-[10px] font-medium text-muted-foreground mt-0.5">
            {safeFormatAmount(tradeAmounts.tokensAmount, 0)} tokens
          </div>
        </div>

        {/* Token info */}
        {(tradeData.symbol || tradeData.name || tradeData.mint) && (
          <div className="flex items-center justify-center mt-2 pt-2 border-t border-border/40">
            <div className="flex items-center space-x-1.5 bg-muted/20 px-2 py-1 rounded-full border border-white/5">
              {tradeData.image && !tradeData.image.includes('dicebear') ? (
                <LazyAvatar
                  src={tradeData.image}
                  fallbackSeed={tradeData.symbol || 'Token'}
                  alt="Token"
                  className="w-4 h-4 rounded-full shadow-sm bg-background border"
                />
              ) : null}

              <div
                className={cn(
                  "w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center text-[8px] font-bold text-indigo-400 border border-indigo-500/30",
                  (tradeData.image && !tradeData.image.includes('dicebear')) ? "hidden" : "flex"
                )}
              >
                {tradeData.symbol?.slice(0, 1).toUpperCase() || '?'}
              </div>

              <span className="text-[10px] font-bold text-foreground">
                {(() => {
                  const name = tradeData.name?.trim();
                  const symbol = tradeData.symbol?.trim();
                  if (name) return name;
                  if (symbol) return symbol;
                  return tradeData.mint ? `${tradeData.mint.slice(0, 4)}...` : 'Token';
                })()}
              </span>
            </div>
          </div>
        )}

        <div className="mt-2 flex justify-center">
          <PredictButton
            mint={tradeData.mint}
            className="h-5 w-5 rounded-full"
            label=""
          />
        </div>

        {/* Quick Trade Buttons (Compact) */}
        {onTradeClick && (
          <div className="mt-2 grid grid-cols-2 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              size="sm"
              className="h-6 text-[9px] font-bold bg-green-500/10 hover:bg-green-500/20 text-green-600 border border-green-500/20 shadow-none px-0"
              onClick={(e) => {
                e.stopPropagation();
                onTradeClick(trade, 'buy');
              }}
            >
              Buy
            </Button>
            <Button
              size="sm"
              className="h-6 text-[9px] font-bold bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 shadow-none px-0"
              onClick={(e) => {
                e.stopPropagation();
                onTradeClick(trade, 'sell');
              }}
            >
              Sell
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer',
        'bg-card/40 hover:bg-card/60 backdrop-blur-md',
        'shadow-sm hover:shadow-lg hover:shadow-primary/5',
        (tradeData.tradeType ?? 'sell') === 'buy'
          ? 'border-green-500/20 hover:border-green-500/40'
          : 'border-red-500/20 hover:border-red-500/40',
        className
      )}
      onClick={() => onClick?.(trade)}
    >
      {/* Background Gradient Splash */}
      <div className={cn(
        "absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[60px] opacity-10 pointer-events-none transition-opacity group-hover:opacity-20",
        (tradeData.tradeType ?? 'sell') === 'buy' ? "bg-green-500" : "bg-red-500"
      )} />

      {/* Content wrapper */}
      <div className="relative z-10 p-4">

        {/* Header: KOL Info & Time */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Avatar with Ring */}
            <div className="relative">
              {avatarUrl ? (
                <LazyAvatar
                  src={avatarUrl}
                  fallbackSeed={displayName}
                  alt={displayName}
                  className={cn(
                    "w-10 h-10 rounded-full border-2 shadow-sm bg-background",
                    (tradeData.tradeType ?? 'sell') === 'buy' ? "border-green-500/20" : "border-red-500/20"
                  )}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center border border-border/50">
                  <span className="text-xs font-bold text-muted-foreground">
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              {/* Quick Link Overlay */}
              <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                <button
                  onClick={handleViewOnExplorer}
                  className="p-1 bg-background rounded-full border border-border shadow-sm hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-foreground truncate max-w-[120px]">
                  {displayName}
                </h3>
                {influence && (
                  <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", influence.color)} title={`Influence: ${influence.level}`} />
                )}
              </div>
              <div className="flex items-center space-x-1.5 text-xs text-muted-foreground">
                <span className="font-mono bg-muted/30 px-1 rounded">
                  {kolWallet?.slice(0, 4)}...{kolWallet?.slice(-4)}
                </span>
                <button
                  onClick={handleCopyKOL}
                  className="hover:text-foreground transition-colors"
                >
                  <Copy className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end space-y-1.5">
            <div className={cn(
              'flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-sm backdrop-blur-sm',
              (tradeData.tradeType ?? 'sell') === 'buy'
                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                : 'bg-red-500/10 text-red-500 border-red-500/20'
            )}>
              {(tradeData.tradeType ?? 'sell') === 'buy' ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{tradeData.tradeType?.toUpperCase() || 'UNKNOWN'}</span>
            </div>
            <div className="text-[10px] items-center flex text-muted-foreground font-medium">
              <Clock className="w-3 h-3 mr-1 opacity-70" />
              {tradeDate ? formatDistanceToNow(tradeDate, { addSuffix: true }) : 'Just now'}
            </div>
          </div>
        </div>

        {/* Amount & Token Info Main Block */}
        <div className="bg-muted/10 rounded-xl p-3 border border-white/5 backdrop-blur-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-2xl font-black text-foreground tracking-tight flex items-baseline leading-none">
              {safeFormatAmount(tradeAmounts.solAmount)}
              <span className="text-xs font-bold text-muted-foreground ml-1.5">SOL</span>
            </div>
            <div className="text-xs font-semibold text-muted-foreground/80">
              ≈ {safeFormatAmount(tradeAmounts.tokensAmount, 0)} Tokens
            </div>
          </div>

          {/* Token Pill */}
          {(tradeData.symbol || tradeData.name || tradeData.mint) && (
            <div className="flex items-center justify-between pt-2 border-t border-dashed border-border/40">
              <div className="flex items-center space-x-2">
                {tradeData.image && !tradeData.image.includes('dicebear') ? (
                  <LazyAvatar
                    src={tradeData.image}
                    fallbackSeed={tradeData.symbol || 'Token'}
                    alt="Token"
                    className="w-5 h-5 rounded-full shadow-sm bg-background border"
                  />
                ) : null}
                {/* Fallback Icon */}
                <div
                  className={cn(
                    "w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[9px] font-bold text-indigo-400 border border-indigo-500/30",
                    (tradeData.image && !tradeData.image.includes('dicebear')) ? "hidden" : "flex"
                  )}
                >
                  {tradeData.symbol?.slice(0, 1).toUpperCase() || '?'}
                </div>

                <div className="flex flex-col leading-none">
                  <span className="text-xs font-bold text-foreground">
                    {tradeData.name || tradeData.symbol || 'Unknown'}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono mt-0.5">
                    {tradeData.mint ? `${tradeData.mint.slice(0, 4)}...${tradeData.mint.slice(-4)}` : ''}
                  </span>
                </div>
              </div>

              {tradeData.mint && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(tradeData.mint);
                    showSuccess('Copied', 'Mint address copied');
                  }}
                  className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors"
                >
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mb-4 flex justify-end">
          <PredictButton
            mint={tradeData.mint}
            size="sm"
            className="h-7 text-[10px] px-3"
          />
        </div>

        {/* Actions Footer */}
        {onTradeClick && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button
              size="sm"
              className="h-8 text-xs font-bold bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-500 border border-green-500/20 shadow-none"
              onClick={(e) => {
                e.stopPropagation();
                onTradeClick(trade, 'buy');
              }}
            >
              <Zap className="w-3 h-3 mr-1.5" />
              Quick Buy
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 hover:text-red-500 border border-red-500/20 shadow-none"
              onClick={(e) => {
                e.stopPropagation();
                onTradeClick(trade, 'sell');
              }}
            >
              Quick Sell
            </Button>
          </div>
        )}

      </div>
    </div>
  );
};