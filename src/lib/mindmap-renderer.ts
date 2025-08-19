import * as d3 from 'd3';
import { MindmapUpdate } from '@/hooks/use-kol-trade-socket';

export interface UnifiedNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'token' | 'kol';
  label: string;
  value: number;
  connections: number;
  totalVolume?: number;
  tradeCount?: number;
  influenceScore?: number;
  isTrending?: boolean;
  tokenMint?: string;
  relatedTokens?: string[];
}

export interface UnifiedLink extends d3.SimulationLinkDatum<UnifiedNode> {
  source: string | UnifiedNode;
  target: string | UnifiedNode;
  value: number;
  tradeCount: number;
  volume: number;
}

export interface ProcessedMindmapData {
  nodes: UnifiedNode[];
  links: UnifiedLink[];
  isValid: boolean;
  errors: string[];
  dataHash: string;
}

export interface MindmapRenderConfig {
  width: number;
  height: number;
  nodeRadius: {
    token: { base: number; max: number };
    kol: { base: number; max: number };
  };
  linkDistance: number;
  forces: {
    charge: number;
    collision: number;
    center: number;
    link: number;
  };
  animation: {
    duration: number;
    alphaTarget: number;
    alphaDecay: number;
  };
}

export class OptimizedMindmapRenderer {
  private simulation: d3.Simulation<UnifiedNode, UnifiedLink> | null = null;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private container: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  private animationFrameId: number | null = null;
  private isRendering = false;
  private lastRenderTime = 0;
  private renderCount = 0;
  private dataCache = new Map<string, ProcessedMindmapData>();
  private nodeElements: d3.Selection<SVGGElement, UnifiedNode, SVGGElement, unknown> | null = null;
  private linkElements: d3.Selection<SVGLineElement, UnifiedLink, SVGGElement, unknown> | null = null;
  private labelElements: d3.Selection<SVGTextElement, UnifiedNode, SVGGElement, unknown> | null = null;

  constructor(private config: MindmapRenderConfig) {}

  /**
   * Process and validate mindmap data with memoization
   */
  processData(
    tokensData: { [tokenMint: string]: MindmapUpdate },
    trendingTokens: string[]
  ): ProcessedMindmapData {
    try {
      // Create a hash of the input data for memoization
      const dataHash = this.createDataHash(tokensData, trendingTokens);
      
      // Check cache first
      const cached = this.dataCache.get(dataHash);
      if (cached) {
        return cached;
      }

      const nodes: UnifiedNode[] = [];
      const links: UnifiedLink[] = [];
      const errors: string[] = [];
      const kolMap = new Map<string, UnifiedNode>();

      // Validate input data
      if (!tokensData || typeof tokensData !== 'object') {
        errors.push('Invalid tokens data structure');
        return { nodes: [], links: [], isValid: false, errors, dataHash };
      }

      // Process each token and its KOL connections
      Object.entries(tokensData).forEach(([tokenMint, data]) => {
        try {
          // Validate token data structure
          if (!data || !data.kolConnections || !data.networkMetrics) {
            errors.push(`Invalid data structure for token ${tokenMint}`);
            return;
          }

          const kolConnections = Object.keys(data.kolConnections);
          const totalTrades = data.networkMetrics.totalTrades || 0;
          const totalVolume = Object.values(data.kolConnections)
            .reduce((sum, kol) => sum + (kol.totalVolume || 0), 0);

          // Add token node
          nodes.push({
            id: tokenMint,
            type: 'token',
            label: `${tokenMint.slice(0, 8)}...`,
            value: Math.max(1, totalTrades * 10),
            connections: kolConnections.length,
            totalVolume,
            tradeCount: totalTrades,
            isTrending: trendingTokens.includes(tokenMint)
          });

          // Process KOL connections
          Object.values(data.kolConnections).forEach(kol => {
            try {
              // Validate KOL data
              if (!kol.kolWallet || typeof kol.tradeCount !== 'number') {
                errors.push(`Invalid KOL data for token ${tokenMint}`);
                return;
              }

              let kolNode = kolMap.get(kol.kolWallet);
              
              if (!kolNode) {
                // Create new KOL node
                kolNode = {
                  id: kol.kolWallet,
                  type: 'kol',
                  label: `${kol.kolWallet.slice(0, 6)}...`,
                  value: Math.max(1, kol.tradeCount * 5),
                  connections: 1,
                  totalVolume: kol.totalVolume || 0,
                  tradeCount: kol.tradeCount || 0,
                  influenceScore: kol.influenceScore || 0,
                  relatedTokens: [tokenMint]
                };
                kolMap.set(kol.kolWallet, kolNode);
              } else {
                // Update existing KOL node
                kolNode.connections += 1;
                kolNode.totalVolume = (kolNode.totalVolume || 0) + (kol.totalVolume || 0);
                kolNode.tradeCount = (kolNode.tradeCount || 0) + (kol.tradeCount || 0);
                kolNode.influenceScore = Math.max(kolNode.influenceScore || 0, kol.influenceScore || 0);
                kolNode.relatedTokens = [...(kolNode.relatedTokens || []), tokenMint];
              }

              // Create link between token and KOL
              links.push({
                source: tokenMint,
                target: kol.kolWallet,
                value: Math.max(1, kol.totalVolume || 0),
                tradeCount: kol.tradeCount || 0,
                volume: kol.totalVolume || 0
              });
            } catch (error) {
              errors.push(`Error processing KOL ${kol.kolWallet}: ${error}`);
            }
          });
        } catch (error) {
          errors.push(`Error processing token ${tokenMint}: ${error}`);
        }
      });

      // Add all KOL nodes to the main nodes array
      nodes.push(...Array.from(kolMap.values()));

      const processedData: ProcessedMindmapData = {
        nodes,
        links,
        isValid: errors.length === 0 && nodes.length > 0,
        errors,
        dataHash
      };

      // Cache the processed data
      this.dataCache.set(dataHash, processedData);

      // Limit cache size to prevent memory leaks
      if (this.dataCache.size > 10) {
        const firstKey = this.dataCache.keys().next().value;
        this.dataCache.delete(firstKey);
      }

      return processedData;
    } catch (error) {
      return {
        nodes: [],
        links: [],
        isValid: false,
        errors: [`Data processing failed: ${error}`],
        dataHash: ''
      };
    }
  }

