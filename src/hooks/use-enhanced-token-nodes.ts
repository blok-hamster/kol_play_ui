/**
 * React Hook for Enhanced Token Node Rendering
 * Provides utilities for progressive loading and metadata enrichment of token nodes
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { EnhancedUnifiedNode, TokenMetadata } from '../types';
import { enhancedNodeRenderer } from '../lib/enhanced-node-renderer';
import { useTokenStore } from '../stores/use-token-store';
import { tokenStoreIntegrationManager } from '../lib/token-store-integration';

interface UseEnhancedTokenNodesOptions {
  enableProgressiveLoading?: boolean;
  preloadImages?: boolean;
  updateInterval?: number;
}

interface UseEnhancedTokenNodesReturn {
  // Node creation and management
  createEnhancedTokenNodes: (rawTokensData: { [mint: string]: any }) => Promise<EnhancedUnifiedNode[]>;
  updateNodeMetadata: (nodes: EnhancedUnifiedNode[]) => Promise<EnhancedUnifiedNode[]>;
  
  // Rendering utilities
  renderEnhancedNodes: (
    nodeSelection: any,
    nodes: EnhancedUnifiedNode[]
  ) => void;
  
  // State management
  enrichedNodes: EnhancedUnifiedNode[];
  isEnriching: boolean;
  enrichmentProgress: number;
  
  // Cache management
  clearCache: () => void;
  getCacheStats: () => any;
  
  // Error handling
  errors: string[];
  clearErrors: () => void;
}

/**
 * Hook for managing enhanced token nodes with progressive loading
 */
