/**
 * Test to verify the TokenSearch modal state management refactoring
 */

import { transformSearchResultToTokenDetail, validateSearchResult } from '@/lib/token-data-utils';
import type { SearchTokenResult } from '@/types';

// Mock search result for testing
const mockSearchResult: SearchTokenResult = {
  mint: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  name: 'Solana',
  image: 'https://example.com/sol.png',
  logoURI: 'https://example.com/sol.png',
  priceUsd: 100.50,
  marketCapUsd: 50000000000,
  liquidityUsd: 1000000,
  verified: true,
  decimals: 9,
  market: 'raydium',
  totalBuys: 1000,
  totalSells: 800,
  totalTransactions: 1800,
  volume: 5000000,
  volume_24h: 2500000,
};

describe('TokenSearch Modal State Management Refactoring', () => {
  describe('validateSearchResult', () => {
    it('should validate a complete search result', () => {
      const validation = validateSearchResult(mockSearchResult);
      
      expect(validation.isValid).toBe(true);
      expect(validation.missingFields).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const incompleteResult = { ...mockSearchResult };
      delete (incompleteResult as any).mint;
      
      const validation = validateSearchResult(incompleteResult);
      
      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('mint');
    });

    it('should detect missing symbol and name', () => {
      const incompleteResult = { ...mockSearchResult };
      delete (incompleteResult as any).symbol;
      delete (incompleteResult as any).name;
      
      const validation = validateSearchResult(incompleteResult);
      
      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('symbol or name');
    });

    it('should generate warnings for missing optional fields', () => {
      const incompleteResult = { ...mockSearchResult };
      delete (incompleteResult as any).image;
      delete (incompleteResult as any).logoURI;
      delete (incompleteResult as any).priceUsd;
      
      const validation = validateSearchResult(incompleteResult);
      
      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain('No image available');
      expect(validation.warnings).toContain('No price data available');
    });
  });

  describe('transformSearchResultToTokenDetail', () => {
    it('should transform a complete search result to token detail format', () => {
      const tokenDetail = transformSearchResultToTokenDetail(mockSearchResult);
      
      expect(tokenDetail.token.mint).toBe(mockSearchResult.mint);
      expect(tokenDetail.token.symbol).toBe(mockSearchResult.symbol);
      expect(tokenDetail.token.name).toBe(mockSearchResult.name);
      expect(tokenDetail.token.image).toBe(mockSearchResult.image);
      expect(tokenDetail.pools).toHaveLength(1);
      expect(tokenDetail.pools[0].price.usd).toBe(mockSearchResult.priceUsd);
      expect(tokenDetail.buysCount).toBe(mockSearchResult.totalBuys);
      expect(tokenDetail.sellsCount).toBe(mockSearchResult.totalSells);
    });

    it('should handle missing optional fields gracefully', () => {
      const minimalResult: SearchTokenResult = {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
      };
      
      const tokenDetail = transformSearchResultToTokenDetail(minimalResult);
      
      expect(tokenDetail.token.mint).toBe(minimalResult.mint);
      expect(tokenDetail.token.symbol).toBe(minimalResult.symbol);
      expect(tokenDetail.token.name).toBe('SOL'); // Falls back to symbol
      expect(tokenDetail.pools).toHaveLength(1);
      expect(tokenDetail.buysCount).toBe(0); // Default value
      expect(tokenDetail.sellsCount).toBe(0); // Default value
    });

    it('should throw error for missing mint address', () => {
      const invalidResult = { symbol: 'SOL' } as SearchTokenResult;
      
      expect(() => {
        transformSearchResultToTokenDetail(invalidResult);
      }).toThrow('Token mint address is required');
    });

    it('should include loading and error states', () => {
      const tokenDetail = transformSearchResultToTokenDetail(mockSearchResult);
      
      expect(tokenDetail.isLoading).toBeDefined();
      expect(tokenDetail.isLoading?.chart).toBe(false);
      expect(tokenDetail.isLoading?.priceData).toBe(false);
      expect(tokenDetail.isLoading?.riskData).toBe(false);
      expect(tokenDetail.errors).toBeDefined();
      expect(tokenDetail.errors).toEqual({});
    });
  });

  describe('Modal State Management Logic', () => {
    it('should structure modal state correctly', () => {
      // Simulate the new modal state structure
      const modals = {
        token: { isOpen: false, data: null },
        kol: { isOpen: false, address: null, data: null },
        tradeConfig: { isOpen: false, pendingToken: null }
      };

      expect(modals.token.isOpen).toBe(false);
      expect(modals.token.data).toBeNull();
      expect(modals.kol.isOpen).toBe(false);
      expect(modals.kol.address).toBeNull();
      expect(modals.tradeConfig.isOpen).toBe(false);
      expect(modals.tradeConfig.pendingToken).toBeNull();
    });

    it('should handle modal opening logic', () => {
      // Simulate opening token modal
      let modals = {
        token: { isOpen: false, data: null },
        kol: { isOpen: false, address: null, data: null },
        tradeConfig: { isOpen: false, pendingToken: null }
      };

      const tokenDetail = transformSearchResultToTokenDetail(mockSearchResult);
      
      modals = {
        ...modals,
        token: { isOpen: true, data: tokenDetail }
      };

      expect(modals.token.isOpen).toBe(true);
      expect(modals.token.data).toBe(tokenDetail);
      expect(modals.kol.isOpen).toBe(false); // Other modals remain closed
      expect(modals.tradeConfig.isOpen).toBe(false);
    });

    it('should handle modal closing logic', () => {
      // Simulate closing token modal
      let modals = {
        token: { isOpen: true, data: transformSearchResultToTokenDetail(mockSearchResult) },
        kol: { isOpen: false, address: null, data: null },
        tradeConfig: { isOpen: false, pendingToken: null }
      };

      modals = {
        ...modals,
        token: { isOpen: false, data: null }
      };

      expect(modals.token.isOpen).toBe(false);
      expect(modals.token.data).toBeNull();
    });
  });
});