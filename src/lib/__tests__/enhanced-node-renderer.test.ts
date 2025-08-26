/**
 * Tests for Enhanced Node Renderer
 */

// Mock D3 to avoid DOM dependencies in tests
const mockScale = jest.fn((value) => `#${Math.floor(value * 16).toString(16)}${Math.floor(value * 16).toString(16)}${Math.floor(value * 16).toString(16)}`);
jest.mock('d3', () => ({
  select: jest.fn(() => ({
    selectAll: jest.fn(() => ({
      remove: jest.fn(),
      data: jest.fn(() => ({
        enter: jest.fn(() => ({
          append: jest.fn(() => ({
            attr: jest.fn(() => ({ attr: jest.fn(), style: jest.fn(), transition: jest.fn(() => ({ duration: jest.fn(), style: jest.fn() })) })),
            style: jest.fn(() => ({ attr: jest.fn(), style: jest.fn() })),
            text: jest.fn(() => ({ attr: jest.fn(), style: jest.fn() })),
            html: jest.fn(() => ({ attr: jest.fn(), style: jest.fn() }))
          }))
        }))
      }))
    })),
    append: jest.fn(() => ({
      attr: jest.fn(() => ({ attr: jest.fn(), style: jest.fn(), transition: jest.fn(() => ({ duration: jest.fn(), style: jest.fn() })) })),
      style: jest.fn(() => ({ attr: jest.fn(), style: jest.fn() })),
      text: jest.fn(() => ({ attr: jest.fn(), style: jest.fn() })),
      html: jest.fn(() => ({ attr: jest.fn(), style: jest.fn() }))
    })),
    filter: jest.fn(() => ({
      append: jest.fn(() => ({
        attr: jest.fn(() => ({ attr: jest.fn(), style: jest.fn() })),
        style: jest.fn(() => ({ attr: jest.fn(), style: jest.fn() }))
      }))
    })),
    each: jest.fn()
  })),
  scaleSequential: jest.fn(() => ({
    domain: jest.fn(() => mockScale)
  })),
  interpolateRgb: jest.fn(() => jest.fn()),
  easeLinear: jest.fn(),
  interpolateString: jest.fn(() => jest.fn())
}));

// Mock token store integration
jest.mock('../token-store-integration', () => ({
  tokenStoreIntegrationManager: {
    fetchTokenMetadata: jest.fn(),
    batchFetchTokenMetadata: jest.fn(),
    clearAllCache: jest.fn(),
    getStats: jest.fn(() => ({ cache: { size: 0 } }))
  }
}));

import { EnhancedNodeRenderer, enhancedNodeRenderer } from '../enhanced-node-renderer';
import { EnhancedUnifiedNode, TokenMetadata } from '../../types';
import { tokenStoreIntegrationManager } from '../token-store-integration';

// Mock Image constructor for image loading tests
global.Image = class {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src: string = '';
  
  constructor() {
    // Simulate successful image load after a short delay
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 10);
  }
} as any;

describe('EnhancedNodeRenderer', () => {
  let renderer: EnhancedNodeRenderer;
  let mockTokenStore: any;

  beforeEach(() => {
    renderer = new EnhancedNodeRenderer();
    mockTokenStore = {
      getTokenByMint: jest.fn(),
      trendingTokens: [],
      highVolumeTokens: [],
      latestTokens: [],
      searchResults: []
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    renderer.clearCache();
  });

  describe('createEnhancedTokenNode', () => {
    const mockTokenData = {
      tokenMint: 'TestMint123456789',
      kolConnections: {
        'KOL1': { tradeCount: 5, totalVolume: 1000 },
        'KOL2': { tradeCount: 3, totalVolume: 500 }
      },
      networkMetrics: {
        totalTrades: 1500,
        centrality: 0.8
      }
    };

    const mockTokenMetadata: TokenMetadata = {
      name: 'Test Token',
      symbol: 'TEST',
      image: 'https://example.com/test.png',
      fallbackImage: 'https://fallback.com/test.png',
      lastUpdated: Date.now(),
      decimals: 9,
      verified: true,
      jupiter: true
    };

    it('should create enhanced token node with metadata', async () => {
      (tokenStoreIntegrationManager.fetchTokenMetadata as jest.Mock)
        .mockResolvedValue(mockTokenMetadata);

      const node = await renderer.createEnhancedTokenNode(mockTokenData, mockTokenStore);

      expect(node).toBeDefined();
      expect(node.id).toBe('TestMint123456789');
      expect(node.type).toBe('token');
      expect(node.connections).toBe(2); // Two KOL connections
      expect(node.displayName).toBe('Test Token (TEST)');
      expect(node.displayImage).toBe('https://example.com/test.png');
      expect(node.metadata).toEqual(mockTokenMetadata);
    });

    it('should create fallback node when metadata fetch fails', async () => {
      (tokenStoreIntegrationManager.fetchTokenMetadata as jest.Mock)
        .mockRejectedValue(new Error('Fetch failed'));

      const node = await renderer.createEnhancedTokenNode(mockTokenData, mockTokenStore);

      expect(node).toBeDefined();
      expect(node.id).toBe('TestMint123456789');
      expect(node.type).toBe('token');
      expect(node.displayName).toBe('TestMi...');
      expect(node.displayImage).toBeUndefined();
      expect(node.metadata).toBeUndefined();
    });

    it('should handle token data without KOL connections', async () => {
      const tokenDataWithoutKOLs = {
        tokenMint: 'TestMint123456789',
        kolConnections: {},
        networkMetrics: { totalTrades: 0 }
      };

      (tokenStoreIntegrationManager.fetchTokenMetadata as jest.Mock)
        .mockResolvedValue(null);

      const node = await renderer.createEnhancedTokenNode(tokenDataWithoutKOLs, mockTokenStore);

      expect(node).toBeDefined();
      expect(node.connections).toBe(0);
      expect(node.totalVolume).toBe(0);
      expect(node.tradeCount).toBe(0);
    });

    it('should calculate node value correctly', async () => {
      (tokenStoreIntegrationManager.fetchTokenMetadata as jest.Mock)
        .mockResolvedValue(mockTokenMetadata);

      const node = await renderer.createEnhancedTokenNode(mockTokenData, mockTokenStore);

      expect(node.value).toBeGreaterThan(10); // Should be more than minimum
      expect(typeof node.value).toBe('number');
    });

    it('should handle different display name formats', async () => {
      const testCases = [
        {
          metadata: { name: 'Test Token', symbol: 'TEST', lastUpdated: Date.now() },
          expected: 'Test Token (TEST)'
        },
        {
          metadata: { name: 'Test Token', lastUpdated: Date.now() },
          expected: 'Test Token'
        },
        {
          metadata: { symbol: 'TEST', lastUpdated: Date.now() },
          expected: 'TEST'
        },
        {
          metadata: null,
          expected: 'TestMi...'
        }
      ];

      for (const testCase of testCases) {
        (tokenStoreIntegrationManager.fetchTokenMetadata as jest.Mock)
          .mockResolvedValue(testCase.metadata);

        const node = await renderer.createEnhancedTokenNode(mockTokenData, mockTokenStore);
        expect(node.displayName).toBe(testCase.expected);
      }
    });
  });

  describe('image loading and caching', () => {
    it('should cache image loading results', async () => {
      // Test the cache functionality by checking initial state and after clearing
      const initialStats = renderer.getCacheStats();
      expect(initialStats.imageCache.size).toBe(0);
      
      // Simulate adding to cache (since preloadImage is private)
      const imageCache = (renderer as any).imageCache;
      imageCache.set('test-url', { loaded: true, error: false, url: 'test-url' });
      
      const updatedStats = renderer.getCacheStats();
      expect(updatedStats.imageCache.size).toBe(1);
      expect(updatedStats.imageCache.loadedImages).toBe(1);
    });

    it('should handle image loading errors', async () => {
      // Mock Image to simulate error
      const originalImage = global.Image;
      global.Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src: string = '';
        
        constructor() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 10);
        }
      } as any;

      const imageUrl = 'https://example.com/broken.png';
      
      try {
        await (renderer as any).preloadImage(imageUrl);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // Restore original Image
      global.Image = originalImage;
    });

    it('should handle image loading timeout', async () => {
      // Mock Image to never load
      const originalImage = global.Image;
      global.Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src: string = '';
      } as any;

      const imageUrl = 'https://example.com/timeout.png';
      
      try {
        await (renderer as any).preloadImage(imageUrl);
        fail('Should have thrown a timeout error');
      } catch (error) {
        expect(error.message).toContain('timeout');
      }

      // Restore original Image
      global.Image = originalImage;
    }, 10000); // Increase timeout for this test
  });

  describe('node styling calculations', () => {
    const createTestNode = (overrides: Partial<EnhancedUnifiedNode> = {}): EnhancedUnifiedNode => ({
      id: 'test-mint',
      type: 'token',
      label: 'Test Token',
      value: 10,
      connections: 5,
      displayName: 'Test Token',
      ...overrides
    });

    it('should calculate token radius correctly', () => {
      const node = createTestNode({ connections: 5, totalVolume: 1000 });
      const radius = (renderer as any).calculateTokenRadius(node);
      
      expect(radius).toBeGreaterThan(20); // Base size
      expect(radius).toBeLessThanOrEqual(50); // Max size
    });

    it('should apply verified token bonus', () => {
      const regularNode = createTestNode({ connections: 5 });
      const verifiedNode = createTestNode({ 
        connections: 5, 
        metadata: { verified: true, lastUpdated: Date.now() } 
      });
      
      const regularRadius = (renderer as any).calculateTokenRadius(regularNode);
      const verifiedRadius = (renderer as any).calculateTokenRadius(verifiedNode);
      
      expect(verifiedRadius).toBeGreaterThan(regularRadius);
    });

    it('should get correct token colors', () => {
      const trendingNode = createTestNode({ isTrending: true });
      const verifiedNode = createTestNode({ 
        metadata: { verified: true, lastUpdated: Date.now() } 
      });
      const regularNode = createTestNode();
      
      const trendingColor = (renderer as any).getTokenColor(trendingNode);
      const verifiedColor = (renderer as any).getTokenColor(verifiedNode);
      const regularColor = (renderer as any).getTokenColor(regularNode);
      
      expect(trendingColor).toBe('#14F195');
      expect(verifiedColor).toBe('#9945FF');
      expect(typeof regularColor).toBe('string');
    });

    it('should apply correct filters', () => {
      const highConnectionNode = createTestNode({ connections: 10 });
      const trendingNode = createTestNode({ isTrending: true });
      const regularNode = createTestNode({ connections: 2 });
      
      const highConnectionFilter = (renderer as any).getTokenFilter(highConnectionNode);
      const trendingFilter = (renderer as any).getTokenFilter(trendingNode);
      const regularFilter = (renderer as any).getTokenFilter(regularNode);
      
      expect(highConnectionFilter).toContain('drop-shadow');
      expect(trendingFilter).toContain('drop-shadow');
      expect(regularFilter).toBe('none');
    });
  });

  describe('label formatting', () => {
    it('should format token labels correctly', () => {
      const nodeWithSymbol = {
        id: 'test-mint',
        connections: 5,
        metadata: { symbol: 'TEST', lastUpdated: Date.now() }
      } as EnhancedUnifiedNode;
      
      const nodeWithoutSymbol = {
        id: 'test-mint-long-address',
        connections: 3
      } as EnhancedUnifiedNode;
      
      const labelWithSymbol = (renderer as any).formatTokenLabel(nodeWithSymbol);
      const labelWithoutSymbol = (renderer as any).formatTokenLabel(nodeWithoutSymbol);
      
      expect(labelWithSymbol).toBe('TEST (5)');
      expect(labelWithoutSymbol).toBe('test-m... (3)');
    });

    it('should create fallback labels', () => {
      const label = (renderer as any).createFallbackTokenLabel('TestMintAddress123456789');
      expect(label).toBe('TestMi...');
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      const stats = renderer.getCacheStats();
      
      expect(stats).toHaveProperty('imageCache');
      expect(stats).toHaveProperty('loadingImages');
      expect(stats.imageCache).toHaveProperty('size');
      expect(stats.imageCache).toHaveProperty('loadedImages');
      expect(stats.imageCache).toHaveProperty('errorImages');
    });

    it('should clear cache correctly', () => {
      renderer.clearCache();
      const stats = renderer.getCacheStats();
      
      expect(stats.imageCache.size).toBe(0);
      expect(stats.loadingImages).toBe(0);
    });
  });
});

describe('enhancedNodeRenderer singleton', () => {
  it('should export a singleton instance', () => {
    expect(enhancedNodeRenderer).toBeInstanceOf(EnhancedNodeRenderer);
  });

  it('should maintain state across imports', () => {
    const stats1 = enhancedNodeRenderer.getCacheStats();
    enhancedNodeRenderer.clearCache();
    const stats2 = enhancedNodeRenderer.getCacheStats();
    
    expect(stats2.imageCache.size).toBe(0);
  });
});