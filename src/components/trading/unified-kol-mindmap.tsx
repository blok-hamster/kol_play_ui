'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react';
import * as d3 from 'd3';
import { formatDistanceToNow } from 'date-fns';
import { EnhancedUnifiedNode } from '@/types';
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
  Users,
  AlertCircle,
} from 'lucide-react';
import ReactDOM from 'react-dom/client';
import { useSubscriptions } from '@/stores/use-trading-store';
import { useKOLStore } from '@/stores';
import { useTokenStore } from '@/stores/use-token-store';
import { dataFilterManager } from '@/lib/mindmap-filter-manager';
import { enhancedNodeRenderer } from '@/lib/enhanced-node-renderer';
import { useEnhancedKOLNodes } from '@/hooks/use-enhanced-kol-nodes';
import {
  TokenTooltip,
  KOLTooltip,
  ConnectionTooltip,
  TooltipManager,
} from './mindmap-tooltips';
import {
  NodeInteractionSystem,
  DetailedInfoPanel,
} from './mindmap-interactions';
import { SolanaService } from '@/services/solana.service';
// import removed: useKOLTradeSocket no longer used directly in this component

interface UnifiedNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'token' | 'kol';
  label: string;
  name?: string | undefined; // Display name for tokens/KOLs
  image?: string | undefined; // Image URL for tokens/KOLs
  symbol?: string | undefined; // Token symbol
  decimals?: number | undefined; // Token decimals
  metadataUri?: string | undefined; // Token metadata URI
  value: number; // For sizing
  connections: number; // Number of connections
  totalVolume?: number | undefined;
  tradeCount?: number | undefined;
  influenceScore?: number | undefined;
  isTrending?: boolean | undefined;
  tokenMint?: string | undefined; // For KOL nodes, which token they're connected to
  relatedTokens?: string[] | undefined; // For KOL nodes, all tokens they trade
  isFeatured?: boolean | undefined;
  x?: number | undefined;
  y?: number | undefined;
  vx?: number | undefined;
  vy?: number | undefined;
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

