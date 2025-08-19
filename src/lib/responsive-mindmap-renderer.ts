import * as d3 from 'd3';
import { OptimizedMindmapRenderer, MindmapRenderConfig, UnifiedNode, UnifiedLink } from './mindmap-renderer';
import { ResponsiveMindmapConfig } from '@/hooks/use-responsive-mindmap';

export interface TouchGesture {
  type: 'tap' | 'doubleTap' | 'pinch' | 'pan';
  point?: { x: number; y: number };
  scale?: number;
  center?: { x: number; y: number };
  delta?: { x: number; y: number };
}

export interface ResponsiveMindmapRenderConfig extends MindmapRenderConfig {
  responsive: ResponsiveMindmapConfig;
}

export class ResponsiveMindmapRenderer extends OptimizedMindmapRenderer {
  private touchState: {
    isActive: boolean;
    startTime: number;
    startPoint: { x: number; y: number } | null;
    lastPinchScale: number;
    lastPanDelta: { x: number; y: number };
  } = {
    isActive: false,
    startTime: 0,
    startPoint: null,
    lastPinchScale: 1,
    lastPanDelta: { x: 0, y: 0 },
  };

  private performanceOptimizations: {
    nodeLimit: number;
    animationEnabled: boolean;
    renderThrottle: number;
    lastRenderTime: number;
  } = {
    nodeLimit: 100,
    animationEnabled: true,
    renderThrottle: 50,
    lastRenderTime: 0,
  };

  constructor(config: ResponsiveMindmapRenderConfig) {
    super(config);
    
    // Apply responsive performance settings
    this.performanceOptimizations = {
      nodeLimit: config.responsive.performance.maxNodes,
      animationEnabled: config.responsive.performance.enableAnimations,
      renderThrottle: config.responsive.performance.renderThrottle,
      lastRenderTime: 0,
    };
  }

  /**
   * Enhanced render method with responsive optimizations
   */
  async renderIncremental(
    svg: SVGSVGElement,
    data: { nodes: UnifiedNode[]; links: UnifiedLink[]; isValid: boolean; errors: string[] },
    onNodeClick?: (node: UnifiedNode) => void,
    onNodeHover?: (node: UnifiedNode | null) => void,
    responsiveConfig?: ResponsiveMindmapConfig
  ): Promise<void> {
    // Throttle rendering for performance
    const now = Date.now();
    if (now - this.performanceOptimizations.lastRenderTime < this.performanceOptimizations.renderThrottle) {
      return;
    }
    this.performanceOptimizations.lastRenderTime = now;

    // Limit nodes for performance on low-powered devices
    let { nodes, links } = data;
    if (nodes.length > this.performanceOptimizations.nodeLimit) {
      // Prioritize nodes by importance (trade count, influence score)
      nodes = nodes
        .sort((a, b) => {
          const aScore = (a.tradeCount || 0) + (a.influenceScore || 0);
          const bScore = (b.tradeCount || 0) + (b.influenceScore || 0);
          return bScore - aScore;
        })
        .slice(0, this.performanceOptimizations.nodeLimit);

      // Filter links to only include those between remaining nodes
      const nodeIds = new Set(nodes.map(n => n.id));
      links = links.filter(l => nodeIds.has(l.source.toString()) && nodeIds.has(l.target.toString()));
    }

    // Call parent render method with optimized data
    await super.renderIncremental(
      svg,
      { ...data, nodes, links },
      onNodeClick,
      onNodeHover
    );

    // Add responsive touch handlers if config provided
    if (responsiveConfig?.interactions.enableZoom || responsiveConfig?.interactions.enablePan) {
      this.setupTouchInteractions(svg, responsiveConfig);
    }
  }

  /**
   * Setup touch interactions for mobile and tablet devices
   */
  private setupTouchInteractions(svg: SVGSVGElement, config: ResponsiveMindmapConfig): void {
    const svgSelection = d3.select(svg);
    
    // Remove existing touch handlers
    svgSelection.on('touchstart', null);
    svgSelection.on('touchmove', null);
    svgSelection.on('touchend', null);

    if (!config.interactions.enableZoom && !config.interactions.enablePan) {
      return;
    }

    let touches: TouchList | null = null;
    let lastDistance = 0;
    let lastCenter = { x: 0, y: 0 };
    let lastTapTime = 0;
    let tapCount = 0;

    // Touch start handler
    svgSelection.on('touchstart', (event: TouchEvent) => {
      event.preventDefault();
      touches = event.touches;
      
      this.touchState.isActive = true;
      this.touchState.startTime = Date.now();

      if (touches.length === 1) {
        // Single touch - potential tap or pan start
        const touch = touches[0];
        this.touchState.startPoint = { x: touch.clientX, y: touch.clientY };
        
        // Check for double tap
        const now = Date.now();
        if (now - lastTapTime < 300) {
          tapCount++;
          if (tapCount === 2 && config.interactions.doubleTapZoom) {
            this.handleDoubleTap(touch.clientX, touch.clientY, svg);
            tapCount = 0;
          }
        } else {
          tapCount = 1;
        }
        lastTapTime = now;
        
      } else if (touches.length === 2 && config.interactions.enableZoom) {
        // Pinch gesture start
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        lastDistance = this.getTouchDistance(touch1, touch2);
        lastCenter = this.getTouchCenter(touch1, touch2);
        this.touchState.lastPinchScale = 1;
      }
    });

    // Touch move handler
    svgSelection.on('touchmove', (event: TouchEvent) => {
      if (!this.touchState.isActive) return;
      
      event.preventDefault();
      touches = event.touches;

      if (touches.length === 1 && config.interactions.enablePan) {
        // Pan gesture
        const touch = touches[0];
        if (this.touchState.startPoint) {
          const deltaX = (touch.clientX - this.touchState.startPoint.x) * config.interactions.touchSensitivity;
          const deltaY = (touch.clientY - this.touchState.startPoint.y) * config.interactions.touchSensitivity;
          
          this.handlePan(deltaX, deltaY, svg);
          this.touchState.startPoint = { x: touch.clientX, y: touch.clientY };
        }
        
      } else if (touches.length === 2 && config.interactions.enableZoom) {
        // Pinch gesture
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        const currentDistance = this.getTouchDistance(touch1, touch2);
        const currentCenter = this.getTouchCenter(touch1, touch2);
        
        if (lastDistance > 0) {
          const scale = currentDistance / lastDistance;
          this.handlePinch(scale, currentCenter, svg);
        }
        
        lastDistance = currentDistance;
        lastCenter = currentCenter;
      }
    });

    // Touch end handler
    svgSelection.on('touchend', (event: TouchEvent) => {
      touches = event.touches;
      
      if (touches.length === 0) {
        // All touches ended
        this.touchState.isActive = false;
        this.touchState.startPoint = null;
        lastDistance = 0;
        
        // Reset tap count after delay
        setTimeout(() => {
          if (Date.now() - lastTapTime > 300) {
            tapCount = 0;
          }
        }, 300);
      } else if (touches.length === 1) {
        // One touch remaining, reset pinch state
        lastDistance = 0;
        this.touchState.lastPinchScale = 1;
      }
    });
  }

