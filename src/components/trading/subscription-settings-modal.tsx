'use client';

import React, { useState, useEffect } from 'react';
import { UserSubscription } from '@/types';
import { useSubscriptions } from '@/stores/use-trading-store';
import { useNotifications } from '@/stores/use-ui-store';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/shadcn-tabs';
// Removed heavy Card wrappers for a minimal layout
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause } from 'lucide-react';
// Minimal layout: no section icons
import { useSubscriptionManager } from '@/hooks/use-subscription-manager';
import { useKOLTradeStore } from '@/stores/use-kol-trade-store';

interface SubscriptionSettingsModalProps {
  subscription: UserSubscription | null;
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  type: 'trade' | 'watch';
  minAmount: number;
  maxAmount: number;
  copyPercentage?: number;
  tokenBuyCount?: number;
  isActive: boolean;
  settings: {
    enableSlippageProtection: boolean;
    maxSlippagePercent: number;
    enableDexWhitelist: boolean;
    allowedDexes: string[];
    enableTokenBlacklist: boolean;
    blacklistedTokens: string[];
    enableTimeRestrictions: boolean;
    tradingHours: {
      start: string;
      end: string;
      timezone: string;
    };
  };
  watchConfig: {
    takeProfitPercentage: number;
    stopLossPercentage: number;
    enableTrailingStop: boolean;
    trailingPercentage: number;
    maxHoldTimeMinutes: number;
  };
}

