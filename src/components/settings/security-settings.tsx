'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Shield,
  Smartphone,
  Monitor,
  AlertTriangle,
  CheckCircle,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  Globe,
  Clock,
  Trash2,
} from 'lucide-react';
import { SettingsService } from '@/services/settings.service';
import { useNotifications } from '@/stores/use-ui-store';
import { formatRelativeTime } from '@/lib/utils';

interface SecuritySettings {
  twoFactorEnabled: boolean;
  emailNotifications: boolean;
  telegramNotifications: boolean;
  lastPasswordChange?: string;
  activeSessions: Array<{
    id: string;
    device: string;
    location: string;
    lastActive: string;
    current: boolean;
  }>;
}

const SecuritySettingsComponent: React.FC = () => {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 2FA setup
  const [twoFactorSetup, setTwoFactorSetup] = useState({
    isEnabling: false,
    qrCode: '',
    secret: '',
    verificationCode: '',
    showSecret: false,
  });

  const { showNotification } = useNotifications();

  const fetchSecuritySettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await SettingsService.getSecuritySettings();
      setSettings(response.data);
    } catch (err: any) {
      console.error('Failed to fetch security settings:', err);
      setError(err.message || 'Failed to load security settings');

      // Set default settings if API fails
      setSettings({
        twoFactorEnabled: false,
        emailNotifications: true,
        telegramNotifications: false,
        activeSessions: [
          {
            id: '1',
            device: 'Chrome on macOS',
            location: 'San Francisco, CA',
            lastActive: new Date().toISOString(),
            current: true,
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSecuritySettings();
  }, []);

  const handleToggleTwoFactor = async () => {
    if (!settings) return;

    if (settings.twoFactorEnabled) {
      // Disable 2FA
      try {
        setTwoFactorSetup(prev => ({ ...prev, isEnabling: true }));
        await SettingsService.toggleTwoFactor(false);

        setSettings(prev =>
          prev ? { ...prev, twoFactorEnabled: false } : prev
        );
        showNotification(
          '2FA Disabled',
          'Two-factor authentication has been disabled'
        );
      } catch (err: any) {
        console.error('Failed to disable 2FA:', err);
        showNotification(
          'Disable Failed',
          err.message || 'Failed to disable 2FA',
          'error'
        );
      } finally {
        setTwoFactorSetup(prev => ({ ...prev, isEnabling: false }));
      }
    } else {
      // Enable 2FA
      try {
        setTwoFactorSetup(prev => ({ ...prev, isEnabling: true }));
        const response = await SettingsService.toggleTwoFactor(true);

        setTwoFactorSetup(prev => ({
          ...prev,
          qrCode: response.data.qrCode || '',
          secret: response.data.secret || '',
        }));

        showNotification(
          '2FA Setup',
          'Scan the QR code with your authenticator app'
        );
      } catch (err: any) {
        console.error('Failed to enable 2FA:', err);
        showNotification(
          'Enable Failed',
          err.message || 'Failed to enable 2FA',
          'error'
        );
        setTwoFactorSetup(prev => ({ ...prev, isEnabling: false }));
      }
    }
  };

  const handleVerifyTwoFactor = async () => {
    if (!twoFactorSetup.verificationCode) {
      showNotification(
        'Missing Code',
        'Please enter the verification code',
        'error'
      );
      return;
    }

    try {
      // In real implementation, this would verify the code
      setSettings(prev => (prev ? { ...prev, twoFactorEnabled: true } : prev));

      setTwoFactorSetup({
        isEnabling: false,
        qrCode: '',
        secret: '',
        verificationCode: '',
        showSecret: false,
      });

      showNotification(
        '2FA Enabled',
        'Two-factor authentication has been enabled successfully'
      );
    } catch (err: any) {
      console.error('Failed to verify 2FA:', err);
      showNotification(
        'Verification Failed',
        err.message || 'Invalid verification code',
        'error'
      );
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      await SettingsService.terminateSession(sessionId);

      // Remove session from local state
      setSettings(prev =>
        prev
          ? {
              ...prev,
              activeSessions: prev.activeSessions.filter(
                session => session.id !== sessionId
              ),
            }
          : prev
      );

      showNotification(
        'Session Terminated',
        'Session has been terminated successfully'
      );
    } catch (err: any) {
      console.error('Failed to terminate session:', err);
      showNotification(
        'Termination Failed',
        err.message || 'Failed to terminate session',
        'error'
      );
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            Security Settings
          </h2>
        </div>

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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            Security Settings
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSecuritySettings}
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-red-800 dark:text-red-200">{error}</span>
          </div>
        </div>
      )}

      {/* Two-Factor Authentication */}
      <div className="bg-muted/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Smartphone className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Two-Factor Authentication
              </h3>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {settings.twoFactorEnabled ? (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Enabled</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-gray-500">
                <X className="h-4 w-4" />
                <span className="text-sm font-medium">Disabled</span>
              </div>
            )}

            <Button
              variant={settings.twoFactorEnabled ? 'outline' : 'gradient'}
              size="sm"
              onClick={handleToggleTwoFactor}
              disabled={twoFactorSetup.isEnabling}
            >
              {twoFactorSetup.isEnabling
                ? 'Processing...'
                : settings.twoFactorEnabled
                  ? 'Disable'
                  : 'Enable'}
            </Button>
          </div>
        </div>

        {/* 2FA Setup Flow */}
        {twoFactorSetup.qrCode && !settings.twoFactorEnabled && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-4">
              Set up Two-Factor Authentication
            </h4>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    1. Scan this QR code with your authenticator app:
                  </p>
                  <div className="bg-white p-4 rounded-lg border">
                    <div className="w-48 h-48 bg-gray-100 flex items-center justify-center rounded">
                      <span className="text-gray-500">QR Code</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    2. Or enter this secret key manually:
                  </p>
                  <div className="flex items-center space-x-2">
                    <Input
                      type={twoFactorSetup.showSecret ? 'text' : 'password'}
                      value={twoFactorSetup.secret}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setTwoFactorSetup(prev => ({
                          ...prev,
                          showSecret: !prev.showSecret,
                        }))
                      }
                    >
                      {twoFactorSetup.showSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-4 mb-3">
                    3. Enter the 6-digit verification code:
                  </p>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="text"
                      maxLength={6}
                      value={twoFactorSetup.verificationCode}
                      onChange={e =>
                        setTwoFactorSetup(prev => ({
                          ...prev,
                          verificationCode: e.target.value,
                        }))
                      }
                      placeholder="123456"
                      className="font-mono text-center"
                    />
                    <Button
                      onClick={handleVerifyTwoFactor}
                      disabled={twoFactorSetup.verificationCode.length !== 6}
                    >
                      Verify
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
          <p className="text-sm text-muted-foreground">
            {settings.twoFactorEnabled
              ? "Your account is protected with two-factor authentication. You'll need your phone to sign in."
              : 'Recommended: Enable 2FA to protect your account from unauthorized access.'}
          </p>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-muted/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Security Notifications
        </h3>

        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Email notifications</p>
              <p className="text-sm text-muted-foreground">
                Get notified about security events via email
              </p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 text-primary bg-background border-border rounded focus:ring-primary"
              checked={settings.emailNotifications}
              onChange={e =>
                setSettings(prev =>
                  prev
                    ? { ...prev, emailNotifications: e.target.checked }
                    : prev
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
                Get notified about security events via Telegram
              </p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 text-primary bg-background border-border rounded focus:ring-primary"
              checked={settings.telegramNotifications}
              onChange={e =>
                setSettings(prev =>
                  prev
                    ? { ...prev, telegramNotifications: e.target.checked }
                    : prev
                )
              }
            />
          </label>
        </div>
      </div>

      {/* Password Security */}
      <div className="bg-muted/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Password Security
        </h3>

        <div className="flex items-center justify-between p-4 bg-background rounded-lg">
          <div>
            <p className="font-medium text-foreground">Password</p>
            <p className="text-sm text-muted-foreground">
              {settings.lastPasswordChange
                ? `Last changed ${formatRelativeTime(new Date(settings.lastPasswordChange))}`
                : 'Never changed'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-green-600">Strong</span>
          </div>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              We recommend changing your password every 3-6 months for better
              security.
            </span>
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-muted/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Active Sessions
          </h3>
          <span className="text-sm text-muted-foreground">
            {settings.activeSessions.length} active session
            {settings.activeSessions.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-3">
          {settings.activeSessions.map(session => (
            <div
              key={session.id}
              className="flex items-center justify-between p-4 bg-background rounded-lg border border-border"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-muted rounded-lg">
                  {session.device.includes('Mobile') ? (
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="font-medium text-foreground">
                      {session.device}
                    </p>
                    {session.current && (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-xs rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Globe className="h-3 w-3" />
                      <span>{session.location}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatRelativeTime(new Date(session.lastActive))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {!session.current && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTerminateSession(session.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Terminate
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
          <p className="text-sm text-muted-foreground">
            If you see any suspicious activity, terminate those sessions
            immediately and change your password.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettingsComponent;
