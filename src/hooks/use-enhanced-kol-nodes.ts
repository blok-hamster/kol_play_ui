/**
 * Enhanced KOL Nodes Hook for Mindmap Enhancement
 * Provides KOL node creation and metadata enrichment functionality
 */

import { useState, useCallback, useRef } from 'react';
import { EnhancedUnifiedNode, KOLMetadata } from '../types';
import { enhancedNodeRenderer } from '../lib/enhanced-node-renderer';
import { useKOLStore } from '../stores/use-kol-store';
import { kolStoreIntegrationManager } from '../lib/kol-store-integration';

// Twitter avatar helper functions (same as in kol-trade-card.tsx)
function extractTwitterUsername(profileUrl?: string): string | null {
  if (!profileUrl) return null;
  try {
    const url = new URL(profileUrl);
    const hostname = url.hostname.toLowerCase();
    const isTwitter = hostname === 'twitter.com' || hostname === 'www.twitter.com';
    const isX = hostname === 'x.com' || hostname === 'www.x.com';
    if (!isTwitter && !isX) return null;
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) return null;
    const username = pathParts[0];
    if (!username) return null;
    return username.replace(/\.json$/i, '');
  } catch {
    return null;
  }
}

function getTwitterAvatarUrl(twitterUrl?: string, fallbackSeed?: string): string | undefined {
  const username = extractTwitterUsername(twitterUrl);
  if (!username) return undefined;
  const base = `https://unavatar.io/twitter/${encodeURIComponent(username)}`;
  if (fallbackSeed && fallbackSeed.trim().length > 0) {
    const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackSeed)}`;
    return `${base}?fallback=${encodeURIComponent(fallback)}`;
  }
  return base;
}

function findTwitterUrlFromText(text?: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+/i);
  return match ? match[0] : undefined;
}

function findTwitterUrlFromKOL(kol?: { socialLinks?: { twitter?: string }; description?: string }): string | undefined {
  if (!kol) return undefined;
  return kol.socialLinks?.twitter || findTwitterUrlFromText(kol.description);
}

interface UseEnhancedKOLNodesOptions {
  enableProgressiveLoading?: boolean;
  batchSize?: number;
  maxConcurrentRequests?: number;
}

interface UseEnhancedKOLNodesReturn {
  createEnhancedKOLNode: (kolData: any) => Promise<EnhancedUnifiedNode>;
  batchCreateEnhancedKOLNodes: (kolDataArray: any[]) => Promise<EnhancedUnifiedNode[]>;
  enrichKOLNodeWithMetadata: (node: EnhancedUnifiedNode, metadata: KOLMetadata) => EnhancedUnifiedNode;
  getKOLMetadata: (walletAddress: string) => Promise<KOLMetadata | null>;
  invalidateKOLCache: (walletAddress: string) => void;
  getStats: () => any;
  isLoading: boolean;
  loadingProgress: number;
}

/**
 * Hook for creating and managing enhanced KOL nodes with metadata
 */
export const useEnhancedKOLNodes = (
  options: UseEnhancedKOLNodesOptions = {}
): UseEnhancedKOLNodesReturn => {
  const {
    enableProgressiveLoading = true,
    batchSize = 8,
    maxConcurrentRequests = 3
  } = options;

  const kolStore = useKOLStore();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const activeRequests = useRef(0);

  /**
   * Creates an enhanced KOL node with metadata integration
   */
  const createEnhancedKOLNode = useCallback(async (kolData: any): Promise<EnhancedUnifiedNode> => {
    try {
      activeRequests.current++;
      const walletAddress = kolData.kolWallet || kolData.walletAddress || kolData.id;
      
      // First try to get full KOL details from store
      let kolDetails = await kolStore.ensureKOL(walletAddress);
      
      // If no full details, try to get cached metadata (faster lookup with longer TTL)
      let kolMetadata = kolDetails ? undefined : kolStore.getKOLMetadata(walletAddress);
      
      // Create enhanced node with proper display name and avatar
      const displayName = kolDetails?.name || kolMetadata?.name || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
      
      // Get avatar URL - use cached metadata if available
      let avatarUrl: string;
      
      if (kolDetails?.avatar || kolMetadata?.avatar) {
        avatarUrl = kolDetails?.avatar || kolMetadata?.avatar || '';
      } else {
        // Generate Twitter avatar if we have social links
        const socialLinks = kolDetails?.socialLinks || kolMetadata?.socialLinks;
        const twitterUrl = socialLinks?.twitter || findTwitterUrlFromText(kolDetails?.description);
        const twitterAvatar = getTwitterAvatarUrl(twitterUrl, displayName || walletAddress);
        
        avatarUrl = twitterAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName || walletAddress || 'KOL')}`;
      }
      
      const node: EnhancedUnifiedNode = {
        id: walletAddress,
        type: 'kol',
        label: displayName,
        displayName: displayName,
        name: kolDetails?.name || kolMetadata?.name,
        image: avatarUrl,
        displayImage: avatarUrl,
        value: kolData.tradeCount || 10,
        connections: 1,
        totalVolume: kolData.totalVolume || 0,
        tradeCount: kolData.tradeCount || 0,
        influenceScore: kolData.influenceScore || 0,
        isTrending: false,
        metadata: kolDetails ? {
          name: kolDetails.name,
          avatar: avatarUrl,
          socialLinks: kolDetails.socialLinks,
          fallbackAvatar: avatarUrl,
          lastUpdated: Date.now(),
          displayName: displayName,
          description: kolDetails.description,
          totalTrades: kolDetails.totalTrades,
          winRate: kolDetails.winRate,
          totalPnL: kolDetails.totalPnL,
          subscriberCount: kolDetails.subscriberCount,
          isActive: kolDetails.isActive
        } : kolMetadata ? {
          name: kolMetadata.name,
          avatar: avatarUrl,
          socialLinks: kolMetadata.socialLinks,
          fallbackAvatar: avatarUrl,
          lastUpdated: Date.now(),
          displayName: displayName,
          description: undefined,
          totalTrades: undefined,
          winRate: undefined,
          totalPnL: undefined,
          subscriberCount: undefined,
          isActive: true
        } : undefined
      };
      
      return node;
    } catch (error) {
      console.error('Failed to create enhanced KOL node:', error);
      // Return fallback node with generated avatar
      const walletAddress = kolData.kolWallet || kolData.walletAddress || kolData.id;
      const fallbackDisplayName = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
      const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackDisplayName)}`;
      
      return {
        id: walletAddress,
        type: 'kol',
        label: fallbackDisplayName,
        displayName: fallbackDisplayName,
        image: fallbackAvatar,
        displayImage: fallbackAvatar,
        value: kolData.tradeCount || 10,
        connections: 1,
        totalVolume: kolData.totalVolume || 0,
        tradeCount: kolData.tradeCount || 0,
        influenceScore: kolData.influenceScore || 0,
        isTrending: false
      };
    } finally {
      activeRequests.current--;
    }
  }, [kolStore]);

  /**
   * Batch creates enhanced KOL nodes with progressive loading
   */
  const batchCreateEnhancedKOLNodes = useCallback(async (
    kolDataArray: any[]
  ): Promise<EnhancedUnifiedNode[]> => {
    if (kolDataArray.length === 0) {
      return [];
    }

    setIsLoading(true);
    setLoadingProgress(0);

    try {
      const results: EnhancedUnifiedNode[] = [];
      const totalItems = kolDataArray.length;
      let processedItems = 0;

      console.log(`[useEnhancedKOLNodes] Starting batch process for ${totalItems} KOLs (batchSize: ${batchSize}, maxConcurrent: ${maxConcurrentRequests})`);

      // Process in batches to avoid overwhelming the system
      for (let i = 0; i < kolDataArray.length; i += batchSize) {
        const batch = kolDataArray.slice(i, i + batchSize);
        
        // Wait if we have too many concurrent requests
        while (activeRequests.current >= maxConcurrentRequests) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        const batchPromises = batch.map(async (kolData) => {
          const walletAddress = kolData.kolWallet || kolData.walletAddress || kolData.id;
          try {
            return await createEnhancedKOLNode(kolData);
          } catch (error) {
            console.error(`[useEnhancedKOLNodes] Failed to create KOL node for ${walletAddress}:`, error);
            // Return fallback node with generated avatar
            const fallbackDisplayName = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
            const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackDisplayName)}`;
            
            return {
              id: walletAddress,
              type: 'kol' as const,
              label: fallbackDisplayName,
              displayName: fallbackDisplayName,
              image: fallbackAvatar,
              displayImage: fallbackAvatar,
              value: kolData.tradeCount || 10,
              connections: 1,
              totalVolume: kolData.totalVolume || 0,
              tradeCount: kolData.tradeCount || 0,
              influenceScore: kolData.influenceScore || 0,
              isTrending: false
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        processedItems += batch.length;
        setLoadingProgress(processedItems / totalItems);

        // Small delay between batches to prevent overwhelming the system
        if (i + batchSize < kolDataArray.length) {
          await new Promise(resolve => setTimeout(resolve, i === 0 ? 50 : 150));
        }
      }

      console.log(`[useEnhancedKOLNodes] Batch process complete. Enhanced ${results.length} nodes.`);
      return results;
    } catch (error) {
      console.error('Failed to batch create enhanced KOL nodes:', error);
      // Return fallback nodes for all items with generated avatars
      return kolDataArray.map(kolData => {
        const walletAddress = kolData.kolWallet || kolData.walletAddress || kolData.id;
        const fallbackDisplayName = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
        const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackDisplayName)}`;
        
        return {
          id: walletAddress,
          type: 'kol' as const,
          label: fallbackDisplayName,
          displayName: fallbackDisplayName,
          image: fallbackAvatar,
          displayImage: fallbackAvatar,
          value: kolData.tradeCount || 10,
          connections: 1,
          totalVolume: kolData.totalVolume || 0,
          tradeCount: kolData.tradeCount || 0,
          influenceScore: kolData.influenceScore || 0,
          isTrending: false
        };
      });
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
    }
  }, [createEnhancedKOLNode, batchSize, maxConcurrentRequests]);

  /**
   * Enriches an existing KOL node with metadata
   */
  const enrichKOLNodeWithMetadata = useCallback((
    node: EnhancedUnifiedNode, 
    metadata: KOLMetadata
  ): EnhancedUnifiedNode => {
    const enrichedNode = { ...node };
    
    // Update metadata
    enrichedNode.metadata = metadata;
    
    // Update display properties
    if (metadata.name) {
      enrichedNode.displayName = metadata.name;
      enrichedNode.name = metadata.name;
    } else {
      enrichedNode.displayName = metadata.displayName || `${node.id.slice(0, 6)}...${node.id.slice(-4)}`;
    }
    
    // Update avatar
    enrichedNode.displayImage = metadata.avatar || metadata.fallbackAvatar;
    enrichedNode.image = enrichedNode.displayImage;
    
    // Update label for D3 rendering
    enrichedNode.label = enrichedNode.displayName;
    
    return enrichedNode;
  }, []);

  /**
   * Gets KOL metadata for a specific wallet address
   */
  const getKOLMetadata = useCallback(async (walletAddress: string): Promise<KOLMetadata | null> => {
    try {
      return await kolStoreIntegrationManager.fetchKOLMetadata(walletAddress, kolStore);
    } catch (error) {
      console.error(`Failed to get KOL metadata for ${walletAddress}:`, error);
      return null;
    }
  }, [kolStore]);

  /**
   * Invalidates cache for a specific KOL
   */
  const invalidateKOLCache = useCallback((walletAddress: string) => {
    kolStoreIntegrationManager.invalidateCache(walletAddress);
  }, []);

  /**
   * Gets integration statistics
   */
  const getStats = useCallback(() => {
    return {
      kolIntegration: kolStoreIntegrationManager.getStats(),
      nodeRenderer: enhancedNodeRenderer.getCacheStats(),
      activeRequests: activeRequests.current,
      isLoading,
      loadingProgress
    };
  }, [isLoading, loadingProgress]);

  return {
    createEnhancedKOLNode,
    batchCreateEnhancedKOLNodes,
    enrichKOLNodeWithMetadata,
    getKOLMetadata,
    invalidateKOLCache,
    getStats,
    isLoading,
    loadingProgress
  };
};

/**
 * Utility function to extract KOL data from mindmap data
 */
export const extractKOLDataFromMindmap = (mindmapData: { [tokenMint: string]: any }): any[] => {
  const kolMap = new Map<string, any>();
  
  Object.entries(mindmapData).forEach(([tokenMint, tokenData]) => {
    if (tokenData.kolConnections) {
      Object.entries(tokenData.kolConnections).forEach(([kolWallet, kolConnection]: [string, any]) => {
        if (!kolMap.has(kolWallet)) {
          kolMap.set(kolWallet, {
            kolWallet,
            walletAddress: kolWallet,
            id: kolWallet,
            tradeCount: kolConnection.tradeCount || 0,
            totalVolume: kolConnection.totalVolume || 0,
            influenceScore: kolConnection.influenceScore || 0,
            lastTradeTime: kolConnection.lastTradeTime,
            tradeTypes: kolConnection.tradeTypes || [],
            relatedTokens: [tokenMint]
          });
        } else {
          // Aggregate data for KOLs that appear in multiple tokens
          const existing = kolMap.get(kolWallet)!;
          existing.tradeCount += kolConnection.tradeCount || 0;
          existing.totalVolume += kolConnection.totalVolume || 0;
          existing.influenceScore = Math.max(existing.influenceScore, kolConnection.influenceScore || 0);
          existing.relatedTokens.push(tokenMint);
          
          // Update last trade time to the most recent
          if (kolConnection.lastTradeTime && 
              (!existing.lastTradeTime || new Date(kolConnection.lastTradeTime) > new Date(existing.lastTradeTime))) {
            existing.lastTradeTime = kolConnection.lastTradeTime;
          }
          
          // Merge trade types
          if (kolConnection.tradeTypes) {
            existing.tradeTypes = [...new Set([...existing.tradeTypes, ...kolConnection.tradeTypes])];
          }
        }
      });
    }
  });
  
  return Array.from(kolMap.values());
};

/**
 * Utility function to enrich mindmap data with KOL metadata
 */
export const enrichMindmapWithKOLNodes = async (
  mindmapData: { [tokenMint: string]: any },
  useEnhancedKOLNodes: UseEnhancedKOLNodesReturn
): Promise<{ 
  enrichedData: { [tokenMint: string]: any },
  kolNodes: EnhancedUnifiedNode[]
}> => {
  // Extract KOL data from mindmap
  const kolDataArray = extractKOLDataFromMindmap(mindmapData);
  
  // Create enhanced KOL nodes
  const kolNodes = await useEnhancedKOLNodes.batchCreateEnhancedKOLNodes(kolDataArray);
  
  // Create a map for quick lookup
  const kolNodeMap = new Map(kolNodes.map(node => [node.id, node]));
  
  // Enrich mindmap data with KOL node information
  const enrichedData = { ...mindmapData };
  
  Object.keys(enrichedData).forEach(tokenMint => {
    const tokenData = enrichedData[tokenMint];
    if (tokenData.kolConnections) {
      const enrichedKolConnections: { [kolWallet: string]: any } = {};
      
      Object.entries(tokenData.kolConnections).forEach(([kolWallet, kolConnection]) => {
        const kolNode = kolNodeMap.get(kolWallet);
        enrichedKolConnections[kolWallet] = {
          ...kolConnection,
          // Add enhanced node data
          enhancedNode: kolNode,
          displayName: kolNode?.displayName || `${kolWallet.slice(0, 6)}...${kolWallet.slice(-4)}`,
          displayAvatar: kolNode?.displayImage,
          metadata: kolNode?.metadata
        };
      });
      
      enrichedData[tokenMint] = {
        ...tokenData,
        kolConnections: enrichedKolConnections
      };
    }
  });
  
  return {
    enrichedData,
    kolNodes
  };
};