const SubscriptionSettingsModal: React.FC<SubscriptionSettingsModalProps> = ({
  subscription,
  isOpen,
  onClose,
}) => {
  const { updateSubscriptionSettings, getSubscription } = useSubscriptions();
  const { showSuccess, showError } = useNotifications();
  const { hasLoaded: hasLoadedSubscriptions } = useSubscriptionManager();
  const { filters } = useKOLTradeStore();
  const selectedKolWallet = filters.selectedKOL;
  const effectiveSubscription: UserSubscription | null = subscription || (selectedKolWallet ? getSubscription?.(selectedKolWallet) || null : null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    type: process.env.NEXT_PUBLIC_DISABLE_B === 'true' ? 'watch' : 'trade',
    minAmount: 0.01,
    maxAmount: 1.0,
    copyPercentage: 100,
    tokenBuyCount: 0,
    isActive: true,
    settings: {
      enableSlippageProtection: true,
      maxSlippagePercent: 5,
      enableDexWhitelist: false,
      allowedDexes: [],
      enableTokenBlacklist: false,
      blacklistedTokens: [],
      enableTimeRestrictions: false,
      tradingHours: {
        start: '09:00',
        end: '17:00',
        timezone: 'UTC',
      },
    },
    watchConfig: {
      takeProfitPercentage: 50,
      stopLossPercentage: 20,
      enableTrailingStop: false,
      trailingPercentage: 10,
      maxHoldTimeMinutes: 1440, // 24 hours
    },
  });

  // When modal opens, populate from latest store subscription
  useEffect(() => {
    if (!isOpen || !effectiveSubscription) return;
    const latest = getSubscription?.(effectiveSubscription.kolWallet) || effectiveSubscription;
    const isTradeDisabled = process.env.NEXT_PUBLIC_DISABLE_B === 'true';
    const defaultType = isTradeDisabled ? 'watch' : (latest.type ?? 'trade');
      setFormData({
        type: defaultType,
        minAmount: latest.minAmount ?? 0.01,
        maxAmount: latest.maxAmount ?? 1.0,
        copyPercentage: latest.copyPercentage ?? 100,
        tokenBuyCount: (latest as any).tokenBuyCount ?? 0,
        isActive: latest.isActive ?? true,
        settings: {
          enableSlippageProtection: latest.settings?.enableSlippageProtection ?? true,
          maxSlippagePercent: latest.settings?.maxSlippagePercent ?? 5,
          enableDexWhitelist: latest.settings?.enableDexWhitelist ?? false,
          allowedDexes: latest.settings?.allowedDexes ?? [],
          enableTokenBlacklist: latest.settings?.enableTokenBlacklist ?? false,
          blacklistedTokens: latest.settings?.blacklistedTokens ?? [],
          enableTimeRestrictions: latest.settings?.enableTimeRestrictions ?? false,
          tradingHours: {
            start: latest.settings?.tradingHours?.start ?? '09:00',
            end: latest.settings?.tradingHours?.end ?? '17:00',
            timezone: latest.settings?.tradingHours?.timezone ?? 'UTC',
          },
        },
        watchConfig: {
          takeProfitPercentage: latest.watchConfig?.takeProfitPercentage ?? 50,
          stopLossPercentage: latest.watchConfig?.stopLossPercentage ?? 20,
          enableTrailingStop: latest.watchConfig?.enableTrailingStop ?? false,
          trailingPercentage: latest.watchConfig?.trailingPercentage ?? 10,
          maxHoldTimeMinutes: latest.watchConfig?.maxHoldTimeMinutes ?? 1440,
        },
      });
  }, [isOpen, effectiveSubscription, getSubscription]);

  // Force type to 'watch' if 'trade' is disabled
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_B === 'true' && formData.type === 'trade') {
      updateFormData('type', 'watch');
    }
  }, [formData.type]);

  const prettyJson = (obj: unknown) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const handleSave = async () => {
    if (!effectiveSubscription) return;

    const original: FormData = {
      type: effectiveSubscription.type ?? 'trade',
      minAmount: effectiveSubscription.minAmount ?? 0.01,
      maxAmount: effectiveSubscription.maxAmount ?? 1.0,
      copyPercentage: effectiveSubscription.copyPercentage ?? 100,
      tokenBuyCount: (effectiveSubscription as any).tokenBuyCount ?? 0,
      isActive: effectiveSubscription.isActive ?? true,
      settings: {
        enableSlippageProtection: effectiveSubscription.settings?.enableSlippageProtection ?? true,
        maxSlippagePercent: effectiveSubscription.settings?.maxSlippagePercent ?? 5,
        enableDexWhitelist: effectiveSubscription.settings?.enableDexWhitelist ?? false,
        allowedDexes: effectiveSubscription.settings?.allowedDexes ?? [],
        enableTokenBlacklist: effectiveSubscription.settings?.enableTokenBlacklist ?? false,
        blacklistedTokens: effectiveSubscription.settings?.blacklistedTokens ?? [],
        enableTimeRestrictions: effectiveSubscription.settings?.enableTimeRestrictions ?? false,
        tradingHours: {
          start: effectiveSubscription.settings?.tradingHours?.start ?? '09:00',
          end: effectiveSubscription.settings?.tradingHours?.end ?? '17:00',
          timezone: effectiveSubscription.settings?.tradingHours?.timezone ?? 'UTC',
        },
      },
      watchConfig: {
        takeProfitPercentage: effectiveSubscription.watchConfig?.takeProfitPercentage ?? 50,
        stopLossPercentage: effectiveSubscription.watchConfig?.stopLossPercentage ?? 20,
        enableTrailingStop: effectiveSubscription.watchConfig?.enableTrailingStop ?? false,
        trailingPercentage: effectiveSubscription.watchConfig?.trailingPercentage ?? 10,
        maxHoldTimeMinutes: effectiveSubscription.watchConfig?.maxHoldTimeMinutes ?? 1440,
      },
    };

    const diff = (a: any, b: any): any => {
      const result: any = Array.isArray(b) ? [] : {};
      let changed = false;
      const aKeys = Object.keys(a || {});
      const bKeys = Object.keys(b || {});
      const keys = aKeys.concat(bKeys.filter(k => !aKeys.includes(k)));
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const av = a?.[key];
        const bv = b?.[key];
        if (
          typeof av === 'object' && av !== null &&
          typeof bv === 'object' && bv !== null &&
          !Array.isArray(av) && !Array.isArray(bv)
        ) {
          const sub = diff(av, bv);
          if (sub && Object.keys(sub).length > 0) {
            result[key] = sub;
            changed = true;
          }
        } else {
          const isEqual = Array.isArray(av) || Array.isArray(bv)
            ? JSON.stringify(av) === JSON.stringify(bv)
            : av === bv;
          if (!isEqual) {
            result[key] = bv;
            changed = true;
          }
        }
      }
      return changed ? result : {};
    };

    const updates = diff(original, formData);

    setIsLoading(true);
    try {
      await updateSubscriptionSettings(effectiveSubscription.kolWallet, updates as any);

      showSuccess('Updated!', 'Subscription settings updated successfully');
      onClose();
    } catch (error: any) {
      console.error('Failed to update subscription settings:', error);
      showError('Update Failed', error.message || 'Failed to update subscription settings');
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (path: string, value: any) => {
    setFormData(prev => {
      const keys = path.split('.');
      const updated = { ...prev };
      let current: any = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  if (!effectiveSubscription) return null;

  const displayName = `KOL ${effectiveSubscription.kolWallet.slice(0, 6)}...${effectiveSubscription.kolWallet.slice(-4)}`;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title={'Subscription Settings'}
      description={`Configure settings for ${displayName}`}
      size="xl"
      className="max-h-[90vh] overflow-y-auto"
    >
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-5 rounded-lg bg-muted/30 p-1">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="protection">Protection</TabsTrigger>
          <TabsTrigger value="watch">TP/SL settings</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 sm:p-6 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-foreground">Basic</h4>
              <p className="text-xs text-muted-foreground">Configure subscription type and limits</p>
            </div>
              <div>
                <Label htmlFor="type">Subscription Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'trade' | 'watch') => {
                    // Prevent selecting 'trade' when disabled
                    if (value === 'trade' && process.env.NEXT_PUBLIC_DISABLE_B === 'true') {
                      return;
                    }
                    updateFormData('type', value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {process.env.NEXT_PUBLIC_DISABLE_B === 'true' ? (
                      <SelectItem value="trade" disabled className="opacity-50 cursor-not-allowed pointer-events-none">
                        <div className="flex items-center justify-between w-full">
                          <span>Copy Trading</span>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full ml-2">
                            Coming Soon
                          </span>
                        </div>
                      </SelectItem>
                    ) : (
                      <SelectItem value="trade">Copy Trading</SelectItem>
                    )}
                    <SelectItem value="watch">Watch Only</SelectItem>
                  </SelectContent>
                </Select>
                {process.env.NEXT_PUBLIC_DISABLE_B === 'true' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Copy Trading is currently under development. Use Watch Only mode to track KOL trades.
                  </p>
                )}
              </div>
 
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minAmount">Minimum Amount (SOL)</Label>
                  <Input
                    id="minAmount"
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.minAmount}
                    onChange={(e) => updateFormData('minAmount', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="maxAmount">Maximum Amount (SOL)</Label>
                  <Input
                    id="maxAmount"
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.maxAmount}
                    onChange={(e) => updateFormData('maxAmount', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
 
              {formData.type === 'trade' && (
                <div>
                  <Label htmlFor="copyPercentage">Copy Percentage (%)</Label>
                  <Input
                    id="copyPercentage"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.copyPercentage || 100}
                    onChange={(e) => updateFormData('copyPercentage', parseInt(e.target.value) || 100)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Percentage of KOL trade size to copy</p>
                </div>
              )}
 
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tokenBuyCount">Token Buy Count</Label>
                  <Input
                    id="tokenBuyCount"
                    type="number"
                    min="0"
                    value={formData.tokenBuyCount ?? 0}
                    onChange={(e) => updateFormData('tokenBuyCount', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Max number of different tokens to buy</p>
                </div>
                <div className="flex items-end">
                  <div className="w-full">
                    <Label>Status</Label>
                    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 bg-background">
                      <span className="text-sm text-muted-foreground">{formData.isActive ? 'Active' : 'Paused'}</span>
                      <Button
                        variant={formData.isActive ? 'secondary' : 'default'}
                        size="sm"
                        onClick={() => updateFormData('isActive', !formData.isActive)}
                        className="flex items-center space-x-2"
                      >
                        {formData.isActive ? (
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
          </div>
        </TabsContent>
 
        <TabsContent value="trading" className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 sm:p-6 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-foreground">Trading</h4>
              <p className="text-xs text-muted-foreground">Slippage protection and trade controls</p>
            </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Slippage Protection</Label>
                  <p className="text-sm text-muted-foreground">
                    Protect against excessive slippage during trades
                  </p>
                </div>
                <Switch
                  checked={formData.settings.enableSlippageProtection}
                  onCheckedChange={(checked: boolean) => updateFormData('settings.enableSlippageProtection', checked)}
                />
              </div>
 
              {formData.settings.enableSlippageProtection && (
                <div>
                  <Label htmlFor="maxSlippage">Maximum Slippage (%)</Label>
                  <Input
                    id="maxSlippage"
                    type="number"
                    min="0"
                    max="50"
                    step="0.1"
                    value={formData.settings.maxSlippagePercent}
                    onChange={(e) => updateFormData('settings.maxSlippagePercent', parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Trades above this slippage will be skipped</p>
                </div>
              )}
          </div>
        </TabsContent>
 
        <TabsContent value="protection" className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 sm:p-6 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-foreground">Protection</h4>
              <p className="text-xs text-muted-foreground">Time restrictions and trading windows</p>
            </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Time Restrictions</Label>
                  <p className="text-sm text-muted-foreground">
                    Limit trading to specific hours
                  </p>
                </div>
                <Switch
                  checked={formData.settings.enableTimeRestrictions}
                  onCheckedChange={(checked: boolean) => updateFormData('settings.enableTimeRestrictions', checked)}
                />
              </div>
 
              {formData.settings.enableTimeRestrictions && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.settings.tradingHours.start}
                      onChange={(e) => updateFormData('settings.tradingHours.start', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.settings.tradingHours.end}
                      onChange={(e) => updateFormData('settings.tradingHours.end', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={formData.settings.tradingHours.timezone}
                      onValueChange={(value: string) => updateFormData('settings.tradingHours.timezone', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">EST</SelectItem>
                        <SelectItem value="America/Los_Angeles">PST</SelectItem>
                        <SelectItem value="Europe/London">GMT</SelectItem>
                        <SelectItem value="Asia/Tokyo">JST</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
          </div>
        </TabsContent>
 
        <TabsContent value="watch" className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 sm:p-6 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-foreground">TP/SL settings</h4>
              <p className="text-xs text-muted-foreground">Rules for watch-only mode</p>
            </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="takeProfit">Take Profit (%)</Label>
                  <Input
                    id="takeProfit"
                    type="number"
                    min="0"
                    max="1000"
                    value={formData.watchConfig.takeProfitPercentage}
                    onChange={(e) => updateFormData('watchConfig.takeProfitPercentage', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="stopLoss">Stop Loss (%)</Label>
                  <Input
                    id="stopLoss"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.watchConfig.stopLossPercentage}
                    onChange={(e) => updateFormData('watchConfig.stopLossPercentage', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
 
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Trailing Stop</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable trailing stop loss
                  </p>
                </div>
                <Switch
                  checked={formData.watchConfig.enableTrailingStop}
                  onCheckedChange={(checked: boolean) => updateFormData('watchConfig.enableTrailingStop', checked)}
                />
              </div>
 
              {formData.watchConfig.enableTrailingStop && (
                <div>
                  <Label htmlFor="trailingPercent">Trailing Percentage (%)</Label>
                  <Input
                    id="trailingPercent"
                    type="number"
                    min="1"
                    max="50"
                    value={formData.watchConfig.trailingPercentage}
                    onChange={(e) => updateFormData('watchConfig.trailingPercentage', parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}
 
              <div>
                <Label htmlFor="maxHoldTime">Max Hold Time (minutes)</Label>
                <Input
                  id="maxHoldTime"
                  type="number"
                  min="1"
                  value={formData.watchConfig.maxHoldTimeMinutes}
                  onChange={(e) => updateFormData('watchConfig.maxHoldTimeMinutes', parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum time to hold a position (1440 = 24 hours)
                </p>
              </div>
          </div>
        </TabsContent>

        <TabsContent value="debug" className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-foreground">Debug</h4>
                <p className="text-xs text-muted-foreground">Inspect data used to populate this modal</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!effectiveSubscription) return;
                  const latest = getSubscription?.(effectiveSubscription.kolWallet) || effectiveSubscription;
                  setFormData({
                    type: latest.type ?? 'trade',
                    minAmount: latest.minAmount ?? 0.01,
                    maxAmount: latest.maxAmount ?? 1.0,
                    copyPercentage: latest.copyPercentage ?? 100,
                    tokenBuyCount: (latest as any).tokenBuyCount ?? 0,
                    isActive: latest.isActive ?? true,
                    settings: {
                      enableSlippageProtection: latest.settings?.enableSlippageProtection ?? true,
                      maxSlippagePercent: latest.settings?.maxSlippagePercent ?? 5,
                      enableDexWhitelist: latest.settings?.enableDexWhitelist ?? false,
                      allowedDexes: latest.settings?.allowedDexes ?? [],
                      enableTokenBlacklist: latest.settings?.enableTokenBlacklist ?? false,
                      blacklistedTokens: latest.settings?.blacklistedTokens ?? [],
                      enableTimeRestrictions: latest.settings?.enableTimeRestrictions ?? false,
                      tradingHours: {
                        start: latest.settings?.tradingHours?.start ?? '09:00',
                        end: latest.settings?.tradingHours?.end ?? '17:00',
                        timezone: latest.settings?.tradingHours?.timezone ?? 'UTC',
                      },
                    },
                    watchConfig: {
                      takeProfitPercentage: latest.watchConfig?.takeProfitPercentage ?? 50,
                      stopLossPercentage: latest.watchConfig?.stopLossPercentage ?? 20,
                      enableTrailingStop: latest.watchConfig?.enableTrailingStop ?? false,
                      trailingPercentage: latest.watchConfig?.trailingPercentage ?? 10,
                      maxHoldTimeMinutes: latest.watchConfig?.maxHoldTimeMinutes ?? 1440,
                    },
                  });
                }}
              >
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-border p-3 bg-background overflow-auto">
                <div className="text-xs font-medium mb-2">Prop: subscription</div>
                <pre className="text-[11px] leading-tight whitespace-pre-wrap break-words max-h-64">{prettyJson(subscription)}</pre>
              </div>
              <div className="rounded-lg border border-border p-3 bg-background overflow-auto">
                <div className="text-xs font-medium mb-2">Resolved from store</div>
                <pre className="text-[11px] leading-tight whitespace-pre-wrap break-words max-h-64">{prettyJson(effectiveSubscription)}</pre>
              </div>
              <div className="rounded-lg border border-border p-3 bg-background overflow-auto">
                <div className="text-xs font-medium mb-2">Form state</div>
                <pre className="text-[11px] leading-tight whitespace-pre-wrap break-words max-h-64">{prettyJson(formData)}</pre>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Separator className="my-4" />

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isLoading} className="text-white" variant="gradient">
          {isLoading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </Modal>
  );
};

export default SubscriptionSettingsModal; 