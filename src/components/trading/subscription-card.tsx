'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { UserSubscription } from '@/types';
import { useSubscriptions } from '@/stores/use-trading-store';
import { useNotifications } from '@/stores/use-ui-store';
import KOLTradesModal from './kol-trades-modal';
import SubscriptionSettingsModal from './subscription-settings-modal';
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
import { useKOLStore } from '@/stores';

// Local helpers to derive Twitter avatar URL and extract username
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

interface SubscriptionCardProps {
  subscription: UserSubscription;
  viewMode?: 'grid' | 'list';
}

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  viewMode = 'grid',
}) => {
  const { updateSubscription, removeSubscription, updateSubscriptionSettings } = useSubscriptions();
  const { showSuccess, showError, showWarning } = useNotifications();
  const { getKOL, ensureKOL } = useKOLStore();

  const [showDropdown, setShowDropdown] = useState(false);
  const [isTradesModalOpen, setIsTradesModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const isList = viewMode === 'list';

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

  // Prefetch KOL details
  useEffect(() => {
    (async () => {
      try { await ensureKOL(subscription.kolWallet); } catch {}
    })();
  }, [subscription.kolWallet, ensureKOL]);

  // Resolve KOL details from store
  const kolDetails = useMemo(() => getKOL(subscription.kolWallet), [getKOL, subscription.kolWallet]);

  // Display name: prefer KOL name, fallback to short wallet
  const displayName = useMemo(() => {
    return kolDetails?.name || `KOL ${subscription.kolWallet.slice(0, 6)}...${subscription.kolWallet.slice(-4)}`;
  }, [kolDetails?.name, subscription.kolWallet]);

  // Avatar: prefer store avatar, then Twitter avatar from social links/description, then dicebear initials
  const avatarUrl = useMemo(() => {
    const storeAvatar = kolDetails?.avatar;
    if (storeAvatar && storeAvatar.trim().length > 0) return storeAvatar;
    const twitterHelperArg = kolDetails
      ? {
          ...(kolDetails.socialLinks?.twitter ? { socialLinks: { twitter: kolDetails.socialLinks.twitter } } : {}),
          ...(kolDetails.description ? { description: kolDetails.description } : {}),
        }
      : undefined;
    const twitterUrl = findTwitterUrlFromKOL(twitterHelperArg);
    const twitterAvatar = getTwitterAvatarUrl(twitterUrl, displayName || subscription.kolWallet);
    if (twitterAvatar) return twitterAvatar;
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName || subscription.kolWallet || 'KOL')}`;
  }, [kolDetails, displayName, subscription.kolWallet]);

  const handleToggleActive = async () => {
    try {
      await updateSubscriptionSettings(subscription.kolWallet, {
        isActive: !subscription.isActive,
      });

      showSuccess(
        'Updated!',
        `Subscription ${subscription.isActive ? 'paused' : 'activated'} successfully`
      );
    } catch (error: any) {
      showError('Error', error.message || 'Failed to update subscription');
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
      <div className={`bg-background border border-border rounded-lg ${isList ? 'p-3' : 'p-4 sm:p-6'} hover:border-muted-foreground transition-all duration-200 group`}
      >
        {/* Header */}
        <div className={`flex ${isList ? 'items-center' : 'items-start'} justify-between ${isList ? 'mb-2' : 'mb-4'} gap-3`}
        >
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className={`${isList ? 'w-8 h-8' : 'w-10 h-10 sm:w-12 sm:h-12'} rounded-full object-cover flex-shrink-0`}
              />
            ) : (
              <div className={`${isList ? 'w-8 h-8' : 'w-10 h-10 sm:w-12 sm:h-12'} bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0`}>
                <span className={`text-primary-foreground font-bold ${isList ? 'text-xs' : 'text-xs sm:text-sm'}`}>
                  {displayName.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}

            {/* Info */}
            <div className="min-w-0 flex-1">
              <h3 className={`font-bold text-foreground ${isList ? 'text-sm' : 'text-sm sm:text-base'} truncate`}>
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

                      <button
                        onClick={() => {
                          setIsSettingsModalOpen(true);
                          setShowDropdown(false);
                        }}
                        className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        <span>Settings</span>
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

        {/* Subscription Details / Condensed */}
        {isList ? (
          <div className="mt-2 flex items-center justify-between text-[11px] sm:text-xs text-muted-foreground">
            <span className="capitalize">
              {subscription.type === 'trade' ? 'Copy Trading' : 'Watch Only'}
            </span>
            {subscription.createdAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(subscription.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Trades Modal */}
      <KOLTradesModal
        kol={null}
        walletAddress={subscription.kolWallet}
        isOpen={isTradesModalOpen}
        onClose={() => setIsTradesModalOpen(false)}
      />

      {/* Settings Modal */}
      <SubscriptionSettingsModal
        subscription={subscription}
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </>
  );
};

export default SubscriptionCard;
