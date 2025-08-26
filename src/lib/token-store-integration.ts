/**
 * Token Store Integration Utilities for Mindmap Enhancement
 * Implements token metadata fetching, caching, and fallback logic
 */

import { 
  TokenMetadata, 
  SearchTokenResult,
  CacheEntry 
} from '../types';
import { useTokenStore } from '../stores/use-token-store';
import { MINDMAP_FILTER_CONFIG } from './constants';

/**
 * Token Store Integration Manager
 * Handles fetching token metadata from useTokenStore with intelligent caching
 */
export class TokenStoreIntegrationManager {
  private cache = new Map<string, CacheEntry<TokenMetadata>>();
  private stats = {
    hits: 0,
    misses: 0,
    storeHits: 0,
    storeMisses: 0,
    fallbacks: 0,
    errors: 0
  };

  constructor(
    private maxCacheSize: number = MINDMAP_FILTER_CONFIG.METADATA_CACHE_MAX_SIZE,
    private defaultTTL: number = MINDMAP_FILTER_CONFIG.METADATA_CACHE_TTL
  ) {
    this.setupPeriodicCleanup();
  }

  /**
   * Fetches token metadata with caching and fallback logic
   * @param mint - Token mint address
   * @param tokenStore - Token store instance from useTokenStore
   * @returns Token metadata or null if not available
   */
  async fetchTokenMetadata(
    mint: string, 
    tokenStore?: ReturnType<typeof useTokenStore>
  ): Promise<TokenMetadata | null> {
    try {
      // Step 1: Check cache first
      const cached = this.getCachedMetadata(mint);
      if (cached) {
        this.stats.hits++;
        return cached;
      }

      this.stats.misses++;

      // Step 2: Try to get from token store
      if (tokenStore) {
        try {
          const storeToken = this.getTokenFromStore(mint, tokenStore);
          if (storeToken) {
            this.stats.storeHits++;
            const metadata = this.enrichTokenWithStoreData(storeToken);
            this.cacheMetadata(mint, metadata);
            return metadata;
          }
        } catch (storeError) {
          console.error(`Error getting token ${mint} from store:`, storeError);
          this.stats.errors++;
        }
      }

      this.stats.storeMisses++;

      // Step 3: Fallback to minimal metadata
      const fallbackMetadata = this.createFallbackMetadata(mint);
      this.stats.fallbacks++;
      this.cacheMetadata(mint, fallbackMetadata, MINDMAP_FILTER_CONFIG.FALLBACK_CACHE_TTL);
      
      return fallbackMetadata;

    } catch (error) {
      console.error(`Error fetching token metadata for ${mint}:`, error);
      this.stats.errors++;
      
      // Return fallback metadata even on error
      const fallbackMetadata = this.createFallbackMetadata(mint);
      this.cacheMetadata(mint, fallbackMetadata, MINDMAP_FILTER_CONFIG.FALLBACK_CACHE_TTL);
      
      return fallbackMetadata;
    }
  }

  /**
   * Batch fetches token metadata for multiple mints
   * @param mints - Array of token mint addresses
   * @param tokenStore - Token store instance from useTokenStore
   * @returns Map of mint -> metadata
   */
  async batchFetchTokenMetadata(
    mints: string[],
    tokenStore?: ReturnType<typeof useTokenStore>
  ): Promise<Map<string, TokenMetadata>> {
    const results = new Map<string, TokenMetadata>();
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < mints.length; i += batchSize) {
      const batch = mints.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (mint) => {
        const metadata = await this.fetchTokenMetadata(mint, tokenStore);
        if (metadata) {
          results.set(mint, metadata);
        }
      });
      
      await Promise.all(batchPromises);
      
      // Small delay between batches
      if (i + batchSize < mints.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return results;
  }

