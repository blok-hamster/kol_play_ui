import { MINDMAP_FILTER_CONFIG } from './constants';
import { 
  MindmapUpdate, 
  EnhancedMindmapUpdate, 
  FilteredNetworkData, 
  EnhancedUnifiedNode, 
  EnhancedUnifiedLink,
  NetworkMetadata 
} from '../types';

/**
 * Data Filter Manager for Mindmap Enhancement
 * Handles Solana token exclusion and subscription-based filtering
 */
export class DataFilterManager {
  /**
   * Filters out the Solana base token from mindmap data
   * @param tokensData - Raw tokens data from WebSocket
   * @returns Filtered tokens data without Solana base token
   */
  filterSolanaBaseToken(tokensData: { [tokenMint: string]: MindmapUpdate }): { [tokenMint: string]: MindmapUpdate } {
    const filtered: { [tokenMint: string]: MindmapUpdate } = {};
    
    Object.entries(tokensData).forEach(([tokenMint, data]) => {
      // Skip Solana base token entirely
      if (this.isValidToken(tokenMint)) {
        // Filter KOL connections to remove those with only Solana base token trades
        const filteredKolConnections: typeof data.kolConnections = {};
        
        Object.entries(data.kolConnections || {}).forEach(([kolWallet, kolData]) => {
          // Only include KOLs with meaningful trading activity
          if (this.hasValidConnections(kolData)) {
            filteredKolConnections[kolWallet] = kolData;
          }
        });
        
        // Only include tokens that have valid KOL connections after filtering
        if (Object.keys(filteredKolConnections).length > 0) {
          filtered[tokenMint] = {
            ...data,
            kolConnections: filteredKolConnections,
            networkMetrics: {
              ...data.networkMetrics,
              totalTrades: Object.values(filteredKolConnections).reduce(
                (sum, kol) => sum + kol.tradeCount, 0
              ),
            },
          };
        }
      }
    });
    
    return filtered;
  }

  /**
   * Checks if a token mint is valid (not Solana base token)
   * @param tokenMint - Token mint address to validate
   * @returns True if token is valid for mindmap display
   */
  isValidToken(tokenMint: string): boolean {
    return tokenMint !== MINDMAP_FILTER_CONFIG.SOLANA_BASE_TOKEN_MINT;
  }

  /**
   * Checks if a KOL connection has valid trading activity
   * @param kolData - KOL connection data
   * @returns True if KOL has meaningful trading activity
   */
  hasValidConnections(kolData: {
    tradeCount: number;
    totalVolume: number;
    influenceScore: number;
  }): boolean {
    return (
      kolData.tradeCount >= MINDMAP_FILTER_CONFIG.MIN_TRADE_COUNT &&
      kolData.totalVolume >= MINDMAP_FILTER_CONFIG.MIN_VOLUME_THRESHOLD &&
      kolData.influenceScore >= MINDMAP_FILTER_CONFIG.MIN_INFLUENCE_SCORE
    );
  }

  /**
   * Filters mindmap data based on subscription status
   * @param data - Mindmap data to filter
   * @param showSubscribedOnly - Whether to show only subscribed KOLs
   * @param isSubscribedToKOL - Function to check if user is subscribed to a KOL
   * @returns Filtered mindmap data
   */
  filterBySubscriptionStatus(
    data: { [tokenMint: string]: MindmapUpdate },
    showSubscribedOnly: boolean,
    isSubscribedToKOL: (kolWallet: string) => boolean
  ): { [tokenMint: string]: MindmapUpdate } {
    if (!showSubscribedOnly) {
      return data;
    }

    const filtered: { [tokenMint: string]: MindmapUpdate } = {};

    Object.entries(data).forEach(([tokenMint, tokenData]) => {
      const filteredKolConnections: typeof tokenData.kolConnections = {};
      
      // Only include KOLs that the user is subscribed to
      Object.entries(tokenData.kolConnections || {}).forEach(([kolWallet, kolData]) => {
        if (isSubscribedToKOL(kolWallet)) {
          filteredKolConnections[kolWallet] = kolData;
        }
      });

      // Only include tokens that have subscribed KOLs
      if (Object.keys(filteredKolConnections).length > 0) {
        filtered[tokenMint] = {
          ...tokenData,
          kolConnections: filteredKolConnections,
          networkMetrics: {
            ...tokenData.networkMetrics,
            totalTrades: Object.values(filteredKolConnections).reduce(
              (sum, kol) => sum + kol.tradeCount, 0
            ),
          },
        };
      }
    });

    return filtered;
  }

