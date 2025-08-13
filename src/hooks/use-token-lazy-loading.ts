import { useState, useCallback, useRef, useEffect } from 'react';
import { TokenService } from '@/services';
import type { GetTokenResponse } from '@/types';

interface UseTokenLazyLoadingOptions {
  batchSize?: number;
  maxConcurrentBatches?: number;
  cacheEnabled?: boolean;
  onProgress?: (loaded: number, total: number, currentBatch: number, totalBatches: number) => void;
  onError?: (error: Error) => void;
}

interface UseTokenLazyLoadingResult {
  tokens: Map<string, GetTokenResponse>;
  loading: boolean;
  error: string | null;
  progress: {
    loaded: number;
    total: number;
    percentage: number;
    currentBatch: number;
    totalBatches: number;
  };
  loadTokens: (mintAddresses: string[]) => Promise<void>;
  getToken: (mintAddress: string) => GetTokenResponse | undefined;
  clearCache: () => void;
  cancel: () => void;
}

// Global cache for token details
const tokenCache = new Map<string, GetTokenResponse>();
const cacheTimestamps = new Map<string, number>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useTokenLazyLoading(options: UseTokenLazyLoadingOptions = {}): UseTokenLazyLoadingResult {
  const {
    batchSize = 20,
    maxConcurrentBatches = 3,
    cacheEnabled = true,
    onProgress,
    onError
  } = options;

  const [tokens, setTokens] = useState<Map<string, GetTokenResponse>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({
    loaded: 0,
    total: 0,
    percentage: 0,
    currentBatch: 0,
    totalBatches: 0
  });

  const cancelRef = useRef(false);
  const loadingRef = useRef(false);

  // Check if cached token is still valid
  const isCacheValid = useCallback((mintAddress: string): boolean => {
    if (!cacheEnabled) return false;
    
    const timestamp = cacheTimestamps.get(mintAddress);
    if (!timestamp) return false;
    
    return (Date.now() - timestamp) < CACHE_DURATION;
  }, [cacheEnabled]);

  // Get token from cache or current state
  const getToken = useCallback((mintAddress: string): GetTokenResponse | undefined => {
    // First check current state
    const stateToken = tokens.get(mintAddress);
    if (stateToken) return stateToken;

    // Then check global cache if enabled and valid
    if (cacheEnabled && isCacheValid(mintAddress)) {
      return tokenCache.get(mintAddress);
    }

    return undefined;
  }, [tokens, cacheEnabled, isCacheValid]);

  // Load tokens with lazy loading
  const loadTokens = useCallback(async (mintAddresses: string[]) => {
    if (loadingRef.current) {
      console.warn('Token loading already in progress');
      return;
    }

    if (mintAddresses.length === 0) {
      return;
    }

    loadingRef.current = true;
    cancelRef.current = false;
    setLoading(true);
    setError(null);

    try {
      // Filter out tokens we already have (from cache or current state)
      const tokensToLoad = mintAddresses.filter(mint => {
        const existing = getToken(mint);
        return !existing;
      });

      if (tokensToLoad.length === 0) {
        console.log('All requested tokens are already loaded');
        setLoading(false);
        loadingRef.current = false;
        return;
      }

      console.log(`Loading ${tokensToLoad.length} new tokens out of ${mintAddresses.length} requested`);

      const totalBatches = Math.ceil(tokensToLoad.length / batchSize);
      let loadedCount = 0;

      setProgress({
        loaded: 0,
        total: tokensToLoad.length,
        percentage: 0,
        currentBatch: 0,
        totalBatches
      });

      const response = await TokenService.getMultipleTokens(tokensToLoad, {
        batchSize,
        maxConcurrentBatches,
        onBatchComplete: (batch, batchIndex, totalBatches) => {
          if (cancelRef.current) return;

          loadedCount += batch.length;
          const percentage = Math.round((loadedCount / tokensToLoad.length) * 100);

          setProgress({
            loaded: loadedCount,
            total: tokensToLoad.length,
            percentage,
            currentBatch: batchIndex + 1,
            totalBatches
          });

          // Update state with new tokens
          setTokens(prev => {
            const newTokens = new Map(prev);
            batch.forEach(token => {
              if (token.mint || token.token?.mint) {
                const mintAddress = token.mint || token.token?.mint || '';
                newTokens.set(mintAddress, token);
                
                // Update global cache if enabled
                if (cacheEnabled) {
                  tokenCache.set(mintAddress, token);
                  cacheTimestamps.set(mintAddress, Date.now());
                }
              }
            });
            return newTokens;
          });

          // Call progress callback
          if (onProgress) {
            onProgress(loadedCount, tokensToLoad.length, batchIndex + 1, totalBatches);
          }
        }
      });

      if (!cancelRef.current) {
        console.log(`✅ Successfully loaded ${response.data.length} tokens`);
        
        // Final state update with all tokens
        setTokens(prev => {
          const newTokens = new Map(prev);
          response.data.forEach(token => {
            if (token.mint || token.token?.mint) {
              const mintAddress = token.mint || token.token?.mint || '';
              newTokens.set(mintAddress, token);
              
              // Update global cache if enabled
              if (cacheEnabled) {
                tokenCache.set(mintAddress, token);
                cacheTimestamps.set(mintAddress, Date.now());
              }
            }
          });
          return newTokens;
        });

        setProgress(prev => ({
          ...prev,
          loaded: tokensToLoad.length,
          percentage: 100
        }));
      }

    } catch (err: any) {
      if (!cancelRef.current) {
        const errorMessage = err.message || 'Failed to load tokens';
        setError(errorMessage);
        console.error('Error loading tokens:', err);
        
        if (onError) {
          onError(err);
        }
      }
    } finally {
      if (!cancelRef.current) {
        setLoading(false);
      }
      loadingRef.current = false;
    }
  }, [batchSize, maxConcurrentBatches, cacheEnabled, getToken, onProgress, onError]);

  // Cancel current loading operation
  const cancel = useCallback(() => {
    cancelRef.current = true;
    setLoading(false);
    loadingRef.current = false;
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    tokenCache.clear();
    cacheTimestamps.clear();
    setTokens(new Map());
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    tokens,
    loading,
    error,
    progress,
    loadTokens,
    getToken,
    clearCache,
    cancel
  };
} 