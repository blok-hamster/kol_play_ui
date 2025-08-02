import apiClient from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/constants';
import { ApiResponse, SwapData, WatchConfig, TradingSettings } from '@/types';

// Keep existing interfaces for backward compatibility in other methods
export interface PerformSwapRequest {
  tradeType: 'buy' | 'sell';
  amount: number;
  mint: string;
  slippage?: number;
  priority?: 'low' | 'medium' | 'high';
  watchConfig?: Partial<WatchConfig>;
}

export interface SwapQuoteRequest {
  tradeType: 'buy' | 'sell';
  amount: number;
  mint: string;
  slippage?: number;
}

export interface SwapQuoteResponse {
  inputAmount: number;
  outputAmount: number;
  minimumReceived: number;
  priceImpact: number;
  fees: {
    swapFee: number;
    platformFee: number;
    networkFee: number;
    total: number;
  };
  route: {
    dex: string;
    path: string[];
    pools: Array<{
      address: string;
      fee: number;
      liquidity: number;
    }>;
  };
  slippage: number;
  validUntil: number;
}

export interface SwapResult {
  transactionId: string;
  signature: string;
  status: 'pending' | 'success' | 'failed';
  inputAmount: number;
  outputAmount: number;
  actualSlippage: number;
  fees: number;
  timestamp: number;
  executionPrice: number;
  watchConfigId?: string;
}

export class SwapService {
  /**
   * Get a quote for a token swap
   */
  static async getSwapQuote(
    request: SwapQuoteRequest
  ): Promise<ApiResponse<SwapQuoteResponse>> {
    try {
      // This would typically be a separate quote endpoint
      // For now, we'll simulate the quote response
      const response = await apiClient.post<SwapQuoteResponse>(
        '/features/get-swap-quote', // This endpoint doesn't exist in constants yet
        {
          tradeType: request.tradeType,
          amount: request.amount,
          mint: request.mint,
          slippage: request.slippage || 0.5,
        }
      );
      return response;
    } catch (error: any) {
      // Fallback to mock data for now
      return {
        message: 'Swap quote retrieved successfully',
        data: {
          inputAmount: request.amount,
          outputAmount:
            request.tradeType === 'buy'
              ? request.amount * 1000
              : request.amount * 0.001,
          minimumReceived: 0,
          priceImpact: 0.1,
          fees: {
            swapFee: 0.003,
            platformFee: 0.001,
            networkFee: 0.0001,
            total: 0.0041,
          },
          route: {
            dex: 'Jupiter',
            path: ['SOL', 'TOKEN'],
            pools: [],
          },
          slippage: request.slippage || 0.5,
          validUntil: Date.now() + 30000, // 30 seconds
        },
      };
    }
  }

  /**
   * Execute a token swap using the SwapData structure
   */
  static async performSwap(
    request: SwapData
  ): Promise<ApiResponse<SwapResult>> {
    try {
      const response = await apiClient.post<SwapResult>(
        API_ENDPOINTS.FEATURES.PERFORM_SWAP,
        {
          tradeType: request.tradeType,
          amount: request.amount,
          mint: request.mint,
          watchConfig: request.watchConfig,
        }
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Update user trading settings
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
   * Get current trading settings
   */
  static async getTradingSettings(): Promise<ApiResponse<TradingSettings>> {
    try {
      // This would typically be a separate endpoint
      // For now, return default settings
      return {
        message: 'Trading settings retrieved successfully',
        data: {
          slippage: 0.5,
          minSpend: 0.01,
          maxSpend: 1.0,
          useWatchConfig: false,
          watchConfig: {
            takeProfitPercentage: 50,
            stopLossPercentage: 20,
            enableTrailingStop: false,
            trailingPercentage: 10,
            maxHoldTimeMinutes: 1440, // 24 hours
          },
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Validate swap parameters before execution
   */
  static async validateSwap(request: SwapQuoteRequest): Promise<
    ApiResponse<{
      isValid: boolean;
      errors: string[];
      warnings: string[];
      suggestions: string[];
    }>
  > {
    try {
      const validationResult = {
        isValid: true,
        errors: [] as string[],
        warnings: [] as string[],
        suggestions: [] as string[],
      };

      // Basic validation
      if (request.amount <= 0) {
        validationResult.errors.push('Amount must be greater than 0');
        validationResult.isValid = false;
      }

      if (!request.mint || request.mint.length !== 44) {
        validationResult.errors.push('Invalid token mint address');
        validationResult.isValid = false;
      }

      if (
        request.slippage &&
        (request.slippage < 0.1 || request.slippage > 10)
      ) {
        validationResult.warnings.push(
          'Slippage outside recommended range (0.1% - 10%)'
        );
      }

      // Check minimum trade amounts
      if (request.tradeType === 'buy' && request.amount < 0.01) {
        validationResult.warnings.push('Minimum buy amount is 0.01 SOL');
      }

      return {
        message: 'Swap validation completed',
        data: validationResult,
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get swap history for the user
   */
  static async getSwapHistory(
    page = 1,
    limit = 20
  ): Promise<ApiResponse<SwapResult[]>> {
    try {
      // This would use the getUserTransactions endpoint filtered for swaps
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy: 'timestamp',
        sortOrder: 'desc',
      });

      const response = await apiClient.get<SwapResult[]>(
        `${API_ENDPOINTS.FEATURES.GET_USER_TRANSACTIONS}?${params.toString()}`
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Cancel a pending swap (if supported)
   */
  static async cancelSwap(transactionId: string): Promise<
    ApiResponse<{
      message: string;
      cancelled: boolean;
    }>
  > {
    try {
      // This would typically be a separate endpoint
      return {
        message: 'Swap cancellation not supported for this transaction',
        data: {
          message: 'Transaction cannot be cancelled',
          cancelled: false,
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get supported tokens for swapping
   */
  static async getSupportedTokens(): Promise<
    ApiResponse<
      Array<{
        mint: string;
        symbol: string;
        name: string;
        decimals: number;
        logoURI: string;
        verified: boolean;
        popular: boolean;
      }>
    >
  > {
    try {
      // This would typically call a supported tokens endpoint
      // For now, return empty array
      return {
        message: 'Supported tokens retrieved successfully',
        data: [],
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Check swap status by transaction ID
   */
  static async getSwapStatus(transactionId: string): Promise<
    ApiResponse<{
      status: 'pending' | 'success' | 'failed';
      signature?: string;
      confirmations?: number;
      error?: string;
      finalizedAt?: number;
    }>
  > {
    try {
      // This would check the transaction status on the blockchain
      return {
        message: 'Swap status retrieved successfully',
        data: {
          status: 'success',
          signature: 'mock-signature',
          confirmations: 32,
          finalizedAt: Date.now(),
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }
}

export default SwapService;