  /**
   * Optimizes network data by removing isolated nodes and empty connections
   * @param data - Raw mindmap data
   * @returns Optimized network data
   */
  optimizeNetworkData(data: { [tokenMint: string]: MindmapUpdate }): { [tokenMint: string]: MindmapUpdate } {
    const optimized: { [tokenMint: string]: MindmapUpdate } = {};
    
    Object.entries(data).forEach(([tokenMint, tokenData]) => {
      // Remove KOL connections with zero trades or volume
      const activeKolConnections: typeof tokenData.kolConnections = {};
      
      Object.entries(tokenData.kolConnections || {}).forEach(([kolWallet, kolData]) => {
        if (kolData.tradeCount > 0 && kolData.totalVolume > 0) {
          activeKolConnections[kolWallet] = kolData;
        }
      });
      
      // Only include tokens with active connections
      if (Object.keys(activeKolConnections).length > 0) {
        optimized[tokenMint] = {
          ...tokenData,
          kolConnections: activeKolConnections,
          networkMetrics: {
            ...tokenData.networkMetrics,
            totalTrades: Object.values(activeKolConnections).reduce(
              (sum, kol) => sum + kol.tradeCount, 0
            ),
          },
        };
      }
    });
    
    return optimized;
  }

  /**
   * Processes unified network data for visualization
   * @param tokensData - Filtered tokens data
   * @param trendingTokens - List of trending token mints
   * @param deviceLimits - Device-specific node/link limits
   * @returns Processed network data ready for visualization
   */
  processUnifiedData(
    tokensData: { [tokenMint: string]: MindmapUpdate },
    trendingTokens: string[] = [],
    deviceLimits?: { maxNodes?: number; maxLinks?: number }
  ): FilteredNetworkData {
    const nodes: EnhancedUnifiedNode[] = [];
    const links: EnhancedUnifiedLink[] = [];
    const kolMap = new Map<string, EnhancedUnifiedNode>();

    // Apply device-specific limits
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const maxNodes = deviceLimits?.maxNodes || (isMobile ? 
      MINDMAP_FILTER_CONFIG.MAX_NODES_MOBILE : 
      MINDMAP_FILTER_CONFIG.MAX_NODES_DESKTOP
    );
    const maxLinks = deviceLimits?.maxLinks || (isMobile ? 
      MINDMAP_FILTER_CONFIG.MAX_LINKS_MOBILE : 
      MINDMAP_FILTER_CONFIG.MAX_LINKS_DESKTOP
    );

    // Process each token and its KOL connections
    Object.entries(tokensData).forEach(([tokenMint, data]) => {
      const kolConnections = Object.keys(data.kolConnections || {});
      const totalTrades = data.networkMetrics?.totalTrades || 0;
      const totalVolume = Object.values(data.kolConnections || {})
        .reduce((sum, kol) => sum + kol.totalVolume, 0);

      // Only process tokens that have active KOL connections with actual trades
      const activeKolConnections = Object.values(data.kolConnections || {}).filter((kol: any) => 
        kol.tradeCount > 0 && kol.totalVolume > 0
      );

      if (activeKolConnections.length === 0) {
        return; // Skip tokens with no active KOL connections
      }

      // Add token node only if it has active KOL connections
      const tokenNode: EnhancedUnifiedNode = {
        id: tokenMint,
        type: 'token',
        label: `${tokenMint.slice(0, 8)}...`,
        displayName: `${tokenMint.slice(0, 8)}...`, // Will be enhanced with metadata
        value: totalTrades * 10,
        connections: activeKolConnections.length,
        totalVolume,
        tradeCount: totalTrades,
        isTrending: trendingTokens.includes(tokenMint)
      };

      nodes.push(tokenNode);

      // Process only active KOL connections
      activeKolConnections.forEach((kol: any) => {
        let kolNode = kolMap.get(kol.kolWallet);
        
        if (!kolNode) {
          // Create new KOL node only if they have actual trading activity
          kolNode = {
            id: kol.kolWallet,
            type: 'kol',
            label: `${kol.kolWallet.slice(0, 6)}...`,
            displayName: `${kol.kolWallet.slice(0, 6)}...`, // Will be enhanced with metadata
            value: kol.tradeCount * 5,
            connections: 1,
            totalVolume: kol.totalVolume,
            tradeCount: kol.tradeCount,
            influenceScore: kol.influenceScore,
            relatedTokens: [tokenMint]
          };
          kolMap.set(kol.kolWallet, kolNode);
        } else {
          // Update existing KOL node
          kolNode.connections += 1;
          kolNode.totalVolume = (kolNode.totalVolume || 0) + kol.totalVolume;
          kolNode.tradeCount = (kolNode.tradeCount || 0) + kol.tradeCount;
          kolNode.influenceScore = Math.max(kolNode.influenceScore || 0, kol.influenceScore);
          kolNode.relatedTokens = [...(kolNode.relatedTokens || []), tokenMint];
        }

        // Create link between token and KOL only for active connections
        const link: EnhancedUnifiedLink = {
          source: tokenMint,
          target: kol.kolWallet,
          value: kol.totalVolume,
          tradeCount: kol.tradeCount,
          volume: kol.totalVolume,
          lastTradeTime: kol.lastTradeTime,
          tradeTypes: kol.tradeTypes,
          averageTradeSize: kol.totalVolume / Math.max(kol.tradeCount, 1)
        };

        links.push(link);
      });
    });

    // Add all KOL nodes to the main nodes array
    nodes.push(...Array.from(kolMap.values()));

    // Apply device limits by sorting and truncating
    const sortedNodes = nodes
      .sort((a, b) => (b.totalVolume || 0) - (a.totalVolume || 0))
      .slice(0, maxNodes);
    
    const nodeIds = new Set(sortedNodes.map(n => n.id));
    const filteredLinks = links
      .filter(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      })
      .sort((a, b) => b.volume - a.volume)
      .slice(0, maxLinks);

