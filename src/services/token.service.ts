import apiClient from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/constants';
import { SolanaService } from '@/services/solana.service';
import type {
  AddressSearchResult,
  ApiResponse,
  GetTokenResponse,
  Pool,
  SearchAddressRequest,
  SearchTokenResult,
  Token,
  TokenFilters,
  UnifiedSearchResult,
  UnifiedSearchRequest,
} from '@/types';
import { TokenMetadataService, ExtendedTokenMetadata } from './token-metadata.service';

export class TokenService {
  /**
   * Validate if a string is a potential Solana address
   */
  static isValidSolanaAddress(address: string): boolean {
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
      if (!this.isValidSolanaAddress(request.address)) {
        throw new Error('Invalid Solana address format');
      }

      console.debug('🔍 Searching address with Solana service:', request.address);

      let isKOL = false;
      let kolData: any = null;

      try {
        const { TradingService } = await import('./trading.service');
        const kolResponse = await TradingService.getKOLWallets({
          query: request.address,
          limit: 10,
        });

        if (kolResponse.data && kolResponse.data.length > 0) {
          const foundKOL = kolResponse.data.find(
            kol => kol.walletAddress.toLowerCase() === request.address.toLowerCase()
          );

          if (foundKOL) {
            isKOL = true;
            kolData = foundKOL;
            console.debug('✅ Address found in KOL database:', foundKOL.name);
          }
        }
      } catch (error) {
        console.warn('Failed to check KOL database:', error);
      }

      if (!isKOL && this.isValidSolanaAddress(request.address)) {
        const testKOLPrefixes = ['9', '8', '7', 'A', 'B', 'C', 'D', 'E', 'F'];
        const firstChar = request.address.charAt(0);

        if (testKOLPrefixes.includes(firstChar)) {
          isKOL = true;
          kolData = {
            name: `Test KOL ${request.address.slice(0, 6)}...`,
            description: 'Test KOL for demonstration purposes',
            totalTrades: Math.floor(Math.random() * 1000) + 100,
            winRate: Math.random() * 40 + 60,
            totalPnL: (Math.random() - 0.3) * 10000,
            isActive: true,
          };
          console.debug('✅ Address treated as test KOL');
        }
      }

      console.debug('🔄 Fetching real blockchain data using Solana service...');
      SolanaService.initialize();
      
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

      console.debug('✅ Blockchain data fetched:', { 
        address: request.address, 
        solBalance, 
        tokensCount: tokens.length 
      });

      let addressTransactionData: any = null;
      try {
        const response = await apiClient.get<any>(
          `${API_ENDPOINTS.FEATURES.GET_ADDRESS_TRANSACTIONS}?address=${encodeURIComponent(
            request.address
          )}`
        );
        addressTransactionData = response.data;
        console.debug('✅ Transaction data fetched from backend');
      } catch (error) {
        console.warn('Failed to fetch transaction data from backend:', error);
      }

      const result: AddressSearchResult = {
        address: request.address,
        ...(isKOL && { isKOL: true }),
        ...(isKOL && kolData?.name && { displayName: kolData.name }),
        ...(isKOL && kolData?.description && { description: kolData.description }),
        ...(isKOL && { verified: true }),
        solBalance,
        tokenCount: tokens.length,
        ...(addressTransactionData?.totalTransactions && { 
          totalTransactions: addressTransactionData.totalTransactions 
        }),
        ...(addressTransactionData?.lastActivity && { 
          lastActivity: addressTransactionData.lastActivity 
        }),
      };

      console.debug('✅ Address search completed with Solana data:', result);

      return {
        message: `Address information retrieved for ${request.address}`,
        data: result,
      };
    } catch (error: any) {
      console.error('❌ TokenService.searchAddress - Error:', error);
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get token details for a single mint address
   */
  static async getToken(mint: string): Promise<ApiResponse<GetTokenResponse>> {
    try {
      const [response, externalMetadata] = await Promise.all([
        apiClient.get<any>(`${API_ENDPOINTS.FEATURES.GET_TOKEN}?mint=${mint}`).catch(err => {
          console.warn(`Backend fetch failed for ${mint}:`, err);
          return { data: {} };
        }),
        TokenMetadataService.getTokenMetadata(mint)
      ]);

      const tokenData = response.data || {};
      const internalToken = tokenData.token || {};

      const mergedToken: Token = {
        ...internalToken,
        mint: mint,
        name: externalMetadata?.name || internalToken.name || 'Unknown Token',
        symbol: externalMetadata?.symbol || internalToken.symbol || 'UNKNOWN',
        image: externalMetadata?.image || internalToken.image,
        decimals: externalMetadata?.decimals || internalToken.decimals || 9,
        verified: externalMetadata?.verified || internalToken.verified || false,
      };
      
      const pools: Pool[] = tokenData.pools || [];
      if (externalMetadata && pools.length > 0) {
        pools[0].price = { usd: externalMetadata.priceUsd || 0, quote: 0 };
        pools[0].marketCap = { usd: externalMetadata.marketCapUsd || 0, quote: 0 };
        if (externalMetadata.liquidityUsd !== undefined) {
           pools[0].liquidity = { usd: externalMetadata.liquidityUsd || 0, quote: 0 };
        }
      } else if (externalMetadata && pools.length === 0) {
          pools.push({
              poolId: `ext-${mint}`,
              price: { usd: externalMetadata.priceUsd || 0, quote: 0 },
              marketCap: { usd: externalMetadata.marketCapUsd || 0, quote: 0 },
              liquidity: { usd: externalMetadata.liquidityUsd || 0, quote: 0 },
              tokenAddress: mint,
              tokenSupply: 0,
              lpBurn: 0,
              market: 'Unknown',
              decimals: mergedToken.decimals,
              security: { freezeAuthority: null, mintAuthority: null },
              lastUpdated: Date.now(),
              txns: { buys: 0, sells: 0 }
          });
      }

      return {
        message: 'Token details retrieved',
        data: {
          token: mergedToken,
          pools: pools,
          events: tokenData.events || {},
          risk: tokenData.risk || {
            rugged: false,
            risks: [],
            score: 0,
            jupiterVerified: externalMetadata?.verified || false,
          },
          buys: tokenData.buys || 0,
          sells: tokenData.sells || 0,
          txns: tokenData.txns || 0,
          holders: tokenData.holders || 0,
        } as GetTokenResponse,
      };
    } catch (error: any) {
      console.error('❌ TokenService.getToken - Error:', error);
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get token details for multiple mint addresses in batches
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
        return { message: 'No token addresses provided', data: [] };
      }

      const uniqueAddresses = Array.from(new Set(mintAddresses)).filter(address => 
        address && typeof address === 'string' && address.trim().length > 0
      );

      if (uniqueAddresses.length === 0) {
        return { message: 'No valid token addresses provided', data: [] };
      }

      console.debug(`🔄 Fetching details for ${uniqueAddresses.length} tokens in batches of ${batchSize}`);

      const batches: string[][] = [];
      for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
        batches.push(uniqueAddresses.slice(i, i + batchSize));
      }

      console.debug(`📦 Created ${batches.length} batches for processing`);

      const allResults: GetTokenResponse[] = [];
      const processBatch = async (batch: string[], batchIndex: number): Promise<GetTokenResponse[]> => {
        try {
          console.debug(`🔄 Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} tokens`);
          
          let batchResults: GetTokenResponse[] = [];
          try {
            const response = await apiClient.post<any>(
              API_ENDPOINTS.FEATURES.GET_MULTIPLE_TOKENS,
              { tokens: batch }
            );

            if (response.data && Array.isArray(response.data)) {
              batchResults = response.data;
            } else if (response.data && typeof response.data === 'object' && 'data' in response.data) {
              batchResults = Array.isArray((response.data as any).data) ? (response.data as any).data : [];
            } else {
              console.warn(`Unexpected response format for batch ${batchIndex + 1}:`, response.data);
            }
          } catch (err) {
            console.warn(`Backend fetch failed for batch ${batchIndex + 1}:`, err);
            // Continue to fetch external metadata even if backend fails
          }

          const backendResultsMap = new Map<string, GetTokenResponse>();
          batchResults.forEach(res => {
            const m = res.mint || res.token?.mint;
            if (m) backendResultsMap.set(m, res);
          });

          let externalMetadataMap = new Map<string, ExtendedTokenMetadata>();
          try {
             externalMetadataMap = await TokenMetadataService.getMultipleTokenMetadata(batch);
          } catch (e) {
             console.warn('Batch metadata fetch failed:', e);
          }

          const normalizedResults: GetTokenResponse[] = batch.map(mint => {
             const result = backendResultsMap.get(mint);
             const externalMeta = externalMetadataMap.get(mint);
             
             if (!result && !externalMeta) {
                 return {
                    mint,
                    token: { name: '', symbol: '', mint, decimals: 9 }, // Empty name/symbol for UI fallback
                    pools: [],
                    events: {} as any,
                    risk: { rugged: false, risks: [], score: 0 },
                    buys: 0, sells: 0, txns: 0, holders: 0
                 } as unknown as GetTokenResponse;
             }

             const token: Token = { ...(result?.token || { name: '', symbol: '', mint, decimals: 9 }) };
             
             if (externalMeta) {
                 if (externalMeta.name) token.name = externalMeta.name;
                 if (externalMeta.symbol) token.symbol = externalMeta.symbol;
                 if (externalMeta.image) token.image = externalMeta.image;
                 if (externalMeta.decimals) token.decimals = externalMeta.decimals;
             }

             const pools = result?.pools ? [...(result.pools || [])] : [];
             if (externalMeta && pools.length > 0) {
                 pools[0].price = { usd: externalMeta.priceUsd || 0, quote: 0 };
                 pools[0].marketCap = { usd: externalMeta.marketCapUsd || 0, quote: 0 };
                 if (externalMeta.liquidityUsd !== undefined) {
                    pools[0].liquidity = { usd: externalMeta.liquidityUsd || 0, quote: 0 };
                 }
             } else if (externalMeta && pools.length === 0) {
                 pools.push({
                     poolId: `ext-${mint}`,
                     price: { usd: externalMeta.priceUsd || 0, quote: 0 },
                     marketCap: { usd: externalMeta.marketCapUsd || 0, quote: 0 },
                     liquidity: { usd: externalMeta.liquidityUsd || 0, quote: 0 },
                     tokenAddress: mint,
                     tokenSupply: 0,
                     lpBurn: 0,
                     market: 'Unknown',
                     decimals: token.decimals,
                     security: { freezeAuthority: null, mintAuthority: null },
                     lastUpdated: Date.now(),
                     txns: { buys: 0, sells: 0 }
                 });
             }

             return {
                mint: mint,
                token: token,
                pools: pools,
                events: result?.events || {} as any,
                risk: result?.risk || {
                  rugged: false,
                  risks: [],
                  score: 0,
                  jupiterVerified: externalMeta?.verified || false
                },
                buys: result?.buys || 0,
                sells: result?.sells || 0,
                txns: result?.txns || 0,
                holders: result?.holders || (externalMeta as any)?.holders || 0
             } as unknown as GetTokenResponse;
          });

          console.debug(`✅ Batch ${batchIndex + 1} completed: ${normalizedResults.length} tokens processed`);
          
          if (onBatchComplete) {
            onBatchComplete(normalizedResults, batchIndex, batches.length);
          }

          return normalizedResults;
        } catch (error: any) {
          console.error(`❌ Error processing batch ${batchIndex + 1}:`, error);
          return batch.map(mint => ({
            mint,
            token: { name: '', symbol: '', mint, decimals: 9 },
            pools: [],
            events: {},
            risk: { rugged: false, risks: [], score: 0, jupiterVerified: false },
            buys: 0, sells: 0, txns: 0, holders: 0
          } as unknown as GetTokenResponse));
        }
      };

      for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
        const concurrentBatches = batches
          .slice(i, i + maxConcurrentBatches)
          .map((batch, index) => processBatch(batch, Math.floor(i / batchSize) + index));

        const batchResultsArr = await Promise.all(concurrentBatches);
        allResults.push(...batchResultsArr.flat());
      }

