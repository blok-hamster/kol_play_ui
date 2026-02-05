'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Zap,
  Save,
  RefreshCw,
  AlertCircle,
  Sliders,
  Target,
} from 'lucide-react';
import {
  SettingsService,
  UpdateSettingParams,
  UpdateSettingParamsEditing,
} from '@/services/settings.service';
import { PortfolioService } from '@/services/portfolio.service';
import { useNotifications } from '@/stores/use-ui-store';
import { useUserStore } from '@/stores/use-user-store';

const TradingSettingsComponent: React.FC = () => {
  const [settings, setSettings] = useState<UpdateSettingParamsEditing | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingPaper, setIsResettingPaper] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { showSuccess, showError } = useNotifications();
  const { user } = useUserStore();

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await SettingsService.getUserSettings();
      setSettings(response.data);
    } catch (err: any) {
      console.error('Failed to fetch trading settings:', err);
      setError(err.message || 'Failed to load trading settings');

      // Set default settings if API fails
      setSettings({
        userId: user?.id || '',
        tradeConfig: {
          slippage: 0.5,
          minSpend: 0.01,
          maxSpend: 10,
          useWatchConfig: false,
        },
        watchConfig: {
          takeProfitPercentage: 20,
          stopLossPercentage: 10,
          enableTrailingStop: false,
          trailingPercentage: 5,
          maxHoldTimeMinutes: 60,
        },
        copyKolConfig: {
          minAmount: 0.1,
          maxAmount: 5,
          copyPercentage: 50,
        },
        tradeNotificationConfig: {
          kolActivity: true,
          tradeActivity: true,
        },
        notificationDelieveryConfig: {
          useEmail: true,
          useTelegram: false,
        },
        accountConfig: {
          telegram: '',
          twitter: '',
          discord: '',
          displayName: '',
          avatar: '',
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleInputChange = (
    section: keyof UpdateSettingParamsEditing,
    field: string,
    value: any
  ) => {
    if (!settings) return;

    setSettings(prev => {
      if (!prev) return prev;

      if (typeof prev[section] === 'object' && prev[section] !== null) {
        return {
          ...prev,
          [section]: {
            ...prev[section],
            [field]: value,
          },
        };
      } else {
        // If section doesn't exist, create it with the field
        return {
          ...prev,
          [section]: {
            [field]: value,
          },
        };
      }
    });

    setHasChanges(true);
  };

  const handleToggleChange = (
    section: keyof UpdateSettingParamsEditing,
    field: string,
    checked: boolean
  ) => {
    handleInputChange(section, field, checked);
  };

  const handleSaveSettings = async () => {
    if (!settings || !hasChanges) return;

    try {
      setIsSaving(true);

      // Helper function to apply defaults for empty strings but preserve zeros and other falsy numbers
      const applyDefault = (
        value: number | string | undefined,
        defaultValue: number
      ): number => {
        if (value === '' || value === undefined || value === null) {
          return defaultValue;
        }
        return typeof value === 'string'
          ? parseFloat(value) || defaultValue
          : value;
      };

      const applyDefaultInt = (
        value: number | string | undefined,
        defaultValue: number
      ): number => {
        if (value === '' || value === undefined || value === null) {
          return defaultValue;
        }
        return typeof value === 'string'
          ? parseInt(value) || defaultValue
          : value;
      };

      // Apply default values for empty fields before saving
      const settingsToSave: UpdateSettingParams = {
        ...settings,
        tradeConfig: {
          slippage: applyDefault(settings.tradeConfig?.slippage, 0.5),
          minSpend: applyDefault(settings.tradeConfig?.minSpend, 0.01),
          maxSpend: applyDefault(settings.tradeConfig?.maxSpend, 10),
          useWatchConfig: settings.tradeConfig?.useWatchConfig || false,
          paperTrading: settings.tradeConfig?.paperTrading ?? true,
        },
        watchConfig: {
          takeProfitPercentage: applyDefault(
            settings.watchConfig?.takeProfitPercentage,
            20
          ),
          stopLossPercentage: applyDefault(
            settings.watchConfig?.stopLossPercentage,
            10
          ),
          enableTrailingStop: settings.watchConfig?.enableTrailingStop || false,
          trailingPercentage: applyDefault(
            settings.watchConfig?.trailingPercentage,
            5
          ),
          maxHoldTimeMinutes: applyDefaultInt(
            settings.watchConfig?.maxHoldTimeMinutes,
            60
          ),
        },
        copyKolConfig: {
          minAmount: applyDefault(settings.copyKolConfig?.minAmount, 0.1),
          maxAmount: applyDefault(settings.copyKolConfig?.maxAmount, 5),
          copyPercentage: applyDefault(
            settings.copyKolConfig?.copyPercentage,
            50
          ),
        },
        tradeNotificationConfig: settings.tradeNotificationConfig || {},
        notificationDelieveryConfig: settings.notificationDelieveryConfig || {},
        accountConfig: settings.accountConfig || {},
      };

      await SettingsService.updateUserSettings(settingsToSave);

      // Update local state with the saved values (including applied defaults)
      setSettings(settingsToSave);
      setHasChanges(false);
      showSuccess(
        'Settings Saved',
        'Your trading settings have been updated successfully'
      );
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      showError('Save Failed', err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    fetchSettings();
    setHasChanges(false);
  };

  const handleResetPaper = async () => {
    if (!confirm('Are you sure you want to reset your Paper Trading wallet to 100 SOL? This cannot be undone.')) return;

    setIsResettingPaper(true);
    try {
      await PortfolioService.resetPaperAccount();
      showSuccess('Reset Successful', 'Paper wallet reset to 100 SOL.');
    } catch (err: any) {
      showError('Reset Failed', err.message);
    } finally {
      setIsResettingPaper(false);
    }
  };

  if (!settings) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Zap className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            Trading Settings
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-muted/50 rounded-lg p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-muted rounded w-32"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-full"></div>
                    <div className="h-10 bg-muted rounded w-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-800 dark:text-red-200">{error}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Zap className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            Trading Settings
          </h2>
        </div>
        <div className="flex items-center space-x-3">
          {hasChanges && (
            <span className="text-sm text-orange-600 dark:text-orange-400">
              • Unsaved changes
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isLoading || isSaving}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Reset
          </Button>
          <Button
            variant="gradient"
            size="sm"
            onClick={handleSaveSettings}
            disabled={!hasChanges || isSaving}
            className="text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Trade Config */}
      <div className="bg-muted/50 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Sliders className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Trade Configuration
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Slippage (%)
            </label>
            <Input
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={settings.tradeConfig?.slippage ?? ''}
              onChange={e =>
                handleInputChange(
                  'tradeConfig',
                  'slippage',
                  e.target.value === '' ? '' : parseFloat(e.target.value)
                )
              }
              placeholder="0.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Min Spend (SOL)
            </label>
            <Input
              type="number"
              min="0.001"
              step="0.001"
              value={settings.tradeConfig?.minSpend ?? ''}
              onChange={e =>
                handleInputChange(
                  'tradeConfig',
                  'minSpend',
                  e.target.value === '' ? '' : parseFloat(e.target.value)
                )
              }
              placeholder="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Max Spend (SOL)
            </label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={settings.tradeConfig?.maxSpend ?? ''}
              onChange={e =>
                handleInputChange(
                  'tradeConfig',
                  'maxSpend',
                  e.target.value === '' ? '' : parseFloat(e.target.value)
                )
              }
              placeholder="10"
            />
          </div>

        </div>
      </div>

      {/* Exit Strategy (formerly Watch Config) */}
      <div className="bg-muted/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              Exit Strategy
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <span className="text-sm font-medium text-foreground">
                {settings.tradeConfig?.useWatchConfig ? 'Enabled' : 'Disabled'}
              </span>
              <div
                className={`w-10 h-5 flex items-center bg-gray-300 dark:bg-gray-700 rounded-full p-1 duration-300 ease-in-out ${settings.tradeConfig?.useWatchConfig ? 'bg-primary' : ''}`}
                onClick={() => handleToggleChange('tradeConfig', 'useWatchConfig', !settings.tradeConfig?.useWatchConfig)}
              >
                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ease-in-out ${settings.tradeConfig?.useWatchConfig ? 'translate-x-[18px]' : ''}`}></div>
              </div>
            </label>
          </div>
        </div>

        {settings.tradeConfig?.useWatchConfig && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-1 duration-200">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Take Profit (%)
              </label>
              <Input
                type="number"
                min="1"
                max="1000"
                value={settings.watchConfig?.takeProfitPercentage ?? ''}
                onChange={e =>
                  handleInputChange(
                    'watchConfig',
                    'takeProfitPercentage',
                    e.target.value === '' ? '' : parseFloat(e.target.value)
                  )
                }
                placeholder="20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Stop Loss (%)
              </label>
              <Input
                type="number"
                min="1"
                max="100"
                value={settings.watchConfig?.stopLossPercentage ?? ''}
                onChange={e =>
                  handleInputChange(
                    'watchConfig',
                    'stopLossPercentage',
                    e.target.value === '' ? '' : parseFloat(e.target.value)
                  )
                }
                placeholder="10"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">
                  Trailing Stop
                </label>
                <div
                  className={`w-8 h-4 flex items-center bg-gray-300 dark:bg-gray-700 rounded-full p-1 cursor-pointer duration-300 ease-in-out ${settings.watchConfig?.enableTrailingStop ? 'bg-primary' : ''}`}
                  onClick={() => handleToggleChange('watchConfig', 'enableTrailingStop', !settings.watchConfig?.enableTrailingStop)}
                >
                  <div className={`bg-white w-2.5 h-2.5 rounded-full shadow-md transform duration-300 ease-in-out ${settings.watchConfig?.enableTrailingStop ? 'translate-x-[14px]' : ''}`}></div>
                </div>
              </div>

              <div className={`transition-opacity duration-200 ${settings.watchConfig?.enableTrailingStop ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <label className="block text-xs text-muted-foreground mb-1">
                  Trailing Percentage (%)
                </label>
                <Input
                  type="number"
                  min="0.1"
                  max="50"
                  step="0.1"
                  value={settings.watchConfig?.trailingPercentage ?? ''}
                  onChange={e =>
                    handleInputChange(
                      'watchConfig',
                      'trailingPercentage',
                      e.target.value === '' ? '' : parseFloat(e.target.value)
                    )
                  }
                  placeholder="5"
                  disabled={!settings.watchConfig?.enableTrailingStop}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Max Hold Time (minutes)
              </label>
              <Input
                type="number"
                min="1"
                max="10080"
                value={settings.watchConfig?.maxHoldTimeMinutes ?? ''}
                onChange={e =>
                  handleInputChange(
                    'watchConfig',
                    'maxHoldTimeMinutes',
                    e.target.value === '' ? '' : parseInt(e.target.value)
                  )
                }
                placeholder="60"
              />
            </div>
          </div>
        )}
      </div>

      {/* Paper Trading Management */}
      <div className="bg-muted/50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              Paper Trading Management
            </h3>
          </div>
          <Button
            variant="destructive"
            onClick={handleResetPaper}
            disabled={isResettingPaper}
          >
            {isResettingPaper ? 'Resetting...' : 'Reset Paper Wallet'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Resetting your paper wallet will safeguard your trade history but set your balance back to 100 SOL.
        </p>
      </div>
    </div>
  );
};

export default TradingSettingsComponent;
