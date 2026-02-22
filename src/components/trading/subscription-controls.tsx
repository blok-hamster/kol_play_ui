'use client';

import React, { useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useSubscriptions } from '@/stores/use-trading-store';
import { useLoading, useNotifications } from '@/stores/use-ui-store';
import {
  TradingService,
  SubscribeToKOLRequest,
} from '@/services/trading.service';
import { UserSubscription } from '@/types';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Check,
  Target,
} from 'lucide-react';

interface SubscriptionControlsProps {
  kolWallet: string;
  kolName: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'card' | 'inline';
  onSubscribe?: (subscription: UserSubscription) => void;
  onUnsubscribe?: () => void;
}

export default function SubscriptionControls({
  kolWallet,
  kolName,
  className = '',
  size = 'md',
  variant = 'button',
  onSubscribe,
  onUnsubscribe,
}: SubscriptionControlsProps) {
  const {
    isSubscribedToKOL,
    getSubscription,
    addSubscription,
    removeSubscription,
  } = useSubscriptions();
  const { isLoading, setLoading } = useLoading();
  const { showSuccess, showError } = useNotifications();

  // Check subscription status
  const isSubscribed = useMemo(
    () => isSubscribedToKOL(kolWallet),
    [isSubscribedToKOL, kolWallet]
  );
  const subscription = useMemo(
    () => getSubscription(kolWallet),
    [getSubscription, kolWallet]
  );

  // Handle subscription
  const handleSubscribe = useCallback(async () => {
    try {
      setLoading('subscription', true);

      const request: SubscribeToKOLRequest = {
        walletAddress: kolWallet,
        subType: 'watch', // Default to watch only as per new requirements
        minAmount: 0.01,
        copyPercentage: 100,
        maxAmount: 1.0,
        label: kolName,
        settings: {
          enableSlippageProtection: true,
          maxSlippagePercent: 1.0,
          enableTimeRestrictions: false,
          tradingHours: {
            start: '09:00',
            end: '17:00',
            timezone: 'UTC',
          },
        },
      };

      // Use authenticated request wrapper
      const { authenticatedRequest } = await import('@/lib/request-manager');
      const response = await authenticatedRequest(
        () => TradingService.subscribeToKOL(request),
        { priority: 'high', timeout: 10000 }
      );

      // Update local state
      addSubscription(response.data);

      showSuccess(
        'Subscribed',
        `Now watching ${kolName || kolWallet}. Configure copy trading in AFK mode.`
      );

      onSubscribe?.(response.data);
    } catch (error: any) {
      console.error('Failed to subscribe to KOL:', error);
      showError(
        'Subscription Failed',
        error.message || 'Failed to subscribe to KOL'
      );
    } finally {
      setLoading('subscription', false);
    }
  }, [
    kolWallet,
    kolName,
    addSubscription,
    showSuccess,
    showError,
    onSubscribe,
    setLoading,
  ]);

  // Handle unsubscription
  const handleUnsubscribe = useCallback(async () => {
    try {
      setLoading('subscription', true);

      await TradingService.unsubscribeFromKOL(kolWallet);

      // Update local state
      removeSubscription(kolWallet);

      showSuccess(
        'Unsubscribed',
        `Successfully unsubscribed from ${kolName || kolWallet}`
      );

      onUnsubscribe?.();
    } catch (error: any) {
      console.error('Failed to unsubscribe from KOL:', error);
      showError(
        'Unsubscribe Failed',
        error.message || 'Failed to unsubscribe from KOL'
      );
    } finally {
      setLoading('subscription', false);
    }
  }, [
    kolWallet,
    kolName,
    removeSubscription,
    showSuccess,
    showError,
    onUnsubscribe,
    setLoading,
  ]);

  // Loading state
  const isSubscriptionLoading = isLoading('subscription');

  // Button variant
  if (variant === 'button') {
    return (
      <div className={className}>
        {isSubscribed ? (
          <Button
            onClick={handleUnsubscribe}
            disabled={isSubscriptionLoading}
            variant="outline"
            size={size === 'md' ? 'default' : size}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {isSubscriptionLoading && (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            )}
            Unsubscribe
          </Button>
        ) : (
          <Button
            onClick={handleSubscribe}
            disabled={isSubscriptionLoading}
            variant="gradient"
            size={size === 'md' ? 'default' : size}
            className="text-white"
          >
            {isSubscriptionLoading && (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            )}
            Subscribe
          </Button>
        )}
      </div>
    );
  }

  // Card variant
  if (variant === 'card') {
    return (
      <div
        className={cn(
          'bg-background border border-border rounded-lg p-6 shadow-sm',
          className
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-accent-gradient rounded-full flex items-center justify-center">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {kolName}
              </h3>
              <p className="text-sm text-muted-foreground">KOL Activity</p>
            </div>
          </div>
          {isSubscribed && (
            <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Watching</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {isSubscribed ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium text-foreground">
                  Active (Watching)
                </span>
              </div>
              <Button
                onClick={handleUnsubscribe}
                disabled={isSubscriptionLoading}
                variant="outline"
                size="sm"
                className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {isSubscriptionLoading && (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                )}
                Unsubscribe
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleSubscribe}
              disabled={isSubscriptionLoading}
              variant="gradient"
              className="w-full text-white"
            >
              {isSubscriptionLoading && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              Subscribe
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Inline variant
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {isSubscribed ? (
        <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium text-xs">Watching</span>
          <button
            onClick={handleUnsubscribe}
            disabled={isSubscriptionLoading}
            className="text-xs text-red-500 hover:underline ml-1"
          >
            (Unsubscribe)
          </button>
        </div>
      ) : (
        <Button
          onClick={handleSubscribe}
          disabled={isSubscriptionLoading}
          variant="link"
          size="sm"
          className="text-primary hover:text-primary/80 p-0 h-auto text-xs font-bold uppercase tracking-wider"
        >
          Subscribe
        </Button>
      )}
    </div>
  );
}
