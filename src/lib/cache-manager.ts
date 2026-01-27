/**
 * Cache Management System for KOL Trades Performance Optimization
 *
 * Provides efficient data caching with TTL support, session storage fallback,
 * and comprehensive cache invalidation mechanisms.
 */

import { KOLTrade, MindmapUpdate } from '@/types';

// Cache entry interface with metadata
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

// Cache configuration interface
export interface CacheConfig {
  defaultTTL: number; // Default TTL in milliseconds
  maxMemoryEntries: number; // Maximum entries in memory cache
  enableSessionStorage: boolean; // Enable session storage fallback
  cleanupInterval: number; // Cleanup interval in milliseconds
}

// Cache statistics interface
export interface CacheStats {
  memoryEntries: number;
  sessionStorageEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsage: number; // Estimated memory usage in bytes
}

// Default cache configuration
const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxMemoryEntries: 1000,
  enableSessionStorage: true,
  cleanupInterval: 60 * 1000, // 1 minute
};

// Cache key prefixes for different data types
const CACHE_PREFIXES = {
  TRADE_DATA: 'trade_data_',
  MINDMAP_DATA: 'mindmap_data_',
  STATS_DATA: 'stats_data_',
  TRENDING_TOKENS: 'trending_tokens_',
  KOL_DATA: 'kol_data_',
  KOL_METADATA: 'kol_metadata_',
} as const;

export class CacheManager {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private config: CacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stats = {
    totalHits: 0,
    totalMisses: 0,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * Get trade data from cache
   */
  getTradeData(key: string): KOLTrade[] | null {
    return this.get(`${CACHE_PREFIXES.TRADE_DATA}${key}`);
  }

  /**
   * Set trade data in cache
   */
  setTradeData(key: string, data: KOLTrade[], ttl?: number): void {
    this.set(`${CACHE_PREFIXES.TRADE_DATA}${key}`, data, ttl);
  }

  /**
   * Get mindmap data from cache
   */
  getMindmapData(tokenMint: string): MindmapUpdate | null {
    return this.get(`${CACHE_PREFIXES.MINDMAP_DATA}${tokenMint}`);
  }

  /**
   * Set mindmap data in cache
   */
  setMindmapData(tokenMint: string, data: MindmapUpdate, ttl?: number): void {
    this.set(`${CACHE_PREFIXES.MINDMAP_DATA}${tokenMint}`, data, ttl);
  }

  /**
   * Get stats data from cache
   */
  getStatsData(key: string): any | null {
    return this.get(`${CACHE_PREFIXES.STATS_DATA}${key}`);
  }

  /**
   * Set stats data in cache
   */
  setStatsData(key: string, data: any, ttl?: number): void {
    this.set(`${CACHE_PREFIXES.STATS_DATA}${key}`, data, ttl);
  }

  /**
   * Get trending tokens from cache
   */
  getTrendingTokens(): string[] | null {
    return this.get(`${CACHE_PREFIXES.TRENDING_TOKENS}list`);
  }

  /**
   * Set trending tokens in cache
   */
  setTrendingTokens(tokens: string[], ttl?: number): void {
    this.set(`${CACHE_PREFIXES.TRENDING_TOKENS}list`, tokens, ttl);
  }

  /**
   * Get KOL data from cache
   */
  getKOLData(walletAddress: string): any | null {
    return this.get(`${CACHE_PREFIXES.KOL_DATA}${walletAddress.toLowerCase()}`);
  }

  /**
   * Set KOL data in cache
   */
  setKOLData(walletAddress: string, data: any, ttl?: number): void {
    this.set(
      `${CACHE_PREFIXES.KOL_DATA}${walletAddress.toLowerCase()}`,
      data,
      ttl
    );
  }

  /**
   * Get all mindmap data from cache
   */
  getAllMindmapData(): Record<string, MindmapUpdate> {
    const mindmapData: Record<string, MindmapUpdate> = {};

    // Check memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (key.startsWith(CACHE_PREFIXES.MINDMAP_DATA) && !this.isExpired(entry)) {
        const tokenMint = key.replace(CACHE_PREFIXES.MINDMAP_DATA, '');
        mindmapData[tokenMint] = entry.data;
      }
    }

