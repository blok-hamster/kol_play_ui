import { 
  TokenStoreIntegration, 
  KOLStoreIntegration, 
  TokenMetadata, 
  KOLMetadata,
  SearchTokenResult,
  KOLWallet 
} from '../types';
import { metadataCacheManager } from './metadata-cache-manager';

/**
 * Store Integration Manager for Mindmap Enhancement
 * Handles integration with existing token and KOL stores
 */
export class StoreIntegrationManager implements TokenStoreIntegration, KOLStoreIntegration {
  constructor(
    private tokenStore?: any, // Will be injected with useTokenStore
    private kolStore?: any    // Will be injected with useKOLStore
  ) {}

  /**
   * Sets the token store instance
   * @param store - Token store instance from useTokenStore
   */
  setTokenStore(store: any): void {
    this.tokenStore = store;
  }

  /**
   * Sets the KOL store instance
   * @param store - KOL store instance from useKOLStore
   */
  setKOLStore(store: any): void {
    this.kolStore = store;
  }

  /**
   * Gets token from store with caching
   * @param mint - Token mint address
   * @returns Token data from store or null
   */
  getTokenFromStore(mint: string): SearchTokenResult | null {
    if (!this.tokenStore) {
      console.warn('Token store not initialized');
      return null;
    }

    try {
      // Try to get from store
      const token = this.tokenStore.getToken ? this.tokenStore.getToken(mint) : null;
      
      if (token) {
        // Cache the token data for future use
        this.cacheTokenInStore(token);
        return token;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting token from store:', error);
      return null;
    }
  }

  /**
   * Caches token in store (if store supports caching)
   * @param token - Token data to cache
   */
  cacheTokenInStore(token: SearchTokenResult): void {
    if (!this.tokenStore) {
      return;
    }

    try {
      // If store has a caching method, use it
      if (this.tokenStore.cacheToken) {
        this.tokenStore.cacheToken(token);
      }
      
      // Also cache in our metadata cache manager
      const metadata = metadataCacheManager.enrichTokenWithStoreData(token);
      metadataCacheManager.cacheTokenMetadata(token.mint, metadata);
    } catch (error) {
      console.error('Error caching token in store:', error);
    }
  }

  /**
   * Enriches token data with store data
   * @param tokenData - Raw token data
   * @returns Enriched token metadata
   */
  enrichTokenWithStoreData(tokenData: any): TokenMetadata {
    // First check if we have cached metadata
    const cachedMetadata = metadataCacheManager.getTokenMetadata(tokenData.mint || tokenData.tokenMint);
    if (cachedMetadata) {
      return cachedMetadata;
    }

    // Try to get from store
    const storeToken = this.getTokenFromStore(tokenData.mint || tokenData.tokenMint);
    if (storeToken) {
      return metadataCacheManager.enrichTokenWithStoreData(storeToken);
    }

    // Fallback to basic metadata from provided data
    return {
      name: tokenData.name,
      symbol: tokenData.symbol,
      image: tokenData.image || tokenData.logoURI,
      fallbackImage: this.generateTokenFallbackImage(tokenData.symbol || tokenData.name),
      lastUpdated: Date.now(),
      decimals: tokenData.decimals,
      holders: tokenData.holders,
      verified: tokenData.verified || false,
      jupiter: tokenData.jupiter || false,
      liquidityUsd: tokenData.liquidityUsd || tokenData.liquidity,
      marketCapUsd: tokenData.marketCapUsd || tokenData.marketCap,
      priceUsd: tokenData.priceUsd || tokenData.price
    };
  }

  /**
   * Gets KOL from store with caching
   * @param walletAddress - KOL wallet address
   * @returns KOL data from store or null
   */
  getKOLFromStore(walletAddress: string): KOLWallet | null {
    if (!this.kolStore) {
      console.warn('KOL store not initialized');
      return null;
    }

    try {
      // Try to get from store
      const kol = this.kolStore.getKOL ? this.kolStore.getKOL(walletAddress) : null;
      
      if (kol) {
        // Cache the KOL data for future use
        this.cacheKOLInStore(kol);
        return kol;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting KOL from store:', error);
      return null;
    }
  }

  /**
   * Caches KOL in store (if store supports caching)
   * @param kol - KOL data to cache
   */
  cacheKOLInStore(kol: KOLWallet): void {
    if (!this.kolStore) {
      return;
    }

    try {
      // If store has a caching method, use it
      if (this.kolStore.cacheKOL) {
        this.kolStore.cacheKOL(kol);
      }
      
      // Also cache in our metadata cache manager
      const metadata = metadataCacheManager.enrichKOLWithStoreData(kol);
      metadataCacheManager.cacheKOLMetadata(kol.walletAddress, metadata);
    } catch (error) {
      console.error('Error caching KOL in store:', error);
    }
  }

  /**
   * Enriches KOL data with store data
   * @param kolData - Raw KOL data
   * @returns Enriched KOL metadata
   */
  enrichKOLWithStoreData(kolData: any): KOLMetadata {
    const walletAddress = kolData.walletAddress || kolData.kolWallet || kolData.id;
    
    // First check if we have cached metadata
    const cachedMetadata = metadataCacheManager.getKOLMetadata(walletAddress);
    if (cachedMetadata) {
      return cachedMetadata;
    }

    // Try to get from store
    const storeKOL = this.getKOLFromStore(walletAddress);
    if (storeKOL) {
      return metadataCacheManager.enrichKOLWithStoreData(storeKOL);
    }

    // Fallback to basic metadata from provided data
    return {
      name: kolData.name,
      avatar: kolData.avatar,
      socialLinks: kolData.socialLinks,
      fallbackAvatar: this.generateKOLFallbackAvatar(kolData.name || walletAddress),
      lastUpdated: Date.now(),
      displayName: kolData.name || `${walletAddress.slice(0, 6)}...`,
      description: kolData.description,
      totalTrades: kolData.totalTrades || kolData.tradeCount,
      winRate: kolData.winRate,
      totalPnL: kolData.totalPnL,
      subscriberCount: kolData.subscriberCount,
      isActive: kolData.isActive !== false // Default to true if not specified
    };
  }

  /**
   * Batch enriches multiple tokens with store data
   * @param tokenMints - Array of token mint addresses
   * @returns Promise resolving to map of mint -> metadata
   */
  async batchEnrichTokens(tokenMints: string[]): Promise<Map<string, TokenMetadata>> {
    const results = new Map<string, TokenMetadata>();
    
    // Process in batches to avoid overwhelming the store
    const batchSize = 10;
    for (let i = 0; i < tokenMints.length; i += batchSize) {
      const batch = tokenMints.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (mint) => {
        try {
          // Check cache first
          let metadata = metadataCacheManager.getTokenMetadata(mint);
          
          if (!metadata) {
            // Try to get from store
            const storeToken = this.getTokenFromStore(mint);
            if (storeToken) {
              metadata = metadataCacheManager.enrichTokenWithStoreData(storeToken);
            } else {
              // Create minimal metadata
              metadata = {
                name: undefined,
                symbol: undefined,
                image: undefined,
                fallbackImage: this.generateTokenFallbackImage(),
                lastUpdated: Date.now()
              };
            }
          }
          
          results.set(mint, metadata);
        } catch (error) {
          console.error(`Error enriching token ${mint}:`, error);
          // Add fallback metadata even on error
          results.set(mint, {
            name: undefined,
            symbol: undefined,
            image: undefined,
            fallbackImage: this.generateTokenFallbackImage(),
            lastUpdated: Date.now()
          });
        }
      });
      
      await Promise.all(batchPromises);
      
      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < tokenMints.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return results;
  }

  /**
   * Batch enriches multiple KOLs with store data
   * @param walletAddresses - Array of KOL wallet addresses
   * @returns Promise resolving to map of address -> metadata
   */
  async batchEnrichKOLs(walletAddresses: string[]): Promise<Map<string, KOLMetadata>> {
    const results = new Map<string, KOLMetadata>();
    
    // Process in batches to avoid overwhelming the store
    const batchSize = 10;
    for (let i = 0; i < walletAddresses.length; i += batchSize) {
      const batch = walletAddresses.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (address) => {
        try {
          // Check cache first
          let metadata = metadataCacheManager.getKOLMetadata(address);
          
          if (!metadata) {
            // Try to get from store
            const storeKOL = this.getKOLFromStore(address);
            if (storeKOL) {
              metadata = metadataCacheManager.enrichKOLWithStoreData(storeKOL);
            } else {
              // Create minimal metadata
              metadata = {
                name: undefined,
                avatar: undefined,
                socialLinks: undefined,
                fallbackAvatar: this.generateKOLFallbackAvatar(address),
                lastUpdated: Date.now(),
                displayName: `${address.slice(0, 6)}...`,
                isActive: true
              };
            }
          }
          
          results.set(address, metadata);
        } catch (error) {
          console.error(`Error enriching KOL ${address}:`, error);
          // Add fallback metadata even on error
          results.set(address, {
            name: undefined,
            avatar: undefined,
            socialLinks: undefined,
            fallbackAvatar: this.generateKOLFallbackAvatar(address),
            lastUpdated: Date.now(),
            displayName: `${address.slice(0, 6)}...`,
            isActive: true
          });
        }
      });
      
      await Promise.all(batchPromises);
      
      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < walletAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return results;
  }

  /**
   * Generates a fallback image URL for tokens
   * @param identifier - Token symbol or name
   * @returns Fallback image URL
   */
  private generateTokenFallbackImage(identifier?: string): string {
    if (!identifier) return '/images/token-placeholder.svg';
    
    const cleanId = identifier.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `https://api.dicebear.com/7.x/shapes/svg?seed=${cleanId}&backgroundColor=14F195,9945FF`;
  }

  /**
   * Generates a fallback avatar for KOLs
   * @param identifier - KOL name or wallet address
   * @returns Fallback avatar URL
   */
  private generateKOLFallbackAvatar(identifier: string): string {
    let seed = identifier;
    if (identifier.includes(' ')) {
      seed = identifier.split(' ').map(word => word[0]).join('').toUpperCase();
    } else if (identifier.length > 20) {
      seed = identifier.slice(0, 8);
    }
    
    return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=FF6B6B,4ECDC4`;
  }

  /**
   * Gets integration statistics for monitoring
   */
  getIntegrationStats() {
    return {
      tokenStoreConnected: !!this.tokenStore,
      kolStoreConnected: !!this.kolStore,
      cacheStats: metadataCacheManager.getCacheStats(),
      storeCapabilities: {
        tokenStore: {
          hasGetToken: !!(this.tokenStore?.getToken),
          hasCacheToken: !!(this.tokenStore?.cacheToken),
        },
        kolStore: {
          hasGetKOL: !!(this.kolStore?.getKOL),
          hasCacheKOL: !!(this.kolStore?.cacheKOL),
        }
      }
    };
  }
}

// Export singleton instance
export const storeIntegrationManager = new StoreIntegrationManager();