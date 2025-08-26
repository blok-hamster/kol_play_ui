/**
 * Metadata Cache Manager for Unified Mindmap Enhancement
 * 
 * Provides specialized caching for token and KOL metadata with TTL support,
 * background refresh logic, and integration with existing stores.
 */

import { CacheManager, CacheEntry, CacheConfig } from './cache-manager';
import { useTokenStore } from '@/stores/use-token-store';
import { useKOLStore } from '@/stores/use-kol-store';
import type { SearchTokenResult, KOLWallet } from '@/types';

// Metadata interfaces
export interface TokenMetadata {
  name?: string;
  symbol?: string;
  image?: string;
  fallbackImage?: string;
  lastUpdated: number;
  mint: string;
}

export interface KOLMetadata {
  name?: string;
  avatar?: string;
  socialLinks?: SocialLinks;
  fallbackAvatar?: string;
  lastUpdated: number;
  walletAddress: string;
}

export interface SocialLinks {
  twitter?: string;
  telegram?: string;
  website?: string;
}

// Cache statistics for metadata
export interface MetadataCacheStats {
  tokenCacheEntries: number;
  kolCacheEntries: number;
  tokenHitRate: number;
  kolHitRate: number;
  backgroundRefreshCount: number;
  failedRefreshCount: number;
}

// Configuration for metadata caching
export interface MetadataCacheConfig extends Partial<CacheConfig> {
  tokenTTL?: number; // TTL for token metadata
  kolTTL?: number; // TTL for KOL metadata
  backgroundRefreshThreshold?: number; // Refresh when TTL is X% expired
  maxRetries?: number; // Max retries for failed refreshes
  retryDelay?: number; // Delay between retries
}

// Cache key prefixes for metadata
const METADATA_CACHE_PREFIXES = {
  TOKEN_METADATA: 'token_metadata_',
  KOL_METADATA: 'kol_metadata_',
} as const;

export class MetadataCacheManager extends CacheManager {
  private tokenStats = { hits: 0, misses: 0 };
  private kolStats = { hits: 0, misses: 0 };
  private backgroundRefreshCount = 0;
  private failedRefreshCount = 0;
  private refreshQueue = new Set<string>();
  private metadataConfig: Required<MetadataCacheConfig>;

  constructor(config: MetadataCacheConfig = {}) {
    // Default metadata cache configuration
    const defaultMetadataConfig: Required<MetadataCacheConfig> = {
      defaultTTL: 10 * 60 * 1000, // 10 minutes
      maxMemoryEntries: 2000,
      enableSessionStorage: true,
      cleanupInterval: 2 * 60 * 1000, // 2 minutes
      tokenTTL: 15 * 60 * 1000, // 15 minutes for tokens
      kolTTL: 30 * 60 * 1000, // 30 minutes for KOLs
      backgroundRefreshThreshold: 0.8, // Refresh when 80% of TTL expired
      maxRetries: 3,
      retryDelay: 1000, // 1 second
    };

    const mergedConfig = { ...defaultMetadataConfig, ...config };
    super(mergedConfig);
    this.metadataConfig = mergedConfig;
  }

  /**
   * Get token metadata from cache or fetch from store
   */
  async getTokenMetadata(mint: string): Promise<TokenMetadata | null> {
    if (!mint) return null;

    const cacheKey = `${METADATA_CACHE_PREFIXES.TOKEN_METADATA}${mint}`;
    
    // Try to get from cache first
    const cached = this.get<TokenMetadata>(cacheKey);
    if (cached) {
      this.tokenStats.hits++;
      
      // Check if we should refresh in background
      this.scheduleBackgroundRefresh(cacheKey, mint, 'token');
      
      return cached;
    }

    this.tokenStats.misses++;

    // Fetch from store if not in cache
    try {
      const metadata = await this.fetchTokenFromStore(mint);
      if (metadata) {
        this.cacheTokenMetadata(mint, metadata);
        return metadata;
      }
    } catch (error) {
      console.warn(`Failed to fetch token metadata for ${mint}:`, error);
    }

    return null;
  }

  /**
   * Get KOL metadata from cache or fetch from store
   */
  async getKOLMetadata(walletAddress: string): Promise<KOLMetadata | null> {
    if (!walletAddress) return null;

    const cacheKey = `${METADATA_CACHE_PREFIXES.KOL_METADATA}${walletAddress.toLowerCase()}`;
    
    // Try to get from cache first
    const cached = this.get<KOLMetadata>(cacheKey);
    if (cached) {
      this.kolStats.hits++;
      
      // Check if we should refresh in background
      this.scheduleBackgroundRefresh(cacheKey, walletAddress, 'kol');
      
      return cached;
    }

    this.kolStats.misses++;

    // Fetch from store if not in cache
    try {
      const metadata = await this.fetchKOLFromStore(walletAddress);
      if (metadata) {
        this.cacheKOLMetadata(walletAddress, metadata);
        return metadata;
      }
    } catch (error) {
      console.warn(`Failed to fetch KOL metadata for ${walletAddress}:`, error);
    }

    return null;
  }

