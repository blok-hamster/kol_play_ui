/**
 * Enhanced Node Renderer for Mindmap Enhancement
 * Handles progressive loading and rich metadata display for token and KOL nodes
 */

import * as d3 from 'd3';
import { 
  EnhancedUnifiedNode, 
  TokenMetadata, 
  KOLMetadata 
} from '../types';
import { tokenStoreIntegrationManager } from './token-store-integration';
import { kolStoreIntegrationManager } from './kol-store-integration';
import { useTokenStore } from '../stores/use-token-store';
import { useKOLStore } from '../stores/use-kol-store';

/**
 * Enhanced Node Renderer Class
 * Manages the rendering of nodes with metadata enrichment and progressive loading
 */
export class EnhancedNodeRenderer {
  private imageCache = new Map<string, { loaded: boolean; error: boolean; url: string }>();
  private loadingImages = new Set<string>();

  constructor() {
    this.setupImagePreloading();
  }

  /**
   * Creates enhanced KOL nodes with metadata integration
   * @param kolData - Raw KOL data from mindmap
   * @param kolStore - KOL store instance
   * @returns Promise resolving to enhanced KOL node data
   */
  async createEnhancedKOLNode(
    kolData: any,
    kolStore?: ReturnType<typeof useKOLStore>
  ): Promise<EnhancedUnifiedNode> {
    const walletAddress = kolData.kolWallet || kolData.walletAddress || kolData.id;
    
    // Step 1: Create base node structure
    const baseNode: EnhancedUnifiedNode = {
      id: walletAddress,
      type: 'kol',
      label: this.createFallbackKOLLabel(walletAddress),
      value: this.calculateKOLNodeValue(kolData),
      connections: 1, // Will be updated by caller based on token connections
      totalVolume: kolData.totalVolume || 0,
      tradeCount: kolData.tradeCount || 0,
      influenceScore: kolData.influenceScore || 0,
      isTrending: false,
      
      // Initialize display properties with fallbacks
      displayName: this.createFallbackKOLLabel(walletAddress),
      displayImage: undefined
    };

    // Step 2: Try to enrich with metadata (non-blocking)
    try {
      const metadata = await kolStoreIntegrationManager.fetchKOLMetadata(walletAddress, kolStore);
      if (metadata) {
        this.enrichKOLNodeWithMetadata(baseNode, metadata);
      }
    } catch (error) {
      console.warn(`Failed to enrich KOL node ${walletAddress}:`, error);
      // Continue with fallback data
    }

    return baseNode;
  }

  /**
   * Creates enhanced token nodes with metadata integration
   * @param tokenData - Raw token data from mindmap
   * @param tokenStore - Token store instance
   * @returns Promise resolving to enhanced node data
   */
  async createEnhancedTokenNode(
    tokenData: any,
    tokenStore?: ReturnType<typeof useTokenStore>
  ): Promise<EnhancedUnifiedNode> {
    const mint = tokenData.tokenMint || tokenData.id;
    
    // Step 1: Create base node structure
    const baseNode: EnhancedUnifiedNode = {
      id: mint,
      type: 'token',
      label: this.createFallbackTokenLabel(mint),
      value: this.calculateTokenNodeValue(tokenData),
      connections: Object.keys(tokenData.kolConnections || {}).length,
      totalVolume: tokenData.networkMetrics?.totalTrades || 0,
      tradeCount: Object.values(tokenData.kolConnections || {})
        .reduce((sum: number, conn: any) => sum + (conn.tradeCount || 0), 0),
      isTrending: false, // Will be set by caller based on trending tokens
      
      // Initialize display properties with fallbacks
      displayName: this.createFallbackTokenLabel(mint),
      displayImage: undefined
    };

    // Step 2: Try to enrich with metadata (non-blocking)
    try {
      const metadata = await tokenStoreIntegrationManager.fetchTokenMetadata(mint, tokenStore);
      if (metadata) {
        this.enrichTokenNodeWithMetadata(baseNode, metadata);
      }
    } catch (error) {
      console.warn(`Failed to enrich token node ${mint}:`, error);
      // Continue with fallback data
    }

    return baseNode;
  }

