import axios, { AxiosResponse } from 'axios';

export interface ParallelAPICallOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface APICallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ProgressiveLoadingService {
  private static getApiConfig() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const authToken = localStorage.getItem('authToken');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    return { apiUrl, headers };
  }

  /**
   * Execute multiple API calls in parallel with error handling
   */
  static async executeParallelCalls<T extends Record<string, any>>(
    calls: Record<keyof T, () => Promise<AxiosResponse>>,
    options: ParallelAPICallOptions = {}
  ): Promise<Record<keyof T, APICallResult<any>>> {
    const { timeout = 10000, retries = 2, retryDelay = 1000 } = options;
    
    const results = {} as Record<keyof T, APICallResult<any>>;
    
    // Execute all calls in parallel
    const promises = Object.entries(calls).map(async ([key, callFn]) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const response = await Promise.race([
            callFn(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), timeout)
            )
          ]);
          
          results[key as keyof T] = {
            success: true,
            data: response.data,
          };
          return;
          
        } catch (error) {
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
          } else {
            results[key as keyof T] = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        }
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Load essential data (trades, stats, trending tokens) in parallel
   */
  static async loadEssentialData(options: ParallelAPICallOptions = {}) {
    const { apiUrl, headers } = this.getApiConfig();
    
    const calls = {
      trades: () => axios.get(`${apiUrl}/api/kol-trades/recent?limit=50`, { headers }),
      stats: () => axios.get(`${apiUrl}/api/kol-trades/stats`, { headers }),
      trending: () => axios.get(`${apiUrl}/api/kol-trades/trending-tokens?limit=10`, { headers }),
    };

    return this.executeParallelCalls(calls, options);
  }

  /**
   * Load mindmap data for multiple tokens in parallel
   */
  static async loadMindmapData(
    tokenMints: string[], 
    options: ParallelAPICallOptions = {}
  ) {
    const { apiUrl, headers } = this.getApiConfig();
    
    // Split tokens into chunks for bulk requests
    const chunkSize = 10;
    const chunks = [];
    for (let i = 0; i < tokenMints.length; i += chunkSize) {
      chunks.push(tokenMints.slice(i, i + chunkSize));
    }

    const calls = chunks.reduce((acc, chunk, index) => {
      acc[`chunk_${index}`] = () => axios.post(
        `${apiUrl}/api/kol-trades/mindmap/bulk`,
        { tokenMints: chunk },
        { headers }
      );
      return acc;
    }, {} as Record<string, () => Promise<AxiosResponse>>);

    return this.executeParallelCalls(calls, options);
  }

  /**
   * Load additional KOL data in parallel
   */
  static async loadKOLData(
    walletAddresses: string[],
    options: ParallelAPICallOptions = {}
  ) {
    const { apiUrl, headers } = this.getApiConfig();
    
    const calls = walletAddresses.reduce((acc, wallet, index) => {
      acc[`kol_${index}`] = () => axios.get(
        `${apiUrl}/api/kol-trades/kol/${wallet}`,
        { headers }
      );
      return acc;
    }, {} as Record<string, () => Promise<AxiosResponse>>);

    return this.executeParallelCalls(calls, options);
  }

  /**
   * Batch token metadata requests
   */
  static async loadTokenMetadata(
    metadataUris: string[],
    options: ParallelAPICallOptions = {}
  ) {
    const calls = metadataUris.reduce((acc, uri, index) => {
      acc[`metadata_${index}`] = () => axios.get(uri);
      return acc;
    }, {} as Record<string, () => Promise<AxiosResponse>>);

    return this.executeParallelCalls(calls, options);
  }

  /**
   * Preload critical resources
   */
  static async preloadCriticalData(options: ParallelAPICallOptions = {}) {
    const { apiUrl, headers } = this.getApiConfig();
    
    const calls = {
      recentTrades: () => axios.get(`${apiUrl}/api/kol-trades/recent?limit=20`, { headers }),
      topKOLs: () => axios.get(`${apiUrl}/api/kol-trades/top-kols?limit=5`, { headers }),
      activeTokens: () => axios.get(`${apiUrl}/api/kol-trades/tokens-with-activity?limit=5`, { headers }),
    };

    return this.executeParallelCalls(calls, options);
  }

  /**
   * Health check for API endpoints
   */
  static async healthCheck(): Promise<{
    api: boolean;
    websocket: boolean;
    database: boolean;
  }> {
    const { apiUrl, headers } = this.getApiConfig();
    
    try {
      const response = await axios.get(`${apiUrl}/api/health`, { 
        headers,
        timeout: 5000 
      });
      
      return {
        api: response.status === 200,
        websocket: response.data?.websocket || false,
        database: response.data?.database || false,
      };
    } catch (error) {
      return {
        api: false,
        websocket: false,
        database: false,
      };
    }
  }


}

export default ProgressiveLoadingService;