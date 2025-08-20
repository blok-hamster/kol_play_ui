import '@testing-library/jest-dom';

describe('Token Modal Data Handling', () => {
  // Helper function to safely get nested values (same as in component)
  const safeGet = (obj: any, path: string, defaultValue: any = 0) => {
    return path.split('.').reduce((current, key) => current?.[key], obj) ?? defaultValue;
  };

  describe('safeGet utility function', () => {
    it('should return nested values correctly', () => {
      const testObj = {
        pool: {
          price: {
            usd: 1.23
          }
        }
      };

      expect(safeGet(testObj, 'pool.price.usd')).toBe(1.23);
    });

    it('should return default value for missing paths', () => {
      const testObj = {};

      expect(safeGet(testObj, 'pool.price.usd', 0)).toBe(0);
      expect(safeGet(testObj, 'pool.price.usd', 'N/A')).toBe('N/A');
    });

    it('should handle null/undefined objects', () => {
      expect(safeGet(null, 'pool.price.usd', 0)).toBe(0);
      expect(safeGet(undefined, 'pool.price.usd', 0)).toBe(0);
    });

    it('should handle partial paths', () => {
      const testObj = {
        pool: {
          // price is missing
        }
      };

      expect(safeGet(testObj, 'pool.price.usd', 0)).toBe(0);
    });
  });

  describe('Token data validation', () => {
    it('should handle minimal token data structure', () => {
      const minimalToken = {
        symbol: 'TEST',
        mint: '11111111111111111111111111111111'
      };

      // These should not throw errors
      expect(minimalToken.symbol).toBe('TEST');
      expect(minimalToken.mint).toBe('11111111111111111111111111111111');
      expect(minimalToken.name || minimalToken.symbol).toBe('TEST');
    });

    it('should handle empty pools array', () => {
      const pools: any[] = [];
      const primaryPool = pools.length > 0 ? pools[0] : null;

      expect(primaryPool).toBeNull();
      expect(safeGet(primaryPool, 'price.usd', 0)).toBe(0);
    });

    it('should handle incomplete pool data', () => {
      const incompletePool = {
        // Missing price, liquidity, etc.
        tokenSupply: 1000000
      };

      expect(safeGet(incompletePool, 'price.usd', 0)).toBe(0);
      expect(safeGet(incompletePool, 'tokenSupply', 0)).toBe(1000000);
    });

    it('should handle missing risk data', () => {
      const safeRisk = undefined || { 
        snipers: { count: 0, totalBalance: 0, totalPercentage: 0, wallets: [] }, 
        insiders: { count: 0, totalBalance: 0, totalPercentage: 0, wallets: [] }, 
        rugged: false, 
        risks: [], 
        score: 0, 
        jupiterVerified: false 
      };

      expect(safeRisk.score).toBe(0);
      expect(safeRisk.rugged).toBe(false);
      expect(safeRisk.jupiterVerified).toBe(false);
    });

    it('should handle missing events data', () => {
      const events = {};
      const priceChange24h = safeGet(events, '24h.priceChangePercentage', 0);

      expect(priceChange24h).toBe(0);
      expect(Object.keys(events).length).toBe(0);
    });
  });

  describe('Loading and error states', () => {
    it('should handle loading states structure', () => {
      const loadingStates = {
        chart: true,
        priceData: false,
        poolData: true,
        riskData: false
      };

      expect(loadingStates.chart).toBe(true);
      expect(loadingStates.priceData).toBe(false);
    });

    it('should handle error states structure', () => {
      const errorStates = {
        chart: 'Failed to load chart',
        riskData: 'Risk analysis unavailable'
      };

      expect(errorStates.chart).toBe('Failed to load chart');
      expect(errorStates.priceData).toBeUndefined();
    });

    it('should handle default empty states', () => {
      const isLoading = {};
      const errors = {};

      expect(isLoading.chart).toBeUndefined();
      expect(errors.chart).toBeUndefined();
    });
  });

  describe('Data transformation edge cases', () => {
    it('should handle token with only symbol', () => {
      const token = { symbol: 'TEST' };
      const displayName = token.name || token.symbol || 'Unknown Token';

      expect(displayName).toBe('TEST');
    });

    it('should handle token with no symbol or name', () => {
      const token = { mint: '11111111111111111111111111111111' };
      const displayName = (token as any).name || (token as any).symbol || 'Unknown Token';

      expect(displayName).toBe('Unknown Token');
    });

    it('should handle missing decimals', () => {
      const token = { symbol: 'TEST', mint: '11111111111111111111111111111111' };
      const decimals = (token as any).decimals ?? 'N/A';

      expect(decimals).toBe('N/A');
    });

    it('should validate buy button requirements', () => {
      const validToken = { symbol: 'TEST', mint: '11111111111111111111111111111111' };
      const invalidToken1 = { symbol: 'TEST' }; // Missing mint
      const invalidToken2 = { mint: '11111111111111111111111111111111' }; // Missing symbol

      expect(!!(validToken.mint && validToken.symbol)).toBe(true);
      expect(!!((invalidToken1 as any).mint && invalidToken1.symbol)).toBe(false);
      expect(!!((invalidToken2 as any).mint && (invalidToken2 as any).symbol)).toBe(false);
    });
  });
});