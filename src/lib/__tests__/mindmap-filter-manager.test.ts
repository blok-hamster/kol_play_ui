import { dataFilterManager } from '../mindmap-filter-manager';
import { MINDMAP_FILTER_CONFIG } from '../constants';

describe('DataFilterManager', () => {
  const mockTokensData = {
    // Solana base token - should be filtered out
    'So11111111111111111111111111111111111111112': {
      tokenMint: 'So11111111111111111111111111111111111111112',
      kolConnections: {
        'kol1': {
          kolWallet: 'kol1',
          tradeCount: 5,
          totalVolume: 100,
          lastTradeTime: new Date(),
          influenceScore: 80,
          tradeTypes: ['buy', 'sell']
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
    // Valid token - should be kept
    'validToken123': {
      tokenMint: 'validToken123',
      kolConnections: {
        'kol1': {
          kolWallet: 'kol1',
          tradeCount: 10,
          totalVolume: 200,
          lastTradeTime: new Date(),
          influenceScore: 90,
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
    },
    // Token with no valid connections - should be filtered out
    'tokenWithNoValidConnections': {
      tokenMint: 'tokenWithNoValidConnections',
      kolConnections: {
        'kol2': {
          kolWallet: 'kol2',
          tradeCount: 0,
          totalVolume: 0,
          lastTradeTime: new Date(),
          influenceScore: 0,
          tradeTypes: []
        }
      },
      relatedTokens: [],
      networkMetrics: {
        centrality: 0.1,
        clustering: 0.1,
        totalTrades: 0
      },
      lastUpdate: new Date()
    }
  };

  describe('filterSolanaBaseToken', () => {
    it('should filter out Solana base token', () => {
      const result = dataFilterManager.filterSolanaBaseToken(mockTokensData);
      
      expect(result).not.toHaveProperty(MINDMAP_FILTER_CONFIG.SOLANA_BASE_TOKEN_MINT);
      expect(result).toHaveProperty('validToken123');
      expect(Object.keys(result)).toHaveLength(1); // Only validToken123 should remain
    });

    it('should preserve tokens with valid KOL connections', () => {
      const result = dataFilterManager.filterSolanaBaseToken(mockTokensData);
      
      expect(result.validToken123).toBeDefined();
      expect(result.validToken123.kolConnections.kol1).toBeDefined();
      expect(result.validToken123.kolConnections.kol1.tradeCount).toBe(10);
    });
  });

  describe('isValidToken', () => {
    it('should return false for Solana base token', () => {
      expect(dataFilterManager.isValidToken(MINDMAP_FILTER_CONFIG.SOLANA_BASE_TOKEN_MINT)).toBe(false);
    });

    it('should return true for other tokens', () => {
      expect(dataFilterManager.isValidToken('validToken123')).toBe(true);
      expect(dataFilterManager.isValidToken('anotherToken456')).toBe(true);
    });
  });

  describe('hasValidConnections', () => {
    it('should return true for KOL with valid trading activity', () => {
      const validKol = {
        tradeCount: 5,
        totalVolume: 100,
        influenceScore: 80
      };
      
      expect(dataFilterManager.hasValidConnections(validKol)).toBe(true);
    });

    it('should return false for KOL with no trading activity', () => {
      const invalidKol = {
        tradeCount: 0,
        totalVolume: 0,
        influenceScore: 0
      };
      
      expect(dataFilterManager.hasValidConnections(invalidKol)).toBe(false);
    });

    it('should return false for KOL with insufficient volume', () => {
      const lowVolumeKol = {
        tradeCount: 5,
        totalVolume: 0.0001, // Below MIN_VOLUME_THRESHOLD
        influenceScore: 80
      };
      
      expect(dataFilterManager.hasValidConnections(lowVolumeKol)).toBe(false);
    });
  });

  describe('isTokenRelevant', () => {
    it('should return false for Solana base token', () => {
      const kolConnections = {
        'kol1': {
          tradeCount: 10,
          totalVolume: 100,
          influenceScore: 80
        }
      };
      
      expect(dataFilterManager.isTokenRelevant(
        MINDMAP_FILTER_CONFIG.SOLANA_BASE_TOKEN_MINT,
        kolConnections
      )).toBe(false);
    });

    it('should return true for valid token with valid connections', () => {
      const kolConnections = {
        'kol1': {
          tradeCount: 10,
          totalVolume: 100,
          influenceScore: 80
        }
      };
      
      expect(dataFilterManager.isTokenRelevant('validToken123', kolConnections)).toBe(true);
    });

    it('should return false for token with no valid connections', () => {
      const kolConnections = {
        'kol1': {
          tradeCount: 0,
          totalVolume: 0,
          influenceScore: 0
        }
      };
      
      expect(dataFilterManager.isTokenRelevant('validToken123', kolConnections)).toBe(false);
    });
  });

  describe('optimizeNetworkData', () => {
    it('should remove tokens with no active connections', () => {
      const result = dataFilterManager.optimizeNetworkData(mockTokensData);
      
      expect(result).not.toHaveProperty('tokenWithNoValidConnections');
      expect(result).toHaveProperty('validToken123');
      // Note: optimizeNetworkData doesn't filter Solana token - that's done by filterSolanaBaseToken
      expect(result).toHaveProperty(MINDMAP_FILTER_CONFIG.SOLANA_BASE_TOKEN_MINT);
    });

    it('should update network metrics for remaining tokens', () => {
      const result = dataFilterManager.optimizeNetworkData(mockTokensData);
      
      expect(result.validToken123.networkMetrics.totalTrades).toBe(10);
    });
  });

  describe('getFilteringStats', () => {
    it('should provide accurate filtering statistics', () => {
      const filtered = dataFilterManager.filterSolanaBaseToken(mockTokensData);
      const stats = dataFilterManager.getFilteringStats(mockTokensData, filtered);
      
      expect(stats.tokensFiltered).toBe(2); // Solana token + token with no valid connections
      expect(stats.tokensRemaining).toBe(1); // Only validToken123
      expect(stats.solanaTokenFiltered).toBe(true);
      expect(stats.filterEfficiency).toBe(1/3); // 1 remaining out of 3 original
    });
  });
});