  /**
   * Gets token from store using various methods
   * @param mint - Token mint address
   * @param tokenStore - Token store instance
   * @returns Token data from store or null
   */
  private getTokenFromStore(
    mint: string, 
    tokenStore: ReturnType<typeof useTokenStore>
  ): SearchTokenResult | null {
    // Method 1: Try getTokenByMint if available
    if (tokenStore.getTokenByMint) {
      const token = tokenStore.getTokenByMint(mint);
      if (token) return token;
    }

    // Method 2: Check in trending tokens
    const trendingToken = tokenStore.trendingTokens?.find(t => t.mint === mint);
    if (trendingToken) return trendingToken;

    // Method 3: Check in high volume tokens
    const volumeToken = tokenStore.highVolumeTokens?.find(t => t.mint === mint);
    if (volumeToken) return volumeToken;

    // Method 4: Check in latest tokens
    const latestToken = tokenStore.latestTokens?.find(t => t.mint === mint);
    if (latestToken) return latestToken;

    // Method 5: Check in search results
    const searchToken = tokenStore.searchResults?.find(t => t.mint === mint);
    if (searchToken) return searchToken;

    return null;
  }

  /**
   * Enriches token data from store into TokenMetadata format
   * @param tokenData - Raw token data from store
   * @returns Enriched token metadata
   */
  private enrichTokenWithStoreData(tokenData: SearchTokenResult): TokenMetadata {
    return {
      name: tokenData.name,
      symbol: tokenData.symbol,
      image: tokenData.image || tokenData.logoURI,
      fallbackImage: this.generateFallbackImage(tokenData.symbol || tokenData.name),
      lastUpdated: Date.now(),
      decimals: tokenData.decimals,
      holders: tokenData.holders,
      verified: tokenData.verified,
      jupiter: tokenData.jupiter,
      liquidityUsd: tokenData.liquidityUsd,
      marketCapUsd: tokenData.marketCapUsd,
      priceUsd: tokenData.priceUsd
    };
  }

  /**
   * Creates fallback metadata for tokens not found in store
   * @param mint - Token mint address
   * @returns Minimal token metadata
   */
  private createFallbackMetadata(mint: string): TokenMetadata {
    return {
      name: undefined,
      symbol: undefined,
      image: undefined,
      fallbackImage: this.generateFallbackImage(mint),
      lastUpdated: Date.now(),
      decimals: 9, // Default Solana token decimals
      holders: undefined,
      verified: false,
      jupiter: false,
      liquidityUsd: undefined,
      marketCapUsd: undefined,
      priceUsd: undefined
    };
  }

  /**
   * Generates a fallback image URL for tokens
   * @param identifier - Token symbol, name, or mint address
   * @returns Fallback image URL
   */
  private generateFallbackImage(identifier?: string): string {
    if (!identifier) {
      return 'https://api.dicebear.com/7.x/shapes/svg?seed=unknown&backgroundColor=14F195,9945FF';
    }
    
    // Clean identifier for consistent generation
    const cleanId = identifier.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'token';
    return `https://api.dicebear.com/7.x/shapes/svg?seed=${cleanId}&backgroundColor=14F195,9945FF`;
  }

  /**
   * Gets cached metadata if available and not expired
   * @param mint - Token mint address
   * @returns Cached metadata or null
   */
  private getCachedMetadata(mint: string): TokenMetadata | null {
    const entry = this.cache.get(mint);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(mint);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    return entry.data;
  }

  /**
   * Caches token metadata with TTL
   * @param mint - Token mint address
   * @param metadata - Token metadata to cache
   * @param customTTL - Custom TTL in milliseconds
   */
  private cacheMetadata(mint: string, metadata: TokenMetadata, customTTL?: number): void {
    const ttl = customTTL || this.defaultTTL;
    const entry: CacheEntry<TokenMetadata> = {
      data: { ...metadata, lastUpdated: Date.now() },
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessed: Date.now()
    };

    // Ensure cache size limit
    this.ensureCacheSize();
    
    this.cache.set(mint, entry);
  }

  /**
   * Checks if a cache entry is expired
   * @param entry - Cache entry to check
   * @returns True if expired
   */
  private isExpired(entry: CacheEntry<TokenMetadata>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Ensures cache doesn't exceed maximum size using LRU eviction
   */
  private ensureCacheSize(): void {
    while (this.cache.size >= this.maxCacheSize) {
      // Find least recently used entry
      let lruKey: string | null = null;
      let lruTime = Date.now();
      
      Array.from(this.cache.entries()).forEach(([key, entry]) => {
        if (entry.lastAccessed < lruTime) {
          lruTime = entry.lastAccessed;
          lruKey = key;
        }
      });
      
      if (lruKey) {
        this.cache.delete(lruKey);
      } else {
        // Fallback: remove first entry if no LRU found
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
        }
        break;
      }
    }
  }

