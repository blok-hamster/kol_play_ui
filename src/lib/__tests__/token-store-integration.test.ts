/**
 * Tests for Token Store Integration Manager
 */

// Mock the token store to avoid Solana dependencies in tests
jest.mock('../../stores/use-token-store', () => ({
  useTokenStore: jest.fn()
}));

import { 
  TokenStoreIntegrationManager, 
  tokenStoreIntegrationManager,
  enrichMindmapWithTokenMetadata 
} from '../token-store-integration';
import { SearchTokenResult, TokenMetadata } from '../../types';

// Mock token store
const createMockTokenStore = (tokens: SearchTokenResult[] = []) => ({
  getTokenByMint: jest.fn((mint: string) => tokens.find(t => t.mint === mint) || null),
  trendingTokens: tokens.filter(t => t.verified),
  highVolumeTokens: tokens.filter(t => t.volume_24h > 1000),
  latestTokens: tokens.slice(0, 5),
  searchResults: tokens
});

// Mock token data
const mockTokens: SearchTokenResult[] = [
  {
    name: 'Test Token',
    symbol: 'TEST',
    mint: 'TestMint123456789',
    decimals: 9,
    image: 'https://example.com/test.png',
    holders: 1000,
    jupiter: true,
    verified: true,
    liquidityUsd: 50000,
    marketCapUsd: 100000,
    priceUsd: 0.1,
    lpBurn: 100,
    market: 'raydium',
    freezeAuthority: null,
    mintAuthority: null,
    poolAddress: 'pool123',
    totalBuys: 100,
    totalSells: 50,
    totalTransactions: 150,
    volume_5m: 1000,
    volume: 5000,
    volume_15m: 1500,
    volume_30m: 2000,
    volume_1h: 3000,
    volume_6h: 4000,
    volume_12h: 4500,
    volume_24h: 5000
  },
  {
    name: 'Another Token',
    symbol: 'ANOTHER',
    mint: 'AnotherMint987654321',
    decimals: 6,
    image: 'https://example.com/another.png',
    holders: 500,
    jupiter: false,
    verified: false,
    liquidityUsd: 25000,
    marketCapUsd: 50000,
    priceUsd: 0.05,
    lpBurn: 50,
    market: 'orca',
    freezeAuthority: null,
    mintAuthority: null,
    poolAddress: 'pool456',
    totalBuys: 75,
    totalSells: 25,
    totalTransactions: 100,
    volume_5m: 500,
    volume: 2500,
    volume_15m: 750,
    volume_30m: 1000,
    volume_1h: 1500,
    volume_6h: 2000,
    volume_12h: 2250,
    volume_24h: 2500
  }
];

