'use client';

import React, { useState, useCallback } from 'react';
import * as ReactDOM from 'react-dom/client';
import { cn } from '@/lib/utils';
import {
  CircleDollarSign,
  UserCheck,
  TrendingUp,
  Activity,
  BadgeDollarSign,
  Users,
  Target,
  Zap,
  BarChart3,
  UserPlus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { executeInstantBuy, checkTradeConfig } from '@/lib/trade-utils';
import { useNotifications } from '@/stores/use-ui-store';
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

interface TokenTooltipProps {
  node: UnifiedNode;
  className?: string;
}

interface KOLTooltipProps {
  node: UnifiedNode;
  className?: string;
}

interface ConnectionTooltipProps {
  link: UnifiedLink;
  sourceNode: UnifiedNode;
  targetNode: UnifiedNode;
  className?: string;
}

// Action buttons component for Token Tooltip
const TokenTooltipActions: React.FC<{ node: UnifiedNode }> = ({ node }) => {
  const [isBuying, setIsBuying] = useState(false);
  const [showTradeConfigPrompt, setShowTradeConfigPrompt] = useState(false);
  const { showSuccess, showError } = useNotifications();

  const handleInstantBuy = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isBuying) return;

    try {
      const configCheck = await checkTradeConfig();
      if (!configCheck.hasConfig) {
        setShowTradeConfigPrompt(true);
        return;
      }

      setIsBuying(true);
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
      setIsBuying(false);
    }
  }, [node.id, node.symbol, node.name, isBuying, showSuccess, showError]);

  const handleAnalyze = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = `/pro-terminal/analytics?address=${node.id}`;
  };

  const handleTerminal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = `/pro-terminal/trade?mint=${node.id}`;
  };

  return (
    <div className="p-3 pt-0 space-y-2">
      <Button
        size="sm"
        onClick={handleInstantBuy}
        disabled={isBuying}
        className="w-full h-8 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-[10px]"
      >
        {isBuying ? 'Buying...' : (
          <><Zap className="h-3 w-3 mr-1" /> Instant Buy</>
        )}
      </Button>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAnalyze}
          className="flex-1 h-7 text-[9px] font-black uppercase tracking-widest"
        >
          <BarChart3 className="h-3 w-3 mr-1" /> Analyze
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTerminal}
          className="flex-1 h-7 text-[9px] font-black uppercase tracking-widest"
        >
          <Activity className="h-3 w-3 mr-1" /> Terminal
        </Button>
      </div>

      {showTradeConfigPrompt && (
        <TradeConfigPrompt
          isOpen={showTradeConfigPrompt}
          onClose={() => setShowTradeConfigPrompt(false)}
          tokenSymbol={node.symbol || node.name}
        />
      )}
    </div>
  );
};

// Action buttons component for KOL Tooltip
const KOLTooltipActions: React.FC<{ node: UnifiedNode }> = ({ node }) => {
  const handleSubscribe = () => {
    window.dispatchEvent(new CustomEvent('open-kol-modal', { detail: { kolId: node.id } }));
  };

  const handleViewDetails = () => {
    window.dispatchEvent(new CustomEvent('open-kol-modal', { detail: { kolId: node.id } }));
  };

  return (
    <div className="p-3 pt-0 flex gap-2">
      <Button
        size="sm"
        onClick={handleSubscribe}
        className="flex-1 h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px]"
      >
        <UserPlus className="h-3 w-3 mr-1" /> Subscribe
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleViewDetails}
        className="flex-1 h-8 text-[9px] font-black uppercase tracking-widest"
      >
        <Activity className="h-3 w-3 mr-1" /> View Details
      </Button>
    </div>
  );
};

