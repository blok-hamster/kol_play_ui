'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { Settings, User, Shield, Zap, Bell } from 'lucide-react';
import TradingSettingsComponent from '@/components/settings/trading-settings';
import AccountSettingsComponent from '@/components/settings/account-settings';
import SecuritySettingsComponent from '@/components/settings/security-settings';
import {
  SettingsService,
  UpdateSettingParams,
} from '@/services/settings.service';
import { useUserStore } from '@/stores/use-user-store';
import { useNotifications } from '@/stores/use-ui-store';
import { Button } from '@/components/ui/button';
import { AlertCircle, Save, RefreshCw } from 'lucide-react';

type SettingsTab = 'trading' | 'account' | 'security' | 'notifications';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('trading');

  const tabs = [
    {
      id: 'trading' as SettingsTab,
      label: 'Trading',
      icon: Zap,
      description: 'Trading preferences and copy settings',
    },
    {
      id: 'account' as SettingsTab,
      label: 'Account',
      icon: User,
      description: 'Profile information and social accounts',
    },
    {
      id: 'security' as SettingsTab,
      label: 'Security',
      icon: Shield,
      description: '2FA, sessions, and security settings',
    },
    {
      id: 'notifications' as SettingsTab,
      label: 'Notifications',
      icon: Bell,
      description: 'Alerts and notification preferences',
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'trading':
        return <TradingSettingsComponent />;
      case 'account':
        return <AccountSettingsComponent />;
      case 'security':
        return <SecuritySettingsComponent />;
      case 'notifications':
        return <NotificationsSettings />;
      default:
        return <TradingSettingsComponent />;
    }
  };

  return (
    <AppLayout>
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your account, trading preferences, and security settings
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Settings Navigation */}
          <div className="space-y-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full p-4 rounded-lg text-left transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="h-5 w-5" />
                    <div>
                      <p className="font-medium">{tab.label}</p>
                      <p
                        className={`text-xs ${
                          isActive
                            ? 'text-primary-foreground/80'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {tab.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">{renderTabContent()}</div>
        </div>

        {/* CTA Section */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Settings management is live! All your preferences are
              automatically saved.
            </span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

// Updated NotificationsSettings component using new interface
const NotificationsSettings: React.FC = () => {
  const [settings, setSettings] = useState<UpdateSettingParams | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [quietHours, setQuietHours] = useState({
    startTime: '22:00',
    endTime: '08:00',
  });

  const { showSuccess, showError } = useNotifications();
  const { user } = useUserStore();

  const fetchNotificationSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await SettingsService.getUserSettings();
      setSettings(response.data);
    } catch (err: any) {
      console.error('Failed to fetch notification settings:', err);
      setError(err.message || 'Failed to load notification settings');

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
    fetchNotificationSettings();
  }, []);

  const handleNotificationChange = (
    section: 'tradeNotificationConfig' | 'notificationDelieveryConfig',
    field: string,
    checked: boolean
  ) => {
    if (!settings) return;

    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: checked,
        },
      };
    });

    setHasChanges(true);
  };

  const handleSaveSettings = async () => {
    if (!settings || !hasChanges) return;

    try {
      setIsSaving(true);
      await SettingsService.updateUserSettings(settings);
      setHasChanges(false);
      showSuccess(
        'Settings Saved',
        'Your notification settings have been updated successfully'
      );
    } catch (err: any) {
      console.error('Failed to save notification settings:', err);
      showError(
        'Save Failed',
        err.message || 'Failed to save notification settings'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    fetchNotificationSettings();
    setHasChanges(false);
  };

  if (!settings) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Bell className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            Notification Settings
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
          <Bell className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            Notification Settings
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

      {/* Trading Notifications */}
      <div className="bg-muted/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Trading Notifications
        </h3>

        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                Trade execution alerts
              </p>
              <p className="text-sm text-muted-foreground">
                Get notified when trades are executed
              </p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 text-primary bg-background border-border rounded focus:ring-primary"
              checked={settings.tradeNotificationConfig?.tradeActivity || false}
              onChange={e =>
                handleNotificationChange(
                  'tradeNotificationConfig',
                  'tradeActivity',
                  e.target.checked
                )
              }
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">KOL activity alerts</p>
              <p className="text-sm text-muted-foreground">
                Get notified when followed KOLs make trades
              </p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 text-primary bg-background border-border rounded focus:ring-primary"
              checked={settings.tradeNotificationConfig?.kolActivity || false}
              onChange={e =>
                handleNotificationChange(
                  'tradeNotificationConfig',
                  'kolActivity',
                  e.target.checked
                )
              }
            />
          </label>
        </div>
      </div>

      {/* Delivery Methods */}
      <div className="bg-muted/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Delivery Methods
        </h3>

        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Email notifications</p>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 text-primary bg-background border-border rounded focus:ring-primary"
              checked={settings.notificationDelieveryConfig?.useEmail || false}
              onChange={e =>
                handleNotificationChange(
                  'notificationDelieveryConfig',
                  'useEmail',
                  e.target.checked
                )
              }
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                Telegram notifications
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
              onChange={e =>
                handleNotificationChange(
                  'notificationDelieveryConfig',
                  'useTelegram',
                  e.target.checked
                )
              }
            />
          </label>
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="bg-muted/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Quiet Hours
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Start Time
            </label>
            <input
              type="time"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={quietHours.startTime}
              onChange={e => {
                setQuietHours(prev => ({ ...prev, startTime: e.target.value }));
                setHasChanges(true);
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              End Time
            </label>
            <input
              type="time"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={quietHours.endTime}
              onChange={e => {
                setQuietHours(prev => ({ ...prev, endTime: e.target.value }));
                setHasChanges(true);
              }}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-3">
          No notifications will be sent during quiet hours, except for critical
          security alerts.
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;