describe('TokenStoreIntegrationManager', () => {
  let manager: TokenStoreIntegrationManager;
  let mockTokenStore: ReturnType<typeof createMockTokenStore>;

  beforeEach(() => {
    manager = new TokenStoreIntegrationManager();
    mockTokenStore = createMockTokenStore(mockTokens);
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.clearAllCache();
  });

  describe('fetchTokenMetadata', () => {
    it('should fetch token metadata from store successfully', async () => {
      const metadata = await manager.fetchTokenMetadata('TestMint123456789', mockTokenStore);

      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('Test Token');
      expect(metadata?.symbol).toBe('TEST');
      expect(metadata?.image).toBe('https://example.com/test.png');
      expect(metadata?.verified).toBe(true);
      expect(metadata?.jupiter).toBe(true);
      expect(mockTokenStore.getTokenByMint).toHaveBeenCalledWith('TestMint123456789');
    });

    it('should return cached metadata on subsequent calls', async () => {
      // First call
      const metadata1 = await manager.fetchTokenMetadata('TestMint123456789', mockTokenStore);
      
      // Second call
      const metadata2 = await manager.fetchTokenMetadata('TestMint123456789', mockTokenStore);

      expect(metadata1?.name).toBe(metadata2?.name);
      expect(metadata1?.symbol).toBe(metadata2?.symbol);
      expect(metadata1?.image).toBe(metadata2?.image);
      expect(mockTokenStore.getTokenByMint).toHaveBeenCalledTimes(1); // Only called once
      
      const stats = manager.getStats();
      expect(stats.cache.hitRate).toBe(0.5); // 1 hit out of 2 requests
    });

    it('should create fallback metadata when token not found in store', async () => {
      const metadata = await manager.fetchTokenMetadata('UnknownMint', mockTokenStore);

      expect(metadata).toBeDefined();
      expect(metadata?.name).toBeUndefined();
      expect(metadata?.symbol).toBeUndefined();
      expect(metadata?.fallbackImage).toContain('dicebear.com');
      expect(metadata?.verified).toBe(false);
      expect(metadata?.decimals).toBe(9); // Default Solana decimals
    });

    it('should work without token store and return fallback', async () => {
      const metadata = await manager.fetchTokenMetadata('TestMint123456789');

      expect(metadata).toBeDefined();
      expect(metadata?.name).toBeUndefined();
      expect(metadata?.symbol).toBeUndefined();
      expect(metadata?.fallbackImage).toContain('dicebear.com');
    });

    it('should handle errors gracefully', async () => {
      const errorStore = {
        ...mockTokenStore,
        getTokenByMint: jest.fn(() => { throw new Error('Store error'); })
      };

      const metadata = await manager.fetchTokenMetadata('TestMint123456789', errorStore);

      expect(metadata).toBeDefined();
      expect(metadata?.name).toBeUndefined();
      expect(metadata?.fallbackImage).toContain('dicebear.com');
      
      const stats = manager.getStats();
      expect(stats.errors).toBeGreaterThanOrEqual(1);
    });
  });

  describe('batchFetchTokenMetadata', () => {
    it('should fetch metadata for multiple tokens', async () => {
      const mints = ['TestMint123456789', 'AnotherMint987654321'];
      const metadataMap = await manager.batchFetchTokenMetadata(mints, mockTokenStore);

      expect(metadataMap.size).toBe(2);
      expect(metadataMap.get('TestMint123456789')?.name).toBe('Test Token');
      expect(metadataMap.get('AnotherMint987654321')?.name).toBe('Another Token');
    });

    it('should handle mix of found and not found tokens', async () => {
      const mints = ['TestMint123456789', 'UnknownMint'];
      const metadataMap = await manager.batchFetchTokenMetadata(mints, mockTokenStore);

      expect(metadataMap.size).toBe(2);
      expect(metadataMap.get('TestMint123456789')?.name).toBe('Test Token');
      expect(metadataMap.get('UnknownMint')?.name).toBeUndefined();
      expect(metadataMap.get('UnknownMint')?.fallbackImage).toContain('dicebear.com');
    });

    it('should process large batches efficiently', async () => {
      const mints = Array.from({ length: 25 }, (_, i) => `Mint${i}`);
      const metadataMap = await manager.batchFetchTokenMetadata(mints, mockTokenStore);

      expect(metadataMap.size).toBe(25);
      // All should have fallback metadata since they're not in the mock store
      Array.from(metadataMap.values()).forEach(metadata => {
        expect(metadata.fallbackImage).toContain('dicebear.com');
      });
    });
  });

  describe('cache management', () => {
    it('should respect cache TTL', async () => {
      // Create manager with very short TTL for testing
      const shortTTLManager = new TokenStoreIntegrationManager(100, 100); // 100ms TTL
      
      await shortTTLManager.fetchTokenMetadata('TestMint123456789', mockTokenStore);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      await shortTTLManager.fetchTokenMetadata('TestMint123456789', mockTokenStore);
      
      expect(mockTokenStore.getTokenByMint).toHaveBeenCalledTimes(2); // Called twice due to expiration
      
      shortTTLManager.clearAllCache();
    });

    it('should implement LRU eviction when cache is full', async () => {
      // Create manager with small cache size
      const smallCacheManager = new TokenStoreIntegrationManager(2, 60000);
      
      // Fill cache beyond capacity
      await smallCacheManager.fetchTokenMetadata('Mint1', mockTokenStore);
      await smallCacheManager.fetchTokenMetadata('Mint2', mockTokenStore);
      await smallCacheManager.fetchTokenMetadata('Mint3', mockTokenStore); // Should evict Mint1
      
      const stats = smallCacheManager.getStats();
      expect(stats.cache.size).toBeLessThanOrEqual(2); // Cache size should be limited
      
      smallCacheManager.clearAllCache();
    });

    it('should provide detailed cache information', () => {
      const cacheInfo = manager.getDetailedCacheInfo();
      
      expect(cacheInfo).toHaveProperty('size');
      expect(cacheInfo).toHaveProperty('maxSize');
      expect(cacheInfo).toHaveProperty('entries');
      expect(cacheInfo).toHaveProperty('stats');
      expect(Array.isArray(cacheInfo.entries)).toBe(true);
    });
  });

  describe('fallback image generation', () => {
    it('should generate consistent fallback images', async () => {
      const metadata1 = await manager.fetchTokenMetadata('UnknownMint', mockTokenStore);
      const metadata2 = await manager.fetchTokenMetadata('UnknownMint', mockTokenStore);

      expect(metadata1?.fallbackImage).toBe(metadata2?.fallbackImage);
      expect(metadata1?.fallbackImage).toContain('dicebear.com');
      expect(metadata1?.fallbackImage).toContain('unknownmint');
    });

    it('should handle special characters in identifiers', async () => {
      const metadata = await manager.fetchTokenMetadata('Test-Token_123!@#', mockTokenStore);

      expect(metadata?.fallbackImage).toContain('dicebear.com');
      expect(metadata?.fallbackImage).toContain('testtoken123'); // Special chars removed
    });
  });

  describe('statistics and monitoring', () => {
    it('should track cache hit/miss rates', async () => {
      await manager.fetchTokenMetadata('TestMint123456789', mockTokenStore); // Miss
      await manager.fetchTokenMetadata('TestMint123456789', mockTokenStore); // Hit
      await manager.fetchTokenMetadata('AnotherMint987654321', mockTokenStore); // Miss

      const stats = manager.getStats();
      expect(stats.cache.hitRate).toBe(1/3); // 1 hit out of 3 requests
      expect(stats.cache.missRate).toBe(2/3); // 2 misses out of 3 requests
      expect(stats.totalRequests).toBe(3);
    });

    it('should track store hit/miss rates', async () => {
      await manager.fetchTokenMetadata('TestMint123456789', mockTokenStore); // Store hit
      await manager.fetchTokenMetadata('UnknownMint', mockTokenStore); // Store miss

      const stats = manager.getStats();
      expect(stats.store.hits).toBe(1);
      expect(stats.store.misses).toBe(1);
      expect(stats.store.hitRate).toBe(0.5);
    });

    it('should track fallback usage', async () => {
      await manager.fetchTokenMetadata('UnknownMint1', mockTokenStore);
      await manager.fetchTokenMetadata('UnknownMint2', mockTokenStore);

      const stats = manager.getStats();
      expect(stats.fallbacks).toBe(2);
    });
  });
});

describe('enrichMindmapWithTokenMetadata', () => {
  let mockTokenStore: ReturnType<typeof createMockTokenStore>;

  beforeEach(() => {
    mockTokenStore = createMockTokenStore(mockTokens);
    tokenStoreIntegrationManager.clearAllCache();
  });

  it('should enrich mindmap data with token metadata', async () => {
    const mindmapData = {
      'TestMint123456789': {
        tokenMint: 'TestMint123456789',
        kolConnections: {
          'KOL1': { tradeCount: 5, totalVolume: 1000 }
        }
      },
      'AnotherMint987654321': {
        tokenMint: 'AnotherMint987654321',
        kolConnections: {
          'KOL2': { tradeCount: 3, totalVolume: 500 }
        }
      }
    };

    const enrichedData = await enrichMindmapWithTokenMetadata(mindmapData, mockTokenStore);

    expect(enrichedData['TestMint123456789']).toHaveProperty('tokenMetadata');
    expect(enrichedData['TestMint123456789']).toHaveProperty('displayName');
    expect(enrichedData['TestMint123456789']).toHaveProperty('displayImage');
    
    expect(enrichedData['TestMint123456789'].displayName).toBe('Test Token (TEST)');
    expect(enrichedData['TestMint123456789'].tokenMetadata.name).toBe('Test Token');
    expect(enrichedData['TestMint123456789'].tokenMetadata.symbol).toBe('TEST');
  });

  it('should handle tokens not found in store', async () => {
    const mindmapData = {
      'UnknownMint': {
        tokenMint: 'UnknownMint',
        kolConnections: {
          'KOL1': { tradeCount: 1, totalVolume: 100 }
        }
      }
    };

    const enrichedData = await enrichMindmapWithTokenMetadata(mindmapData, mockTokenStore);

    expect(enrichedData['UnknownMint']).toHaveProperty('tokenMetadata');
    expect(enrichedData['UnknownMint']).toHaveProperty('displayName');
    expect(enrichedData['UnknownMint']).toHaveProperty('displayImage');
    
    expect(enrichedData['UnknownMint'].displayName).toBe('Unknow...');
    expect(enrichedData['UnknownMint'].tokenMetadata.name).toBeUndefined();
    expect(enrichedData['UnknownMint'].displayImage).toContain('dicebear.com');
  });

  it('should preserve original mindmap data structure', async () => {
    const mindmapData = {
      'TestMint123456789': {
        tokenMint: 'TestMint123456789',
        kolConnections: {
          'KOL1': { tradeCount: 5, totalVolume: 1000 }
        },
        networkMetrics: {
          centrality: 0.8,
          clustering: 0.6
        }
      }
    };

    const enrichedData = await enrichMindmapWithTokenMetadata(mindmapData, mockTokenStore);

    // Original data should be preserved
    expect(enrichedData['TestMint123456789'].kolConnections).toEqual(mindmapData['TestMint123456789'].kolConnections);
    expect(enrichedData['TestMint123456789'].networkMetrics).toEqual(mindmapData['TestMint123456789'].networkMetrics);
    
    // New metadata should be added
    expect(enrichedData['TestMint123456789']).toHaveProperty('tokenMetadata');
    expect(enrichedData['TestMint123456789']).toHaveProperty('displayName');
  });
});