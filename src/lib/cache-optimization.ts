/**
 * Cache Optimization Utilities
 * 
 * Provides memory monitoring, cache sharing between components,
 * and performance optimization for the metadata cache system.
 */

import { metadataCacheManager, MetadataCacheStats } from './metadata-cache-manager';
import { cacheManager } from './cache-manager';
import { MetadataIntegration } from './metadata-store-integration';

// Memory monitoring interfaces
export interface MemoryUsageStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usagePercentage: number;
  isHighUsage: boolean;
}

export interface CachePerformanceMetrics {
  memoryStats: MemoryUsageStats;
  metadataStats: MetadataCacheStats;
  cacheEfficiency: number;
  recommendedActions: string[];
}

export interface CacheOptimizationConfig {
  memoryThreshold: number; // Percentage of heap limit
  cleanupThreshold: number; // Percentage of heap limit to trigger cleanup
  maxCacheAge: number; // Maximum age for cache entries in milliseconds
  enableAutoCleanup: boolean;
  monitoringInterval: number; // Monitoring interval in milliseconds
}

// Default optimization configuration
const DEFAULT_OPTIMIZATION_CONFIG: CacheOptimizationConfig = {
  memoryThreshold: 70, // 70% of heap limit
  cleanupThreshold: 85, // 85% of heap limit
  maxCacheAge: 60 * 60 * 1000, // 1 hour
  enableAutoCleanup: true,
  monitoringInterval: 30 * 1000, // 30 seconds
};

/**
 * Cache Optimization Manager
 */
export class CacheOptimizationManager {
  private config: CacheOptimizationConfig;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private performanceObserver: PerformanceObserver | null = null;
  private memoryPressureCallbacks: Array<() => void> = [];

  constructor(config: Partial<CacheOptimizationConfig> = {}) {
    this.config = { ...DEFAULT_OPTIMIZATION_CONFIG, ...config };
    
    if (this.config.enableAutoCleanup) {
      this.startMemoryMonitoring();
    }
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryUsage(): MemoryUsageStats {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
        usagePercentage: 0,
        isHighUsage: false,
      };
    }

