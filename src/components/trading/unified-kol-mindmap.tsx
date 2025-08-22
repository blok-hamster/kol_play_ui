'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { formatDistanceToNow } from 'date-fns';
import { MindmapUpdate } from '@/hooks/use-kol-trade-socket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Info,
  Target,
  Activity,
  TrendingUp,
  X,
  CircleDollarSign,
  UserCheck,
  Wallet,
  BadgeDollarSign,
  Copy,
  ExternalLink,
  Lightbulb,
  Users
} from 'lucide-react';
import ReactDOM from 'react-dom/client';
import { useSubscriptions } from '@/stores/use-trading-store';

interface UnifiedNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'token' | 'kol';
  label: string;
  value: number; // For sizing
  connections: number; // Number of connections
  totalVolume?: number;
  tradeCount?: number;
  influenceScore?: number;
  isTrending?: boolean;
  tokenMint?: string; // For KOL nodes, which token they're connected to
  relatedTokens?: string[]; // For KOL nodes, all tokens they trade
}

interface UnifiedLink extends d3.SimulationLinkDatum<UnifiedNode> {
  source: string | UnifiedNode;
  target: string | UnifiedNode;
  value: number; // Link strength
  tradeCount: number;
  volume: number;
}

interface UnifiedKOLMindmapProps {
  tokensData: { [tokenMint: string]: MindmapUpdate };
  trendingTokens: string[];
  width?: number;
  height?: number;
  className?: string;
}

