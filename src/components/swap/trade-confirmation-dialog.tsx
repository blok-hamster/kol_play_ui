'use client';

import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Shield,
  Target,
  Zap,
} from 'lucide-react';
import { useSwapStore } from '@/stores/use-swap-store';
import { formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

const TradeConfirmationDialog: React.FC = () => {
  const {
    showConfirmDialog,
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    currentQuote,
    slippage,
    priority,
    useWatchConfig,
    watchConfig,
    isSwapping,
    swapError,
    performSwap,
    toggleConfirmDialog,
  } = useSwapStore();

  if (!fromToken || !toToken || !currentQuote) {
    return null;
  }

  const minimumReceived = currentQuote.minimumReceived;
  const priceImpact = currentQuote.priceImpact;
  const fees = currentQuote.fees;

  const handleConfirmSwap = async () => {
    await performSwap();
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'Low (Slow)';
      case 'medium':
        return 'Medium (Normal)';
      case 'high':
        return 'High (Fast)';
      default:
        return 'Medium';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'low':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'medium':
        return <Zap className="h-4 w-4 text-blue-500" />;
      case 'high':
        return <Zap className="h-4 w-4 text-green-500" />;
      default:
        return <Zap className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Modal
      isOpen={showConfirmDialog}
      onClose={toggleConfirmDialog}
      title="Confirm Trade"
      className="max-w-md"
    >
      <div className="space-y-6">
        {/* Trade Summary */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              Trade Summary
            </h3>
            <div className="text-xs text-muted-foreground">
              {new Date().toLocaleTimeString()}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* From Token */}
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                {fromToken.image ? (
                  <img
                    src={fromToken.image}
                    alt={fromToken.symbol}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs">◎</span>
                  </div>
                )}
                <span className="font-medium">{fromToken.symbol}</span>
              </div>
              <div className="text-xl font-bold text-foreground">
                {formatNumber(parseFloat(fromAmount), 4)}
              </div>
            </div>

            {/* Arrow */}
            <ArrowRight className="h-6 w-6 text-muted-foreground" />

            {/* To Token */}
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                {toToken.image ? (
                  <img
                    src={toToken.image}
                    alt={toToken.symbol}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs">
                      {toToken.symbol?.[0]}
                    </span>
                  </div>
                )}
                <span className="font-medium">{toToken.symbol}</span>
              </div>
              <div className="text-xl font-bold text-foreground">
                {formatNumber(parseFloat(toAmount), 4)}
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">
            Transaction Details
          </h4>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Exchange Rate</span>
              <span className="text-foreground">
                1 {fromToken.symbol} ={' '}
                {formatNumber(parseFloat(toAmount) / parseFloat(fromAmount), 4)}{' '}
                {toToken.symbol}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Minimum Received</span>
              <span className="text-foreground">
                {formatNumber(minimumReceived, 4)} {toToken.symbol}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Price Impact</span>
              <span
                className={`${priceImpact > 5 ? 'text-red-500' : priceImpact > 1 ? 'text-orange-500' : 'text-green-500'}`}
              >
                {formatNumber(priceImpact, 2)}%
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Slippage Tolerance</span>
              <span className="text-foreground">{slippage}%</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Priority</span>
              <div className="flex items-center space-x-1">
                {getPriorityIcon(priority)}
                <span className="text-foreground">
                  {getPriorityLabel(priority)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Fees Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Fees</h4>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network Fee</span>
              <span className="text-foreground">
                ~{formatNumber(fees.networkFee, 6)} SOL
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform Fee</span>
              <span className="text-foreground">
                {formatNumber(fees.platformFee * 100, 2)}%
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Swap Fee</span>
              <span className="text-foreground">
                {formatNumber(fees.swapFee * 100, 2)}%
              </span>
            </div>

            <div className="border-t pt-2 flex justify-between font-medium">
              <span className="text-foreground">Total Fees</span>
              <span className="text-foreground">
                ~{formatNumber(fees.total, 6)} SOL
              </span>
            </div>
          </div>
        </div>

        {/* Auto-Trading Settings */}
        {useWatchConfig && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Auto-Trading Enabled
              </h4>
            </div>

            <div className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
              <div className="flex items-center space-x-2">
                <Shield className="h-3 w-3" />
                <span>Take Profit: {watchConfig.takeProfitPercentage}%</span>
              </div>
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-3 w-3" />
                <span>Stop Loss: {watchConfig.stopLossPercentage}%</span>
              </div>
              {watchConfig.enableTrailingStop && (
                <div className="flex items-center space-x-2">
                  <Target className="h-3 w-3" />
                  <span>Trailing Stop: {watchConfig.trailingPercentage}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Warnings */}
        {(priceImpact > 5 || slippage > 2) && (
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5" />
              <div className="text-xs text-orange-700 dark:text-orange-300">
                {priceImpact > 5 && (
                  <div>
                    ⚠️ High price impact ({formatNumber(priceImpact, 2)}%) -
                    consider reducing trade size
                  </div>
                )}
                {slippage > 2 && (
                  <div>
                    ⚠️ High slippage tolerance ({slippage}%) - trade may execute
                    at unfavorable price
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {swapError && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300">
                {swapError}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={toggleConfirmDialog}
            className="flex-1"
            disabled={isSwapping}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSwap}
            className="flex-1"
            disabled={isSwapping}
          >
            {isSwapping ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Swapping...</span>
              </div>
            ) : (
              'Confirm Swap'
            )}
          </Button>
        </div>

        {/* Quote Expiration */}
        <div className="text-center text-xs text-muted-foreground">
          Quote expires in{' '}
          {Math.max(
            0,
            Math.floor((currentQuote.validUntil - Date.now()) / 1000)
          )}{' '}
          seconds
        </div>
      </div>
    </Modal>
  );
};

export default TradeConfirmationDialog;