    const memory = (performance as any).memory;
    if (!memory) {
      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
        usagePercentage: 0,
        isHighUsage: false,
      };
    }

    const usagePercentage = memory.jsHeapSizeLimit > 0 
      ? (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100 
      : 0;

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usagePercentage,
      isHighUsage: usagePercentage > this.config.memoryThreshold,
    };
  }

  /**
   * Get comprehensive cache performance metrics
   */
  getCachePerformanceMetrics(): CachePerformanceMetrics {
    const memoryStats = this.getMemoryUsage();
    const metadataStats = metadataCacheManager.getMetadataStats();
    
    // Calculate cache efficiency
    const totalRequests = metadataStats.tokenHitRate + metadataStats.kolHitRate;
    const cacheEfficiency = totalRequests > 0 
      ? ((metadataStats.tokenHitRate + metadataStats.kolHitRate) / 2) * 100 
      : 0;

    // Generate recommendations
    const recommendedActions: string[] = [];
    
    if (memoryStats.isHighUsage) {
      recommendedActions.push('High memory usage detected - consider cache cleanup');
    }
    
    if (cacheEfficiency < 50) {
      recommendedActions.push('Low cache efficiency - review cache TTL settings');
    }
    
    if (metadataStats.failedRefreshCount > 10) {
      recommendedActions.push('High refresh failure rate - check network connectivity');
    }
    
    if (metadataStats.tokenCacheEntries + metadataStats.kolCacheEntries > 5000) {
      recommendedActions.push('Large cache size - consider reducing TTL or max entries');
    }

    return {
      memoryStats,
      metadataStats,
      cacheEfficiency,
      recommendedActions,
    };
  }

  /**
   * Optimize cache based on current conditions
   */
  optimizeCache(): void {
    const metrics = this.getCachePerformanceMetrics();
    
    // Trigger cleanup if memory usage is high
    if (metrics.memoryStats.usagePercentage > this.config.cleanupThreshold) {
      this.performAggressiveCleanup();
    } else if (metrics.memoryStats.isHighUsage) {
      this.performStandardCleanup();
    }

    // Optimize cache configuration based on efficiency
    if (metrics.cacheEfficiency < 30) {
      this.adjustCacheConfiguration();
    }
  }

  /**
   * Perform standard cache cleanup
   */
  performStandardCleanup(): void {
    console.log('Performing standard cache cleanup...');
    
    // Clean expired entries
    metadataCacheManager.cleanupExpired();
    cacheManager.cleanupExpired();
    
    // Trigger garbage collection if available
    this.triggerGarbageCollection();
  }

  /**
   * Perform aggressive cache cleanup
   */
  performAggressiveCleanup(): void {
    console.log('Performing aggressive cache cleanup due to high memory usage...');
    
    // Clear old metadata entries
    this.clearOldCacheEntries();
    
    // Clean expired entries
    metadataCacheManager.cleanupExpired();
    cacheManager.cleanupExpired();
    
    // Reduce cache sizes temporarily
    this.temporarilyReduceCacheSizes();
    
    // Trigger garbage collection
    this.triggerGarbageCollection();
    
    // Notify memory pressure callbacks
    this.notifyMemoryPressure();
  }

  /**
   * Clear old cache entries based on age
   */
  private clearOldCacheEntries(): void {
    // This would require access to cache internals
    // For now, we'll invalidate metadata caches older than maxCacheAge
    console.log('Clearing old cache entries...');
    
    // Clear metadata caches (they will be rebuilt as needed)
    metadataCacheManager.invalidateMetadataCache();
  }

  /**
   * Temporarily reduce cache sizes
   */
  private temporarilyReduceCacheSizes(): void {
    const currentConfig = metadataCacheManager.getStats();
    
    // Reduce max entries by 50% temporarily
    metadataCacheManager.updateMetadataConfig({
      maxMemoryEntries: Math.floor(currentConfig.memoryEntries * 0.5),
    });
    
    // Restore normal size after 5 minutes
    setTimeout(() => {
      metadataCacheManager.updateMetadataConfig({
        maxMemoryEntries: DEFAULT_OPTIMIZATION_CONFIG.maxCacheAge,
      });
    }, 5 * 60 * 1000);
  }

  /**
   * Adjust cache configuration based on performance
   */
  private adjustCacheConfiguration(): void {
    console.log('Adjusting cache configuration for better performance...');
    
    // Reduce TTL for better cache turnover
    metadataCacheManager.updateMetadataConfig({
      tokenTTL: 10 * 60 * 1000, // 10 minutes
      kolTTL: 20 * 60 * 1000, // 20 minutes
    });
  }

  /**
   * Trigger garbage collection if available
   */
  private triggerGarbageCollection(): void {
    if (typeof window !== 'undefined' && (window as any).gc) {
      try {
        (window as any).gc();
        console.log('Garbage collection triggered');
      } catch (error) {
        console.warn('Failed to trigger garbage collection:', error);
      }
    }
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.monitoringTimer = setInterval(() => {
      const memoryStats = this.getMemoryUsage();
      
      if (memoryStats.usagePercentage > this.config.cleanupThreshold) {
        this.performAggressiveCleanup();
      } else if (memoryStats.isHighUsage) {
        this.performStandardCleanup();
      }
    }, this.config.monitoringInterval);

    // Set up performance observer for more detailed monitoring
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'measure' && entry.name.includes('cache')) {
              console.log(`Cache operation ${entry.name} took ${entry.duration}ms`);
            }
          });
        });
        
        this.performanceObserver.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Failed to set up performance observer:', error);
      }
    }
  }

  /**
   * Stop memory monitoring
   */
  stopMemoryMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
  }

  /**
   * Register callback for memory pressure events
   */
  onMemoryPressure(callback: () => void): void {
    this.memoryPressureCallbacks.push(callback);
  }

  /**
   * Unregister memory pressure callback
   */
  offMemoryPressure(callback: () => void): void {
    const index = this.memoryPressureCallbacks.indexOf(callback);
    if (index > -1) {
      this.memoryPressureCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all memory pressure callbacks
   */
  private notifyMemoryPressure(): void {
    this.memoryPressureCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Memory pressure callback failed:', error);
      }
    });
  }

  /**
   * Update optimization configuration
   */
  updateConfig(newConfig: Partial<CacheOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enableAutoCleanup && !this.monitoringTimer) {
      this.startMemoryMonitoring();
    } else if (!this.config.enableAutoCleanup && this.monitoringTimer) {
      this.stopMemoryMonitoring();
    }
  }

  /**
   * Destroy optimization manager
   */
  destroy(): void {
    this.stopMemoryMonitoring();
    this.memoryPressureCallbacks = [];
  }
}

