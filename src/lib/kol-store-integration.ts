/**
 * KOL Store Integration Utilities for Mindmap Enhancement
 * Implements KOL metadata fetching, caching, and fallback logic with social media integration
 */

import { 
  KOLMetadata, 
  KOLWallet,
  CacheEntry,
  SocialLinks
} from '../types';
import { useKOLStore } from '../stores/use-kol-store';
import { MINDMAP_FILTER_CONFIG } from './constants';

/**
 * KOL Store Integration Manager
 * Handles fetching KOL metadata from useKOLStore with intelligent caching and social media integration
 */
export class KOLStoreIntegrationManager {
  private cache = new Map<string, CacheEntry<KOLMetadata>>();
  private stats = {
    hits: 0,
    misses: 0,
    storeHits: 0,
    storeMisses: 0,
    fallbacks: 0,
    errors: 0,
    socialMediaFetches: 0,
    avatarGenerations: 0
  };

  constructor(
    private maxCacheSize: number = MINDMAP_FILTER_CONFIG.METADATA_CACHE_MAX_SIZE,
    private defaultTTL: number = MINDMAP_FILTER_CONFIG.METADATA_CACHE_TTL
  ) {
    this.setupPeriodicCleanup();
  }

  /**
   * Fetches KOL metadata with caching, social media integration, and fallback logic
   * @param walletAddress - KOL wallet address
   * @param kolStore - KOL store instance from useKOLStore
   * @returns KOL metadata or null if not available
   */
  async fetchKOLMetadata(
    walletAddress: string, 
    kolStore?: ReturnType<typeof useKOLStore>
  ): Promise<KOLMetadata | null> {
    try {
      // Step 1: Check cache first
      const cached = this.getCachedMetadata(walletAddress);
      if (cached) {
        this.stats.hits++;
        return cached;
      }

      this.stats.misses++;

      // Step 2: Try to get from KOL store
      if (kolStore) {
        try {
          // Use ensureKOL to fetch if not in store
          const storeKOL = await kolStore.ensureKOL(walletAddress);
          if (storeKOL) {
            this.stats.storeHits++;
            const metadata = await this.enrichKOLWithStoreData(storeKOL);
            this.cacheMetadata(walletAddress, metadata);
            return metadata;
          }
        } catch (storeError) {
          console.error(`Error getting KOL ${walletAddress} from store:`, storeError);
          this.stats.errors++;
        }
      }

      this.stats.storeMisses++;

      // Step 3: Fallback to minimal metadata with generated avatar
      const fallbackMetadata = await this.createFallbackMetadata(walletAddress);
      this.stats.fallbacks++;
      this.cacheMetadata(walletAddress, fallbackMetadata, MINDMAP_FILTER_CONFIG.FALLBACK_CACHE_TTL);
      
      return fallbackMetadata;

    } catch (error) {
      console.error(`Error fetching KOL metadata for ${walletAddress}:`, error);
      this.stats.errors++;
      
      // Return fallback metadata even on error
      const fallbackMetadata = await this.createFallbackMetadata(walletAddress);
      this.cacheMetadata(walletAddress, fallbackMetadata, MINDMAP_FILTER_CONFIG.FALLBACK_CACHE_TTL);
      
      return fallbackMetadata;
    }
  }

