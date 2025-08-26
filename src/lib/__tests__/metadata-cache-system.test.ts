/**
 * Comprehensive tests for the metadata cache system
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  MetadataCacheManager, 
  TokenMetadata, 
  KOLMetadata 
} from '../metadata-cache-manager';
import { 
  TokenStoreIntegration, 
  KOLStoreIntegration, 
  MetadataIntegration 
} from '../metadata-store-integration';
import { 
  CacheOptimizationManager, 
  CacheSharing 
} from '../cache-optimization';

// Mock the stores
jest.mock('@/stores/use-token-store', () => ({
  useTokenStore: {
    getState: () => ({
      tokenCache: new Map([
        ['token1', { mint: 'token1', name: 'Test Token', symbol: 'TEST', image: 'test.png' }],
        ['token2', { mint: 'token2', name: 'Another Token', symbol: 'ANOTHER', image: 'another.png' }],
      ]),
    }),
  },
}));

jest.mock('@/stores/use-kol-store', () => ({
  useKOLStore: {
    getState: () => ({
      getKOL: (address: string) => {
        const kols = {
          'kol1': { 
            walletAddress: 'kol1', 
            name: 'Test KOL', 
            avatar: 'kol1.png',
            twitterHandle: 'testkol'
          },
          'kol2': { 
            walletAddress: 'kol2', 
            name: 'Another KOL', 
            avatar: 'kol2.png',
            telegramHandle: 'anotherkol'
          },
        };
        return kols[address as keyof typeof kols];
      },
      ensureKOL: async (address: string) => {
        const kols = {
          'kol1': { 
            walletAddress: 'kol1', 
            name: 'Test KOL', 
            avatar: 'kol1.png',
            twitterHandle: 'testkol'
          },
          'kol2': { 
            walletAddress: 'kol2', 
            name: 'Another KOL', 
            avatar: 'kol2.png',
            telegramHandle: 'anotherkol'
          },
        };
        return kols[address as keyof typeof kols];
      },
    }),
  },
}));

describe('MetadataCacheManager', () => {
  let cacheManager: MetadataCacheManager;

  beforeEach(() => {
    cacheManager = new MetadataCacheManager({
      defaultTTL: 1000, // 1 second for testing
      maxMemoryEntries: 10,
      enableSessionStorage: false, // Disable for testing
    });
  });

  afterEach(() => {
    cacheManager.destroy();
  });

  describe('Token Metadata Caching', () => {
    it('should cache and retrieve token metadata', async () => {
      const tokenMetadata: TokenMetadata = {
        mint: 'test-token',
        name: 'Test Token',
        symbol: 'TEST',
        image: 'test.png',
        fallbackImage: 'fallback.png',
        lastUpdated: Date.now(),
      };

      // Cache the metadata
      cacheManager.cacheTokenMetadata('test-token', tokenMetadata);

      // Retrieve from cache
      const cached = await cacheManager.getTokenMetadata('test-token');
      expect(cached).toEqual(expect.objectContaining({
        mint: 'test-token',
        name: 'Test Token',
        symbol: 'TEST',
        image: 'test.png',
      }));
    });

    it('should handle cache misses gracefully', async () => {
      const result = await cacheManager.getTokenMetadata('non-existent-token');
      expect(result).toBeNull();
    });

    it('should batch get token metadata', async () => {
      const tokens = ['token1', 'token2'];
      const results = await cacheManager.batchGetTokenMetadata(tokens);
      
      expect(results.size).toBe(2);
      expect(results.has('token1')).toBe(true);
      expect(results.has('token2')).toBe(true);
    });
  });

  describe('KOL Metadata Caching', () => {
    it('should cache and retrieve KOL metadata', async () => {
      const kolMetadata: KOLMetadata = {
        walletAddress: 'test-kol',
        name: 'Test KOL',
        avatar: 'kol.png',
        socialLinks: {
          twitter: 'https://twitter.com/testkol',
        },
        fallbackAvatar: 'fallback.png',
        lastUpdated: Date.now(),
      };

      // Cache the metadata
      cacheManager.cacheKOLMetadata('test-kol', kolMetadata);

      // Retrieve from cache
      const cached = await cacheManager.getKOLMetadata('test-kol');
      expect(cached).toEqual(expect.objectContaining({
        walletAddress: 'test-kol',
        name: 'Test KOL',
        avatar: 'kol.png',
      }));
    });

    it('should generate fallback avatars', () => {
      const avatar = cacheManager.generateFallbackAvatar('test-wallet-address');
      expect(avatar).toContain('data:image/svg+xml');
      expect(avatar).toContain('TE'); // First two characters
    });

    it('should batch get KOL metadata', async () => {
      const addresses = ['kol1', 'kol2'];
      const results = await cacheManager.batchGetKOLMetadata(addresses);
      
      expect(results.size).toBe(2);
      expect(results.has('kol1')).toBe(true);
      expect(results.has('kol2')).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should invalidate cache by type', () => {
      // Cache some data
      cacheManager.cacheTokenMetadata('token1', {
        mint: 'token1',
        name: 'Token 1',
        symbol: 'T1',
        lastUpdated: Date.now(),
      });

      cacheManager.cacheKOLMetadata('kol1', {
        walletAddress: 'kol1',
        name: 'KOL 1',
        lastUpdated: Date.now(),
      });

      // Invalidate token cache only
      cacheManager.invalidateMetadataCache('token');

      // Token should be gone, KOL should remain
      expect(cacheManager.has('token_metadata_token1')).toBe(false);
      // Note: has() method would need to be exposed for this test to work properly
    });

    it('should provide cache statistics', () => {
      const stats = cacheManager.getMetadataStats();
      expect(stats).toHaveProperty('tokenCacheEntries');
      expect(stats).toHaveProperty('kolCacheEntries');
      expect(stats).toHaveProperty('tokenHitRate');
      expect(stats).toHaveProperty('kolHitRate');
    });
  });
});

describe('TokenStoreIntegration', () => {
  it('should get token metadata from store', async () => {
    const metadata = await TokenStoreIntegration.getTokenMetadata('token1');
    expect(metadata).toEqual(expect.objectContaining({
      mint: 'token1',
      name: 'Test Token',
      symbol: 'TEST',
    }));
  });

  it('should batch get token metadata from store', async () => {
    const results = await TokenStoreIntegration.batchGetTokenMetadata(['token1', 'token2']);
    expect(results.size).toBe(2);
    expect(results.get('token1')).toEqual(expect.objectContaining({
      name: 'Test Token',
      symbol: 'TEST',
    }));
  });

  it('should enrich token data with metadata', async () => {
    const tokenData = { mint: 'token1' };
    const enriched = await TokenStoreIntegration.enrichTokenWithMetadata(tokenData);
    expect(enriched).toEqual(expect.objectContaining({
      mint: 'token1',
    }));
  });
});

describe('KOLStoreIntegration', () => {
  it('should get KOL metadata from store', async () => {
    const metadata = await KOLStoreIntegration.getKOLMetadata('kol1');
    expect(metadata).toEqual(expect.objectContaining({
      walletAddress: 'kol1',
      name: 'Test KOL',
    }));
  });

  it('should batch get KOL metadata from store', async () => {
    const results = await KOLStoreIntegration.batchGetKOLMetadata(['kol1', 'kol2']);
    expect(results.size).toBe(2);
    expect(results.get('kol1')).toEqual(expect.objectContaining({
      name: 'Test KOL',
    }));
  });

  it('should generate display names', () => {
    const metadata: KOLMetadata = {
      walletAddress: 'very-long-wallet-address-here',
      name: 'Test KOL',
      lastUpdated: Date.now(),
    };

    const displayName = KOLStoreIntegration.generateDisplayName(metadata);
    expect(displayName).toBe('Test KOL');

    // Test fallback to truncated address
    const metadataNoName: KOLMetadata = {
      walletAddress: 'very-long-wallet-address-here',
      lastUpdated: Date.now(),
    };

    const fallbackName = KOLStoreIntegration.generateDisplayName(metadataNoName);
    expect(fallbackName).toBe('very-l...here');
  });
});

describe('MetadataIntegration', () => {
  it('should preload mindmap metadata', async () => {
    const mindmapData = [
      { tokenMint: 'token1', kolWallet: 'kol1' },
      { tokenMint: 'token2', kolWallet: 'kol2' },
    ];

    const { tokenMetadata, kolMetadata } = await MetadataIntegration.preloadMindmapMetadata(mindmapData);
    
    expect(tokenMetadata.size).toBe(2);
    expect(kolMetadata.size).toBe(2);
    expect(tokenMetadata.has('token1')).toBe(true);
    expect(kolMetadata.has('kol1')).toBe(true);
  });

  it('should get metadata statistics', () => {
    const stats = MetadataIntegration.getMetadataStatistics();
    expect(stats).toHaveProperty('tokenCacheEntries');
    expect(stats).toHaveProperty('kolCacheEntries');
    expect(stats).toHaveProperty('totalMetadataEntries');
  });
});

describe('CacheOptimizationManager', () => {
  let optimizationManager: CacheOptimizationManager;

  beforeEach(() => {
    optimizationManager = new CacheOptimizationManager({
      enableAutoCleanup: false, // Disable for testing
    });
  });

  afterEach(() => {
    optimizationManager.destroy();
  });

  it('should get memory usage statistics', () => {
    const memoryStats = optimizationManager.getMemoryUsage();
    expect(memoryStats).toHaveProperty('usedJSHeapSize');
    expect(memoryStats).toHaveProperty('totalJSHeapSize');
    expect(memoryStats).toHaveProperty('usagePercentage');
    expect(memoryStats).toHaveProperty('isHighUsage');
  });

  it('should get cache performance metrics', () => {
    const metrics = optimizationManager.getCachePerformanceMetrics();
    expect(metrics).toHaveProperty('memoryStats');
    expect(metrics).toHaveProperty('metadataStats');
    expect(metrics).toHaveProperty('cacheEfficiency');
    expect(metrics).toHaveProperty('recommendedActions');
    expect(Array.isArray(metrics.recommendedActions)).toBe(true);
  });

  it('should perform cache optimization', () => {
    // This should not throw
    expect(() => optimizationManager.optimizeCache()).not.toThrow();
  });

  it('should handle memory pressure callbacks', () => {
    let callbackCalled = false;
    const callback = () => { callbackCalled = true; };

    optimizationManager.onMemoryPressure(callback);
    
    // Simulate memory pressure (this would normally be called internally)
    optimizationManager['notifyMemoryPressure']();
    
    expect(callbackCalled).toBe(true);

    // Test unsubscribe
    optimizationManager.offMemoryPressure(callback);
  });
});

describe('CacheSharing', () => {
  afterEach(() => {
    CacheSharing.clearSharedData();
  });

  it('should share and retrieve data', () => {
    const testData = { test: 'data' };
    CacheSharing.shareData('test-key', testData);
    
    const retrieved = CacheSharing.getSharedData('test-key');
    expect(retrieved).toEqual(testData);
  });

  it('should handle subscriptions', () => {
    let receivedData: any = null;
    const unsubscribe = CacheSharing.subscribe('test-key', (data) => {
      receivedData = data;
    });

    const testData = { test: 'subscription-data' };
    CacheSharing.shareData('test-key', testData);
    
    expect(receivedData).toEqual(testData);

    // Test unsubscribe
    unsubscribe();
    
    // Should not receive new data after unsubscribe
    receivedData = null;
    CacheSharing.shareData('test-key', { test: 'new-data' });
    expect(receivedData).toBeNull();
  });

  it('should clear shared data', () => {
    CacheSharing.shareData('key1', { data: 1 });
    CacheSharing.shareData('key2', { data: 2 });
    
    expect(CacheSharing.getSharedData('key1')).toBeTruthy();
    expect(CacheSharing.getSharedData('key2')).toBeTruthy();
    
    CacheSharing.clearSharedData('key1');
    expect(CacheSharing.getSharedData('key1')).toBeNull();
    expect(CacheSharing.getSharedData('key2')).toBeTruthy();
    
    CacheSharing.clearSharedData();
    expect(CacheSharing.getSharedData('key2')).toBeNull();
  });
});

describe('Integration Tests', () => {
  it('should work end-to-end with real data flow', async () => {
    const cacheManager = new MetadataCacheManager({
      enableSessionStorage: false,
    });

    try {
      // Test token flow
      const tokenMetadata = await TokenStoreIntegration.getTokenMetadata('token1');
      expect(tokenMetadata).toBeTruthy();
      expect(tokenMetadata?.name).toBe('Test Token');

      // Test KOL flow
      const kolMetadata = await KOLStoreIntegration.getKOLMetadata('kol1');
      expect(kolMetadata).toBeTruthy();
      expect(kolMetadata?.name).toBe('Test KOL');

      // Test batch operations
      const batchTokens = await TokenStoreIntegration.batchGetTokenMetadata(['token1', 'token2']);
      expect(batchTokens.size).toBe(2);

      const batchKOLs = await KOLStoreIntegration.batchGetKOLMetadata(['kol1', 'kol2']);
      expect(batchKOLs.size).toBe(2);

      // Test mindmap preloading
      const mindmapData = [
        { tokenMint: 'token1', kolWallet: 'kol1' },
        { tokenMint: 'token2', kolWallet: 'kol2' },
      ];

      const preloaded = await MetadataIntegration.preloadMindmapMetadata(mindmapData);
      expect(preloaded.tokenMetadata.size).toBe(2);
      expect(preloaded.kolMetadata.size).toBe(2);

    } finally {
      cacheManager.destroy();
    }
  });
});