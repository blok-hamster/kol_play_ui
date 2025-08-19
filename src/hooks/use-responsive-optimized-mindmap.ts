import { useEffect, useRef, useCallback, useMemo } from 'react';
import { ResponsiveMindmapRenderer, ResponsiveMindmapRenderConfig } from '@/lib/responsive-mindmap-renderer';
import { UnifiedNode } from '@/lib/mindmap-renderer';
import { MindmapUpdate } from './use-kol-trade-socket';
import { useResponsiveMindmap, ResponsiveMindmapConfig } from './use-responsive-mindmap';

interface UseResponsiveOptimizedMindmapOptions {
  containerRef: React.RefObject<HTMLElement>;
  tokensData: { [tokenMint: string]: MindmapUpdate };
  trendingTokens: string[];
  onNodeClick?: (node: UnifiedNode) => void;
  onNodeHover?: (node: UnifiedNode | null) => void;
  baseConfig?: Partial<ResponsiveMindmapConfig>;
}

interface UseResponsiveOptimizedMindmapReturn {
  svgRef: React.RefObject<SVGSVGElement>;
  isRendering: boolean;
  renderError: string | null;
  deviceInfo: ReturnType<typeof useResponsiveMindmap>['deviceInfo'];
  responsiveConfig: ResponsiveMindmapConfig;
  performanceMetrics: {
    renderCount: number;
    lastRenderTime: number;
    cacheSize: number;
    nodeLimit: number;
    animationEnabled: boolean;
    touchActive: boolean;
  };
  controls: {
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    forceRerender: () => void;
  };
}

