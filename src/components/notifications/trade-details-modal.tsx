'use client';

import React from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Hash,
  ExternalLink,
  Copy,
  ArrowRight,
  Wallet,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency, formatNumber, formatRelativeTime, copyToClipboard } from '@/lib/utils';
import { NotificationItem } from '@/types';

interface TradeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: NotificationItem | null;
}

const TradeDetailsModal: React.FC<TradeDetailsModalProps> = ({
  isOpen,
  onClose,
  notification,
}) => {
  if (!notification?.data?.trade) {
    return null;
  }

  const { trade, subscription } = notification.data;

  // Helper functions
  const formatTokenAddress = (address: string) => {
    if (!address || address.length < 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleCopyAddress = async (address: string, label: string) => {
    try {
      await copyToClipboard(address);
      // You could add a toast notification here
    } catch (error) {
      console.error(`Failed to copy ${label}:`, error);
    }
  };

  const getTradeTypeColor = (tradeType: string) => {
    return tradeType === 'buy' 
      ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
      : 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
  };

  const getTradeTypeIcon = (tradeType: string) => {
    return tradeType === 'buy' 
      ? <TrendingUp className="w-4 h-4" />
      : <TrendingDown className="w-4 h-4" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  const formatSOLAmount = (amount: number) => {
    return `${formatNumber(amount, 4)} SOL`;
  };

  const formatTokenAmount = (amount: number) => {
    return formatNumber(amount, 2);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Trade Details"
      size="lg"
      className="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Header with Trade Type and Priority */}
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center space-x-3">
            <div className={cn(
              'p-2 rounded-full',
              getTradeTypeColor(trade.tradeType)
            )}>
              {getTradeTypeIcon(trade.tradeType)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {trade.tradeType.toUpperCase()} Trade
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatRelativeTime(new Date(trade.timestamp))}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={cn(
              'w-3 h-3 rounded-full',
              getPriorityColor(notification.priority)
            )} />
            <Badge variant="secondary" className="capitalize">
              {notification.priority} Priority
            </Badge>
          </div>
        </div>

        {/* Trade Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Amount</span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-foreground">
                  {trade.tradeType === 'buy' 
                    ? formatTokenAmount(trade.amountOut)
                    : formatSOLAmount(trade.amountIn)
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {trade.tradeType === 'buy' 
                    ? `for ${formatSOLAmount(trade.amountIn)}`
                    : `worth ${formatSOLAmount(trade.amountIn)}`
                  }
                </p>
              </div>
            </div>

            <div className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">DEX</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {trade.dexProgram || 'Unknown'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Fee</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {formatNumber(trade.fee / 1000000, 6)} SOL
              </p>
            </div>

            <div className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Block Time</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {new Date(trade.blockTime * 1000).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Token Information */}
        <div className="bg-background border border-border rounded-lg p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center">
            <ArrowRight className="w-4 h-4 mr-2" />
            Token Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Token In</label>
              <div className="flex items-center space-x-2 mt-1">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {formatTokenAddress(trade.tokenIn)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyAddress(trade.tokenIn, 'Token In')}
                  className="p-1"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Token Out</label>
              <div className="flex items-center space-x-2 mt-1">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {formatTokenAddress(trade.tokenOut)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyAddress(trade.tokenOut, 'Token Out')}
                  className="p-1"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* KOL Information */}
        <div className="bg-background border border-border rounded-lg p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center">
            <Wallet className="w-4 h-4 mr-2" />
            KOL Information
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">KOL Wallet</label>
              <div className="flex items-center space-x-2 mt-1">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {formatTokenAddress(trade.kolWallet)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyAddress(trade.kolWallet, 'KOL Wallet')}
                  className="p-1"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`https://solscan.io/account/${trade.kolWallet}`, '_blank')}
                  className="p-1"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            {subscription && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <label className="text-xs text-muted-foreground">Subscription Type</label>
                  <p className="text-sm font-medium text-foreground capitalize mt-1">
                    {subscription.type}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <div className="flex items-center space-x-2 mt-1">
                    {subscription.isActive ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium">
                      {subscription.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transaction Details */}
        <div className="bg-background border border-border rounded-lg p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center">
            <Hash className="w-4 h-4 mr-2" />
            Transaction Details
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Signature</label>
              <div className="flex items-center space-x-2 mt-1">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {formatTokenAddress(trade.signature)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyAddress(trade.signature, 'Transaction Signature')}
                  className="p-1"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`https://solscan.io/tx/${trade.signature}`, '_blank')}
                  className="p-1"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Slot Number</label>
              <p className="text-sm font-mono bg-muted px-2 py-1 rounded mt-1">
                {trade.slotNumber.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Notification Info */}
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            Notification Details
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Received</label>
              <p className="text-sm font-medium text-foreground mt-1">
                {formatRelativeTime(new Date(notification.timestamp || notification.createdAt || Date.now()))}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Telegram Status</label>
              <div className="flex items-center space-x-2 mt-1">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  (notification.sentToTelegram || notification.telegramSent) ? 'bg-green-500' : 'bg-gray-400'
                )} />
                <span className="text-sm">
                  {(notification.sentToTelegram || notification.telegramSent) ? 'Sent' : 'Not sent'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TradeDetailsModal; 