'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useSubscriptions } from '@/stores/use-trading-store';
import { useLoading, useNotifications } from '@/stores/use-ui-store';
import {
  TradingService,
  SubscribeToKOLRequest,
} from '@/services/trading.service';
import { UserSubscription } from '@/types';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Settings,
  X,
  RefreshCw,
  Check,
  Clock,
  Shield,
  Target,
  Zap,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Timer,
  Play,
  Pause,
} from 'lucide-react';

interface SubscriptionControlsProps {
  kolWallet: string;
  kolName: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'card' | 'inline';
  showSettings?: boolean;
  onSubscribe?: (subscription: UserSubscription) => void;
  onUnsubscribe?: () => void;
}

interface SubscriptionSettings {
  minAmount: number;
  maxAmount: number;
  copyPercentage: number;
  subType: 'trade' | 'watch';
  enableSlippageProtection: boolean;
  maxSlippagePercent: number;
  enableTimeRestrictions: boolean;
  tradingHours: {
    start: string;
    end: string;
    timezone: string;
  };
  enableWatchConfig: boolean;
  watchConfig?: {
    takeProfitPercentage: number;
    stopLossPercentage: number;
    enableTrailingStop: boolean;
    trailingPercentage: number;
    maxHoldTimeMinutes: number;
  };
  // additions
  // @ts-expect-error extended in component for update payload
  tokenBuyCount: number;
  // @ts-expect-error extended in component for update payload
  isActive: boolean;
}