  /**
   * Render mindmap with incremental updates and performance optimization
   */
  async renderIncremental(
    svgElement: SVGSVGElement,
    data: ProcessedMindmapData,
    onNodeClick?: (node: UnifiedNode) => void,
    onNodeHover?: (node: UnifiedNode | null) => void
  ): Promise<void> {
    if (this.isRendering) {
      console.warn('Mindmap rendering already in progress, skipping...');
      return;
    }

    this.isRendering = true;

    try {
      // Initialize D3 selections
      this.svg = d3.select(svgElement);
      this.setupContainer();
      this.setupZoom();

      // Render in phases to prevent UI blocking
      await this.renderPhase1_Structure(data);
      await this.renderPhase2_Nodes(data, onNodeClick, onNodeHover);
      await this.renderPhase3_Links(data);
      await this.renderPhase4_Labels(data);
      await this.renderPhase5_Simulation(data);

      this.renderCount++;
      this.lastRenderTime = performance.now();
    } catch (error) {
      console.error('Mindmap rendering failed:', error);
      throw error;
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Phase 1: Setup basic structure
   */
  private async renderPhase1_Structure(data: ProcessedMindmapData): Promise<void> {
    return new Promise(resolve => {
      this.animationFrameId = requestAnimationFrame(() => {
        if (!this.svg || !this.container) return;

        // Clear previous content
        this.container.selectAll("*").remove();

        // Create groups for different elements
        this.container.append("g").attr("class", "links");
        this.container.append("g").attr("class", "nodes");
        this.container.append("g").attr("class", "labels");

        resolve();
      });
    });
  }

  /**
   * Phase 2: Render nodes with optimized batching
   */
  private async renderPhase2_Nodes(
    data: ProcessedMindmapData,
    onNodeClick?: (node: UnifiedNode) => void,
    onNodeHover?: (node: UnifiedNode | null) => void
  ): Promise<void> {
    return new Promise(resolve => {
      this.animationFrameId = requestAnimationFrame(() => {
        if (!this.container) return;

        const nodeGroup = this.container.select("g.nodes");
        
        // Create node groups
        this.nodeElements = nodeGroup.selectAll("g.node-group")
          .data(data.nodes, (d: UnifiedNode) => d.id)
          .enter().append("g")
          .attr("class", "node-group")
          .style("cursor", "pointer");

        // Add main circles
        this.nodeElements.append("circle")
          .attr("class", "main-circle")
          .attr("r", d => this.calculateNodeRadius(d))
          .attr("fill", d => this.getNodeColor(d))
          .attr("fill-opacity", 0.8)
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 2);

        // Add inner patterns for KOL nodes
        this.nodeElements.filter(d => d.type === 'kol')
          .append("circle")
          .attr("class", "inner-circle")
          .attr("r", d => this.calculateNodeRadius(d) * 0.6)
          .attr("fill", "none")
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "4,2")
          .attr("opacity", 0.8);

        // Add event listeners
        if (onNodeClick || onNodeHover) {
          this.nodeElements
            .on("click", (event, d) => {
              event.stopPropagation();
              onNodeClick?.(d);
            })
            .on("mouseover", (event, d) => {
              onNodeHover?.(d);
            })
            .on("mouseout", () => {
              onNodeHover?.(null);
            });
        }

        resolve();
      });
    });
  }

