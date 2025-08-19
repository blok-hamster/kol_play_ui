'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { MindmapUpdate } from '@/hooks/use-kol-trade-socket';
import { useOptimizedMindmap } from '@/hooks/use-optimized-mindmap';
import { UnifiedNode } from '@/lib/mindmap-renderer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Activity,
  TrendingUp,
  X,
  CircleDollarSign,
  UserCheck,
  Copy,
  ExternalLink,
  Lightbulb,
  AlertCircle
} from 'lucide-react';

interface UnifiedKOLMindmapProps {
  tokensData: { [tokenMint: string]: MindmapUpdate };
  trendingTokens: string[];
  width?: number;
  height?: number;
  className?: string;
}

export const OptimizedUnifiedKOLMindmap: React.FC<UnifiedKOLMindmapProps> = ({
  tokensData,
  trendingTokens,
  width = 1400,
  height = 800,
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<UnifiedNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<UnifiedNode | null>(null);
  const [highlightMode, setHighlightMode] = useState<'none' | 'trending' | 'high-volume'>('none');
  const [dimensions, setDimensions] = useState({ width, height });

  // Update dimensions when container resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth < 1024;
        
        let newWidth, newHeight;
        
        if (isMobile) {
          newWidth = Math.max(320, Math.min(rect.width, 800));
          newHeight = Math.max(200, Math.min(rect.height, 400));
        } else if (isTablet) {
          newWidth = Math.max(400, Math.min(rect.width, 1200));
          newHeight = Math.max(250, Math.min(rect.height, 500));
        } else {
          newWidth = Math.max(400, Math.min(rect.width, 2000));
          newHeight = Math.max(250, Math.min(rect.height, 600));
        }
        
        setDimensions({ width: newWidth, height: newHeight });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      updateDimensions();
    }

    window.addEventListener('resize', updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Filter tokens data based on highlight mode
  const filteredTokensData = useMemo(() => {
    if (highlightMode === 'none') {
      return tokensData;
    }

    const filtered: { [tokenMint: string]: MindmapUpdate } = {};
    
    Object.entries(tokensData).forEach(([tokenMint, data]) => {
      if (highlightMode === 'trending' && trendingTokens.includes(tokenMint)) {
        filtered[tokenMint] = data;
      } else if (highlightMode === 'high-volume') {
        const totalVolume = Object.values(data.kolConnections || {})
          .reduce((sum, kol) => sum + (kol.totalVolume || 0), 0);
        if (totalVolume > 100) {
          filtered[tokenMint] = data;
        }
      }
    });

    return Object.keys(filtered).length > 0 ? filtered : tokensData;
  }, [tokensData, trendingTokens, highlightMode]);

  // Use optimized mindmap hook
  const {
    svgRef,
    isRendering,
    renderError,
    performanceMetrics,
    controls
  } = useOptimizedMindmap({
    width: dimensions.width,
    height: dimensions.height,
    tokensData: filteredTokensData,
    trendingTokens,
    onNodeClick: (node) => {
      setSelectedNode(selectedNode?.id === node.id ? null : node);
    },
    onNodeHover: (node) => {
      if (!selectedNode) {
        setHoveredNode(node);
      }
    },
    config: {
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
      }
    }
  });

  const tokenCount = Object.keys(filteredTokensData).length;
  const totalKOLs = new Set(
    Object.values(filteredTokensData).flatMap(data => 
      Object.keys(data.kolConnections || {})
    )
  ).size;

  return (
    <div ref={containerRef} className={cn('w-full h-full flex flex-col min-h-[300px] max-h-[600px]', className)}>
      {/* Mobile-Responsive Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 px-2 sm:px-4 py-2 bg-muted/20 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center justify-center sm:justify-start space-x-2 sm:space-x-4 text-xs sm:text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CircleDollarSign className="h-3 w-3" />
            <span className="font-medium">{tokenCount}</span>
            <span className="hidden xs:inline">tokens</span>
          </span>
          <span className="flex items-center gap-1">
            <UserCheck className="h-3 w-3" />
            <span className="font-medium">{totalKOLs}</span>
            <span className="hidden xs:inline">KOLs</span>
          </span>
          {isRendering && (
            <span className="flex items-center gap-1 text-primary">
              <Activity className="h-3 w-3 animate-spin" />
              <span className="hidden xs:inline">Rendering</span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-1 overflow-x-auto pb-1">
          {/* Highlight Mode Toggle */}
          <Button
            variant={highlightMode === 'none' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setHighlightMode('none')}
            className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs flex-shrink-0"
            disabled={isRendering}
          >
            All
          </Button>
          <Button
            variant={highlightMode === 'trending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setHighlightMode('trending')}
            className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs flex-shrink-0"
            disabled={isRendering}
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            <span className="hidden xs:inline">Trending</span>
          </Button>
          <Button
            variant={highlightMode === 'high-volume' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setHighlightMode('high-volume')}
            className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs flex-shrink-0"
            disabled={isRendering}
          >
            <Activity className="h-3 w-3 mr-1" />
            <span className="hidden xs:inline">Volume</span>
          </Button>

          {/* Zoom Controls */}
          <div className="ml-1 sm:ml-2 flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={controls.zoomIn} 
              className="h-6 w-6 sm:h-7 sm:w-7 p-0"
              disabled={isRendering}
            >
              <ZoomIn className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={controls.zoomOut} 
              className="h-6 w-6 sm:h-7 sm:w-7 p-0"
              disabled={isRendering}
            >
              <ZoomOut className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={controls.resetZoom} 
              className="h-6 w-6 sm:h-7 sm:w-7 p-0"
              disabled={isRendering}
            >
              <RotateCcw className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Visualization */}
      <div className="relative flex-1 w-full h-full min-h-0 overflow-hidden">
        {/* Render Error Display */}
        {renderError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-20">
            <div className="flex flex-col items-center space-y-2 p-4 bg-card border border-border rounded-lg shadow-lg max-w-sm mx-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-medium">Rendering Error</p>
              <p className="text-xs text-muted-foreground text-center">{renderError}</p>
              <Button size="sm" onClick={controls.forceRerender}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full touch-pan-y touch-pinch-zoom"
          style={{ 
            display: 'block',
            background: 'transparent'
          }}
        />
        
        {/* Mobile-Optimized Legend */}
        <div className="absolute top-1 sm:top-2 left-1 sm:left-2 p-1.5 sm:p-2 bg-card/90 border border-border rounded-md shadow-sm">
          <div className="space-y-0.5 sm:space-y-1 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-accent-gradient flex items-center justify-center">
                <CircleDollarSign className="h-1 w-1 sm:h-1.5 sm:w-1.5 text-white" />
              </div>
              <span className="text-muted-foreground text-xs">Tokens</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border border-white flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)' }}>
                <UserCheck className="h-1 w-1 sm:h-1.5 sm:w-1.5 text-white" />
              </div>
              <span className="text-muted-foreground text-xs">KOLs</span>
            </div>
          </div>
        </div>

        {/* Performance Metrics (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 p-1.5 sm:p-2 bg-card/90 border border-border rounded-md shadow-sm text-xs text-muted-foreground">
            <div>Renders: {performanceMetrics.renderCount}</div>
            <div>Cache: {performanceMetrics.cacheSize}</div>
            <div>Nodes: {tokenCount + totalKOLs}</div>
          </div>
        )}

        {/* Mobile-Responsive Selected Node Info */}
        {selectedNode && (
          <NodeInfoPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            isClickState={true}
            className="absolute top-1 sm:top-2 right-1 sm:right-2 z-10 animate-slide-in"
          />
        )}

        {/* Desktop-only Interactive Guide - Hidden on Mobile */}
        <div className="hidden lg:block absolute bottom-2 right-2 p-2 bg-card/90 border border-border rounded-md shadow-sm text-xs text-muted-foreground max-w-48">
          <div className="font-semibold text-foreground mb-1 flex items-center gap-1">
            <Lightbulb className="h-3 w-3" />
            <span>Tips</span>
          </div>
          <div className="space-y-0.5">
            <div>• <strong>Drag</strong> nodes to reposition</div>
            <div>• <strong>Click</strong> to select</div>
            <div className="flex items-center gap-1">
              • <CircleDollarSign className="h-2.5 w-2.5" /> <strong>Tokens</strong> = larger with more connections
            </div>
            <div className="flex items-center gap-1">
              • <UserCheck className="h-2.5 w-2.5" /> <strong>KOLs</strong> = dashed border, size by influence
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 

// Unified NodeInfoPanel component for both hover and click states
const NodeInfoPanel: React.FC<{
  node: UnifiedNode;
  onClose?: () => void;
  isClickState?: boolean;
  className?: string;
}> = ({ node, onClose, isClickState = false, className }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(node.id);
  };

  const handleDexScreener = () => {
    const url = node.type === 'token' 
      ? `https://dexscreener.com/solana/${node.id}`
      : `https://dexscreener.com/solana?q=${node.id}`;
    window.open(url, '_blank');
  };

  return (
    <div className={cn("w-48 sm:w-64 bg-card/95 border border-border rounded-md shadow-lg", className)}>
      <div className="flex items-center justify-between p-1.5 sm:p-2 border-b border-border/50">
        <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-medium">
          {node.type === 'token' ? (
            <>
              <CircleDollarSign className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span>Token</span>
            </>
          ) : (
            <>
              <UserCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span>KOL</span>
            </>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-5 w-5 sm:h-6 sm:w-6 p-0"
          >
            <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          </Button>
        )}
      </div>
      
      <div className="p-1.5 sm:p-2 space-y-1.5 sm:space-y-2">
        <div className="text-xs">
          <div className="text-muted-foreground mb-0.5 sm:mb-1">
            {node.type === 'token' ? 'Address' : 'Wallet'}
          </div>
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs break-all">{node.id.slice(0, 12)}...</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-4 w-4 p-0 text-primary hover:text-primary/80"
              title={`Copy ${node.type === 'token' ? 'address' : 'wallet'}`}
            >
              <Copy className="h-2.5 w-2.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDexScreener}
              className="h-4 w-4 p-0 text-primary hover:text-primary/80"
              title={node.type === 'token' ? 'View on DexScreener' : 'Search on DexScreener'}
            >
              <ExternalLink className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>
        
        {node.type === 'token' ? (
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">KOLs</div>
              <div className="font-semibold">{node.connections}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Trades</div>
              <div className="font-semibold">{node.tradeCount}</div>
            </div>
            <div className="col-span-2">
              <div className="text-muted-foreground">Volume</div>
              <div className="font-semibold">{node.totalVolume?.toFixed(2)} SOL</div>
            </div>
            {node.isTrending && (
              <div className="col-span-2 flex items-center gap-1 text-primary">
                <TrendingUp className="h-3 w-3" />
                <span className="text-xs font-medium">Trending</span>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">Influence</div>
              <div className="font-semibold">{node.influenceScore?.toFixed(0)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Trades</div>
              <div className="font-semibold">{node.tradeCount}</div>
            </div>
            <div className="col-span-2">
              <div className="text-muted-foreground">Volume</div>
              <div className="font-semibold">{node.totalVolume?.toFixed(2)} SOL</div>
            </div>
            <div className="col-span-2">
              <div className="text-muted-foreground">Tokens</div>
              <div className="font-semibold">{node.connections}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizedUnifiedKOLMindmap;