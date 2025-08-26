/**
 * Core tests for the metadata cache system (without external dependencies)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  MetadataCacheManager, 
  TokenMetadata, 
  KOLMetadata 
} from '../metadata-cache-manager';
import { CacheSharing } from '../cache-optimization';

describe('MetadataCacheManager Core Functionality', () => {
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

    it('should return placeholder for empty batch requests', async () => {
      const results = await cacheManager.batchGetTokenMetadata([]);
      expect(results.size).toBe(0);
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

    it('should return placeholder for empty batch requests', async () => {
      const results = await cacheManager.batchGetKOLMetadata([]);
      expect(results.size).toBe(0);
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = cacheManager.getMetadataStats();
      expect(stats).toHaveProperty('tokenCacheEntries');
      expect(stats).toHaveProperty('kolCacheEntries');
      expect(stats).toHaveProperty('tokenHitRate');
      expect(stats).toHaveProperty('kolHitRate');
      expect(stats).toHaveProperty('backgroundRefreshCount');
      expect(stats).toHaveProperty('failedRefreshCount');
    });

    it('should handle null/undefined inputs gracefully', async () => {
      expect(await cacheManager.getTokenMetadata('')).toBeNull();
      expect(await cacheManager.getTokenMetadata(null as any)).toBeNull();
      expect(await cacheManager.getKOLMetadata('')).toBeNull();
      expect(await cacheManager.getKOLMetadata(null as any)).toBeNull();
    });

    it('should not cache null/undefined metadata', () => {
      expect(() => {
        cacheManager.cacheTokenMetadata('', null as any);
      }).not.toThrow();

      expect(() => {
        cacheManager.cacheKOLMetadata('', null as any);
      }).not.toThrow();
    });
  });

  describe('Configuration Updates', () => {
    it('should update metadata configuration', () => {
      expect(() => {
        cacheManager.updateMetadataConfig({
          tokenTTL: 5000,
          kolTTL: 10000,
        });
      }).not.toThrow();
    });
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

  it('should return null for non-existent keys', () => {
    const result = CacheSharing.getSharedData('non-existent-key');
    expect(result).toBeNull();
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

  it('should handle multiple subscribers', () => {
    let receivedData1: any = null;
    let receivedData2: any = null;

    const unsubscribe1 = CacheSharing.subscribe('test-key', (data) => {
      receivedData1 = data;
    });

    const unsubscribe2 = CacheSharing.subscribe('test-key', (data) => {
      receivedData2 = data;
    });

    const testData = { test: 'multi-subscription' };
    CacheSharing.shareData('test-key', testData);
    
    expect(receivedData1).toEqual(testData);
    expect(receivedData2).toEqual(testData);

    // Unsubscribe one
    unsubscribe1();
    
    receivedData1 = null;
    receivedData2 = null;
    
    CacheSharing.shareData('test-key', { test: 'after-unsubscribe' });
    expect(receivedData1).toBeNull();
    expect(receivedData2).toEqual({ test: 'after-unsubscribe' });

    unsubscribe2();
  });

  it('should handle subscription errors gracefully', () => {
    const errorCallback = () => {
      throw new Error('Subscription error');
    };

    const unsubscribe = CacheSharing.subscribe('test-key', errorCallback);

    // Should not throw when notifying subscribers
    expect(() => {
      CacheSharing.shareData('test-key', { test: 'error-test' });
    }).not.toThrow();

    unsubscribe();
  });
});

describe('Fallback Avatar Generation', () => {
  let cacheManager: MetadataCacheManager;

  beforeEach(() => {
    cacheManager = new MetadataCacheManager();
  });

  afterEach(() => {
    cacheManager.destroy();
  });

  it('should generate consistent avatars for same address', () => {
    const address = 'test-wallet-address';
    const avatar1 = cacheManager.generateFallbackAvatar(address);
    const avatar2 = cacheManager.generateFallbackAvatar(address);
    
    expect(avatar1).toBe(avatar2);
  });

  it('should generate different avatars for different addresses', () => {
    const avatar1 = cacheManager.generateFallbackAvatar('address1');
    const avatar2 = cacheManager.generateFallbackAvatar('address2');
    
    expect(avatar1).not.toBe(avatar2);
  });

  it('should include initials in avatar', () => {
    const avatar = cacheManager.generateFallbackAvatar('test-address');
    expect(avatar).toContain('TE'); // First two characters uppercase
  });

  it('should be valid SVG data URL', () => {
    const avatar = cacheManager.generateFallbackAvatar('test');
    expect(avatar).toMatch(/^data:image\/svg\+xml,/);
    
    // Decode and check basic SVG structure
    const svgContent = decodeURIComponent(avatar.replace('data:image/svg+xml,', ''));
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('<circle');
    expect(svgContent).toContain('<text');
    expect(svgContent).toContain('</svg>');
  });
});