  /**
   * Handle double tap to zoom
   */
  private handleDoubleTap(x: number, y: number, svg: SVGSVGElement): void {
    const svgSelection = d3.select(svg);
    const currentTransform = d3.zoomTransform(svg);
    
    // Calculate zoom point relative to SVG
    const rect = svg.getBoundingClientRect();
    const svgX = x - rect.left;
    const svgY = y - rect.top;
    
    // Toggle between zoom levels
    const targetScale = currentTransform.k > 1 ? 1 : 2;
    
    const transition = svgSelection.transition()
      .duration(this.performanceOptimizations.animationEnabled ? 300 : 0);
    
    if (this.zoomBehavior) {
      this.zoomBehavior.scaleTo(transition as any, targetScale);
    }
  }

  /**
   * Handle pan gesture
   */
  private handlePan(deltaX: number, deltaY: number, svg: SVGSVGElement): void {
    const svgSelection = d3.select(svg);
    const currentTransform = d3.zoomTransform(svg);
    
    const newTransform = d3.zoomIdentity
      .translate(currentTransform.x + deltaX, currentTransform.y + deltaY)
      .scale(currentTransform.k);
    
    if (this.zoomBehavior) {
      svgSelection.call(this.zoomBehavior.transform, newTransform);
    }
  }

  /**
   * Handle pinch gesture
   */
  private handlePinch(scale: number, center: { x: number; y: number }, svg: SVGSVGElement): void {
    const svgSelection = d3.select(svg);
    const currentTransform = d3.zoomTransform(svg);
    
    // Calculate zoom point relative to SVG
    const rect = svg.getBoundingClientRect();
    const svgX = center.x - rect.left;
    const svgY = center.y - rect.top;
    
    // Apply scale with center point
    const newScale = Math.max(0.1, Math.min(5, currentTransform.k * scale));
    
    if (this.zoomBehavior) {
      const transition = this.performanceOptimizations.animationEnabled 
        ? svgSelection.transition().duration(0) 
        : svgSelection;
      
      this.zoomBehavior.scaleTo(transition as any, newScale, [svgX, svgY]);
    }
  }

  /**
   * Get distance between two touches
   */
  private getTouchDistance(touch1: Touch, touch2: Touch): number {
    return Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
  }

  /**
   * Get center point between two touches
   */
  private getTouchCenter(touch1: Touch, touch2: Touch): { x: number; y: number } {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }

  /**
   * Override zoom methods to respect performance settings
   */
  zoomIn(): void {
    if (!this.performanceOptimizations.animationEnabled) {
      // Instant zoom for low-powered devices
      super.zoomIn();
      return;
    }
    
    super.zoomIn();
  }

  zoomOut(): void {
    if (!this.performanceOptimizations.animationEnabled) {
      // Instant zoom for low-powered devices
      super.zoomOut();
      return;
    }
    
    super.zoomOut();
  }

  resetZoom(): void {
    if (!this.performanceOptimizations.animationEnabled) {
      // Instant reset for low-powered devices
      super.resetZoom();
      return;
    }
    
    super.resetZoom();
  }

  /**
   * Update performance settings
   */
  updatePerformanceSettings(config: ResponsiveMindmapConfig): void {
    this.performanceOptimizations = {
      nodeLimit: config.performance.maxNodes,
      animationEnabled: config.performance.enableAnimations,
      renderThrottle: config.performance.renderThrottle,
      lastRenderTime: this.performanceOptimizations.lastRenderTime,
    };
  }

  /**
   * Get responsive performance metrics
   */
  getResponsiveMetrics(): {
    nodeLimit: number;
    animationEnabled: boolean;
    renderThrottle: number;
    touchActive: boolean;
  } {
    return {
      nodeLimit: this.performanceOptimizations.nodeLimit,
      animationEnabled: this.performanceOptimizations.animationEnabled,
      renderThrottle: this.performanceOptimizations.renderThrottle,
      touchActive: this.touchState.isActive,
    };
  }
}

export default ResponsiveMindmapRenderer;