import apiClient from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
  ApiResponse,
  KOLWallet,
  KOLTrade,
  TopTrader,
  UserSubscription,
  SearchFilters,
} from '@/types';

export interface SubscribeToKOLRequest {
  walletAddress: string;
  minAmount?: number;
  subType: 'trade' | 'watch';
  copyPercentage?: number;
  maxAmount?: number;
  settings?: {
    enableSlippageProtection?: boolean;
    maxSlippagePercent?: number;
    enableTimeRestrictions?: boolean;
    tradingHours?: {
      start: string;
      end: string;
      timezone: string;
    };
  };
  watchConfig?: {
    takeProfitPercentage?: number;
    stopLossPercentage?: number;
    enableTrailingStop?: boolean;
    trailingPercentage?: number;
    maxHoldTimeMinutes?: number;
  };
}

export interface UpdateUserSubscriptionRequest {
  kolWallet: string;
  minAmount?: number;
  maxAmount?: number;
  tokenBuyCount?: number;
  isActive?: boolean;
  settings?: {
    enableSlippageProtection?: boolean;
    maxSlippagePercent?: number;
    enableDexWhitelist?: boolean;
    allowedDexes?: string[];
    enableTokenBlacklist?: boolean;
    blacklistedTokens?: string[];
    enableTimeRestrictions?: boolean;
    tradingHours?: {
      start: string;
      end: string;
      timezone: string;
    };
  };
  type?: "trade" | "watch";
  watchConfig?: {
    takeProfitPercentage?: number;
    stopLossPercentage?: number;
    enableTrailingStop?: boolean;
    trailingPercentage?: number;
    maxHoldTimeMinutes?: number;
  };
}

export interface RecentKOLTradesRequest {
  walletAddress: string;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface GetAddressTransactionsRequest {
  address: string;
  startTime?: string;
  endTime?: string;
  before?: string;
  after?: string;
}

export interface ParsedSwap {
  side: 'buy' | 'sell';
  tokenMint: string;
  tokenAmount: number;
  solAmount: number;
  name: string;
  createdAt: string;
  transactionTimestamp: string;
}

export interface AddressTransaction {
  transactions: ParsedSwap[];
  pagination?: {
    before?: string;
    after?: string;
    hasMore: boolean;
  };
}

export class TradingService {
  /**
   * Get list of available KOL wallets for subscription
   */
  static async getKOLWallets(
    filters?: SearchFilters
  ): Promise<ApiResponse<KOLWallet[]>> {
    try {
      const params = new URLSearchParams();

      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.query) params.append('search', filters.query);
      if (filters?.sortBy) params.append('sortBy', filters.sortBy);
      if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

      const response = await apiClient.get<KOLWallet[]>(
        `${API_ENDPOINTS.FEATURES.GET_KOL_WALLETS}?${params.toString()}`
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get recent trades for a specific KOL
   */
  static async getRecentKOLTrades(
    request: RecentKOLTradesRequest
  ): Promise<ApiResponse<KOLTrade[]>> {
    try {
      const params = new URLSearchParams();
      params.append('walletAddress', request.walletAddress);

      if (request.limit) params.append('limit', request.limit.toString());
      if (request.page) params.append('page', request.page.toString());
      if (request.sortBy) params.append('sortBy', request.sortBy);
      if (request.sortOrder) params.append('sortOrder', request.sortOrder);

      const response = await apiClient.get<KOLTrade[]>(
        `${API_ENDPOINTS.FEATURES.GET_RECENT_KOL_TRADES}?${params.toString()}`
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get comprehensive trade history for a KOL
   */
  static async getTradeHistory(
    request: RecentKOLTradesRequest
  ): Promise<ApiResponse<KOLTrade[]>> {
    try {
      const params = new URLSearchParams();
      params.append('walletAddress', request.walletAddress);

      if (request.limit) params.append('limit', request.limit.toString());
      if (request.page) params.append('page', request.page.toString());
      if (request.sortBy) params.append('sortBy', request.sortBy);
      if (request.sortOrder) params.append('sortOrder', request.sortOrder);

      const response = await apiClient.get<KOLTrade[]>(
        `${API_ENDPOINTS.FEATURES.GET_TRADE_HISTORY}?${params.toString()}`
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Subscribe to a KOL for copy trading
   */
  static async subscribeToKOL(
    request: SubscribeToKOLRequest
  ): Promise<ApiResponse<UserSubscription>> {
    try {
      const response = await apiClient.post<UserSubscription>(
        API_ENDPOINTS.FEATURES.SUBSCRIBE_TO_KOL,
        {
          walletAddress: request.walletAddress,
          minAmount: request.minAmount,
          subType: request.subType,
          copyPercentage: request.copyPercentage,
          maxAmount: request.maxAmount,
          settings: request.settings,
          watchConfig: request.watchConfig,
        }
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Unsubscribe from a KOL
   */
  static async unsubscribeFromKOL(
    walletAddress: string
  ): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await apiClient.post<{ message: string }>(
        API_ENDPOINTS.FEATURES.UNSUBSCRIBE_FROM_KOL,
        { walletAddress }
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Update user subscription settings
   */
  static async updateUserSubscription(
    request: UpdateUserSubscriptionRequest
  ): Promise<ApiResponse<UserSubscription>> {
    try {
      const response = await apiClient.put<UserSubscription>(
        API_ENDPOINTS.FEATURES.UPDATE_USER_SUBSCRIPTION,
        {
          updateUserSubscription: request,
        }
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Add KOL to webhook monitoring (admin function)
   */
  static async addKOLToWebhook(
    walletAddress: string
  ): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await apiClient.post<{ message: string }>(
        API_ENDPOINTS.FEATURES.ADD_KOL_TO_WEBHOOK,
        { walletAddress }
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Remove KOL from webhook monitoring (admin function)
   */
  static async removeKOLFromWebhook(
    walletAddress: string
  ): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await apiClient.post<{ message: string }>(
        API_ENDPOINTS.FEATURES.REMOVE_KOL_FROM_WEBHOOK,
        { walletAddress }
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get top Solana traders
   */
  static async getTopTraders(): Promise<ApiResponse<TopTrader[]>> {
    try {
      const response = await apiClient.get<TopTrader[]>(
        '/features/get-top-traders'
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get address transactions (KOL trades) within a timeframe
   */
  static async getAddressTransactions(
    request: GetAddressTransactionsRequest
  ): Promise<ApiResponse<AddressTransaction>> {
    try {
      const params = new URLSearchParams();
      params.append('address', request.address);

      if (request.startTime) params.append('startTime', request.startTime);
      if (request.endTime) params.append('endTime', request.endTime);
      if (request.before) params.append('before', request.before);
      if (request.after) params.append('after', request.after);

      const response = await apiClient.get<AddressTransaction>(
        `${API_ENDPOINTS.FEATURES.GET_ADDRESS_TRANSACTIONS}?${params.toString()}`
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get user subscriptions
   */
  static async getUserSubscriptions(): Promise<
    ApiResponse<UserSubscription[]>
  > {
    try {
      const response = await apiClient.get<UserSubscription[]>(
        API_ENDPOINTS.FEATURES.GET_USER_SUBSCRIPTIONS
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }
}

export default TradingService;
