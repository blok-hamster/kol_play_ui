'use client';

import { useRouter } from 'next/navigation';

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
  CheckCircle,
  Info,
  Maximize2,
  Eye,
  EyeOff,
  UserPlus,
  X,
  Target,
  Zap,
  BarChart3,
  Copy,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import TokenDetailModal from '@/components/modals/token-detail-modal';
import { executeInstantBuy, checkTradeConfig } from '@/lib/trade-utils';
import { useNotifications, useLoading } from '@/stores/use-ui-store';
import TradeConfigPrompt from '@/components/ui/trade-config-prompt';

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
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [buyingNodeId, setBuyingNodeId] = useState<string | null>(null);
  const [showTradeConfigPrompt, setShowTradeConfigPrompt] = useState(false);
  const router = useRouter();

  const { showSuccess, showError } = useNotifications();
  const { setLoading } = useLoading();

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

  const handleSubscribe = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-kol-modal', { detail: { kolId: node.id } }));
  }, [node.id]);

  const handleInstantBuy = useCallback(async () => {
    if (node.type === 'token') {
      if (buyingNodeId) return;

      try {
        setLoading('mindmap-buy', true);

        // Check if user has trade config
        const configCheck = await checkTradeConfig();

        if (!configCheck.hasConfig) {
          setShowTradeConfigPrompt(true);
          return;
        }

        setBuyingNodeId(node.id);
        const result = await executeInstantBuy(node.id, node.symbol || node.name);

        if (result.success) {
          showSuccess(
            'Buy Order Executed',
            `Successfully bought ${node.symbol || node.name || 'token'} for ${configCheck.config?.tradeConfig?.minSpend || 'N/A'} SOL`
          );
        } else {
          showError('Buy Error', result.error || 'Failed to execute buy order');
        }
      } catch (error: any) {
        showError('Buy Error', error.message || 'An unexpected error occurred');
      } finally {
        setBuyingNodeId(null);
        setLoading('mindmap-buy', false);
      }
    }
  }, [node.id, node.type, node.symbol, node.name, buyingNodeId, setLoading, showSuccess, showError]);

  const handleAnalyze = useCallback(() => {
    const mintOrId = node.type === 'token' ? node.id : node.tokenMint;
    if (mintOrId) {
      router.push(`/pro-terminal/analytics?address=${mintOrId}`);
    }
  }, [node.id, node.type, node.tokenMint, router]);

  const handleTerminal = useCallback(() => {
    const mintOrId = node.type === 'token' ? node.id : node.tokenMint;
    if (mintOrId) {
      router.push(`/pro-terminal/trade?mint=${mintOrId}`);
    }
  }, [node.id, node.type, node.tokenMint, router]);

  const relatedConnections = connections.filter(link =>
    (typeof link.source === 'object' ? link.source.id : link.source) === node.id ||
    (typeof link.target === 'object' ? link.target.id : link.target) === node.id
  );

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <Card className={cn(
      isMobile
        ? "fixed top-4 left-4 right-4 w-auto max-w-sm mx-auto max-h-[calc(100vh-2rem)]"
        : "w-80 lg:w-96 max-h-[75vh]",
      "overflow-hidden bg-card/95 backdrop-blur-sm border-2",
      isMobile
        ? "animate-in slide-in-from-bottom-5 duration-300"
        : "animate-in slide-in-from-right-5 duration-300",
      className
    )}>
      <CardHeader className="pb-1.5 sm:pb-2 px-2.5 sm:px-4 pt-2.5 sm:pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg">
            {node.type === 'token' ? (
              <CircleDollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
            ) : (
              <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0" />
            )}
            <span className="truncate">
              {node.type === 'token' ? 'Token Insights' : 'KOL Profile'}
            </span>
            {node.isTrending && (
              <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-500/10 text-green-500 rounded-full flex-shrink-0">
                <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="text-xs hidden sm:inline">Trending</span>
              </div>
            )}
          </CardTitle>
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0 hidden sm:flex"
            >
              {isExpanded ? <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 sm:space-y-4 overflow-y-auto px-2.5 sm:px-4 pb-2.5 sm:pb-4">
        {/* Node Identity */}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center gap-2 sm:gap-3">
            {node.image ? (
              <img
                src={node.image}
                alt={node.name || node.symbol || node.type}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-primary/20 flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className={cn(
                "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0",
                node.type === 'token'
                  ? "bg-gradient-to-br from-primary to-secondary"
                  : "bg-gradient-to-br from-blue-500 to-purple-500"
              )}>
                <span className="text-white font-bold text-xs sm:text-sm">
                  {node.type === 'token'
                    ? (node.symbol || node.name || 'T').slice(0, 2).toUpperCase()
                    : (node.name || 'KOL').slice(0, 2).toUpperCase()
                  }
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm sm:text-base truncate">
                {node.type === 'token'
                  ? (node.name && node.symbol ? `${node.name} (${node.symbol})` : (node.name || node.symbol || 'Token'))
                  : (node.name || 'KOL Trader')
                }
              </div>
              <div className="font-mono text-[10px] sm:text-xs text-muted-foreground truncate">
                {node.id}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {node.type === 'kol' ? (
              <div className="flex gap-2">
                <Button
                  onClick={handleSubscribe}
                  className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px]"
                >
                  <UserPlus className="h-3 w-3" />
                  Subscribe
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-kol-modal', { detail: { kolId: node.id } }))}
                  className="flex-1 gap-2 font-black uppercase tracking-widest text-[10px]"
                >
                  <Activity className="h-3 w-3" />
                  View KOL
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  onClick={handleInstantBuy}
                  disabled={buyingNodeId === node.id}
                  className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-[10px]"
                >
                  {buyingNodeId === node.id ? (
                    'Processing...'
                  ) : (
                    <>
                      <Zap className="h-3 w-3" />
                      Instant Buy
                    </>
                  )}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleAnalyze}
                    className="flex-1 gap-1.5 font-black uppercase tracking-widest text-[10px]"
                  >
                    <BarChart3 className="h-3 w-3" />
                    Analyze
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTerminal}
                    className="flex-1 gap-1.5 font-black uppercase tracking-widest text-[10px]"
                  >
                    <Activity className="h-3 w-3" />
                    Terminal
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Core Metrics */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-1">
          {node.type === 'token' ? (
            <>
              <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                  <Users className="h-3 w-3" />
                  <span>KOLs</span>
                </div>
                <div className="text-sm sm:text-base font-black text-primary">
                  {formatNumber(node.connections)}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                  <Activity className="h-3 w-3" />
                  <span>Trades</span>
                </div>
                <div className="text-sm sm:text-base font-black">
                  {formatNumber(node.tradeCount || 0)}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                  <Zap className="h-3 w-3 text-primary" />
                  <span>Rank</span>
                </div>
                <div className="text-sm sm:text-base font-black text-primary">
                  {Math.round(node.influenceScore || 0)}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                  <CircleDollarSign className="h-3 w-3" />
                  <span>Tokens</span>
                </div>
                <div className="text-sm sm:text-base font-black">
                  {node.relatedTokens?.length || 0}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Volume Display */}
        <div className="p-2 sm:p-3 bg-accent-from/5 border border-accent-from/20 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-muted-foreground">
              <BadgeDollarSign className="h-3 w-3" />
              <span>Volume</span>
            </div>
            <div className="text-xs font-mono font-bold text-accent-from">SOL</div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-foreground mt-1">
            {formatVolume(node.totalVolume || 0)}
          </div>
        </div>

        {/* Extended Metrics */}
        {(isExpanded || isMobile) && (
          <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-3 border-t border-border/50">
            <div className="grid grid-cols-2 gap-1.5 sm:gap-3 text-xs">
              {node.avgTradeSize && (
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase">Avg Size</div>
                  <div className="font-semibold">{formatVolume(node.avgTradeSize)} SOL</div>
                </div>
              )}
              {node.winRate && (
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase">Win Rate</div>
                  <div className={cn(
                    "font-semibold",
                    node.winRate > 60 ? "text-green-500" : node.winRate > 40 ? "text-yellow-500" : "text-red-500"
                  )}>
                    {node.winRate.toFixed(1)}%
                  </div>
                </div>
              )}
              {node.lastTradeTime && (
                <div className="col-span-2">
                  <div className="text-muted-foreground text-[10px] uppercase">Last Activity</div>
                  <div className="font-semibold">
                    {formatDistanceToNow(new Date(node.lastTradeTime), { addSuffix: true })}
                  </div>
                </div>
              )}
            </div>

            {/* Connection Analysis */}
            {relatedConnections.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <BarChart3 className="h-3 w-3" />
                  <span>Top Connections</span>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                  {relatedConnections
                    .sort((a, b) => b.volume - a.volume)
                    .slice(0, 5)
                    .map((connection, index) => {
                      const otherNode = (typeof connection.source === 'object' ? connection.source.id : connection.source) === node.id
                        ? connection.target
                        : connection.source;
                      const otherNodeId = typeof otherNode === 'object' ? otherNode.id : otherNode;

                      return (
                        <div key={index} className="flex items-center justify-between p-1.5 bg-muted/30 rounded border border-border/30">
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[10px] truncate">
                              {otherNodeId.slice(0, 8)}...{otherNodeId.slice(-6)}
                            </div>
                          </div>
                          <div className="text-right ml-2">
                            <div className="font-bold text-[10px]">
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

      {node.type === 'token' && (
        <TokenDetailModal
          isOpen={showTokenModal}
          onClose={() => setShowTokenModal(false)}
          mint={node.tokenMint || node.id}
          name={node.name}
          symbol={node.symbol}
          title={`${node.name || node.symbol || 'Token'} Details`}
          size="xl"
          chartHeight={400}
        />
      )}

      {showTradeConfigPrompt && (
        <TradeConfigPrompt
          isOpen={showTradeConfigPrompt}
          onClose={() => setShowTradeConfigPrompt(false)}
          onConfigured={() => {
            setShowTradeConfigPrompt(false);
            handleInstantBuy();
          }}
        />
      )}
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
      return;
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

    setTimeout(() => {
      setErrors(prev => prev.filter(e => e !== error));
    }, 5000);
  }, []);

  const handleConnectionSelect = useCallback((connection: UnifiedLink) => {
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