  /**
   * Batch fetches KOL metadata for multiple wallet addresses
   * @param walletAddresses - Array of KOL wallet addresses
   * @param kolStore - KOL store instance from useKOLStore
   * @returns Map of walletAddress -> metadata
   */
  async batchFetchKOLMetadata(
    walletAddresses: string[],
    kolStore?: ReturnType<typeof useKOLStore>
  ): Promise<Map<string, KOLMetadata>> {
    const results = new Map<string, KOLMetadata>();
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 8; // Smaller batch size for KOLs due to potential social media fetching
    for (let i = 0; i < walletAddresses.length; i += batchSize) {
      const batch = walletAddresses.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (address) => {
        const metadata = await this.fetchKOLMetadata(address, kolStore);
        if (metadata) {
          results.set(address, metadata);
        }
      });
      
      await Promise.all(batchPromises);
      
      // Small delay between batches
      if (i + batchSize < walletAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Enriches KOL data from store with social media integration
   * @param kolData - Raw KOL data from store
   * @returns Enriched KOL metadata with social media avatars
   */
  private async enrichKOLWithStoreData(kolData: KOLWallet): Promise<KOLMetadata> {
    // Start with basic metadata from store
    const baseMetadata: KOLMetadata = {
      name: kolData.name,
      avatar: kolData.avatar,
      socialLinks: kolData.socialLinks,
      fallbackAvatar: await this.generateFallbackAvatar(kolData.name || kolData.walletAddress),
      lastUpdated: Date.now(),
      displayName: kolData.name || `${kolData.walletAddress.slice(0, 6)}...${kolData.walletAddress.slice(-4)}`,
      description: kolData.description,
      totalTrades: kolData.totalTrades,
      winRate: kolData.winRate,
      totalPnL: kolData.totalPnL,
      subscriberCount: kolData.subscriberCount,
      isActive: kolData.isActive
    };

    // Try to fetch social media avatar if no avatar is provided
    if (!baseMetadata.avatar && baseMetadata.socialLinks) {
      try {
        const socialAvatar = await this.fetchSocialMediaAvatar(baseMetadata.socialLinks);
        if (socialAvatar) {
          baseMetadata.avatar = socialAvatar;
          this.stats.socialMediaFetches++;
        }
      } catch (error) {
        console.warn(`Failed to fetch social media avatar for ${kolData.walletAddress}:`, error);
      }
    }

    return baseMetadata;
  }

  /**
   * Creates fallback metadata for KOLs not found in store
   * @param walletAddress - KOL wallet address
   * @returns Minimal KOL metadata with generated avatar
   */
  private async createFallbackMetadata(walletAddress: string): Promise<KOLMetadata> {
    const fallbackAvatar = await this.generateFallbackAvatar(walletAddress);
    
    return {
      name: undefined,
      avatar: undefined,
      socialLinks: undefined,
      fallbackAvatar,
      lastUpdated: Date.now(),
      displayName: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      description: undefined,
      totalTrades: undefined,
      winRate: undefined,
      totalPnL: undefined,
      subscriberCount: undefined,
      isActive: true // Default to active for unknown KOLs
    };
  }

  /**
   * Fetches avatar from social media platforms (Twitter/X integration)
   * @param socialLinks - Social media links from KOL data
   * @returns Avatar URL or null if not found
   */
  private async fetchSocialMediaAvatar(socialLinks: SocialLinks): Promise<string | null> {
    // Priority order: Twitter/X, then other platforms
    const platforms = [
      { name: 'twitter', url: socialLinks.twitter },
      { name: 'telegram', url: socialLinks.telegram },
      { name: 'discord', url: socialLinks.discord }
    ];

    for (const platform of platforms) {
      if (platform.url) {
        try {
          const avatar = await this.fetchAvatarFromPlatform(platform.name, platform.url);
          if (avatar) {
            return avatar;
          }
        } catch (error) {
          console.warn(`Failed to fetch avatar from ${platform.name}:`, error);
        }
      }
    }

    return null;
  }

  /**
   * Fetches avatar from a specific social media platform
   * @param platform - Platform name ('twitter', 'telegram', 'discord')
   * @param url - Social media URL
   * @returns Avatar URL or null
   */
  private async fetchAvatarFromPlatform(platform: string, url: string): Promise<string | null> {
    // For now, we'll implement a basic approach
    // In a production environment, you might want to use official APIs or services
    
    if (platform === 'twitter' && url) {
      // Extract username from Twitter URL
      const twitterMatch = url.match(/twitter\.com\/([^\/\?]+)/i) || url.match(/x\.com\/([^\/\?]+)/i);
      if (twitterMatch && twitterMatch[1]) {
        const username = twitterMatch[1];
        // Use a service like unavatar.io for Twitter avatars
        return `https://unavatar.io/twitter/${username}`;
      }
    }

    if (platform === 'telegram' && url) {
      // Extract username from Telegram URL
      const telegramMatch = url.match(/t\.me\/([^\/\?]+)/i);
      if (telegramMatch && telegramMatch[1]) {
        const username = telegramMatch[1];
        // Telegram doesn't have a direct avatar API, but we can try unavatar
        return `https://unavatar.io/telegram/${username}`;
      }
    }

    return null;
  }

  /**
   * Generates a fallback avatar using initials or identicons
   * @param identifier - KOL name or wallet address
   * @returns Fallback avatar URL
   */
  private async generateFallbackAvatar(identifier: string): Promise<string> {
    this.stats.avatarGenerations++;
    
    // Extract meaningful seed for avatar generation
    let seed = identifier;
    let avatarType = 'initials';
    
    if (identifier.includes(' ')) {
      // It's likely a name, extract initials
      const words = identifier.trim().split(/\s+/);
      seed = words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
      avatarType = 'initials';
    } else if (identifier.length > 20) {
      // It's likely a wallet address, use identicon style
      seed = identifier.slice(0, 8);
      avatarType = 'identicon';
    } else {
      // Short identifier, use as-is
      seed = identifier.toUpperCase();
      avatarType = 'initials';
    }
    
    // Use different avatar styles based on the type
    if (avatarType === 'initials') {
      return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=FF6B6B,4ECDC4,FFD93D,6BCF7F&fontSize=40&fontWeight=600`;
    } else {
      return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seed)}&backgroundColor=FF6B6B,4ECDC4,FFD93D,6BCF7F`;
    }
  }

  /**
   * Gets cached metadata if available and not expired
   * @param walletAddress - KOL wallet address
   * @returns Cached metadata or null
   */
  private getCachedMetadata(walletAddress: string): KOLMetadata | null {
    const entry = this.cache.get(walletAddress);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(walletAddress);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    return entry.data;
  }

  /**
   * Caches KOL metadata with TTL
   * @param walletAddress - KOL wallet address
   * @param metadata - KOL metadata to cache
   * @param customTTL - Custom TTL in milliseconds
   */
  private cacheMetadata(walletAddress: string, metadata: KOLMetadata, customTTL?: number): void {
    const ttl = customTTL || this.defaultTTL;
    const entry: CacheEntry<KOLMetadata> = {
      data: { ...metadata, lastUpdated: Date.now() },
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessed: Date.now()
    };

    // Ensure cache size limit
    this.ensureCacheSize();
    
    this.cache.set(walletAddress, entry);
  }

  /**
   * Checks if a cache entry is expired
   * @param entry - Cache entry to check
   * @returns True if expired
   */
  private isExpired(entry: CacheEntry<KOLMetadata>): boolean {
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
   * Invalidates cache entry for a specific wallet address
   * @param walletAddress - KOL wallet address to invalidate
   */
  invalidateCache(walletAddress: string): void {
    this.cache.delete(walletAddress);
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
      errors: 0,
      socialMediaFetches: 0,
      avatarGenerations: 0
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
      socialMediaFetches: this.stats.socialMediaFetches,
      avatarGenerations: this.stats.avatarGenerations,
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
        walletAddress: key.slice(0, 8) + '...',
        age: Date.now() - entry.timestamp,
        ttl: entry.ttl,
        accessCount: entry.accessCount,
        isExpired: this.isExpired(entry),
        hasName: !!entry.data.name,
        hasAvatar: !!entry.data.avatar,
        hasSocialLinks: !!entry.data.socialLinks,
        displayName: entry.data.displayName
      })),
      stats: this.stats
    };
  }
}

