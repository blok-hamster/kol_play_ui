'use client';

import React, { useState } from 'react';
import { UserSubscription } from '@/types';
import { useSubscriptions } from '@/stores/use-trading-store';
import { useNotifications } from '@/stores/use-ui-store';
import KOLTradesModal from './kol-trades-modal';
import {
  Play,
  Pause,
  Settings,
  ExternalLink,
  Copy,
  Eye,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, copyToClipboard } from '@/lib/utils';

interface SubscriptionCardProps {
  subscription: UserSubscription;
}

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
}) => {
  const { updateSubscription, removeSubscription } = useSubscriptions();
  const { showSuccess, showError, showWarning } = useNotifications();

  const [showDropdown, setShowDropdown] = useState(false);
  const [isTradesModalOpen, setIsTradesModalOpen] = useState(false);

  // Early return if subscription or kolWallet is missing
  if (!subscription || !subscription.kolWallet) {
    return (
      <div className="bg-background border border-red-500 rounded-lg p-6">
        <div className="text-red-600 text-center">
          <p>Invalid subscription data</p>
        </div>
      </div>
    );
  }

  // Generate a display name for the subscription
  const displayName = `KOL ${subscription.kolWallet.slice(0, 6)}...${subscription.kolWallet.slice(-4)}`;

  const handleToggleActive = async () => {
    try {
      updateSubscription(subscription.kolWallet, {
        isActive: !subscription.isActive,
      });

      showSuccess(
        'Updated!',
        `Subscription ${subscription.isActive ? 'paused' : 'activated'} successfully`
      );
    } catch (error) {
      showError('Error', 'Failed to update subscription');
    }
  };

  const handleUnsubscribe = async () => {
    try {
      removeSubscription(subscription.kolWallet);
      showSuccess('Unsubscribed', 'Subscription removed successfully');
    } catch (error) {
      showError('Error', 'Failed to remove subscription');
    }
  };

  const handleCopyAddress = () => {
    copyToClipboard(subscription.kolWallet);
    showSuccess('Copied!', 'Wallet address copied to clipboard');
  };

  const handleViewOnExplorer = () => {
    window.open(
      `https://solscan.io/account/${subscription.kolWallet}`,
      '_blank'
    );
  };

  const getStatusColor = () => {
    if (!subscription.isActive) return 'text-yellow-600 dark:text-yellow-400';
    if (subscription.type === 'trade')
      return 'text-green-600 dark:text-green-400';
    return 'text-blue-600 dark:text-blue-400';
  };

  const getStatusBg = () => {
    if (!subscription.isActive) return 'bg-yellow-500/10';
    if (subscription.type === 'trade') return 'bg-green-500/10';
    return 'bg-blue-500/10';
  };

  const getStatusIcon = () => {
    if (!subscription.isActive) return Pause;
    if (subscription.type === 'trade') return TrendingUp;
    return Eye;
  };

  const StatusIcon = getStatusIcon();

  return (
    <>
      <div className="bg-background border border-border rounded-lg p-4 sm:p-6 hover:border-muted-foreground transition-all duration-200 group">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-xs sm:text-sm">
                {displayName.slice(0, 2).toUpperCase()}
              </span>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-foreground text-sm sm:text-base truncate">
                {displayName}
              </h3>
              <div className="flex items-center space-x-2 text-xs sm:text-sm text-muted-foreground">
                <span className="font-mono truncate">
                  <span className="sm:hidden">
                    {subscription.kolWallet.slice(0, 4)}...
                    {subscription.kolWallet.slice(-4)}
                  </span>
                  <span className="hidden sm:inline">
                    {subscription.kolWallet.slice(0, 8)}...
                    {subscription.kolWallet.slice(-8)}
                  </span>
                </span>
                <button
                  onClick={handleCopyAddress}
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

          {/* Status & Dropdown */}
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {/* Status Badge */}
            <div
              className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBg()} ${getStatusColor()}`}
            >
              <StatusIcon className="w-3 h-3" />
              <span className="hidden sm:inline">
                {!subscription.isActive
                  ? 'Paused'
                  : subscription.type === 'trade'
                    ? 'Trading'
                    : 'Watching'}
              </span>
            </div>

            {/* Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-1.5 sm:p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
              </button>

              {showDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-lg shadow-lg z-20">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          handleToggleActive();
                          setShowDropdown(false);
                        }}
                        className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        {subscription.isActive ? (
                          <>
                            <Pause className="w-4 h-4" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            <span>Resume</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setIsTradesModalOpen(true);
                          setShowDropdown(false);
                        }}
                        className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View Trades</span>
                      </button>

                      <div className="border-t border-border my-1" />

                      <button
                        onClick={() => {
                          handleUnsubscribe();
                          setShowDropdown(false);
                        }}
                        className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Unsubscribe</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Subscription Details */}
        <div className="space-y-3">
          {/* Type & Settings */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium text-foreground capitalize">
                  {subscription.type === 'trade'
                    ? 'Copy Trading'
                    : 'Watch Only'}
                </span>
              </div>
            </div>

            {subscription.createdAt && (
              <div className="flex items-center space-x-1 text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span className="text-xs">
                  {new Date(subscription.createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Trading Settings */}
          {subscription.type === 'trade' && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                {subscription.copyPercentage &&
                  subscription.copyPercentage > 0 && (
                    <div>
                      <span className="text-muted-foreground">Copy %:</span>
                      <span className="ml-1 font-medium text-foreground">
                        {subscription.copyPercentage}%
                      </span>
                    </div>
                  )}

                {subscription.minAmount && subscription.minAmount > 0 && (
                  <div>
                    <span className="text-muted-foreground">Min:</span>
                    <span className="ml-1 font-medium text-foreground">
                      {subscription.minAmount} SOL
                    </span>
                  </div>
                )}

                {subscription.maxAmount && subscription.maxAmount > 0 && (
                  <div>
                    <span className="text-muted-foreground">Max:</span>
                    <span className="ml-1 font-medium text-foreground">
                      {subscription.maxAmount} SOL
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Watch-only Settings */}
          {subscription.type === 'watch' &&
            subscription.minAmount &&
            subscription.minAmount > 0 && (
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Minimum Amount:</span>
                  <span className="ml-1 font-medium text-foreground">
                    {subscription.minAmount} SOL
                  </span>
                </div>
              </div>
            )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-border mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTradesModalOpen(true)}
            className="flex items-center justify-center space-x-2 w-full sm:w-auto"
          >
            <Eye className="w-4 h-4" />
            <span>View Trades</span>
          </Button>

          <Button
            variant={subscription.isActive ? 'secondary' : 'default'}
            size="sm"
            onClick={handleToggleActive}
            className="flex items-center space-x-2"
          >
            {subscription.isActive ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Resume</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Trades Modal */}
      <KOLTradesModal
        kol={null}
        walletAddress={subscription.kolWallet}
        isOpen={isTradesModalOpen}
        onClose={() => setIsTradesModalOpen(false)}
      />
    </>
  );
};

export default SubscriptionCard;