export const useResponsiveOptimizedMindmap = ({
  containerRef,
  tokensData,
  trendingTokens,
  onNodeClick,
  onNodeHover,
  baseConfig = {}
}: UseResponsiveOptimizedMindmapOptions): UseResponsiveOptimizedMindmapReturn => {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendererRef = useRef<ResponsiveMindmapRenderer | null>(null);
  const isRenderingRef = useRef(false);
  const renderErrorRef = useRef<string | null>(null);
  const forceRerenderRef = useRef(0);

  // Get responsive configuration
  const { deviceInfo, responsiveConfig, touchHandlers } = useResponsiveMindmap(containerRef);

  // Merge base config with responsive config
  const finalConfig = useMemo<ResponsiveMindmapConfig>(() => ({
    ...responsiveConfig,
    ...baseConfig,
    // Ensure responsive settings take precedence for critical performance settings
    performance: {
      ...responsiveConfig.performance,
      ...baseConfig.performance,
    },
    interactions: {
      ...responsiveConfig.interactions,
      ...baseConfig.interactions,
    },
  }), [responsiveConfig, baseConfig]);

  // Create render config for the renderer
  const renderConfig = useMemo<ResponsiveMindmapRenderConfig>(() => ({
    width: finalConfig.dimensions.width,
    height: finalConfig.dimensions.height,
    nodeRadius: finalConfig.nodeRadius,
    linkDistance: finalConfig.linkDistance,
    forces: finalConfig.forces,
    animation: finalConfig.animation,
    responsive: finalConfig,
  }), [finalConfig]);

  // Initialize renderer when config changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.cleanup();
    }
    
    rendererRef.current = new ResponsiveMindmapRenderer(renderConfig);
    
    return () => {
      if (rendererRef.current) {
        rendererRef.current.cleanup();
        rendererRef.current = null;
      }
    };
  }, [renderConfig]);

  // Update renderer performance settings when device info changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updatePerformanceSettings(finalConfig);
    }
  }, [finalConfig]);

  // Memoized data hash for change detection
  const dataHash = useMemo(() => {
    const dataString = JSON.stringify({
      tokens: Object.keys(tokensData).sort(),
      trending: trendingTokens.sort(),
      nodeCount: Object.values(tokensData).reduce((sum, data) => 
        sum + Object.keys(data.kolConnections || {}).length, 0
      ),
      timestamp: Math.floor(Date.now() / 30000), // 30-second cache window
      deviceType: deviceInfo.isMobile ? 'mobile' : deviceInfo.isTablet ? 'tablet' : 'desktop',
      orientation: deviceInfo.orientation,
    });
    
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString();
  }, [tokensData, trendingTokens, deviceInfo.isMobile, deviceInfo.isTablet, deviceInfo.orientation]);

  // Debounced render function with responsive throttling
  const debouncedRender = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      
      return () => {
        clearTimeout(timeoutId);
        const debounceTime = finalConfig.performance.renderThrottle;
        
        timeoutId = setTimeout(async () => {
          if (!svgRef.current || !rendererRef.current || isRenderingRef.current) {
            return;
          }

          // Skip render if no meaningful data
          if (Object.keys(tokensData).length === 0) {
            return;
          }

          try {
            isRenderingRef.current = true;
            renderErrorRef.current = null;

            // Start render timing
            const renderStartTime = performance.now();

            // Process data with validation
            const processedData = rendererRef.current.processData(tokensData, trendingTokens);
            
            if (!processedData.isValid) {
              throw new Error(`Data validation failed: ${processedData.errors.join(', ')}`);
            }

            // Render with responsive optimizations
            await rendererRef.current.renderIncremental(
              svgRef.current,
              processedData,
              onNodeClick,
              onNodeHover,
              finalConfig
            );

            // Log render time
            const renderTime = performance.now() - renderStartTime;
            console.debug('Responsive mindmap render completed in', renderTime.toFixed(2), 'ms');

          } catch (error) {
            console.error('Responsive mindmap render failed:', error);
            renderErrorRef.current = error instanceof Error ? error.message : 'Unknown render error';
            
            // Log render error
            const renderTime = performance.now() - renderStartTime;
            console.error('Responsive mindmap render failed after', renderTime.toFixed(2), 'ms:', error);
          } finally {
            isRenderingRef.current = false;
          }
        }, debounceTime);
      };
    })(),
    [tokensData, trendingTokens, onNodeClick, onNodeHover, finalConfig, dataHash, deviceInfo]
  );

  // Trigger render when data or config changes
  useEffect(() => {
    debouncedRender();
  }, [debouncedRender, forceRerenderRef.current]);

  // Setup touch event handlers
  useEffect(() => {
    if (!svgRef.current || !deviceInfo.isTouch) {
      return;
    }

    const svg = svgRef.current;
    
    // Add touch event listeners
    const handleTouchStart = (event: TouchEvent) => {
      const result = touchHandlers.onTouchStart?.(event);
      if (result?.type === 'doubleTap' && finalConfig.interactions.doubleTapZoom) {
        // Handle double tap zoom
        event.preventDefault();
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      const result = touchHandlers.onTouchMove?.(event);
      if (result?.type === 'pinch' && finalConfig.interactions.enableZoom) {
        // Handle pinch zoom
        event.preventDefault();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      touchHandlers.onTouchEnd?.(event);
    };

    svg.addEventListener('touchstart', handleTouchStart, { passive: false });
    svg.addEventListener('touchmove', handleTouchMove, { passive: false });
    svg.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      svg.removeEventListener('touchstart', handleTouchStart);
      svg.removeEventListener('touchmove', handleTouchMove);
      svg.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchHandlers, finalConfig.interactions, deviceInfo.isTouch]);

  // Control functions
  const controls = useMemo(() => ({
    zoomIn: () => {
      rendererRef.current?.zoomIn();
    },
    zoomOut: () => {
      rendererRef.current?.zoomOut();
    },
    resetZoom: () => {
      rendererRef.current?.resetZoom();
    },
    forceRerender: () => {
      forceRerenderRef.current += 1;
    }
  }), []);

  // Performance metrics
  const performanceMetrics = useMemo(() => {
    if (!rendererRef.current) {
      return {
        renderCount: 0,
        lastRenderTime: 0,
        cacheSize: 0,
        nodeLimit: finalConfig.performance.maxNodes,
        animationEnabled: finalConfig.performance.enableAnimations,
        touchActive: false,
      };
    }
    
    const baseMetrics = rendererRef.current.getPerformanceMetrics();
    const responsiveMetrics = rendererRef.current.getResponsiveMetrics();
    
    return {
      renderCount: baseMetrics.renderCount,
      lastRenderTime: baseMetrics.lastRenderTime,
      cacheSize: baseMetrics.cacheSize,
      nodeLimit: responsiveMetrics.nodeLimit,
      animationEnabled: responsiveMetrics.animationEnabled,
      touchActive: responsiveMetrics.touchActive,
    };
  }, [dataHash, finalConfig.performance]);

  return {
    svgRef,
    isRendering: isRenderingRef.current,
    renderError: renderErrorRef.current,
    deviceInfo,
    responsiveConfig: finalConfig,
    performanceMetrics,
    controls,
  };
};

export default useResponsiveOptimizedMindmap;