  /**
   * Enriches a KOL node with metadata
   * @param node - Base KOL node
   * @param metadata - KOL metadata
   */
  private enrichKOLNodeWithMetadata(node: EnhancedUnifiedNode, metadata: KOLMetadata): void {
    node.metadata = metadata;
    
    // Update display name with rich format
    if (metadata.name) {
      node.displayName = metadata.name;
    } else {
      node.displayName = metadata.displayName || `${node.id.slice(0, 6)}...${node.id.slice(-4)}`;
    }
    
    // Set display image (avatar)
    node.displayImage = metadata.avatar || metadata.fallbackAvatar;
    
    // Update label for D3 rendering
    node.label = node.displayName;
    node.name = metadata.name;
    node.image = node.displayImage;
  }

  /**
   * Enriches a token node with metadata
   * @param node - Base token node
   * @param metadata - Token metadata
   */
  private enrichTokenNodeWithMetadata(node: EnhancedUnifiedNode, metadata: TokenMetadata): void {
    node.metadata = metadata;
    
    // Update display name with rich format
    if (metadata.name && metadata.symbol) {
      node.displayName = `${metadata.name} (${metadata.symbol})`;
    } else if (metadata.name) {
      node.displayName = metadata.name;
    } else if (metadata.symbol) {
      node.displayName = metadata.symbol;
    }
    
    // Set display image
    node.displayImage = metadata.image || metadata.fallbackImage;
    
    // Update label for D3 rendering
    node.label = node.displayName;
    node.name = metadata.name;
    node.image = node.displayImage;
  }

  /**
   * Renders enhanced KOL nodes in D3 visualization
   * @param nodeSelection - D3 selection of node groups
   * @param nodes - Array of enhanced nodes
   * @param onNodeUpdate - Callback for when node metadata is updated
   */
  renderEnhancedKOLNodes(
    nodeSelection: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    nodes: EnhancedUnifiedNode[],
    onNodeUpdate?: (node: EnhancedUnifiedNode) => void
  ): void {
    const kolNodes = nodeSelection.filter(d => d.type === 'kol');

    // Step 1: Render base circles with progressive sizing
    this.renderKOLCircles(kolNodes);

    // Step 2: Render avatars with progressive loading
    this.renderKOLAvatars(kolNodes, onNodeUpdate);

    // Step 3: Render enhanced labels
    this.renderKOLLabels(kolNodes);

    // Step 4: Add social media indicators
    this.renderSocialMediaIndicators(kolNodes);

    // Step 5: Add loading indicators for nodes without metadata
    this.renderLoadingIndicators(kolNodes);
  }

  /**
   * Renders enhanced token nodes in D3 visualization
   * @param nodeSelection - D3 selection of node groups
   * @param nodes - Array of enhanced nodes
   * @param onNodeUpdate - Callback for when node metadata is updated
   */
  renderEnhancedTokenNodes(
    nodeSelection: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    nodes: EnhancedUnifiedNode[],
    onNodeUpdate?: (node: EnhancedUnifiedNode) => void
  ): void {
    const tokenNodes = nodeSelection.filter(d => d.type === 'token');

    // Step 1: Render base circles with progressive sizing
    this.renderTokenCircles(tokenNodes);

    // Step 2: Render images with progressive loading
    this.renderTokenImages(tokenNodes, onNodeUpdate);

    // Step 3: Render enhanced labels
    this.renderTokenLabels(tokenNodes);

    // Step 4: Add loading indicators for nodes without metadata
    this.renderLoadingIndicators(tokenNodes);
  }