/**
 * Cache sharing utilities for components
 */
export class CacheSharing {
  private static sharedInstances = new Map<string, any>();
  private static subscribers = new Map<string, Set<(data: any) => void>>();

  /**
   * Share cache data between components
   */
  static shareData<T>(key: string, data: T): void {
    this.sharedInstances.set(key, data);
    
    // Notify subscribers
    const subscribers = this.subscribers.get(key);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.warn(`Cache sharing callback failed for key ${key}:`, error);
        }
      });
    }
  }

  /**
   * Get shared cache data
   */
  static getSharedData<T>(key: string): T | null {
    return this.sharedInstances.get(key) || null;
  }

  /**
   * Subscribe to shared cache updates
   */
  static subscribe<T>(key: string, callback: (data: T) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const subscribers = this.subscribers.get(key);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  /**
   * Clear shared data
   */
  static clearSharedData(key?: string): void {
    if (key) {
      this.sharedInstances.delete(key);
      this.subscribers.delete(key);
    } else {
      this.sharedInstances.clear();
      this.subscribers.clear();
    }
  }
}

/**
 * Debug utilities for cache system
 */
export class CacheDebugger {
  /**
   * Log comprehensive cache statistics
   */
  static logCacheStats(): void {
    const metrics = cacheOptimizationManager.getCachePerformanceMetrics();
    
    console.group('Cache Performance Metrics');
    console.log('Memory Usage:', metrics.memoryStats);
    console.log('Metadata Stats:', metrics.metadataStats);
    console.log('Cache Efficiency:', `${metrics.cacheEfficiency.toFixed(2)}%`);
    console.log('Recommendations:', metrics.recommendedActions);
    console.groupEnd();
  }

  /**
   * Monitor cache operations
   */
  static startCacheMonitoring(): void {
    if (typeof window !== 'undefined') {
      // Monitor cache operations
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('cache')) {
          originalConsoleLog.apply(console, ['[CACHE]', ...args]);
        } else {
          originalConsoleLog.apply(console, args);
        }
      };
    }
  }

  /**
   * Create cache performance report
   */
  static generatePerformanceReport(): string {
    const metrics = cacheOptimizationManager.getCachePerformanceMetrics();
    
    return `
Cache Performance Report
========================
Generated: ${new Date().toISOString()}

Memory Usage:
- Used Heap: ${(metrics.memoryStats.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
- Total Heap: ${(metrics.memoryStats.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB
- Heap Limit: ${(metrics.memoryStats.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
- Usage: ${metrics.memoryStats.usagePercentage.toFixed(2)}%

Cache Statistics:
- Token Cache Entries: ${metrics.metadataStats.tokenCacheEntries}
- KOL Cache Entries: ${metrics.metadataStats.kolCacheEntries}
- Token Hit Rate: ${(metrics.metadataStats.tokenHitRate * 100).toFixed(2)}%
- KOL Hit Rate: ${(metrics.metadataStats.kolHitRate * 100).toFixed(2)}%
- Background Refreshes: ${metrics.metadataStats.backgroundRefreshCount}
- Failed Refreshes: ${metrics.metadataStats.failedRefreshCount}

Overall Efficiency: ${metrics.cacheEfficiency.toFixed(2)}%

Recommendations:
${metrics.recommendedActions.map(action => `- ${action}`).join('\n')}
    `.trim();
  }
}

// Create and export singleton instance
export const cacheOptimizationManager = new CacheOptimizationManager();

// Export utilities
export {
  CacheSharing,
  CacheDebugger,
};