'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  X,
  ExternalLink,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Copy,
} from 'lucide-react';
import {
  formatCurrency,
  formatPercentage,
  formatRelativeTime,
  safeFormatAmount,
  cn,
} from '@/lib/utils';
import { SolanaService } from '@/services/solana.service';
import type { TradeHistoryEntry } from '@/types';

interface TradeDetailsModalProps {
  trade: TradeHistoryEntry & {
    tokenSymbol?: string;
    tokenName?: string;
    tokenImage?: string;
    verified?: boolean;
    currentPrice?: number;
    currentValue?: number;
    unrealizedPnL?: number;
    unrealizedPnLPercentage?: number;
    holdTime?: string;
  };
  onClose: () => void;
}

const TradeDetailsModal: React.FC<TradeDetailsModalProps> = ({
  trade,
  onClose,
}) => {
  const [solPrice, setSolPrice] = useState<number>(0);

  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const price = await SolanaService.getSolPrice();
        setSolPrice(price);
      } catch (error) {
        console.error('Failed to fetch SOL price:', error);
        setSolPrice(0);
      }
    };
    fetchSolPrice();
  }, []);

  const isOpen = trade.status === 'open';
  const pnl = isOpen ? trade.unrealizedPnL : trade.realizedPnL;
  const pnlPercentage = isOpen
    ? trade.unrealizedPnLPercentage
    : trade.realizedPnLPercentage;

  // Convert SOL values to USD
  // const pnlUsd = (pnl || 0) * solPrice; // Kept if needed for PnL box?
  const pnlUsd = (pnl || 0) * solPrice;
  // Others unused after refactor

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getSellReasonLabel = (reason?: string) => {
    const labels: Record<string, string> = {
      take_profit: 'Take Profit',
      stop_loss: 'Stop Loss',
      trailing_stop: 'Trailing Stop',
      manual: 'Manual',
      max_hold_time: 'Max Hold Time',
    };
    return labels[reason || ''] || 'Closed';
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-4 sm:p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Token Icon */}
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
              {trade.tokenImage ? (
                <img
                  src={trade.tokenImage}
                  alt={trade.tokenSymbol}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-primary-foreground font-bold">
                  {trade.tokenSymbol?.charAt(0) || '?'}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-foreground">
                  {trade.tokenSymbol || 'Unknown'}
                </h2>
                {trade.verified && (
                  <div
                    className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
                    title="Verified Token"
                  >
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    isOpen
                      ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400'
                  )}
                >
                  {isOpen ? 'Open' : 'Closed'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {trade.tokenName || 'Unknown Token'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* P&L Summary */}
          <div
            className={cn(
              'rounded-xl p-4 sm:p-6',
              (pnl || 0) >= 0
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {isOpen ? 'Unrealized P&L' : 'Realized P&L'}
                </p>
                <p
                  className={cn(
                    'text-3xl font-bold',
                    (pnl || 0) >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {(pnl || 0) >= 0 ? '+' : ''}
                  {formatCurrency(pnlUsd)}
                </p>
                <p
                  className={cn(
                    'text-lg',
                    (pnl || 0) >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {(pnlPercentage || 0) >= 0 ? '+' : ''}
                  {formatPercentage(pnlPercentage || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(pnl || 0) >= 0 ? '+' : ''}
                  {safeFormatAmount(pnl || 0, 6)} SOL
                </p>
              </div>
              {(pnl || 0) >= 0 ? (
                <TrendingUp className="h-12 w-12 text-green-500" />
              ) : (
                <TrendingDown className="h-12 w-12 text-red-500" />
              )}
            </div>
          </div>

          {/* Trade Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Price Progression */}
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Price</p>
              <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2 text-sm font-mono text-foreground">
                  <span>${(trade.entryPrice || 0).toFixed(8)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className={cn(
                    (isOpen ? trade.currentPrice || 0 : trade.exitPrice || 0) >= trade.entryPrice
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}>
                    ${(isOpen ? trade.currentPrice || 0 : trade.exitPrice || 0).toFixed(8)}
                  </span>
                </div>
              </div>
            </div>

            {/* Value Progression */}
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Value (SOL)</p>
              <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2 text-sm font-mono text-foreground">
                  <span>{safeFormatAmount(trade.entryValue || 0, 4)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className={cn(
                    (isOpen ? (trade.currentValue || (trade.entryAmount * (trade.currentPrice || 0))) : trade.exitValue) >= (trade.entryValue || 0)
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}>
                    {safeFormatAmount(isOpen ? (trade.currentValue || (trade.entryAmount * (trade.currentPrice || 0))) : trade.exitValue, 4)}
                  </span>
                </div>
              </div>
            </div>

            {/* Entry Amount */}
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Amount</p>
              <p className="text-lg font-bold text-foreground">
                {safeFormatAmount(trade.entryAmount, 2)}
              </p>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Total PnL (SOL)</p>
              <div className={cn("text-lg font-bold", (pnl || 0) >= 0 ? "text-green-500" : "text-red-500")}>
                {(pnl || 0) > 0 ? '+' : ''}{safeFormatAmount(pnl || 0, 4)} SOL
              </div>
            </div>

            {/* Hold Time */}
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Hold Time</p>
              <p className="text-lg font-bold text-foreground flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                {trade.holdTime || 'N/A'}
              </p>
            </div>

            {/* Opened At */}
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Opened</p>
              <p className="text-sm font-medium text-foreground">
                {formatRelativeTime(new Date(trade.openedAt))}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(trade.openedAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Sell Conditions */}
          {trade.sellConditions && (
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center">
                <Target className="w-4 h-4 mr-2" />
                Sell Conditions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {trade.sellConditions.takeProfitPercentage && (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded flex items-center justify-center">
                      <Target className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Take Profit
                      </p>
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                        +{trade.sellConditions.takeProfitPercentage}%
                      </p>
                    </div>
                  </div>
                )}
                {trade.sellConditions.stopLossPercentage && (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded flex items-center justify-center">
                      <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Stop Loss</p>
                      <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                        -{trade.sellConditions.stopLossPercentage}%
                      </p>
                    </div>
                  </div>
                )}
                {trade.sellConditions.trailingStopPercentage && (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Trailing Stop
                      </p>
                      <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {trade.sellConditions.trailingStopPercentage}%
                      </p>
                    </div>
                  </div>
                )}
                {trade.sellConditions.maxHoldTimeMinutes && (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded flex items-center justify-center">
                      <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Max Hold</p>
                      <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                        {Math.floor(trade.sellConditions.maxHoldTimeMinutes / 60)}h
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Closed Trade Info */}
          {!isOpen && (
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Close Details
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Closed At
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {trade.closedAt
                      ? formatRelativeTime(new Date(trade.closedAt))
                      : 'N/A'}
                  </span>
                </div>
                {trade.sellReason && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Sell Reason
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {getSellReasonLabel(trade.sellReason)}
                    </span>
                  </div>
                )}
                {trade.exitAmount && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Exit Amount
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {safeFormatAmount(trade.exitAmount, 2)}
                    </span>
                  </div>
                )}
                {trade.exitValue && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Exit Value
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-medium text-foreground block">
                        {formatCurrency((trade.exitValue || 0) * solPrice)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {safeFormatAmount(trade.exitValue, 6)} SOL
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Price Range (for open trades) */}
          {isOpen && (trade.highestPrice || trade.lowestPrice) && (
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Price Range
              </h3>
              <div className="space-y-2">
                {trade.highestPrice && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Highest
                    </span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(trade.highestPrice)}
                    </span>
                  </div>
                )}
                {trade.lowestPrice && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Lowest</span>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      {formatCurrency(trade.lowestPrice)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transaction Links */}
          {(trade.buyTransactionId || trade.sellTransactionId) && (
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Transactions
              </h3>
              <div className="space-y-2">
                {trade.buyTransactionId && trade.buyTransactionId !== 'txid' && (
                  <a
                    href={`https://solscan.io/tx/${trade.buyTransactionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                  >
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      Buy Transaction
                    </span>
                    <ExternalLink className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </a>
                )}
                {trade.sellTransactionId && trade.sellTransactionId !== 'txid' && (
                  <a
                    href={`https://solscan.io/tx/${trade.sellTransactionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      Sell Transaction
                    </span>
                    <ExternalLink className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Token Mint Address */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              Token Mint Address
            </h3>
            <div className="flex items-center justify-between">
              <code className="text-xs font-mono text-muted-foreground break-all">
                {trade.tokenMint}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(trade.tokenMint)}
                className="flex-shrink-0 ml-2"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tags */}
          {trade.tags && trade.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {trade.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t border-border p-4 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

export default TradeDetailsModal;
