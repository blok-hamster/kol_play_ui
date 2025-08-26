/**
 * Mindmap Enhancement Core Module
 * Unified export for all mindmap enhancement utilities and managers
 */

// Core managers
export { DataFilterManager, dataFilterManager } from './mindmap-filter-manager';
export { MetadataCacheManager, metadataCacheManager } from './metadata-cache-manager';
export { StoreIntegrationManager, storeIntegrationManager } from './store-integration-manager';

// Constants
export { MINDMAP_FILTER_CONFIG } from './constants';

// Import for internal use
import { DataFilterManager, dataFilterManager } from './mindmap-filter-manager';
import { MetadataCacheManager, metadataCacheManager } from './metadata-cache-manager';
import { StoreIntegrationManager, storeIntegrationManager } from './store-integration-manager';
import { MINDMAP_FILTER_CONFIG } from './constants';

// Types (re-exported for convenience)
export type {
  EnhancedMindmapUpdate,
  TokenMetadata,
  KOLMetadata,
  SocialLinks,
  FilteredNetworkData,
  NetworkMetadata,
  EnhancedUnifiedNode,
  EnhancedUnifiedLink,
  CacheStats,
  CacheEntry,
  TokenStoreIntegration,
  KOLStoreIntegration
} from '../types';

// Import types for internal use
import type { FilteredNetworkData } from '../types';

/**
 * Unified Mindmap Enhancement Manager
 * Combines all enhancement functionality into a single interface
 */
export class UnifiedMindmapEnhancementManager {
  constructor(
    public dataFilter: DataFilterManager = dataFilterManager,
    public metadataCache: MetadataCacheManager = metadataCacheManager,
    public storeIntegration: StoreIntegrationManager = storeIntegrationManager
  ) {}

  /**
   * Initializes the enhancement manager with store instances
   * @param tokenStore - Token store instance
   * @param kolStore - KOL store instance
   */
  initialize(tokenStore?: any, kolStore?: any): void {
    if (tokenStore) {
      this.storeIntegration.setTokenStore(tokenStore);
    }
    if (kolStore) {
      this.storeIntegration.setKOLStore(kolStore);
    }
  }

  /**
   * Processes raw mindmap data through the complete enhancement pipeline
   * @param rawData - Raw mindmap data from WebSocket
   * @param options - Processing options
   * @returns Enhanced and filtered mindmap data
   */
  async processEnhancedMindmapData(
    rawData: { [tokenMint: string]: any },
    options: {
      showSubscribedOnly?: boolean;
      isSubscribedToKOL?: (kolWallet: string) => boolean;
      trendingTokens?: string[];
      deviceLimits?: { maxNodes?: number; maxLinks?: number };
      preloadMetadata?: boolean;
    } = {}
  ) {
    const {
      showSubscribedOnly = false,
      isSubscribedToKOL = () => false,
      trendingTokens = [],
      deviceLimits,
      preloadMetadata = true
    } = options;

    try {
      // Step 1: Filter out Solana base token
      const filteredData = this.dataFilter.filterSolanaBaseToken(rawData);
      
      // Step 2: Apply subscription filtering if requested
      const subscriptionFilteredData = this.dataFilter.filterBySubscriptionStatus(
        filteredData,
        showSubscribedOnly,
        isSubscribedToKOL
      );
      
      // Step 3: Optimize network data
      const optimizedData = this.dataFilter.optimizeNetworkData(subscriptionFilteredData);
      
      // Step 4: Process unified network data
      const networkData = this.dataFilter.processUnifiedData(
        optimizedData,
        trendingTokens,
        deviceLimits
      );
      
      // Step 5: Preload metadata if requested
      if (preloadMetadata) {
        await this.preloadMetadataForNetwork(networkData);
      }
      
      // Step 6: Enrich nodes with metadata
      const enhancedNodes = await this.enrichNodesWithMetadata(networkData.nodes);
      
      return {
        ...networkData,
        nodes: enhancedNodes,
        processingStats: this.getProcessingStats(rawData, optimizedData)
      };
    } catch (error) {
      console.error('Error processing enhanced mindmap data:', error);
      throw error;
    }
  }

  /**
   * Preloads metadata for all nodes in the network
   * @param networkData - Network data to preload metadata for
   */
  private async preloadMetadataForNetwork(networkData: FilteredNetworkData): Promise<void> {
    const tokenMints = networkData.nodes
      .filter(node => node.type === 'token')
      .map(node => node.id);
    
    const kolAddresses = networkData.nodes
      .filter(node => node.type === 'kol')
      .map(node => node.id);

    // Preload in parallel
    await Promise.all([
      this.storeIntegration.batchEnrichTokens(tokenMints),
      this.storeIntegration.batchEnrichKOLs(kolAddresses)
    ]);
  }

  /**
   * Enriches nodes with metadata from cache/store
   * @param nodes - Nodes to enrich
   * @returns Enriched nodes
   */
  private async enrichNodesWithMetadata(nodes: any[]): Promise<any[]> {
    return Promise.all(nodes.map(async (node) => {
      try {
        if (node.type === 'token') {
          const metadata = this.metadataCache.getTokenMetadata(node.id);
          if (metadata) {
            return {
              ...node,
              metadata,
              displayName: metadata.name ? 
                (metadata.symbol ? `${metadata.name} (${metadata.symbol})` : metadata.name) :
                (metadata.symbol || node.label),
              displayImage: metadata.image || metadata.fallbackImage
            };
          }
        } else if (node.type === 'kol') {
          const metadata = this.metadataCache.getKOLMetadata(node.id);
          if (metadata) {
            return {
              ...node,
              metadata,
              displayName: metadata.displayName || metadata.name || node.label,
              displayImage: metadata.avatar || metadata.fallbackAvatar
            };
          }
        }
        
        return node;
      } catch (error) {
        console.error(`Error enriching node ${node.id}:`, error);
        return node;
      }
    }));
  }

  /**
   * Gets processing statistics for monitoring and debugging
   * @param originalData - Original raw data
   * @param processedData - Processed data
   * @returns Processing statistics
   */
  private getProcessingStats(originalData: any, processedData: any) {
    return {
      filtering: this.dataFilter.getFilteringStats(originalData, processedData),
      cache: this.metadataCache.getCacheStats(),
      integration: this.storeIntegration.getIntegrationStats(),
      timestamp: new Date()
    };
  }

  /**
   * Gets comprehensive enhancement statistics
   */
  getEnhancementStats() {
    return {
      cache: this.metadataCache.getCacheStats(),
      integration: this.storeIntegration.getIntegrationStats(),
      detailedCache: this.metadataCache.getDetailedCacheInfo(),
      constants: MINDMAP_FILTER_CONFIG
    };
  }

  /**
   * Clears all caches and resets state
   */
  reset(): void {
    this.metadataCache.clearAllCache();
  }
}

// Export singleton instance
export const unifiedMindmapEnhancementManager = new UnifiedMindmapEnhancementManager();