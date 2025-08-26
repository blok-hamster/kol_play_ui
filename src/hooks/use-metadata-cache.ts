/**
 * React Hook for Metadata Cache Integration
 * 
 * Provides easy access to metadata caching functionality for React components,
 * with automatic cache sharing and performance optimization.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  TokenMetadata, 
  KOLMetadata, 
  metadataCacheManager 
} from '@/lib/metadata-cache-manager';
import { 
  TokenStoreIntegration, 
  KOLStoreIntegration, 
  MetadataIntegration 
} from '@/lib/metadata-store-integration';
import { 
  CacheSharing, 
  cacheOptimizationManager 
} from '@/lib/cache-optimization';

// Hook interfaces
export interface UseMetadataCacheOptions {
  enableSharing?: boolean;
  enableOptimization?: boolean;
  preloadOnMount?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface MetadataCacheState {
  tokenMetadata: Map<string, TokenMetadata>;
  kolMetadata: Map<string, KOLMetadata>;
  isLoading: boolean;
  error: string | null;
  stats: any;
}

export interface MetadataCacheActions {
  getTokenMetadata: (mint: string) => Promise<TokenMetadata | null>;
  getKOLMetadata: (walletAddress: string) => Promise<KOLMetadata | null>;
  batchGetTokenMetadata: (mints: string[]) => Promise<Map<string, TokenMetadata>>;
  batchGetKOLMetadata: (addresses: string[]) => Promise<Map<string, KOLMetadata>>;
  preloadMindmapMetadata: (mindmapData: any) => Promise<void>;
  clearCache: (type?: 'token' | 'kol') => void;
  refreshMetadata: () => Promise<void>;
  optimizeCache: () => void;
}

/**
 * Main metadata cache hook
 */