// Export singleton instance
export const kolStoreIntegrationManager = new KOLStoreIntegrationManager();

/**
 * Hook-based utility functions for React components
 */

/**
 * Fetches KOL metadata using the current KOL store
 * @returns Object with KOL metadata functions
 */
export const useKOLMetadata = () => {
  const kolStore = useKOLStore();
  
  return {
    fetchKOLMetadata: (walletAddress: string) => 
      kolStoreIntegrationManager.fetchKOLMetadata(walletAddress, kolStore),
    
    batchFetchKOLMetadata: (walletAddresses: string[]) =>
      kolStoreIntegrationManager.batchFetchKOLMetadata(walletAddresses, kolStore),
    
    invalidateCache: (walletAddress: string) =>
      kolStoreIntegrationManager.invalidateCache(walletAddress),
    
    getStats: () => kolStoreIntegrationManager.getStats(),
    
    getCacheInfo: () => kolStoreIntegrationManager.getDetailedCacheInfo()
  };
};

/**
 * Utility function to enrich mindmap data with KOL metadata
 * @param mindmapData - Raw mindmap data
 * @param kolStore - KOL store instance
 * @returns Promise resolving to enriched mindmap data
 */
export const enrichMindmapWithKOLMetadata = async (
  mindmapData: { [tokenMint: string]: any },
  kolStore?: ReturnType<typeof useKOLStore>
): Promise<{ [tokenMint: string]: any }> => {
  const enrichedData = { ...mindmapData };
  
  // Extract all unique KOL wallet addresses from mindmap data
  const kolWallets = new Set<string>();
  Object.values(mindmapData).forEach(tokenData => {
    if (tokenData.kolConnections) {
      Object.keys(tokenData.kolConnections).forEach(wallet => {
        kolWallets.add(wallet);
      });
    }
  });
  
  // Batch fetch metadata for all KOLs
  const metadataMap = await kolStoreIntegrationManager.batchFetchKOLMetadata(
    Array.from(kolWallets), 
    kolStore
  );
  
  // Enrich each token's KOL connections with metadata
  Object.keys(enrichedData).forEach(tokenMint => {
    const tokenData = enrichedData[tokenMint];
    if (tokenData.kolConnections) {
      const enrichedKolMetadata: { [kolWallet: string]: any } = {};
      
      Object.entries(tokenData.kolConnections).forEach(([kolWallet, kolData]) => {
        const metadata = metadataMap.get(kolWallet);
        enrichedKolMetadata[kolWallet] = {
          ...kolData,
          metadata,
          // Add display properties for easy access
          displayName: metadata?.displayName || `${kolWallet.slice(0, 6)}...${kolWallet.slice(-4)}`,
          displayAvatar: metadata?.avatar || metadata?.fallbackAvatar
        };
      });
      
      enrichedData[tokenMint] = {
        ...tokenData,
        kolMetadata: enrichedKolMetadata
      };
    }
  });
  
  return enrichedData;
};