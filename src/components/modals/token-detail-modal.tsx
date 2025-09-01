'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { formatNumber, formatRelativeTime, copyToClipboard } from '@/lib/utils';
import { ExternalLink, Clock, Loader2, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { useNotifications } from '@/stores';
import { executeInstantBuy, executeBuyWithAmount, checkTradeConfig, getBuyAmountLimits } from '@/lib/trade-utils';
import TradeConfigPrompt from '@/components/ui/trade-config-prompt';
import BuyAmountPrompt from '@/components/ui/buy-amount-prompt';

export interface TokenDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Token data
  mint: string;
  name?: string;
  symbol?: string;
  priceUsd?: number;
  marketCapUsd?: number;
  liquidityUsd?: number;
  volume24h?: number;
  createdOn?: number | string;
  // Chart props
  pairAddress?: string;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  chartHeight?: number;
}

const TokenDetailModal: React.FC<TokenDetailModalProps> = ({
  isOpen,
  onClose,
  mint,
  name,
  symbol,
  priceUsd,
  marketCapUsd,
  liquidityUsd,
  volume24h,
  createdOn,
  pairAddress,
  title,
  size = 'xl',
  chartHeight = 400,
}) => {
  const { showSuccess, showError } = useNotifications();
  
  // Chart state
  const [dexPair, setDexPair] = React.useState<string | null>(pairAddress || null);
  const [themeMode, setThemeMode] = React.useState<'dark' | 'light'>('dark');
  
  // Trade state
  const [showTradeConfigPrompt, setShowTradeConfigPrompt] = useState(false);
  const [showBuyAmountPrompt, setShowBuyAmountPrompt] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [buyAmountLimits, setBuyAmountLimits] = useState<{
    hasConfig: boolean;
    minAmount: number;
    maxAmount: number;
    defaultAmount?: number;
  }>({
    hasConfig: false,
    minAmount: 0.01,
    maxAmount: 100,
  });

  // Determine theme for embedded widget
  React.useEffect(() => {
    try {
      const isDark = document.documentElement.classList.contains('dark');
      setThemeMode(isDark ? 'dark' : 'light');
    } catch {}
  }, [isOpen]);

  // Resolve DexScreener pair address if only mint is provided
  React.useEffect(() => {
    let cancelled = false;

    const resolvePair = async () => {
      if (pairAddress) {
        setDexPair(pairAddress);
        return;
      }
      if (!mint) return;

      try {
        const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`);
        if (!res.ok) return;
        const pairs: any[] = await res.json();
        if (Array.isArray(pairs) && pairs.length > 0) {
          const best = pairs
            .filter(p => p?.pairAddress)
            .sort((a, b) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0];
          if (!cancelled && best?.pairAddress) setDexPair(best.pairAddress);
        }
      } catch {}
    };

    resolvePair();
    return () => {
      cancelled = true;
    };
  }, [mint, pairAddress]);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(mint);
      setCopyStatus('copied');
      showSuccess('Copied!', 'Token address copied to clipboard');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      setCopyStatus('error');
      showError('Copy Failed', 'Failed to copy token address');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  // Load buy amount limits when modal opens
  React.useEffect(() => {
    if (isOpen) {
      getBuyAmountLimits().then(setBuyAmountLimits);
    }
  }, [isOpen]);

  const handleQuickBuy = async () => {
    if (isBuying) return;

    try {
      // Get current buy amount limits
      const limits = await getBuyAmountLimits();
      setBuyAmountLimits(limits);

      if (!limits.hasConfig) {
        // No trade config - show buy amount prompt to let user specify amount or go to settings
        setShowBuyAmountPrompt(true);
        return;
      }

      // Has config - use instant buy with default amount
      setIsBuying(true);
      const result = await executeInstantBuy(mint, symbol);

      if (result.success) {
        showSuccess(
          'Buy Order Executed',
          `Successfully bought ${symbol || 'token'} for ${limits.defaultAmount || 'N/A'} SOL`
        );

        if (result.result?.transactionId) {
          console.log('Transaction ID:', result.result.transactionId);
        }
      } else {
        showError(
          'Buy Order Failed',
          result.error || 'Failed to execute buy order'
        );
      }
    } catch (error: any) {
      console.error('Buy order error:', error);
      showError(
        'Buy Order Error',
        error.message || 'An unexpected error occurred'
      );
    } finally {
      setIsBuying(false);
    }
  };

  const handleBuyWithAmount = async (amount: number) => {
    if (isBuying) return;

    try {
      setIsBuying(true);

      // Execute buy with custom amount
      const result = await executeBuyWithAmount(mint, amount, symbol);

      if (result.success) {
        showSuccess(
          'Buy Order Executed',
          `Successfully bought ${symbol || 'token'} for ${amount} SOL`
        );

        if (result.result?.transactionId) {
          console.log('Transaction ID:', result.result.transactionId);
        }
      } else {
        showError(
          'Buy Order Failed',
          result.error || 'Failed to execute buy order'
        );
      }
    } catch (error: any) {
      console.error('Buy order error:', error);
      showError(
        'Buy Order Error',
        error.message || 'An unexpected error occurred'
      );
    } finally {
      setIsBuying(false);
    }
  };

  const handleTradeConfigPromptClose = () => {
    setShowTradeConfigPrompt(false);
  };

  const handleBuyAmountPromptClose = () => {
    setShowBuyAmountPrompt(false);
  };

  // Detect mobile screen
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const responsiveChartHeight = isMobile ? 300 : chartHeight;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title || `${name || symbol || 'Token'} Details`}
        size={isMobile ? 'lg' : size}
        className="overflow-hidden"
      >
        <div className="space-y-4 sm:space-y-6">
          {/* Token Header */}
          <div className="space-y-3 sm:space-y-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                {name || 'Unknown Token'}
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground">
                {symbol || 'N/A'}
              </p>
            </div>

            {/* Token Metrics - Mobile Optimized Grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
              <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
                <h3 className="text-xs font-medium text-muted-foreground mb-1">
                  Price
                </h3>
                <p className="text-sm sm:text-lg font-bold text-foreground truncate">
                  ${priceUsd ? priceUsd.toFixed(8) : '0.00000000'}
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
                <h3 className="text-xs font-medium text-muted-foreground mb-1">
                  Market Cap
                </h3>
                <p className="text-sm sm:text-lg font-bold text-foreground truncate">
                  ${formatNumber(marketCapUsd || 0)}
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
                <h3 className="text-xs font-medium text-muted-foreground mb-1">
                  Liquidity
                </h3>
                <p className="text-sm sm:text-lg font-bold text-foreground truncate">
                  ${formatNumber(liquidityUsd || 0)}
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
                <h3 className="text-xs font-medium text-muted-foreground mb-1">
                  24h Volume
                </h3>
                <p className="text-sm sm:text-lg font-bold text-foreground truncate">
                  ${formatNumber(volume24h || 0)}
                </p>
              </div>
            </div>

            {/* Action Buttons - Mobile Optimized */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                onClick={handleQuickBuy}
                disabled={isBuying}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                {isBuying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Buying...</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm">⚡</span>
                    <span>Buy Token</span>
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleCopyAddress}
                className="w-full sm:w-auto"
              >
                {copyStatus === 'copied' ? (
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                ) : copyStatus === 'error' ? (
                  <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                <span className="hidden sm:inline">
                  {copyStatus === 'copied' ? 'Copied!' : 'Copy Address'}
                </span>
                <span className="sm:hidden">
                  {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
                </span>
              </Button>
            </div>

            {/* Creation Info - Mobile Optimized */}
            {createdOn && (
              <div className="flex items-center space-x-2 text-xs sm:text-sm text-muted-foreground">
                {typeof createdOn === 'number' ? (
                  <>
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">Created {formatRelativeTime(createdOn)}</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">
                      Created on{' '}
                      <a
                        href={createdOn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {new URL(createdOn).hostname.replace('www.', '')}
                      </a>
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Live Chart - Mobile Optimized */}
          <div className="w-full overflow-hidden rounded-lg border border-border">
            <div className="bg-muted/30 px-3 sm:px-4 py-2 border-b border-border">
              <h3 className="text-sm font-medium text-foreground">Live Chart</h3>
            </div>
            <div className="w-full overflow-hidden" style={{ minHeight: responsiveChartHeight }}>
              {dexPair ? (
                <iframe
                  title="DexScreener Chart"
                  src={`https://dexscreener.com/solana/${dexPair}?embed=1&theme=${themeMode}&chart=1&layout=chart&trades=0&info=0`}
                  className="w-full border-0 block"
                  style={{ height: responsiveChartHeight }}
                  allow="clipboard-write; encrypted-media"
                />
              ) : (
                <div 
                  className="flex items-center justify-center text-muted-foreground text-sm" 
                  style={{ height: responsiveChartHeight }}
                >
                  Loading chart...
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Trade Config Prompt */}
      <TradeConfigPrompt
        isOpen={showTradeConfigPrompt}
        onClose={handleTradeConfigPromptClose}
        tokenSymbol={symbol || name}
      />

      {/* Buy Amount Prompt */}
      <BuyAmountPrompt
        isOpen={showBuyAmountPrompt}
        onClose={handleBuyAmountPromptClose}
        onConfirm={handleBuyWithAmount}
        tokenSymbol={symbol}
        tokenName={name}
        hasTradeConfig={buyAmountLimits.hasConfig}
        defaultAmount={buyAmountLimits.defaultAmount}
        minAmount={buyAmountLimits.minAmount}
        maxAmount={buyAmountLimits.maxAmount}
      />
    </>
  );
};

export default TokenDetailModal;