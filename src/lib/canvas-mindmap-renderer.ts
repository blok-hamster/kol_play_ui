/**
 * Canvas Mindmap Renderer
 * Handles high-performance rendering of the mindmap using HTML5 Canvas
 * Replicates the visual style of EnhancedNodeRenderer but optimized for 60fps
 */

import { 
  EnhancedUnifiedNode, 
  UnifiedLink 
} from '../types';
import * as d3 from 'd3';

export class CanvasMindmapRenderer {
  private imageCache = new Map<string, HTMLImageElement>();
  private loadingImages = new Set<string>();
  
  // Design System Colors
  private readonly colors = {
    accentFrom: '#14F195',
    accentTo: '#9945FF',
    kolWarm: '#FF6B6B',
    kolCool: '#4ECDC4',
    text: '#FFFFFF',
    background: '#0a0a0a',
    grid: 'rgba(156, 163, 175, 0.1)'
  };
  
  // Color scales
  private tokenColorScale: d3.ScaleSequential<string>;
  private kolColorScale: d3.ScaleSequential<string>;

  constructor() {
    this.tokenColorScale = d3.scaleSequential(d3.interpolateRgb(this.colors.accentFrom, this.colors.accentTo))
      .domain([0, 20]); // Approximate domain for connections
      
    this.kolColorScale = d3.scaleSequential(d3.interpolateRgb(this.colors.kolWarm, this.colors.kolCool))
      .domain([0, 100]); // Influence score domain
  }

  /**
   * Main render method
   */
  render(
    ctx: CanvasRenderingContext2D,
    nodes: EnhancedUnifiedNode[],
    links: UnifiedLink[],
    width: number,
    height: number,
    transform: d3.ZoomTransform,
    options: {
      hoveredNode?: EnhancedUnifiedNode | null;
      selectedNode?: EnhancedUnifiedNode | null;
      hoveredLink?: UnifiedLink | null;
    } = {}
  ) {
    const { hoveredNode, selectedNode, hoveredLink } = options;

    // Clear canvas
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    
    // Apply zoom/pan transform
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // 1. Draw Links
    // Sort links: Highlighted links should be drawn last (on top)
    const sortedLinks = links.sort((a, b) => {
      const aHighlighted = (a === hoveredLink) || (hoveredNode && this.isLinkConnectedToNode(a, hoveredNode));
      const bHighlighted = (b === hoveredLink) || (hoveredNode && this.isLinkConnectedToNode(b, hoveredNode));
      return (Number(aHighlighted) - Number(bHighlighted));
    });

    sortedLinks.forEach(link => {
      this.drawLink(ctx, link, hoveredNode, hoveredLink);
    });

    // 2. Draw Nodes
    // Sort nodes: Selected/Hovered nodes on top
    const sortedNodes = nodes.sort((a, b) => {
      const aActive = (a === hoveredNode) || (a === selectedNode);
      const bActive = (b === hoveredNode) || (b === selectedNode);
      return (Number(aActive) - Number(bActive));
    });

    sortedNodes.forEach(node => {
      this.drawNode(ctx, node, hoveredNode, selectedNode);
    });

    ctx.restore();
  }

  /**
   * Draw a single link
   */
  private drawLink(
    ctx: CanvasRenderingContext2D, 
    link: UnifiedLink, 
    hoveredNode?: EnhancedUnifiedNode | null,
    hoveredLink?: UnifiedLink | null
  ) {
    const source = typeof link.source === 'object' ? link.source as EnhancedUnifiedNode : { x: 0, y: 0 } as EnhancedUnifiedNode;
    const target = typeof link.target === 'object' ? link.target as EnhancedUnifiedNode : { x: 0, y: 0 } as EnhancedUnifiedNode;
    
    if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return;

    const isConnectedToHover = hoveredNode && (link.source === hoveredNode || link.target === hoveredNode);
    const isHovered = link === hoveredLink;
    
    // Determine opacity and width
    let globalAlpha = 0.15; // Base low opacity
    let width = Math.max(1.5, Math.sqrt(link.tradeCount) * 0.8);

    if (isConnectedToHover || isHovered) {
      globalAlpha = 0.8;
      width = Math.max(3, Math.sqrt(link.tradeCount) * 1.5);
    } else if (hoveredNode) {
      globalAlpha = 0.05; // Dim others
    }

    ctx.globalAlpha = globalAlpha;
    ctx.lineWidth = width;

    // Create gradient
    const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
    gradient.addColorStop(0, this.colors.accentFrom);
    gradient.addColorStop(1, this.colors.accentTo);
    ctx.strokeStyle = gradient;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    
    ctx.globalAlpha = 1.0; // Reset
  }

