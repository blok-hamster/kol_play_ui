'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  User,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Key,
  Link,
  Unlink,
  Send,
  ExternalLink,
  Shield,
} from 'lucide-react';
import {
  SettingsService,
  UpdateSettingParams,
} from '@/services/settings.service';
import { useNotifications } from '@/stores/use-ui-store';
import { useUserStore } from '@/stores/use-user-store';

const AccountSettingsComponent: React.FC = () => {
  const [settings, setSettings] = useState<UpdateSettingParams | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Password change
  const [passwordChange, setPasswordChange] = useState({
    showForm: false,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    isChanging: false,
  });

  const { showSuccess, showError } = useNotifications();
  const { user, updateUserProfile } = useUserStore();

  const fetchAccountData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await SettingsService.getUserSettings();
      setSettings(response.data);
    } catch (err: any) {
      console.error('Failed to fetch account data:', err);
      setError(err.message || 'Failed to load account settings');

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
          displayName: user?.displayName || '',
          avatar: user?.avatar || '',
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountData();
  }, []);

  const handleProfileChange = (field: string, value: string) => {
    if (!settings) return;

    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        accountConfig: {
          ...prev.accountConfig,
          [field]: value,
        },
      };
    });

    setHasChanges(true);
  };

  const handleSaveProfile = async () => {
    if (!settings || !hasChanges) return;

    try {
      setIsSaving(true);
      await SettingsService.updateUserSettings(settings);
      
      // Update the user store with the new profile information
      if (settings.accountConfig) {
        updateUserProfile({
          displayName: settings.accountConfig.displayName,
          avatar: settings.accountConfig.avatar,
        });
      }
      
      setHasChanges(false);
      showSuccess(
        'Profile Updated',
        'Your profile has been updated successfully'
      );
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      showError('Save Failed', err.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    fetchAccountData();
    setHasChanges(false);
  };

  if (!settings) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <User className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            Account Settings
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
          <User className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            Account Settings
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
            onClick={handleSaveProfile}
            disabled={!hasChanges || isSaving}
            className="text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Profile Information */}
      <div className="bg-muted/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Profile Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Display Name
            </label>
            <Input
              type="text"
              value={settings.accountConfig?.displayName || ''}
              onChange={e => handleProfileChange('displayName', e.target.value)}
              placeholder="Your display name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Avatar URL
            </label>
            <Input
              type="url"
              value={settings.accountConfig?.avatar || ''}
              onChange={e => handleProfileChange('avatar', e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
          </div>
        </div>
      </div>

      {/* Social Handles */}
      <div className="bg-muted/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Social Accounts
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Twitter Handle
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-muted text-muted-foreground text-sm">
                @
              </span>
              <Input
                type="text"
                className="rounded-l-none"
                value={settings.accountConfig?.twitter || ''}
                onChange={e => handleProfileChange('twitter', e.target.value)}
                placeholder="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Telegram Handle
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-muted text-muted-foreground text-sm">
                @
              </span>
              <Input
                type="text"
                className="rounded-l-none"
                value={settings.accountConfig?.telegram || ''}
                onChange={e => handleProfileChange('telegram', e.target.value)}
                placeholder="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Discord Handle
            </label>
            <Input
              type="text"
              value={settings.accountConfig?.discord || ''}
              onChange={e => handleProfileChange('discord', e.target.value)}
              placeholder="username#1234"
            />
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-muted/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Notification Preferences
        </h3>

        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Email Notifications</p>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 text-primary bg-background border-border rounded focus:ring-primary"
              checked={settings.notificationDelieveryConfig?.useEmail || false}
              onChange={e => {
                setSettings(prev =>
                  prev
                    ? {
                        ...prev,
                        notificationDelieveryConfig: {
                          ...prev.notificationDelieveryConfig,
                          useEmail: e.target.checked,
                        },
                      }
                    : prev
                );
                setHasChanges(true);
              }}
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                Telegram Notifications
              </p>
              <p className="text-sm text-muted-foreground">
                Receive notifications via Telegram
              </p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 text-primary bg-background border-border rounded focus:ring-primary"
              checked={
                settings.notificationDelieveryConfig?.useTelegram || false
              }
              onChange={e => {
                setSettings(prev =>
                  prev
                    ? {
                        ...prev,
                        notificationDelieveryConfig: {
                          ...prev.notificationDelieveryConfig,
                          useTelegram: e.target.checked,
                        },
                      }
                    : prev
                );
                setHasChanges(true);
              }}
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">KOL Activity Alerts</p>
              <p className="text-sm text-muted-foreground">
                Get notified when followed KOLs make trades
              </p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 text-primary bg-background border-border rounded focus:ring-primary"
              checked={settings.tradeNotificationConfig?.kolActivity || false}
              onChange={e => {
                setSettings(prev =>
                  prev
                    ? {
                        ...prev,
                        tradeNotificationConfig: {
                          ...prev.tradeNotificationConfig,
                          kolActivity: e.target.checked,
                        },
                      }
                    : prev
                );
                setHasChanges(true);
              }}
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                Trade Activity Alerts
              </p>
              <p className="text-sm text-muted-foreground">
                Get notified about your trade executions
              </p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 text-primary bg-background border-border rounded focus:ring-primary"
              checked={settings.tradeNotificationConfig?.tradeActivity || false}
              onChange={e => {
                setSettings(prev =>
                  prev
                    ? {
                        ...prev,
                        tradeNotificationConfig: {
                          ...prev.tradeNotificationConfig,
                          tradeActivity: e.target.checked,
                        },
                      }
                    : prev
                );
                setHasChanges(true);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsComponent;
