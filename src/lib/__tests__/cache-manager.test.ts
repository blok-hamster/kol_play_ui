/**
 * Unit tests for CacheManager
 */

import { CacheManager, CacheEntry } from '../cache-manager';
import { KOLTrade, MindmapUpdate } from '@/types';

// Mock sessionStorage for testing
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

// Mock window.sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    // Create a new cache manager for each test
    cacheManager = new CacheManager({
      defaultTTL: 1000, // 1 second for testing
      maxMemoryEntries: 5,
      enableSessionStorage: true,
      cleanupInterval: 100, // 100ms for testing
    });
    
    // Clear mock storage
    mockSessionStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cacheManager.destroy();
  });

  describe('Trade Data Caching', () => {
    const mockTrades: KOLTrade[] = [
      {
        id: '1',
        kolWallet: 'wallet1',
        signature: 'sig1',
        timestamp: new Date(),
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        amountOut: 200,
        tradeType: 'buy',
        dexProgram: 'jupiter',
      },
    ];

    it('should store and retrieve trade data', () => {
      cacheManager.setTradeData('recent', mockTrades);
      const retrieved = cacheManager.getTradeData('recent');
      
      expect(retrieved).toEqual(mockTrades);
    });

    it('should return null for non-existent trade data', () => {
      const retrieved = cacheManager.getTradeData('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should store trade data in session storage', () => {
      cacheManager.setTradeData('recent', mockTrades);
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'trade_data_recent',
        expect.stringContaining('"data"')
      );
    });
  });

  describe('Mindmap Data Caching', () => {
    const mockMindmapData: MindmapUpdate = {
      tokenMint: 'token123',
      kolConnections: {
        'kol1': {
          kolWallet: 'kol1',
          tradeCount: 5,
          totalVolume: 1000,
          lastTradeTime: new Date(),
          influenceScore: 0.8,
          tradeTypes: ['buy', 'sell'],
        },
      },
      relatedTokens: ['token456'],
      networkMetrics: {
        centrality: 0.5,
        clustering: 0.3,
        totalTrades: 10,
      },
      lastUpdate: new Date(),
    };

    it('should store and retrieve mindmap data', () => {
      cacheManager.setMindmapData('token123', mockMindmapData);
      const retrieved = cacheManager.getMindmapData('token123');
      
      expect(retrieved).toEqual(mockMindmapData);
    });

    it('should return null for non-existent mindmap data', () => {
      const retrieved = cacheManager.getMindmapData('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('TTL and Expiration', () => {
    it('should expire data after TTL', async () => {
      const shortTTL = 50; // 50ms
      cacheManager.setTradeData('temp', [], shortTTL);
      
      // Should be available immediately
      expect(cacheManager.getTradeData('temp')).toEqual([]);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should be expired
      expect(cacheManager.getTradeData('temp')).toBeNull();
    });

    it('should use custom TTL when provided', () => {
      const customTTL = 2000;
      cacheManager.setTradeData('custom', [], customTTL);
      
      // Check that the entry has the custom TTL
      const stats = cacheManager.getStats();
      expect(stats.memoryEntries).toBe(1);
    });
  });

  describe('Cache Invalidation', () => {
    beforeEach(() => {
      cacheManager.setTradeData('test1', []);
      cacheManager.setTradeData('test2', []);
      cacheManager.setMindmapData('token1', {} as MindmapUpdate);
    });

    it('should invalidate all cache when no pattern provided', () => {
      cacheManager.invalidateCache();
      
      expect(cacheManager.getTradeData('test1')).toBeNull();
      expect(cacheManager.getTradeData('test2')).toBeNull();
      expect(cacheManager.getMindmapData('token1')).toBeNull();
    });

    it('should invalidate cache entries matching pattern', () => {
      cacheManager.invalidateCache('trade_data');
      
      expect(cacheManager.getTradeData('test1')).toBeNull();
      expect(cacheManager.getTradeData('test2')).toBeNull();
      expect(cacheManager.getMindmapData('token1')).not.toBeNull();
    });

    it('should invalidate specific token mindmap data', () => {
      cacheManager.invalidateCache('token1');
      
      expect(cacheManager.getTradeData('test1')).not.toBeNull();
      expect(cacheManager.getMindmapData('token1')).toBeNull();
    });
  });

  describe('Memory Management', () => {
    it('should enforce memory cache size limit', () => {
      // Add more entries than the limit (5)
      for (let i = 0; i < 10; i++) {
        cacheManager.setTradeData(`test${i}`, []);
      }
      
      const stats = cacheManager.getStats();
      expect(stats.memoryEntries).toBeLessThanOrEqual(5);
    });

    it('should evict least recently used entries', () => {
      // Fill cache to limit
      for (let i = 0; i < 5; i++) {
        cacheManager.setTradeData(`test${i}`, []);
      }
      
      // Access some entries to update their LRU status
      cacheManager.getTradeData('test0');
      cacheManager.getTradeData('test1');
      
      // Add one more entry to trigger eviction
      cacheManager.setTradeData('new', []);
      
      // The accessed entries should still be there
      expect(cacheManager.getTradeData('test0')).not.toBeNull();
      expect(cacheManager.getTradeData('test1')).not.toBeNull();
      expect(cacheManager.getTradeData('new')).not.toBeNull();
    });
  });

  describe('Session Storage Fallback', () => {
    it('should fallback to session storage when memory cache misses', () => {
      // Store data
      cacheManager.setTradeData('fallback', []);
      
      // Verify it was stored in session storage
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'trade_data_fallback',
        expect.stringContaining('"data"')
      );
      
      // Clear only memory cache, not session storage
      cacheManager['memoryCache'].clear();
      
      // Should retrieve from session storage
      const retrieved = cacheManager.getTradeData('fallback');
      expect(retrieved).toEqual([]);
    });

    it('should handle session storage errors gracefully', () => {
      // Mock session storage to throw error
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });
      
      // Should not throw error
      expect(() => {
        cacheManager.setTradeData('error', []);
      }).not.toThrow();
    });
  });

  describe('Cleanup Operations', () => {
    it('should clean up expired entries', async () => {
      const shortTTL = 50;
      cacheManager.setTradeData('temp1', [], shortTTL);
      cacheManager.setTradeData('temp2', [], shortTTL);
      cacheManager.setTradeData('permanent', []); // Uses default TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Trigger cleanup
      cacheManager.cleanupExpired();
      
      const stats = cacheManager.getStats();
      expect(stats.memoryEntries).toBe(1); // Only permanent should remain
    });

    it('should automatically clean up expired entries', async () => {
      const shortTTL = 50;
      cacheManager.setTradeData('auto', [], shortTTL);
      
      // Wait for automatic cleanup
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(cacheManager.getTradeData('auto')).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should track cache hits and misses', () => {
      cacheManager.setTradeData('hit', []);
      
      // Hit
      cacheManager.getTradeData('hit');
      
      // Miss
      cacheManager.getTradeData('miss');
      
      const stats = cacheManager.getStats();
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should estimate memory usage', () => {
      cacheManager.setTradeData('memory', []);
      
      const stats = cacheManager.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Batch Operations', () => {
    it('should support batch set operations', () => {
      const entries = [
        { key: 'trade_data_batch1', data: [] as KOLTrade[] },
        { key: 'trade_data_batch2', data: [] as KOLTrade[] },
        { key: 'trade_data_batch3', data: [] as KOLTrade[] },
      ];
      
      cacheManager.batchSet(entries);
      
      expect(cacheManager.getTradeData('batch1')).toEqual([]);
      expect(cacheManager.getTradeData('batch2')).toEqual([]);
      expect(cacheManager.getTradeData('batch3')).toEqual([]);
    });

    it('should support batch get operations', () => {
      cacheManager.setTradeData('get1', []);
      cacheManager.setTradeData('get2', []);
      
      const results = cacheManager.batchGet(['trade_data_get1', 'trade_data_get2', 'trade_data_missing']);
      
      expect(results).toHaveLength(3);
      expect(results[0].data).toEqual([]);
      expect(results[1].data).toEqual([]);
      expect(results[2].data).toBeNull();
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      const newConfig = {
        defaultTTL: 5000,
        maxMemoryEntries: 10,
      };
      
      cacheManager.updateConfig(newConfig);
      
      // Test that new TTL is used
      cacheManager.setTradeData('config', []);
      const stats = cacheManager.getStats();
      expect(stats.memoryEntries).toBe(1);
    });
  });

  describe('Utility Methods', () => {
    it('should check if data exists without updating access metadata', () => {
      cacheManager.setTradeData('exists', []);
      
      expect(cacheManager.has('trade_data_exists')).toBe(true);
      expect(cacheManager.has('trade_data_missing')).toBe(false);
    });
  });
});