  /**
   * Phase 3: Render links with optimized styling
   */
  private async renderPhase3_Links(data: ProcessedMindmapData): Promise<void> {
    return new Promise(resolve => {
      this.animationFrameId = requestAnimationFrame(() => {
        if (!this.container) return;

        const linkGroup = this.container.select("g.links");
        
        this.linkElements = linkGroup.selectAll("line")
          .data(data.links, (d: UnifiedLink) => `${(d.source as UnifiedNode).id}-${(d.target as UnifiedNode).id}`)
          .enter().append("line")
          .attr("stroke", "#64748b")
          .attr("stroke-opacity", d => Math.min(0.7, Math.log(d.tradeCount + 1) * 0.15))
          .attr("stroke-width", d => Math.max(1.5, Math.sqrt(d.tradeCount) * 0.8));

        resolve();
      });
    });
  }

  /**
   * Phase 4: Render labels for significant nodes
   */
  private async renderPhase4_Labels(data: ProcessedMindmapData): Promise<void> {
    return new Promise(resolve => {
      this.animationFrameId = requestAnimationFrame(() => {
        if (!this.container) return;

        const labelGroup = this.container.select("g.labels");
        
        // Only show labels for significant nodes to reduce clutter
        const significantNodes = data.nodes.filter(d => 
          (d.type === 'token' && d.connections > 3) || 
          (d.type === 'kol' && (d.influenceScore || 0) > 70)
        );

        this.labelElements = labelGroup.selectAll("text")
          .data(significantNodes, (d: UnifiedNode) => d.id)
          .enter().append("text")
          .text(d => d.label)
          .attr("font-size", "12px")
          .attr("font-family", "Darker Grotesque, sans-serif")
          .attr("font-weight", "600")
          .attr("text-anchor", "middle")
          .attr("dy", d => this.calculateNodeRadius(d) + 15)
          .attr("fill", "#ffffff")
          .attr("stroke", "#000000")
          .attr("stroke-width", "2px")
          .attr("paint-order", "stroke")
          .style("pointer-events", "none");

        resolve();
      });
    });
  }

  /**
   * Phase 5: Setup optimized D3 simulation
   */
  private async renderPhase5_Simulation(data: ProcessedMindmapData): Promise<void> {
    return new Promise(resolve => {
      this.animationFrameId = requestAnimationFrame(() => {
        if (!this.nodeElements || !this.linkElements) return;

        // Create optimized simulation
        this.simulation = d3.forceSimulation<UnifiedNode>(data.nodes)
          .force("link", d3.forceLink<UnifiedNode, UnifiedLink>(data.links)
            .id(d => d.id)
            .distance(this.config.linkDistance)
            .strength(this.config.forces.link)
          )
          .force("charge", d3.forceManyBody()
            .strength(this.config.forces.charge)
          )
          .force("center", d3.forceCenter(this.config.width / 2, this.config.height / 2)
            .strength(this.config.forces.center)
          )
          .force("collision", d3.forceCollide()
            .radius(d => this.calculateNodeRadius(d) + 5)
            .strength(this.config.forces.collision)
          )
          .alphaTarget(this.config.animation.alphaTarget)
          .alphaDecay(this.config.animation.alphaDecay);

        // Optimized tick function with throttling
        let lastTickTime = 0;
        const tickThrottle = 16; // ~60fps

        this.simulation.on("tick", () => {
          const now = performance.now();
          if (now - lastTickTime < tickThrottle) return;
          lastTickTime = now;

          // Update positions
          this.linkElements!
            .attr("x1", d => (d.source as UnifiedNode).x!)
            .attr("y1", d => (d.source as UnifiedNode).y!)
            .attr("x2", d => (d.target as UnifiedNode).x!)
            .attr("y2", d => (d.target as UnifiedNode).y!);

          this.nodeElements!
            .attr("transform", d => `translate(${d.x},${d.y})`);

          if (this.labelElements) {
            this.labelElements
              .attr("x", d => d.x!)
              .attr("y", d => d.y!);
          }
        });

        // Setup drag behavior
        this.setupDragBehavior();

        resolve();
      });
    });
  }

