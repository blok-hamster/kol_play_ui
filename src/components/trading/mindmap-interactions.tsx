'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  CircleDollarSign, 
  UserCheck, 
  TrendingUp, 
  Activity, 
  Wallet,
  BadgeDollarSign,
  Users,
  Target,
  Zap,
  Clock,
  BarChart3,
  X,
  Copy,
  ExternalLink,
  Share2,
  Bookmark,
  AlertCircle,
  CheckCircle,
  Info,
  Maximize2,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

interface UnifiedNode {
  id: string;
  type: 'token' | 'kol';
  label: string;
  name?: string;
  image?: string;
  symbol?: string;
  decimals?: number;
  value: number;
  connections: number;
  totalVolume?: number;
  tradeCount?: number;
  influenceScore?: number;
  isTrending?: boolean;
  tokenMint?: string;
  relatedTokens?: string[];
  lastTradeTime?: Date;
  avgTradeSize?: number;
  winRate?: number;
  x?: number;
  y?: number;
}

interface UnifiedLink {
  source: string | UnifiedNode;
  target: string | UnifiedNode;
  value: number;
  tradeCount: number;
  volume: number;
  strength?: number;
  frequency?: number;
  lastActivity?: Date;
}

interface InteractionState {
  selectedNode: UnifiedNode | null;
  hoveredNode: UnifiedNode | null;
  highlightedConnections: string[];
  showConnectionDetails: boolean;
  interactionMode: 'hover' | 'click' | 'none';
}

interface NodeInteractionSystemProps {
  nodes: UnifiedNode[];
  links: UnifiedLink[];
  onNodeSelect?: (node: UnifiedNode | null) => void;
  onNodeHover?: (node: UnifiedNode | null) => void;
  onConnectionHighlight?: (connections: string[]) => void;
  className?: string;
}

interface DetailedInfoPanelProps {
  node: UnifiedNode;
  connections: UnifiedLink[];
  onClose: () => void;
  onError?: (error: Error) => void;
  className?: string;
}

interface HoverFeedbackProps {
  node: UnifiedNode;
  position: { x: number; y: number };
  className?: string;
}

interface ConnectionHighlightProps {
  connections: UnifiedLink[];
  selectedNode: UnifiedNode;
  onConnectionSelect?: (connection: UnifiedLink) => void;
  className?: string;
}