export function useMetadataCache(
  options: UseMetadataCacheOptions = {}
): MetadataCacheState & MetadataCacheActions {
  const {
    enableSharing = true,
    enableOptimization = true,
    preloadOnMount = false,
    autoRefresh = false,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
  } = options;

  const [state, setState] = useState<MetadataCacheState>({
    tokenMetadata: new Map(),
    kolMetadata: new Map(),
    isLoading: false,
    error: null,
    stats: null,
  });

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Update state safely
  const updateState = useCallback((updates: Partial<MetadataCacheState>) => {
    if (mountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  // Get token metadata
  const getTokenMetadata = useCallback(async (mint: string): Promise<TokenMetadata | null> => {
    if (!mint) return null;

    try {
      updateState({ isLoading: true, error: null });
      
      const metadata = await TokenStoreIntegration.getTokenMetadata(mint);
      
      if (metadata && enableSharing) {
        CacheSharing.shareData(`token_${mint}`, metadata);
      }
      
      return metadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get token metadata';
      updateState({ error: errorMessage });
      return null;
    } finally {
      updateState({ isLoading: false });
    }
  }, [enableSharing, updateState]);

  // Get KOL metadata
  const getKOLMetadata = useCallback(async (walletAddress: string): Promise<KOLMetadata | null> => {
    if (!walletAddress) return null;

    try {
      updateState({ isLoading: true, error: null });
      
      const metadata = await KOLStoreIntegration.getKOLMetadata(walletAddress);
      
      if (metadata && enableSharing) {
        CacheSharing.shareData(`kol_${walletAddress.toLowerCase()}`, metadata);
      }
      
      return metadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get KOL metadata';
      updateState({ error: errorMessage });
      return null;
    } finally {
      updateState({ isLoading: false });
    }
  }, [enableSharing, updateState]);

  // Batch get token metadata
  const batchGetTokenMetadata = useCallback(async (mints: string[]): Promise<Map<string, TokenMetadata>> => {
    if (!mints.length) return new Map();

    try {
      updateState({ isLoading: true, error: null });
      
      const metadata = await TokenStoreIntegration.batchGetTokenMetadata(mints);
      
      if (enableSharing) {
        metadata.forEach((data, mint) => {
          CacheSharing.shareData(`token_${mint}`, data);
        });
      }
      
      updateState({ tokenMetadata: metadata });
      return metadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to batch get token metadata';
      updateState({ error: errorMessage });
      return new Map();
    } finally {
      updateState({ isLoading: false });
    }
  }, [enableSharing, updateState]);

  // Batch get KOL metadata
  const batchGetKOLMetadata = useCallback(async (addresses: string[]): Promise<Map<string, KOLMetadata>> => {
    if (!addresses.length) return new Map();

    try {
      updateState({ isLoading: true, error: null });
      
      const metadata = await KOLStoreIntegration.batchGetKOLMetadata(addresses);
      
      if (enableSharing) {
        metadata.forEach((data, address) => {
          CacheSharing.shareData(`kol_${address}`, data);
        });
      }
      
      updateState({ kolMetadata: metadata });
      return metadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to batch get KOL metadata';
      updateState({ error: errorMessage });
      return new Map();
    } finally {
      updateState({ isLoading: false });
    }
  }, [enableSharing, updateState]);

  // Preload mindmap metadata
  const preloadMindmapMetadata = useCallback(async (mindmapData: any): Promise<void> => {
    try {
      updateState({ isLoading: true, error: null });
      
      const { tokenMetadata, kolMetadata } = await MetadataIntegration.preloadMindmapMetadata(mindmapData);
      
      if (enableSharing) {
        tokenMetadata.forEach((data, mint) => {
          CacheSharing.shareData(`token_${mint}`, data);
        });
        kolMetadata.forEach((data, address) => {
          CacheSharing.shareData(`kol_${address}`, data);
        });
      }
      
      updateState({ tokenMetadata, kolMetadata });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to preload mindmap metadata';
      updateState({ error: errorMessage });
    } finally {
      updateState({ isLoading: false });
    }
  }, [enableSharing, updateState]);

  // Clear cache
  const clearCache = useCallback((type?: 'token' | 'kol') => {
    metadataCacheManager.invalidateMetadataCache(type);
    
    if (enableSharing) {
      if (type === 'token') {
        // Clear shared token data
        state.tokenMetadata.forEach((_, mint) => {
          CacheSharing.clearSharedData(`token_${mint}`);
        });
      } else if (type === 'kol') {
        // Clear shared KOL data
        state.kolMetadata.forEach((_, address) => {
          CacheSharing.clearSharedData(`kol_${address}`);
        });
      } else {
        // Clear all shared data
        CacheSharing.clearSharedData();
      }
    }
    
    updateState({
      tokenMetadata: type === 'kol' ? state.tokenMetadata : new Map(),
      kolMetadata: type === 'token' ? state.kolMetadata : new Map(),
      error: null,
    });
  }, [enableSharing, state.tokenMetadata, state.kolMetadata, updateState]);

  // Refresh metadata
  const refreshMetadata = useCallback(async () => {
    try {
      updateState({ isLoading: true, error: null });
      
      // Clear cache and reload
      clearCache();
      
      // Get fresh stats
      const stats = MetadataIntegration.getMetadataStatistics();
      updateState({ stats });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh metadata';
      updateState({ error: errorMessage });
    } finally {
      updateState({ isLoading: false });
    }
  }, [clearCache, updateState]);

  // Optimize cache
  const optimizeCache = useCallback(() => {
    if (enableOptimization) {
      cacheOptimizationManager.optimizeCache();
      
      // Update stats after optimization
      const stats = MetadataIntegration.getMetadataStatistics();
      updateState({ stats });
    }
  }, [enableOptimization, updateState]);

  // Set up auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        refreshMetadata();
      }, refreshInterval);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, refreshMetadata]);

  // Set up memory pressure handling
  useEffect(() => {
    if (enableOptimization) {
      const handleMemoryPressure = () => {
        console.log('Memory pressure detected, optimizing cache...');
        optimizeCache();
      };

      cacheOptimizationManager.onMemoryPressure(handleMemoryPressure);

      return () => {
        cacheOptimizationManager.offMemoryPressure(handleMemoryPressure);
      };
    }
  }, [enableOptimization, optimizeCache]);

  // Preload on mount if requested
  useEffect(() => {
    if (preloadOnMount) {
      const stats = MetadataIntegration.getMetadataStatistics();
      updateState({ stats });
    }
  }, [preloadOnMount, updateState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  return {
    ...state,
    getTokenMetadata,
    getKOLMetadata,
    batchGetTokenMetadata,
    batchGetKOLMetadata,
    preloadMindmapMetadata,
    clearCache,
    refreshMetadata,
    optimizeCache,
  };
}

/**
 * Hook for token metadata only
 */
export function useTokenMetadata(mints: string[] = [], options: UseMetadataCacheOptions = {}) {
  const cache = useMetadataCache(options);
  const [tokenData, setTokenData] = useState<Map<string, TokenMetadata>>(new Map());

  useEffect(() => {
    if (mints.length > 0) {
      cache.batchGetTokenMetadata(mints).then(setTokenData);
    }
  }, [mints.join(','), cache]);

  return {
    tokenData,
    isLoading: cache.isLoading,
    error: cache.error,
    getTokenMetadata: cache.getTokenMetadata,
    refreshTokens: () => cache.batchGetTokenMetadata(mints).then(setTokenData),
  };
}

/**
 * Hook for KOL metadata only
 */
export function useKOLMetadata(addresses: string[] = [], options: UseMetadataCacheOptions = {}) {
  const cache = useMetadataCache(options);
  const [kolData, setKOLData] = useState<Map<string, KOLMetadata>>(new Map());

  useEffect(() => {
    if (addresses.length > 0) {
      cache.batchGetKOLMetadata(addresses).then(setKOLData);
    }
  }, [addresses.join(','), cache]);

  return {
    kolData,
    isLoading: cache.isLoading,
    error: cache.error,
    getKOLMetadata: cache.getKOLMetadata,
    refreshKOLs: () => cache.batchGetKOLMetadata(addresses).then(setKOLData),
  };
}

/**
 * Hook for cache performance monitoring
 */
export function useCachePerformance() {
  const [metrics, setMetrics] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    const interval = setInterval(() => {
      const currentMetrics = cacheOptimizationManager.getCachePerformanceMetrics();
      setMetrics(currentMetrics);
    }, 5000); // Update every 5 seconds

    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
    };
  }, []);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    setMetrics(null);
  }, []);

  return {
    metrics,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
  };
}