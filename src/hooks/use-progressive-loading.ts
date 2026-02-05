'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { TokenMetadataService } from '@/services/token-metadata.service';

export interface LoadingState {
  trades: 'idle' | 'loading' | 'loaded' | 'error';
  mindmap: 'idle' | 'loading' | 'loaded' | 'error';
  stats: 'idle' | 'loading' | 'loaded' | 'error';
  trending: 'idle' | 'loading' | 'loaded' | 'error';
}

export interface EssentialData {
  trades: any[];
  stats: {
    totalTrades: number;
    uniqueKOLs: number;
    uniqueTokens: number;
    totalVolume: number;
  };
  trendingTokens: string[];
}

export interface ProgressiveLoadingOptions {
  maxRetries?: number;
  retryDelay?: number;
  enableCache?: boolean;
  cacheTTL?: number;
}

export interface UseProgressiveLoadingReturn {
  loadingState: LoadingState;
  essentialData: EssentialData | null;
  mindmapData: { [tokenMint: string]: any };
  isPhaseComplete: (phase: 'essential' | 'enhanced' | 'background') => boolean;
  loadEssentialData: () => Promise<void>;
  loadEnhancedData: () => Promise<void>;
  loadBackgroundData: () => Promise<void>;
  retryFailedRequests: () => Promise<void>;
  clearCache: () => void;
}

const DEFAULT_OPTIONS: Required<ProgressiveLoadingOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  enableCache: true,
  cacheTTL: 300000, // 5 minutes
};