export const UnifiedKOLMindmap: React.FC<UnifiedKOLMindmapProps> = ({
  tokensData,
  trendingTokens,
  width = 1400,
  height = 800,
  className
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const { isSubscribedToKOL, subscriptions } = useSubscriptions();
  const [selectedNode, setSelectedNode] = useState<UnifiedNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<UnifiedNode | null>(null);
  const [highlightMode, setHighlightMode] = useState<'none' | 'trending' | 'high-volume'>('none');
  const [showSubscribedOnly, setShowSubscribedOnly] = useState(false);
  const [dimensions, setDimensions] = useState({ width, height });

  // Update dimensions when container resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Mobile-first responsive sizing
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
        
        setDimensions({
          width: newWidth,
          height: newHeight
        });
      }
    };

    // Use ResizeObserver for more accurate container size tracking
    const resizeObserver = new ResizeObserver(updateDimensions);
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      updateDimensions(); // Initial call
    }

    // Also listen for window resize for mobile orientation changes
    window.addEventListener('resize', updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Filter tokens data based on subscription filter
  const filteredTokensData = useMemo(() => {
    if (!showSubscribedOnly) {
      return tokensData;
    }

    const filtered: { [tokenMint: string]: MindmapUpdate } = {};

    Object.entries(tokensData).forEach(([tokenMint, data]) => {
      const filteredKolConnections: typeof data.kolConnections = {};
      
      // Only include KOLs that the user is subscribed to
      Object.entries(data.kolConnections || {}).forEach(([kolWallet, kolData]) => {
        if (isSubscribedToKOL(kolWallet)) {
          filteredKolConnections[kolWallet] = kolData;
        }
      });

      // Only include tokens that have subscribed KOLs
      if (Object.keys(filteredKolConnections).length > 0) {
        filtered[tokenMint] = {
          ...data,
          kolConnections: filteredKolConnections,
          networkMetrics: {
            ...data.networkMetrics,
            totalTrades: Object.values(filteredKolConnections).reduce(
              (sum, kol) => sum + kol.tradeCount, 0
            ),
          },
        };
      }
    });

    return filtered;
  }, [tokensData, showSubscribedOnly, isSubscribedToKOL]);

  // Define the render function first
  const renderUnifiedMindmap = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width: svgWidth, height: svgHeight } = dimensions;

    // Create container for zoom/pan
    const container = svg.append("g");

    // Set up zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);
    zoomRef.current = zoomBehavior;

    // Process data to create unified network
    const { nodes, links } = processUnifiedData();

    // Create enhanced tooltip using React component
    const tooltipContainer = d3.select("body").append("div")
      .attr("class", "fixed z-50 opacity-0 pointer-events-none")
      .style("transition", "opacity 0.2s");

    // Add click handler to SVG background to clear selection
    svg.on("click", (event) => {
      // Only clear selection if clicking on the background (not on nodes)
      if (event.target === event.currentTarget) {
        setSelectedNode(null);
        setHoveredNode(null);
        tooltipContainer.style("opacity", 0);
      }
    });

    // App's accent gradient colors
    const accentFrom = '#14F195';
    const accentTo = '#9945FF';

    // Create color scales using app's design system
    const tokenColorScale = d3.scaleSequential(d3.interpolateRgb(accentFrom, accentTo))
      .domain([0, d3.max(nodes.filter(n => n.type === 'token'), d => d.connections) || 1]);

    const kolColorScale = d3.scaleSequential(d3.interpolateRgb('#FF6B6B', '#4ECDC4'))
      .domain([0, d3.max(nodes.filter(n => n.type === 'kol'), d => d.influenceScore || 0) || 100]);

    // Create simulation with enhanced forces
    const simulation = d3.forceSimulation<UnifiedNode>(nodes)
      .force("link", d3.forceLink<UnifiedNode, UnifiedLink>(links)
        .id(d => d.id)
        .distance(d => {
          // Dynamic link distance based on connection strength
          const baseDistance = 120;
          const strengthFactor = Math.log(d.tradeCount + 1) * 20;
          return Math.max(80, baseDistance - strengthFactor);
        })
        .strength(0.3)
      )
      .force("charge", d3.forceManyBody()
        .strength(d => {
          // Stronger repulsion for nodes with more connections
          const baseStrength = -400;
          const connectionFactor = Math.sqrt(d.connections) * 50;
          return baseStrength - connectionFactor;
        })
      )
      .force("center", d3.forceCenter(svgWidth / 2, svgHeight / 2))
      .force("collision", d3.forceCollide()
        .radius(d => Math.max(15, Math.sqrt(d.value) + 5))
      )
      .force("x", d3.forceX(svgWidth / 2).strength(0.05))
      .force("y", d3.forceY(svgHeight / 2).strength(0.05));

    // Create link elements with app's accent gradient
    const defs = svg.append("defs");
    
    // Create gradient for each link using app's accent colors
    links.forEach((link, i) => {
      const gradient = defs.append("linearGradient")
        .attr("id", `linkGradient${i}`)
        .attr("gradientUnits", "userSpaceOnUse");
      
      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", accentFrom);
      
      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", accentTo);
    });

    const linkGroup = container.append("g").attr("class", "links");
    const link = linkGroup.selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", (d, i) => `url(#linkGradient${i})`)
      .attr("stroke-opacity", d => Math.min(0.7, Math.log(d.tradeCount + 1) * 0.15))
      .attr("stroke-width", d => Math.max(1.5, Math.sqrt(d.tradeCount) * 0.8))
      .style("cursor", "pointer");

    // Create node groups
    const nodeGroup = container.append("g").attr("class", "nodes");
    const nodeSelection = nodeGroup.selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("class", "node-group")
      .style("cursor", "pointer");

    // Add main circles for nodes
    nodeSelection.append("circle")
      .attr("r", d => {
        if (d.type === 'token') {
          // Token size based on number of KOL connections and total trades
          const baseSize = 20;
          const connectionBonus = Math.sqrt(d.connections) * 7;
          const volumeBonus = Math.log(d.totalVolume || 1) * 2.5;
          return Math.min(55, baseSize + connectionBonus + volumeBonus);
        } else {
          // KOL size based on influence score and trade count
          const baseSize = 14;
          const influenceBonus = Math.sqrt(d.influenceScore || 0) * 2.2;
          const tradeBonus = Math.sqrt(d.tradeCount || 0) * 1.5;
          return Math.min(40, baseSize + influenceBonus + tradeBonus);
        }
      })
      .attr("fill", d => {
        if (highlightMode === 'trending' && d.isTrending) {
          return accentFrom; // Use accent green for trending
        }
        if (highlightMode === 'high-volume' && (d.totalVolume || 0) > 100) {
          return accentTo; // Use accent purple for high volume
        }
        
        if (d.type === 'token') {
          return d.isTrending ? accentFrom : tokenColorScale(d.connections);
        } else {
          return kolColorScale(d.influenceScore || 0);
        }
      })
      .attr("fill-opacity", 0.7) // Reduced opacity for softer appearance
      .style("filter", d => {
        if (d.type === 'token' && d.connections > 5) {
          return `drop-shadow(0 0 12px ${accentTo}40)`;
        }
        if (d.type === 'kol' && (d.influenceScore || 0) > 70) {
          return `drop-shadow(0 0 15px #FF6B6B60)`;
        }
        return "none";
      });

    // Add distinctive inner pattern for KOL nodes
    nodeSelection.filter(d => d.type === 'kol')
      .append("circle")
      .attr("r", d => {
        const baseSize = 14;
        const influenceBonus = Math.sqrt(d.influenceScore || 0) * 2.2;
        const tradeBonus = Math.sqrt(d.tradeCount || 0) * 1.5;
        return Math.min(40, baseSize + influenceBonus + tradeBonus) * 0.6;
      })
      .attr("fill", "none")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,2")
      .attr("opacity", 0.8); // Increased opacity since no outer stroke

    // Add inner circles for tokens to show activity
    nodeSelection.filter(d => d.type === 'token')
      .append("circle")
      .attr("r", d => Math.max(8, Math.sqrt(d.connections) * 3))
      .attr("fill", "#ffffff")
      .attr("fill-opacity", 0.25) // Slightly increased since no outer stroke
      .attr("stroke", "none");

    // Add Lucide React icons for different node types
    nodeSelection.each(function(d) {
      const group = d3.select(this);
      const iconSize = d.type === 'token' ? 18 : 16;
      
      if (d.type === 'token') {
        // CircleDollarSign icon for tokens
        group.append("g")
          .attr("transform", `translate(-${iconSize/2}, -${iconSize/2})`)
          .html(`
            <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="m15 9-6 6"/>
              <path d="m9 9h10.5"/>
              <path d="m3.5 15h10.5"/>
            </svg>
          `)
          .style("pointer-events", "none");
      } else {
        // UserCheck icon for KOLs
        group.append("g")
          .attr("transform", `translate(-${iconSize/2}, -${iconSize/2})`)
          .html(`
            <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <polyline points="16,11 18,13 22,9"/>
            </svg>
          `)
          .style("pointer-events", "none");
      }
    });

    // Add labels for significant nodes with white text and dark outline
    const labelGroup = container.append("g").attr("class", "labels");
    labelGroup.selectAll("text")
      .data(nodes.filter(d => 
        (d.type === 'token' && d.connections > 3) || 
        (d.type === 'kol' && (d.influenceScore || 0) > 70)
      ))
      .enter().append("text")
      .text(d => {
        if (d.type === 'token') {
          return `${d.id.slice(0, 6)}... (${d.connections} KOLs)`;
        } else {
          return `KOL: ${d.id.slice(0, 6)}... (${d.influenceScore?.toFixed(0)})`;
        }
      })
      .attr("font-size", "13px")
      .attr("font-family", "Darker Grotesque, sans-serif")
      .attr("font-weight", "600")
      .attr("text-anchor", "middle")
      .attr("dy", d => {
        const radius = d.type === 'token' ? 
          Math.min(55, 20 + Math.sqrt(d.connections) * 7) : 
          Math.min(40, 14 + Math.sqrt(d.influenceScore || 0) * 2.2);
        return radius + 15;
      })
      .attr("fill", "#ffffff")
      .attr("stroke", "#000000")
      .attr("stroke-width", "2px")
      .attr("paint-order", "stroke")
      .style("pointer-events", "none");

    // Enhanced drag behavior with click detection
    let isDragging = false;
    let dragStartTime = 0;
    
    // Enhanced interactions
    nodeSelection
      .on("mouseover", (event, d) => {
        // Don't show hover tooltip if there's already a selected node
        if (selectedNode) {
          return;
        }
        
        setHoveredNode(d);
        
        // Position tooltip like the clicked modal - top-right area
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          const tooltipX = rect.right - 250; // Similar to modal positioning
          const tooltipY = rect.top + 10;
          
          tooltipContainer
            .style("left", tooltipX + "px")
            .style("top", tooltipY + "px")
            .style("opacity", 1);
        }
        
        // Highlight connected nodes and links
        nodeSelection.style("opacity", node => 
          node === d || isConnected(node, d, links) ? 1 : 0.3
        );
        link.style("opacity", l => 
          l.source === d || l.target === d ? 0.8 : 0.1
        );
        
        // Use the unified NodeInfoPanel component
        tooltipContainer.html(`
          <div id="tooltip-node-info"></div>
        `);
        
        // Render React component into the tooltip
        const tooltipElement = document.getElementById('tooltip-node-info');
        if (tooltipElement) {
          const root = ReactDOM.createRoot(tooltipElement);
          root.render(React.createElement(NodeInfoPanel, { 
            node: d as UnifiedNode,
            isClickState: false
          }));
        }
      })
      .on("mouseout", () => {
        // Only clear hover state if no node is selected
        if (!selectedNode) {
          setHoveredNode(null);
          tooltipContainer.style("opacity", 0);
          
          // Reset highlighting
          nodeSelection.style("opacity", 1);
          link.style("opacity", d => Math.min(0.7, Math.log(d.tradeCount + 1) * 0.15));
        }
      })
      .on("click", (event, d) => {
        // Ignore click if we were dragging
        if (isDragging) {
          return;
        }
        
        event.preventDefault();
        event.stopPropagation();
        
        // Hide tooltip when clicking
        tooltipContainer.style("opacity", 0);
        setHoveredNode(null);
        
        // Reset highlighting when selecting a node
        nodeSelection.style("opacity", 1);
        link.style("opacity", d => Math.min(0.7, Math.log(d.tradeCount + 1) * 0.15));
        
        // Use a more stable selection logic
        setSelectedNode(prevSelected => {
          if (prevSelected?.id === d.id) {
            return null; // Deselect if clicking the same node
          }
          return d; // Select the new node
        });
      })
      .call(d3.drag<SVGGElement, UnifiedNode>()
        .on("start", (event, d) => {
          isDragging = false;
          dragStartTime = Date.now();
          
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          // Mark as dragging if moved more than a few pixels or dragging for more than 100ms
          if (!isDragging && (Math.abs(event.dx) > 3 || Math.abs(event.dy) > 3 || Date.now() - dragStartTime > 100)) {
            isDragging = true;
          }
          
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
          
          // Reset dragging flag after a short delay to prevent click interference
          setTimeout(() => {
            isDragging = false;
          }, 50);
        })
      );

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as UnifiedNode).x!)
        .attr("y1", d => (d.source as UnifiedNode).y!)
        .attr("x2", d => (d.target as UnifiedNode).x!)
        .attr("y2", d => (d.target as UnifiedNode).y!);

      nodeSelection
        .attr("transform", d => `translate(${d.x},${d.y})`);

      labelGroup.selectAll("text")
        .attr("x", d => (d as UnifiedNode).x!)
        .attr("y", d => (d as UnifiedNode).y!);
    });

    // Cleanup function
    return () => {
      tooltipContainer.remove();
    };
  }, [filteredTokensData, trendingTokens, dimensions, highlightMode, selectedNode, setSelectedNode, setHoveredNode]);

  // Now add the useEffect that uses the render function
  useEffect(() => {
    if (!svgRef.current || Object.keys(filteredTokensData).length === 0 || dimensions.width === 0 || dimensions.height === 0) {
      return;
    }

    // Add a small delay to prevent rapid re-renders during state changes
    const renderTimeout = setTimeout(() => {
      try {
        renderUnifiedMindmap();
      } catch (error) {
        console.error('Failed to render unified mindmap:', error);
      }
    }, 50);

    return () => {
      clearTimeout(renderTimeout);
    };
  }, [filteredTokensData, trendingTokens, dimensions.width, dimensions.height, highlightMode, showSubscribedOnly, renderUnifiedMindmap]);

  const processUnifiedData = () => {
    const nodes: UnifiedNode[] = [];
    const links: UnifiedLink[] = [];
    const kolMap = new Map<string, UnifiedNode>();

    console.log('🗺️ Processing unified mindmap data:', {
      tokensCount: Object.keys(filteredTokensData).length,
      tokensData: Object.keys(filteredTokensData),
      showSubscribedOnly,
      sampleData: Object.entries(filteredTokensData).slice(0, 2).map(([mint, data]) => ({
        mint,
        kolConnectionsCount: Object.keys(data.kolConnections || {}).length,
        networkMetrics: data.networkMetrics
      }))
    });

    // Process each token and its KOL connections
    Object.entries(filteredTokensData).forEach(([tokenMint, data]) => {
      const kolConnections = Object.keys(data.kolConnections || {});
      const totalTrades = data.networkMetrics?.totalTrades || 0;
      const totalVolume = Object.values(data.kolConnections || {})
        .reduce((sum, kol) => sum + kol.totalVolume, 0);

      console.log('🗺️ Processing token:', {
        tokenMint: tokenMint.slice(0, 8),
        kolConnectionsCount: kolConnections.length,
        totalTrades,
        totalVolume,
        hasKolConnections: !!data.kolConnections,
        kolConnectionsKeys: Object.keys(data.kolConnections || {}).slice(0, 3)
      });

      // Add token node
      nodes.push({
        id: tokenMint,
        type: 'token',
        label: `${tokenMint.slice(0, 8)}...`,
        value: totalTrades * 10,
        connections: kolConnections.length,
        totalVolume,
        tradeCount: totalTrades,
        isTrending: trendingTokens.includes(tokenMint)
      });

      // Process KOL connections
      Object.values(data.kolConnections || {}).forEach(kol => {
        let kolNode = kolMap.get(kol.kolWallet);
        
        if (!kolNode) {
          // Create new KOL node
          kolNode = {
            id: kol.kolWallet,
            type: 'kol',
            label: `${kol.kolWallet.slice(0, 6)}...`,
            value: kol.tradeCount * 5,
            connections: 1,
            totalVolume: kol.totalVolume,
            tradeCount: kol.tradeCount,
            influenceScore: kol.influenceScore,
            relatedTokens: [tokenMint]
          };
          kolMap.set(kol.kolWallet, kolNode);
        } else {
          // Update existing KOL node
          kolNode.connections += 1;
          kolNode.totalVolume = (kolNode.totalVolume || 0) + kol.totalVolume;
          kolNode.tradeCount = (kolNode.tradeCount || 0) + kol.tradeCount;
          kolNode.influenceScore = Math.max(kolNode.influenceScore || 0, kol.influenceScore);
          kolNode.relatedTokens = [...(kolNode.relatedTokens || []), tokenMint];
        }

        // Create link between token and KOL
        links.push({
          source: tokenMint,
          target: kol.kolWallet,
          value: kol.totalVolume,
          tradeCount: kol.tradeCount,
          volume: kol.totalVolume
        });
      });
    });

    // Add all KOL nodes to the main nodes array
    nodes.push(...Array.from(kolMap.values()));

    console.log('🗺️ Unified mindmap processing complete:', {
      totalNodes: nodes.length,
      tokenNodes: nodes.filter(n => n.type === 'token').length,
      kolNodes: nodes.filter(n => n.type === 'kol').length,
      totalLinks: links.length,
      sampleNodes: nodes.slice(0, 5).map(n => ({
        id: n.id.slice(0, 8),
        type: n.type,
        connections: n.connections
      }))
    });

    return { nodes, links };
  };

  const isConnected = (nodeA: UnifiedNode, nodeB: UnifiedNode, links: UnifiedLink[]): boolean => {
    return links.some(link => 
      (link.source === nodeA && link.target === nodeB) ||
      (link.source === nodeB && link.target === nodeA)
    );
  };

  const handleZoomIn = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        zoomRef.current.scaleBy, 1.5
      );
    }
  };

  const handleZoomOut = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        zoomRef.current.scaleBy, 1 / 1.5
      );
    }
  };

  const handleResetZoom = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        zoomRef.current.transform,
        d3.zoomIdentity
      );
    }
  };

  const tokenCount = Object.keys(filteredTokensData).length;
  const totalKOLs = new Set(
    Object.values(filteredTokensData).flatMap(data => 
      Object.keys(data.kolConnections || {})
    )
  ).size;
  
  // Calculate subscription stats
  const allKOLs = new Set(
    Object.values(tokensData).flatMap(data => 
      Object.keys(data.kolConnections || {})
    )
  ).size;
  const subscribedKOLs = new Set(
    Object.values(tokensData).flatMap(data => 
      Object.keys(data.kolConnections || {}).filter(kolWallet => isSubscribedToKOL(kolWallet))
    )
  ).size;

  // Show empty state if no data after filtering
  if (showSubscribedOnly && Object.keys(filteredTokensData).length === 0) {
    return (
      <div ref={containerRef} className={cn('w-full h-full flex flex-col min-h-[300px] max-h-[600px]', className)}>
        {/* Mobile-Responsive Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 px-2 sm:px-4 py-2 bg-muted/20 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center justify-center sm:justify-start space-x-2 sm:space-x-4 text-xs sm:text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CircleDollarSign className="h-3 w-3" />
              <span className="font-medium">0</span>
              <span className="hidden xs:inline">tokens</span>
            </span>
            <span className="flex items-center gap-1">
              <UserCheck className="h-3 w-3" />
              <span className="font-medium">0</span>
              <span className="hidden xs:inline">KOLs</span>
            </span>
          </div>

          <div className="flex items-center justify-center gap-1 overflow-x-auto pb-1">
            {/* KOL Filter Toggle */}
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowSubscribedOnly(true)}
              className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs flex-shrink-0"
            >
              <UserCheck className="h-3 w-3 mr-1" />
              <span className="hidden xs:inline">Subscribed</span> ({subscribedKOLs})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSubscribedOnly(false)}
              className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs flex-shrink-0"
            >
              <Users className="h-3 w-3 mr-1" />
              <span className="hidden xs:inline">All</span> ({allKOLs})
            </Button>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 p-8">
            <UserCheck className="h-16 w-16 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No Subscribed KOLs Found
              </h3>
              <p className="text-muted-foreground max-w-md">
                You haven't subscribed to any KOLs yet, or none of your subscribed KOLs are trading the available tokens.
                <br />
                Switch to "All KOLs" to see the full network.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowSubscribedOnly(false)}
              className="mt-4"
            >
              <Users className="h-4 w-4 mr-2" />
              View All KOLs
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('w-full h-full flex flex-col min-h-[300px] max-h-[600px]', className)}>
      {/* Mobile-Responsive Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 px-2 sm:px-4 py-2 bg-muted/20 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center justify-center sm:justify-start space-x-2 sm:space-x-4 text-xs sm:text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CircleDollarSign className="h-3 w-3" />
            <span className="font-medium">{tokenCount}</span>
            <span className="hidden xs:inline">tokens</span>
            {showSubscribedOnly && <span className="text-xs">(filtered)</span>}
          </span>
          <span className="flex items-center gap-1">
            <UserCheck className="h-3 w-3" />
            <span className="font-medium">{totalKOLs}</span>
            <span className="hidden xs:inline">KOLs</span>
            {showSubscribedOnly && <span className="text-xs">(subscribed)</span>}
          </span>
        </div>

        <div className="flex items-center justify-center gap-1 overflow-x-auto pb-1">
          {/* KOL Filter Toggle */}
          <Button
            variant={showSubscribedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowSubscribedOnly(true)}
            className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs flex-shrink-0"
          >
            <UserCheck className="h-3 w-3 mr-1" />
            <span className="hidden xs:inline">Subscribed</span> ({subscribedKOLs})
          </Button>
          <Button
            variant={!showSubscribedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowSubscribedOnly(false)}
            className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs flex-shrink-0"
          >
            <Users className="h-3 w-3 mr-1" />
            <span className="hidden xs:inline">All</span> ({allKOLs})
          </Button>

          {/* Divider */}
          <div className="w-px h-4 bg-border mx-1" />

          {/* Highlight Mode Toggle */}
          <Button
            variant={highlightMode === 'none' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setHighlightMode('none')}
            className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs flex-shrink-0"
          >
            All
          </Button>
          <Button
            variant={highlightMode === 'trending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setHighlightMode('trending')}
            className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs flex-shrink-0"
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            <span className="hidden xs:inline">Trending</span>
          </Button>
          <Button
            variant={highlightMode === 'high-volume' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setHighlightMode('high-volume')}
            className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs flex-shrink-0"
          >
            <Activity className="h-3 w-3 mr-1" />
            <span className="hidden xs:inline">Volume</span>
          </Button>

          {/* Zoom Controls */}
          <div className="ml-1 sm:ml-2 flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleZoomIn} className="h-6 w-6 sm:h-7 sm:w-7 p-0">
              <ZoomIn className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut} className="h-6 w-6 sm:h-7 sm:w-7 p-0">
              <ZoomOut className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleResetZoom} className="h-6 w-6 sm:h-7 sm:w-7 p-0">
              <RotateCcw className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Visualization */}
      <div className="relative flex-1 w-full h-full min-h-0 overflow-hidden">
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
        <div className="hidden lg:block absolute bottom-2 left-2 p-2 bg-card/90 border border-border rounded-md shadow-sm text-xs text-muted-foreground max-w-48">
          <div className="font-semibold text-foreground mb-1 flex items-center gap-1">
            <Lightbulb className="h-3 w-3" />
            <span>Tips</span>
          </div>
          <div className="space-y-0.5">
            <div>• <strong>Drag</strong> nodes to reposition</div>
            <div>• <strong>Hover</strong> for quick details</div>
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
}

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
          </div>
        )}

        {node.isTrending && (
          <div className="flex items-center gap-1 text-xs font-semibold text-accent-from">
            <TrendingUp className="h-3 w-3" />
            <span>Trending</span>
          </div>
        )}
        
        {/* Mobile-friendly interaction tips - only show in click state */}
        {isClickState && (
          <div className="block sm:hidden pt-1 border-t border-border/30">
            <div className="text-xs text-muted-foreground">
              Tap nodes • Drag to move • Pinch to zoom
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 

export default UnifiedKOLMindmap;