  /**
   * Sets up periodic cleanup of expired entries
   */
  private setupPeriodicCleanup(): void {
    setInterval(() => {
      this.clearExpiredEntries();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Clears expired cache entries
   */
  private clearExpiredEntries(): void {
    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Invalidates cache entry for a specific mint
   * @param mint - Token mint address to invalidate
   */
  invalidateCache(mint: string): void {
    this.cache.delete(mint);
  }

  /**
   * Clears all cached data
   */
  clearAllCache(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      storeHits: 0,
      storeMisses: 0,
      fallbacks: 0,
      errors: 0
    };
  }

  /**
   * Gets cache and integration statistics
   * @returns Statistics object
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    
    return {
      cache: {
        size: this.cache.size,
        maxSize: this.maxCacheSize,
        hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
        missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0
      },
      store: {
        hitRate: (this.stats.storeHits + this.stats.storeMisses) > 0 ? 
          this.stats.storeHits / (this.stats.storeHits + this.stats.storeMisses) : 0,
        hits: this.stats.storeHits,
        misses: this.stats.storeMisses
      },
      fallbacks: this.stats.fallbacks,
      errors: this.stats.errors,
      totalRequests
    };
  }

  /**
   * Gets detailed cache information for debugging
   */
  getDetailedCacheInfo() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        mint: key.slice(0, 8) + '...',
        age: Date.now() - entry.timestamp,
        ttl: entry.ttl,
        accessCount: entry.accessCount,
        isExpired: this.isExpired(entry),
        hasName: !!entry.data.name,
        hasSymbol: !!entry.data.symbol,
        hasImage: !!entry.data.image
      })),
      stats: this.stats
    };
  }
}

// Export singleton instance
export const tokenStoreIntegrationManager = new TokenStoreIntegrationManager();

/**
 * Hook-based utility functions for React components
 */

/**
 * Fetches token metadata using the current token store
 * @param mint - Token mint address
 * @returns Promise resolving to token metadata
 */
export const useTokenMetadata = () => {
  const tokenStore = useTokenStore();
  
  return {
    fetchTokenMetadata: (mint: string) => 
      tokenStoreIntegrationManager.fetchTokenMetadata(mint, tokenStore),
    
    batchFetchTokenMetadata: (mints: string[]) =>
      tokenStoreIntegrationManager.batchFetchTokenMetadata(mints, tokenStore),
    
    invalidateCache: (mint: string) =>
      tokenStoreIntegrationManager.invalidateCache(mint),
    
    getStats: () => tokenStoreIntegrationManager.getStats(),
    
    getCacheInfo: () => tokenStoreIntegrationManager.getDetailedCacheInfo()
  };
};

/**
 * Utility function to enrich mindmap data with token metadata
 * @param mindmapData - Raw mindmap data
 * @param tokenStore - Token store instance
 * @returns Promise resolving to enriched mindmap data
 */
export const enrichMindmapWithTokenMetadata = async (
  mindmapData: { [tokenMint: string]: any },
  tokenStore?: ReturnType<typeof useTokenStore>
): Promise<{ [tokenMint: string]: any }> => {
  const enrichedData = { ...mindmapData };
  const tokenMints = Object.keys(mindmapData);
  
  // Batch fetch metadata for all tokens
  const metadataMap = await tokenStoreIntegrationManager.batchFetchTokenMetadata(
    tokenMints, 
    tokenStore
  );
  
  // Enrich each token's data with metadata
  tokenMints.forEach(mint => {
    const metadata = metadataMap.get(mint);
    if (metadata && enrichedData[mint]) {
      enrichedData[mint] = {
        ...enrichedData[mint],
        tokenMetadata: metadata,
        // Add display properties for easy access
        displayName: metadata.name ? 
          (metadata.symbol ? `${metadata.name} (${metadata.symbol})` : metadata.name) :
          (metadata.symbol || `${mint.slice(0, 6)}...`),
        displayImage: metadata.image || metadata.fallbackImage
      };
    }
  });
  
  return enrichedData;
};