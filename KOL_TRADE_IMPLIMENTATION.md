# KOL Trades Frontend Integration Guide

## 🚀 Overview

This guide provides complete implementation details for integrating KOL Trades real-time display and mindmap visualization into your React frontend application with **automatic real-time loading** on page load.

## 📋 Table of Contents

1. [WebSocket Integration](#websocket-integration)
2. [Real-time KOL Trades Display](#real-time-kol-trades-display)
3. [Mindmap Visualization](#mindmap-visualization)
4. [API Integration](#api-integration)
5. [Component Architecture](#component-architecture)
6. [State Management](#state-management)
7. [UI/UX Guidelines](#uiux-guidelines)
8. [Performance Optimization](#performance-optimization)

## 🔌 WebSocket Integration

### Socket.IO Client Setup

```bash
npm install socket.io-client
```

### WebSocket Hook Implementation (Auto-Loading)

```typescript
// hooks/useKOLTradeSocket.ts
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth'; // Your auth hook
import { kolTradeApi } from '../services/kolTradeApi';

export interface KOLTrade {
  id: string;
  kolWallet: string;
  signature: string;
  timestamp: Date;
  tradeData: {
    tokenIn: string;
    tokenOut: string;
    amountIn: number;
    amountOut: number;
    tradeType: 'buy' | 'sell';
    mint?: string;
    source: string;
    fee?: number;
  };
  affectedUsers: string[];
  processed: boolean;
  mindmapContribution?: {
    tokenConnections: string[];
    kolInfluenceScore: number;
    relatedTrades: string[];
  };
}

export interface MindmapUpdate {
  tokenMint: string;
  kolConnections: {
    [kolWallet: string]: {
      kolWallet: string;
      tradeCount: number;
      totalVolume: number;
      lastTradeTime: Date;
      influenceScore: number;
      tradeTypes: string[];
    };
  };
  relatedTokens: string[];
  networkMetrics: {
    centrality: number;
    clustering: number;
    totalTrades: number;
  };
  lastUpdate: Date;
}

interface UseKOLTradeSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  recentTrades: KOLTrade[];
  allMindmapData: { [tokenMint: string]: MindmapUpdate };
  trendingTokens: string[];
  isLoadingInitialData: boolean;
  stats: {
    totalTrades: number;
    uniqueKOLs: number;
    uniqueTokens: number;
    totalVolume: number;
  };
}

export const useKOLTradeSocket = (): UseKOLTradeSocketReturn => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [recentTrades, setRecentTrades] = useState<KOLTrade[]>([]);
  const [allMindmapData, setAllMindmapData] = useState<{ [tokenMint: string]: MindmapUpdate }>({});
  const [trendingTokens, setTrendingTokens] = useState<string[]>([]);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [stats, setStats] = useState({
    totalTrades: 0,
    uniqueKOLs: 0,
    uniqueTokens: 0,
    totalVolume: 0
  });

  // Load initial data from API
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoadingInitialData(true);
      
      // Load initial trades, stats, and trending tokens in parallel
      const [tradesResponse, statsResponse, trendingResponse] = await Promise.all([
        kolTradeApi.getRecentTrades(100), // Load more initial data
        kolTradeApi.getStats(),
        kolTradeApi.getTrendingTokens(20)
      ]);

      if (tradesResponse.success) {
        setRecentTrades(tradesResponse.data.trades);
      }

      if (statsResponse.success) {
        setStats(statsResponse.data.tradingStats);
      }

      if (trendingResponse.success) {
        const tokens = trendingResponse.data.trendingTokens.map((t: any) => t.tokenMint);
        setTrendingTokens(tokens);
        
        // Load mindmap data for trending tokens
        const mindmapPromises = tokens.slice(0, 10).map(async (tokenMint: string) => {
          try {
            const mindmapResponse = await kolTradeApi.getMindmapData(tokenMint);
            if (mindmapResponse.success) {
              return { tokenMint, data: mindmapResponse.data.mindmap };
            }
          } catch (error) {
            console.warn(`Failed to load mindmap for ${tokenMint}:`, error);
          }
          return null;
        });

        const mindmapResults = await Promise.all(mindmapPromises);
        const initialMindmapData: { [tokenMint: string]: MindmapUpdate } = {};
        
        mindmapResults.forEach(result => {
          if (result) {
            initialMindmapData[result.tokenMint] = result.data;
          }
        });
        
        setAllMindmapData(initialMindmapData);
      }

    } catch (error) {
      console.error('Failed to load initial KOL trade data:', error);
    } finally {
      setIsLoadingInitialData(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket']
    });

    newSocket.on('connect', async () => {
      console.log('✅ Connected to KOL Trade WebSocket');
      setIsConnected(true);
      
      // Automatically subscribe to all trades on connection
      newSocket.emit('subscribe_kol_trades');
      console.log('🔄 Auto-subscribed to all KOL trades');
      
      // Load initial data
      await loadInitialData();
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from KOL Trade WebSocket');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });

    // Real-time trade updates (ALL TRADES)
    newSocket.on('kol_trade_update', (trade: KOLTrade) => {
      console.log('📈 New KOL trade received:', trade);
      setRecentTrades(prev => {
        // Add new trade and keep last 100
        const updated = [trade, ...prev.slice(0, 99)];
        
        // Update stats in real-time
        setStats(prevStats => ({
          totalTrades: updated.length,
          uniqueKOLs: new Set(updated.map(t => t.kolWallet)).size,
          uniqueTokens: new Set(updated.flatMap(t => [
            t.tradeData.tokenIn, 
            t.tradeData.tokenOut, 
            t.tradeData.mint
          ].filter(Boolean))).size,
          totalVolume: updated.reduce((sum, t) => sum + (t.tradeData.amountIn || 0), 0)
        }));
        
        return updated;
      });
    });

    newSocket.on('personal_kol_trade_alert', (trade: KOLTrade) => {
      console.log('🔔 Personal KOL trade alert:', trade);
      // Handle personal alerts (notifications, etc.)
    });

    // Real-time mindmap updates
    newSocket.on('mindmap_update', (update: MindmapUpdate) => {
      console.log('🗺️ Mindmap update received for token:', update.tokenMint);
      setAllMindmapData(prev => ({
        ...prev,
        [update.tokenMint]: update
      }));
    });

    // Listen for new trending tokens
    newSocket.on('trending_tokens_update', (tokens: string[]) => {
      console.log('📊 Trending tokens updated:', tokens);
      setTrendingTokens(tokens);
      
      // Auto-subscribe to mindmap updates for new trending tokens
      tokens.forEach(tokenMint => {
        if (!allMindmapData[tokenMint]) {
          newSocket.emit('subscribe_mindmap', { tokenMint });
        }
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, loadInitialData]);

  // Auto-subscribe to mindmap updates for trending tokens
  useEffect(() => {
    if (socket && isConnected && trendingTokens.length > 0) {
      trendingTokens.forEach(tokenMint => {
        socket.emit('subscribe_mindmap', { tokenMint });
      });
      console.log(`🗺️ Auto-subscribed to mindmap updates for ${trendingTokens.length} trending tokens`);
    }
  }, [socket, isConnected, trendingTokens]);

  return {
    socket,
    isConnected,
    recentTrades,
    allMindmapData,
    trendingTokens,
    isLoadingInitialData,
    stats
  };
};
```

## 📊 Real-time KOL Trades Display (Auto-Loading)

### KOL Trades Feed Component

```typescript
// components/KOLTradesFeed.tsx
import React, { useState, useMemo } from 'react';
import { useKOLTradeSocket, KOLTrade } from '../hooks/useKOLTradeSocket';
import { formatDistanceToNow } from 'date-fns';

interface KOLTradesFeedProps {
  maxTrades?: number;
  showFilters?: boolean;
}

export const KOLTradesFeed: React.FC<KOLTradesFeedProps> = ({
  maxTrades = 50,
  showFilters = true
}) => {
  const {
    isConnected,
    recentTrades,
    isLoadingInitialData,
    stats
  } = useKOLTradeSocket();

  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [selectedKOL, setSelectedKOL] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');

  const filteredTrades = useMemo(() => {
    return recentTrades
      .filter(trade => {
        if (filter !== 'all' && trade.tradeData.tradeType !== filter) return false;
        if (selectedKOL && !trade.kolWallet.toLowerCase().includes(selectedKOL.toLowerCase())) return false;
        if (minAmount && trade.tradeData.amountIn < parseFloat(minAmount)) return false;
        return true;
      })
      .slice(0, maxTrades);
  }, [recentTrades, filter, selectedKOL, minAmount, maxTrades]);

  const uniqueKOLs = useMemo(() => {
    return Array.from(new Set(recentTrades.map(t => t.kolWallet)));
  }, [recentTrades]);

  if (isLoadingInitialData) {
    return (
      <div className="kol-trades-feed">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading recent KOL trades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kol-trades-feed">
      <div className="feed-header">
        <div className="feed-title-section">
          <h2 className="feed-title">
            🔥 Live KOL Trades
            <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 Live' : '🔴 Offline'}
            </span>
          </h2>
          <div className="feed-stats">
            <span className="stat">📊 {stats.totalTrades} trades</span>
            <span className="stat">👥 {stats.uniqueKOLs} KOLs</span>
            <span className="stat">🪙 {stats.uniqueTokens} tokens</span>
            <span className="stat">💰 {stats.totalVolume.toFixed(2)} SOL</span>
          </div>
        </div>
        
        {showFilters && (
          <div className="feed-filters">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value as any)}
              className="filter-select"
            >
              <option value="all">All Trades ({recentTrades.length})</option>
              <option value="buy">Buy Orders ({recentTrades.filter(t => t.tradeData.tradeType === 'buy').length})</option>
              <option value="sell">Sell Orders ({recentTrades.filter(t => t.tradeData.tradeType === 'sell').length})</option>
            </select>
            
            <input
              type="text"
              placeholder="Filter by KOL address..."
              value={selectedKOL}
              onChange={(e) => setSelectedKOL(e.target.value)}
              className="filter-input"
            />
            
            <input
              type="number"
              placeholder="Min amount (SOL)"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="filter-input"
              step="0.01"
            />
          </div>
        )}
      </div>

      <div className="trades-list">
        {filteredTrades.length === 0 ? (
          <div className="empty-state">
            <p>No trades matching your filters</p>
            {!isConnected && <p>Connecting to live feed...</p>}
          </div>
        ) : (
          <div className="trades-grid">
            {filteredTrades.map(trade => (
              <KOLTradeCard key={trade.id} trade={trade} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

### Individual Trade Card Component (Enhanced)

```typescript
// components/KOLTradeCard.tsx
import React from 'react';
import { KOLTrade } from '../hooks/useKOLTradeSocket';
import { formatDistanceToNow } from 'date-fns';

interface KOLTradeCardProps {
  trade: KOLTrade;
  onClick?: (trade: KOLTrade) => void;
}

export const KOLTradeCard: React.FC<KOLTradeCardProps> = ({ trade, onClick }) => {
  const {
    kolWallet,
    tradeData,
    timestamp,
    mindmapContribution
  } = trade;

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
    return amount.toFixed(6);
  };

  const getTradeTypeColor = (type: string) => {
    return type === 'buy' ? '#10B981' : '#EF4444';
  };

  const getInfluenceLevel = (score: number) => {
    if (score >= 80) return { level: 'High', emoji: '🔥', color: '#DC2626' };
    if (score >= 60) return { level: 'Medium', emoji: '⚡', color: '#D97706' };
    if (score >= 40) return { level: 'Low', emoji: '📈', color: '#059669' };
    return { level: 'New', emoji: '🌱', color: '#6B7280' };
  };

  const influence = mindmapContribution ? getInfluenceLevel(mindmapContribution.kolInfluenceScore) : null;

  return (
    <div 
      className={`trade-card ${tradeData.tradeType} ${influence?.level.toLowerCase()}`}
      onClick={() => onClick?.(trade)}
    >
      <div className="trade-header">
        <div className="kol-info">
          <span className="kol-address">
            {`${kolWallet.slice(0, 8)}...${kolWallet.slice(-4)}`}
          </span>
          {influence && (
            <span 
              className="influence-badge"
              style={{ backgroundColor: influence.color }}
            >
              {influence.emoji} {influence.level}
            </span>
          )}
        </div>
        <div className="trade-meta">
          <span className="timestamp">
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </span>
          <span className="trade-id">#{trade.id.slice(-6)}</span>
        </div>
      </div>

      <div className="trade-body">
        <div className="trade-type-section">
          <span 
            className="type-badge"
            style={{ backgroundColor: getTradeTypeColor(tradeData.tradeType) }}
          >
            {tradeData.tradeType.toUpperCase()}
          </span>
          <span className="source-badge">{tradeData.source}</span>
        </div>

        <div className="trade-amounts">
          <div className="amount-row">
            <span className="label">In:</span>
            <span className="value">{formatAmount(tradeData.amountIn)} SOL</span>
          </div>
          <div className="amount-row">
            <span className="label">Out:</span>
            <span className="value">{formatAmount(tradeData.amountOut)}</span>
          </div>
          {tradeData.fee && (
            <div className="amount-row fee">
              <span className="label">Fee:</span>
              <span className="value">{formatAmount(tradeData.fee)} SOL</span>
            </div>
          )}
        </div>

        {tradeData.mint && (
          <div className="token-section">
            <span className="token-label">Token:</span>
            <span className="token-address">
              {`${tradeData.mint.slice(0, 8)}...${tradeData.mint.slice(-4)}`}
            </span>
          </div>
        )}

        <div className="followers-section">
          <span className="followers-count">
            👥 {trade.affectedUsers.length} followers
          </span>
          {mindmapContribution && (
            <span className="connections-count">
              🔗 {mindmapContribution.tokenConnections.length} tokens
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
```

## 🗺️ Mindmap Visualization (Auto-Loading)

### Auto-Loading Mindmap Grid Component

```typescript
// components/KOLMindmapGrid.tsx
import React, { useState } from 'react';
import { useKOLTradeSocket } from '../hooks/useKOLTradeSocket';
import { KOLMindmap } from './KOLMindmap';

export const KOLMindmapGrid: React.FC = () => {
  const { 
    allMindmapData, 
    trendingTokens, 
    isConnected, 
    isLoadingInitialData 
  } = useKOLTradeSocket();
  
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');

  if (isLoadingInitialData) {
    return (
      <div className="mindmap-grid">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading mindmap data...</p>
        </div>
      </div>
    );
  }

  const availableTokens = Object.keys(allMindmapData);

  return (
    <div className="mindmap-grid">
      <div className="mindmap-header">
        <div className="header-section">
          <h2>🗺️ Live Token-KOL Networks</h2>
          <div className="connection-status">
            {isConnected ? '🟢 Live Updates' : '🔴 Offline'}
          </div>
        </div>
        
        <div className="mindmap-controls">
          <div className="view-toggle">
            <button 
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
            >
              Grid View
            </button>
            <button 
              className={viewMode === 'single' ? 'active' : ''}
              onClick={() => setViewMode('single')}
            >
              Single View
            </button>
          </div>
          
          {viewMode === 'single' && (
            <select 
              value={selectedToken} 
              onChange={(e) => setSelectedToken(e.target.value)}
              className="token-select"
            >
              <option value="">Select a token...</option>
              {availableTokens.map(token => (
                <option key={token} value={token}>
                  {`${token.slice(0, 8)}...${token.slice(-4)}`}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="mindmap-content">
        {viewMode === 'grid' ? (
          <div className="mindmap-grid-container">
            {availableTokens.length === 0 ? (
              <div className="empty-state">
                <p>No mindmap data available yet</p>
                <p>Waiting for KOL trades...</p>
              </div>
            ) : (
              availableTokens.slice(0, 6).map(tokenMint => (
                <div key={tokenMint} className="mindmap-card">
                  <div className="mindmap-card-header">
                    <h4>Token: {`${tokenMint.slice(0, 8)}...`}</h4>
                    <span className="kol-count">
                      {Object.keys(allMindmapData[tokenMint].kolConnections).length} KOLs
                    </span>
                  </div>
                  <KOLMindmap 
                    tokenMint={tokenMint} 
                    width={300} 
                    height={250}
                    compact={true}
                  />
                </div>
              ))
            )}
          </div>
        ) : (
          selectedToken && allMindmapData[selectedToken] ? (
            <KOLMindmap 
              tokenMint={selectedToken} 
              width={1000} 
              height={700}
              compact={false}
            />
          ) : (
            <div className="empty-state">
              <p>Select a token to view its network map</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};
```

### Enhanced Mindmap Component

```typescript
// components/KOLMindmap.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useKOLTradeSocket, MindmapUpdate } from '../hooks/useKOLTradeSocket';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  type: 'token' | 'kol';
  label: string;
  value: number;
  influenceScore?: number;
  tradeCount?: number;
  totalVolume?: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  value: number;
  tradeCount: number;
}

interface KOLMindmapProps {
  tokenMint: string;
  width?: number;
  height?: number;
  compact?: boolean;
}

export const KOLMindmap: React.FC<KOLMindmapProps> = ({
  tokenMint,
  width = 800,
  height = 600,
  compact = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { allMindmapData, isConnected } = useKOLTradeSocket();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const data = allMindmapData[tokenMint];
    if (!data || !svgRef.current) return;

    setLastUpdate(new Date(data.lastUpdate));
    renderMindmap(data);
  }, [allMindmapData, tokenMint, width, height]);

  const renderMindmap = (data: MindmapUpdate) => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const nodeRadius = compact ? 15 : 25;
    const linkDistance = compact ? 60 : 100;

    // Create nodes
    const nodes: Node[] = [
      {
        id: data.tokenMint,
        type: 'token',
        label: compact ? `${data.tokenMint.slice(0, 4)}...` : `${data.tokenMint.slice(0, 8)}...`,
        value: data.networkMetrics.totalTrades * (compact ? 5 : 10),
        x: width / 2,
        y: height / 2
      }
    ];

    // Add KOL nodes
    Object.values(data.kolConnections).forEach(kol => {
      nodes.push({
        id: kol.kolWallet,
        type: 'kol',
        label: compact ? `${kol.kolWallet.slice(0, 4)}...` : `${kol.kolWallet.slice(0, 6)}...`,
        value: kol.tradeCount * (compact ? 3 : 5),
        influenceScore: kol.influenceScore,
        tradeCount: kol.tradeCount,
        totalVolume: kol.totalVolume
      });
    });

    // Create links
    const links: Link[] = Object.values(data.kolConnections).map(kol => ({
      source: data.tokenMint,
      target: kol.kolWallet,
      value: kol.totalVolume,
      tradeCount: kol.tradeCount
    }));

    // Create simulation
    const simulation = d3.forceSimulation<Node>(nodes)
      .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(linkDistance))
      .force("charge", d3.forceManyBody().strength(compact ? -200 : -300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(nodeRadius + 5));

    // Create link elements
    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => Math.max(1, Math.sqrt(d.tradeCount)));

    // Create node elements
    const node = svg.append("g")
      .selectAll("circle")
      .data(nodes)
      .enter().append("circle")
      .attr("r", d => Math.max(nodeRadius * 0.5, Math.sqrt(d.value)))
      .attr("fill", d => {
        if (d.type === 'token') return '#3B82F6';
        const score = d.influenceScore || 0;
        if (score >= 80) return '#DC2626';
        if (score >= 60) return '#D97706';
        if (score >= 40) return '#059669';
        return '#10B981';
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .call(d3.drag<SVGCircleElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Add labels (only if not compact)
    if (!compact) {
      const labels = svg.append("g")
        .selectAll("text")
        .data(nodes)
        .enter().append("text")
        .text(d => d.label)
        .attr("font-size", "10px")
        .attr("font-family", "Arial")
        .attr("text-anchor", "middle")
        .attr("dy", 3)
        .attr("fill", "#333")
        .style("pointer-events", "none");
      
      simulation.on("tick", () => {
        labels
          .attr("x", d => d.x!)
          .attr("y", d => d.y!);
      });
    }

    // Add tooltips
    const tooltip = d3.select("body").append("div")
      .attr("class", "mindmap-tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("z-index", "1000");

    node
      .on("mouseover", (event, d) => {
        tooltip.transition().duration(200).style("opacity", .9);
        const content = d.type === 'token' 
          ? `Token: ${d.id}<br/>Total Trades: ${data.networkMetrics.totalTrades}<br/>KOL Connections: ${Object.keys(data.kolConnections).length}`
          : `KOL: ${d.id}<br/>Trades: ${d.tradeCount}<br/>Volume: ${d.totalVolume?.toFixed(4)} SOL<br/>Influence: ${d.influenceScore?.toFixed(0)}`;
        
        tooltip.html(content)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.transition().duration(500).style("opacity", 0);
      })
      .on("click", (event, d) => {
        setSelectedNode(d);
      });

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as Node).x!)
        .attr("y1", d => (d.source as Node).y!)
        .attr("x2", d => (d.target as Node).x!)
        .attr("y2", d => (d.target as Node).y!);

      node
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);
    });

    // Drag functions
    function dragstarted(event: any, d: Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: Node) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: Node) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Cleanup function
    return () => {
      tooltip.remove();
    };
  };

  const data = allMindmapData[tokenMint];

  return (
    <div className="kol-mindmap">
      {!compact && (
        <div className="mindmap-info">
          <div className="mindmap-stats">
            <span>🔗 {data ? Object.keys(data.kolConnections).length : 0} KOLs</span>
            <span>📊 {data ? data.networkMetrics.totalTrades : 0} trades</span>
            {lastUpdate && (
              <span>🕒 Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}</span>
            )}
          </div>
          <div className="connection-indicator">
            {isConnected ? '🟢 Live' : '🔴 Offline'} 
          </div>
        </div>
      )}
      
      <div className="mindmap-container">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="mindmap-svg"
        />
        
        {selectedNode && !compact && (
          <div className="node-details">
            <h4>Selected Node</h4>
            <p><strong>ID:</strong> {selectedNode.id.slice(0, 12)}...</p>
            <p><strong>Type:</strong> {selectedNode.type}</p>
            {selectedNode.type === 'kol' && (
              <>
                <p><strong>Trades:</strong> {selectedNode.tradeCount}</p>
                <p><strong>Volume:</strong> {selectedNode.totalVolume?.toFixed(4)} SOL</p>
                <p><strong>Influence:</strong> {selectedNode.influenceScore?.toFixed(0)}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
```

## 🔗 API Integration

### API Service

```typescript
// services/kolTradeApi.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

class KOLTradeAPI {
  private getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getRecentTrades(limit: number = 50) {
    const response = await axios.get(`${API_BASE_URL}/api/kol-trades/recent`, {
      headers: this.getAuthHeaders(),
      params: { limit }
    });
    return response.data;
  }

  async getTradesByToken(tokenMint: string, limit: number = 20) {
    const response = await axios.get(`${API_BASE_URL}/api/kol-trades/token/${tokenMint}`, {
      headers: this.getAuthHeaders(),
      params: { limit }
    });
    return response.data;
  }

  async getKOLActivity(kolWallet: string) {
    const response = await axios.get(`${API_BASE_URL}/api/kol-trades/kol/${kolWallet}`, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async getMindmapData(tokenMint: string) {
    const response = await axios.get(`${API_BASE_URL}/api/kol-trades/mindmap/${tokenMint}`, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async getStats() {
    const response = await axios.get(`${API_BASE_URL}/api/kol-trades/stats`, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async searchTrades(filters: {
    kolWallet?: string;
    tokenMint?: string;
    tradeType?: 'buy' | 'sell';
    minAmount?: number;
    maxAmount?: number;
    limit?: number;
  }) {
    const response = await axios.get(`${API_BASE_URL}/api/kol-trades/search`, {
      headers: this.getAuthHeaders(),
      params: filters
    });
    return response.data;
  }

  async getTrendingTokens(limit: number = 10) {
    const response = await axios.get(`${API_BASE_URL}/api/kol-trades/trending-tokens`, {
      headers: this.getAuthHeaders(),
      params: { limit }
    });
    return response.data;
  }

  async getTopKOLs(limit: number = 10) {
    const response = await axios.get(`${API_BASE_URL}/api/kol-trades/top-kols`, {
      headers: this.getAuthHeaders(),
      params: { limit }
    });
    return response.data;
  }
}

export const kolTradeApi = new KOLTradeAPI();
```

## 🏗️ Component Architecture

### Main Dashboard Component (Auto-Loading)

```typescript
// components/KOLTradingDashboard.tsx
import React, { useState } from 'react';
import { KOLTradesFeed } from './KOLTradesFeed';
import { KOLMindmapGrid } from './KOLMindmapGrid';
import { TradingStats } from './TradingStats';
import { useKOLTradeSocket } from '../hooks/useKOLTradeSocket';

export const KOLTradingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'feed' | 'mindmap' | 'stats'>('feed');
  const { isConnected, isLoadingInitialData, stats, recentTrades, allMindmapData } = useKOLTradeSocket();

  return (
    <div className="kol-trading-dashboard">
      <div className="dashboard-header">
        <div className="header-section">
          <h1>🚀 KOL Trading Intelligence</h1>
          <div className="status-section">
            <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 Live' : '🔴 Offline'}
            </span>
            {isLoadingInitialData && <span className="loading-indicator">⏳ Loading...</span>}
          </div>
        </div>
        
        <div className="quick-stats">
          <div className="stat-card">
            <span className="stat-value">{stats.totalTrades}</span>
            <span className="stat-label">Live Trades</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.uniqueKOLs}</span>
            <span className="stat-label">Active KOLs</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{Object.keys(allMindmapData).length}</span>
            <span className="stat-label">Token Networks</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.totalVolume.toFixed(1)}</span>
            <span className="stat-label">SOL Volume</span>
          </div>
        </div>
        
        <div className="tab-navigation">
          <button 
            className={activeTab === 'feed' ? 'active' : ''}
            onClick={() => setActiveTab('feed')}
          >
            📈 Live Feed ({recentTrades.length})
          </button>
          <button 
            className={activeTab === 'mindmap' ? 'active' : ''}
            onClick={() => setActiveTab('mindmap')}
          >
            🗺️ Network Maps ({Object.keys(allMindmapData).length})
          </button>
          <button 
            className={activeTab === 'stats' ? 'active' : ''}
            onClick={() => setActiveTab('stats')}
          >
            📊 Analytics
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        {activeTab === 'feed' && <KOLTradesFeed maxTrades={100} showFilters={true} />}
        {activeTab === 'mindmap' && <KOLMindmapGrid />}
        {activeTab === 'stats' && <TradingStats />}
      </div>
    </div>
  );
};
```

## 📱 State Management

### Context Provider

```typescript
// context/KOLTradeContext.tsx
import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { KOLTrade, MindmapUpdate } from '../hooks/useKOLTradeSocket';

interface KOLTradeState {
  trades: KOLTrade[];
  mindmapData: { [tokenMint: string]: MindmapUpdate };
  stats: {
    totalTrades: number;
    uniqueKOLs: number;
    uniqueTokens: number;
    totalVolume: number;
  };
  filters: {
    tradeType: 'all' | 'buy' | 'sell';
    selectedKOL: string;
    selectedToken: string;
  };
}

type KOLTradeAction = 
  | { type: 'ADD_TRADE'; payload: KOLTrade }
  | { type: 'SET_TRADES'; payload: KOLTrade[] }
  | { type: 'UPDATE_MINDMAP'; payload: { tokenMint: string; data: MindmapUpdate } }
  | { type: 'SET_STATS'; payload: KOLTradeState['stats'] }
  | { type: 'SET_FILTER'; payload: Partial<KOLTradeState['filters']> };

const initialState: KOLTradeState = {
  trades: [],
  mindmapData: {},
  stats: {
    totalTrades: 0,
    uniqueKOLs: 0,
    uniqueTokens: 0,
    totalVolume: 0
  },
  filters: {
    tradeType: 'all',
    selectedKOL: '',
    selectedToken: ''
  }
};

const kolTradeReducer = (state: KOLTradeState, action: KOLTradeAction): KOLTradeState => {
  switch (action.type) {
    case 'ADD_TRADE':
      return {
        ...state,
        trades: [action.payload, ...state.trades.slice(0, 99)]
      };
    case 'SET_TRADES':
      return {
        ...state,
        trades: action.payload
      };
    case 'UPDATE_MINDMAP':
      return {
        ...state,
        mindmapData: {
          ...state.mindmapData,
          [action.payload.tokenMint]: action.payload.data
        }
      };
    case 'SET_STATS':
      return {
        ...state,
        stats: action.payload
      };
    case 'SET_FILTER':
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.payload
        }
      };
    default:
      return state;
  }
};

const KOLTradeContext = createContext<{
  state: KOLTradeState;
  dispatch: React.Dispatch<KOLTradeAction>;
} | null>(null);

export const KOLTradeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(kolTradeReducer, initialState);

  return (
    <KOLTradeContext.Provider value={{ state, dispatch }}>
      {children}
    </KOLTradeContext.Provider>
  );
};

export const useKOLTradeContext = () => {
  const context = useContext(KOLTradeContext);
  if (!context) {
    throw new Error('useKOLTradeContext must be used within a KOLTradeProvider');
  }
  return context;
};
```

## 🎨 Enhanced CSS Styles

### Additional Styles for Auto-Loading Components

```css
/* Enhanced styles for auto-loading components */

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #6b7280;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.feed-stats {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.stat {
  font-size: 0.75rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.trades-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.influence-badge {
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.trade-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.trade-id {
  font-family: 'Monaco', monospace;
  font-size: 0.625rem;
  color: #9ca3af;
}

.mindmap-grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
  padding: 1rem;
}

.mindmap-card {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.mindmap-card-header {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kol-count {
  font-size: 0.875rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.quick-stats {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
}

.stat-card {
  background: white;
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-align: center;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.loading-indicator {
  font-size: 0.875rem;
  color: #d97706;
  background: #fef3c7;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
}

.mindmap-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f9fafb;
  border-radius: 0.25rem;
  margin-bottom: 0.5rem;
}

.mindmap-stats {
  display: flex;
  gap: 1rem;
}

.mindmap-stats span {
  font-size: 0.75rem;
  color: #6b7280;
}

.view-toggle {
  display: flex;
  gap: 0.25rem;
  background: #f3f4f6;
  padding: 0.25rem;
  border-radius: 0.5rem;
}

.view-toggle button {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-toggle button.active {
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.mindmap-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.token-select {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  font-family: 'Monaco', monospace;
  font-size: 0.875rem;
}

.filter-input {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  font-size: 0.875rem;
}

.filter-input::placeholder {
  color: #9ca3af;
}

/* Responsive enhancements */
@media (max-width: 768px) {
  .trades-grid {
    grid-template-columns: 1fr;
  }
  
  .quick-stats {
    grid-template-columns: repeat(2, 1fr);
    display: grid;
  }
  
  .mindmap-grid-container {
    grid-template-columns: 1fr;
  }
  
  .mindmap-controls {
    flex-direction: column;
    align-items: stretch;
  }
}
```

## 🚀 Performance Optimization

### Memoization and Optimization

```typescript
// hooks/useOptimizedKOLTrades.ts
import { useMemo, useCallback } from 'react';
import { useKOLTradeSocket, KOLTrade } from './useKOLTradeSocket';

export const useOptimizedKOLTrades = (maxTrades: number = 50) => {
  const { recentTrades, isConnected, subscribeToKOLTrades } = useKOLTradeSocket();

  const optimizedTrades = useMemo(() => {
    return recentTrades.slice(0, maxTrades);
  }, [recentTrades, maxTrades]);

  const tradesByKOL = useMemo(() => {
    return optimizedTrades.reduce((acc, trade) => {
      if (!acc[trade.kolWallet]) {
        acc[trade.kolWallet] = [];
      }
      acc[trade.kolWallet].push(trade);
      return acc;
    }, {} as Record<string, KOLTrade[]>);
  }, [optimizedTrades]);

  const stats = useMemo(() => {
    return {
      totalTrades: optimizedTrades.length,
      uniqueKOLs: Object.keys(tradesByKOL).length,
      totalVolume: optimizedTrades.reduce((sum, trade) => sum + trade.tradeData.amountIn, 0),
      buyCount: optimizedTrades.filter(t => t.tradeData.tradeType === 'buy').length,
      sellCount: optimizedTrades.filter(t => t.tradeData.tradeType === 'sell').length
    };
  }, [optimizedTrades, tradesByKOL]);

  return {
    trades: optimizedTrades,
    tradesByKOL,
    stats,
    isConnected,
    subscribeToKOLTrades
  };
};
```

### Virtual Scrolling for Large Lists

```typescript
// components/VirtualizedTradeList.tsx
import React from 'react';
import { FixedSizeList as List } from 'react-window';
import { KOLTrade } from '../hooks/useKOLTradeSocket';
import { KOLTradeCard } from './KOLTradeCard';

interface VirtualizedTradeListProps {
  trades: KOLTrade[];
  height: number;
  itemHeight: number;
}

export const VirtualizedTradeList: React.FC<VirtualizedTradeListProps> = ({
  trades,
  height,
  itemHeight
}) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <KOLTradeCard trade={trades[index]} />
    </div>
  );

  return (
    <List
      height={height}
      itemCount={trades.length}
      itemSize={itemHeight}
      itemData={trades}
    >
      {Row}
    </List>
  );
};
```

## 📚 Usage Examples

### Basic Implementation

```typescript
// App.tsx
import React from 'react';
import { KOLTradeProvider } from './context/KOLTradeContext';
import { KOLTradingDashboard } from './components/KOLTradingDashboard';
import './styles/KOLTrades.css';

function App() {
  return (
    <KOLTradeProvider>
      <div className="App">
        <KOLTradingDashboard />
      </div>
    </KOLTradeProvider>
  );
}

export default App;
```

### Custom Integration

```typescript
// pages/TradingPage.tsx
import React, { useState } from 'react';
import { KOLTradesFeed } from '../components/KOLTradesFeed';
import { KOLMindmap } from '../components/KOLMindmap';

export const TradingPage: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState('');

  return (
    <div className="trading-page">
      <div className="page-header">
        <h1>KOL Trading Intelligence</h1>
        <input
          type="text"
          placeholder="Enter token address for mindmap..."
          value={selectedToken}
          onChange={(e) => setSelectedToken(e.target.value)}
        />
      </div>
      
      <div className="page-content">
        <div className="left-panel">
          <KOLTradesFeed maxTrades={30} />
        </div>
        
        <div className="right-panel">
          {selectedToken && (
            <KOLMindmap tokenMint={selectedToken} />
          )}
        </div>
      </div>
    </div>
  );
};
```

## 🔧 Environment Configuration

```bash
# .env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000
REACT_APP_ENABLE_MINDMAP=true
REACT_APP_MAX_TRADES_DISPLAY=100
REACT_APP_MINDMAP_UPDATE_INTERVAL=5000
```

## 📋 Dependencies

```json
{
  "dependencies": {
    "socket.io-client": "^4.7.5",
    "d3": "^7.8.5",
    "date-fns": "^2.30.0",
    "axios": "^1.6.0",
    "react-window": "^1.8.8"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "@types/react-window": "^1.8.8"
  }
}
```

## 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   npm install socket.io-client d3 @types/d3 date-fns axios react-window
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API URL
   ```

3. **Import and use components**:
   ```typescript
   import { KOLTradingDashboard } from './components/KOLTradingDashboard';
   import { KOLTradeProvider } from './context/KOLTradeContext';
   ```

4. **Add CSS styles**:
   ```typescript
   import './styles/KOLTrades.css';
   ```

5. **Wrap your app with the provider**:
   ```typescript
   <KOLTradeProvider>
     <KOLTradingDashboard />
   </KOLTradeProvider>
   ```

This updated implementation provides:

✅ **Automatic subscription** to all KOL trades on connection  
✅ **Immediate data loading** on page load via API  
✅ **Real-time updates** for both trades and mindmaps  
✅ **Auto-loading mindmap grid** showing trending tokens  
✅ **Live statistics** updating in real-time  
✅ **No manual user interaction required** - everything loads automatically  
✅ **Enhanced UI** with loading states and real-time indicators

The system now automatically loads and displays all recent trades and mindmap data as soon as the user visits the page, with continuous real-time updates! 🚀 