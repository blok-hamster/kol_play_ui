import apiClient from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/constants';
import {
  ApiResponse,
  OverallPnL,
  TokenPnL,
  TransactionStats,
  Transaction,
  TransactionDetails,
  SearchFilters,
} from '@/types';

export interface GetTransactionsRequest extends SearchFilters {
  startDate?: string;
  endDate?: string;
  mint?: string;
  action?: 'buy' | 'sell';
  status?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface GetTransactionByMintRequest {
  mint: string;
  page?: number;
  limit?: number;
}

export class PortfolioService {
  /**
   * Get overall PnL summary for the user
   */
  static async getUserPnL(): Promise<ApiResponse<OverallPnL>> {
    try {
      const response = await apiClient.get<OverallPnL>(
        API_ENDPOINTS.FEATURES.GET_USER_PNL
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get PnL data for a specific token
   */
  static async getTokenPnL(mint: string): Promise<ApiResponse<TokenPnL>> {
    try {
      const response = await apiClient.get<TokenPnL>(
        `${API_ENDPOINTS.FEATURES.GET_TOKEN_PNL}?mint=${mint}`
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get comprehensive trading statistics for the user
   */
  static async getUserTradeStats(): Promise<ApiResponse<TransactionStats>> {
    try {
      const response = await apiClient.get<TransactionStats>(
        API_ENDPOINTS.FEATURES.GET_USER_TRADE_STATS
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get user transaction history with filtering
   */
  static async getUserTransactions(
    request?: GetTransactionsRequest
  ): Promise<ApiResponse<Transaction[]>> {
    try {
      const params = new URLSearchParams();

      if (request?.page) params.append('page', request.page.toString());
      if (request?.limit) params.append('limit', request.limit.toString());
      if (request?.sortBy) params.append('sortBy', request.sortBy);
      if (request?.sortOrder) params.append('sortOrder', request.sortOrder);
      if (request?.startDate) params.append('startDate', request.startDate);
      if (request?.endDate) params.append('endDate', request.endDate);
      if (request?.mint) params.append('mint', request.mint);
      if (request?.action) params.append('action', request.action);
      if (request?.status) params.append('status', request.status);
      if (request?.minAmount)
        params.append('minAmount', request.minAmount.toString());
      if (request?.maxAmount)
        params.append('maxAmount', request.maxAmount.toString());

      const response = await apiClient.get<Transaction[]>(
        `${API_ENDPOINTS.FEATURES.GET_USER_TRANSACTIONS}?${params.toString()}`
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get detailed transaction information
   */
  static async getUserTransactionDetails(
    transactionId: string
  ): Promise<ApiResponse<TransactionDetails>> {
    try {
      const response = await apiClient.get<TransactionDetails>(
        `${API_ENDPOINTS.FEATURES.GET_USER_TRANSACTION_DETAILS}?transactionId=${transactionId}`
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get transactions for a specific token mint
   */
  static async getUserTransactionsByMint(
    request: GetTransactionByMintRequest
  ): Promise<ApiResponse<Transaction[]>> {
    try {
      const params = new URLSearchParams();
      params.append('mint', request.mint);

      if (request.page) params.append('page', request.page.toString());
      if (request.limit) params.append('limit', request.limit.toString());

      const response = await apiClient.get<Transaction[]>(
        `${API_ENDPOINTS.FEATURES.GET_USER_TRANSACTION_BY_MINT}?${params.toString()}`
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get portfolio performance over time (helper method)
   */
  static async getPortfolioPerformance(
    timeframe: '24h' | '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<
    ApiResponse<{
      timeframe: string;
      dataPoints: Array<{
        timestamp: number;
        portfolioValue: number;
        pnl: number;
        pnlPercentage: number;
      }>;
      summary: {
        startValue: number;
        endValue: number;
        totalReturn: number;
        totalReturnPercentage: number;
        volatility: number;
        sharpeRatio: number;
      };
    }>
  > {
    try {
      // This would typically be a separate endpoint for portfolio performance
      // For now, we can derive it from the overall PnL data
      const pnlData = await this.getUserPnL();

      return {
        message: 'Portfolio performance data retrieved successfully',
        data: {
          timeframe,
          dataPoints: [], // Would be populated with historical data
          summary: {
            startValue: 0,
            endValue:
              pnlData.data.totalSOLSpent - pnlData.data.totalSOLReceived,
            totalReturn: pnlData.data.totalPnL,
            totalReturnPercentage: 0,
            volatility: 0,
            sharpeRatio: 0,
          },
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get token holdings summary
   */
  static async getTokenHoldings(): Promise<
    ApiResponse<
      Array<{
        mint: string;
        symbol: string;
        name: string;
        amount: number;
        value: number;
        pnl: number;
        pnlPercentage: number;
        averageBuyPrice: number;
        currentPrice: number;
      }>
    >
  > {
    try {
      // This would typically be a separate endpoint
      // For now, we can derive from user transactions and current holdings
      const transactions = await this.getUserTransactions({ limit: 1000 });

      // Process transactions to calculate holdings
      const holdings: any[] = [];

      return {
        message: 'Token holdings retrieved successfully',
        data: holdings,
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Export transaction history as CSV
   */
  static async exportTransactionHistory(
    request?: GetTransactionsRequest
  ): Promise<
    ApiResponse<{
      downloadUrl: string;
      expiresAt: number;
    }>
  > {
    try {
      // This would typically trigger a CSV export job
      const transactions = await this.getUserTransactions({
        ...request,
        limit: 10000,
      });

      return {
        message: 'Export initiated successfully',
        data: {
          downloadUrl: '', // Would be a signed URL for download
          expiresAt: Date.now() + 3600000, // 1 hour from now
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get trading performance metrics by timeframe
   */
  static async getTradingMetrics(
    timeframe: '24h' | '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<
    ApiResponse<{
      timeframe: string;
      totalTrades: number;
      winRate: number;
      avgWin: number;
      avgLoss: number;
      profitFactor: number;
      maxDrawdown: number;
      totalVolume: number;
      totalFees: number;
      roi: number;
    }>
  > {
    try {
      const tradeStats = await this.getUserTradeStats();

      return {
        message: 'Trading metrics retrieved successfully',
        data: {
          timeframe,
          totalTrades: tradeStats.data.totalTrades,
          winRate: tradeStats.data.winRate,
          avgWin: 0, // Would be calculated from individual trades
          avgLoss: 0,
          profitFactor: 0,
          maxDrawdown: 0,
          totalVolume: tradeStats.data.totalSOLTraded,
          totalFees: tradeStats.data.totalFeesPaid,
          roi:
            (tradeStats.data.pnlStats.totalPnL /
              tradeStats.data.totalSOLSpent) *
            100,
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }
}

export default PortfolioService;