  /**
   * Renders token circles with enhanced styling
   */
  private renderTokenCircles(
    tokenNodes: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>
  ): void {
    tokenNodes.selectAll('.token-circle').remove();

    tokenNodes.append('circle')
      .attr('class', 'token-circle')
      .attr('r', d => this.calculateTokenRadius(d))
      .attr('fill', d => this.getTokenColor(d))
      .attr('fill-opacity', 0.8)
      .attr('stroke', d => this.getTokenStrokeColor(d))
      .attr('stroke-width', d => d.metadata?.verified ? 3 : 1.5)
      .style('filter', d => this.getTokenFilter(d))
      .style('cursor', 'pointer');

    // Add inner circle for verified tokens
    tokenNodes.filter(d => d.metadata?.verified)
      .append('circle')
      .attr('class', 'token-inner-circle')
      .attr('r', d => this.calculateTokenRadius(d) * 0.7)
      .attr('fill', 'none')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,2')
      .attr('opacity', 0.6);
  }

  /**
   * Renders token images with progressive loading and error handling
   */
  private renderTokenImages(
    tokenNodes: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    onNodeUpdate?: (node: EnhancedUnifiedNode) => void
  ): void {
    tokenNodes.selectAll('.token-image').remove();

    tokenNodes.each((d, i, nodes) => {
      const nodeGroup = d3.select(nodes[i]);
      
      if (d.displayImage) {
        this.renderTokenImage(nodeGroup, d, onNodeUpdate);
      } else {
        // Render fallback icon
        this.renderTokenFallbackIcon(nodeGroup, d);
      }
    });
  }

  /**
   * Renders a single token image with error handling
   */
  private renderTokenImage(
    nodeGroup: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    node: EnhancedUnifiedNode,
    onNodeUpdate?: (node: EnhancedUnifiedNode) => void
  ): void {
    const imageUrl = node.displayImage!;
    const imageSize = this.calculateTokenRadius(node) * 1.2;
    
    // Check if image is already cached
    const cached = this.imageCache.get(imageUrl);
    if (cached?.loaded) {
      this.appendTokenImage(nodeGroup, imageUrl, imageSize);
      return;
    }
    
    if (cached?.error) {
      this.renderTokenFallbackIcon(nodeGroup, node);
      return;
    }

    // Show loading state
    this.renderTokenLoadingState(nodeGroup, node);

    // Load image if not already loading
    if (!this.loadingImages.has(imageUrl)) {
      this.loadingImages.add(imageUrl);
      this.preloadImage(imageUrl)
        .then(() => {
          this.imageCache.set(imageUrl, { loaded: true, error: false, url: imageUrl });
          this.loadingImages.delete(imageUrl);
          
          // Update the node rendering
          nodeGroup.selectAll('.token-loading, .token-fallback-icon').remove();
          this.appendTokenImage(nodeGroup, imageUrl, imageSize);
          
          // Removed onNodeUpdate callback to prevent re-render loops
        })
        .catch(() => {
          this.imageCache.set(imageUrl, { loaded: false, error: true, url: imageUrl });
          this.loadingImages.delete(imageUrl);
          
          // Show fallback icon
          nodeGroup.selectAll('.token-loading').remove();
          this.renderTokenFallbackIcon(nodeGroup, node);
          
          // Removed onNodeUpdate callback to prevent re-render loops
        });
    }
  }

  /**
   * Appends an image element to the node group
   */
  private appendTokenImage(
    nodeGroup: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    imageUrl: string,
    size: number
  ): void {
    nodeGroup.append('image')
      .attr('class', 'token-image')
      .attr('href', imageUrl)
      .attr('x', -size / 2)
      .attr('y', -size / 2)
      .attr('width', size)
      .attr('height', size)
      .attr('clip-path', 'circle()')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .transition()
      .duration(300)
      .style('opacity', 1);
  }

