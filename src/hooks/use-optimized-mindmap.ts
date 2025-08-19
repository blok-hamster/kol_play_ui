import { useEffect, useRef, useCallback, useMemo } from 'react';
import { OptimizedMindmapRenderer, MindmapRenderConfig, UnifiedNode } from '@/lib/mindmap-renderer';
import { MindmapUpdate } from './use-kol-trade-socket';

interface UseOptimizedMindmapOptions {
  width: number;
  height: number;
  tokensData: { [tokenMint: string]: MindmapUpdate };
  trendingTokens: string[];
  onNodeClick?: (node: UnifiedNode) => void;
  onNodeHover?: (node: UnifiedNode | null) => void;
  config?: Partial<MindmapRenderConfig>;
}

interface UseOptimizedMindmapReturn {
  svgRef: React.RefObject<SVGSVGElement>;
  isRendering: boolean;
  renderError: string | null;
  performanceMetrics: {
    renderCount: number;
    lastRenderTime: number;
    cacheSize: number;
  };
  controls: {
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    forceRerender: () => void;
  };
}

export const useOptimizedMindmap = ({
  width,
  height,
  tokensData,
  trendingTokens,
  onNodeClick,
  onNodeHover,
  config = {}
}: UseOptimizedMindmapOptions): UseOptimizedMindmapReturn => {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendererRef = useRef<OptimizedMindmapRenderer | null>(null);
  const isRenderingRef = useRef(false);
  const renderErrorRef = useRef<string | null>(null);
  const forceRerenderRef = useRef(0);

  // Memoized configuration with optimized defaults
  const renderConfig = useMemo<MindmapRenderConfig>(() => ({
    width,
    height,
    nodeRadius: {
      token: { base: 20, max: 55 },
      kol: { base: 14, max: 40 }
    },
    linkDistance: 120,
    forces: {
      charge: -400,
      collision: 0.7,
      center: 0.05,
      link: 0.3
    },
    animation: {
      duration: 300,
      alphaTarget: 0.3,
      alphaDecay: 0.0228
    },
    ...config
  }), [width, height, config]);

  // Initialize renderer
  useEffect(() => {
    if (!rendererRef.current) {
      rendererRef.current = new OptimizedMindmapRenderer(renderConfig);
    }
    
    return () => {
      if (rendererRef.current) {
        rendererRef.current.cleanup();
        rendererRef.current = null;
      }
    };
  }, [renderConfig]);

  // Memoized data hash for change detection
  const dataHash = useMemo(() => {
    const dataString = JSON.stringify({
      tokens: Object.keys(tokensData).sort(),
      trending: trendingTokens.sort(),
      nodeCount: Object.values(tokensData).reduce((sum, data) => 
        sum + Object.keys(data.kolConnections || {}).length, 0
      ),
      timestamp: Math.floor(Date.now() / 30000) // 30-second cache window
    });
    
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString();
  }, [tokensData, trendingTokens]);

  // Debounced render function
  const debouncedRender = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      
      return () => {
        clearTimeout(timeoutId);
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

            // Render incrementally
            await rendererRef.current.renderIncremental(
              svgRef.current,
              processedData,
              onNodeClick,
              onNodeHover
            );

            // Log render time
            const renderTime = performance.now() - renderStartTime;
            console.debug('Mindmap render completed in', renderTime.toFixed(2), 'ms');

          } catch (error) {
            console.error('Mindmap render failed:', error);
            renderErrorRef.current = error instanceof Error ? error.message : 'Unknown render error';
            
            // Log render error
            const renderTime = performance.now() - renderStartTime;
            console.error('Mindmap render failed after', renderTime.toFixed(2), 'ms:', error);
          } finally {
            isRenderingRef.current = false;
          }
        }, 100); // 100ms debounce
      };
    })(),
    [tokensData, trendingTokens, onNodeClick, onNodeHover, dataHash]
  );

  // Trigger render when data changes
  useEffect(() => {
    debouncedRender();
  }, [debouncedRender, forceRerenderRef.current]);

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
        cacheSize: 0
      };
    }
    
    const metrics = rendererRef.current.getPerformanceMetrics();
    return {
      renderCount: metrics.renderCount,
      lastRenderTime: metrics.lastRenderTime,
      cacheSize: metrics.cacheSize
    };
  }, [dataHash]); // Update when data changes

  return {
    svgRef,
    isRendering: isRenderingRef.current,
    renderError: renderErrorRef.current,
    performanceMetrics,
    controls
  };
};

export default useOptimizedMindmap;