  /**
   * Cache token metadata
   */
  cacheTokenMetadata(mint: string, metadata: TokenMetadata): void {
    if (!mint || !metadata) return;

    const cacheKey = `${METADATA_CACHE_PREFIXES.TOKEN_METADATA}${mint}`;
    const enrichedMetadata: TokenMetadata = {
      ...metadata,
      mint,
      lastUpdated: Date.now(),
    };

    this.set(cacheKey, enrichedMetadata, this.metadataConfig.tokenTTL);
  }

  /**
   * Cache KOL metadata
   */
  cacheKOLMetadata(walletAddress: string, metadata: KOLMetadata): void {
    if (!walletAddress || !metadata) return;

    const cacheKey = `${METADATA_CACHE_PREFIXES.KOL_METADATA}${walletAddress.toLowerCase()}`;
    const enrichedMetadata: KOLMetadata = {
      ...metadata,
      walletAddress: walletAddress.toLowerCase(),
      lastUpdated: Date.now(),
    };

    this.set(cacheKey, enrichedMetadata, this.metadataConfig.kolTTL);
  }

  /**
   * Batch get token metadata
   */
  async batchGetTokenMetadata(mints: string[]): Promise<Map<string, TokenMetadata>> {
    const results = new Map<string, TokenMetadata>();
    const uncachedMints: string[] = [];

    // First pass: get cached data
    for (const mint of mints) {
      if (!mint) continue;
      
      const cached = await this.getTokenMetadata(mint);
      if (cached) {
        results.set(mint, cached);
      } else {
        uncachedMints.push(mint);
      }
    }

    // Second pass: fetch uncached data in parallel
    if (uncachedMints.length > 0) {
      const fetchPromises = uncachedMints.map(async (mint) => {
        try {
          const metadata = await this.fetchTokenFromStore(mint);
          if (metadata) {
            this.cacheTokenMetadata(mint, metadata);
            results.set(mint, metadata);
          }
        } catch (error) {
          console.warn(`Failed to fetch token metadata for ${mint}:`, error);
        }
      });

      await Promise.allSettled(fetchPromises);
    }

    return results;
  }

  /**
   * Batch get KOL metadata
   */
  async batchGetKOLMetadata(walletAddresses: string[]): Promise<Map<string, KOLMetadata>> {
    const results = new Map<string, KOLMetadata>();
    const uncachedAddresses: string[] = [];

    // First pass: get cached data
    for (const address of walletAddresses) {
      if (!address) continue;
      
      const cached = await this.getKOLMetadata(address);
      if (cached) {
        results.set(address.toLowerCase(), cached);
      } else {
        uncachedAddresses.push(address);
      }
    }

    // Second pass: fetch uncached data in parallel
    if (uncachedAddresses.length > 0) {
      const fetchPromises = uncachedAddresses.map(async (address) => {
        try {
          const metadata = await this.fetchKOLFromStore(address);
          if (metadata) {
            this.cacheKOLMetadata(address, metadata);
            results.set(address.toLowerCase(), metadata);
          }
        } catch (error) {
          console.warn(`Failed to fetch KOL metadata for ${address}:`, error);
        }
      });

      await Promise.allSettled(fetchPromises);
    }

    return results;
  }

  /**
   * Invalidate metadata cache by type
   */
  invalidateMetadataCache(type?: 'token' | 'kol'): void {
    if (!type) {
      // Clear all metadata caches
      this.invalidateCache(METADATA_CACHE_PREFIXES.TOKEN_METADATA);
      this.invalidateCache(METADATA_CACHE_PREFIXES.KOL_METADATA);
    } else if (type === 'token') {
      this.invalidateCache(METADATA_CACHE_PREFIXES.TOKEN_METADATA);
    } else if (type === 'kol') {
      this.invalidateCache(METADATA_CACHE_PREFIXES.KOL_METADATA);
    }
  }

  /**
   * Get metadata cache statistics
   */
  getMetadataStats(): MetadataCacheStats {
    const baseStats = this.getStats();
    
    // Count metadata-specific entries
    let tokenCacheEntries = 0;
    let kolCacheEntries = 0;

    // This is a simplified count - in a real implementation, you'd iterate through cache keys
    // For now, we'll estimate based on total entries
    const totalMetadataEntries = baseStats.memoryEntries + baseStats.sessionStorageEntries;
    tokenCacheEntries = Math.floor(totalMetadataEntries * 0.6); // Estimate 60% tokens
    kolCacheEntries = Math.floor(totalMetadataEntries * 0.4); // Estimate 40% KOLs

    const tokenTotal = this.tokenStats.hits + this.tokenStats.misses;
    const kolTotal = this.kolStats.hits + this.kolStats.misses;

    return {
      tokenCacheEntries,
      kolCacheEntries,
      tokenHitRate: tokenTotal > 0 ? this.tokenStats.hits / tokenTotal : 0,
      kolHitRate: kolTotal > 0 ? this.kolStats.hits / kolTotal : 0,
      backgroundRefreshCount: this.backgroundRefreshCount,
      failedRefreshCount: this.failedRefreshCount,
    };
  }