export const useEnhancedTokenNodes = (
  options: UseEnhancedTokenNodesOptions = {}
): UseEnhancedTokenNodesReturn => {
  const {
    enableProgressiveLoading = true,
    preloadImages = true,
    updateInterval = 30000 // 30 seconds
  } = options;

  const tokenStore = useTokenStore();
  const [enrichedNodes, setEnrichedNodes] = useState<EnhancedUnifiedNode[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  const enrichmentAbortRef = useRef<AbortController>();

  /**
   * Creates enhanced token nodes from raw mindmap data
   */
  const createEnhancedTokenNodes = useCallback(async (
    rawTokensData: { [mint: string]: any }
  ): Promise<EnhancedUnifiedNode[]> => {
    if (Object.keys(rawTokensData).length === 0) {
      return [];
    }

    setIsEnriching(true);
    setEnrichmentProgress(0);
    setErrors([]);

    // Abort any ongoing enrichment
    if (enrichmentAbortRef.current) {
      enrichmentAbortRef.current.abort();
    }
    enrichmentAbortRef.current = new AbortController();

    try {
      const tokenMints = Object.keys(rawTokensData);
      const nodes: EnhancedUnifiedNode[] = [];
      
      // Process nodes in batches for better performance
      const batchSize = 5;
      for (let i = 0; i < tokenMints.length; i += batchSize) {
        if (enrichmentAbortRef.current.signal.aborted) {
          break;
        }

        const batch = tokenMints.slice(i, i + batchSize);
        const batchPromises = batch.map(async (mint) => {
          try {
            const tokenData = rawTokensData[mint];
            const enhancedNode = await enhancedNodeRenderer.createEnhancedTokenNode(
              tokenData,
              tokenStore
            );
            return enhancedNode;
          } catch (error) {
            console.error(`Error creating enhanced node for ${mint}:`, error);
            setErrors(prev => [...prev, `Failed to enhance token ${mint.slice(0, 8)}...`]);
            
            // Return basic node as fallback
            return {
              id: mint,
              type: 'token' as const,
              label: `${mint.slice(0, 6)}...`,
              value: 10,
              connections: Object.keys(rawTokensData[mint].kolConnections || {}).length,
              displayName: `${mint.slice(0, 6)}...`,
              displayImage: undefined
            };
          }
        });

        const batchNodes = await Promise.all(batchPromises);
        nodes.push(...batchNodes);
        
        // Update progress
        setEnrichmentProgress((i + batchSize) / tokenMints.length);
        
        // Small delay between batches to prevent overwhelming the system
        if (i + batchSize < tokenMints.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      setEnrichedNodes(nodes);
      setEnrichmentProgress(1);
      
      return nodes;
    } catch (error) {
      console.error('Error creating enhanced token nodes:', error);
      setErrors(prev => [...prev, 'Failed to create enhanced nodes']);
      return [];
    } finally {
      setIsEnriching(false);
    }
  }, [tokenStore]);

  /**
   * Updates existing nodes with fresh metadata
   */
  const updateNodeMetadata = useCallback(async (
    nodes: EnhancedUnifiedNode[]
  ): Promise<EnhancedUnifiedNode[]> => {
    if (!enableProgressiveLoading || nodes.length === 0) {
      return nodes;
    }

    try {
      // Find nodes that need metadata updates
      const nodesToUpdate = nodes.filter(node => 
        node.type === 'token' && (!node.metadata || 
        Date.now() - (node.metadata.lastUpdated || 0) > updateInterval)
      );

      if (nodesToUpdate.length === 0) {
        return nodes;
      }

      // Batch fetch updated metadata
      const mints = nodesToUpdate.map(node => node.id);
      const metadataMap = await tokenStoreIntegrationManager.batchFetchTokenMetadata(
        mints,
        tokenStore
      );

      // Update nodes with fresh metadata
      const updatedNodes = nodes.map(node => {
        if (node.type === 'token') {
          const freshMetadata = metadataMap.get(node.id);
          if (freshMetadata) {
            return {
              ...node,
              metadata: freshMetadata,
              displayName: freshMetadata.name ? 
                (freshMetadata.symbol ? `${freshMetadata.name} (${freshMetadata.symbol})` : freshMetadata.name) :
                (freshMetadata.symbol || node.displayName),
              displayImage: freshMetadata.image || freshMetadata.fallbackImage,
              name: freshMetadata.name,
              image: freshMetadata.image || freshMetadata.fallbackImage
            };
          }
        }
        return node;
      });

      setEnrichedNodes(updatedNodes);
      return updatedNodes;
    } catch (error) {
      console.error('Error updating node metadata:', error);
      setErrors(prev => [...prev, 'Failed to update node metadata']);
      return nodes;
    }
  }, [tokenStore, enableProgressiveLoading, updateInterval]);

  /**
   * Renders enhanced nodes using D3
   */
  const renderEnhancedNodes = useCallback((
    nodeSelection: any,
    nodes: EnhancedUnifiedNode[]
  ) => {
    try {
      enhancedNodeRenderer.renderEnhancedTokenNodes(
        nodeSelection,
        nodes,
        (updatedNode) => {
          // Handle node updates from image loading
          setEnrichedNodes(prev => 
            prev.map(node => 
              node.id === updatedNode.id ? { ...node, ...updatedNode } : node
            )
          );
        }
      );
    } catch (error) {
      console.error('Error rendering enhanced nodes:', error);
      setErrors(prev => [...prev, 'Failed to render enhanced nodes']);
    }
  }, []);

  /**
   * Clears all caches
   */
  const clearCache = useCallback(() => {
    enhancedNodeRenderer.clearCache();
    tokenStoreIntegrationManager.clearAllCache();
  }, []);

  /**
   * Gets cache statistics
   */
  const getCacheStats = useCallback(() => {
    return {
      nodeRenderer: enhancedNodeRenderer.getCacheStats(),
      tokenStore: tokenStoreIntegrationManager.getStats()
    };
  }, []);

  /**
   * Clears error messages
   */
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Set up periodic metadata updates
  useEffect(() => {
    if (!enableProgressiveLoading || enrichedNodes.length === 0) {
      return;
    }

    const scheduleUpdate = () => {
      updateTimeoutRef.current = setTimeout(async () => {
        await updateNodeMetadata(enrichedNodes);
        scheduleUpdate(); // Schedule next update
      }, updateInterval);
    };

    scheduleUpdate();

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [enrichedNodes, enableProgressiveLoading, updateInterval, updateNodeMetadata]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (enrichmentAbortRef.current) {
        enrichmentAbortRef.current.abort();
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return {
    createEnhancedTokenNodes,
    updateNodeMetadata,
    renderEnhancedNodes,
    enrichedNodes,
    isEnriching,
    enrichmentProgress,
    clearCache,
    getCacheStats,
    errors,
    clearErrors
  };
};

/**
 * Utility hook for token metadata enrichment
 */
export const useTokenMetadataEnrichment = () => {
  const tokenStore = useTokenStore();

  const enrichTokenWithMetadata = useCallback(async (
    mint: string
  ): Promise<TokenMetadata | null> => {
    try {
      return await tokenStoreIntegrationManager.fetchTokenMetadata(mint, tokenStore);
    } catch (error) {
      console.error(`Error enriching token ${mint}:`, error);
      return null;
    }
  }, [tokenStore]);

  const batchEnrichTokens = useCallback(async (
    mints: string[]
  ): Promise<Map<string, TokenMetadata>> => {
    try {
      return await tokenStoreIntegrationManager.batchFetchTokenMetadata(mints, tokenStore);
    } catch (error) {
      console.error('Error batch enriching tokens:', error);
      return new Map();
    }
  }, [tokenStore]);

  return {
    enrichTokenWithMetadata,
    batchEnrichTokens,
    getStats: () => tokenStoreIntegrationManager.getStats(),
    clearCache: () => tokenStoreIntegrationManager.clearAllCache()
  };
};