  /**
   * Setup container with proper cleanup
   */
  private setupContainer(): void {
    if (!this.svg) return;

    // Remove existing container
    this.svg.selectAll("g.mindmap-container").remove();

    // Create new container
    this.container = this.svg.append("g")
      .attr("class", "mindmap-container");
  }

  /**
   * Setup zoom behavior with performance optimization
   */
  private setupZoom(): void {
    if (!this.svg || !this.container) return;

    this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        this.container!.attr("transform", event.transform);
      });

    this.svg.call(this.zoomBehavior);
  }

  /**
   * Setup drag behavior for nodes
   */
  private setupDragBehavior(): void {
    if (!this.nodeElements || !this.simulation) return;

    this.nodeElements.call(d3.drag<SVGGElement, UnifiedNode>()
      .on("start", (event, d) => {
        if (!event.active && this.simulation) {
          this.simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active && this.simulation) {
          this.simulation.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
      })
    );
  }

  /**
   * Calculate optimized node radius
   */
  private calculateNodeRadius(node: UnifiedNode): number {
    if (node.type === 'token') {
      const baseSize = this.config.nodeRadius.token.base;
      const connectionBonus = Math.sqrt(node.connections) * 7;
      const volumeBonus = Math.log((node.totalVolume || 0) + 1) * 2.5;
      return Math.min(this.config.nodeRadius.token.max, baseSize + connectionBonus + volumeBonus);
    } else {
      const baseSize = this.config.nodeRadius.kol.base;
      const influenceBonus = Math.sqrt(node.influenceScore || 0) * 2.2;
      const tradeBonus = Math.sqrt(node.tradeCount || 0) * 1.5;
      return Math.min(this.config.nodeRadius.kol.max, baseSize + influenceBonus + tradeBonus);
    }
  }

  /**
   * Get optimized node color
   */
  private getNodeColor(node: UnifiedNode): string {
    if (node.type === 'token') {
      return node.isTrending ? '#14F195' : '#9945FF';
    } else {
      const score = node.influenceScore || 0;
      if (score >= 80) return '#dc2626';
      if (score >= 60) return '#d97706';
      if (score >= 40) return '#059669';
      return '#10b981';
    }
  }

  /**
   * Create data hash for memoization
   */
  private createDataHash(tokensData: { [tokenMint: string]: MindmapUpdate }, trendingTokens: string[]): string {
    const dataString = JSON.stringify({
      tokens: Object.keys(tokensData).sort(),
      trending: trendingTokens.sort(),
      timestamp: Math.floor(Date.now() / 60000) // Round to minute for cache efficiency
    });
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
  }

  /**
   * Zoom control methods
   */
  zoomIn(): void {
    if (this.zoomBehavior && this.svg) {
      this.svg.transition().call(this.zoomBehavior.scaleBy, 1.5);
    }
  }

  zoomOut(): void {
    if (this.zoomBehavior && this.svg) {
      this.svg.transition().call(this.zoomBehavior.scaleBy, 1 / 1.5);
    }
  }

  resetZoom(): void {
    if (this.zoomBehavior && this.svg) {
      this.svg.transition().call(this.zoomBehavior.transform, d3.zoomIdentity);
    }
  }

  /**
   * Cleanup method to prevent memory leaks
   */
  cleanup(): void {
    // Cancel any pending animation frames
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop simulation
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }

    // Clear D3 selections
    if (this.svg) {
      this.svg.selectAll("*").remove();
      this.svg = null;
    }

    this.container = null;
    this.nodeElements = null;
    this.linkElements = null;
    this.labelElements = null;
    this.zoomBehavior = null;

    // Clear cache periodically
    if (this.dataCache.size > 5) {
      this.dataCache.clear();
    }

    this.isRendering = false;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    renderCount: number;
    lastRenderTime: number;
    cacheSize: number;
    isRendering: boolean;
  } {
    return {
      renderCount: this.renderCount,
      lastRenderTime: this.lastRenderTime,
      cacheSize: this.dataCache.size,
      isRendering: this.isRendering
    };
  }
}

export default OptimizedMindmapRenderer;