export const UnifiedKOLMindmap: React.FC<Partial<UnifiedKOLMindmapProps>> = ({
  tokensData,
  trendingTokens,
  width = 1400,
  height = 800,
  className,
}) => {
  // REMOVED: duplicate useKOLTradeSocket() call — data comes via props from progressive-kol-trades
  // const { allMindmapData, trendingTokens: hookTrendingTokens, recentTrades } = useKOLTradeSocket();

  // Stabilize empty array reference
  const EMPTY_ARRAY = useMemo(() => [] as string[], []);

  // Use props if provided, otherwise fallback to empty defaults
  const activeTokensData = tokensData || {};
  // Use stable empty array for fallback
  const activeTrendingTokens = trendingTokens || EMPTY_ARRAY;
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // Refs for D3 persistence
  const simulationRef = useRef<d3.Simulation<UnifiedNode, UnifiedLink> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const linkGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const nodeGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const labelGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const { isSubscribedToKOL, subscriptions } = useSubscriptions();
  const { getKOL, loadAllKOLs } = useKOLStore();
  const { getTokenByMint } = useTokenStore();

  // Track subscription changes for real-time updates
  const previousSubscriptionsRef = useRef<typeof subscriptions>([]);
  const enhancedKOLNodes = useEnhancedKOLNodes({
    enableProgressiveLoading: true,
    batchSize: 6,
    maxConcurrentRequests: 2,
  });

  // Stable ref for batchCreateEnhancedKOLNodes to avoid useEffect dependency churn
  const batchCreateRef = useRef(enhancedKOLNodes.batchCreateEnhancedKOLNodes);
  batchCreateRef.current = enhancedKOLNodes.batchCreateEnhancedKOLNodes;

  // Cache of already-processed KOL wallet sets to prevent infinite re-processing
  const processedKOLsRef = useRef<string>('');

  // Load all KOLs once on component mount
  useEffect(() => {
    // Use a timeout to prevent blocking the main thread
    const timeoutId = setTimeout(() => {
      loadAllKOLs().catch(error => {
        console.warn('Failed to load KOLs for mindmap:', error);
      });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [loadAllKOLs]);
  const [selectedNode, setSelectedNode] = useState<UnifiedNode | null>(null);
  const [highlightMode, setHighlightMode] = useState<
    'none' | 'trending' | 'high-volume'
  >('none');
  const [showSubscribedOnly, setShowSubscribedOnly] = useState(false);
  const [dimensions, setDimensions] = useState({ width, height });
  const [interactionErrors, setInteractionErrors] = useState<Error[]>([]);
  const [processedData, setProcessedData] = useState<{
    nodes: UnifiedNode[];
    links: UnifiedLink[];
  }>({ nodes: [], links: [] });

  // Handle real-time subscription changes
  useEffect(() => {
    const currentSubscriptions = subscriptions;
    const previousSubscriptions = previousSubscriptionsRef.current;

    // Check if subscriptions have actually changed
    const subscriptionsChanged =
      currentSubscriptions.length !== previousSubscriptions.length ||
      currentSubscriptions.some((current, index) => {
        const previous = previousSubscriptions[index];
        return (
          !previous ||
          current.kolWallet !== previous.kolWallet ||
          current.isActive !== previous.isActive
        );
      });

    if (subscriptionsChanged && previousSubscriptions.length > 0) {
      previousSubscriptionsRef.current = [...currentSubscriptions];
    } else if (previousSubscriptions.length === 0) {
      previousSubscriptionsRef.current = [...currentSubscriptions];
    }
  }, [subscriptions, showSubscribedOnly]);

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
          height: newHeight,
        });
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

  // Enhanced filtering
  const filteredTokensData = useMemo(() => {
    const solanaFiltered = dataFilterManager.filterSolanaBaseToken(activeTokensData);
    const subscriptionFiltered = dataFilterManager.filterBySubscriptionStatus(
      solanaFiltered,
      showSubscribedOnly,
      isSubscribedToKOL
    );
    const relationshipValidated =
      dataFilterManager.validateTokenKOLRelationships(subscriptionFiltered, {
        preserveMetadata: true,
        validateConnections: true,
        minConnectionStrength: 0.1,
      });
    return dataFilterManager.optimizeNetworkData(relationshipValidated);
  }, [activeTokensData, showSubscribedOnly, isSubscribedToKOL]);

  // Debouncing for filteredTokensData to prevent layout thrashing
  const [debouncedFilteredData, setDebouncedFilteredData] = useState(filteredTokensData);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Shorter debounce for responsiveness, but enough to batch WebSocket bursts
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedFilteredData(filteredTokensData);
    }, 800);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [filteredTokensData]);

  // Derived Network Stats (Moved from state/effect to useMemo to prevent loops)
  const networkStats = useMemo(() => {
    const stats = dataFilterManager.getFilteringStats(
      activeTokensData,
      filteredTokensData
    );

    const totalKOLs = new Set(
      Object.values(filteredTokensData).flatMap(data =>
        Object.keys(data.kolConnections || {})
      )
    ).size;

    const subscribedKOLs = new Set(
      Object.values(filteredTokensData).flatMap(data =>
        Object.keys(data.kolConnections || {}).filter(kolWallet =>
          isSubscribedToKOL(kolWallet)
        )
      )
    ).size;

    return {
      totalTokens: Object.keys(filteredTokensData).length,
      totalKOLs,
      subscribedKOLs,
      filteredTokens: stats.tokensFiltered,
      lastUpdate: new Date(),
    };
  }, [filteredTokensData, isSubscribedToKOL, activeTokensData]);

  // Handle interaction errors
  const handleInteractionError = useCallback((error: Error) => {
    console.error('Mindmap interaction error:', error);
    setInteractionErrors(prev => [...prev, error]);

    // Auto-remove error after 5 seconds
    setTimeout(() => {
      setInteractionErrors(prev => prev.filter(e => e !== error));
    }, 5000);
  }, []);

  // Initialize SVG text and groups once
  useEffect(() => {
    if (!svgRef.current || gRef.current) return;

    const svg = d3.select(svgRef.current);

    // Create container for zoom/pan
    const container = svg.append('g');
    gRef.current = container;

    // Create groups in order (links bottom, nodes middle, labels top)
    linkGroupRef.current = container.append('g').attr('class', 'links');
    nodeGroupRef.current = container.append('g').attr('class', 'nodes');
    labelGroupRef.current = container.append('g').attr('class', 'labels');

    // Set up zoom behavior
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', event => {
        container.attr('transform', event.transform);
      });

    svg.call(zoomBehavior);
    zoomRef.current = zoomBehavior;
  }, []);

  // Handle data updates and rendering
  useEffect(() => {
    if (
      !svgRef.current ||
      !gRef.current ||
      !linkGroupRef.current ||
      !nodeGroupRef.current ||
      !labelGroupRef.current
    ) {
      return;
    }

    // Allow rendering even with empty data to show loading state
    if (processedData.nodes.length === 0) {
      console.log('[UnifiedMindmap] No nodes to render');
      return;
    }


    const { nodes, links } = processedData;
    const { width: svgWidth, height: svgHeight } = dimensions;
    const tooltipManager = TooltipManager.getInstance();

    // 1. Update Simulation
    if (!simulationRef.current) {
      simulationRef.current = d3
        .forceSimulation<UnifiedNode>(nodes)
        .force(
          'link',
          d3
            .forceLink<UnifiedNode, UnifiedLink>(links)
            .id(d => d.id)
            .distance(d => {
              const baseDistance = 120;
              const strengthFactor = Math.log(d.tradeCount + 1) * 20;
              return Math.max(80, baseDistance - strengthFactor);
            })
            .strength(0.3)
        )
        .force(
          'charge',
          d3.forceManyBody().strength(d => {
            const baseStrength = -400;
            const connectionFactor = Math.sqrt(d.connections) * 50;
            return baseStrength - connectionFactor;
          })
        )
        .force('center', d3.forceCenter(svgWidth / 2, svgHeight / 2))
        .force(
          'collision',
          d3.forceCollide().radius(d => Math.max(15, Math.sqrt(d.value) + 5))
        )
        .force('x', d3.forceX(svgWidth / 2).strength(0.05))
        .force('y', d3.forceY(svgHeight / 2).strength(0.05));
    } else {
      // Update nodes and links, keep existing simulation "hot" but not exploding
      simulationRef.current.nodes(nodes);

      // Update link force with new links
      const linkForce = simulationRef.current.force<d3.ForceLink<UnifiedNode, UnifiedLink>>('link');
      if (linkForce) {
        linkForce.links(links);
      }

      // Update center force for new dimensions
      const centerForce = d3.forceCenter(svgWidth / 2, svgHeight / 2);
      simulationRef.current.force('center', centerForce);

      // Restart with LOW alpha to gently animate changes instead of "exploding" the layout
      simulationRef.current.alpha(0.1).alphaTarget(0).restart();
    }

    // 2. Define colors (definitions)
    const svg = d3.select(svgRef.current);
    let defs = svg.select('defs');
    if (defs.empty()) {
      defs = svg.append('defs');
    }

    const accentFrom = '#14F195';
    const accentTo = '#9945FF';

    const tokenColorScale = d3
      .scaleSequential(d3.interpolateRgb(accentFrom, accentTo))
      .domain([0, d3.max(nodes.filter(n => n.type === 'token'), d => d.connections) || 1]);

    const kolColorScale = d3
      .scaleSequential(d3.interpolateRgb('#FF6B6B', '#4ECDC4'))
      .domain([0, d3.max(nodes.filter(n => n.type === 'kol'), d => d.influenceScore || 0) || 100]);

    // Update gradients
    links.forEach((link, i) => {
      const gradientId = `linkGradient${i}`;
      if (defs.select(`#${gradientId}`).empty()) {
        const gradient = defs
          .append('linearGradient')
          .attr('id', gradientId)
          .attr('gradientUnits', 'userSpaceOnUse');

        gradient.append('stop').attr('offset', '0%').attr('stop-color', accentFrom);
        gradient.append('stop').attr('offset', '100%').attr('stop-color', accentTo);
      }
    });

    // 3. Update Links
    const linkSelection = linkGroupRef.current.selectAll<SVGLineElement, UnifiedLink>('line')
      .data(links, d => {
        // Create stable key from source and target IDs
        const sourceId = typeof d.source === 'string' ? d.source : (d.source as UnifiedNode).id;
        const targetId = typeof d.target === 'string' ? d.target : (d.target as UnifiedNode).id;
        return `${sourceId}-${targetId}`;
      });

    const linkEnter = linkSelection.enter().append('line')
      .attr('stroke', (_d, i) => `url(#linkGradient${i})`)
      .attr('stroke-opacity', d => Math.min(0.7, Math.log(d.tradeCount + 1) * 0.15))
      .attr('stroke-width', d => Math.max(1.5, Math.sqrt(d.tradeCount) * 0.8))
      .style('cursor', 'pointer');

    // Add event listeners to merged selection (new + existing) to ensure latest closure capture
    const linkMerge = linkEnter.merge(linkSelection);

    // Update listeners
    linkMerge
      .on('mouseover', (event, d) => {
        try {
          d3.select(event.currentTarget)
            .attr('stroke-opacity', 0.9)
            .attr('stroke-width', Math.max(3, Math.sqrt(d.tradeCount) * 1.2));

          // FIX: Use client coordinates directly
          const mouseX = event.clientX;
          const mouseY = event.clientY;

          const sourceNode = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
          const targetNode = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);

          if (sourceNode && targetNode) {
            const tooltipContent = React.createElement(ConnectionTooltip, {
              link: d,
              sourceNode: sourceNode as UnifiedNode,
              targetNode: targetNode as UnifiedNode,
            });

            tooltipManager.showTooltip(tooltipContent, { x: mouseX, y: mouseY }, 150);
          }
        } catch (error) {
          handleInteractionError(error as Error);
        }
      })
      .on('mouseout', (event, d) => {
        try {
          d3.select(event.currentTarget)
            .attr('stroke-opacity', Math.min(0.7, Math.log(d.tradeCount + 1) * 0.15))
            .attr('stroke-width', Math.max(1.5, Math.sqrt(d.tradeCount) * 0.8));
          tooltipManager.hideTooltip();
        } catch (error) {
          handleInteractionError(error as Error);
        }
      })
      .on('click', (event, d) => {
        try {
          event.preventDefault();
          event.stopPropagation();
          // Highlight logic could be added here if needed
        } catch (error) {
          handleInteractionError(error as Error);
        }
      });

    linkSelection.exit().remove();

    // 4. Update Nodes
    const nodeSelection = nodeGroupRef.current.selectAll<SVGGElement, UnifiedNode>('g.node-group')
      .data(nodes, d => d.id);

    // Enter selection — NO drag here, drag is applied to nodeMerge below
    const nodeEnter = nodeSelection.enter().append('g')
      .attr('class', 'node-group')
      .style('cursor', 'grab');

    // --- Node Visuals Construction (Enter only) ---
    // Helper for radius calculation
    const getRadius = (d: UnifiedNode) => {
      if (d.type === 'token') {
        const baseSize = 20;
        const connectionBonus = Math.sqrt(d.connections) * 7;
        const volumeBonus = Math.log(d.totalVolume || 1) * 2.5;
        return Math.min(55, baseSize + connectionBonus + volumeBonus);
      } else {
        const baseSize = 14;
        const influenceBonus = Math.sqrt(d.influenceScore || 0) * 2.2;
        const tradeBonus = Math.sqrt(d.tradeCount || 0) * 1.5;
        return Math.min(40, baseSize + influenceBonus + tradeBonus);
      }
    };

    // Background Circle
    nodeEnter.append('circle')
      .attr('class', 'bg-circle')
      .attr('r', d => getRadius(d));

    // Token/KOL Images
    nodeEnter.each(function (d) {
      const node = d3.select(this);
      const radius = getRadius(d);

      // ALWAYS append image infrastructure so it can be updated later if image arrives
      const imageSize = radius * 1.8;
      const clipId = `node-clip-${d.id.replace(/[^a-zA-Z0-9]/g, '-')}`;

      // Ensure clip path exists - check prevents duplicates
      if (defs.select(`#${clipId}`).empty()) {
        defs.append('clipPath')
          .attr('id', clipId)
          .append('circle')
          .attr('r', radius - 2);
      }

      node.append('image')
        .attr('class', 'node-image')
        .attr('href', d.image || '') // Empty string if undefined, will update in merge
        .attr('x', -imageSize / 2)
        .attr('y', -imageSize / 2)
        .attr('width', imageSize)
        .attr('height', imageSize)
        .attr('clip-path', `url(#${clipId})`)
        .style('pointer-events', 'none')
        .style('display', d.image ? 'block' : 'none') // Initial visibility
        .on('error', function () {
          d3.select(this).style('display', 'none');
          node.select('.fallback-circle').style('display', 'block');
        });

      // Fallback/Inner Circle (Always append, toggle visibility in merge)
      const hasImage = !!d.image;

      if (d.type === 'kol') {
        node.append('circle')
          .attr('class', 'fallback-circle')
          .attr('r', radius * 0.6)
          .attr('fill', 'none')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4,2')
          .attr('opacity', 0.8)
          .style('display', hasImage ? 'none' : 'block');
      }

      if (d.type === 'token') {
        node.append('circle')
          .attr('class', 'fallback-circle')
          .attr('r', Math.max(8, Math.sqrt(d.connections) * 3))
          .attr('fill', '#ffffff')
          .attr('fill-opacity', 0.25)
          .attr('stroke', 'none')
          .style('display', hasImage ? 'none' : 'block');
      }

      // Featured indicator
      if (d.type === 'kol' && d.isFeatured) {
        node.append('circle')
          .attr('class', 'featured-indicator')
          .attr('r', (radius * 0.6) + 4)
          .attr('fill', 'none')
          .attr('stroke', '#FFD700')
          .attr('stroke-width', 2.5)
          .style('filter', 'drop-shadow(0 0 4px rgba(255, 215, 0, 0.5))');
      }
    });

    const nodeMerge = nodeEnter.merge(nodeSelection);

    // Apply drag behavior to ALL nodes (merged = new + existing)
    // This ensures drag persists across D3 data joins/re-renders
    const isDraggingRef = { current: false };
    nodeMerge.call(
      d3.drag<SVGGElement, UnifiedNode>()
        .on('start', (event, d) => {
          isDraggingRef.current = true;
          tooltipManager.hideTooltip(); // Hide tooltip immediately on drag start
          d3.select(event.sourceEvent.target.closest('.node-group')).style('cursor', 'grabbing');
          if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          isDraggingRef.current = false;
          d3.select(event.sourceEvent.target.closest('.node-group')).style('cursor', 'grab');
          if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

    // Update visuals on merge
    nodeMerge.select('circle.bg-circle')
      .transition().duration(500)
      .attr('r', d => getRadius(d))
      .attr('fill', d => {
        if (d.type === 'kol' && d.image) return 'transparent';
        if (d.type === 'token' && d.image) return '#ffffff20';
        if (highlightMode === 'trending' && d.isTrending) return accentFrom;
        if (highlightMode === 'high-volume' && (d.totalVolume || 0) > 100) return accentTo;
        return d.type === 'token' ? (d.isTrending ? accentFrom : tokenColorScale(d.connections)) : kolColorScale(d.influenceScore || 0);
      })
      .attr('fill-opacity', d => d.image ? (d.type === 'kol' ? 0 : 0.3) : 0.7)
      .attr('stroke', d => {
        if (d.type === 'token') return '#9945FF'; // Purple border for tokens
        if (d.type === 'kol' && d.image) return '#ffffff80';
        return '#ffffff';
      })
      .attr('stroke-width', d => {
        if (d.type === 'token') return 2; // Always visible border for tokens
        return d.type === 'kol' ? (d.image ? 1.5 : 2) : 0;
      })
      .style('filter', d => {
        if (d.type === 'token') return `drop-shadow(0 0 8px #9945FF60)`; // Always glow for tokens
        if (d.type === 'kol' && (d.influenceScore || 0) > 70) return `drop-shadow(0 0 15px #FF6B6B60)`;
        return 'none';
      });

    // Update images if data changes
    nodeMerge.select('image.node-image')
      .attr('href', d => d.image || '')
      .attr('x', d => -(getRadius(d) * 1.8) / 2)
      .attr('y', d => -(getRadius(d) * 1.8) / 2)
      .attr('width', d => getRadius(d) * 1.8)
      .attr('height', d => getRadius(d) * 1.8)
      .style('display', d => d.image ? 'block' : 'none');

    // Update fallback visibility
    nodeMerge.select('circle.fallback-circle')
      .style('display', d => d.image ? 'none' : 'block');

    // Update clip paths
    nodeMerge.each(function (d) {
      // We only care if image is meant to be shown
      if (d.image) {
        const radius = getRadius(d);
        const clipId = `node-clip-${d.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const clipPathCircle = defs.select(`#${clipId} circle`);
        if (!clipPathCircle.empty()) {
          clipPathCircle.attr('r', radius - 2);
        }
      }
    });

    // Interaction Listeners (Update on merge to capture latest state/highlightMode)
    let hoverTimeout: NodeJS.Timeout | null = null;

    // Use mouseenter/mouseleave instead of mouseover/mouseout
    // mouseenter/mouseleave don't fire when crossing child SVG element boundaries
    nodeMerge
      .on('mouseenter', (event, d) => {
        if (isDraggingRef.current) return; // Suppress tooltip during drag
        if (hoverTimeout) clearTimeout(hoverTimeout);
        if (selectedNode) return;

        const mouseX = event.clientX;
        const mouseY = event.clientY;

        hoverTimeout = setTimeout(() => {
          if (isDraggingRef.current) return; // Re-check after delay
          try {
            // Highlight
            nodeMerge.style('opacity', n => n === d || isConnected(n, d, links) ? 1 : 0.3);
            linkMerge.style('opacity', l => (l.source === d || l.target === d) ? 0.8 : 0.1);

            const tooltipContent = d.type === 'token'
              ? React.createElement(TokenTooltip, { node: d })
              : React.createElement(KOLTooltip, { node: d });

            tooltipManager.showTooltip(tooltipContent, { x: mouseX, y: mouseY }, 100);
          } catch (error) { handleInteractionError(error as Error); }
        }, 50);
      })
      .on('mousemove', event => {
        if (isDraggingRef.current) return; // Suppress during drag
        tooltipManager.updatePosition({ x: event.clientX, y: event.clientY });
      })
      .on('mouseleave', () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        if (!selectedNode) {
          // Increased delay from 50ms to 200ms so user can reach tooltip buttons
          setTimeout(() => {
            tooltipManager.hideTooltip();
            nodeMerge.style('opacity', 1);
            linkMerge.style('opacity', d => Math.min(0.7, Math.log(d.tradeCount + 1) * 0.15));
          }, 200);
        }
      })
      .on('click', (event, d) => {
        if (isDraggingRef.current) return; // Suppress click during drag
        if (Math.abs(d.vx || 0) > 0.1 || Math.abs(d.vy || 0) > 0.1) return;
        event.preventDefault();
        event.stopPropagation();
        tooltipManager.hideTooltip();
        nodeMerge.style('opacity', 1);
        setSelectedNode(prev => prev?.id === d.id ? null : { ...d });
      });

    nodeSelection.exit().remove();

    // 5. Update Labels
    const labelSelection = labelGroupRef.current.selectAll<SVGTextElement, UnifiedNode>('text')
      .data(
        nodes.filter(d => (d.type === 'token' && (d.symbol || d.name)) || (d.type === 'kol' && d.name)),
        d => d.id
      );

    const labelEnter = labelSelection.enter().append('text')
      .attr('text-anchor', 'middle')
      .attr('font-family', 'Darker Grotesque, sans-serif')
      .attr('font-weight', '700')
      .attr('stroke', '#000000')
      .attr('stroke-width', '3px')
      .attr('stroke-linejoin', 'round')
      .attr('paint-order', 'stroke')
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    const labelMerge = labelEnter.merge(labelSelection);

    labelMerge
      .text(d => {
        if (d.type === 'token') {
          if (d.symbol && d.symbol.length <= 8) return d.symbol;
          if (d.symbol) return d.symbol.substring(0, 6) + '...';
          if (d.name && d.name.length <= 10) return d.name;
          return `${d.id.slice(0, 6)}...`;
        } else {
          if (d.name && d.name.length <= 12) return d.name;
          if (d.name) return d.name.substring(0, 10) + '...';
          return `${d.id.slice(0, 6)}...`;
        }
      })
      .attr('font-size', d => (d.type === 'token' && d.connections > 5) || (d.type === 'kol' && (d.influenceScore || 0) > 70) ? '12px' : '11px')
      .attr('dy', d => {
        const r = d.type === 'token'
          ? Math.min(55, 20 + Math.sqrt(d.connections) * 7 + Math.log(d.totalVolume || 1) * 2.5)
          : Math.min(40, 14 + Math.sqrt(d.influenceScore || 0) * 2.2 + Math.sqrt(d.tradeCount || 0) * 1.5);
        return r + 16;
      })
      .attr('fill', '#ffffff');

    labelSelection.exit().remove();

    // 6. Simulation Tick
    if (simulationRef.current) {
      simulationRef.current.on('tick', () => {
        // Update link positions with safety checks
        linkMerge
          .attr('x1', d => {
            const source = d.source as UnifiedNode;
            return source?.x ?? 0;
          })
          .attr('y1', d => {
            const source = d.source as UnifiedNode;
            return source?.y ?? 0;
          })
          .attr('x2', d => {
            const target = d.target as UnifiedNode;
            return target?.x ?? 0;
          })
          .attr('y2', d => {
            const target = d.target as UnifiedNode;
            return target?.y ?? 0;
          });

        // Update node positions
        nodeMerge.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);

        // Update label positions
        labelMerge
          .attr('x', d => d.x ?? 0)
          .attr('y', d => d.y ?? 0);
      });
    }

  }, [processedData, dimensions, highlightMode, showSubscribedOnly, selectedNode]);


  // Determine device-specific limits for performance optimization
  const isMobile = dimensions.width < 768;

  // Process unified data and update state
  useEffect(() => {
    let isMounted = true;

    if (Object.keys(debouncedFilteredData).length > 0) {
      // Use the data filtering manager to process unified network data
      const deviceLimits = {
        maxNodes: isMobile ? 50 : 200,
        maxLinks: isMobile ? 100 : 500,
      };

      const networkData = dataFilterManager.processUnifiedData(
        debouncedFilteredData,
        activeTrendingTokens,
        deviceLimits
      );

      // 1. IMMEDIATE RENDER: Set basic data first so the user sees something instantly
      const currentPositions = new Map<string, { x?: number; y?: number; vx?: number; vy?: number }>();
      if (simulationRef.current) {
        simulationRef.current.nodes().forEach(n => {
          currentPositions.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });
        });
      }

      // Create basic nodes preserving positions
      const basicNodes: UnifiedNode[] = networkData.nodes.map(node => {
        const existingPos = currentPositions.get(node.id);

        // Basic node construction
        let baseNode: UnifiedNode = {
          id: node.id,
          type: node.type,
          label: node.label,
          name: node.name,
          image: node.image,
          value: node.value,
          connections: node.connections,
          totalVolume: node.totalVolume,
          tradeCount: node.tradeCount,
          influenceScore: node.influenceScore,
          isTrending: node.isTrending,
          tokenMint: node.tokenMint,
          relatedTokens: node.relatedTokens,
          ...existingPos,
        };

        // Best-effort synchronous enhancement from Stores (if already loaded)
        if (node.type === 'kol') {
          const kolDetails = getKOL(node.id);
          if (kolDetails) {
            baseNode.label = kolDetails.name || baseNode.label;
            baseNode.name = kolDetails.name;
            baseNode.image = kolDetails.avatar || baseNode.image;
          }
        } else if (node.type === 'token') {
          const tokenMeta = getTokenByMint(node.id);
          if (tokenMeta) {
            baseNode.label = tokenMeta.symbol || baseNode.label;
            baseNode.name = tokenMeta.name || baseNode.name;
            baseNode.image = tokenMeta.logoURI || baseNode.image;
          }
        }
        return baseNode;
      });

      const basicLinks: UnifiedLink[] = networkData.links.map(link => ({
        source: link.source,
        target: link.target,
        value: link.value,
        tradeCount: link.tradeCount,
        volume: link.volume,
      }));

      // Render immediately with basic data
      setProcessedData({ nodes: basicNodes, links: basicLinks });

      // 2. ENHANCED RENDER: Process nodes with metadata in background (Unblocking)
      const processNodesWithMetadata = async () => {
        // Separate nodes by type
        const tokenNodes = networkData.nodes.filter(n => n.type === 'token');
        const kolNodes = networkData.nodes.filter(n => n.type === 'kol');

        // A. Process Tokens (Batch Fetch)
        const tokenMints = tokenNodes.map(n => n.id);

        if (!isMounted) return;

        // Fetch token metadata in batch using SolanaService
        let tokenMetadataMap = new Map();
        if (tokenMints.length > 0) {
          try {
            tokenMetadataMap = await SolanaService.fetchTokenMetadataBatch(tokenMints);
          } catch (error) {
            console.warn('Failed to fetch token metadata batch:', error);
          }
        }

        if (!isMounted) return;

        // B. Process KOLs — SKIP if the same set of KOLs was already processed
        const kolDataForHook = kolNodes.map(n => ({
          ...n,
          kolWallet: n.id,
          walletAddress: n.id
        }));

        const kolKeyString = kolNodes.map(n => n.id).sort().join(',');
        let enhancedKOLs: EnhancedUnifiedNode[] = [];

        // Only re-process KOLs if the set has actually changed
        if (kolKeyString !== processedKOLsRef.current) {
          processedKOLsRef.current = kolKeyString;
          try {
            // Use the ref to avoid dependency on the hook's changing reference
            enhancedKOLs = await batchCreateRef.current(kolDataForHook);
          } catch (e) {
            console.warn("KOL batch processing failed, falling back to basic details. Error:", e);
            enhancedKOLs = [];
          }
        } else {
          // Same KOLs — skip re-processing, just return without updating processedData
          return;
        }

        if (!isMounted) return;

        const enhancedKOLMap = new Map(enhancedKOLs.map(k => [k.id, k]));

        // Capture current positions to prevent "explosions" on data updates
        const currentPositions = new Map<string, { x?: number; y?: number; vx?: number; vy?: number }>();
        if (simulationRef.current) {
          simulationRef.current.nodes().forEach(n => {
            currentPositions.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });
          });
        }

        const nodes: UnifiedNode[] = networkData.nodes.map(node => {
          const pos = currentPositions.get(node.id);

          if (node.type === 'token') {
            const solanaMetadata = tokenMetadataMap.get(node.id);
            const tokenData = getTokenByMint(node.id);
            // safe access
            const baseImg = node.image;

            const name = solanaMetadata?.name || tokenData?.name || node.name;
            const symbol = solanaMetadata?.symbol || tokenData?.symbol || node.label;
            const image = solanaMetadata?.logoURI || tokenData?.logoURI || baseImg;

            return {
              ...node, // default props first
              id: node.id,
              type: 'token',
              name: name || undefined,
              label: symbol || name || node.label,
              image: image || undefined,
              symbol: symbol || undefined,
              decimals: solanaMetadata?.decimals || tokenData?.decimals, // Decimals from blockchain data
              x: pos?.x,
              y: pos?.y,
              vx: pos?.vx,
              vy: pos?.vy
            } as UnifiedNode;
          } else {
            // KOL Node
            const enhanced = enhancedKOLMap.get(node.id);
            if (enhanced) {
              return {
                ...enhanced,
                id: node.id,
                type: 'kol',
                connections: node.connections,
                value: node.value,
                x: pos?.x,
                y: pos?.y,
                vx: pos?.vx,
                vy: pos?.vy
              } as UnifiedNode;
            }
            // Fallback
            const kolDetails = getKOL(node.id);
            return {
              ...node,
              id: node.id,
              type: 'kol',
              label: kolDetails?.name || node.label,
              name: kolDetails?.name || node.name || undefined,
              image: kolDetails?.avatar || node.image || undefined,
              x: pos?.x,
              y: pos?.y,
              vx: pos?.vx,
              vy: pos?.vy
            } as UnifiedNode;
          }
        });

        // Convert enhanced links to the format expected by the visualization
        const links: UnifiedLink[] = networkData.links.map(link => ({
          source: link.source,
          target: link.target,
          value: link.value,
          tradeCount: link.tradeCount,
          volume: link.volume,
        }));

        // Only update processedData if nodes actually changed (prevents redundant D3 restarts)
        setProcessedData(prev => {
          // Quick check: if same count and same node IDs, skip update
          if (prev.nodes.length === nodes.length && prev.links.length === links.length) {
            const prevIds = prev.nodes.map(n => n.id).join(',');
            const newIds = nodes.map(n => n.id).join(',');
            // Also check if images changed (metadata enrichment)
            const prevImages = prev.nodes.map(n => n.image || '').join(',');
            const newImages = nodes.map(n => n.image || '').join(',');
            if (prevIds === newIds && prevImages === newImages) {
              return prev;
            }
          }
          return { nodes, links };
        });
      };

      // Execute the async metadata processing
      processNodesWithMetadata().catch(error => {
        console.error('Failed to process nodes with metadata:', error);
        // Fallback to basic processing without metadata
        const currentPositions = new Map<string, { x?: number; y?: number; vx?: number; vy?: number }>();
        if (simulationRef.current) {
          simulationRef.current.nodes().forEach(n => {
            currentPositions.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });
          });
        }

        const nodes: UnifiedNode[] = networkData.nodes.map(node => ({
          ...currentPositions.get(node.id),
          id: node.id,
          type: node.type,
          label: node.label,
          name: node.name,
          image: node.image,
          value: node.value,
          connections: node.connections,
          totalVolume: node.totalVolume,
          tradeCount: node.tradeCount,
          influenceScore: node.influenceScore,
          isTrending: node.isTrending,
          tokenMint: node.tokenMint,
          relatedTokens: node.relatedTokens,
        }));

        const links: UnifiedLink[] = networkData.links.map(link => ({
          source: link.source,
          target: link.target,
          value: link.value,
          tradeCount: link.tradeCount,
          volume: link.volume,
        }));

        if (!isMounted) return;
        setProcessedData(prev => {
          // Prevent infinite loop if data hasn't meaningfully changed
          // We check counts and top node IDs as a proxy for meaningful change
          if (prev.nodes.length === nodes.length && prev.links.length === links.length) {
            const sameNodeIds = prev.nodes.every((n, i) => n.id === nodes[i].id);
            const sameLinkTargets = prev.links.length > 0 &&
              prev.links[0].target === links[0].target &&
              prev.links[0].source === links[0].source;

            if (sameNodeIds && sameLinkTargets) {
              return prev;
            }
          }
          return { nodes, links };
        });
      });
    } else {
      // Clear processed data when no filtered data is available
      setProcessedData(prev => {
        if (prev.nodes.length === 0 && prev.links.length === 0) return prev;
        return { nodes: [], links: [] };
      });
    }

    return () => { isMounted = false; };
  }, [debouncedFilteredData, activeTrendingTokens, isMobile, showSubscribedOnly, getTokenByMint, getKOL]);
  // NOTE: batchCreateRef and processedKOLsRef are refs, so they don't need to be in dependencies


  const isConnected = (
    nodeA: UnifiedNode,
    nodeB: UnifiedNode,
    links: UnifiedLink[]
  ): boolean => {
    return links.some(
      link =>
        (link.source === nodeA && link.target === nodeB) ||
        (link.source === nodeB && link.target === nodeA)
    );
  };

  const handleZoomIn = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .call(zoomRef.current.scaleBy, 1 / 1.5);
    }
  };

  const handleResetZoom = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  // Handle filter changes while maintaining WebSocket subscriptions
  const handleFilterChange = useCallback(
    (newShowSubscribedOnly: boolean) => {
      // Filter change requested - reduced logging for performance

      // Update the filter state
      setShowSubscribedOnly(newShowSubscribedOnly);

      // Clear selected node when changing filters to avoid stale selections
      setSelectedNode(null);

      // The WebSocket subscriptions are maintained by the useKOLTradeSocket hook
      // which already subscribes to both featured and subscribed KOLs
      // This ensures we don't lose real-time updates when switching between views
    },
    []
  );

  // Use real-time network statistics from filtering process
  const tokenCount = networkStats.totalTokens;
  const totalKOLs = networkStats.totalKOLs;
  const subscribedKOLs = networkStats.subscribedKOLs;

  // Calculate all KOLs from original data (but still exclude Solana base token)
  const solanaFilteredOriginal =
    dataFilterManager.filterSolanaBaseToken(activeTokensData);
  const allKOLs = new Set(
    Object.values(solanaFilteredOriginal).flatMap(data =>
      Object.keys(data.kolConnections || {})
    )
  ).size;

  // Enhanced empty state handling for subscribed-only view
  if (showSubscribedOnly && Object.keys(filteredTokensData).length === 0) {
    // Get more detailed information about why the view is empty
    const solanaFilteredOriginal =
      dataFilterManager.filterSolanaBaseToken(activeTokensData);
    const hasSubscriptions = subscriptions.length > 0;
    const activeSubscriptions = subscriptions.filter(
      sub => sub.isActive
    ).length;
    const hasActiveSubscribedKOLsInData = subscribedKOLs > 0;

    // Determine the specific reason for empty state
    let emptyStateReason = 'no-subscriptions';
    let emptyStateTitle = 'No Subscriptions Found';
    let emptyStateMessage = "You haven't subscribed to any KOLs yet.";

    if (hasSubscriptions && activeSubscriptions === 0) {
      emptyStateReason = 'no-active-subscriptions';
      emptyStateTitle = 'No Active Subscriptions';
      emptyStateMessage = 'All your KOL subscriptions are currently inactive.';
    } else if (
      hasSubscriptions &&
      activeSubscriptions > 0 &&
      !hasActiveSubscribedKOLsInData
    ) {
      emptyStateReason = 'subscribed-kols-not-trading';
      emptyStateTitle = 'Subscribed KOLs Not Trading';
      emptyStateMessage =
        "Your subscribed KOLs aren't currently trading the available tokens.";
    } else if (hasActiveSubscribedKOLsInData) {
      emptyStateReason = 'filtered-out';
      emptyStateTitle = 'No Valid Connections';
      emptyStateMessage =
        "Your subscribed KOLs' trades were filtered out due to low activity or connection strength.";
    }

    return (
      <div
        ref={containerRef}
        className={cn(
          'w-full h-full flex flex-col min-h-[300px] max-h-[600px]',
          className
        )}
      >
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
            <span className="text-xs text-muted-foreground/70">
              ({activeSubscriptions} active of {subscriptions.length}{' '}
              subscriptions)
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
              <span className="hidden xs:inline">Subscribed</span> (
              {subscribedKOLs})
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

        {/* Enhanced Empty State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 p-8 max-w-md">
            <div className="relative">
              <UserCheck className="h-16 w-16 text-muted-foreground mx-auto" />
              {emptyStateReason === 'no-active-subscriptions' && (
                <div className="absolute -top-1 -right-1 h-6 w-6 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white">!</span>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {emptyStateTitle}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {emptyStateMessage}
                {emptyStateReason === 'subscribed-kols-not-trading' && (
                  <span className="block mt-2 text-xs">
                    Try switching to "All KOLs" to see the full network, or
                    check back later when your subscribed KOLs are more active.
                  </span>
                )}
                {emptyStateReason === 'filtered-out' && (
                  <span className="block mt-2 text-xs">
                    This can happen when KOLs have very low trading volume or
                    weak connections. The filtering ensures you see only
                    meaningful trading relationships.
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => handleFilterChange(false)}
                className="flex-1 sm:flex-none"
              >
                <Users className="h-4 w-4 mr-2" />
                View All KOLs
              </Button>
              {emptyStateReason === 'no-subscriptions' && (
                <Button
                  variant="default"
                  onClick={() => {
                    // Navigate to KOLs page or open subscription modal
                    window.location.href = '/kols';
                  }}
                  className="flex-1 sm:flex-none"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Find KOLs
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'w-full h-full flex flex-col min-h-[300px]',
        className
      )}
    >
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
            {showSubscribedOnly && (
              <span className="text-xs">(subscribed)</span>
            )}
          </span>
          {/* Real-time update indicator */}
          <span className="flex items-center gap-1 text-xs">
            <Activity className="h-2.5 w-2.5 text-green-500" />
            <span className="text-muted-foreground/70" suppressHydrationWarning>
              {formatDistanceToNow(networkStats.lastUpdate, {
                addSuffix: true,
              })}
            </span>
          </span>
        </div>

        <div className="flex items-center justify-center gap-1 overflow-x-auto pb-1">
          {/* KOL Filter Toggle with real-time updates */}
          <Button
            variant={showSubscribedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange(true)}
            className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs flex-shrink-0"
            disabled={subscriptions.filter(s => s.isActive).length === 0}
          >
            <UserCheck className="h-3 w-3 mr-1" />
            <span className="hidden xs:inline">Subscribed</span> (
            {subscribedKOLs})
          </Button>
          <Button
            variant={!showSubscribedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange(false)}
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              className="h-6 w-6 sm:h-7 sm:w-7 p-0"
            >
              <ZoomIn className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              className="h-6 w-6 sm:h-7 sm:w-7 p-0"
            >
              <ZoomOut className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetZoom}
              className="h-6 w-6 sm:h-7 sm:w-7 p-0"
            >
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
            background: 'transparent',
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
              <div
                className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border border-white flex items-center justify-center"
                style={{
                  background:
                    'linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)',
                }}
              >
                <UserCheck className="h-1 w-1 sm:h-1.5 sm:w-1.5 text-white" />
              </div>
              <span className="text-muted-foreground text-xs">KOLs</span>
            </div>
          </div>
        </div>

        {/* Interaction Error Display */}
        {interactionErrors.length > 0 && (
          <div className="absolute top-1 left-1 z-50 space-y-2">
            {interactionErrors.map((error, index) => (
              <div
                key={index}
                className="bg-red-500/10 border border-red-500/20 text-red-500 p-2 rounded-lg shadow-lg animate-in slide-in-from-left-5 max-w-xs"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3" />
                  <span className="text-xs font-medium">Interaction Error</span>
                </div>
                <div className="text-xs mt-1 opacity-80">{error.message}</div>
              </div>
            ))}
          </div>
        )}

        {/* Enhanced Selected Node Info */}
        {selectedNode && (
          <DetailedInfoPanel
            node={selectedNode}
            connections={processedData.links}
            onClose={() => setSelectedNode(null)}
            onError={handleInteractionError}
            className="sm:absolute sm:top-2 sm:right-2 z-50"
          />
        )}

        {/* Desktop-only Interactive Guide - Hidden on Mobile */}
        {/* <div className="hidden lg:block absolute bottom-2 left-2 p-2 bg-card/90 border border-border rounded-md shadow-sm text-xs text-muted-foreground max-w-48">
          <div className="font-semibold text-foreground mb-1 flex items-center gap-1">
            <Lightbulb className="h-3 w-3" />
            <span>Tips</span>
          </div>
          <div className="space-y-0.5">
            <div>
              • <strong>Drag</strong> nodes to reposition
            </div>
            <div>
              • <strong>Hover</strong> for quick details
            </div>
            <div>
              • <strong>Click</strong> to select
            </div>
            <div className="flex items-center gap-1">
              • <CircleDollarSign className="h-2.5 w-2.5" />{' '}
              <strong>Tokens</strong> = larger with more connections
            </div>
            <div className="flex items-center gap-1">
              • <UserCheck className="h-2.5 w-2.5" /> <strong>KOLs</strong> =
              dashed border, size by influence
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default UnifiedKOLMindmap;