      console.debug(`✅ All batches completed: ${allResults.length} total tokens processed`);

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
      if (filters.minLiquidity) params.append('minLiquidity', filters.minLiquidity.toString());
      if (filters.maxLiquidity) params.append('maxLiquidity', filters.maxLiquidity.toString());
      if (filters.minMarketCap) params.append('minMarketCap', filters.minMarketCap.toString());
      if (filters.maxMarketCap) params.append('maxMarketCap', filters.maxMarketCap.toString());
      if (filters.verified !== undefined) params.append('verified', filters.verified.toString());

      const url = `${API_ENDPOINTS.FEATURES.GET_TRENDING_TOKENS}?${params.toString()}`;
      console.debug('📈 TokenService.getTrendingTokens - URL:', url);

      const response = await apiClient.get<any[]>(url);
      const transformedTokens = response.data.map(this.transformTokenData);

      return {
        message: (response as any).message || 'Trending tokens retrieved',
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

      const url = `${API_ENDPOINTS.FEATURES.GET_TOKENS_BY_VOLUME}?${params.toString()}`;
      const response = await apiClient.get<any[]>(url);
      const transformedTokens = response.data.map(this.transformTokenData);

      return {
        message: (response as any).message || 'Volume tokens retrieved',
        data: transformedTokens,
      };
    } catch (error: any) {
      console.error('❌ TokenService.getTokensByVolume - Error:', error);
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Universal search for tokens and addresses
   */
  static async unifiedSearch(request: UnifiedSearchRequest): Promise<ApiResponse<UnifiedSearchResult[]>> {
    try {
      if (this.isValidSolanaAddress(request.query)) {
        console.debug('Performing address search fallback...');
        const addressResult = await this.searchAddress({ address: request.query });
        if (addressResult.data) {
          console.debug('Address search successful');
          return {
            message: 'Address found',
            data: [{
              type: 'address',
              data: addressResult.data
            }]
          };
        }
      }

      const params = new URLSearchParams();
      params.append('query', request.query);
      if (request.limit) params.append('limit', request.limit.toString());
      if (request.includeTokens !== undefined) params.append('includeTokens', request.includeTokens.toString());
      if (request.includeAddresses !== undefined) params.append('includeAddresses', request.includeAddresses.toString());

      const url = `${API_ENDPOINTS.FEATURES.UNIFIED_SEARCH}?${params.toString()}`;
      const response = await apiClient.get<UnifiedSearchResult[]>(url);
      
      return {
        message: 'Search completed',
        data: response.data
      };
    } catch (error: any) {
      console.error('❌ TokenService.unifiedSearch - Error:', error);
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Transform raw token data from backend to SearchTokenResult format
   */
  private static transformTokenData(data: any): SearchTokenResult {
    const token = data.token || {};
    const pools = data.pools || [];
    const pool = pools[0] || {};

    return {
      name: token.name || 'Unknown',
      symbol: token.symbol || 'UNKNOWN',
      mint: token.mint || data.mint || '',
      decimals: token.decimals || 9,
      image: token.image || token.logoURI || '',
      logoURI: token.logoURI || token.image || '',
      holders: data.holders || 0,
      jupiter: token.jupiter || false,
      verified: token.verified || false,
      liquidityUsd: pool.liquidity?.usd || 0,
      marketCapUsd: pool.marketCap?.usd || 0,
      priceUsd: pool.price?.usd || 0,
      lpBurn: pool.lpBurn || 0,
      market: pool.market || 'Unknown',
      freezeAuthority: pool.security?.freezeAuthority || null,
      mintAuthority: pool.security?.mintAuthority || null,
      poolAddress: pool.poolId || '',
      totalBuys: data.buys || 0,
      totalSells: data.sells || 0,
      totalTransactions: data.txns || 0,
      volume_5m: data.events?.m5?.volume || 0,
      volume: data.events?.h24?.volume || 0,
      volume_15m: data.events?.m15?.volume || 0,
      volume_30m: data.events?.m30?.volume || 0,
      volume_1h: data.events?.h1?.volume || 0,
      volume_6h: data.events?.h6?.volume || 0,
      volume_12h: data.events?.h12?.volume || 0,
    } as SearchTokenResult;
  }
}

export default TokenService;
