/**
 * Store Integration Utilities for Metadata Cache Manager
 * 
 * Provides integration between the metadata cache manager and existing stores,
 * enabling seamless data fetching and caching for tokens and KOLs.
 */

import { useTokenStore } from '@/stores/use-token-store';
import { useKOLStore } from '@/stores/use-kol-store';
import { metadataCacheManager, TokenMetadata, KOLMetadata } from './metadata-cache-manager';
import type { SearchTokenResult, KOLWallet } from '@/types';

/**
 * Token store integration utilities
 */
export class TokenStoreIntegration {
  /**
   * Get token metadata with store integration
   */
  static async getTokenMetadata(mint: string): Promise<TokenMetadata | null> {
    if (!mint) return null;

    try {
      // First try cache
      const cached = await metadataCacheManager.getTokenMetadata(mint);
      if (cached && cached.name && cached.symbol) {
        return cached;
      }

      // Fetch from store if not in cache or incomplete
      const tokenStore = useTokenStore.getState();
      
      // Try to get from token cache first
      const cachedToken = tokenStore.tokenCache.get(mint);
      if (cachedToken) {
        const metadata = this.convertTokenToMetadata(cachedToken);
        metadataCacheManager.cacheTokenMetadata(mint, metadata);
        return metadata;
      }

      // If not in cache, we'll return what we have and let the component
      // handle fetching through the normal store methods
      return cached || {
        mint,
        name: undefined,
        symbol: undefined,
        image: undefined,
        fallbackImage: undefined,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.warn(`Failed to get token metadata for ${mint}:`, error);
      return null;
    }
  }

  /**
   * Batch get token metadata with store integration
   */
  static async batchGetTokenMetadata(mints: string[]): Promise<Map<string, TokenMetadata>> {
    const results = new Map<string, TokenMetadata>();
    const uncachedMints: string[] = [];

    // First pass: get cached data
    for (const mint of mints) {
      if (!mint) continue;
      
      const cached = await metadataCacheManager.getTokenMetadata(mint);
      if (cached && cached.name && cached.symbol) {
        results.set(mint, cached);
      } else {
        uncachedMints.push(mint);
      }
    }

    // Second pass: check store cache for uncached items
    if (uncachedMints.length > 0) {
      const tokenStore = useTokenStore.getState();
      
      for (const mint of uncachedMints) {
        const cachedToken = tokenStore.tokenCache.get(mint);
        if (cachedToken) {
          const metadata = this.convertTokenToMetadata(cachedToken);
          metadataCacheManager.cacheTokenMetadata(mint, metadata);
          results.set(mint, metadata);
        } else {
          // Add placeholder metadata for tokens not found
          const placeholder: TokenMetadata = {
            mint,
            name: undefined,
            symbol: undefined,
            image: undefined,
            fallbackImage: undefined,
            lastUpdated: Date.now(),
          };
          results.set(mint, placeholder);
        }
      }
    }

    return results;
  }

  /**
   * Convert SearchTokenResult to TokenMetadata
   */
  private static convertTokenToMetadata(token: SearchTokenResult): TokenMetadata {
    return {
      mint: token.mint,
      name: token.name || undefined,
      symbol: token.symbol || undefined,
      image: token.image || undefined,
      fallbackImage: token.image || undefined,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Cache token from store data
   */
  static cacheTokenFromStore(token: SearchTokenResult): void {
    if (!token || !token.mint) return;
    
    const metadata = this.convertTokenToMetadata(token);
    metadataCacheManager.cacheTokenMetadata(token.mint, metadata);
  }

  /**
   * Enrich token data with cached metadata
   */
  static async enrichTokenWithMetadata(tokenData: any): Promise<TokenMetadata> {
    const mint = tokenData.mint || tokenData.tokenMint;
    if (!mint) {
      return {
        mint: '',
        name: undefined,
        symbol: undefined,
        image: undefined,
        fallbackImage: undefined,
        lastUpdated: Date.now(),
      };
    }

    const metadata = await this.getTokenMetadata(mint);
    return metadata || {
      mint,
      name: tokenData.name || undefined,
      symbol: tokenData.symbol || undefined,
      image: tokenData.image || undefined,
      fallbackImage: undefined,
      lastUpdated: Date.now(),
    };
  }
}

/**
 * KOL store integration utilities
 */
export class KOLStoreIntegration {
  /**
   * Get KOL metadata with store integration
   */
  static async getKOLMetadata(walletAddress: string): Promise<KOLMetadata | null> {
    if (!walletAddress) return null;

    try {
      // First try cache
      const cached = await metadataCacheManager.getKOLMetadata(walletAddress);
      if (cached && cached.name) {
        return cached;
      }

      // Fetch from store if not in cache or incomplete
      const kolStore = useKOLStore.getState();
      const kol = kolStore.getKOL(walletAddress);
      
      if (kol) {
        const metadata = this.convertKOLToMetadata(kol);
        metadataCacheManager.cacheKOLMetadata(walletAddress, metadata);
        return metadata;
      }

      // Try to ensure KOL is loaded
      const ensuredKOL = await kolStore.ensureKOL(walletAddress);
      if (ensuredKOL) {
        const metadata = this.convertKOLToMetadata(ensuredKOL);
        metadataCacheManager.cacheKOLMetadata(walletAddress, metadata);
        return metadata;
      }

      // Return cached data or placeholder
      return cached || {
        walletAddress: walletAddress.toLowerCase(),
        name: undefined,
        avatar: undefined,
        socialLinks: undefined,
        fallbackAvatar: metadataCacheManager.generateFallbackAvatar(walletAddress),
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.warn(`Failed to get KOL metadata for ${walletAddress}:`, error);
      return null;
    }
  }

  /**
   * Batch get KOL metadata with store integration
   */
  static async batchGetKOLMetadata(walletAddresses: string[]): Promise<Map<string, KOLMetadata>> {
    const results = new Map<string, KOLMetadata>();
    const uncachedAddresses: string[] = [];

    // First pass: get cached data
    for (const address of walletAddresses) {
      if (!address) continue;
      
      const cached = await metadataCacheManager.getKOLMetadata(address);
      if (cached && cached.name) {
        results.set(address.toLowerCase(), cached);
      } else {
        uncachedAddresses.push(address);
      }
    }

    // Second pass: check store for uncached items
    if (uncachedAddresses.length > 0) {
      const kolStore = useKOLStore.getState();
      
      // Try to get existing KOLs from store
      for (const address of uncachedAddresses) {
        const kol = kolStore.getKOL(address);
        if (kol) {
          const metadata = this.convertKOLToMetadata(kol);
          metadataCacheManager.cacheKOLMetadata(address, metadata);
          results.set(address.toLowerCase(), metadata);
        }
      }

      // For remaining uncached addresses, create placeholders
      const stillUncached = uncachedAddresses.filter(
        address => !results.has(address.toLowerCase())
      );

      for (const address of stillUncached) {
        const placeholder: KOLMetadata = {
          walletAddress: address.toLowerCase(),
          name: undefined,
          avatar: undefined,
          socialLinks: undefined,
          fallbackAvatar: metadataCacheManager.generateFallbackAvatar(address),
          lastUpdated: Date.now(),
        };
        results.set(address.toLowerCase(), placeholder);
      }
    }

    return results;
  }

  /**
   * Convert KOLWallet to KOLMetadata
   */
  private static convertKOLToMetadata(kol: KOLWallet): KOLMetadata {
    return {
      walletAddress: kol.walletAddress.toLowerCase(),
      name: kol.name || kol.displayName || undefined,
      avatar: kol.avatar || kol.profileImage || undefined,
      socialLinks: {
        twitter: kol.twitterHandle ? `https://twitter.com/${kol.twitterHandle}` : undefined,
        telegram: kol.telegramHandle ? `https://t.me/${kol.telegramHandle}` : undefined,
        website: kol.website || undefined,
      },
      fallbackAvatar: metadataCacheManager.generateFallbackAvatar(kol.walletAddress),
      lastUpdated: Date.now(),
    };
  }

  /**
   * Cache KOL from store data
   */
  static cacheKOLFromStore(kol: KOLWallet): void {
    if (!kol || !kol.walletAddress) return;
    
    const metadata = this.convertKOLToMetadata(kol);
    metadataCacheManager.cacheKOLMetadata(kol.walletAddress, metadata);
  }

  /**
   * Enrich KOL data with cached metadata
   */
  static async enrichKOLWithMetadata(kolData: any): Promise<KOLMetadata> {
    const walletAddress = kolData.walletAddress || kolData.wallet;
    if (!walletAddress) {
      return {
        walletAddress: '',
        name: undefined,
        avatar: undefined,
        socialLinks: undefined,
        fallbackAvatar: undefined,
        lastUpdated: Date.now(),
      };
    }

    const metadata = await this.getKOLMetadata(walletAddress);
    return metadata || {
      walletAddress: walletAddress.toLowerCase(),
      name: kolData.name || kolData.displayName || undefined,
      avatar: kolData.avatar || kolData.profileImage || undefined,
      socialLinks: {
        twitter: kolData.twitterHandle ? `https://twitter.com/${kolData.twitterHandle}` : undefined,
        telegram: kolData.telegramHandle ? `https://t.me/${kolData.telegramHandle}` : undefined,
        website: kolData.website || undefined,
      },
      fallbackAvatar: metadataCacheManager.generateFallbackAvatar(walletAddress),
      lastUpdated: Date.now(),
    };
  }

  /**
   * Generate display name for KOL
   */
  static generateDisplayName(metadata: KOLMetadata): string {
    if (metadata.name) {
      return metadata.name;
    }

    // Truncate wallet address as fallback
    const address = metadata.walletAddress;
    if (address.length > 12) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    
    return address;
  }
}

/**
 * Unified metadata utilities
 */
export class MetadataIntegration {
  /**
   * Preload metadata for mindmap data
   */
  static async preloadMindmapMetadata(mindmapData: any): Promise<{
    tokenMetadata: Map<string, TokenMetadata>;
    kolMetadata: Map<string, KOLMetadata>;
  }> {
    const tokenMints = new Set<string>();
    const kolAddresses = new Set<string>();

    // Extract unique tokens and KOLs from mindmap data
    if (Array.isArray(mindmapData)) {
      mindmapData.forEach((item: any) => {
        if (item.tokenMint) tokenMints.add(item.tokenMint);
        if (item.kolWallet) kolAddresses.add(item.kolWallet);
        if (item.walletAddress) kolAddresses.add(item.walletAddress);
      });
    } else if (mindmapData && typeof mindmapData === 'object') {
      if (mindmapData.tokenMint) tokenMints.add(mindmapData.tokenMint);
      if (mindmapData.kolWallet) kolAddresses.add(mindmapData.kolWallet);
      if (mindmapData.walletAddress) kolAddresses.add(mindmapData.walletAddress);
    }

    // Batch fetch metadata
    const [tokenMetadata, kolMetadata] = await Promise.all([
      TokenStoreIntegration.batchGetTokenMetadata(Array.from(tokenMints)),
      KOLStoreIntegration.batchGetKOLMetadata(Array.from(kolAddresses)),
    ]);

    return { tokenMetadata, kolMetadata };
  }

  /**
   * Clear all metadata caches
   */
  static clearAllMetadata(): void {
    metadataCacheManager.invalidateMetadataCache();
  }

  /**
   * Get comprehensive metadata statistics
   */
  static getMetadataStatistics() {
    const metadataStats = metadataCacheManager.getMetadataStats();
    const baseStats = metadataCacheManager.getStats();

    return {
      ...metadataStats,
      ...baseStats,
      totalMetadataEntries: metadataStats.tokenCacheEntries + metadataStats.kolCacheEntries,
    };
  }
}

// Export all integration utilities
export {
  TokenStoreIntegration,
  KOLStoreIntegration,
  MetadataIntegration,
};