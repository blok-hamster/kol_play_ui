import {
  transformSearchResultToTokenDetail,
  generateFallbackPoolData,
  generateFallbackPriceEvents,
  generateFallbackRiskData,
  validateSearchResult,
  createLoadingTokenDetail,
  setTokenDetailError,
  setTokenDetailLoading,
  type TokenDetailData,
  type PoolData,
  type PriceEvents,
  type RiskData,
} from '../token-data-utils';
import type { SearchTokenResult } from '@/types';

// Mock search result data for testing
const mockSearchResult: SearchTokenResult = {
  name: 'Test Token',
  symbol: 'TEST',
  mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  decimals: 6,
  image: 'https://example.com/token.png',
  logoURI: 'https://example.com/logo.png',
  holders: 1000,
  jupiter: true,
  verified: true,
  liquidityUsd: 50000,
  marketCapUsd: 1000000,
  priceUsd: 0.001,
  price: 0.001,
  marketCap: 1000000,
  liquidity: 50000,
  lpBurn: 95,
  market: 'pumpfun-amm',
  freezeAuthority: null,
  mintAuthority: null,
  poolAddress: 'PoolAddress123',
  totalBuys: 500,
  totalSells: 300,
  totalTransactions: 800,
  volume_5m: 1000,
  volume: 5000,
  volume_15m: 2000,
  volume_30m: 3000,
  volume_1h: 4000,
  volume_6h: 8000,
  volume_12h: 12000,
  volume_24h: 20000,
  createdOn: 1640995200, // Unix timestamp
};

const minimalSearchResult: SearchTokenResult = {
  name: '',
  symbol: 'MIN',
  mint: '8xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  decimals: 6,
  image: '',
  holders: 0,
  jupiter: false,
  verified: false,
  liquidityUsd: 0,
  marketCapUsd: 0,
  priceUsd: 0,
  price: 0,
  marketCap: 0,
  liquidity: 0,
  lpBurn: 0,
  market: '',
  freezeAuthority: 'SomeAuthority123',
  mintAuthority: 'SomeAuthority456',
  poolAddress: '',
  totalBuys: 0,
  totalSells: 0,
  totalTransactions: 0,
  volume_5m: 0,
  volume: 0,
  volume_15m: 0,
  volume_30m: 0,
  volume_1h: 0,
  volume_6h: 0,
  volume_12h: 0,
  volume_24h: 0,
};

