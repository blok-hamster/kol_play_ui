'use client';

import React from 'react';
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
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/stores/use-ui-store';
import {
  copyToClipboard,
  formatCurrency,
  formatNumber,
  formatRelativeTime,
} from '@/lib/utils';
import { executeInstantBuy, checkTradeConfig } from '@/lib/trade-utils';

// Updated interfaces to match the real data structure
interface TokenData {
  name: string;
  symbol: string;
  mint: string;
  uri?: string;
  decimals: number;
  hasFileMetaData?: boolean;
  createdOn: string;
  description?: string;
  image?: string;
  showName?: boolean;
  twitter?: string;
  creation?: {
    creator: string;
    created_tx: string;
    created_time: number;
  };
}

interface PoolData {
  liquidity: {
    quote: number;
    usd: number;
  };
  price: {
    quote: number;
    usd: number;
  };
  tokenSupply: number;
  lpBurn: number;
  tokenAddress: string;
  marketCap: {
    quote: number;
    usd: number;
  };
  decimals: number;
  security: {
    freezeAuthority: string | null;
    mintAuthority: string | null;
  };
  quoteToken: string;
  market: string;
  lastUpdated: number;
  createdAt: number;
  txns: {
    buys: number;
    sells: number;
    total: number;
    volume: number;
    volume24h: number;
  };
  deployer: string;
  poolId: string;
}

interface PriceEvents {
  [key: string]: {
    priceChangePercentage: number;
  };
}

interface RiskData {
  snipers: {
    count: number;
    totalBalance: number;
    totalPercentage: number;
    wallets: any[];
  };
  insiders: {
    count: number;
    totalBalance: number;
    totalPercentage: number;
    wallets: any[];
  };
  rugged: boolean;
  risks: any[];
  score: number;
  jupiterVerified: boolean;
}

interface TokenDetailData {
  token: TokenData;
  pools: PoolData[];
  events: PriceEvents;
  risk: RiskData;
  buysCount: number;
  sellsCount: number;
}

interface TokenDetailModalProps {
  tokenData: TokenDetailData;
  isOpen: boolean;
  onClose: () => void;
}

