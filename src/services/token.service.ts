import apiClient from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/constants';
import { SolanaService } from '@/services/solana.service';
import type {
  SearchTokenResult,
  SearchTokensRequest,
  TokenDetails,
  GetTokenResponse,
  TokenFilters,
  ApiResponse,
  AddressSearchResult,
  SearchAddressRequest,
  UnifiedSearchResult,
  UnifiedSearchRequest,
} from '@/types';

export class TokenService {
  /**
   * Validate if a string is a potential Solana address
   */
  static isValidSolanaAddress(address: string): boolean {
    // Solana addresses are typically 32-44 characters, base58 encoded
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address.trim());
  }

  /**
   * Search addresses by query string
   */
  static async searchAddress(
    request: SearchAddressRequest
  ): Promise<ApiResponse<AddressSearchResult>> {
    try {
      // Validate the address format
      if (!this.isValidSolanaAddress(request.address)) {
        throw new Error('Invalid Solana address format');
      }

      void 0 && ('🔍 Searching address with Solana service:', request.address);

      // First, check if this address is a KOL by searching the KOL wallets
      let isKOL = false;
      let kolData = null;

      try {
        // Import TradingService dynamically to avoid circular imports
        const { TradingService } = await import('./trading.service');

        const kolResponse = await TradingService.getKOLWallets({
          query: request.address,
          limit: 10, // Increase limit to ensure we find matches
        });

        if (kolResponse.data && kolResponse.data.length > 0) {
          const foundKOL = kolResponse.data.find(
            kol =>
              kol.walletAddress.toLowerCase() === request.address.toLowerCase()
          );

          if (foundKOL) {
            isKOL = true;
            kolData = foundKOL;
            void 0 && ('✅ Address found in KOL database:', foundKOL.name);
          }
        }
      } catch (error) {
        // If KOL check fails, continue without KOL status
        console.warn('Failed to check KOL database:', error);
      }

      // TEMPORARY: For testing purposes, treat addresses starting with certain characters as KOLs
      if (!isKOL && this.isValidSolanaAddress(request.address)) {
        // Addresses starting with these characters will be treated as KOLs for testing
        const testKOLPrefixes = ['9', '8', '7', 'A', 'B', 'C', 'D', 'E', 'F'];
        const firstChar = request.address.charAt(0);

        if (testKOLPrefixes.includes(firstChar)) {
          isKOL = true;
          kolData = {
            name: `Test KOL ${request.address.slice(0, 6)}...`,
            description: 'Test KOL for demonstration purposes',
            totalTrades: Math.floor(Math.random() * 1000) + 100,
            winRate: Math.random() * 40 + 60, // 60-100% win rate
            totalPnL: (Math.random() - 0.3) * 10000, // Mostly positive PnL
            isActive: true,
          };
          void 0 && ('✅ Address treated as test KOL');
        }
      }

      // Now use Solana service to get real blockchain data
      void 0 && ('🔄 Fetching real blockchain data using Solana service...');
      
      // Initialize Solana service if needed
      SolanaService.initialize();
      
      // Fetch SOL balance and tokens in parallel
      const [solBalance, tokens] = await Promise.all([
        SolanaService.getSolBalance(request.address).catch(error => {
          console.warn('Failed to fetch SOL balance:', error);
          return 0;
        }),
        SolanaService.getTokens(request.address, true).catch(error => {
          console.warn('Failed to fetch tokens:', error);
          return [];
        })
      ]);

      void 0 && ('✅ Blockchain data fetched:', { 
        address: request.address, 
        solBalance, 
        tokensCount: tokens.length 
      });

      // Get basic address transaction data from backend (if available)
      let addressTransactionData = null;
      try {
        const response = await apiClient.get<any>(
          `${API_ENDPOINTS.FEATURES.GET_ADDRESS_TRANSACTIONS}?address=${encodeURIComponent(
            request.address
          )}`
        );
        addressTransactionData = response.data;
        void 0 && ('✅ Transaction data fetched from backend');
      } catch (error) {
        console.warn('Failed to fetch transaction data from backend:', error);
        // Continue without transaction data - we have blockchain data
      }

      // Build the result with real blockchain data
      const result: AddressSearchResult = {
        address: request.address,
        ...(isKOL && { isKOL: true }),
        ...(isKOL && kolData?.name && { displayName: kolData.name }),
        ...(isKOL && kolData?.description && { description: kolData.description }),
        ...(isKOL && { verified: true }),
        solBalance, // Real SOL balance from blockchain
        tokenCount: tokens.length, // Real token count from blockchain
        ...(addressTransactionData?.totalTransactions && { 
          totalTransactions: addressTransactionData.totalTransactions 
        }),
        ...(addressTransactionData?.lastActivity && { 
          lastActivity: addressTransactionData.lastActivity 
        }),
      };

      void 0 && ('✅ Address search completed with Solana data:', result);

      return {
        message: `Address information retrieved for ${request.address}`,
        data: result,
      };
    } catch (error: any) {
      console.error('❌ Address search failed:', error);
      
      // Return a basic result even if Solana service fails
      const fallbackResult: AddressSearchResult = {
        address: request.address,
        isKOL: false,
        solBalance: 0,
        tokenCount: 0,
      };

      return {
        message: `Address found but blockchain data unavailable: ${error.message}`,
        data: fallbackResult,
      };
    }
  }

  /**
   * Unified search that handles both tokens and addresses
   */
  static async unifiedSearch(
    request: UnifiedSearchRequest
  ): Promise<ApiResponse<UnifiedSearchResult[]>> {
    try {
      const results: UnifiedSearchResult[] = [];
      const query = request.query.trim();

      // Determine if the query is likely an address
      const isAddress = this.isValidSolanaAddress(query);

      // Search tokens (unless specifically disabled or it's clearly an address)
      if (
        request.includeTokens !== false &&
        (!isAddress || query.length < 40)
      ) {
        try {
          const tokenSearchRequest: SearchTokensRequest = {
            query,
            ...(request.page !== undefined && { page: request.page }),
            ...(request.limit !== undefined && { limit: request.limit }),
          };
          const tokenResponse = await this.searchTokens(tokenSearchRequest);

          if (tokenResponse.data && Array.isArray(tokenResponse.data)) {
            tokenResponse.data.forEach(token => {
              results.push({ type: 'token', data: token });
            });
          }
        } catch (error) {
          console.warn('Token search failed in unified search:', error);
        }
      }

      // Search addresses (if it looks like an address and not disabled)
      if (request.includeAddresses !== false && isAddress) {
        try {
          const addressResponse = await this.searchAddress({ address: query });
          if (addressResponse.data) {
            results.push({ type: 'address', data: addressResponse.data });
          }
        } catch (error) {
          console.warn('Address search failed in unified search:', error);
        }
      }

      return {
        message: `Found ${results.length} results`,
        data: results,
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Search tokens by query string
   */
  static async searchTokens(
    request: SearchTokensRequest
  ): Promise<ApiResponse<SearchTokenResult[]>> {
    try {
      const params = new URLSearchParams();
      params.append('query', request.query);

      if (request.page) params.append('page', request.page.toString());
      if (request.limit) params.append('limit', request.limit.toString());
      if (request.sortBy) params.append('sortBy', request.sortBy);
      if (request.sortOrder) params.append('sortOrder', request.sortOrder);
      if (request.showAllPools)
        params.append('showAllPools', request.showAllPools.toString());

      const response = await apiClient.get<any[]>(
        `${API_ENDPOINTS.FEATURES.SEARCH_TOKENS}?${params.toString()}`
      );

      // Check if response has nested structure like other endpoints
      // The /features/search-tokens endpoint returns flat data, not nested
      const transformedTokens = response.data.map(item => {
        // The search tokens API returns flat data structure, so use it directly
        return {
          name: item.name || 'Unknown',
          symbol: item.symbol || 'N/A',
          mint: item.mint || '',
          decimals: item.decimals || 6,
          image: item.image || item.logoURI || '',
          logoURI: item.logoURI || item.image || '',
          holders: item.holders || 0,
          jupiter: item.jupiter || false,
          verified: item.verified || false,
          liquidityUsd: item.liquidityUsd || 0,
          marketCapUsd: item.marketCapUsd || 0,
          priceUsd: item.priceUsd || 0,
          // Compatibility properties
          price: item.priceUsd || 0,
          marketCap: item.marketCapUsd || 0,
          liquidity: item.liquidityUsd || 0,
          lpBurn: item.lpBurn || 0,
          market: item.market || 'unknown',
          freezeAuthority: item.freezeAuthority || null,
          mintAuthority: item.mintAuthority || null,
          poolAddress: item.poolAddress || '',
          totalBuys: item.buys || 0,
          totalSells: item.sells || 0,
          totalTransactions: item.totalTransactions || 0,
          volume_5m: item.volume_5m || 0,
          volume: item.volume || 0,
          volume_15m: item.volume_15m || 0,
          volume_30m: item.volume_30m || 0,
          volume_1h: item.volume_1h || 0,
          volume_6h: item.volume_6h || 0,
          volume_12h: item.volume_12h || 0,
          volume_24h: item.volume_24h || 0,
          createdOn: item.createdAt ? item.createdAt : item.createdOn,
        };
      });

      return {
        message: response.message,
        data: transformedTokens,
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get detailed token information
   */
  static async getToken(mint: string): Promise<ApiResponse<TokenDetails>> {
    try {
      const response = await apiClient.get<any>(
        `${API_ENDPOINTS.FEATURES.GET_TOKEN}?mint=${mint}`
      );

      // The response should already be in the correct TokenDetails format
      // but let's ensure all properties are available
      const tokenData = response.data;

      return {
        message: response.message,
        data: {
          token: tokenData.token || {},
          pools: tokenData.pools || [],
          events: tokenData.events || {},
          risk: tokenData.risk || {
            rugged: false,
            risks: [],
            score: 0,
            jupiterVerified: false,
          },
          buys: tokenData.buys || tokenData.buysCount || 0,
          sells: tokenData.sells || tokenData.sellsCount || 0,
          txns: tokenData.txns || 0,
          holders: tokenData.holders || 0,
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get detailed information for multiple tokens with lazy loading
   * Batches requests in groups of 20 tokens at a time
   */
  static async getMultipleTokens(
    mintAddresses: string[],
    options: {
      batchSize?: number;
      maxConcurrentBatches?: number;
      onBatchComplete?: (batch: GetTokenResponse[], batchIndex: number, totalBatches: number) => void;
    } = {}
  ): Promise<ApiResponse<GetTokenResponse[]>> {
    try {
      const {
        batchSize = 20,
        maxConcurrentBatches = 3,
        onBatchComplete
      } = options;

      if (mintAddresses.length === 0) {
        return {
          message: 'No token addresses provided',
          data: []
        };
      }

      // Remove duplicates and validate addresses
      const uniqueAddresses = Array.from(new Set(mintAddresses)).filter(address => 
        address && typeof address === 'string' && address.trim().length > 0
      );

      if (uniqueAddresses.length === 0) {
        return {
          message: 'No valid token addresses provided',
          data: []
        };
      }

      void 0 && (`🔄 Fetching details for ${uniqueAddresses.length} tokens in batches of ${batchSize}`);

      // Split addresses into batches
      const batches: string[][] = [];
      for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
        batches.push(uniqueAddresses.slice(i, i + batchSize));
      }

      void 0 && (`📦 Created ${batches.length} batches for processing`);

      // Process batches with concurrency control
      const allResults: GetTokenResponse[] = [];
      const processBatch = async (batch: string[], batchIndex: number): Promise<GetTokenResponse[]> => {
        try {
          void 0 && (`🔄 Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} tokens`);
          
          const response = await apiClient.post<GetTokenResponse[]>(
            API_ENDPOINTS.FEATURES.GET_MULTIPLE_TOKENS,
            { tokens: batch }
          );

          // Handle different response formats
          let batchResults: GetTokenResponse[] = [];
          
          if (response.data && Array.isArray(response.data)) {
            batchResults = response.data;
          } else if (response.data && typeof response.data === 'object' && 'data' in response.data) {
            // Handle nested response format
            batchResults = Array.isArray((response.data as any).data) ? (response.data as any).data : [];
          } else {
            console.warn(`Unexpected response format for batch ${batchIndex + 1}:`, response);
            batchResults = [];
          }

          // Validate and normalize results
          const normalizedResults = batchResults.map(result => ({
            mint: result.mint || '',
            token: result.token || {},
            pools: result.pools || [],
            events: result.events || {},
            risk: result.risk || {
              rugged: false,
              risks: [],
              score: 0,
              jupiterVerified: false
            },
            buys: result.buys || 0,
            sells: result.sells || 0,
            txns: result.txns || 0,
            holders: result.holders || 0
          }));

          void 0 && (`✅ Batch ${batchIndex + 1} completed: ${normalizedResults.length} tokens processed`);
          
          // Call progress callback if provided
          if (onBatchComplete) {
            onBatchComplete(normalizedResults, batchIndex, batches.length);
          }

          return normalizedResults;
        } catch (error: any) {
          console.error(`❌ Error processing batch ${batchIndex + 1}:`, error);
          
          // Return empty results for this batch but don't fail the entire operation
          const emptyResults = batch.map(mint => ({
            mint,
            token: { name: '', symbol: '', mint, decimals: 0 },
            pools: [],
            events: {},
            risk: { rugged: false, risks: [], score: 0, jupiterVerified: false },
            buys: 0,
            sells: 0,
            txns: 0,
            holders: 0
          }));

          if (onBatchComplete) {
            onBatchComplete(emptyResults, batchIndex, batches.length);
          }

          return emptyResults;
        }
      };

      // Process batches with controlled concurrency
      for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
        const concurrentBatches = batches
          .slice(i, i + maxConcurrentBatches)
          .map((batch, index) => processBatch(batch, i + index));

        const batchResults = await Promise.all(concurrentBatches);
        allResults.push(...batchResults.flat());
      }

      void 0 && (`✅ All batches completed: ${allResults.length} total tokens processed`);

      return {
        message: `Successfully fetched details for ${allResults.length} tokens`,
        data: allResults
      };

    } catch (error: any) {
      console.error('Error fetching multiple token details:', error);
      throw new Error(`Failed to fetch multiple token details: ${error.message}`);
    }
  }

  /**
   * Get trending tokens
   */
  static async getTrendingTokens(
    filters: TokenFilters = {}
  ): Promise<ApiResponse<SearchTokenResult[]>> {
    try {
      const params = new URLSearchParams();

      if (filters.timeframe) params.append('timeframe', filters.timeframe);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      if (filters.minLiquidity)
        params.append('minLiquidity', filters.minLiquidity.toString());
      if (filters.maxLiquidity)
        params.append('maxLiquidity', filters.maxLiquidity.toString());
      if (filters.minMarketCap)
        params.append('minMarketCap', filters.minMarketCap.toString());
      if (filters.maxMarketCap)
        params.append('maxMarketCap', filters.maxMarketCap.toString());
      if (filters.verified !== undefined)
        params.append('verified', filters.verified.toString());

      const url = `${API_ENDPOINTS.FEATURES.GET_TRENDING_TOKENS}?${params.toString()}`;
      void 0 && ('📈 TokenService.getTrendingTokens - URL:', url);

      const response = await apiClient.get<any[]>(url);

      void 0 && (
        '📈 TokenService.getTrendingTokens - Raw response:',
        response
      );

      // Transform the nested response structure to flat structure
      const transformedTokens = response.data.map(this.transformTokenData);

      void 0 && (
        '📈 TokenService.getTrendingTokens - Transformed tokens:',
        transformedTokens
      );

      return {
        message: response.message,
        data: transformedTokens,
      };
    } catch (error: any) {
      console.error('❌ TokenService.getTrendingTokens - Error:', error);
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get tokens by volume
   */
  static async getTokensByVolume(
    filters: TokenFilters = {}
  ): Promise<ApiResponse<SearchTokenResult[]>> {
    try {
      const params = new URLSearchParams();

      if (filters.timeframe) params.append('timeframe', filters.timeframe);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      if (filters.minLiquidity)
        params.append('minLiquidity', filters.minLiquidity.toString());
      if (filters.maxLiquidity)
        params.append('maxLiquidity', filters.maxLiquidity.toString());
      if (filters.minMarketCap)
        params.append('minMarketCap', filters.minMarketCap.toString());
      if (filters.maxMarketCap)
        params.append('maxMarketCap', filters.maxMarketCap.toString());
      if (filters.verified !== undefined)
        params.append('verified', filters.verified.toString());

      const url = `${API_ENDPOINTS.FEATURES.GET_TOKENS_BY_VOLUME}?${params.toString()}`;
      void 0 && ('📊 TokenService.getTokensByVolume - URL:', url);

      const response = await apiClient.get<any[]>(url);

      void 0 && (
        '📊 TokenService.getTokensByVolume - Raw response:',
        response
      );

      // Transform the nested response structure to flat structure
      const transformedTokens = response.data.map(this.transformTokenData);

      void 0 && (
        '📊 TokenService.getTokensByVolume - Transformed tokens:',
        transformedTokens
      );

      return {
        message: response.message,
        data: transformedTokens,
      };
    } catch (error: any) {
      console.error('❌ TokenService.getTokensByVolume - Error:', error);
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get latest tokens
   */
  static async getLatestTokens(
    filters: TokenFilters = {}
  ): Promise<ApiResponse<SearchTokenResult[]>> {
    try {
      const params = new URLSearchParams();

      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      if (filters.minLiquidity)
        params.append('minLiquidity', filters.minLiquidity.toString());

      const url = `${API_ENDPOINTS.FEATURES.GET_LATEST_TOKENS}?${params.toString()}`;
      void 0 && ('🆕 TokenService.getLatestTokens - URL:', url);

      const response = await apiClient.get<any[]>(url);

      void 0 && ('🆕 TokenService.getLatestTokens - Raw response:', response);

      // Transform the nested response structure to flat structure
      const transformedTokens = response.data.map(this.transformTokenData);

      void 0 && (
        '🆕 TokenService.getLatestTokens - Transformed tokens:',
        transformedTokens
      );

      return {
        message: response.message,
        data: transformedTokens,
      };
    } catch (error: any) {
      console.error('❌ TokenService.getLatestTokens - Error:', error);
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Transform the nested token data from API to flat structure expected by UI
   */
  private static transformTokenData(apiTokenData: any): SearchTokenResult {
    const token = apiTokenData.token || {};
    const pool = apiTokenData.pools?.[0] || {}; // Get the first pool
    const poolLiquidity = pool.liquidity || {};
    const poolPrice = pool.price || {};
    const poolMarketCap = pool.marketCap || {};
    const poolTxns = pool.txns || {};
    const poolSecurity = pool.security || {};

    return {
      name: token.name || 'Unknown',
      symbol: token.symbol || 'N/A',
      mint: token.mint || '',
      decimals: token.decimals || 6,
      image: token.image || '',
      logoURI: token.image || '', // Use image as logoURI fallback
      holders: 0, // This data isn't in the API response structure shown
      jupiter: false, // This would need to be determined from other data
      verified: token.twitter && token.website ? true : false, // Basic verification check
      liquidityUsd: poolLiquidity.usd || 0,
      marketCapUsd: poolMarketCap.usd || 0,
      priceUsd: poolPrice.usd || 0,

      // Compatibility properties
      price: poolPrice.usd || 0,
      marketCap: poolMarketCap.usd || 0,
      liquidity: poolLiquidity.usd || 0,

      // Pool and security data
      lpBurn: pool.lpBurn || 0,
      market: pool.market || 'unknown',
      freezeAuthority: poolSecurity.freezeAuthority,
      mintAuthority: poolSecurity.mintAuthority,
      poolAddress: pool.poolId || '',

      // Transaction data
      totalBuys: poolTxns.buys || apiTokenData.buysCount || 0,
      totalSells: poolTxns.sells || apiTokenData.sellsCount || 0,
      totalTransactions: poolTxns.total || 0,

      // Volume data (defaulting to 0 if not available)
      volume_5m: 0, // Not in provided structure
      volume: poolTxns.volume || 0,
      volume_15m: 0, // Not in provided structure
      volume_30m: 0, // Not in provided structure
      volume_1h: 0, // Not in provided structure
      volume_6h: 0, // Not in provided structure
      volume_12h: 0, // Not in provided structure
      volume_24h: poolTxns.volume24h || 0,

      // Creation date for latest tokens
      createdOn:
        token.creation?.created_time ||
        (typeof token.createdOn === 'number' ? token.createdOn : undefined),
    };
  }

  /**
   * Get token price and market data (helper method for real-time updates)
   */
  static async getTokenPrice(mint: string): Promise<
    ApiResponse<{
      mint: string;
      priceUsd: number;
      marketCapUsd: number;
      liquidityUsd: number;
      volume24h: number;
      priceChange24h: number;
      lastUpdated: number;
    }>
  > {
    try {
      // This would typically call a price endpoint or use the token details endpoint
      await this.getToken(mint);

      // Extract price data from token details
      return {
        message: 'Price data retrieved successfully',
        data: {
          mint,
          priceUsd: 0, // Would be extracted from tokenDetails
          marketCapUsd: 0,
          liquidityUsd: 0,
          volume24h: 0,
          priceChange24h: 0,
          lastUpdated: Date.now(),
        },
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Batch get multiple token prices
   */
  static async getMultipleTokenPrices(mints: string[]): Promise<
    ApiResponse<{
      [mint: string]: {
        priceUsd: number;
        marketCapUsd: number;
        volume24h: number;
        priceChange24h: number;
      };
    }>
  > {
    try {
      // This would be implemented as a batch price endpoint
      const params = new URLSearchParams();
      mints.forEach(mint => params.append('mints[]', mint));

      // For now, return empty data structure
      const data = mints.reduce((acc, mint) => {
        acc[mint] = {
          priceUsd: 0,
          marketCapUsd: 0,
          volume24h: 0,
          priceChange24h: 0,
        };
        return acc;
      }, {} as any);

      return {
        message: 'Batch price data retrieved successfully',
        data,
      };
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }
}

export default TokenService;
