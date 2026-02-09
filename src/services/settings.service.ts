import apiClient from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/constants';
import type { ApiResponse } from '@/types';

// Updated Settings Types based on UpdateSettingParams interface
export interface UpdateSettingParams {
  userId: string;
  tradeConfig: {
    slippage?: number;
    minSpend?: number;
    maxSpend?: number;
    useWatchConfig?: boolean;
    paperTrading?: boolean;
  };
  watchConfig: {
    takeProfitPercentage?: number;
    stopLossPercentage?: number;
    enableTrailingStop?: boolean;
    trailingPercentage?: number;
    maxHoldTimeMinutes?: number;
  };
  copyKolConfig: {
    minAmount?: number;
    maxAmount?: number;
    copyPercentage?: number;
  };
  tradeNotificationConfig: {
    kolActivity?: boolean;
    tradeActivity?: boolean;
  };
  notificationDelieveryConfig: {
    useEmail?: boolean;
    useTelegram?: boolean;
  };
  accountConfig: {
    telegram?: string;
    twitter?: string;
    discord?: string;
    displayName?: string;
    avatar?: string;
  };
}

// Interface for editing that allows empty string values for number fields
export interface UpdateSettingParamsEditing {
  userId: string;
  tradeConfig: {
    slippage?: number | string;
    minSpend?: number | string;
    maxSpend?: number | string;
    useWatchConfig?: boolean;
    paperTrading?: boolean;
  };
  watchConfig: {
    takeProfitPercentage?: number | string;
    stopLossPercentage?: number | string;
    enableTrailingStop?: boolean;
    trailingPercentage?: number | string;
    maxHoldTimeMinutes?: number | string;
  };
  copyKolConfig: {
    minAmount?: number | string;
    maxAmount?: number | string;
    copyPercentage?: number | string;
  };
  tradeNotificationConfig: {
    kolActivity?: boolean;
    tradeActivity?: boolean;
  };
  notificationDelieveryConfig: {
    useEmail?: boolean;
    useTelegram?: boolean;
  };
  accountConfig: {
    telegram?: string;
    twitter?: string;
    discord?: string;
    displayName?: string;
    avatar?: string;
  };
}

// Legacy interfaces for backward compatibility
export interface TradingSettings {
  defaultSlippage: number;
  minTradeAmount: number;
  maxTradeAmount: number;
  defaultPriority: 'low' | 'medium' | 'high';
  autoApproveTransactions: boolean;
  kopyCopySettings: {
    enabled: boolean;
    minCopyPercentage: number;
    maxCopyPercentage: number;
    minAmount: number;
    maxAmount: number;
    copyDelaySeconds: number;
    restrictToWhitelist: boolean;
    whitelistedTokens: string[];
  };
  watchConfigDefaults: {
    enableTakeProfit: boolean;
    takeProfitPercentage: number;
    enableStopLoss: boolean;
    stopLossPercentage: number;
    enableTrailingStop: boolean;
    trailingPercentage: number;
    maxHoldTimeMinutes: number;
  };
}

// Account Settings Types
export interface UserProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email: string;
  bio?: string;
  avatar?: string;
  socialHandles: {
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
  telegramLinked: boolean;
  telegramUserId?: string;
  telegramUsername?: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  socialHandles?: {
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
}

export interface TelegramLinkRequest {
  telegramId: string;
  telegramUsername: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface OAuthProvider {
  id: string;
  name: string;
  connected: boolean;
  email?: string;
  connectedAt?: string;
}

export class SettingsService {
  /**
   * Get current trading settings
   */
  static async getTradingSettings(): Promise<ApiResponse<TradingSettings>> {
    try {
      const response = await apiClient.get<TradingSettings>(
        API_ENDPOINTS.FEATURES.GET_TRADING_SETTINGS
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Update trading settings
   */
  static async updateTradingSettings(
    settings: Partial<TradingSettings>
  ): Promise<ApiResponse<TradingSettings>> {
    try {
      const response = await apiClient.post<TradingSettings>(
        API_ENDPOINTS.FEATURES.UPDATE_TRADING_SETTINGS,
        settings
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get user profile
   */
  static async getUserProfile(): Promise<ApiResponse<UserProfile>> {
    try {
      const response = await apiClient.get<UserProfile>(
        API_ENDPOINTS.AUTH.GET_PROFILE
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(
    profile: UpdateProfileRequest
  ): Promise<ApiResponse<UserProfile>> {
    try {
      const response = await apiClient.put<UserProfile>(
        API_ENDPOINTS.AUTH.UPDATE_PROFILE,
        profile
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Link Telegram account
   */
  static async linkTelegramAccount(
    linkData: TelegramLinkRequest
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
      }>(API_ENDPOINTS.AUTH.LINK_TELEGRAM_USER, {
        telegramId: linkData.telegramId,
        telegramUsername: linkData.telegramUsername,
      });
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Unlink Telegram account
   */
  static async unlinkTelegramAccount(): Promise<
    ApiResponse<{ success: boolean; message: string }>
  > {
    try {
      const response = await apiClient.delete<{
        success: boolean;
        message: string;
      }>(API_ENDPOINTS.AUTH.UNLINK_TELEGRAM_USER);
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Change password
   */
  static async changePassword(
    passwordData: PasswordChangeRequest
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
      }>(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, passwordData);
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get connected OAuth providers
   */
  static async getOAuthProviders(): Promise<ApiResponse<OAuthProvider[]>> {
    try {
      const response = await apiClient.get<OAuthProvider[]>(
        API_ENDPOINTS.AUTH.GET_OAUTH_PROVIDERS
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Connect OAuth provider
   */
  static async connectOAuthProvider(
    provider: string
  ): Promise<ApiResponse<{ authUrl: string }>> {
    try {
      const response = await apiClient.post<{ authUrl: string }>(
        API_ENDPOINTS.AUTH.CONNECT_OAUTH_PROVIDER,
        { provider }
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Disconnect OAuth provider
   */
  static async disconnectOAuthProvider(
    provider: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    try {
      const response = await apiClient.delete<{
        success: boolean;
        message: string;
      }>(`${API_ENDPOINTS.AUTH.DISCONNECT_OAUTH_PROVIDER}/${provider}`);
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get security settings (2FA, etc.)
   */
  static async getSecuritySettings(): Promise<
    ApiResponse<{
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
    }>
  > {
    try {
      const response = await apiClient.get(
        API_ENDPOINTS.AUTH.GET_SECURITY_SETTINGS
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Enable/disable two-factor authentication
   */
  static async toggleTwoFactor(
    enabled: boolean
  ): Promise<
    ApiResponse<{ success: boolean; qrCode?: string; secret?: string }>
  > {
    try {
      const response = await apiClient.post(
        API_ENDPOINTS.AUTH.TOGGLE_TWO_FACTOR,
        { enabled }
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Terminate active session
   */
  static async terminateSession(
    sessionId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    try {
      const response = await apiClient.delete(
        `${API_ENDPOINTS.AUTH.TERMINATE_SESSION}/${sessionId}`
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get user settings using new structure
   */
  static async getUserSettings(): Promise<ApiResponse<UpdateSettingParams>> {
    try {
      const response = await apiClient.get<UpdateSettingParams>(
        API_ENDPOINTS.FEATURES.GET_TRADING_SETTINGS
      );
      return response;
    } catch (error: any) {
      if (apiClient.isOfflineError(error)) {
        console.warn('⚠️ Backend offline, returning default user settings');
        return {
          success: true,
          message: 'Backend offline - using default settings',
          data: {
            userId: 'offline-user',
            tradeConfig: {
              slippage: 0.5,
              minSpend: 0.1,
              maxSpend: 1.0,
              useWatchConfig: true,
              paperTrading: true,
            },
            watchConfig: {
              takeProfitPercentage: 200,
              stopLossPercentage: 50,
              enableTrailingStop: true,
              trailingPercentage: 10,
              maxHoldTimeMinutes: 120,
            },
            copyKolConfig: {
              minAmount: 0.1,
              maxAmount: 1.0,
              copyPercentage: 10,
            },
            tradeNotificationConfig: {
              kolActivity: true,
              tradeActivity: true,
            },
            notificationDelieveryConfig: {
              useEmail: false,
              useTelegram: false,
            },
            accountConfig: {
              displayName: 'Offline User',
              avatar: '',
            },
          },
        };
      }
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Update user settings using new structure
   */
  static async updateUserSettings(
    settings: Partial<UpdateSettingParams>
  ): Promise<ApiResponse<UpdateSettingParams>> {
    try {
      const response = await apiClient.post<UpdateSettingParams>(
        API_ENDPOINTS.FEATURES.UPDATE_TRADING_SETTINGS,
        settings
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }
}

export default SettingsService;