  /**
   * Renders fallback icon for tokens without images
   */
  private renderTokenFallbackIcon(
    nodeGroup: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    node: EnhancedUnifiedNode
  ): void {
    const iconSize = Math.min(24, this.calculateTokenRadius(node) * 0.8);
    
    nodeGroup.append('g')
      .attr('class', 'token-fallback-icon')
      .attr('transform', `translate(-${iconSize/2}, -${iconSize/2})`)
      .html(`
        <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="m15 9-6 6"/>
          <path d="m9 9h10.5"/>
          <path d="m3.5 15h10.5"/>
        </svg>
      `)
      .style('pointer-events', 'none');
  }

  /**
   * Renders loading state for tokens
   */
  private renderTokenLoadingState(
    nodeGroup: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    node: EnhancedUnifiedNode
  ): void {
    const radius = this.calculateTokenRadius(node) * 0.6;
    
    nodeGroup.append('circle')
      .attr('class', 'token-loading')
      .attr('r', radius)
      .attr('fill', 'none')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.7)
      .style('pointer-events', 'none')
      .transition()
      .duration(1000)
      .ease(d3.easeLinear)
      .attrTween('transform', () => {
        return d3.interpolateString('rotate(0)', 'rotate(360)');
      })
      .on('end', function() {
        d3.select(this).transition().duration(1000).ease(d3.easeLinear)
          .attrTween('transform', () => d3.interpolateString('rotate(0)', 'rotate(360)'))
          .on('end', arguments.callee);
      });
  }

  /**
   * Renders enhanced labels for tokens
   */
  private renderTokenLabels(
    tokenNodes: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>
  ): void {
    // Remove existing labels
    tokenNodes.selectAll('.token-label').remove();

    // Only show labels for significant tokens
    const significantTokens = tokenNodes.filter(d => d.connections > 2 || d.metadata?.verified);

    significantTokens.append('text')
      .attr('class', 'token-label')
      .text(d => this.formatTokenLabel(d))
      .attr('font-size', '12px')
      .attr('font-family', 'Darker Grotesque, sans-serif')
      .attr('font-weight', '600')
      .attr('text-anchor', 'middle')
      .attr('dy', d => this.calculateTokenRadius(d) + 18)
      .attr('fill', '#ffffff')
      .attr('stroke', '#000000')
      .attr('stroke-width', '2px')
      .attr('paint-order', 'stroke')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .transition()
      .duration(500)
      .style('opacity', 1);
  }

  /**
   * Renders loading indicators for nodes without metadata
   */
  private renderLoadingIndicators(
    nodes: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>
  ): void {
    const nodesWithoutMetadata = nodes.filter(d => !d.metadata);

    nodesWithoutMetadata.append('circle')
      .attr('class', 'metadata-loading')
      .attr('r', d => (d.type === 'token' ? this.calculateTokenRadius(d) : this.calculateKOLRadius(d)) + 5)
      .attr('fill', 'none')
      .attr('stroke', '#14F195')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .attr('opacity', 0.5)
      .style('pointer-events', 'none');
  }

  // ===== KOL NODE RENDERING METHODS =====

  /**
   * Renders KOL circles with enhanced styling
   */
  private renderKOLCircles(
    kolNodes: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>
  ): void {
    kolNodes.selectAll('.kol-circle').remove();

    kolNodes.append('circle')
      .attr('class', 'kol-circle')
      .attr('r', d => this.calculateKOLRadius(d))
      .attr('fill', d => this.getKOLColor(d))
      .attr('fill-opacity', 0.8)
      .attr('stroke', d => this.getKOLStrokeColor(d))
      .attr('stroke-width', d => d.metadata?.isActive ? 3 : 1.5)
      .style('filter', d => this.getKOLFilter(d))
      .style('cursor', 'pointer');

    // Add distinctive inner pattern for KOL nodes
    kolNodes.append('circle')
      .attr('class', 'kol-inner-circle')
      .attr('r', d => this.calculateKOLRadius(d) * 0.6)
      .attr('fill', 'none')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,2')
      .attr('opacity', 0.8)
      .style('pointer-events', 'none');
  }

  /**
   * Renders KOL avatars with progressive loading and error handling
   */
  private renderKOLAvatars(
    kolNodes: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    onNodeUpdate?: (node: EnhancedUnifiedNode) => void
  ): void {
    kolNodes.selectAll('.kol-avatar').remove();

    kolNodes.each((d, i, nodes) => {
      const nodeGroup = d3.select(nodes[i]);
      
      if (d.displayImage) {
        this.renderKOLAvatar(nodeGroup, d, onNodeUpdate);
      } else {
        // Render fallback icon
        this.renderKOLFallbackIcon(nodeGroup, d);
      }
    });
  }

  /**
   * Renders a single KOL avatar with error handling
   */
  private renderKOLAvatar(
    nodeGroup: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    node: EnhancedUnifiedNode,
    onNodeUpdate?: (node: EnhancedUnifiedNode) => void
  ): void {
    const avatarUrl = node.displayImage!;
    const avatarSize = this.calculateKOLRadius(node) * 1.4;
    
    // Check if image is already cached
    const cached = this.imageCache.get(avatarUrl);
    if (cached?.loaded) {
      this.appendKOLAvatar(nodeGroup, avatarUrl, avatarSize);
      return;
    }
    
    if (cached?.error) {
      this.renderKOLFallbackIcon(nodeGroup, node);
      return;
    }

    // Show loading state
    this.renderKOLLoadingState(nodeGroup, node);

    // Load image if not already loading
    if (!this.loadingImages.has(avatarUrl)) {
      this.loadingImages.add(avatarUrl);
      this.preloadImage(avatarUrl)
        .then(() => {
          this.imageCache.set(avatarUrl, { loaded: true, error: false, url: avatarUrl });
          this.loadingImages.delete(avatarUrl);
          
          // Update the node rendering
          nodeGroup.selectAll('.kol-loading, .kol-fallback-icon').remove();
          this.appendKOLAvatar(nodeGroup, avatarUrl, avatarSize);
          
          // Removed onNodeUpdate callback to prevent re-render loops
        })
        .catch(() => {
          this.imageCache.set(avatarUrl, { loaded: false, error: true, url: avatarUrl });
          this.loadingImages.delete(avatarUrl);
          
          // Show fallback icon
          nodeGroup.selectAll('.kol-loading').remove();
          this.renderKOLFallbackIcon(nodeGroup, node);
          
          // Removed onNodeUpdate callback to prevent re-render loops
        });
    }
  }

  /**
   * Appends an avatar image element to the KOL node group
   */
  private appendKOLAvatar(
    nodeGroup: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    avatarUrl: string,
    size: number
  ): void {
    // Create circular clipping path for avatar
    const clipId = `kol-avatar-clip-${Math.random().toString(36).substr(2, 9)}`;
    
    nodeGroup.append('defs')
      .append('clipPath')
      .attr('id', clipId)
      .append('circle')
      .attr('r', size / 2);

    nodeGroup.append('image')
      .attr('class', 'kol-avatar')
      .attr('href', avatarUrl)
      .attr('x', -size / 2)
      .attr('y', -size / 2)
      .attr('width', size)
      .attr('height', size)
      .attr('clip-path', `url(#${clipId})`)
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .transition()
      .duration(300)
      .style('opacity', 1);
  }

  /**
   * Renders fallback icon for KOLs without avatars
   */
  private renderKOLFallbackIcon(
    nodeGroup: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    node: EnhancedUnifiedNode
  ): void {
    const iconSize = Math.min(20, this.calculateKOLRadius(node) * 0.7);
    
    nodeGroup.append('g')
      .attr('class', 'kol-fallback-icon')
      .attr('transform', `translate(-${iconSize/2}, -${iconSize/2})`)
      .html(`
        <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <polyline points="16,11 18,13 22,9"/>
        </svg>
      `)
      .style('pointer-events', 'none');
  }

  /**
   * Renders loading state for KOLs
   */
  private renderKOLLoadingState(
    nodeGroup: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    node: EnhancedUnifiedNode
  ): void {
    const radius = this.calculateKOLRadius(node) * 0.6;
    
    nodeGroup.append('circle')
      .attr('class', 'kol-loading')
      .attr('r', radius)
      .attr('fill', 'none')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.7)
      .style('pointer-events', 'none')
      .transition()
      .duration(1200)
      .ease(d3.easeLinear)
      .attrTween('transform', () => {
        return d3.interpolateString('rotate(0)', 'rotate(360)');
      })
      .on('end', function() {
        d3.select(this).transition().duration(1200).ease(d3.easeLinear)
          .attrTween('transform', () => d3.interpolateString('rotate(0)', 'rotate(360)'))
          .on('end', arguments.callee);
      });
  }

  /**
   * Renders enhanced labels for KOLs
   */
  private renderKOLLabels(
    kolNodes: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>
  ): void {
    // Remove existing labels
    kolNodes.selectAll('.kol-label').remove();

    // Only show labels for significant KOLs
    const significantKOLs = kolNodes.filter(d => 
      (d.influenceScore || 0) > 50 || 
      d.metadata?.name || 
      d.metadata?.isActive
    );

    significantKOLs.append('text')
      .attr('class', 'kol-label')
      .text(d => this.formatKOLLabel(d))
      .attr('font-size', '11px')
      .attr('font-family', 'Darker Grotesque, sans-serif')
      .attr('font-weight', '600')
      .attr('text-anchor', 'middle')
      .attr('dy', d => this.calculateKOLRadius(d) + 16)
      .attr('fill', '#ffffff')
      .attr('stroke', '#000000')
      .attr('stroke-width', '2px')
      .attr('paint-order', 'stroke')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .transition()
      .duration(500)
      .style('opacity', 1);
  }

  /**
   * Renders social media indicators for KOLs
   */
  private renderSocialMediaIndicators(
    kolNodes: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>
  ): void {
    // Remove existing indicators
    kolNodes.selectAll('.social-indicator').remove();

    const kolsWithSocial = kolNodes.filter(d => d.metadata?.socialLinks);

    kolsWithSocial.each((d, i, nodes) => {
      const nodeGroup = d3.select(nodes[i]);
      const socialLinks = (d.metadata as KOLMetadata)?.socialLinks;
      
      if (!socialLinks) return;

      const radius = this.calculateKOLRadius(d);
      const indicators: Array<{platform: string, icon: string, color: string}> = [];

      if (socialLinks.twitter) {
        indicators.push({
          platform: 'twitter',
          icon: 'M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z',
          color: '#1DA1F2'
        });
      }

      if (socialLinks.telegram) {
        indicators.push({
          platform: 'telegram',
          icon: 'M21 2l-2 18-4-9-9 4z',
          color: '#0088CC'
        });
      }

      if (socialLinks.discord) {
        indicators.push({
          platform: 'discord',
          icon: 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z',
          color: '#5865F2'
        });
      }

      // Position indicators around the node
      indicators.forEach((indicator, index) => {
        const angle = (index * 120) - 90; // Spread around top-right area
        const indicatorRadius = radius + 12;
        const x = Math.cos(angle * Math.PI / 180) * indicatorRadius;
        const y = Math.sin(angle * Math.PI / 180) * indicatorRadius;

        nodeGroup.append('circle')
          .attr('class', 'social-indicator')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', 6)
          .attr('fill', indicator.color)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1)
          .style('opacity', 0.8)
          .style('pointer-events', 'none');

        nodeGroup.append('g')
          .attr('class', 'social-indicator')
          .attr('transform', `translate(${x - 4}, ${y - 4})`)
          .html(`
            <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
              <path d="${indicator.icon}"/>
            </svg>
          `)
          .style('pointer-events', 'none');
      });
    });
  }

  /**
   * Calculates token node radius based on connections and metadata
   */
  private calculateTokenRadius(node: EnhancedUnifiedNode): number {
    const baseSize = 20;
    const connectionBonus = Math.sqrt(node.connections) * 6;
    const volumeBonus = Math.log((node.totalVolume || 0) + 1) * 2;
    const verifiedBonus = node.metadata?.verified ? 5 : 0;
    
    return Math.min(50, baseSize + connectionBonus + volumeBonus + verifiedBonus);
  }

  /**
   * Gets token color based on metadata and state
   */
  private getTokenColor(node: EnhancedUnifiedNode): string {
    if (node.isTrending) {
      return '#14F195'; // Accent green for trending
    }
    
    if (node.metadata?.verified) {
      return '#9945FF'; // Accent purple for verified
    }
    
    // Color scale based on connections
    const scale = d3.scaleSequential(d3.interpolateRgb('#14F195', '#9945FF'))
      .domain([0, 10]);
    
    return scale(node.connections);
  }

  /**
   * Gets token stroke color
   */
  private getTokenStrokeColor(node: EnhancedUnifiedNode): string {
    if (node.metadata?.verified) {
      return '#ffffff';
    }
    return 'none';
  }

  /**
   * Gets token filter effects
   */
  private getTokenFilter(node: EnhancedUnifiedNode): string {
    if (node.connections > 5) {
      return 'drop-shadow(0 0 12px #9945FF40)';
    }
    if (node.isTrending) {
      return 'drop-shadow(0 0 10px #14F19540)';
    }
    return 'none';
  }

  /**
   * Calculates KOL node radius based on influence score and metadata
   */
  private calculateKOLRadius(node: EnhancedUnifiedNode): number {
    const baseSize = 16;
    const influenceBonus = Math.sqrt(node.influenceScore || 0) * 2;
    const tradeBonus = Math.sqrt(node.tradeCount || 0) * 1.2;
    const activeBonus = node.metadata?.isActive ? 3 : 0;
    
    return Math.min(35, baseSize + influenceBonus + tradeBonus + activeBonus);
  }

  /**
   * Gets KOL color based on metadata and influence
   */
  private getKOLColor(node: EnhancedUnifiedNode): string {
    if (node.metadata?.isActive === false) {
      return '#6B7280'; // Gray for inactive KOLs
    }
    
    // Color scale based on influence score
    const scale = d3.scaleSequential(d3.interpolateRgb('#FF6B6B', '#4ECDC4'))
      .domain([0, 100]);
    
    return scale(node.influenceScore || 0);
  }

  /**
   * Gets KOL stroke color
   */
  private getKOLStrokeColor(node: EnhancedUnifiedNode): string {
    if (node.metadata?.name) {
      return '#ffffff';
    }
    return 'none';
  }

  /**
   * Gets KOL filter effects
   */
  private getKOLFilter(node: EnhancedUnifiedNode): string {
    if ((node.influenceScore || 0) > 80) {
      return 'drop-shadow(0 0 15px #FF6B6B60)';
    }
    if (node.metadata?.socialLinks) {
      return 'drop-shadow(0 0 8px #4ECDC440)';
    }
    return 'none';
  }

  /**
   * Calculates KOL node value for D3 simulation
   */
  private calculateKOLNodeValue(kolData: any): number {
    const influence = kolData.influenceScore || 0;
    const trades = kolData.tradeCount || 0;
    const volume = kolData.totalVolume || 0;
    return Math.max(8, influence * 0.5 + Math.sqrt(trades) * 3 + Math.log(volume + 1) * 2);
  }

  /**
   * Creates fallback label for KOLs
   */
  private createFallbackKOLLabel(walletAddress: string): string {
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }

  /**
   * Formats KOL label for display
   */
  private formatKOLLabel(node: EnhancedUnifiedNode): string {
    const metadata = node.metadata as KOLMetadata;
    if (metadata?.name) {
      return `${metadata.name} (${Math.round(node.influenceScore || 0)})`;
    }
    return `${node.id.slice(0, 6)}... (${Math.round(node.influenceScore || 0)})`;
  }

  /**
   * Calculates token node value for D3 simulation
   */
  private calculateTokenNodeValue(tokenData: any): number {
    const connections = Object.keys(tokenData.kolConnections || {}).length;
    const volume = tokenData.networkMetrics?.totalTrades || 0;
    return Math.max(10, connections * 10 + Math.log(volume + 1) * 5);
  }

  /**
   * Creates fallback label for tokens
   */
  private createFallbackTokenLabel(mint: string): string {
    return `${mint.slice(0, 6)}...`;
  }

  /**
   * Formats token label for display
   */
  private formatTokenLabel(node: EnhancedUnifiedNode): string {
    if (node.metadata?.symbol) {
      return `${node.metadata.symbol} (${node.connections})`;
    }
    return `${node.id.slice(0, 6)}... (${node.connections})`;
  }

  /**
   * Preloads an image and returns a promise
   */
  private preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
      
      // Timeout after 5 seconds
      setTimeout(() => reject(new Error(`Image load timeout: ${url}`)), 5000);
    });
  }

  /**
   * Sets up image preloading optimization
   */
  private setupImagePreloading(): void {
    // Clear cache periodically to prevent memory leaks
    setInterval(() => {
      if (this.imageCache.size > 100) {
        // Keep only the most recently used 50 images
        const entries = Array.from(this.imageCache.entries());
        this.imageCache.clear();
        entries.slice(-50).forEach(([key, value]) => {
          this.imageCache.set(key, value);
        });
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Renders enhanced nodes (both tokens and KOLs) in D3 visualization
   * @param nodeSelection - D3 selection of node groups
   * @param nodes - Array of enhanced nodes
   * @param onNodeUpdate - Callback for when node metadata is updated
   */
  renderEnhancedNodes(
    nodeSelection: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    nodes: EnhancedUnifiedNode[],
    onNodeUpdate?: (node: EnhancedUnifiedNode) => void
  ): void {
    // Render token nodes (callback disabled to prevent re-render loops)
    this.renderEnhancedTokenNodes(nodeSelection, nodes);
    
    // Render KOL nodes (callback disabled to prevent re-render loops)
    this.renderEnhancedKOLNodes(nodeSelection, nodes);
  }

  /**
   * Updates existing nodes with new metadata
   * @param nodeSelection - D3 selection of nodes to update
   * @param updatedNodes - Array of nodes with updated metadata
   */
  updateNodesWithMetadata(
    nodeSelection: d3.Selection<SVGGElement, EnhancedUnifiedNode, SVGGElement, unknown>,
    updatedNodes: EnhancedUnifiedNode[]
  ): void {
    const updatedNodeMap = new Map(updatedNodes.map(node => [node.id, node]));

    nodeSelection.each((d, i, nodes) => {
      const updatedNode = updatedNodeMap.get(d.id);
      if (updatedNode && updatedNode.metadata && !d.metadata) {
        // Update the node data
        Object.assign(d, updatedNode);
        
        // Re-render this specific node based on type
        const nodeGroup = d3.select(nodes[i]);
        if (d.type === 'token') {
          this.renderEnhancedTokenNodes(nodeGroup as any, [d]);
        } else if (d.type === 'kol') {
          this.renderEnhancedKOLNodes(nodeGroup as any, [d]);
        }
      }
    });
  }

  /**
   * Clears all cached data
   */
  clearCache(): void {
    this.imageCache.clear();
    this.loadingImages.clear();
  }

  /**
   * Gets cache statistics
   */
  getCacheStats() {
    return {
      imageCache: {
        size: this.imageCache.size,
        loadedImages: Array.from(this.imageCache.values()).filter(c => c.loaded).length,
        errorImages: Array.from(this.imageCache.values()).filter(c => c.error).length
      },
      loadingImages: this.loadingImages.size
    };
  }
}

// Export singleton instance
export const enhancedNodeRenderer = new EnhancedNodeRenderer();