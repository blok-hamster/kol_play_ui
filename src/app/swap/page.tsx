'use client';

import React, { useEffect } from 'react';
import {
  ArrowRightLeft,
  RefreshCw,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { useSwapStore } from '@/stores/use-swap-store';
import { useUserStore } from '@/stores/use-user-store';
import { formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TokenSelector,
  SwapSettings,
  WatchConfigForm,
  TradeConfirmationDialog,
} from '@/components/swap';

const SwapPage: React.FC = () => {
  const { walletBalance } = useUserStore();
  const {
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    currentQuote,
    isLoadingQuote,
    quoteError,
    slippage,
    priority,
    setFromToken,
    setToToken,
    setFromAmount,
    swapTokens,
    clearQuote,
    toggleConfirmDialog,
    lastSwapResult,
    clearSwapResult,
  } = useSwapStore();

  // Clear any previous swap results when component mounts
  useEffect(() => {
    return () => {
      clearSwapResult();
    };
  }, [clearSwapResult]);

  const handleMaxClick = () => {
    if (walletBalance) {
      // Reserve some SOL for fees
      const maxAmount = Math.max(0, walletBalance - 0.01);
      setFromAmount(maxAmount.toString());
    }
  };

  const handleSwapTokens = () => {
    swapTokens();
  };

  const canSwap =
    fromToken &&
    toToken &&
    fromAmount &&
    parseFloat(fromAmount) > 0 &&
    currentQuote;

  const getSwapButtonText = () => {
    if (!toToken) return 'Select Token to Swap';
    if (!fromAmount || parseFloat(fromAmount) <= 0) return 'Enter Amount';
    if (isLoadingQuote) return 'Getting Quote...';
    if (quoteError) return 'Quote Error - Retry';
    if (!currentQuote) return 'Get Quote';
    return 'Review Swap';
  };

  return (
    <AppLayout>
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <ArrowRightLeft className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Swap</h1>
          </div>
          <p className="text-muted-foreground">
            Trade SOL for Solana tokens instantly with auto-trading features
          </p>
        </div>

        {/* Success Message */}
        {lastSwapResult && (
          <div className="max-w-md mx-auto mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                  <TrendingUp className="h-3 w-3 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
                    Swap Successful!
                  </h3>
                  <p className="text-xs text-green-700 dark:text-green-300 mb-2">
                    Transaction ID: {lastSwapResult.transactionId.slice(0, 20)}
                    ...
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSwapResult}
                    className="text-xs p-0 h-auto text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Swap Interface */}
        <div className="max-w-md mx-auto">
          <div className="bg-background border border-border rounded-xl p-6 space-y-4 shadow-lg">
            {/* Settings Header */}
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-foreground">Swap</h2>
              <div className="flex items-center space-x-2">
                <SwapSettings />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearQuote}
                  className="p-2 hover:bg-muted rounded-lg"
                  disabled={isLoadingQuote}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoadingQuote ? 'animate-spin' : ''}`}
                  />
                </Button>
              </div>
            </div>

            {/* From Token */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground font-medium">
                From
              </label>
              <div className="bg-muted/30 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={fromAmount}
                    onChange={e => setFromAmount(e.target.value)}
                    className="border-0 bg-transparent text-2xl font-bold p-0 h-auto text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                    min="0"
                    step="0.0001"
                  />
                  <div className="flex items-center space-x-2">
                    {fromToken && (
                      <>
                        {fromToken.image ? (
                          <img
                            src={fromToken.image}
                            alt={fromToken.symbol}
                            className="w-8 h-8 rounded-full border border-border"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center border border-border">
                            <span className="text-primary-foreground font-bold text-sm">
                              ◎
                            </span>
                          </div>
                        )}
                        <span className="text-base font-bold text-foreground">
                          {fromToken.symbol}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Balance: {formatNumber(walletBalance || 0, 4)} SOL
                  </span>
                  <button
                    onClick={handleMaxClick}
                    className="text-primary hover:underline font-medium"
                    disabled={!walletBalance}
                  >
                    Max
                  </button>
                </div>
              </div>
            </div>

            {/* Swap Direction Button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full p-3 bg-background border border-border hover:bg-muted"
                onClick={handleSwapTokens}
                disabled={!toToken}
              >
                <ArrowRightLeft className="h-5 w-5" />
              </Button>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground font-medium">
                To
              </label>
              <div className="bg-muted/30 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <Input
                    type="text"
                    placeholder="0.0"
                    value={toAmount}
                    readOnly
                    className="border-0 bg-transparent text-2xl font-bold p-0 h-auto text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                  />
                  <div className="min-w-[200px] ml-4">
                    <TokenSelector
                      selectedToken={toToken}
                      onTokenSelect={setToToken}
                      placeholder="Select Token"
                      className="h-auto"
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {toToken ? (
                    <span>Selected: {toToken.name}</span>
                  ) : (
                    <span>Select a token to swap to</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quote Information */}
            {currentQuote && fromToken && toToken && (
              <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground font-medium">
                    Exchange Rate
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-foreground">
                      1 {fromToken.symbol} ={' '}
                      {formatNumber(
                        currentQuote.outputAmount / currentQuote.inputAmount,
                        4
                      )}{' '}
                      {toToken.symbol}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fromAmount && setFromAmount(fromAmount)}
                      disabled={isLoadingQuote}
                      className="p-1 h-auto"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${isLoadingQuote ? 'animate-spin' : ''}`}
                      />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Minimum Received
                  </span>
                  <span className="text-foreground font-medium">
                    {formatNumber(currentQuote.minimumReceived, 4)}{' '}
                    {toToken.symbol}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price Impact</span>
                  <div className="flex items-center space-x-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        currentQuote.priceImpact > 5
                          ? 'bg-red-500'
                          : currentQuote.priceImpact > 1
                            ? 'bg-orange-500'
                            : 'bg-green-500'
                      }`}
                    ></span>
                    <span
                      className={`font-medium ${
                        currentQuote.priceImpact > 5
                          ? 'text-red-500'
                          : currentQuote.priceImpact > 1
                            ? 'text-orange-500'
                            : 'text-green-500'
                      }`}
                    >
                      {formatNumber(currentQuote.priceImpact, 2)}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Route</span>
                  <span className="text-foreground font-medium">
                    {currentQuote.route.dex}
                  </span>
                </div>
              </div>
            )}

            {/* Quote Error */}
            {quoteError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="text-sm text-red-700 dark:text-red-300">
                    {quoteError}
                  </div>
                </div>
              </div>
            )}

            {/* Auto-Trading Configuration */}
            <WatchConfigForm />

            {/* Swap Button */}
            <Button
              variant="gradient"
              className="w-full h-12 text-lg font-semibold rounded-xl text-white"
              onClick={toggleConfirmDialog}
              disabled={!canSwap || isLoadingQuote}
            >
              {getSwapButtonText()}
            </Button>

            {/* Transaction Details */}
            <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Slippage Tolerance</span>
                <span className="text-foreground font-medium">{slippage}%</span>
              </div>
              <div className="flex justify-between">
                <span>Network Fee</span>
                <span className="text-foreground font-medium">
                  ~0.00025 SOL
                </span>
              </div>
              <div className="flex justify-between">
                <span>Platform Fee</span>
                <span className="text-foreground font-medium">0.25%</span>
              </div>
              <div className="flex justify-between">
                <span>Priority</span>
                <span className="text-foreground font-medium capitalize">
                  {priority}
                </span>
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Advanced swap interface with auto-trading is now live!
              </span>
            </div>
          </div>
        </div>

        {/* Trade Confirmation Dialog */}
        <TradeConfirmationDialog />
      </div>
    </AppLayout>
  );
};

export default SwapPage;