    // Check session storage for additional entries
    if (this.config.enableSessionStorage && typeof window !== 'undefined') {
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith(CACHE_PREFIXES.MINDMAP_DATA)) {
            const tokenMint = key.replace(CACHE_PREFIXES.MINDMAP_DATA, '');
            if (!mindmapData[tokenMint]) {
              try {
                const sessionData = sessionStorage.getItem(key);
                if (sessionData) {
                  const entry: CacheEntry<MindmapUpdate> = JSON.parse(sessionData);
                  if (!this.isExpired(entry)) {
                    mindmapData[tokenMint] = entry.data;
                  }
                }
              } catch (error) {
                console.warn(`Failed to parse mindmap data for ${tokenMint}:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to read mindmap data from session storage:', error);
      }
    }

    return mindmapData;
  }

  /**
   * Get all cached KOL data
   */
  getAllKOLData(): Record<string, any> {
    const kolData: Record<string, any> = {};

    // Check memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (key.startsWith(CACHE_PREFIXES.KOL_DATA) && !this.isExpired(entry)) {
        const walletAddress = key.replace(CACHE_PREFIXES.KOL_DATA, '');
        kolData[walletAddress] = entry.data;
      }
    }

    // Check session storage for additional entries
    if (this.config.enableSessionStorage && typeof window !== 'undefined') {
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith(CACHE_PREFIXES.KOL_DATA)) {
            const walletAddress = key.replace(CACHE_PREFIXES.KOL_DATA, '');
            if (!kolData[walletAddress]) {
              // Don't override memory cache data
              try {
                const sessionData = sessionStorage.getItem(key);
                if (sessionData) {
                  const entry: CacheEntry<any> = JSON.parse(sessionData);
                  if (!this.isExpired(entry)) {
                    kolData[walletAddress] = entry.data;
                  }
                }
              } catch (error) {
                console.warn(
                  `Failed to parse KOL data for ${walletAddress}:`,
                  error
                );
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to read KOL data from session storage:', error);
      }
    }

    return kolData;
  }

  /**
   * Set multiple KOL data entries in batch
   */
  setKOLDataBatch(kolDataMap: Record<string, any>, ttl?: number): void {
    const entries = Object.entries(kolDataMap).map(([walletAddress, data]) => ({
      key: `${CACHE_PREFIXES.KOL_DATA}${walletAddress.toLowerCase()}`,
      data,
      ttl,
    }));
    this.batchSet(entries);
  }

  /**
   * Get KOL metadata (name, avatar, etc.) from cache
   */
  getKOLMetadata(
    walletAddress: string
  ): { name?: string; avatar?: string; socialLinks?: any } | null {
    return this.get(
      `${CACHE_PREFIXES.KOL_METADATA}${walletAddress.toLowerCase()}`
    );
  }

  /**
   * Set KOL metadata in cache
   */
  setKOLMetadata(
    walletAddress: string,
    metadata: { name?: string; avatar?: string; socialLinks?: any },
    ttl?: number
  ): void {
    this.set(
      `${CACHE_PREFIXES.KOL_METADATA}${walletAddress.toLowerCase()}`,
      metadata,
      ttl
    );
  }

  /**
   * Generic get method with fallback to session storage
   */
  private get<T>(key: string): T | null {
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      // Update access metadata
      memoryEntry.accessCount++;
      memoryEntry.lastAccessed = Date.now();
      this.stats.totalHits++;
      return memoryEntry.data;
    }

    // Remove expired entry from memory
    if (memoryEntry && this.isExpired(memoryEntry)) {
      this.memoryCache.delete(key);
    }

    // Try session storage fallback
    if (this.config.enableSessionStorage && typeof window !== 'undefined') {
      try {
        const sessionData = sessionStorage.getItem(key);
        if (sessionData) {
          const entry: CacheEntry<T> = JSON.parse(sessionData);
          if (!this.isExpired(entry)) {
            // Restore to memory cache for faster access
            entry.accessCount++;
            entry.lastAccessed = Date.now();
            this.memoryCache.set(key, entry);
            this.stats.totalHits++;
            return entry.data;
          } else {
            // Remove expired entry from session storage
            sessionStorage.removeItem(key);
          }
        }
      } catch (error) {
        console.warn('Failed to read from session storage:', error);
      }
    }

    this.stats.totalMisses++;
    return null;
  }

  /**
   * Generic set method with memory and session storage
   */
  private set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    // Enforce memory cache size limit using LRU eviction BEFORE adding new entry
    while (this.memoryCache.size >= this.config.maxMemoryEntries) {
      this.evictLRU();
    }

    // Store in memory cache
    this.memoryCache.set(key, entry);

    // Store in session storage as fallback
    if (this.config.enableSessionStorage && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(key, JSON.stringify(entry));
      } catch (error) {
        // Session storage might be full, try to clean up and retry
        console.warn(
          'Session storage write failed, attempting cleanup:',
          error
        );
        this.cleanupSessionStorage();
        try {
          sessionStorage.setItem(key, JSON.stringify(entry));
        } catch (retryError) {
          console.warn(
            'Session storage write failed after cleanup:',
            retryError
          );
        }
      }
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evict least recently used entries from memory cache
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidateCache(pattern?: string): void {
    if (!pattern) {
      // Clear all caches
      this.memoryCache.clear();
      if (this.config.enableSessionStorage && typeof window !== 'undefined') {
        this.clearSessionStorageCache();
      }
      return;
    }

    // Clear entries matching pattern
    const keysToDelete: string[] = [];

    // Check memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.memoryCache.delete(key));

    // Check session storage
    if (this.config.enableSessionStorage && typeof window !== 'undefined') {
      try {
        const sessionKeysToDelete: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.includes(pattern)) {
            sessionKeysToDelete.push(key);
          }
        }
        sessionKeysToDelete.forEach(key => sessionStorage.removeItem(key));
      } catch (error) {
        console.warn('Failed to invalidate session storage cache:', error);
      }
    }
  }

  /**
   * Clean up expired entries
   */
  cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.memoryCache.delete(key));

    // Clean session storage
    if (this.config.enableSessionStorage && typeof window !== 'undefined') {
      this.cleanupSessionStorage();
    }
  }

  /**
   * Clean up expired entries from session storage
   */
  private cleanupSessionStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && this.isCacheKey(key)) {
          try {
            const data = sessionStorage.getItem(key);
            if (data) {
              const entry: CacheEntry<any> = JSON.parse(data);
              if (this.isExpired(entry)) {
                keysToRemove.push(key);
              }
            }
          } catch (error) {
            // Invalid JSON, remove the key
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to cleanup session storage:', error);
    }
  }

  /**
   * Check if a key belongs to our cache system
   */
  private isCacheKey(key: string): boolean {
    return Object.values(CACHE_PREFIXES).some(prefix => key.startsWith(prefix));
  }

  /**
   * Clear all cache entries from session storage
   */
  private clearSessionStorageCache(): void {
    if (typeof window === 'undefined') return;

    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && this.isCacheKey(key)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear session storage cache:', error);
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop automatic cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const memoryEntries = this.memoryCache.size;
    let sessionStorageEntries = 0;
    let estimatedMemoryUsage = 0;

    // Count session storage entries
    if (this.config.enableSessionStorage && typeof window !== 'undefined') {
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && this.isCacheKey(key)) {
            sessionStorageEntries++;
          }
        }
      } catch (error) {
        console.warn('Failed to count session storage entries:', error);
      }
    }

    // Estimate memory usage
    for (const [key, entry] of this.memoryCache.entries()) {
      estimatedMemoryUsage += key.length * 2; // String characters are 2 bytes
      estimatedMemoryUsage += JSON.stringify(entry).length * 2;
    }

    const totalRequests = this.stats.totalHits + this.stats.totalMisses;
    const hitRate =
      totalRequests > 0 ? this.stats.totalHits / totalRequests : 0;

    return {
      memoryEntries,
      sessionStorageEntries,
      totalHits: this.stats.totalHits,
      totalMisses: this.stats.totalMisses,
      hitRate,
      memoryUsage: estimatedMemoryUsage,
    };
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart cleanup timer with new interval
    this.startCleanupTimer();

    // Enforce new memory limit
    while (this.memoryCache.size > this.config.maxMemoryEntries) {
      this.evictLRU();
    }
  }

  /**
   * Destroy cache manager and cleanup resources
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.memoryCache.clear();
    if (this.config.enableSessionStorage) {
      this.clearSessionStorageCache();
    }
  }

  /**
   * Batch operations for efficient bulk updates
   */
  batchSet<T>(entries: Array<{ key: string; data: T; ttl?: number }>): void {
    entries.forEach(({ key, data, ttl }) => {
      this.set(key, data, ttl);
    });
  }

  /**
   * Batch get operations
   */
  batchGet<T>(keys: string[]): Array<{ key: string; data: T | null }> {
    return keys.map(key => ({
      key,
      data: this.get<T>(key),
    }));
  }

  /**
   * Check if data exists in cache (without updating access metadata)
   */
  has(key: string): boolean {
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      return true;
    }

    if (this.config.enableSessionStorage && typeof window !== 'undefined') {
      try {
        const sessionData = sessionStorage.getItem(key);
        if (sessionData) {
          const entry: CacheEntry<any> = JSON.parse(sessionData);
          return !this.isExpired(entry);
        }
      } catch (error) {
        console.warn('Failed to check session storage:', error);
      }
    }

    return false;
  }
}

// Create and export a singleton instance
export const cacheManager = new CacheManager();

// Export cache configuration for external use
export { CACHE_PREFIXES, DEFAULT_CONFIG };