    // Calculate network metadata
    const metadata: NetworkMetadata = {
      totalTokens: sortedNodes.filter(n => n.type === 'token').length,
      totalKOLs: sortedNodes.filter(n => n.type === 'kol').length,
      featuredKOLs: 0, // Will be calculated by subscription manager
      subscribedKOLs: 0, // Will be calculated by subscription manager
      filteredTokens: Object.keys(tokensData).length - sortedNodes.filter(n => n.type === 'token').length,
      filteredKOLs: kolMap.size - sortedNodes.filter(n => n.type === 'kol').length,
      lastUpdate: new Date()
    };

    return {
      nodes: sortedNodes,
      links: filteredLinks,
      metadata
    };
  }

  /**
   * Validates if a token is relevant for mindmap display
   * @param tokenMint - Token mint address
   * @param kolConnections - KOL connections for the token
   * @returns True if token is relevant for display
   */
  isTokenRelevant(tokenMint: string, kolConnections: any): boolean {
    // Exclude Solana base token
    if (!this.isValidToken(tokenMint)) {
      return false;
    }

    // Check if token has meaningful KOL connections
    if (!kolConnections || typeof kolConnections !== 'object') {
      return false;
    }

    // Token is relevant if it has at least one valid KOL connection
    return Object.values(kolConnections).some((kol: any) => 
      this.hasValidConnections(kol)
    );
  }

  /**
   * Validates mindmap data structure
   * @param data - Data to validate
   * @returns True if data structure is valid
   */
  validateMindmapData(data: any): data is { [tokenMint: string]: MindmapUpdate } {
    if (!data || typeof data !== 'object') {
      return false;
    }

    return Object.entries(data).every(([tokenMint, tokenData]) => {
      return (
        typeof tokenMint === 'string' &&
        tokenData &&
        typeof tokenData === 'object' &&
        typeof (tokenData as any).tokenMint === 'string' &&
        typeof (tokenData as any).kolConnections === 'object' &&
        typeof (tokenData as any).networkMetrics === 'object'
      );
    });
  }

  /**
   * Validates token-KOL relationships to ensure meaningful connections
   * @param data - Mindmap data to validate
   * @param options - Validation options
   * @returns Data with validated relationships
   */
  validateTokenKOLRelationships(
    data: { [tokenMint: string]: MindmapUpdate },
    options: {
      preserveMetadata?: boolean;
      validateConnections?: boolean;
      minConnectionStrength?: number;
    } = {}
  ): { [tokenMint: string]: MindmapUpdate } {
    const { preserveMetadata = true, validateConnections = true, minConnectionStrength = 0.1 } = options;
    const validated: { [tokenMint: string]: MindmapUpdate } = {};

    Object.entries(data).forEach(([tokenMint, tokenData]) => {
      const validatedKolConnections: typeof tokenData.kolConnections = {};
      
      Object.entries(tokenData.kolConnections || {}).forEach(([kolWallet, kolData]) => {
        // Validate connection strength if requested
        if (validateConnections) {
          const connectionStrength = this.calculateConnectionStrength(kolData);
          if (connectionStrength < minConnectionStrength) {
            return; // Skip weak connections
          }
        }

        // Preserve enhanced metadata if available
        if (preserveMetadata) {
          validatedKolConnections[kolWallet] = {
            ...kolData,
            // Preserve any enhanced metadata fields
            metadata: (kolData as any).metadata || {},
            lastValidated: new Date().toISOString()
          };
        } else {
          validatedKolConnections[kolWallet] = kolData;
        }
      });

      // Only include tokens with valid KOL connections
      if (Object.keys(validatedKolConnections).length > 0) {
        validated[tokenMint] = {
          ...tokenData,
          kolConnections: validatedKolConnections,
          // Preserve token metadata if available
          metadata: preserveMetadata ? (tokenData as any).metadata || {} : undefined,
          networkMetrics: {
            ...tokenData.networkMetrics,
            totalTrades: Object.values(validatedKolConnections).reduce(
              (sum, kol) => sum + kol.tradeCount, 0
            ),
            validatedConnections: Object.keys(validatedKolConnections).length,
            lastValidated: new Date().toISOString()
          }
        };
      }
    });

    return validated;
  }

  /**
   * Calculates connection strength between token and KOL
   * @param kolData - KOL connection data
   * @returns Connection strength score (0-1)
   */
  private calculateConnectionStrength(kolData: {
    tradeCount: number;
    totalVolume: number;
    influenceScore: number;
  }): number {
    // Normalize factors to 0-1 range
    const tradeScore = Math.min(kolData.tradeCount / 100, 1); // Max at 100 trades
    const volumeScore = Math.min(kolData.totalVolume / 1000, 1); // Max at 1000 SOL
    const influenceScore = Math.min(kolData.influenceScore / 100, 1); // Max at 100 influence

    // Weighted average: trades 40%, volume 40%, influence 20%
    return (tradeScore * 0.4) + (volumeScore * 0.4) + (influenceScore * 0.2);
  }

  /**
   * Gets metadata statistics for monitoring enhanced data
   * @param data - Filtered data with potential metadata
   * @returns Metadata statistics
   */
  getMetadataStats(data: { [tokenMint: string]: MindmapUpdate }) {
    let tokensWithMetadata = 0;
    let kolsWithMetadata = 0;
    let totalKOLs = 0;

    Object.values(data).forEach(tokenData => {
      // Check if token has metadata
      if ((tokenData as any).metadata) {
        tokensWithMetadata++;
      }

      // Check KOL metadata
      Object.values(tokenData.kolConnections || {}).forEach(kolData => {
        totalKOLs++;
        if ((kolData as any).metadata) {
          kolsWithMetadata++;
        }
      });
    });

    return {
      tokensWithMetadata,
      totalTokens: Object.keys(data).length,
      kolsWithMetadata,
      totalKOLs,
      tokenMetadataRatio: tokensWithMetadata / Math.max(Object.keys(data).length, 1),
      kolMetadataRatio: kolsWithMetadata / Math.max(totalKOLs, 1)
    };
  }

  /**
   * Gets filtering statistics for debugging and monitoring
   * @param originalData - Original unfiltered data
   * @param filteredData - Filtered data
   * @returns Filtering statistics
   */
  getFilteringStats(
    originalData: { [tokenMint: string]: MindmapUpdate },
    filteredData: { [tokenMint: string]: MindmapUpdate }
  ) {
    const originalTokens = Object.keys(originalData).length;
    const filteredTokens = Object.keys(filteredData).length;
    
    const originalKOLs = new Set(
      Object.values(originalData).flatMap(data => 
        Object.keys(data.kolConnections || {})
      )
    ).size;
    
    const filteredKOLs = new Set(
      Object.values(filteredData).flatMap(data => 
        Object.keys(data.kolConnections || {})
      )
    ).size;

    return {
      tokensFiltered: originalTokens - filteredTokens,
      tokensRemaining: filteredTokens,
      kolsFiltered: originalKOLs - filteredKOLs,
      kolsRemaining: filteredKOLs,
      filterEfficiency: filteredTokens / Math.max(originalTokens, 1),
      solanaTokenFiltered: originalData.hasOwnProperty(MINDMAP_FILTER_CONFIG.SOLANA_BASE_TOKEN_MINT)
    };
  }
}

// Export singleton instance
export const dataFilterManager = new DataFilterManager();