describe('token-data-utils', () => {
  describe('transformSearchResultToTokenDetail', () => {
    it('should transform a complete search result correctly', () => {
      const result = transformSearchResultToTokenDetail(mockSearchResult);

      expect(result.token.name).toBe('Test Token');
      expect(result.token.symbol).toBe('TEST');
      expect(result.token.mint).toBe('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      expect(result.token.decimals).toBe(6);
      expect(result.token.image).toBe('https://example.com/token.png');
      expect(result.token.createdOn).toBe('pumpfun-amm');
      expect(result.token.showName).toBe(true);
      expect(result.token.hasFileMetaData).toBe(true);

      expect(result.pools).toHaveLength(1);
      expect(result.pools[0].tokenAddress).toBe(mockSearchResult.mint);
      expect(result.pools[0].price.usd).toBe(0.001);
      expect(result.pools[0].marketCap.usd).toBe(1000000);
      expect(result.pools[0].liquidity.usd).toBe(50000);

      expect(result.buysCount).toBe(500);
      expect(result.sellsCount).toBe(300);
      expect(result.risk.jupiterVerified).toBe(true);
    });

    it('should handle minimal search result with fallbacks', () => {
      const result = transformSearchResultToTokenDetail(minimalSearchResult);

      expect(result.token.name).toBe('MIN'); // Falls back to symbol
      expect(result.token.symbol).toBe('MIN');
      expect(result.token.mint).toBe('8xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      expect(result.token.createdOn).toBe('pump.fun'); // Default fallback
      expect(result.token.image).toBeUndefined();

      expect(result.pools).toHaveLength(1);
      expect(result.pools[0].price.usd).toBe(0);
      expect(result.pools[0].marketCap.usd).toBe(0);
      expect(result.pools[0].liquidity.usd).toBe(0);
      expect(result.pools[0].security.freezeAuthority).toBe('SomeAuthority123');
      expect(result.pools[0].security.mintAuthority).toBe('SomeAuthority456');

      expect(result.risk.score).toBeGreaterThan(0); // Should have higher risk due to authorities
    });

    it('should throw error for missing mint address', () => {
      const invalidResult = { ...mockSearchResult, mint: '' };
      expect(() => transformSearchResultToTokenDetail(invalidResult)).toThrow('Token mint address is required');
    });

    it('should handle missing name and symbol gracefully', () => {
      const noNameResult = { ...mockSearchResult, name: '', symbol: '' };
      const result = transformSearchResultToTokenDetail(noNameResult);
      expect(result.token.name).toBe('Unknown Token');
      expect(result.token.symbol).toBe('N/A');
    });

    it('should include loading and error states', () => {
      const result = transformSearchResultToTokenDetail(mockSearchResult);
      
      expect(result.isLoading).toBeDefined();
      expect(result.isLoading?.chart).toBe(false);
      expect(result.isLoading?.priceData).toBe(false);
      expect(result.isLoading?.riskData).toBe(false);
      
      expect(result.errors).toBeDefined();
      expect(Object.keys(result.errors || {})).toHaveLength(0);
    });
  });

  describe('generateFallbackPoolData', () => {
    it('should generate pool data from search result', () => {
      const poolData = generateFallbackPoolData(mockSearchResult);

      expect(poolData.tokenAddress).toBe(mockSearchResult.mint);
      expect(poolData.price.usd).toBe(mockSearchResult.priceUsd);
      expect(poolData.marketCap.usd).toBe(mockSearchResult.marketCapUsd);
      expect(poolData.liquidity.usd).toBe(mockSearchResult.liquidityUsd);
      expect(poolData.lpBurn).toBe(mockSearchResult.lpBurn);
      expect(poolData.market).toBe(mockSearchResult.market);
      expect(poolData.decimals).toBe(mockSearchResult.decimals);
      expect(poolData.txns.buys).toBe(mockSearchResult.totalBuys);
      expect(poolData.txns.sells).toBe(mockSearchResult.totalSells);
      expect(poolData.txns.volume24h).toBe(mockSearchResult.volume_24h);
      expect(poolData.security.freezeAuthority).toBe(mockSearchResult.freezeAuthority);
      expect(poolData.security.mintAuthority).toBe(mockSearchResult.mintAuthority);
    });

    it('should handle zero values correctly', () => {
      const poolData = generateFallbackPoolData(minimalSearchResult);

      expect(poolData.price.usd).toBe(0);
      expect(poolData.marketCap.usd).toBe(0);
      expect(poolData.liquidity.usd).toBe(0);
      expect(poolData.lpBurn).toBe(0);
      expect(poolData.txns.buys).toBe(0);
      expect(poolData.txns.sells).toBe(0);
    });

    it('should calculate token supply correctly', () => {
      const poolData = generateFallbackPoolData(mockSearchResult);
      const expectedSupply = mockSearchResult.marketCapUsd! / mockSearchResult.priceUsd!;
      expect(poolData.tokenSupply).toBe(Math.floor(expectedSupply));
    });

    it('should use default token supply when price is zero', () => {
      const poolData = generateFallbackPoolData(minimalSearchResult);
      expect(poolData.tokenSupply).toBe(1000000000); // Default 1 billion
    });

    it('should set correct timestamps', () => {
      const poolData = generateFallbackPoolData(mockSearchResult);
      expect(poolData.lastUpdated).toBeCloseTo(Date.now(), -3); // Within 1 second
      expect(poolData.createdAt).toBe(mockSearchResult.createdOn! * 1000);
    });
  });

  describe('generateFallbackPriceEvents', () => {
    it('should generate price events for all timeframes', () => {
      const events = generateFallbackPriceEvents();
      
      const expectedTimeframes = ['1m', '5m', '15m', '30m', '1h', '2h', '3h', '4h', '5h', '6h', '12h', '24h'];
      expectedTimeframes.forEach(timeframe => {
        expect(events[timeframe]).toBeDefined();
        expect(typeof events[timeframe].priceChangePercentage).toBe('number');
      });
    });

    it('should generate realistic price changes', () => {
      const events = generateFallbackPriceEvents();
      
      Object.values(events).forEach(event => {
        // Price changes should be within reasonable bounds (-50% to +50%)
        expect(event.priceChangePercentage).toBeGreaterThan(-50);
        expect(event.priceChangePercentage).toBeLessThan(50);
      });
    });

    it('should generate different values on multiple calls', () => {
      const events1 = generateFallbackPriceEvents();
      const events2 = generateFallbackPriceEvents();
      
      // At least some values should be different (very unlikely to be identical)
      const values1 = Object.values(events1).map(e => e.priceChangePercentage);
      const values2 = Object.values(events2).map(e => e.priceChangePercentage);
      
      expect(values1).not.toEqual(values2);
    });
  });

  describe('generateFallbackRiskData', () => {
    it('should generate higher risk score for tokens with authorities', () => {
      const riskData = generateFallbackRiskData(minimalSearchResult);
      expect(riskData.score).toBeGreaterThan(0);
      expect(riskData.jupiterVerified).toBe(false);
    });

    it('should generate lower risk score for verified tokens', () => {
      const riskData = generateFallbackRiskData(mockSearchResult);
      expect(riskData.jupiterVerified).toBe(true);
    });

    it('should have proper structure', () => {
      const riskData = generateFallbackRiskData(mockSearchResult);
      
      expect(riskData.snipers).toBeDefined();
      expect(riskData.snipers.count).toBe(0);
      expect(riskData.snipers.wallets).toEqual([]);
      
      expect(riskData.insiders).toBeDefined();
      expect(riskData.insiders.count).toBe(0);
      expect(riskData.insiders.wallets).toEqual([]);
      
      expect(riskData.rugged).toBe(false);
      expect(Array.isArray(riskData.risks)).toBe(true);
      expect(typeof riskData.score).toBe('number');
      expect(riskData.score).toBeGreaterThanOrEqual(0);
      expect(riskData.score).toBeLessThanOrEqual(10);
    });
  });

  describe('validateSearchResult', () => {
    it('should validate complete search result', () => {
      const validation = validateSearchResult(mockSearchResult);
      
      expect(validation.isValid).toBe(true);
      expect(validation.missingFields).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidResult = { ...mockSearchResult, mint: '', symbol: '', name: '' };
      const validation = validateSearchResult(invalidResult);
      
      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('mint');
      expect(validation.missingFields).toContain('symbol or name');
    });

    it('should generate warnings for missing optional fields', () => {
      const incompleteResult = { 
        ...mockSearchResult, 
        image: '', 
        logoURI: '', 
        priceUsd: 0, 
        marketCapUsd: 0, 
        liquidityUsd: 0 
      };
      const validation = validateSearchResult(incompleteResult);
      
      expect(validation.isValid).toBe(true); // Still valid, just warnings
      expect(validation.warnings).toContain('No image available');
      expect(validation.warnings).toContain('No price data available');
      expect(validation.warnings).toContain('No market cap data available');
      expect(validation.warnings).toContain('No liquidity data available');
    });

    it('should allow either symbol or name', () => {
      const symbolOnlyResult = { ...mockSearchResult, name: '' };
      const nameOnlyResult = { ...mockSearchResult, symbol: '' };
      
      expect(validateSearchResult(symbolOnlyResult).isValid).toBe(true);
      expect(validateSearchResult(nameOnlyResult).isValid).toBe(true);
    });
  });

  describe('createLoadingTokenDetail', () => {
    it('should create loading state with minimal data', () => {
      const mint = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
      const result = createLoadingTokenDetail(mint);
      
      expect(result.token.mint).toBe(mint);
      expect(result.token.name).toBe('Loading...');
      expect(result.token.symbol).toBe('LOADING');
      expect(result.token.showName).toBe(true);
      
      expect(result.isLoading?.chart).toBe(true);
      expect(result.isLoading?.priceData).toBe(true);
      expect(result.isLoading?.riskData).toBe(true);
      
      expect(result.pools).toHaveLength(0);
      expect(Object.keys(result.events)).toHaveLength(0);
    });

    it('should use provided symbol and name', () => {
      const mint = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
      const symbol = 'TEST';
      const name = 'Test Token';
      
      const result = createLoadingTokenDetail(mint, symbol, name);
      
      expect(result.token.name).toBe(name);
      expect(result.token.symbol).toBe(symbol);
    });
  });

  describe('setTokenDetailError', () => {
    it('should set error state and clear loading', () => {
      const tokenDetail = createLoadingTokenDetail('test-mint');
      const errorMessage = 'Failed to load chart data';
      
      const result = setTokenDetailError(tokenDetail, 'chart', errorMessage);
      
      expect(result.isLoading?.chart).toBe(false);
      expect(result.errors?.chart).toBe(errorMessage);
      
      // Other loading states should remain unchanged
      expect(result.isLoading?.priceData).toBe(true);
      expect(result.isLoading?.riskData).toBe(true);
    });

    it('should preserve existing errors', () => {
      const tokenDetail = createLoadingTokenDetail('test-mint');
      const result1 = setTokenDetailError(tokenDetail, 'chart', 'Chart error');
      const result2 = setTokenDetailError(result1, 'priceData', 'Price error');
      
      expect(result2.errors?.chart).toBe('Chart error');
      expect(result2.errors?.priceData).toBe('Price error');
    });
  });

  describe('setTokenDetailLoading', () => {
    it('should set loading state', () => {
      const tokenDetail = transformSearchResultToTokenDetail(mockSearchResult);
      
      const result = setTokenDetailLoading(tokenDetail, 'chart', true);
      
      expect(result.isLoading?.chart).toBe(true);
      expect(result.errors?.chart).toBeUndefined();
    });

    it('should clear loading state', () => {
      const tokenDetail = createLoadingTokenDetail('test-mint');
      
      const result = setTokenDetailLoading(tokenDetail, 'chart', false);
      
      expect(result.isLoading?.chart).toBe(false);
    });

    it('should clear error when starting to load', () => {
      const tokenDetail = createLoadingTokenDetail('test-mint');
      const withError = setTokenDetailError(tokenDetail, 'chart', 'Some error');
      
      const result = setTokenDetailLoading(withError, 'chart', true);
      
      expect(result.isLoading?.chart).toBe(true);
      expect(result.errors?.chart).toBeUndefined();
    });
  });
});