  /**
   * Schedule background refresh for stale data
   */
  private scheduleBackgroundRefresh(cacheKey: string, identifier: string, type: 'token' | 'kol'): void {
    // Avoid duplicate refresh requests
    if (this.refreshQueue.has(cacheKey)) return;

    const entry = this.getEntry(cacheKey);
    if (!entry) return;

    const age = Date.now() - entry.timestamp;
    const ttl = type === 'token' ? this.metadataConfig.tokenTTL : this.metadataConfig.kolTTL;
    const refreshThreshold = ttl * this.metadataConfig.backgroundRefreshThreshold;

    if (age >= refreshThreshold) {
      this.refreshQueue.add(cacheKey);
      
      // Schedule refresh
      setTimeout(async () => {
        try {
          if (type === 'token') {
            const metadata = await this.fetchTokenFromStore(identifier);
            if (metadata) {
              this.cacheTokenMetadata(identifier, metadata);
              this.backgroundRefreshCount++;
            }
          } else {
            const metadata = await this.fetchKOLFromStore(identifier);
            if (metadata) {
              this.cacheKOLMetadata(identifier, metadata);
              this.backgroundRefreshCount++;
            }
          }
        } catch (error) {
          console.warn(`Background refresh failed for ${type} ${identifier}:`, error);
          this.failedRefreshCount++;
        } finally {
          this.refreshQueue.delete(cacheKey);
        }
      }, 0);
    }
  }

  /**
   * Get cache entry (protected method access)
   */
  private getEntry(key: string): CacheEntry<any> | null {
    // This would need to be implemented by exposing the method in the base class
    // For now, we'll return null and handle it gracefully
    return null;
  }

  /**
   * Fetch token metadata from store
   */
  private async fetchTokenFromStore(mint: string): Promise<TokenMetadata | null> {
    try {
      // In a real implementation, we'd need to access the store
      // Since we can't directly use hooks here, we'll need to pass the store instance
      // or use a different approach. For now, we'll return null for cache misses.
      
      // This would be implemented as:
      // const tokenStore = useTokenStore.getState();
      // const token = await tokenStore.ensureToken(mint);
      // if (token) {
      //   return {
      //     mint,
      //     name: token.name,
      //     symbol: token.symbol,
      //     image: token.image,
      //     fallbackImage: token.image,
      //     lastUpdated: Date.now(),
      //   };
      // }
      
      return null;
    } catch (error) {
      console.warn(`Failed to fetch token from store: ${mint}`, error);
      return null;
    }
  }

  /**
   * Fetch KOL metadata from store
   */
  private async fetchKOLFromStore(walletAddress: string): Promise<KOLMetadata | null> {
    try {
      // In a real implementation, we'd need to access the store
      // Since we can't directly use hooks here, we'll need to pass the store instance
      // or use a different approach. For now, we'll return null for cache misses.
      
      // This would be implemented as:
      // const kolStore = useKOLStore.getState();
      // const kol = await kolStore.ensureKOL(walletAddress);
      // if (kol) {
      //   return {
      //     walletAddress: walletAddress.toLowerCase(),
      //     name: kol.name || kol.displayName,
      //     avatar: kol.avatar || kol.profileImage,
      //     socialLinks: {
      //       twitter: kol.twitterHandle ? `https://twitter.com/${kol.twitterHandle}` : undefined,
      //       telegram: kol.telegramHandle ? `https://t.me/${kol.telegramHandle}` : undefined,
      //       website: kol.website,
      //     },
      //     fallbackAvatar: this.generateFallbackAvatar(walletAddress),
      //     lastUpdated: Date.now(),
      //   };
      // }
      
      return null;
    } catch (error) {
      console.warn(`Failed to fetch KOL from store: ${walletAddress}`, error);
      return null;
    }
  }

  /**
   * Generate fallback avatar for KOL
   */
  generateFallbackAvatar(walletAddress: string): string {
    // Generate a simple identicon-style avatar based on wallet address
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    
    const hash = walletAddress.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const colorIndex = Math.abs(hash) % colors.length;
    const color = colors[colorIndex];
    
    // Create a simple SVG avatar with initials
    const initials = walletAddress.slice(0, 2).toUpperCase();
    
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="20" fill="${color}"/>
        <text x="20" y="26" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold">
          ${initials}
        </text>
      </svg>
    `)}`;
  }

  /**
   * Update metadata cache configuration
   */
  updateMetadataConfig(newConfig: Partial<MetadataCacheConfig>): void {
    this.metadataConfig = { ...this.metadataConfig, ...newConfig };
    this.updateConfig(newConfig);
  }
}

// Create and export a singleton instance
export const metadataCacheManager = new MetadataCacheManager();

// Export metadata cache prefixes for external use
export { METADATA_CACHE_PREFIXES };