// Enhanced Detailed Information Panel
export const DetailedInfoPanel: React.FC<DetailedInfoPanelProps> = ({ 
  node, 
  connections, 
  onClose, 
  onError,
  className 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [bookmarked, setBookmarked] = useState(false);

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toFixed(2);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(node.id);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      setCopyStatus('error');
      onError && onError(error as Error);
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  }, [node.id, onError]);

  const handleExternalLink = useCallback(() => {
    try {
      const url = node.type === 'token' 
        ? `https://dexscreener.com/solana/${node.id}`
        : `https://dexscreener.com/solana?q=${node.id}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      onError && onError(error as Error);
    }
  }, [node.id, node.type, onError]);

  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${node.type === 'token' ? 'Token' : 'KOL'}: ${node.name || node.id}`,
          text: `Check out this ${node.type} on the trading network`,
          url: window.location.href
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(window.location.href);
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2000);
      }
    } catch (error) {
      onError && onError(error as Error);
    }
  }, [node, onError]);

  const relatedConnections = connections.filter(link => 
    (typeof link.source === 'object' ? link.source.id : link.source) === node.id ||
    (typeof link.target === 'object' ? link.target.id : link.target) === node.id
  );

  return (
    <Card className={cn(
      "w-96 max-h-[80vh] overflow-hidden bg-card/95 backdrop-blur-sm border-2",
      "animate-in slide-in-from-right-5 duration-300",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {node.type === 'token' ? (
              <CircleDollarSign className="h-5 w-5 text-primary" />
            ) : (
              <UserCheck className="h-5 w-5 text-blue-500" />
            )}
            <span>{node.type === 'token' ? 'Token Details' : 'KOL Profile'}</span>
            {node.isTrending && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-500 rounded-full">
                <TrendingUp className="h-3 w-3" />
                <span className="text-xs">Trending</span>
              </div>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 overflow-y-auto">
        {/* Node Identity */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {node.image ? (
              <img 
                src={node.image} 
                alt={node.name || node.symbol || node.type} 
                className="w-12 h-12 rounded-full border-2 border-primary/20"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                node.type === 'token' 
                  ? "bg-gradient-to-br from-primary to-secondary" 
                  : "bg-gradient-to-br from-blue-500 to-purple-500"
              )}>
                <span className="text-white font-bold text-sm">
                  {node.type === 'token' 
                    ? (node.symbol || node.name || 'T').slice(0, 2).toUpperCase()
                    : (node.name || 'KOL').slice(0, 2).toUpperCase()
                  }
                </span>
              </div>
            )}
            <div className="flex-1">
              <div className="font-semibold text-lg">
                {node.type === 'token' 
                  ? (node.name && node.symbol ? `${node.name} (${node.symbol})` : (node.name || node.symbol || 'Token'))
                  : (node.name || 'KOL Trader')
                }
              </div>
              <div className="font-mono text-sm text-muted-foreground">
                {node.id.slice(0, 12)}...{node.id.slice(-8)}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="flex-1"
            >
              {copyStatus === 'copied' ? (
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              ) : copyStatus === 'error' ? (
                <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExternalLink}
              className="flex-1"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              DexScreener
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBookmarked(!bookmarked)}
            >
              <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current text-yellow-500")} />
            </Button>
          </div>
        </div>

        {/* Core Metrics */}
        <div className="grid grid-cols-2 gap-4">
          {node.type === 'token' ? (
            <>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Connected KOLs</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {formatNumber(node.connections)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4" />
                  <span>Total Trades</span>
                </div>
                <div className="text-2xl font-bold">
                  {formatNumber(node.tradeCount || 0)}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  <span>Influence</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {Math.round(node.influenceScore || 0)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <CircleDollarSign className="h-4 w-4" />
                  <span>Tokens Traded</span>
                </div>
                <div className="text-2xl font-bold">
                  {node.relatedTokens?.length || 0}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Volume Display */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <BadgeDollarSign className="h-4 w-4" />
            <span>Trading Volume</span>
          </div>
          <div className="text-3xl font-bold text-accent-from">
            {formatVolume(node.totalVolume || 0)} SOL
          </div>
        </div>

        {/* Extended Metrics (when expanded) */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t border-border/50">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {node.avgTradeSize && (
                <div>
                  <div className="text-muted-foreground">Avg Trade Size</div>
                  <div className="font-semibold">{formatVolume(node.avgTradeSize)} SOL</div>
                </div>
              )}
              {node.winRate && (
                <div>
                  <div className="text-muted-foreground">Win Rate</div>
                  <div className={cn(
                    "font-semibold",
                    node.winRate > 60 ? "text-green-500" : 
                    node.winRate > 40 ? "text-yellow-500" : "text-red-500"
                  )}>
                    {node.winRate.toFixed(1)}%
                  </div>
                </div>
              )}
              {node.lastTradeTime && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">Last Activity</div>
                  <div className="font-semibold">
                    {formatDistanceToNow(node.lastTradeTime, { addSuffix: true })}
                  </div>
                </div>
              )}
            </div>

            {/* Connection Analysis */}
            {relatedConnections.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 className="h-4 w-4" />
                  <span>Top Connections ({relatedConnections.length})</span>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {relatedConnections
                    .sort((a, b) => b.volume - a.volume)
                    .slice(0, 5)
                    .map((connection, index) => {
                      const otherNode = (typeof connection.source === 'object' ? connection.source.id : connection.source) === node.id
                        ? connection.target
                        : connection.source;
                      const otherNodeId = typeof otherNode === 'object' ? otherNode.id : otherNode;
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <div className="flex-1">
                            <div className="font-mono text-xs">
                              {otherNodeId.slice(0, 8)}...{otherNodeId.slice(-6)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {connection.tradeCount} trades
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-sm">
                              {formatVolume(connection.volume)} SOL
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Visual Hover Feedback Component
export const HoverFeedback: React.FC<HoverFeedbackProps> = ({ 
  node, 
  position, 
  className 
}) => {
  return (
    <div 
      className={cn(
        "absolute z-40 pointer-events-none",
        "animate-in fade-in-0 zoom-in-95 duration-150",
        className
      )}
      style={{
        left: position.x + 10,
        top: position.y - 10,
        transform: 'translate(0, -100%)'
      }}
    >
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 max-w-xs">
        <div className="flex items-center gap-2 mb-2">
          {node.type === 'token' ? (
            <CircleDollarSign className="h-4 w-4 text-primary" />
          ) : (
            <UserCheck className="h-4 w-4 text-blue-500" />
          )}
          <span className="font-semibold text-sm">
            {node.name || `${node.type === 'token' ? 'Token' : 'KOL'}`}
          </span>
          {node.isTrending && (
            <TrendingUp className="h-3 w-3 text-green-500" />
          )}
        </div>
        
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {node.type === 'token' ? 'KOLs' : 'Influence'}:
            </span>
            <span className="font-medium">
              {node.type === 'token' ? node.connections : Math.round(node.influenceScore || 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Volume:</span>
            <span className="font-medium text-accent-from">
              {(node.totalVolume || 0) >= 1000 
                ? `${((node.totalVolume || 0) / 1000).toFixed(1)}K` 
                : (node.totalVolume || 0).toFixed(2)} SOL
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Trades:</span>
            <span className="font-medium">{node.tradeCount || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Connection Highlighting System
export const ConnectionHighlight: React.FC<ConnectionHighlightProps> = ({ 
  connections, 
  selectedNode, 
  onConnectionSelect,
  className 
}) => {
  const [selectedConnection, setSelectedConnection] = useState<UnifiedLink | null>(null);

  const handleConnectionClick = useCallback((connection: UnifiedLink) => {
    setSelectedConnection(connection);
    onConnectionSelect && onConnectionSelect(connection);
  }, [onConnectionSelect]);

  const relatedConnections = connections.filter(link => 
    (typeof link.source === 'object' ? link.source.id : link.source) === selectedNode.id ||
    (typeof link.target === 'object' ? link.target.id : link.target) === selectedNode.id
  );

  if (relatedConnections.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      "absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3",
      "animate-in slide-in-from-bottom-5 duration-300",
      className
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Target className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">
          Connections ({relatedConnections.length})
        </span>
      </div>
      
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {relatedConnections
          .sort((a, b) => b.volume - a.volume)
          .slice(0, 5)
          .map((connection, index) => {
            const otherNode = (typeof connection.source === 'object' ? connection.source.id : connection.source) === selectedNode.id
              ? connection.target
              : connection.source;
            const otherNodeId = typeof otherNode === 'object' ? otherNode.id : otherNode;
            
            return (
              <button
                key={index}
                onClick={() => handleConnectionClick(connection)}
                className={cn(
                  "w-full flex items-center justify-between p-2 rounded text-left transition-colors",
                  "hover:bg-muted/50",
                  selectedConnection === connection && "bg-primary/10 border border-primary/20"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs truncate">
                    {otherNodeId.slice(0, 12)}...
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {connection.tradeCount} trades
                  </div>
                </div>
                <div className="text-right ml-2">
                  <div className="font-semibold text-xs">
                    {connection.volume >= 1000 
                      ? `${(connection.volume / 1000).toFixed(1)}K` 
                      : connection.volume.toFixed(1)} SOL
                  </div>
                  <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full"
                      style={{ 
                        width: `${Math.min(100, (connection.volume / Math.max(...relatedConnections.map(c => c.volume))) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
};

// Main Node Interaction System
export const NodeInteractionSystem: React.FC<NodeInteractionSystemProps> = ({
  nodes,
  links,
  onNodeSelect,
  onNodeHover,
  onConnectionHighlight,
  className
}) => {
  const [interactionState, setInteractionState] = useState<InteractionState>({
    selectedNode: null,
    hoveredNode: null,
    highlightedConnections: [],
    showConnectionDetails: false,
    interactionMode: 'none'
  });

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [errors, setErrors] = useState<Error[]>([]);

  const handleNodeSelect = useCallback((node: UnifiedNode | null) => {
    setInteractionState(prev => ({
      ...prev,
      selectedNode: node,
      interactionMode: node ? 'click' : 'none',
      highlightedConnections: node ? 
        links
          .filter(link => 
            (typeof link.source === 'object' ? link.source.id : link.source) === node.id ||
            (typeof link.target === 'object' ? link.target.id : link.target) === node.id
          )
          .map(link => `${typeof link.source === 'object' ? link.source.id : link.source}-${typeof link.target === 'object' ? link.target.id : link.target}`)
        : []
    }));

    onNodeSelect && onNodeSelect(node);
    if (node) {
      const connectionIds = links
        .filter(link => 
          (typeof link.source === 'object' ? link.source.id : link.source) === node.id ||
          (typeof link.target === 'object' ? link.target.id : link.target) === node.id
        )
        .map(link => `${typeof link.source === 'object' ? link.source.id : link.source}-${typeof link.target === 'object' ? link.target.id : link.target}`);
      onConnectionHighlight && onConnectionHighlight(connectionIds);
    }
  }, [links, onNodeSelect, onConnectionHighlight]);

  const handleNodeHover = useCallback((node: UnifiedNode | null, position?: { x: number; y: number }) => {
    if (interactionState.interactionMode === 'click') {
      return; // Don't show hover when in click mode
    }

    setInteractionState(prev => ({
      ...prev,
      hoveredNode: node,
      interactionMode: node ? 'hover' : 'none'
    }));

    if (position) {
      setMousePosition(position);
    }

    onNodeHover && onNodeHover(node);
  }, [interactionState.interactionMode, onNodeHover]);

  const handleError = useCallback((error: Error) => {
    setErrors(prev => [...prev, error]);
    console.error('Node interaction error:', error);
    
    // Auto-remove error after 5 seconds
    setTimeout(() => {
      setErrors(prev => prev.filter(e => e !== error));
    }, 5000);
  }, []);

  const handleConnectionSelect = useCallback((connection: UnifiedLink) => {
    // Highlight the specific connection
    const connectionId = `${typeof connection.source === 'object' ? connection.source.id : connection.source}-${typeof connection.target === 'object' ? connection.target.id : connection.target}`;
    onConnectionHighlight && onConnectionHighlight([connectionId]);
  }, [onConnectionHighlight]);

  return (
    <div className={cn("relative w-full h-full", className)}>
      {/* Error Display */}
      {errors.length > 0 && (
        <div className="absolute top-4 right-4 z-50 space-y-2">
          {errors.map((error, index) => (
            <div
              key={index}
              className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg shadow-lg animate-in slide-in-from-right-5"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Interaction Error</span>
              </div>
              <div className="text-xs mt-1 opacity-80">
                {error.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hover Feedback */}
      {interactionState.hoveredNode && interactionState.interactionMode === 'hover' && (
        <HoverFeedback
          node={interactionState.hoveredNode}
          position={mousePosition}
        />
      )}

      {/* Detailed Info Panel */}
      {interactionState.selectedNode && interactionState.interactionMode === 'click' && (
        <DetailedInfoPanel
          node={interactionState.selectedNode}
          connections={links}
          onClose={() => handleNodeSelect(null)}
          onError={handleError}
          className="absolute top-4 right-4 z-40"
        />
      )}

      {/* Connection Highlighting */}
      {interactionState.selectedNode && interactionState.highlightedConnections.length > 0 && (
        <ConnectionHighlight
          connections={links}
          selectedNode={interactionState.selectedNode}
          onConnectionSelect={handleConnectionSelect}
        />
      )}

      {/* Interaction Instructions */}
      {interactionState.interactionMode === 'none' && (
        <div className="absolute bottom-4 right-4 bg-card/80 backdrop-blur-sm border border-border rounded-lg p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1">
            <Info className="h-3 w-3" />
            <span className="font-medium">Interaction Guide</span>
          </div>
          <div className="space-y-0.5">
            <div>• Hover nodes for quick info</div>
            <div>• Click nodes for detailed view</div>
            <div>• Connections auto-highlight</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeInteractionSystem;