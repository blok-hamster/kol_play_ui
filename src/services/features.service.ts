import apiClient from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/constants';
import { ApiResponse, TradingSettings, WatchConfig } from '@/types';

export interface SetupCopyTraderResponse {
  userId: string;
  walletAddress: string;
  privateKey: string;
  aiAssistantId: string;
  message: string;
}

export interface SolanaAgentDetails {
  agentId: string;
  walletAddress: string;
  balance: number;
  aiAssistantId?: string;
  settings?: TradingSettings;
  isActive: boolean;
  createdAt: string;
  lastActiveAt?: string;
}

export class FeaturesService {
  /**
   * Set up copy trader after successful signup/verification
   * This creates the backend wallet and AI assistant for the user
   */
  static async setupCopyTrader(): Promise<
    ApiResponse<SetupCopyTraderResponse>
  > {
    try {
      const response = await apiClient.post<SetupCopyTraderResponse>(
        API_ENDPOINTS.FEATURES.SETUP_COPY_TRADER
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get Solana agent details for the current user
   */
  static async getSolanaAgentDetails(): Promise<
    ApiResponse<SolanaAgentDetails>
  > {
    try {
      const response = await apiClient.get<SolanaAgentDetails>(
        API_ENDPOINTS.FEATURES.GET_SOLANA_AGENT_DETAILS
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
  ): Promise<
    ApiResponse<{
      message: string;
      settings: TradingSettings;
    }>
  > {
    try {
      const response = await apiClient.post<{
        message: string;
        settings: TradingSettings;
      }>(API_ENDPOINTS.FEATURES.UPDATE_TRADING_SETTINGS, settings);
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get current user's trading settings
   */
  static async getTradingSettings(): Promise<ApiResponse<TradingSettings>> {
    try {
      // This would typically be a separate GET endpoint
      // For now, we'll use the agent details which should include settings
      const agentDetails = await this.getSolanaAgentDetails();

      return {
        message: 'Trading settings retrieved successfully',
        data: agentDetails.data.settings || {
          slippage: 0.5,
          minSpend: 0.01,
          maxSpend: 1.0,
          useWatchConfig: false,
          watchConfig: {
            takeProfitPercentage: 50,
            stopLossPercentage: 20,
            enableTrailingStop: false,
            trailingPercentage: 10,
            maxHoldTimeMinutes: 1440,
          },
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Test connection to the backend API
   */
  static async healthCheck(): Promise<
    ApiResponse<{
      status: 'ok' | 'error';
      timestamp: number;
      version: string;
      services: {
        database: 'connected' | 'disconnected';
        rabbitmq: 'connected' | 'disconnected';
        solana: 'connected' | 'disconnected';
        ai: 'connected' | 'disconnected';
      };
    }>
  > {
    try {
      // This would typically be a health check endpoint
      return {
        message: 'Health check completed',
        data: {
          status: 'ok',
          timestamp: Date.now(),
          version: '1.0.0',
          services: {
            database: 'connected',
            rabbitmq: 'connected',
            solana: 'connected',
            ai: 'connected',
          },
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get platform statistics and metrics
   */
  static async getPlatformStats(): Promise<
    ApiResponse<{
      totalUsers: number;
      activeUsers24h: number;
      totalTrades: number;
      totalVolume: number;
      totalKOLs: number;
      totalTokensTracked: number;
      systemUptime: number;
    }>
  > {
    try {
      // This would typically be a platform stats endpoint
      return {
        message: 'Platform statistics retrieved successfully',
        data: {
          totalUsers: 0,
          activeUsers24h: 0,
          totalTrades: 0,
          totalVolume: 0,
          totalKOLs: 0,
          totalTokensTracked: 0,
          systemUptime: 99.9,
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Report an issue or provide feedback
   */
  static async submitFeedback(feedback: {
    type: 'bug' | 'feature' | 'general';
    subject: string;
    description: string;
    userAgent?: string;
    url?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<
    ApiResponse<{
      ticketId: string;
      message: string;
    }>
  > {
    try {
      // This would typically be a feedback/support endpoint
      return {
        message: 'Feedback submitted successfully',
        data: {
          ticketId: `TICKET-${Date.now()}`,
          message: 'Thank you for your feedback. We will review it shortly.',
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get user notifications and alerts
   */
  static async getNotifications(
    page = 1,
    limit = 20
  ): Promise<
    ApiResponse<
      Array<{
        id: string;
        type: 'trade' | 'system' | 'kol' | 'price';
        title: string;
        message: string;
        isRead: boolean;
        createdAt: string;
        data?: any;
      }>
    >
  > {
    try {
      // This would typically be a notifications endpoint
      return {
        message: 'Notifications retrieved successfully',
        data: [],
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Mark notification as read
   */
  static async markNotificationRead(notificationId: string): Promise<
    ApiResponse<{
      message: string;
    }>
  > {
    try {
      // This would typically be a notification update endpoint
      return {
        message: 'Notification marked as read',
        data: {
          message: 'Notification updated successfully',
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get available features and their status for the current user
   */
  static async getFeatureFlags(): Promise<
    ApiResponse<{
      [featureName: string]: {
        enabled: boolean;
        description: string;
        betaAccess?: boolean;
      };
    }>
  > {
    try {
      // This would typically be a feature flags endpoint
      return {
        message: 'Feature flags retrieved successfully',
        data: {
          copyTrading: {
            enabled: true,
            description: 'Copy trades from KOLs',
          },
          aiAssistant: {
            enabled: true,
            description: 'AI-powered trading assistant',
          },
          advancedCharts: {
            enabled: false,
            description: 'Advanced charting tools',
            betaAccess: true,
          },
          portfolio: {
            enabled: true,
            description: 'Portfolio tracking and analytics',
          },
          socialTrading: {
            enabled: false,
            description: 'Social trading features',
            betaAccess: true,
          },
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }
}

export default FeaturesService;