// Enhanced Token Tooltip with rich metadata
export const TokenTooltip: React.FC<TokenTooltipProps> = ({ node, className }) => {
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

  return (
    <div className={cn(
      "w-64 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl",
      "animate-in fade-in-0 zoom-in-95 duration-200",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="relative">
            <CircleDollarSign className="h-4 w-4 text-primary" />
            {node.isTrending && (
              <div className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <div className="font-semibold text-sm">
              {node.name || node.symbol || 'Token'}
            </div>
            {node.name && node.symbol && (
              <div className="text-xs text-muted-foreground">{node.symbol}</div>
            )}
          </div>
        </div>
        {node.isTrending && (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-500 rounded-full">
            <TrendingUp className="h-3 w-3" />
            <span className="text-xs font-medium">Trending</span>
          </div>
        )}
      </div>

      {/* Token Image and Info */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-3">
          {node.image ? (
            <img
              src={node.image}
              alt={node.name || node.symbol || 'Token'}
              className="w-8 h-8 rounded-full border border-border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">
                {(node.symbol || node.name || 'T').slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1">
            {(node.name || node.symbol) && (
              <div className="font-semibold text-sm text-foreground">
                {node.name && node.symbol ? `${node.name} (${node.symbol})` : (node.name || node.symbol)}
              </div>
            )}
            <div className="font-mono text-xs text-muted-foreground">
              {node.id.slice(0, 8)}...{node.id.slice(-6)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>Connected KOLs</span>
            </div>
            <div className="text-lg font-bold text-primary">
              {formatNumber(node.connections)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" />
              <span>Total Trades</span>
            </div>
            <div className="text-lg font-bold">
              {formatNumber(node.tradeCount || 0)}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BadgeDollarSign className="h-3 w-3" />
            <span>Trading Volume</span>
          </div>
          <div className="text-xl font-bold text-accent-from">
            {formatVolume(node.totalVolume || 0)} SOL
          </div>
        </div>

        {/* Additional Metrics */}
        {(node.avgTradeSize || node.lastTradeTime) && (
          <div className="pt-2 border-t border-border/30 space-y-2">
            {node.avgTradeSize && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Avg Trade Size</span>
                <span className="font-medium">{formatVolume(node.avgTradeSize)} SOL</span>
              </div>
            )}
            {node.lastTradeTime && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Last Activity</span>
                <span className="font-medium">
                  {formatDistanceToNow(node.lastTradeTime, { addSuffix: true })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <TokenTooltipActions node={node} />
    </div>
  );
};

// Enhanced KOL Tooltip with enriched information
export const KOLTooltip: React.FC<KOLTooltipProps> = ({ node, className }) => {
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

  const getInfluenceLevel = (score: number) => {
    if (score >= 90) return { label: 'Elite', color: 'text-purple-500' };
    if (score >= 75) return { label: 'Expert', color: 'text-blue-500' };
    if (score >= 60) return { label: 'Skilled', color: 'text-green-500' };
    if (score >= 40) return { label: 'Active', color: 'text-yellow-500' };
    return { label: 'Emerging', color: 'text-muted-foreground' };
  };

  const influenceLevel = getInfluenceLevel(node.influenceScore || 0);

  return (
    <div className={cn(
      "w-72 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl",
      "animate-in fade-in-0 zoom-in-95 duration-200",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="relative">
            <UserCheck className="h-4 w-4 text-primary" />
            <div className="absolute -top-1 -right-1 h-2 w-2 bg-blue-500 rounded-full" />
          </div>
          <div>
            <div className="font-semibold text-sm">KOL Trader</div>
            {node.name && (
              <div className="text-xs text-muted-foreground">{node.name}</div>
            )}
          </div>
        </div>
        <div className={cn("px-2 py-1 rounded-full text-xs font-medium", influenceLevel.color)}>
          {influenceLevel.label}
        </div>
      </div>

      {/* KOL Avatar and Info */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-3">
          {node.image ? (
            <img
              src={node.image}
              alt={node.name || 'KOL'}
              className="w-10 h-10 rounded-full border-2 border-primary/20"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {(node.name || 'KOL').slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1">
            {node.name && (
              <div className="font-semibold text-sm text-foreground">
                {node.name}
              </div>
            )}
            <div className="font-mono text-xs text-muted-foreground">
              {node.id.slice(0, 8)}...{node.id.slice(-6)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              <span>Influence Score</span>
            </div>
            <div className="text-lg font-bold text-primary">
              {Math.round(node.influenceScore || 0)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" />
              <span>Total Trades</span>
            </div>
            <div className="text-lg font-bold">
              {formatNumber(node.tradeCount || 0)}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BadgeDollarSign className="h-3 w-3" />
            <span>Trading Volume</span>
          </div>
          <div className="text-xl font-bold text-accent-from">
            {formatVolume(node.totalVolume || 0)} SOL
          </div>
        </div>

        {/* Trading Performance */}
        <div className="pt-2 border-t border-border/30 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Connected Tokens</span>
            <span className="font-medium">{node.relatedTokens?.length || 0}</span>
          </div>

          {node.winRate && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Win Rate</span>
              <span className={cn(
                "font-medium",
                node.winRate > 60 ? "text-green-500" :
                  node.winRate > 40 ? "text-yellow-500" : "text-red-500"
              )}>
                {node.winRate.toFixed(1)}%
              </span>
            </div>
          )}

          {node.avgTradeSize && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Avg Trade Size</span>
              <span className="font-medium">{formatVolume(node.avgTradeSize)} SOL</span>
            </div>
          )}

          {node.lastTradeTime && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Last Activity</span>
              <span className="font-medium">
                {formatDistanceToNow(node.lastTradeTime, { addSuffix: true })}
              </span>
            </div>
          )}
        </div>

        {/* Influence Breakdown */}
        <div className="pt-2 border-t border-border/30">
          <div className="text-xs text-muted-foreground mb-2">Influence Breakdown</div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span>Trading Activity</span>
              <div className="flex items-center gap-1">
                <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, (node.tradeCount || 0) / 10)}%` }}
                  />
                </div>
                <span className="text-muted-foreground w-8 text-right">
                  {Math.min(100, Math.round((node.tradeCount || 0) / 10))}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Network Position</span>
              <div className="flex items-center gap-1">
                <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${Math.min(100, node.connections * 10)}%` }}
                  />
                </div>
                <span className="text-muted-foreground w-8 text-right">
                  {Math.min(100, node.connections * 10)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <KOLTooltipActions node={node} />
    </div>
  );
};

// Connection Strength Tooltip with metadata context
export const ConnectionTooltip: React.FC<ConnectionTooltipProps> = ({
  link,
  sourceNode,
  targetNode,
  className
}) => {
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toFixed(2);
  };

  const getConnectionStrength = (tradeCount: number, volume: number) => {
    const score = Math.log(tradeCount + 1) * Math.log(volume + 1);
    if (score >= 50) return { label: 'Very Strong', color: 'text-green-500', width: '100%' };
    if (score >= 30) return { label: 'Strong', color: 'text-blue-500', width: '80%' };
    if (score >= 15) return { label: 'Moderate', color: 'text-yellow-500', width: '60%' };
    if (score >= 5) return { label: 'Weak', color: 'text-orange-500', width: '40%' };
    return { label: 'Very Weak', color: 'text-red-500', width: '20%' };
  };

  const connectionStrength = getConnectionStrength(link.tradeCount, link.volume);
  const isTokenToKOL = sourceNode.type === 'token' && targetNode.type === 'kol';
  const tokenNode = isTokenToKOL ? sourceNode : targetNode;
  const kolNode = isTokenToKOL ? targetNode : sourceNode;

  return (
    <div className={cn(
      "w-80 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl",
      "animate-in fade-in-0 zoom-in-95 duration-200",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <div className="font-semibold text-sm">Trading Connection</div>
        </div>
        <div className={cn(
          "px-2 py-1 rounded-full text-xs font-medium",
          connectionStrength.color
        )}>
          {connectionStrength.label}
        </div>
      </div>

      {/* Connection Participants */}
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-medium">Token</div>
              <div className="text-xs text-muted-foreground font-mono">
                {tokenNode.id.slice(0, 8)}...{tokenNode.id.slice(-6)}
              </div>
            </div>
          </div>
          <div className="text-2xl text-muted-foreground">↔</div>
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-sm font-medium">KOL</div>
              <div className="text-xs text-muted-foreground font-mono">
                {kolNode.id.slice(0, 8)}...{kolNode.id.slice(-6)}
              </div>
            </div>
          </div>
        </div>

        {/* Connection Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" />
              <span>Trade Count</span>
            </div>
            <div className="text-lg font-bold">
              {link.tradeCount}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <BadgeDollarSign className="h-3 w-3" />
              <span>Total Volume</span>
            </div>
            <div className="text-lg font-bold text-accent-from">
              {formatVolume(link.volume)} SOL
            </div>
          </div>
        </div>

        {/* Connection Strength Visualization */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Connection Strength</span>
            <span className={connectionStrength.color}>{connectionStrength.label}</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                connectionStrength.color.replace('text-', 'bg-')
              )}
              style={{ width: connectionStrength.width }}
            />
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="pt-2 border-t border-border/30 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Avg Trade Size</span>
            <span className="font-medium">
              {formatVolume(link.volume / Math.max(1, link.tradeCount))} SOL
            </span>
          </div>

          {link.frequency && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Trade Frequency</span>
              <span className="font-medium">{link.frequency.toFixed(1)}/day</span>
            </div>
          )}

          {link.lastActivity && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Last Activity</span>
              <span className="font-medium">
                {formatDistanceToNow(link.lastActivity, { addSuffix: true })}
              </span>
            </div>
          )}
        </div>

        {/* Relationship Context */}
        <div className="pt-2 border-t border-border/30">
          <div className="text-xs text-muted-foreground mb-1">Relationship Context</div>
          <div className="text-xs">
            This KOL has made <span className="font-medium text-foreground">{link.tradeCount}</span> trades
            with this token, representing {' '}
            <span className="font-medium text-accent-from">{formatVolume(link.volume)} SOL</span> in volume.
            {link.tradeCount > 10 && (
              <span className="text-green-500"> This is a significant trading relationship.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Tooltip Manager for coordinating tooltip display
export class TooltipManager {
  private static instance: TooltipManager;
  private currentTooltip: HTMLDivElement | null = null;
  private tooltipTimeout: NodeJS.Timeout | null = null;

  static getInstance(): TooltipManager {
    if (!TooltipManager.instance) {
      TooltipManager.instance = new TooltipManager();
    }
    return TooltipManager.instance;
  }

  showTooltip(
    content: React.ReactElement,
    position: { x: number; y: number },
    delay: number = 100
  ) {
    // Clear any existing tooltip
    this.hideTooltip();

    // Clear any pending timeout
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }

    this.tooltipTimeout = setTimeout(() => {
      // Create tooltip container
      this.currentTooltip = document.createElement('div');
      this.currentTooltip.className = 'fixed z-50 pointer-events-auto';
      this.currentTooltip.style.left = `${position.x}px`;
      this.currentTooltip.style.top = `${position.y}px`;

      // Render React content
      const root = ReactDOM.createRoot(this.currentTooltip);
      root.render(content);

      // Add to DOM
      document.body.appendChild(this.currentTooltip);

      // Animate in
      requestAnimationFrame(() => {
        if (this.currentTooltip) {
          this.currentTooltip.style.opacity = '1';
        }
      });
    }, delay);
  }

  hideTooltip() {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }

    if (this.currentTooltip) {
      this.currentTooltip.style.opacity = '0';
      setTimeout(() => {
        if (this.currentTooltip && this.currentTooltip.parentNode) {
          this.currentTooltip.parentNode.removeChild(this.currentTooltip);
        }
        this.currentTooltip = null;
      }, 200);
    }
  }

  updatePosition(position: { x: number; y: number }) {
    if (this.currentTooltip) {
      this.currentTooltip.style.left = `${position.x}px`;
      this.currentTooltip.style.top = `${position.y}px`;
    }
  }
}