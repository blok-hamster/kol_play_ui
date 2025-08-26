import { 
  dataFilterManager, 
  metadataCacheManager, 
  unifiedMindmapEnhancementManager,
  MINDMAP_FILTER_CONFIG 
} from '../mindmap-enhancement-core';

describe('Mindmap Enhancement Core', () => {
  describe('Constants', () => {
    it('should have correct Solana base token mint', () => {
      expect(MINDMAP_FILTER_CONFIG.SOLANA_BASE_TOKEN_MINT).toBe('So11111111111111111111111111111111111111112');
    });

    it('should have reasonable cache configuration', () => {
      expect(MINDMAP_FILTER_CONFIG.METADATA_CACHE_TTL).toBeGreaterThan(0);
      expect(MINDMAP_FILTER_CONFIG.METADATA_CACHE_MAX_SIZE).toBeGreaterThan(0);
    });
  });

  describe('DataFilterManager', () => {
    it('should identify Solana base token as invalid', () => {
      expect(dataFilterManager.isValidToken('So11111111111111111111111111111111111111112')).toBe(false);
    });

    it('should identify other tokens as valid', () => {
      expect(dataFilterManager.isValidToken('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true);
    });

    it('should validate KOL connections with sufficient activity', () => {
      const validKOL = {
        tradeCount: 5,
        totalVolume: 1.0,
        influenceScore: 50
      };
      expect(dataFilterManager.hasValidConnections(validKOL)).toBe(true);
    });

    it('should reject KOL connections with insufficient activity', () => {
      const invalidKOL = {
        tradeCount: 0,
        totalVolume: 0,
        influenceScore: 0
      };
      expect(dataFilterManager.hasValidConnections(invalidKOL)).toBe(false);
    });
  });

  describe('MetadataCacheManager', () => {
    beforeEach(() => {
      metadataCacheManager.clearAllCache();
    });

    it('should cache and retrieve token metadata', () => {
      const tokenMetadata = {
        name: 'Test Token',
        symbol: 'TEST',
        image: 'https://example.com/test.png',
        fallbackImage: 'https://example.com/fallback.png',
        lastUpdated: Date.now()
      };

      metadataCacheManager.cacheTokenMetadata('test-mint', tokenMetadata);
      const retrieved = metadataCacheManager.getTokenMetadata('test-mint');
      
      expect(retrieved).toEqual(expect.objectContaining({
        name: 'Test Token',
        symbol: 'TEST'
      }));
    });

    it('should return null for non-existent cache entries', () => {
      const result = metadataCacheManager.getTokenMetadata('non-existent');
      expect(result).toBeNull();
    });

    it('should generate fallback images for tokens', () => {
      const tokenData = {
        name: 'Test Token',
        symbol: 'TEST',
        mint: 'test-mint',
        decimals: 9,
        image: '',
        holders: 100,
        verified: false,
        jupiter: false,
        liquidityUsd: 1000,
        marketCapUsd: 10000,
        priceUsd: 0.1
      };

      const enriched = metadataCacheManager.enrichTokenWithStoreData(tokenData);
      expect(enriched.fallbackImage).toContain('dicebear.com');
    });
  });

  describe('UnifiedMindmapEnhancementManager', () => {
    it('should initialize with default managers', () => {
      expect(unifiedMindmapEnhancementManager.dataFilter).toBeDefined();
      expect(unifiedMindmapEnhancementManager.metadataCache).toBeDefined();
      expect(unifiedMindmapEnhancementManager.storeIntegration).toBeDefined();
    });

    it('should provide enhancement statistics', () => {
      const stats = unifiedMindmapEnhancementManager.getEnhancementStats();
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('integration');
      expect(stats).toHaveProperty('constants');
    });
  });

  describe('Integration', () => {
    it('should filter Solana base token from sample data', () => {
      const sampleData = {
        'So11111111111111111111111111111111111111112': {
          tokenMint: 'So11111111111111111111111111111111111111112',
          kolConnections: {
            'test-kol': {
              kolWallet: 'test-kol',
              tradeCount: 5,
              totalVolume: 1.0,
              lastTradeTime: new Date(),
              influenceScore: 50,
              tradeTypes: ['buy']
            }
          },
          relatedTokens: [],
          networkMetrics: {
            centrality: 0.5,
            clustering: 0.3,
            totalTrades: 5
          },
          lastUpdate: new Date()
        },
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
          tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          kolConnections: {
            'test-kol': {
              kolWallet: 'test-kol',
              tradeCount: 10,
              totalVolume: 2.0,
              lastTradeTime: new Date(),
              influenceScore: 75,
              tradeTypes: ['buy', 'sell']
            }
          },
          relatedTokens: [],
          networkMetrics: {
            centrality: 0.7,
            clustering: 0.4,
            totalTrades: 10
          },
          lastUpdate: new Date()
        }
      };

      const filtered = dataFilterManager.filterSolanaBaseToken(sampleData);
      
      // Should exclude Solana base token
      expect(filtered).not.toHaveProperty('So11111111111111111111111111111111111111112');
      // Should include other tokens
      expect(filtered).toHaveProperty('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    });
  });
});