export default function SubscriptionControls({
  kolWallet,
  kolName,
  className = '',
  size = 'md',
  variant = 'button',
  showSettings = false,
  onSubscribe,
  onUnsubscribe,
}: SubscriptionControlsProps) {
  const {
    isSubscribedToKOL,
    getSubscription,
    addSubscription,
    removeSubscription,
    updateSubscription,
    updateSubscriptionSettings,
  } = useSubscriptions();
  const { isLoading, setLoading } = useLoading();
  const { showSuccess, showError } = useNotifications();

  // State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState<SubscriptionSettings>({
    minAmount: 0.01,
    maxAmount: 1.0,
    copyPercentage: 100,
    subType: 'trade',
    enableSlippageProtection: true,
    maxSlippagePercent: 1.0,
    enableTimeRestrictions: false,
    tradingHours: {
      start: '09:00',
      end: '17:00',
      timezone: 'UTC',
    },
    enableWatchConfig: false,
    watchConfig: {
      takeProfitPercentage: 50,
      stopLossPercentage: 20,
      enableTrailingStop: false,
      trailingPercentage: 5,
      maxHoldTimeMinutes: 1440, // 24 hours
    },
    // additions
    // @ts-expect-error extended in component for update payload
    tokenBuyCount: 0,
    // @ts-expect-error extended in component for update payload
    isActive: true,
  });

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
        minAmount: settings.minAmount || 0.01,
        subType: settings.subType,
        copyPercentage: settings.copyPercentage,
        maxAmount: settings.maxAmount || 1.0,
        settings: {
          enableSlippageProtection: settings.enableSlippageProtection,
          maxSlippagePercent: settings.maxSlippagePercent || 1.0,
          enableTimeRestrictions: settings.enableTimeRestrictions,
          tradingHours: settings.tradingHours,
        },
        ...(settings.subType === 'trade' &&
          settings.enableWatchConfig &&
          settings.watchConfig && {
            watchConfig: {
              takeProfitPercentage:
                settings.watchConfig.takeProfitPercentage || 50,
              stopLossPercentage: settings.watchConfig.stopLossPercentage || 20,
              enableTrailingStop: settings.watchConfig.enableTrailingStop,
              trailingPercentage: settings.watchConfig.trailingPercentage || 5,
              maxHoldTimeMinutes:
                settings.watchConfig.maxHoldTimeMinutes || 1440,
            },
          }),
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
        'Subscription Created',
        `Successfully subscribed to ${kolName || kolWallet}`
      );

      onSubscribe?.(response.data);
      setShowSettingsModal(false);
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
    settings,
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

  // Handle settings updates
  const handleUpdateSettings = useCallback(async () => {
    try {
      setLoading('subscription', true);

      // Use the new efficient update endpoint instead of unsubscribe/resubscribe
      await updateSubscriptionSettings(kolWallet, {
        minAmount: settings.minAmount || 0.01,
        maxAmount: settings.maxAmount || 1.0,
        type: settings.subType,
        // @ts-expect-error backend supports tokenBuyCount in update request
        tokenBuyCount: (settings as any).tokenBuyCount,
        isActive: (settings as any).isActive,
        settings: {
          enableSlippageProtection: settings.enableSlippageProtection,
          maxSlippagePercent: settings.maxSlippagePercent || 1.0,
          enableTimeRestrictions: settings.enableTimeRestrictions,
          tradingHours: settings.tradingHours,
        },
        ...(settings.subType === 'trade' &&
          settings.enableWatchConfig &&
          settings.watchConfig && {
            watchConfig: {
              takeProfitPercentage:
                settings.watchConfig.takeProfitPercentage || 50,
              stopLossPercentage: settings.watchConfig.stopLossPercentage || 20,
              enableTrailingStop: settings.watchConfig.enableTrailingStop,
              trailingPercentage: settings.watchConfig.trailingPercentage || 5,
              maxHoldTimeMinutes:
                settings.watchConfig.maxHoldTimeMinutes || 1440,
            },
          }),
      });

      showSuccess(
        'Settings Updated',
        'Subscription settings have been updated successfully'
      );
      setShowSettingsModal(false);
    } catch (error: any) {
      console.error('Failed to update subscription settings:', error);
      showError(
        'Update Failed',
        error.message || 'Failed to update subscription settings'
      );
    } finally {
      setLoading('subscription', false);
    }
  }, [
    kolWallet,
    settings,
    updateSubscriptionSettings,
    showSuccess,
    showError,
    setLoading,
  ]);

  // Handle settings changes
  const handleSettingsChange = useCallback(
    (updates: Partial<SubscriptionSettings>) => {
      setSettings(prev => ({ ...prev, ...updates }));
    },
    []
  );

  // Loading state
  const isSubscriptionLoading = isLoading('subscription');

  // Render settings modal
  const renderSettingsModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-[70] p-2 sm:p-4 pt-4 sm:pt-20 pb-4">
      <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-6rem)] overflow-y-auto shadow-2xl">
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4 sm:mb-6 gap-3">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-foreground">
                  Subscription Settings
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Configure your copy trading preferences for {kolName}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettingsModal(false)}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {/* Subscription Type */}
            <div className="bg-muted/50 rounded-lg p-4 sm:p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Target className="h-4 h-4 sm:h-5 sm:w-5 text-primary" />
                <h4 className="text-base sm:text-lg font-semibold text-foreground">
                  Subscription Type
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <button
                  onClick={() => handleSettingsChange({ subType: 'trade' })}
                  className={cn(
                    'p-3 sm:p-4 rounded-lg border-2 text-left transition-all duration-200',
                    'hover:bg-muted focus:bg-muted focus:outline-none',
                    settings.subType === 'trade'
                      ? 'border-primary bg-accent-gradient text-white shadow-sm'
                      : 'border-border hover:border-border/80'
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <Zap className="h-4 h-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-sm sm:text-base">
                        Trade Copy
                      </div>
                      <div
                        className={cn(
                          'text-xs sm:text-sm',
                          settings.subType === 'trade'
                            ? 'text-white'
                            : 'text-muted-foreground'
                        )}
                      >
                        Copy trades automatically
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => handleSettingsChange({ subType: 'watch' })}
                  className={cn(
                    'p-3 sm:p-4 rounded-lg border-2 text-left transition-all duration-200',
                    'hover:bg-muted focus:bg-muted focus:outline-none',
                    settings.subType === 'watch'
                      ? 'border-primary bg-accent-gradient text-white shadow-sm'
                      : 'border-border hover:border-border/80'
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <Clock className="h-4 h-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-sm sm:text-base">
                        Watch Only
                      </div>
                      <div
                        className={cn(
                          'text-xs sm:text-sm',
                          settings.subType === 'watch'
                            ? 'text-white'
                            : 'text-muted-foreground'
                        )}
                      >
                        Receive notifications only
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* General Settings */}
            <div className="bg-muted/50 rounded-lg p-4 sm:p-6">
              <h4 className="text-base sm:text-lg font-semibold text-foreground mb-4">General</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Token Buy Count
                  </label>
                  <Input
                    type="number"
                    value={(settings as any).tokenBuyCount ?? 0}
                    onChange={e =>
                      handleSettingsChange({
                        // @ts-expect-error extended locally
                        tokenBuyCount:
                          e.target.value === '' ? 0 : parseInt(e.target.value),
                      })
                    }
                    min="0"
                    step="1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Status
                  </label>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 bg-background">
                    <span className="text-sm text-muted-foreground">
                      {(settings as any).isActive ? 'Active' : 'Paused'}
                    </span>
                    <Button
                      variant={(settings as any).isActive ? 'secondary' : 'default'}
                      size="sm"
                      onClick={() =>
                        handleSettingsChange({
                          // @ts-expect-error extended locally
                          isActive: !(settings as any).isActive,
                        })
                      }
                      className="flex items-center space-x-2"
                    >
                      {(settings as any).isActive ? (
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
              </div>
            </div>

            {/* Amount Settings */}
            {settings.subType === 'trade' && (
              <div className="bg-muted/50 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-foreground mb-4">
                  Trade Configuration
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Minimum Trade Amount (SOL)
                    </label>
                    <Input
                      type="number"
                      value={settings.minAmount}
                      onChange={e =>
                        handleSettingsChange({
                          minAmount:
                            e.target.value === ''
                              ? 0
                              : parseFloat(e.target.value),
                        })
                      }
                      min="0.001"
                      step="0.001"
                      placeholder="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Maximum Trade Amount (SOL)
                    </label>
                    <Input
                      type="number"
                      value={settings.maxAmount}
                      onChange={e =>
                        handleSettingsChange({
                          maxAmount:
                            e.target.value === ''
                              ? 0
                              : parseFloat(e.target.value),
                        })
                      }
                      min="0.001"
                      step="0.001"
                      placeholder="1.0"
                    />
                  </div>
                </div>

                {/* Copy Percentage slider removed for a more minimal design */}
              </div>
            )}

            {/* Watch Configuration for Copy Trading */}
            {settings.subType === 'trade' && (
              <div className="bg-muted/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <div>
                      <h4 className="text-lg font-semibold text-foreground">TP/SL settings</h4>
                      <p className="text-sm text-muted-foreground">
                        Add automated profit-taking and stop-loss to your copy
                        trades
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.enableWatchConfig}
                    onCheckedChange={checked =>
                      handleSettingsChange({ enableWatchConfig: checked })
                    }
                  />
                </div>

                {settings.enableWatchConfig && (
                  <div className="space-y-6">
                    {/* Take Profit & Stop Loss */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="flex items-center space-x-2 text-sm font-medium text-foreground mb-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <span>Take Profit (%)</span>
                        </label>
                        <Input
                          type="number"
                          value={
                            settings.watchConfig?.takeProfitPercentage || ''
                          }
                          onChange={e =>
                            handleSettingsChange({
                              watchConfig: {
                                ...settings.watchConfig!,
                                takeProfitPercentage:
                                  e.target.value === ''
                                    ? 0
                                    : parseFloat(e.target.value),
                              },
                            })
                          }
                          min="1"
                          max="1000"
                          step="1"
                          placeholder="50"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Automatically sell when profit reaches this percentage
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center space-x-2 text-sm font-medium text-foreground mb-2">
                          <TrendingDown className="h-4 w-4 text-red-500" />
                          <span>Stop Loss (%)</span>
                        </label>
                        <Input
                          type="number"
                          value={settings.watchConfig?.stopLossPercentage || ''}
                          onChange={e =>
                            handleSettingsChange({
                              watchConfig: {
                                ...settings.watchConfig!,
                                stopLossPercentage:
                                  e.target.value === ''
                                    ? 0
                                    : parseFloat(e.target.value),
                              },
                            })
                          }
                          min="1"
                          max="100"
                          step="1"
                          placeholder="20"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Automatically sell when loss reaches this percentage
                        </p>
                      </div>
                    </div>

                    {/* Trailing Stop */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Target className="h-5 w-5 text-primary" />
                          <div>
                            <h5 className="font-medium text-foreground">
                              Trailing Stop
                            </h5>
                            <p className="text-sm text-muted-foreground">
                              Follow the price up and sell on pullback
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={settings.watchConfig?.enableTrailingStop || false}
                          onCheckedChange={checked =>
                            handleSettingsChange({
                              watchConfig: {
                                ...settings.watchConfig!,
                                enableTrailingStop: checked,
                              },
                            })
                          }
                        />
                      </div>

                      {settings.watchConfig?.enableTrailingStop && (
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Trailing Percentage (%)
                          </label>
                          <Input
                            type="number"
                            value={
                              settings.watchConfig?.trailingPercentage || ''
                            }
                            onChange={e =>
                              handleSettingsChange({
                                watchConfig: {
                                  ...settings.watchConfig!,
                                  trailingPercentage:
                                    e.target.value === ''
                                      ? 0
                                      : parseFloat(e.target.value),
                                },
                              })
                            }
                            min="1"
                            max="50"
                            step="0.5"
                            placeholder="5"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Sell when price drops this percentage from the
                            highest point
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Max Hold Time */}
                    <div>
                      <label className="flex items-center space-x-2 text-sm font-medium text-foreground mb-2">
                        <Timer className="h-4 w-4 text-primary" />
                        <span>Max Hold Time (minutes)</span>
                      </label>
                      <Input
                        type="number"
                        value={settings.watchConfig?.maxHoldTimeMinutes || ''}
                        onChange={e =>
                          handleSettingsChange({
                            watchConfig: {
                              ...settings.watchConfig!,
                              maxHoldTimeMinutes:
                                e.target.value === ''
                                  ? 0
                                  : parseInt(e.target.value),
                            },
                          })
                        }
                        min="1"
                        max="10080"
                        step="1"
                        placeholder="1440"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Automatically sell after this time regardless of price
                        (1440 = 24 hours)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Slippage Protection */}
            <div className="bg-muted/50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="text-lg font-semibold text-foreground">
                      Slippage Protection
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Protect against high slippage trades
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.enableSlippageProtection}
                  onCheckedChange={checked =>
                    handleSettingsChange({ enableSlippageProtection: checked })
                  }
                />
              </div>
              {settings.enableSlippageProtection && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Max Slippage (%)
                  </label>
                  <Input
                    type="number"
                    value={settings.maxSlippagePercent}
                    onChange={e =>
                      handleSettingsChange({
                        maxSlippagePercent:
                          e.target.value === ''
                            ? 0
                            : parseFloat(e.target.value),
                      })
                    }
                    min="0.1"
                    max="10"
                    step="0.1"
                    placeholder="1.0"
                  />
                </div>
              )}
            </div>

            {/* Time Restrictions */}
            <div className="bg-muted/50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="text-lg font-semibold text-foreground">
                      Time Restrictions
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Limit trading to specific hours
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.enableTimeRestrictions}
                  onCheckedChange={checked =>
                    handleSettingsChange({ enableTimeRestrictions: checked })
                  }
                />
              </div>
              {settings.enableTimeRestrictions && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Start Time
                    </label>
                    <Input
                      type="time"
                      value={settings.tradingHours.start}
                      onChange={e =>
                        handleSettingsChange({
                          tradingHours: {
                            ...settings.tradingHours,
                            start: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      End Time
                    </label>
                    <Input
                      type="time"
                      value={settings.tradingHours.end}
                      onChange={e =>
                        handleSettingsChange({
                          tradingHours: {
                            ...settings.tradingHours,
                            end: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 mt-8 pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setShowSettingsModal(false)}
              disabled={isSubscriptionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="gradient"
              onClick={isSubscribed ? handleUpdateSettings : handleSubscribe}
              disabled={isSubscriptionLoading}
              className="text-white"
            >
              {isSubscriptionLoading && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              {isSubscribed ? 'Update Settings' : 'Subscribe'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Button variant
  if (variant === 'button') {
    return (
      <>
        <div className={className}>
          {isSubscribed ? (
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleUnsubscribe}
                disabled={isSubscriptionLoading}
                variant="outline"
                size={size}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {isSubscriptionLoading && (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                )}
                Unsubscribe
              </Button>

              {showSettings && (
                <Button
                  onClick={() => setShowSettingsModal(true)}
                  variant="outline"
                  size={size}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              )}
            </div>
          ) : (
            <Button
              onClick={
                showSettings
                  ? () => setShowSettingsModal(true)
                  : handleSubscribe
              }
              disabled={isSubscriptionLoading}
              variant="gradient"
              size={size}
              className="text-white"
            >
              {isSubscriptionLoading && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              Subscribe
            </Button>
          )}
        </div>

        {showSettingsModal && renderSettingsModal()}
      </>
    );
  }

  // Card variant
  if (variant === 'card') {
    return (
      <>
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
                <p className="text-sm text-muted-foreground">Copy Trading</p>
              </div>
            </div>
            {isSubscribed && (
              <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">Subscribed</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {isSubscribed ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium text-foreground capitalize">
                    {subscription?.subType || 'trade'}
                  </span>
                </div>
                {subscription?.subType === 'trade' && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Copy Amount:
                      </span>
                      <span className="font-medium text-foreground">
                        {subscription?.copyPercentage || 100}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Min/Max:</span>
                      <span className="font-medium text-foreground">
                        {subscription?.minAmount || 0.01} -{' '}
                        {subscription?.maxAmount || 1.0} SOL
                      </span>
                    </div>
                  </>
                )}

                <div className="flex items-center space-x-2 pt-2">
                  <Button
                    onClick={handleUnsubscribe}
                    disabled={isSubscriptionLoading}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {isSubscriptionLoading && (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Unsubscribe
                  </Button>

                  <Button
                    onClick={() => setShowSettingsModal(true)}
                    disabled={isSubscriptionLoading}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setShowSettingsModal(true)}
                disabled={isSubscriptionLoading}
                variant="gradient"
                className="w-full text-white"
              >
                {isSubscriptionLoading && (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                )}
                Subscribe to Copy Trades
              </Button>
            )}
          </div>
        </div>

        {showSettingsModal && renderSettingsModal()}
      </>
    );
  }

  // Inline variant
  return (
    <>
      <div className={cn('flex items-center space-x-2', className)}>
        {isSubscribed ? (
          <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" />
            <span className="text-sm font-medium">Subscribed</span>
          </div>
        ) : (
          <Button
            onClick={
              showSettings ? () => setShowSettingsModal(true) : handleSubscribe
            }
            disabled={isSubscriptionLoading}
            variant="link"
            size="sm"
            className="text-primary hover:text-primary/80 p-0 h-auto"
          >
            Subscribe
          </Button>
        )}
      </div>

      {showSettingsModal && renderSettingsModal()}
    </>
  );
}
