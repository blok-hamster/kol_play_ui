'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { formatDistanceToNow } from 'date-fns';
import { useKOLTradeSocket, MindmapUpdate } from '@/hooks/use-kol-trade-socket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Info
} from 'lucide-react';

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
  className?: string;
}

export const KOLMindmap: React.FC<KOLMindmapProps> = ({
  tokenMint,
  width = 800,
  height = 600,
  compact = false,
  className
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const { allMindmapData, isConnected } = useKOLTradeSocket();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showUpdateAlert, setShowUpdateAlert] = useState(false);
  const [previousDataHash, setPreviousDataHash] = useState<string>('');

  const data = allMindmapData[tokenMint];

  // Detect mindmap updates for visual feedback
  React.useEffect(() => {
    if (data) {
      const currentDataHash = JSON.stringify({
        kolCount: Object.keys(data.kolConnections || {}).length,
        totalTrades: data.networkMetrics?.totalTrades || 0,
        lastUpdate: data.lastUpdate
      });
      
      if (previousDataHash && previousDataHash !== currentDataHash) {
        setShowUpdateAlert(true);
        const timer = setTimeout(() => setShowUpdateAlert(false), 3000);
        return () => clearTimeout(timer);
      }
      
      setPreviousDataHash(currentDataHash);
    }
  }, [data, previousDataHash]);

  useEffect(() => {
    // Validate data structure before proceeding
    if (!data || !svgRef.current || !data.kolConnections || !data.networkMetrics || !data.lastUpdate) {
      return;
    }

    try {
      setLastUpdate(new Date(data.lastUpdate));
      renderMindmap(data);
    } catch (error) {
      console.error('Failed to render mindmap:', error);
    }
  }, [data, width, height, tokenMint]);

  const renderMindmap = (data: MindmapUpdate) => {
    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current!);
    svg.selectAll("*").remove();

    const nodeRadius = compact ? 15 : 25;
    const linkDistance = compact ? 60 : 100;

    // Create container for zoom/pan
    const container = svg.append("g");

    // Set up zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);
    zoomRef.current = zoomBehavior;

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
    const link = container.append("g")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", "var(--border)")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => Math.max(1, Math.sqrt(d.tradeCount)));

    // Create node elements
    const node = container.append("g")
      .selectAll("circle")
      .data(nodes)
      .enter().append("circle")
      .attr("r", d => Math.max(nodeRadius * 0.5, Math.sqrt(d.value)))
      .attr("fill", d => {
        if (d.type === 'token') return 'var(--primary)';
        const score = d.influenceScore || 0;
        if (score >= 80) return '#dc2626'; // red-600
        if (score >= 60) return '#d97706'; // amber-600
        if (score >= 40) return '#059669'; // emerald-600
        return '#10b981'; // emerald-500
      })
      .attr("stroke", "var(--background)")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .call(d3.drag<SVGCircleElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Add labels (only if not compact)
    if (!compact) {
      const labels = container.append("g")
        .selectAll("text")
        .data(nodes)
        .enter().append("text")
        .text(d => d.label)
        .attr("font-size", "12px")
        .attr("font-family", "Darker Grotesque, sans-serif")
        .attr("text-anchor", "middle")
        .attr("dy", 3)
        .attr("fill", "var(--foreground)")
        .style("pointer-events", "none");
      
      simulation.on("tick", () => {
        labels
          .attr("x", d => d.x!)
          .attr("y", d => d.y!);
      });
    }

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "fixed z-50 px-3 py-2 bg-popover text-popover-foreground border border-border rounded-lg shadow-md pointer-events-none opacity-0 text-sm")
      .style("transition", "opacity 0.2s");

    node
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", 1);
        const content = d.type === 'token' 
          ? `<strong>Token:</strong> ${d.id}<br/><strong>Total Trades:</strong> ${data.networkMetrics.totalTrades}<br/><strong>KOL Connections:</strong> ${Object.keys(data.kolConnections).length}`
          : `<strong>KOL:</strong> ${d.id}<br/><strong>Trades:</strong> ${d.tradeCount}<br/><strong>Volume:</strong> ${d.totalVolume?.toFixed(4)} SOL<br/><strong>Influence:</strong> ${d.influenceScore?.toFixed(0)}`;
        
        tooltip.html(content)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
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

  const handleZoomIn = () => {
    if (zoomRef.current && svgRef.current) {
      try {
        d3.select(svgRef.current).transition().call(
          zoomRef.current.scaleBy, 1.5
        );
      } catch (error) {
        console.warn('Zoom in failed:', error);
      }
    }
  };

  const handleZoomOut = () => {
    if (zoomRef.current && svgRef.current) {
      try {
        d3.select(svgRef.current).transition().call(
          zoomRef.current.scaleBy, 1 / 1.5
        );
      } catch (error) {
        console.warn('Zoom out failed:', error);
      }
    }
  };

  const handleResetZoom = () => {
    if (zoomRef.current && svgRef.current) {
      try {
        d3.select(svgRef.current).transition().call(
          zoomRef.current.transform,
          d3.zoomIdentity
        );
      } catch (error) {
        console.warn('Reset zoom failed:', error);
      }
    }
  };

  if (!data) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Network className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">No network data</p>
          <p className="text-muted-foreground">
            Network data for this token is not available yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent-gradient rounded-lg">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Token Network Map</CardTitle>
              {!compact && (
                <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                  <span>🔗 {Object.keys(data.kolConnections).length} KOLs</span>
                  <span>📊 {data.networkMetrics.totalTrades} trades</span>
                  {lastUpdate && (
                    <span>🕒 Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={cn(
              'flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium',
              isConnected 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            )}>
              <div className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              )} />
              <span>{isConnected ? 'Live' : 'Offline'}</span>
            </div>
            
            {showUpdateAlert && (
              <div className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span>Updated!</span>
              </div>
            )}
          </div>
        </div>

        {!compact && (
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleResetZoom}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="relative">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="border border-border rounded-b-lg bg-muted/10"
          />
          
          {selectedNode && !compact && (
            <div className="absolute top-4 right-4 w-64 p-4 bg-card border border-border rounded-lg shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Selected Node</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedNode(null)}
                >
                  ×
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">ID:</span>
                  <span className="ml-2 font-mono">{selectedNode.id.slice(0, 12)}...</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <span className="ml-2 capitalize">{selectedNode.type}</span>
                </div>
                {selectedNode.type === 'kol' && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Trades:</span>
                      <span className="ml-2 font-semibold">{selectedNode.tradeCount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Volume:</span>
                      <span className="ml-2 font-semibold">{selectedNode.totalVolume?.toFixed(4)} SOL</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Influence:</span>
                      <span className="ml-2 font-semibold">{selectedNode.influenceScore?.toFixed(0)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 