  /**
   * Draw a single node
   */
  private drawNode(
    ctx: CanvasRenderingContext2D, 
    node: EnhancedUnifiedNode,
    hoveredNode?: EnhancedUnifiedNode | null,
    selectedNode?: EnhancedUnifiedNode | null
  ) {
    if (node.x === undefined || node.y === undefined) return;

    const isActive = (node === hoveredNode) || (node === selectedNode);
    const isDimmed = hoveredNode && !isActive && !this.isConnected(node, hoveredNode);
    
    ctx.globalAlpha = isDimmed ? 0.3 : 1.0;

    const radius = node.type === 'token' 
      ? this.calculateTokenRadius(node) 
      : this.calculateKOLRadius(node);

    // 1. Glow effect for active/high-value nodes
    if (isActive || (node.value > 50)) {
      const glowColor = node.type === 'token' ? this.colors.accentTo : this.colors.kolWarm;
      ctx.shadowBlur = isActive ? 20 : 10;
      ctx.shadowColor = glowColor;
    } else {
      ctx.shadowBlur = 0;
    }

    // 2. Base Circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = this.getNodeColor(node);
    ctx.fill();

    // Reset shadow for inner elements
    ctx.shadowBlur = 0;

    // 3. Image (Avatar/Logo)
    if (node.displayImage) {
      this.drawImageInCircle(ctx, node.displayImage, node.x, node.y, radius * 0.85);
    } else {
      // Fallback: Inner circle pattern
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 0.6, 0, 2 * Math.PI);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.stroke();
      ctx.setLineDash([]); // Reset
    }

    // 4. Stroke/Border
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = (node.metadata as any)?.verified || (node.metadata as any)?.isActive 
      ? '#FFFFFF' 
      : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = isActive ? 3 : 1.5;
    ctx.stroke();

    // 5. Label (Only if significant or hovered)
    if (isActive || radius > 25) {
      this.drawLabel(ctx, node, radius);
    }

    ctx.globalAlpha = 1.0;
  }

  /**
   * Draw label text below node
   */
  private drawLabel(ctx: CanvasRenderingContext2D, node: EnhancedUnifiedNode, radius: number) {
    if (!node.x || !node.y) return;
    
    const label = node.displayName || node.label || node.id.slice(0, 8);
    
    ctx.font = 'bold 12px "Darker Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Text Shadow (Outline) for readability
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(label, node.x, node.y + radius + 14);
    
    // Text Fill
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, node.x, node.y + radius + 14);
  }

  /**
   * Helper to draw clipped image
   */
  private drawImageInCircle(
    ctx: CanvasRenderingContext2D, 
    url: string, 
    x: number, 
    y: number, 
    radius: number
  ) {
    const img = this.getImage(url);
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.clip();
      ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
    }
  }

  /**
   * Image caching logic
   */
  private getImage(url: string): HTMLImageElement | null {
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }

    if (!this.loadingImages.has(url)) {
      this.loadingImages.add(url);
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Important for canvas export if needed
      img.src = url;
      img.onload = () => {
        this.imageCache.set(url, img);
        this.loadingImages.delete(url);
      };
      img.onerror = () => {
        this.loadingImages.delete(url);
      };
    }
    return null;
  }

  /**
   * Helpers
   */
  private getNodeColor(node: EnhancedUnifiedNode): string {
    if (node.isTrending) return this.colors.accentFrom;
    if (node.type === 'token') {
      return this.tokenColorScale(node.connections);
    } else {
      return this.kolColorScale(node.influenceScore || 0);
    }
  }

  private calculateTokenRadius(node: EnhancedUnifiedNode): number {
    const baseSize = 20;
    const connectionBonus = Math.sqrt(node.connections) * 6;
    const volumeBonus = Math.log((node.totalVolume || 0) + 1) * 2;
    return Math.min(50, baseSize + connectionBonus + volumeBonus);
  }

  private calculateKOLRadius(node: EnhancedUnifiedNode): number {
    const baseSize = 14;
    const influenceBonus = Math.sqrt(node.influenceScore || 0) * 2.2;
    const tradeBonus = Math.sqrt(node.tradeCount || 0) * 1.5;
    return Math.min(40, baseSize + influenceBonus + tradeBonus);
  }

  private isConnected(a: EnhancedUnifiedNode, b: EnhancedUnifiedNode): boolean {
    // This logic usually resides in visualizer, but needed here for immediate mode rendering decisions if links aren't passed
    // For now, we rely on checking links array if provided, or simplistic assumption
    return false; // Stub, real logic should pass active links
  }
  
  private isLinkConnectedToNode(link: UnifiedLink, node: EnhancedUnifiedNode): boolean {
    return link.source === node || link.target === node;
  }
}