export const useProgressiveLoading = (
  options: ProgressiveLoadingOptions = {}
): UseProgressiveLoadingReturn => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [loadingState, setLoadingState] = useState<LoadingState>({
    trades: 'idle',
    mindmap: 'idle',
    stats: 'idle',
    trending: 'idle',
  });

  const [essentialData, setEssentialData] = useState<EssentialData | null>(null);
  const [mindmapData] = useState<{ [tokenMint: string]: any }>({});
  
  const retryCountRef = useRef<{ [key: string]: number }>({});
  const cacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get API configuration
  const getApiConfig = useCallback(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    return { apiUrl, headers };
  }, []);

  // Cache utilities
  const getCachedData = useCallback((key: string) => {
    if (!opts.enableCache) return null;
    
    const cached = cacheRef.current.get(key);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > opts.cacheTTL;
    if (isExpired) {
      cacheRef.current.delete(key);
      return null;
    }
    
    return cached.data;
  }, [opts.enableCache, opts.cacheTTL]);

  const setCachedData = useCallback((key: string, data: any) => {
    if (!opts.enableCache) return;
    
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
    });
  }, [opts.enableCache]);

  // Retry logic with exponential backoff and graceful degradation
  const retryRequest = useCallback(async <T>(
    requestFn: () => Promise<T>,
    key: string,
    fallbackData?: T
  ): Promise<T | null> => {
    const maxRetries = opts.maxRetries;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await requestFn();
        retryCountRef.current[key] = 0; // Reset retry count on success
        return result;
      } catch (error) {
        lastError = error as Error;
        retryCountRef.current[key] = attempt + 1;

        // Check if it's a network error
        const isNetworkError = error instanceof Error && 
          (error.message.includes('Network Error') || 
           error.message.includes('ERR_NETWORK') ||
           error.message.includes('Failed to fetch'));

        if (isNetworkError && attempt === 0) {
          console.warn(`🌐 Network error detected for ${key}, will use fallback data if available`);
        }

        if (attempt < maxRetries) {
          const delay = opts.retryDelay * Math.pow(2, attempt); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If all retries failed, return fallback data instead of throwing
    if (fallbackData !== undefined) {
      console.warn(`🔄 Using fallback data for ${key} after ${maxRetries} failed attempts`);
      return fallbackData;
    }

    console.error(`❌ All retries failed for ${key}:`, lastError!.message);
    return null;
  }, [opts.maxRetries, opts.retryDelay]);

  // Update loading state helper
  const updateLoadingState = useCallback((updates: Partial<LoadingState>) => {
    setLoadingState(prev => ({ ...prev, ...updates }));
  }, []);

  // Mock fallback data for when API is unavailable
  const getMockFallbackData = useCallback(() => {
    return {
      trades: [
        {
          id: 'mock-1',
          kol_address: 'demo-kol-1',
          token_mint: 'demo-token-1',
          action: 'buy' as const,
          amount: 1000,
          price: 0.5,
          timestamp: new Date().toISOString(),
          kol_name: 'Demo KOL 1',
          token_symbol: 'DEMO1',
          token_name: 'Demo Token 1',
        },
        {
          id: 'mock-2',
          kol_address: 'demo-kol-2',
          token_mint: 'demo-token-2',
          action: 'sell' as const,
          amount: 500,
          price: 1.2,
          timestamp: new Date().toISOString(),
          kol_name: 'Demo KOL 2',
          token_symbol: 'DEMO2',
          token_name: 'Demo Token 2',
        },
      ],
      stats: {
        totalTrades: 2,
        uniqueKOLs: 2,
        uniqueTokens: 2,
        totalVolume: 1100,
      },
      trendingTokens: ['demo-token-1', 'demo-token-2'],
    };
  }, []);

  // Phase 1: Essential data (< 500ms target)
  const loadEssentialData = useCallback(async (): Promise<void> => {
    // Check if already loaded or loading
    if (loadingState.trades === 'loaded' && loadingState.stats === 'loaded' && loadingState.trending === 'loaded') {
      return;
    }

    // Cancel any existing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const { apiUrl, headers } = getApiConfig();
    
    // Check cache first
    const cachedEssential = getCachedData('essential-data');
    if (cachedEssential) {
      setEssentialData(cachedEssential);
      updateLoadingState({
        trades: 'loaded',
        stats: 'loaded',
        trending: 'loaded',
      });
      return;
    }

    updateLoadingState({
      trades: 'loading',
      stats: 'loading',
      trending: 'loading',
    });

    try {
      // Get mock data as fallback
      const mockData = getMockFallbackData();

      // Parallel API calls for essential data with fallbacks
      const [tradesResult, statsResult, trendingResult] = await Promise.allSettled([
        retryRequest(
          () => axios.get(`${apiUrl}/api/kol-trades/recent?limit=25`, { 
            headers, 
            signal: abortControllerRef.current?.signal as any 
          }),
          'trades',
          { data: { success: true, data: { trades: mockData.trades } } } as any
        ),
        retryRequest(
          () => axios.get(`${apiUrl}/api/kol-trades/stats`, { 
            headers, 
            signal: abortControllerRef.current?.signal as any 
          }),
          'stats',
          { data: { success: true, data: { tradingStats: mockData.stats } } } as any
        ),
        retryRequest(
          () => axios.get(`${apiUrl}/api/kol-trades/trending-tokens?limit=5`, { 
            headers, 
            signal: abortControllerRef.current?.signal as any 
          }),
          'trending',
          { data: { success: true, data: { trendingTokens: mockData.trendingTokens.map(t => ({ tokenMint: t })) } } } as any
        ),
      ]);

      // Process results with graceful fallback handling
      const trades = tradesResult.status === 'fulfilled' && tradesResult.value?.data?.success 
        ? tradesResult.value.data.data?.trades || []
        : tradesResult.status === 'fulfilled' && tradesResult.value === null
        ? [] // API unavailable, will show empty state
        : [];

      const stats = statsResult.status === 'fulfilled' && statsResult.value?.data?.success
        ? statsResult.value.data.data?.tradingStats || {
            totalTrades: 0,
            uniqueKOLs: 0,
            uniqueTokens: 0,
            totalVolume: 0,
          }
        : statsResult.status === 'fulfilled' && statsResult.value === null
        ? {
            totalTrades: 0,
            uniqueKOLs: 0,
            uniqueTokens: 0,
            totalVolume: 0,
          }
        : {
            totalTrades: 0,
            uniqueKOLs: 0,
            uniqueTokens: 0,
            totalVolume: 0,
          };

      const trendingTokens = trendingResult.status === 'fulfilled' && trendingResult.value?.data?.success
        ? (trendingResult.value.data.data?.trendingTokens || []).map((t: any) => t.tokenMint || t)
        : trendingResult.status === 'fulfilled' && trendingResult.value === null
        ? [] // API unavailable
        : [];

      const essential: EssentialData = {
        trades,
        stats,
        trendingTokens,
      };

      // Enrich trades with metadata if missing
      const mintsToEnrich = new Set<string>();
      trades.forEach((trade: any) => {
        const tradeData = trade.tradeData || trade;
        const mint = tradeData.mint || trade.token_mint;
        const name = tradeData.name || trade.token_name;
        const symbol = tradeData.symbol || trade.token_symbol;
        
        if (mint && (!name || !symbol || name === 'Unknown' || symbol === 'N/A')) {
          mintsToEnrich.add(mint);
        }
      });

      if (mintsToEnrich.size > 0) {
        try {
          const metadataMap = await TokenMetadataService.getMultipleTokenMetadata(Array.from(mintsToEnrich));
          trades.forEach((trade: any) => {
            const tradeData = trade.tradeData || trade;
            const mint = tradeData.mint || trade.token_mint;
            if (mint && metadataMap.has(mint)) {
              const metadata = metadataMap.get(mint)!;
              if (trade.tradeData) {
                if (!trade.tradeData.name || trade.tradeData.name === 'Unknown') trade.tradeData.name = metadata.name;
                if (!trade.tradeData.symbol || trade.tradeData.symbol === 'N/A') trade.tradeData.symbol = metadata.symbol;
                if (!trade.tradeData.image) trade.tradeData.image = metadata.image;
              } else {
                if (!trade.token_name || trade.token_name === 'Unknown') trade.token_name = metadata.name;
                if (!trade.token_symbol || trade.token_symbol === 'N/A') trade.token_symbol = metadata.symbol;
                if (!trade.image) trade.image = metadata.image;
              }
            }
          });
        } catch (enrichError) {
          console.warn('Failed to enrich essential trades:', enrichError);
        }
      }

      setEssentialData(essential);
      setCachedData('essential-data', essential);

      // Update loading states based on results (treat null as loaded with empty data)
      updateLoadingState({
        trades: tradesResult.status === 'fulfilled' ? 'loaded' : 'error',
        stats: statsResult.status === 'fulfilled' ? 'loaded' : 'error',
        trending: trendingResult.status === 'fulfilled' ? 'loaded' : 'error',
      });

      // Check if we're in offline/demo mode
      const isOfflineMode = tradesResult.status === 'fulfilled' && tradesResult.value === null;
      if (isOfflineMode) {
        console.warn('🔌 API unavailable - running in offline mode with empty data');
      }

    } catch (error) {
      console.error('Failed to load essential data:', error);
      
      console.error('Essential data loading failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      updateLoadingState({
        trades: 'error',
        stats: 'error',
        trending: 'error',
      });
    }
  }, [loadingState.trades, loadingState.stats, loadingState.trending, getApiConfig, getCachedData, updateLoadingState, getMockFallbackData, retryRequest, setCachedData]);

  // Phase 2: Enhanced data (< 2s target)
  // NOTE: Mindmap data is now handled by use-kol-trade-socket hook
  const loadEnhancedData = useCallback(async (): Promise<void> => {
    if (!essentialData?.trendingTokens.length) {
      return;
    }

    if (loadingState.mindmap === 'loaded') {
      return;
    }

    // Mark mindmap as loaded since it's handled by the socket hook
    updateLoadingState({ mindmap: 'loaded' });
  }, [essentialData, loadingState.mindmap, updateLoadingState]);

  // Phase 3: Background data
  // NOTE: All mindmap data is now handled by use-kol-trade-socket hook
  const loadBackgroundData = useCallback(async (): Promise<void> => {
    if (!essentialData?.trendingTokens.length) {
      return;
    }

    // Background phase is complete since mindmap is handled by socket hook
  }, [essentialData]);

  // Check if phase is complete
  const isPhaseComplete = useCallback((phase: 'essential' | 'enhanced' | 'background'): boolean => {
    switch (phase) {
      case 'essential':
        return loadingState.trades === 'loaded' && 
               loadingState.stats === 'loaded' && 
               loadingState.trending === 'loaded';
      case 'enhanced':
        // Enhanced phase is complete when essential is done (mindmap handled by socket)
        return isPhaseComplete('essential') && loadingState.mindmap === 'loaded';
      case 'background':
        // Background phase is complete when enhanced is done (no additional work needed)
        return isPhaseComplete('enhanced');
      default:
        return false;
    }
  }, [loadingState]);

  // Retry failed requests
  const retryFailedRequests = useCallback(async (): Promise<void> => {
    const hasErrors = Object.values(loadingState).some(state => state === 'error');
    if (!hasErrors) return;

    // Reset retry counts
    retryCountRef.current = {};

    // Retry essential data if any failed
    if (loadingState.trades === 'error' || loadingState.stats === 'error' || loadingState.trending === 'error') {
      await loadEssentialData();
    }

    // Retry enhanced data if failed
    if (loadingState.mindmap === 'error') {
      await loadEnhancedData();
    }
  }, [loadingState, loadEssentialData, loadEnhancedData]);

  // Clear cache
  const clearCache = useCallback((): void => {
    cacheRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    loadingState,
    essentialData,
    mindmapData,
    isPhaseComplete,
    loadEssentialData,
    loadEnhancedData,
    loadBackgroundData,
    retryFailedRequests,
    clearCache,
  };
};