const TokenDetailModal: React.FC<TokenDetailModalProps> = ({
  tokenData,
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const { showNotification } = useNotifications();

  if (!isOpen) return null;

  const { token, pools, events, risk } = tokenData;
  const primaryPool = pools[0]; // Use the first pool as primary

  const handleCopyAddress = async () => {
    const success = await copyToClipboard(token.mint);
    if (success) {
      showNotification('Copied!', 'Token address copied to clipboard');
    } else {
      showNotification('Copy Failed', 'Failed to copy token address', 'error');
    }
  };

  const handleQuickBuy = async () => {
    try {
      // First check if user has trade config
      const configCheck = await checkTradeConfig();
      
      if (!configCheck.hasConfig) {
        // Close modal and redirect to settings
        onClose();
        router.push('/settings?tab=trading');
        return;
      }

      // Execute instant buy
      const result = await executeInstantBuy(token.mint, token.symbol);

      if (result.success) {
        showNotification(
          'Buy Order Executed',
          `Successfully bought ${token.symbol || 'token'} for ${configCheck.config?.tradeConfig?.minSpend || 'N/A'} SOL`
        );
        onClose();

        // Optional: Show transaction details
        if (result.result?.transactionId) {
          console.log('Transaction ID:', result.result.transactionId);
        }
      } else {
        showNotification(
          'Buy Order Failed',
          result.error || 'Failed to execute buy order',
          'error'
        );
      }
    } catch (error: any) {
      console.error('Buy order error:', error);
      showNotification(
        'Buy Order Error',
        error.message || 'An unexpected error occurred',
        'error'
      );
    }
  };

  const handleViewOnExplorer = () => {
    window.open(`https://solscan.io/token/${token.mint}`, '_blank');
  };

  const handleViewOnDexScreener = () => {
    window.open(`https://dexscreener.com/solana/${token.mint}`, '_blank');
  };

  const handleTwitter = () => {
    if (token.twitter) {
      window.open(token.twitter, '_blank');
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-2 sm:inset-4 md:inset-8 lg:inset-16 xl:inset-24 bg-background border border-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)]">
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-border bg-muted/30">
          <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
            {/* Token Logo */}
            {token.image ? (
              <img
                src={token.image}
                alt={token.symbol}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-muted flex-shrink-0"
                onError={e => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center border-2 border-muted flex-shrink-0">
                <span className="text-primary-foreground font-bold text-lg sm:text-xl">
                  {token.symbol.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-start space-x-2 sm:space-x-3">
                <h2 className="text-lg sm:text-2xl font-bold text-foreground truncate">
                  {token.name}
                </h2>
                {risk.jupiterVerified && (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                <p className="text-sm sm:text-lg text-muted-foreground font-medium">
                  {token.symbol}
                </p>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  Created on {token.createdOn}
                </span>
                {token.twitter && (
                  <button
                    onClick={handleTwitter}
                    className="text-blue-500 hover:text-blue-600 transition-colors self-start"
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
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Price and Market Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Current Price */}
            <div className="col-span-2 lg:col-span-1 bg-muted/30 border border-border rounded-xl p-4">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-foreground mb-1">
                  {formatCurrency(primaryPool?.price?.usd || 0)}
                </div>
                <div className="flex items-center justify-center space-x-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      events['24h']?.priceChangePercentage >= 0
                        ? 'bg-green-500'
                        : 'bg-red-500'
                    }`}
                  ></span>
                  <span
                    className={`text-sm font-medium ${getPriceChangeColor(events['24h']?.priceChangePercentage || 0)}`}
                  >
                    {events['24h']?.priceChangePercentage >= 0 ? '+' : ''}
                    {formatNumber(events['24h']?.priceChangePercentage || 0, 2)}
                    %
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  24h Change
                </div>
              </div>
            </div>

            {/* Market Cap */}
            <div className="bg-muted/30 border border-border rounded-xl p-4">
              <div className="text-center">
                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 mx-auto mb-2" />
                <div className="text-sm sm:text-lg font-bold text-foreground">
                  {formatCurrency(primaryPool?.marketCap?.usd || 0)}
                </div>
                <div className="text-xs text-muted-foreground">Market Cap</div>
              </div>
            </div>

            {/* 24h Volume */}
            <div className="bg-muted/30 border border-border rounded-xl p-4">
              <div className="text-center">
                <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500 mx-auto mb-2" />
                <div className="text-sm sm:text-lg font-bold text-foreground">
                  {formatCurrency(
                    (primaryPool?.txns?.volume24h || 0) *
                      (primaryPool?.price?.usd || 0)
                  )}
                </div>
                <div className="text-xs text-muted-foreground">24h Volume</div>
              </div>
            </div>

            {/* Liquidity */}
            <div className="bg-muted/30 border border-border rounded-xl p-4">
              <div className="text-center">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500 mx-auto mb-2" />
                <div className="text-sm sm:text-lg font-bold text-foreground">
                  {formatCurrency(primaryPool?.liquidity?.usd || 0)}
                </div>
                <div className="text-xs text-muted-foreground">Liquidity</div>
              </div>
            </div>
          </div>

          {/* Price Performance Over Time */}
          <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Price Performance
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {Object.entries(events).map(([timeframe, data]) => (
                <div key={timeframe} className="text-center">
                  <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">
                    {timeframe.toUpperCase()}
                  </div>
                  <div
                    className={`text-sm sm:text-lg font-bold ${getPriceChangeColor(data.priceChangePercentage)}`}
                  >
                    {data.priceChangePercentage >= 0 ? '+' : ''}
                    {formatNumber(data.priceChangePercentage, 2)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trading Activity */}
          <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4">
              Trading Activity
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatNumber(primaryPool?.txns?.buys || 0)}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Total Buys
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatNumber(primaryPool?.txns?.sells || 0)}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Total Sells
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-foreground">
                  {formatNumber(primaryPool?.txns?.total || 0)}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Total Trades
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {primaryPool?.lpBurn || 0}%
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  LP Burned
                </div>
              </div>
            </div>
          </div>

          {/* Security & Risk Analysis */}
          <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4 flex items-center">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Security & Risk Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Risk Score */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">
                    Risk Score
                  </span>
                  <div
                    className={`text-xl sm:text-2xl font-bold ${getRiskColor(risk.score)}`}
                  >
                    {risk.score}/10
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span>Jupiter Verified</span>
                    {risk.jupiterVerified ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <X className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span>Rugged</span>
                    {risk.rugged ? (
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
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between">
                    <span>Freeze Authority</span>
                    <span
                      className={
                        primaryPool?.security?.freezeAuthority
                          ? 'text-red-500'
                          : 'text-green-500'
                      }
                    >
                      {primaryPool?.security?.freezeAuthority
                        ? 'Present'
                        : 'Revoked'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Mint Authority</span>
                    <span
                      className={
                        primaryPool?.security?.mintAuthority
                          ? 'text-red-500'
                          : 'text-green-500'
                      }
                    >
                      {primaryPool?.security?.mintAuthority
                        ? 'Present'
                        : 'Revoked'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Snipers & Insiders */}
            {(risk.snipers.count > 0 || risk.insiders.count > 0) && (
              <div className="mt-6 pt-4 border-t border-border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600" />
                      <span className="font-medium text-orange-800 dark:text-orange-200">
                        Snipers Detected
                      </span>
                    </div>
                    <div className="text-sm text-orange-700 dark:text-orange-300">
                      {risk.snipers.count} wallets holding{' '}
                      {formatNumber(risk.snipers.totalPercentage, 2)}%
                    </div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span className="font-medium text-red-800 dark:text-red-200">
                        Insiders Detected
                      </span>
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300">
                      {risk.insiders.count} wallets holding{' '}
                      {formatNumber(risk.insiders.totalPercentage, 2)}%
                    </div>
                  </div>
                </div>
              </div>
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
                    className="p-2 hover:bg-muted rounded-lg flex-shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Created
                </label>
                <div className="text-foreground mt-1 text-sm">
                  {token.creation
                    ? formatTimeAgo(token.creation.created_time)
                    : 'Unknown'}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Total Supply
                </label>
                <div className="text-foreground mt-1 text-sm">
                  {formatNumber(primaryPool?.tokenSupply || 0, 0)}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Decimals
                </label>
                <div className="text-foreground mt-1 text-sm">
                  {token.decimals}
                </div>
              </div>

              {token.creation && (
                <>
                  <div>
                    <label className="text-sm font-medium text-muted-foregrund">
                      Creator
                    </label>
                    <div className="text-foreground mt-1 font-mono text-xs sm:text-sm">
                      {token.creation.creator.slice(0, 8)}...
                      {token.creation.creator.slice(-8)}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Pool ID
                    </label>
                    <div className="text-foreground mt-1 font-mono text-xs sm:text-sm">
                      {primaryPool?.poolId
                        ? `${primaryPool.poolId.slice(0, 8)}...${primaryPool.poolId.slice(-8)}`
                        : 'N/A'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          {token.description && (
            <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4">
                Description
              </h3>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                {token.description}
              </p>
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
                className="border-border hover:bg-muted rounded-xl flex-1 sm:flex-none"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Solscan</span>
                <span className="sm:hidden">Scan</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewOnDexScreener}
                className="border-border hover:bg-muted rounded-xl flex-1 sm:flex-none"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">DexScreener</span>
                <span className="sm:hidden">Dex</span>
              </Button>
              {token.uri && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(token.uri, '_blank')}
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
              className="bg-green-500 hover:bg-green-600 text-white rounded-xl w-full sm:w-auto"
            >
              <Zap className="h-4 w-4 mr-2" />
              Buy Token
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TokenDetailModal;
