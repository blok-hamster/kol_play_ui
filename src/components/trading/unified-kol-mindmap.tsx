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
import { MindmapUpdate } from '@/hooks/use-kol-trade-socket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Search,
  Table as TableIcon,
  RefreshCw,
  Filter,
  ChevronDown,
  Settings,
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
import { useKOLTradeSocket } from '@/hooks/use-kol-trade-socket';

interface UnifiedNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'token' | 'kol';
  label: string;
  name?: string; // Display name for tokens/KOLs
  image?: string; // Image URL for tokens/KOLs
  symbol?: string; // Token symbol
  decimals?: number; // Token decimals
  metadataUri?: string; // Token metadata URI
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
  className,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const { isSubscribedToKOL, subscriptions } = useSubscriptions();
  const { getKOL, loadAllKOLs } = useKOLStore();
  const { getTokenByMint } = useTokenStore();
  const { recentTrades } = useKOLTradeSocket();

  // Track subscription changes for real-time updates
  const previousSubscriptionsRef = useRef<typeof subscriptions>([]);
  const enhancedKOLNodes = useEnhancedKOLNodes({
    enableProgressiveLoading: true,
    batchSize: 6,
    maxConcurrentRequests: 2,
  });

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

  // Auto-refresh functionality
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      setIsRefreshing(true);
      setLastRefresh(new Date());
      
      // Trigger a refresh by updating network stats
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(refreshInterval);
  }, []);

  // Manual refresh function
  const handleManualRefresh = useCallback(() => {
    setIsRefreshing(true);
    setLastRefresh(new Date());
    
    // Force re-fetch of data
    loadAllKOLs().finally(() => {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    });
  }, [loadAllKOLs]);
  const [selectedNode, setSelectedNode] = useState<UnifiedNode | null>(null);
  const [highlightMode, setHighlightMode] = useState<
    'none' | 'trending' | 'high-volume'
  >('none');
  const [showSubscribedOnly, setShowSubscribedOnly] = useState(false);
  const [dimensions, setDimensions] = useState({ width, height });
  const [networkStats, setNetworkStats] = useState({
    totalTokens: 0,
    totalKOLs: 0,
    subscribedKOLs: 0,
    filteredTokens: 0,
    lastUpdate: new Date(),
  });
  const [interactionErrors, setInteractionErrors] = useState<Error[]>([]);
  const [processedData, setProcessedData] = useState<{
    nodes: UnifiedNode[];
    links: UnifiedLink[];
  }>({ nodes: [], links: [] });
  
  // New state for enhanced features
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'mindmap' | 'table'>('mindmap');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  
  // Enhanced filtering state
  const [selectedKOLs, setSelectedKOLs] = useState<Set<string>>(new Set());
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'none' | 'kols' | 'tokens'>('none');
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);


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
      // Subscription changes detected - reduced logging for performance

      // Update the ref for next comparison
      previousSubscriptionsRef.current = [...currentSubscriptions];

      // If we're in subscribed-only mode and subscriptions changed,
      // we might need to update WebSocket subscriptions
      if (showSubscribedOnly) {
        // This will be handled by the WebSocket hook when it detects subscription changes
        // Subscribed-only mode active - reduced logging for performance
      }
    } else if (previousSubscriptions.length === 0) {
      // Initial load, just update the ref
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

  // Enhanced filtering with metadata preservation and relationship validation
  const filteredTokensData = useMemo(() => {
    // Step 1: Filter out Solana base token while preserving metadata
    const solanaFiltered = dataFilterManager.filterSolanaBaseToken(tokensData);

    // Step 2: Apply subscription filtering with enhanced metadata support
    const subscriptionFiltered = dataFilterManager.filterBySubscriptionStatus(
      solanaFiltered,
      showSubscribedOnly,
      isSubscribedToKOL
    );

    // Step 3: Validate token-KOL relationships to ensure meaningful connections
    const relationshipValidated =
      dataFilterManager.validateTokenKOLRelationships(subscriptionFiltered, {
        preserveMetadata: true,
        validateConnections: true,
        minConnectionStrength: 0.1,
      });

    // Step 4: Optimize network data by removing isolated nodes
    const optimized = dataFilterManager.optimizeNetworkData(
      relationshipValidated
    );

    // Enhanced data filtering complete - reduced logging for performance

    return optimized;
  }, [tokensData, showSubscribedOnly]);

  // Calculate network statistics separately to avoid re-render loops
  useEffect(() => {
    const stats = dataFilterManager.getFilteringStats(
      tokensData,
      filteredTokensData
    );
    const metadataStats =
      dataFilterManager.getMetadataStats(filteredTokensData);

    const newTotalTokens = Object.keys(filteredTokensData).length;
    const newTotalKOLs = new Set(
      Object.values(filteredTokensData).flatMap(data =>
        Object.keys(data.kolConnections || {})
      )
    ).size;
    const newSubscribedKOLs = new Set(
      Object.values(filteredTokensData).flatMap(data =>
        Object.keys(data.kolConnections || {}).filter(kolWallet =>
          isSubscribedToKOL(kolWallet)
        )
      )
    ).size;
    const newFilteredTokens = stats.tokensFiltered;

    // Only update state if the values have actually changed
    setNetworkStats(prevStats => {
      if (
        prevStats.totalTokens !== newTotalTokens ||
        prevStats.totalKOLs !== newTotalKOLs ||
        prevStats.subscribedKOLs !== newSubscribedKOLs ||
        prevStats.filteredTokens !== newFilteredTokens
      ) {
        return {
          totalTokens: newTotalTokens,
          totalKOLs: newTotalKOLs,
          subscribedKOLs: newSubscribedKOLs,
          filteredTokens: newFilteredTokens,
          lastUpdate: new Date(),
        };
      }
      return prevStats; // No change, return previous state
    });

    // Network stats updated - reduced logging for performance
  }, [filteredTokensData, isSubscribedToKOL, tokensData]);

  // Handle interaction errors
  const handleInteractionError = useCallback((error: Error) => {
    console.error('Mindmap interaction error:', error);
    setInteractionErrors(prev => [...prev, error]);

    // Auto-remove error after 5 seconds
    setTimeout(() => {
      setInteractionErrors(prev => prev.filter(e => e !== error));
    }, 5000);
  }, []);

  // Enhanced search and filtering functionality with connected nodes
  const filteredNodes = useMemo(() => {
    let nodes = processedData.nodes;
    
    // Apply search filter first
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchingNodes = new Set<string>();
      
      // First pass: Find directly matching nodes
      nodes.forEach(node => {
        const searchableText = [
          node.name,
          node.symbol,
          node.label,
          node.id,
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (searchableText.includes(query)) {
          matchingNodes.add(node.id);
        }
      });
      
      // Second pass: For matching KOLs, include their connected tokens
      // For matching tokens, include their connected KOLs
      const connectedNodes = new Set(matchingNodes);
      
      matchingNodes.forEach(nodeId => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        // Find all connections for this node
        processedData.links.forEach(link => {
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
          const targetId = typeof link.target === 'object' ? link.target.id : link.target;
          
          if (sourceId === nodeId) {
            connectedNodes.add(targetId);
          } else if (targetId === nodeId) {
            connectedNodes.add(sourceId);
          }
        });
      });
      
      nodes = nodes.filter(node => connectedNodes.has(node.id));
    }
    
    // Apply KOL/Token filtering
    if (filterMode === 'kols' && selectedKOLs.size > 0) {
      const filteredNodeIds = new Set<string>();
      
      // Include selected KOLs
      selectedKOLs.forEach(kolId => {
        filteredNodeIds.add(kolId);
      });
      
      // Include all tokens connected to selected KOLs
      processedData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        if (selectedKOLs.has(sourceId)) {
          const targetNode = nodes.find(n => n.id === targetId);
          if (targetNode?.type === 'token') {
            filteredNodeIds.add(targetId);
          }
        } else if (selectedKOLs.has(targetId)) {
          const sourceNode = nodes.find(n => n.id === sourceId);
          if (sourceNode?.type === 'token') {
            filteredNodeIds.add(sourceId);
          }
        }
      });
      
      nodes = nodes.filter(node => filteredNodeIds.has(node.id));
    } else if (filterMode === 'tokens' && selectedTokens.size > 0) {
      const filteredNodeIds = new Set<string>();
      
      // Include selected tokens
      selectedTokens.forEach(tokenId => {
        filteredNodeIds.add(tokenId);
      });
      
      // Include all KOLs connected to selected tokens
      processedData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        if (selectedTokens.has(sourceId)) {
          const targetNode = nodes.find(n => n.id === targetId);
          if (targetNode?.type === 'kol') {
            filteredNodeIds.add(targetId);
          }
        } else if (selectedTokens.has(targetId)) {
          const sourceNode = nodes.find(n => n.id === sourceId);
          if (sourceNode?.type === 'kol') {
            filteredNodeIds.add(sourceId);
          }
        }
      });
      
      nodes = nodes.filter(node => filteredNodeIds.has(node.id));
    }
    
    return nodes;
  }, [processedData.nodes, processedData.links, searchQuery, filterMode, selectedKOLs, selectedTokens]);

  // Filter links based on filtered nodes (including connected nodes)
  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) return processedData.links;
    
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    return processedData.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
    });
  }, [processedData.links, filteredNodes, searchQuery]);

  // Define the render function first
  const renderUnifiedMindmap = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width: svgWidth, height: svgHeight } = dimensions;

    // Create container for zoom/pan
    const container = svg.append('g');

    // Set up zoom behavior
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', event => {
        container.attr('transform', event.transform);
      });

    svg.call(zoomBehavior);
    zoomRef.current = zoomBehavior;

    // Use filtered data for rendering
    const nodes = filteredNodes;
    const links = filteredLinks;

    // Don't render if no data is available
    if (nodes.length === 0) {
      // Show empty state message in the SVG
      const emptyMessage = svg.append('g')
        .attr('class', 'empty-state')
        .attr('transform', `translate(${svgWidth / 2}, ${svgHeight / 2})`);
      
      emptyMessage.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-10')
        .attr('fill', '#6b7280')
        .attr('font-size', '16px')
        .attr('font-weight', '600')
        .text('No data to display');
      
      emptyMessage.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '15')
        .attr('fill', '#9ca3af')
        .attr('font-size', '14px')
        .text(() => {
          if (searchQuery) {
            return `No results for "${searchQuery}"`;
          } else if (filterMode === 'kols' && selectedKOLs.size === 0) {
            return 'Select KOLs to view their connections';
          } else if (filterMode === 'tokens' && selectedTokens.size === 0) {
            return 'Select tokens to view their connections';
          } else {
            return 'Try adjusting your filters';
          }
        });
      
      return;
    }

    // Create enhanced tooltip using React component
    const tooltipContainer = d3
      .select('body')
      .append('div')
      .attr('class', 'fixed z-50 opacity-0 pointer-events-none')
      .style('transition', 'opacity 0.2s');

    // Add click handler to SVG background to clear selection
    svg.on('click', event => {
      // Only clear selection if clicking on the background (not on nodes)
      if (event.target === event.currentTarget) {
        setSelectedNode(null);
        tooltipContainer.style('opacity', 0);
      }
    });

    // App's accent gradient colors
    const accentFrom = '#14F195';
    const accentTo = '#9945FF';

    // Create color scales using app's design system
    const tokenColorScale = d3
      .scaleSequential(d3.interpolateRgb(accentFrom, accentTo))
      .domain([
        0,
        d3.max(
          nodes.filter(n => n.type === 'token'),
          d => d.connections
        ) || 1,
      ]);

    const kolColorScale = d3
      .scaleSequential(d3.interpolateRgb('#FF6B6B', '#4ECDC4'))
      .domain([
        0,
        d3.max(
          nodes.filter(n => n.type === 'kol'),
          d => d.influenceScore || 0
        ) || 100,
      ]);

    // Create simulation with enhanced forces and position stability
    const simulation = d3
      .forceSimulation<UnifiedNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<UnifiedNode, UnifiedLink>(links)
          .id(d => d.id)
          .distance(d => {
            // Dynamic link distance based on connection strength
            const baseDistance = 120;
            const strengthFactor = Math.log(d.tradeCount + 1) * 20;
            return Math.max(80, baseDistance - strengthFactor);
          })
          .strength(0.3)
      )
      .force(
        'charge',
        d3.forceManyBody().strength(d => {
          // Stronger repulsion for nodes with more connections
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

    // Apply saved positions to maintain stability
    let hasStablePositions = true;
    nodes.forEach(node => {
      const savedPosition = nodePositions.get(node.id);
      if (savedPosition) {
        node.x = savedPosition.x;
        node.y = savedPosition.y;
        // Only fix positions if we have a complete set of stable positions
        if (hasStablePositions) {
          node.fx = savedPosition.x;
          node.fy = savedPosition.y;
        }
      } else {
        hasStablePositions = false;
      }
    });

    // If we have stable positions, reduce simulation iterations
    if (hasStablePositions) {
      simulation.alpha(0.1).alphaDecay(0.1);
    }

    // Save positions when simulation stabilizes
    let positionSaveTimeout: NodeJS.Timeout;
    simulation.on('tick', () => {
      clearTimeout(positionSaveTimeout);
      positionSaveTimeout = setTimeout(() => {
        const newPositions = new Map();
        nodes.forEach(node => {
          if (node.x !== undefined && node.y !== undefined) {
            newPositions.set(node.id, { x: node.x, y: node.y });
          }
        });
        setNodePositions(newPositions);
      }, 1000); // Save positions 1 second after last movement
    });

    // Create link elements with app's accent gradient
    const defs = svg.append('defs');

    // Create gradient for each link using app's accent colors
    links.forEach((link, i) => {
      const gradient = defs
        .append('linearGradient')
        .attr('id', `linkGradient${i}`)
        .attr('gradientUnits', 'userSpaceOnUse');

      gradient
        .append('stop')
        .attr('offset', '0%')
        .attr('stop-color', accentFrom);

      gradient
        .append('stop')
        .attr('offset', '100%')
        .attr('stop-color', accentTo);
    });

    const linkGroup = container.append('g').attr('class', 'links');
    const link = linkGroup
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', (d, i) => `url(#linkGradient${i})`)
      .attr('stroke-opacity', d =>
        Math.min(0.7, Math.log(d.tradeCount + 1) * 0.15)
      )
      .attr('stroke-width', d => Math.max(1.5, Math.sqrt(d.tradeCount) * 0.8))
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        try {
          // Highlight the connection on hover
          d3.select(event.currentTarget)
            .attr('stroke-opacity', 0.9)
            .attr('stroke-width', Math.max(3, Math.sqrt(d.tradeCount) * 1.2));

          // Show connection tooltip
          const rect = svgRef.current?.getBoundingClientRect();
          const mouseX = event.pageX || (rect ? rect.left + event.offsetX : 0);
          const mouseY = event.pageY || (rect ? rect.top + event.offsetY : 0);

          const sourceNode =
            typeof d.source === 'object'
              ? d.source
              : nodes.find(n => n.id === d.source);
          const targetNode =
            typeof d.target === 'object'
              ? d.target
              : nodes.find(n => n.id === d.target);

          if (sourceNode && targetNode) {
            const tooltipContent = React.createElement(ConnectionTooltip, {
              link: d,
              sourceNode,
              targetNode,
            });

            tooltipManager.showTooltip(
              tooltipContent,
              { x: mouseX + 10, y: mouseY - 10 },
              150
            );
          }
        } catch (error) {
          handleInteractionError(error as Error);
        }
      })
      .on('mouseout', (event, d) => {
        try {
          // Reset connection appearance
          d3.select(event.currentTarget)
            .attr(
              'stroke-opacity',
              Math.min(0.7, Math.log(d.tradeCount + 1) * 0.15)
            )
            .attr('stroke-width', Math.max(1.5, Math.sqrt(d.tradeCount) * 0.8));

          // Hide connection tooltip
          tooltipManager.hideTooltip();
        } catch (error) {
          handleInteractionError(error as Error);
        }
      })
      .on('click', (event, d) => {
        try {
          event.preventDefault();
          event.stopPropagation();

          // Highlight both connected nodes
          const sourceId =
            typeof d.source === 'object' ? d.source.id : d.source;
          const targetId =
            typeof d.target === 'object' ? d.target.id : d.target;

          nodeSelection.style('opacity', node =>
            node.id === sourceId || node.id === targetId ? 1 : 0.3
          );

          // Highlight only this connection
          link.style('opacity', l => (l === d ? 0.9 : 0.1));
        } catch (error) {
          handleInteractionError(error as Error);
        }
      });

    // Create node groups
    const nodeGroup = container.append('g').attr('class', 'nodes');
    const nodeSelection = nodeGroup
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer');

    // Declare labelGroup in outer scope for simulation access
    let labelGroup: d3.Selection<SVGGElement, unknown, null, undefined>;

    // Enhanced rendering with proper token image and name display
    try {
      console.log('Using enhanced rendering with token images and names');

      // Add circular clipping path for avatars and token images
      const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
      
      // Create background circles for all nodes first
      nodeSelection
        .append('circle')
        .attr('r', d => {
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
        })
        .attr('fill', d => {
          // For KOL nodes with images, make background transparent
          if (d.type === 'kol' && d.image) {
            return 'transparent';
          }
          // For token nodes with images, use a subtle background
          if (d.type === 'token' && d.image) {
            return '#ffffff20'; // Very subtle white background for tokens
          }
          
          if (highlightMode === 'trending' && d.isTrending) {
            return accentFrom;
          }
          if (highlightMode === 'high-volume' && (d.totalVolume || 0) > 100) {
            return accentTo;
          }

          if (d.type === 'token') {
            return d.isTrending ? accentFrom : tokenColorScale(d.connections);
          } else {
            return kolColorScale(d.influenceScore || 0);
          }
        })
        .attr('fill-opacity', d => d.image ? (d.type === 'kol' ? 0 : 0.3) : 0.7)
        .attr('stroke', d => {
          if (d.type === 'kol') {
            // Use a subtle border for KOL nodes, more visible for those with images
            return d.image ? '#ffffff80' : '#ffffff';
          }
          return 'none';
        })
        .attr('stroke-width', d => d.type === 'kol' ? (d.image ? 1.5 : 2) : 0)
        .style('filter', d => {
          if (d.type === 'token' && d.connections > 5) {
            return `drop-shadow(0 0 12px ${accentTo}40)`;
          }
          if (d.type === 'kol' && (d.influenceScore || 0) > 70) {
            return `drop-shadow(0 0 15px #FF6B6B60)`;
          }
          return 'none';
        });

      // Add token images for token nodes that have them
      nodeSelection
        .filter(d => d.type === 'token' && d.image)
        .each(function(d, i) {
          const node = d3.select(this);
          const baseSize = 20;
          const connectionBonus = Math.sqrt(d.connections) * 7;
          const volumeBonus = Math.log(d.totalVolume || 1) * 2.5;
          const radius = Math.min(55, baseSize + connectionBonus + volumeBonus);
          const imageSize = radius * 1.8; // Slightly larger to fill the circle better
          
          // Create unique clip path for this token node
          const clipId = `token-clip-${i}`;
          defs.append('clipPath')
            .attr('id', clipId)
            .append('circle')
            .attr('r', radius - 2); // Slightly smaller than the background circle
          
          // Add the token image with circular clipping
          node.append('image')
            .attr('href', d.image!)
            .attr('x', -imageSize / 2)
            .attr('y', -imageSize / 2)
            .attr('width', imageSize)
            .attr('height', imageSize)
            .attr('clip-path', `url(#${clipId})`)
            .style('pointer-events', 'none')
            .on('error', function() {
              // Hide the image if it fails to load and show fallback
              d3.select(this).style('display', 'none');
              console.warn('Failed to load token image:', d.image);
            });
        });

      // Add avatar images for KOL nodes that have them
      nodeSelection
        .filter(d => d.type === 'kol' && d.image)
        .each(function(d, i) {
          const node = d3.select(this);
          const baseSize = 14;
          const influenceBonus = Math.sqrt(d.influenceScore || 0) * 2.2;
          const tradeBonus = Math.sqrt(d.tradeCount || 0) * 1.5;
          const radius = Math.min(40, baseSize + influenceBonus + tradeBonus);
          const imageSize = radius * 1.8; // Slightly larger to fill the circle better
          
          // Create unique clip path for this KOL node
          const clipId = `kol-clip-${i}`;
          defs.append('clipPath')
            .attr('id', clipId)
            .append('circle')
            .attr('r', radius - 2); // Slightly smaller than the background circle
          
          // Add the KOL image with circular clipping
          node.append('image')
            .attr('href', d.image!)
            .attr('x', -imageSize / 2)
            .attr('y', -imageSize / 2)
            .attr('width', imageSize)
            .attr('height', imageSize)
            .attr('clip-path', `url(#${clipId})`)
            .style('pointer-events', 'none')
            .on('error', function() {
              // Hide the image if it fails to load
              d3.select(this).style('display', 'none');
              console.warn('Failed to load KOL image:', d.image);
            });
        });

      // Add distinctive inner pattern for KOL nodes without images
      nodeSelection
        .filter(d => d.type === 'kol' && !d.image)
        .append('circle')
        .attr('r', d => {
          const baseSize = 14;
          const influenceBonus = Math.sqrt(d.influenceScore || 0) * 2.2;
          const tradeBonus = Math.sqrt(d.tradeCount || 0) * 1.5;
          return Math.min(40, baseSize + influenceBonus + tradeBonus) * 0.6;
        })
        .attr('fill', 'none')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,2')
        .attr('opacity', 0.8);

      // Add inner circles for tokens without images
      nodeSelection
        .filter(d => d.type === 'token' && !d.image)
        .append('circle')
        .attr('r', d => Math.max(8, Math.sqrt(d.connections) * 3))
        .attr('fill', '#ffffff')
        .attr('fill-opacity', 0.25)
        .attr('stroke', 'none');

      // Add enhanced labels for all nodes with names/symbols
      labelGroup = container.append('g').attr('class', 'enhanced-labels');
      labelGroup
        .selectAll('text')
        .data(nodes.filter(d => 
          // Show labels for tokens with symbol/name or KOLs with names
          (d.type === 'token' && (d.symbol || d.name)) ||
          (d.type === 'kol' && d.name)
        ))
        .enter()
        .append('text')
        .text(d => {
          if (d.type === 'token') {
            // For tokens, prioritize symbol over name for display
            if (d.symbol && d.symbol.length <= 8) {
              return d.symbol;
            } else if (d.symbol) {
              return d.symbol.substring(0, 6) + '...';
            } else if (d.name && d.name.length <= 10) {
              return d.name;
            } else if (d.name) {
              return d.name.substring(0, 8) + '...';
            } else {
              return `${d.id.slice(0, 6)}...`;
            }
          } else {
            // For KOLs, show name if available and short enough
            if (d.name && d.name.length <= 12) {
              return d.name;
            } else if (d.name) {
              return d.name.substring(0, 10) + '...';
            } else {
              return `${d.id.slice(0, 6)}...`;
            }
          }
        })
        .attr('font-size', d => {
          // Responsive font sizing based on node importance
          if (d.type === 'token' && d.connections > 5) {
            return '13px';
          } else if (d.type === 'kol' && (d.influenceScore || 0) > 70) {
            return '12px';
          }
          return '11px';
        })
        .attr('font-family', 'Darker Grotesque, sans-serif')
        .attr('font-weight', '700')
        .attr('text-anchor', 'middle')
        .attr('dy', d => {
          const radius = d.type === 'token'
            ? Math.min(55, 20 + Math.sqrt(d.connections) * 7 + Math.log(d.totalVolume || 1) * 2.5)
            : Math.min(40, 14 + Math.sqrt(d.influenceScore || 0) * 2.2 + Math.sqrt(d.tradeCount || 0) * 1.5);
          return radius + 16; // Optimal spacing for readability
        })
        .attr('fill', '#ffffff')
        .attr('stroke', '#000000')
        .attr('stroke-width', '3px')
        .attr('stroke-linejoin', 'round')
        .attr('paint-order', 'stroke')
        .style('pointer-events', 'none')
        .style('user-select', 'none');
    } catch (error) {
      console.error('Failed to render nodes with enhanced rendering:', error);
      // Fallback to basic rendering with token names
      nodeSelection
        .append('circle')
        .attr('r', d => d.type === 'token' ? 20 : 14)
        .attr('fill', d => d.type === 'token' ? accentFrom : kolColorScale(d.influenceScore || 0))
        .attr('fill-opacity', 0.7);
      
      // Add basic labels even in fallback mode
      labelGroup = container.append('g').attr('class', 'basic-fallback-labels');
      labelGroup
        .selectAll('text')
        .data(nodes.filter(d => 
          // Only show labels for nodes with meaningful names/symbols
          (d.type === 'token' && (d.symbol || d.name)) ||
          (d.type === 'kol' && d.name)
        ))
        .enter()
        .append('text')
        .text(d => {
          if (d.type === 'token') {
            // Prioritize symbol for tokens
            return d.symbol || d.name || `${d.id.slice(0, 6)}...`;
          } else {
            return d.name || `${d.id.slice(0, 6)}...`;
          }
        })
        .attr('font-size', '11px')
        .attr('font-family', 'Darker Grotesque, sans-serif')
        .attr('font-weight', '700')
        .attr('text-anchor', 'middle')
        .attr('dy', d => (d.type === 'token' ? 20 : 14) + 16)
        .attr('fill', '#ffffff')
        .attr('stroke', '#000000')
        .attr('stroke-width', '3px')
        .attr('stroke-linejoin', 'round')
        .attr('paint-order', 'stroke')
        .style('pointer-events', 'none');
    }

    // Labels are now handled by the enhanced node renderer
    // This prevents duplicate labels on KOL nodes

    // Enhanced drag behavior with click detection
    let isDragging = false;
    let dragStartTime = 0;

    // Enhanced interactions using the new tooltip and interaction system
    const tooltipManager = TooltipManager.getInstance();
    let hoverTimeout: NodeJS.Timeout | null = null;
    let clickTimeout: NodeJS.Timeout | null = null;

    nodeSelection
      .on('mouseover', (event, d) => {
        // Clear any pending hover timeout
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
        }

        // Don't show hover tooltip if there's already a selected node
        if (selectedNode) {
          return;
        }

        // Get mouse position relative to the page
        const rect = svgRef.current?.getBoundingClientRect();
        const mouseX = event.pageX || (rect ? rect.left + event.offsetX : 0);
        const mouseY = event.pageY || (rect ? rect.top + event.offsetY : 0);

        // Debounce hover to prevent flickering
        hoverTimeout = setTimeout(() => {
          try {
            // Highlight connected nodes and links
            nodeSelection.style('opacity', node =>
              node === d || isConnected(node, d, links) ? 1 : 0.3
            );
            link.style('opacity', l =>
              l.source === d || l.target === d ? 0.8 : 0.1
            );

            // Show enhanced tooltip based on node type
            const tooltipContent =
              d.type === 'token'
                ? React.createElement(TokenTooltip, { node: d })
                : React.createElement(KOLTooltip, { node: d });

            tooltipManager.showTooltip(
              tooltipContent,
              { x: mouseX + 10, y: mouseY - 10 },
              100
            );
          } catch (error) {
            handleInteractionError(error as Error);
          }
        }, 50);
      })
      .on('mousemove', event => {
        try {
          // Update tooltip position on mouse move
          const rect = svgRef.current?.getBoundingClientRect();
          const mouseX = event.pageX || (rect ? rect.left + event.offsetX : 0);
          const mouseY = event.pageY || (rect ? rect.top + event.offsetY : 0);

          tooltipManager.updatePosition({ x: mouseX + 10, y: mouseY - 10 });
        } catch (error) {
          handleInteractionError(error as Error);
        }
      })
      .on('mouseout', () => {
        // Clear hover timeout
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }

        // Only clear hover state if no node is selected
        if (!selectedNode) {
          setTimeout(() => {
            try {
              tooltipManager.hideTooltip();

              // Reset highlighting
              nodeSelection.style('opacity', 1);
              link.style('opacity', d =>
                Math.min(0.7, Math.log(d.tradeCount + 1) * 0.15)
              );
            } catch (error) {
              handleInteractionError(error as Error);
            }
          }, 50);
        }
      })
      .on('click', (event, d) => {
        // Clear any pending click timeout
        if (clickTimeout) {
          clearTimeout(clickTimeout);
        }

        // Ignore click if we were dragging
        if (isDragging) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        // Debounce click to prevent rapid state changes
        clickTimeout = setTimeout(() => {
          try {
            // Hide hover tooltip when clicking
            tooltipManager.hideTooltip();

            // Reset highlighting when selecting a node
            nodeSelection.style('opacity', 1);
            link.style('opacity', d =>
              Math.min(0.7, Math.log(d.tradeCount + 1) * 0.15)
            );

            // Use a more stable selection logic
            setSelectedNode(prevSelected => {
              if (prevSelected?.id === d.id) {
                return null; // Deselect if clicking the same node
              }
              return { ...d }; // Create a new object to ensure state change
            });
          } catch (error) {
            handleInteractionError(error as Error);
          }
        }, 50);
      })
      .call(
        d3
          .drag<SVGGElement, UnifiedNode>()
          .on('start', (event, d) => {
            isDragging = false;
            dragStartTime = Date.now();

            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            // Mark as dragging if moved more than a few pixels or dragging for more than 100ms
            if (
              !isDragging &&
              (Math.abs(event.dx) > 3 ||
                Math.abs(event.dy) > 3 ||
                Date.now() - dragStartTime > 100)
            ) {
              isDragging = true;
            }

            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
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
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as UnifiedNode).x!)
        .attr('y1', d => (d.source as UnifiedNode).y!)
        .attr('x2', d => (d.target as UnifiedNode).x!)
        .attr('y2', d => (d.target as UnifiedNode).y!);

      nodeSelection.attr('transform', d => `translate(${d.x},${d.y})`);

      // Update labels if they exist
      if (labelGroup && !labelGroup.empty()) {
        labelGroup
          .selectAll('text')
          .attr('x', d => (d as UnifiedNode).x!)
          .attr('y', d => (d as UnifiedNode).y!);
      }
    });

    // Cleanup function
    return () => {
      tooltipContainer.remove();
    };
  }, [dimensions, filteredNodes, filteredLinks, handleInteractionError, highlightMode, selectedNode, nodePositions]);

  // Now add the useEffect that uses the render function
  useEffect(() => {
    if (
      !svgRef.current ||
      processedData.nodes.length === 0 ||
      dimensions.width === 0 ||
      dimensions.height === 0
    ) {
      return;
    }

    // Add a small delay to prevent rapid re-renders during state changes
    const renderTimeout = setTimeout(() => {
      try {
        // Check if SVG is already being rendered to prevent overlapping renders
        const svg = d3.select(svgRef.current);
        if (svg.select('.rendering-in-progress').size() > 0) {
          return; // Skip if already rendering
        }

        // Mark as rendering
        svg
          .append('g')
          .attr('class', 'rendering-in-progress')
          .style('display', 'none');

        renderUnifiedMindmap();

        // Remove rendering marker
        svg.select('.rendering-in-progress').remove();
      } catch (error) {
        console.error('Failed to render unified mindmap:', error);
        // Clean up rendering marker on error
        const svg = d3.select(svgRef.current);
        svg.select('.rendering-in-progress').remove();
      }
    }, 100); // Increased delay to prevent rapid re-renders

    return () => {
      clearTimeout(renderTimeout);
    };
  }, [filteredNodes, filteredLinks, dimensions.width, dimensions.height, highlightMode, showSubscribedOnly, viewMode]);

  // Handle recent trades updates with debouncing to prevent infinite loops
  const recentTradesRef = useRef(recentTrades);
  useEffect(() => {
    recentTradesRef.current = recentTrades;
  }, [recentTrades]);

  // Process unified data and update state
  useEffect(() => {
    // Determine device-specific limits for performance optimization
    const isMobile = dimensions.width < 768;
    const deviceLimits = {
      maxNodes: isMobile ? 50 : 200,
      maxLinks: isMobile ? 100 : 500,
    };

    if (Object.keys(filteredTokensData).length > 0) {
      // Use the data filtering manager to process unified network data
      const networkData = dataFilterManager.processUnifiedData(
        filteredTokensData,
        trendingTokens,
        deviceLimits
      );

      // Process nodes with enhanced metadata fetching
      const processNodesWithMetadata = async () => {
        // Extract token mint addresses for batch metadata fetching
        const tokenMints = networkData.nodes
          .filter(node => node.type === 'token')
          .map(node => node.id);

        // First, collect token metadata from recent trades (real-time data)
        const tradeMetadataMap = new Map();
        recentTradesRef.current.forEach(trade => {
          if (trade.tradeData && trade.tradeData.mint) {
            const { mint, name, symbol, image, metadataUri } = trade.tradeData;
            
            // Only store if we have meaningful metadata
            if (name || symbol || image) {
              tradeMetadataMap.set(mint, {
                name: name || undefined,
                symbol: symbol || undefined,
                logoURI: image || undefined,
                metadataUri: metadataUri || undefined,
                decimals: undefined, // This will be filled by SolanaService
              });
            }
          }
        });

        // Fetch token metadata in batch using SolanaService
        let tokenMetadataMap = new Map();
        if (tokenMints.length > 0) {
          try {
            tokenMetadataMap = await SolanaService.fetchTokenMetadataBatch(tokenMints);
          } catch (error) {
            console.warn('Failed to fetch token metadata batch:', error);
          }
        }

        const nodes: UnifiedNode[] = networkData.nodes.map(node => {
          const baseNode = {
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
          };

          // Enhance token nodes with metadata from multiple sources
          if (node.type === 'token') {
            // Priority order: Recent trades > SolanaService (Jupiter) > Token store > Base node
            const tradeMetadata = tradeMetadataMap.get(node.id);
            const solanaMetadata = tokenMetadataMap.get(node.id);
            const tokenData = getTokenByMint(node.id);
            
            // Combine metadata with priority: TradeData > SolanaService > TokenStore > BaseNode
            const enhancedNode = {
              ...baseNode,
              name: tradeMetadata?.name || solanaMetadata?.name || tokenData?.name || baseNode.name,
              image: tradeMetadata?.logoURI || solanaMetadata?.logoURI || tokenData?.logoURI || baseNode.image,
              symbol: tradeMetadata?.symbol || solanaMetadata?.symbol || tokenData?.symbol || baseNode.symbol,
              decimals: solanaMetadata?.decimals || tokenData?.decimals || baseNode.decimals, // Decimals from blockchain data
              metadataUri: tradeMetadata?.metadataUri || baseNode.metadataUri,
            };

            // Update label to use the enhanced name or symbol if available
            if (enhancedNode.symbol && enhancedNode.symbol !== baseNode.label) {
              enhancedNode.label = enhancedNode.symbol;
            } else if (enhancedNode.name && enhancedNode.name !== baseNode.name) {
              enhancedNode.label = enhancedNode.name;
            }

            return enhancedNode;
          }

          // For KOL nodes, try to get enhanced data from store synchronously
          if (node.type === 'kol') {
            const kolDetails = getKOL(node.id);
            if (kolDetails) {
              // Apply the same Twitter avatar logic as kol-list.tsx
              const displayName = kolDetails.name || `${node.id.slice(0, 6)}...${node.id.slice(-4)}`;
              
              // Helper function to find Twitter URL from KOL
              const findTwitterUrlFromKOL = (kol: any) => {
                return kol.socialLinks?.twitter || (kol.description?.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+/i)?.[0]);
              };
              
              // Helper function to get Twitter avatar URL
              const getTwitterAvatarUrl = (twitterUrl?: string, fallbackSeed?: string) => {
                if (!twitterUrl) return undefined;
                try {
                  const url = new URL(twitterUrl);
                  const hostname = url.hostname.toLowerCase();
                  const isTwitter = hostname === 'twitter.com' || hostname === 'www.twitter.com';
                  const isX = hostname === 'x.com' || hostname === 'www.x.com';
                  if (!isTwitter && !isX) return undefined;
                  const pathParts = url.pathname.split('/').filter(Boolean);
                  if (pathParts.length === 0) return undefined;
                  const username = pathParts[0]?.replace(/\.json$/i, '');
                  if (!username) return undefined;
                  const base = `https://unavatar.io/twitter/${encodeURIComponent(username)}`;
                  if (fallbackSeed && fallbackSeed.trim().length > 0) {
                    const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackSeed)}`;
                    return `${base}?fallback=${encodeURIComponent(fallback)}`;
                  }
                  return base;
                } catch {
                  return undefined;
                }
              };
              
              const twitterUrl = findTwitterUrlFromKOL(kolDetails);
              const twitterAvatar = getTwitterAvatarUrl(twitterUrl, displayName);
              
              // Prioritize Twitter avatar over store avatar (same as kol-list.tsx)
              const preferredAvatar = twitterAvatar ?? kolDetails.avatar;
              
              // Final fallback to initials avatar if no preferred avatar
              const avatarUrl = preferredAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`;
              
              return {
                ...baseNode,
                label: displayName,
                name: kolDetails.name,
                image: avatarUrl,
              };
            }
          }

          return baseNode;
        });

        // Convert enhanced links to the format expected by the visualization
        const links: UnifiedLink[] = networkData.links.map(link => ({
          source: link.source,
          target: link.target,
          value: link.value,
          tradeCount: link.tradeCount,
          volume: link.volume,
        }));

        // Debug: Log token and KOL nodes with images
        const tokenNodesWithImages = nodes.filter(n => n.type === 'token' && n.image);
        const tokenNodesWithoutImages = nodes.filter(n => n.type === 'token' && !n.image);
        const kolNodesWithImages = nodes.filter(n => n.type === 'kol' && n.image);
        const kolNodesWithoutImages = nodes.filter(n => n.type === 'kol' && !n.image);
        
        console.log(`Token nodes with images: ${tokenNodesWithImages.length}`, tokenNodesWithImages.map(n => ({ name: n.name, symbol: n.symbol, image: n.image?.substring(0, 50) + '...' })));
        console.log(`Token nodes without images: ${tokenNodesWithoutImages.length}`, tokenNodesWithoutImages.map(n => ({ name: n.name, id: n.id.substring(0, 8) })));
        console.log(`KOL nodes with images: ${kolNodesWithImages.length}`, kolNodesWithImages.map(n => ({ name: n.name, image: n.image?.substring(0, 50) + '...' })));
        console.log(`KOL nodes without images: ${kolNodesWithoutImages.length}`, kolNodesWithoutImages.map(n => ({ name: n.name, id: n.id.substring(0, 8) })));

        setProcessedData({ nodes, links });
      };

      // Execute the async metadata processing
      processNodesWithMetadata().catch(error => {
        console.error('Failed to process nodes with metadata:', error);
        // Fallback to basic processing without metadata
        const nodes: UnifiedNode[] = networkData.nodes.map(node => ({
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

        setProcessedData({ nodes, links });
      });
    } else {
      // Clear processed data when no filtered data is available
      setProcessedData({ nodes: [], links: [] });
    }
  }, [filteredTokensData, trendingTokens, dimensions.width, dimensions.height, showSubscribedOnly, getTokenByMint, getKOL]);

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

      // Clear node-specific filters when changing subscription filter
      setFilterMode('none');
      setSelectedKOLs(new Set());
      setSelectedTokens(new Set());

      // The WebSocket subscriptions are maintained by the useKOLTradeSocket hook
      // which already subscribes to both featured and subscribed KOLs
      // This ensures we don't lose real-time updates when switching between views
    },
    []
  );

  // Clear all filters
  const handleClearAllFilters = useCallback(() => {
    setSearchQuery('');
    setFilterMode('none');
    setSelectedKOLs(new Set());
    setSelectedTokens(new Set());
    setSelectedNode(null);
  }, []);

  // Use real-time network statistics from filtering process
  const tokenCount = networkStats.totalTokens;
  const totalKOLs = networkStats.totalKOLs;
  const subscribedKOLs = networkStats.subscribedKOLs;

  // Calculate all KOLs from original data (but still exclude Solana base token)
  const solanaFilteredOriginal =
    dataFilterManager.filterSolanaBaseToken(tokensData);
  const allKOLs = new Set(
    Object.values(solanaFilteredOriginal).flatMap(data =>
      Object.keys(data.kolConnections || {})
    )
  ).size;

  // Table view component - Mobile Responsive
  const TableView = () => {
    const tokenNodes = filteredNodes.filter(n => n.type === 'token');
    const kolNodes = filteredNodes.filter(n => n.type === 'kol');

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Tokens Table */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>Tokens ({tokenNodes.length})</span>
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Token</TableHead>
                    <TableHead className="hidden sm:table-cell">Symbol</TableHead>
                    <TableHead className="text-center">KOLs</TableHead>
                    <TableHead className="text-center">Trades</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Volume (SOL)</TableHead>
                    <TableHead className="hidden lg:table-cell">Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokenNodes.map((token) => (
                    <TableRow key={token.id}>
                      <TableCell className="min-w-[140px]">
                        <div className="flex items-center gap-2">
                          {token.image && (
                            <img 
                              src={token.image} 
                              alt={token.name || token.symbol || 'Token'} 
                              className="w-5 h-5 sm:w-6 sm:h-6 rounded flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-xs sm:text-sm truncate">
                              {token.name || 'Unknown Token'}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {token.id.slice(0, 6)}...{token.id.slice(-3)}
                            </div>
                            {/* Show symbol on mobile when column is hidden */}
                            {token.symbol && (
                              <div className="sm:hidden">
                                <Badge variant="secondary" className="text-xs mt-1">{token.symbol}</Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {token.symbol && (
                          <Badge variant="secondary" className="text-xs">{token.symbol}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">{token.connections}</TableCell>
                      <TableCell className="text-center font-medium">{token.tradeCount}</TableCell>
                      <TableCell className="text-center font-medium hidden md:table-cell">
                        {token.totalVolume?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {token.isTrending && (
                          <Badge variant="default" className="bg-accent-from text-xs">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            <span className="hidden xl:inline">Trending</span>
                            <span className="xl:hidden">Hot</span>
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(token.id)}
                            className="h-6 w-6 p-0"
                            title="Copy address"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`https://dexscreener.com/solana/${token.id}`, '_blank')}
                            className="h-6 w-6 p-0"
                            title="View on DexScreener"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* KOLs Table */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 flex items-center gap-2">
            <UserCheck className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>KOLs ({kolNodes.length})</span>
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">KOL</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Influence</TableHead>
                    <TableHead className="text-center">Trades</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Volume (SOL)</TableHead>
                    <TableHead className="hidden lg:table-cell">Connected Tokens</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kolNodes.map((kol) => {
                    const connectedTokens = filteredLinks
                      .filter(link => {
                        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                        return sourceId === kol.id || targetId === kol.id;
                      })
                      .map(link => {
                        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                        const tokenId = sourceId === kol.id ? targetId : sourceId;
                        return tokenNodes.find(t => t.id === tokenId);
                      })
                      .filter(Boolean);

                    return (
                      <TableRow key={kol.id}>
                        <TableCell className="min-w-[140px]">
                          <div className="flex items-center gap-2">
                            {kol.image && (
                              <img 
                                src={kol.image} 
                                alt={kol.name || 'KOL'} 
                                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-xs sm:text-sm truncate">
                                {kol.name || 'Unknown KOL'}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {kol.id.slice(0, 6)}...{kol.id.slice(-3)}
                              </div>
                              {/* Show influence on mobile when column is hidden */}
                              <div className="sm:hidden text-xs text-muted-foreground mt-1">
                                Influence: {kol.influenceScore?.toFixed(0) || '0'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium hidden sm:table-cell">
                          {kol.influenceScore?.toFixed(0) || '0'}
                        </TableCell>
                        <TableCell className="text-center font-medium">{kol.tradeCount}</TableCell>
                        <TableCell className="text-center font-medium hidden md:table-cell">
                          {kol.totalVolume?.toFixed(2) || '0.00'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {connectedTokens.slice(0, 2).map((token) => (
                              <Badge key={token?.id} variant="outline" className="text-xs">
                                {token?.symbol || token?.name?.slice(0, 4) || 'Unknown'}
                              </Badge>
                            ))}
                            {connectedTokens.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{connectedTokens.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigator.clipboard.writeText(kol.id)}
                              className="h-6 w-6 p-0"
                              title="Copy wallet address"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`https://dexscreener.com/solana?q=${kol.id}`, '_blank')}
                              className="h-6 w-6 p-0"
                              title="Search on DexScreener"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced empty state handling for subscribed-only view
  if (showSubscribedOnly && Object.keys(filteredTokensData).length === 0) {
    // Get more detailed information about why the view is empty
    const solanaFilteredOriginal =
      dataFilterManager.filterSolanaBaseToken(tokensData);
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
        {/* Enhanced Controls Header - Mobile Optimized */}
        <div className="flex flex-col gap-2 px-2 sm:px-4 py-2 bg-muted/20 border-b border-border/50 flex-shrink-0">
          {/* Top Row - Stats and Essential Controls */}
          <div className="flex items-center justify-between gap-2">
            {/* Stats - Compact */}
            <div className="flex items-center space-x-2 text-xs text-muted-foreground overflow-hidden">
              <span className="flex items-center gap-1 flex-shrink-0">
                <CircleDollarSign className="h-3 w-3" />
                <span className="font-medium">0</span>
                <span className="hidden xs:inline">tokens</span>
                <span className="xs:hidden">T</span>
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                <UserCheck className="h-3 w-3" />
                <span className="font-medium">0</span>
                <span className="hidden xs:inline">KOLs</span>
                <span className="xs:hidden">K</span>
              </span>
              <span className="text-xs text-muted-foreground/70 flex-shrink-0 hidden xs:inline">
                ({activeSubscriptions} active of {subscriptions.length} subs)
              </span>
            </div>

            {/* Essential Controls - Always Visible */}
            <div className="flex items-center gap-1">
              <Button
                variant="default"
                size="sm"
                onClick={() => setViewMode('mindmap')}
                className="h-7 px-2 text-xs flex-shrink-0"
              >
                <Network className="h-3 w-3 mr-1" />
                <span className="hidden xs:inline">Map</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-7 px-2 text-xs flex-shrink-0"
              >
                <TableIcon className="h-3 w-3 mr-1" />
                <span className="hidden xs:inline">Table</span>
              </Button>
            </div>
          </div>

          {/* Second Row - Search */}
          <div className="relative w-full">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search tokens and KOLs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-8 text-xs w-full"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Enhanced Empty State - Mobile Responsive */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-sm">
            <div className="relative">
              <UserCheck className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto" />
              {emptyStateReason === 'no-active-subscriptions' && (
                <div className="absolute -top-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white">!</span>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
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
            <div className="flex flex-col gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => handleFilterChange(false)}
                size="sm"
                className="w-full sm:w-auto"
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
                  size="sm"
                  className="w-full sm:w-auto"
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

  // Handle empty state for node filtering modes
  if (filterMode === 'kols' && selectedKOLs.size === 0 && processedData.nodes.length > 0) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'w-full h-full flex flex-col min-h-[300px] max-h-[600px]',
          className
        )}
      >
        {/* Enhanced Controls Header - Mobile Optimized */}
        <div className="flex flex-col gap-2 px-2 sm:px-4 py-2 bg-gray-50/20 dark:bg-gray-800/20 border-b border-gray-200/50 dark:border-gray-700/50 flex-shrink-0">
          {/* Top Row - Stats and Essential Controls */}
          <div className="flex items-center justify-between gap-2">
            {/* Stats - Compact */}
            <div className="flex items-center space-x-2 text-xs text-muted-foreground overflow-hidden">
              <span className="flex items-center gap-1 flex-shrink-0">
                <CircleDollarSign className="h-3 w-3" />
                <span className="font-medium">0</span>
                <span className="hidden xs:inline">tokens</span>
                <span className="xs:hidden">T</span>
                <span className="text-xs opacity-70">(filtered)</span>
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                <UserCheck className="h-3 w-3" />
                <span className="font-medium">0</span>
                <span className="hidden xs:inline">KOLs</span>
                <span className="xs:hidden">K</span>
                <span className="text-xs opacity-70">(kols)</span>
              </span>
            </div>

            {/* Essential Controls - Always Visible */}
            <div className="flex items-center gap-1">
              <Button
                variant="default"
                size="sm"
                onClick={() => setViewMode('mindmap')}
                className="h-7 px-2 text-xs flex-shrink-0"
              >
                <Network className="h-3 w-3 mr-1" />
                <span className="hidden xs:inline">Map</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-7 px-2 text-xs flex-shrink-0"
              >
                <TableIcon className="h-3 w-3 mr-1" />
                <span className="hidden xs:inline">Table</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Empty State for KOL Filter */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-sm">
            <UserCheck className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                Select KOLs to Filter
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Choose specific KOLs from the filter bar above to view their trading connections and related tokens.
              </p>
            </div>
            <div className="flex flex-col gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedKOLs(new Set(processedData.nodes.filter(n => n.type === 'kol').map(n => n.id)));
                }}
                size="sm"
                className="w-full sm:w-auto"
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Select All KOLs
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFilterMode('none');
                  setSelectedKOLs(new Set());
                }}
                size="sm"
                className="w-full sm:w-auto"
              >
                <Users className="h-4 w-4 mr-2" />
                Show All Nodes
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (filterMode === 'tokens' && selectedTokens.size === 0 && processedData.nodes.length > 0) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'w-full h-full flex flex-col min-h-[300px] max-h-[600px]',
          className
        )}
      >
        {/* Enhanced Controls Header - Mobile Optimized */}
        <div className="flex flex-col gap-2 px-2 sm:px-4 py-2 bg-gray-50/20 dark:bg-gray-800/20 border-b border-gray-200/50 dark:border-gray-700/50 flex-shrink-0">
          {/* Top Row - Stats and Essential Controls */}
          <div className="flex items-center justify-between gap-2">
            {/* Stats - Compact */}
            <div className="flex items-center space-x-2 text-xs text-muted-foreground overflow-hidden">
              <span className="flex items-center gap-1 flex-shrink-0">
                <CircleDollarSign className="h-3 w-3" />
                <span className="font-medium">0</span>
                <span className="hidden xs:inline">tokens</span>
                <span className="xs:hidden">T</span>
                <span className="text-xs opacity-70">(filtered)</span>
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                <UserCheck className="h-3 w-3" />
                <span className="font-medium">0</span>
                <span className="hidden xs:inline">KOLs</span>
                <span className="xs:hidden">K</span>
                <span className="text-xs opacity-70">(tokens)</span>
              </span>
            </div>

            {/* Essential Controls - Always Visible */}
            <div className="flex items-center gap-1">
              <Button
                variant="default"
                size="sm"
                onClick={() => setViewMode('mindmap')}
                className="h-7 px-2 text-xs flex-shrink-0"
              >
                <Network className="h-3 w-3 mr-1" />
                <span className="hidden xs:inline">Map</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-7 px-2 text-xs flex-shrink-0"
              >
                <TableIcon className="h-3 w-3 mr-1" />
                <span className="hidden xs:inline">Table</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Empty State for Token Filter */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-sm">
            <CircleDollarSign className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                Select Tokens to Filter
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Choose specific tokens from the filter bar above to view their trading connections and related KOLs.
              </p>
            </div>
            <div className="flex flex-col gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedTokens(new Set(processedData.nodes.filter(n => n.type === 'token').map(n => n.id)));
                }}
                size="sm"
                className="w-full sm:w-auto"
              >
                <CircleDollarSign className="h-4 w-4 mr-2" />
                Select All Tokens
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFilterMode('none');
                  setSelectedTokens(new Set());
                }}
                size="sm"
                className="w-full sm:w-auto"
              >
                <Users className="h-4 w-4 mr-2" />
                Show All Nodes
              </Button>
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
        viewMode === 'table' ? 'max-h-none' : 'max-h-[600px]',
        className
      )}
    >
      {/* Enhanced Controls Header - Mobile Optimized */}
      <div className="flex flex-col gap-2 px-2 sm:px-4 py-2 bg-gray-50/20 dark:bg-gray-800/20 border-b border-gray-200/50 dark:border-gray-700/50 flex-shrink-0">
        {/* Top Row - Stats and Essential Controls */}
        <div className="flex items-center justify-between gap-2">
          {/* Stats - Compact */}
          <div className="flex items-center space-x-2 text-xs text-muted-foreground overflow-hidden">
            <span className="flex items-center gap-1 flex-shrink-0">
              <CircleDollarSign className="h-3 w-3" />
              <span className="font-medium">{filteredNodes.filter(n => n.type === 'token').length}</span>
              <span className="hidden xs:inline">tokens</span>
              <span className="xs:hidden">T</span>
            </span>
            <span className="flex items-center gap-1 flex-shrink-0">
              <UserCheck className="h-3 w-3" />
              <span className="font-medium">{filteredNodes.filter(n => n.type === 'kol').length}</span>
              <span className="hidden xs:inline">KOLs</span>
              <span className="xs:hidden">K</span>
            </span>
            {(searchQuery || filterMode !== 'none' || showSubscribedOnly) && (
              <span className="text-xs opacity-70 hidden xs:inline">(filtered)</span>
            )}
          </div>

          {/* Essential Controls - Always Visible */}
          <div className="flex items-center gap-1">
            {/* View Mode Toggle */}
            <Button
              variant={viewMode === 'mindmap' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('mindmap')}
              className="h-7 px-2 text-xs flex-shrink-0"
            >
              <Network className="h-3 w-3 mr-1" />
              <span className="hidden xs:inline">Map</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-7 px-2 text-xs flex-shrink-0"
            >
              <TableIcon className="h-3 w-3 mr-1" />
              <span className="hidden xs:inline">Table</span>
            </Button>

            {/* Manual Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="h-7 w-7 p-0 flex-shrink-0"
              title="Refresh data"
            >
              <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
            </Button>

            {/* Mobile Dropdown Menu - Hidden on Desktop */}
            <DropdownMenu open={mobileDropdownOpen} onOpenChange={setMobileDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 flex-shrink-0 md:hidden"
                  title="More options"
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filters & Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Subscription Filters */}
                <DropdownMenuItem
                  onClick={() => {
                    handleFilterChange(true);
                    setMobileDropdownOpen(false);
                  }}
                  disabled={subscriptions.filter(s => s.isActive).length === 0}
                  className={showSubscribedOnly ? 'bg-accent' : ''}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Subscribed KOLs ({subscribedKOLs})
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    handleFilterChange(false);
                    setMobileDropdownOpen(false);
                  }}
                  className={!showSubscribedOnly ? 'bg-accent' : ''}
                >
                  <Users className="h-4 w-4 mr-2" />
                  All KOLs ({allKOLs})
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                {/* Node Type Filters */}
                <DropdownMenuItem
                  onClick={() => {
                    setFilterMode('none');
                    setSelectedKOLs(new Set());
                    setSelectedTokens(new Set());
                    setMobileDropdownOpen(false);
                  }}
                  className={filterMode === 'none' ? 'bg-accent' : ''}
                >
                  <Network className="h-4 w-4 mr-2" />
                  All Nodes
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setFilterMode('kols');
                    setSelectedTokens(new Set());
                    setMobileDropdownOpen(false);
                  }}
                  className={filterMode === 'kols' ? 'bg-accent' : ''}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Filter KOLs {selectedKOLs.size > 0 && `(${selectedKOLs.size})`}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setFilterMode('tokens');
                    setSelectedKOLs(new Set());
                    setMobileDropdownOpen(false);
                  }}
                  className={filterMode === 'tokens' ? 'bg-accent' : ''}
                >
                  <CircleDollarSign className="h-4 w-4 mr-2" />
                  Filter Tokens {selectedTokens.size > 0 && `(${selectedTokens.size})`}
                </DropdownMenuItem>

                {/* Mindmap-specific controls */}
                {viewMode === 'mindmap' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Highlight Mode</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => {
                        setHighlightMode('none');
                        setMobileDropdownOpen(false);
                      }}
                      className={highlightMode === 'none' ? 'bg-accent' : ''}
                    >
                      <Network className="h-4 w-4 mr-2" />
                      All Nodes
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setHighlightMode('trending');
                        setMobileDropdownOpen(false);
                      }}
                      className={highlightMode === 'trending' ? 'bg-accent' : ''}
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Trending
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setHighlightMode('high-volume');
                        setMobileDropdownOpen(false);
                      }}
                      className={highlightMode === 'high-volume' ? 'bg-accent' : ''}
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      High Volume
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Zoom Controls</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => { handleZoomIn(); setMobileDropdownOpen(false); }}>
                      <ZoomIn className="h-4 w-4 mr-2" />
                      Zoom In
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { handleZoomOut(); setMobileDropdownOpen(false); }}>
                      <ZoomOut className="h-4 w-4 mr-2" />
                      Zoom Out
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { handleResetZoom(); setMobileDropdownOpen(false); }}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset Zoom
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    handleClearAllFilters();
                    setMobileDropdownOpen(false);
                  }}
                  className="text-destructive"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear All Filters
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Second Row - Search and Desktop Filters */}
        <div className="flex flex-col gap-2">
          {/* Search Bar - Full Width */}
          <div className="relative w-full">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search tokens and KOLs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-8 text-xs w-full"
            />
            {(searchQuery || filterMode !== 'none') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAllFilters}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                title="Clear all filters"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Desktop Filter Controls - Hidden on Mobile */}
          <div className="hidden md:flex flex-wrap items-center gap-1 justify-start">
            {/* Subscription Filters */}
            <Button
              variant={showSubscribedOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange(true)}
              className="h-7 px-2 text-xs flex-shrink-0"
              disabled={subscriptions.filter(s => s.isActive).length === 0}
            >
              <UserCheck className="h-3 w-3 mr-1" />
              Subscribed ({subscribedKOLs})
            </Button>
            <Button
              variant={!showSubscribedOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange(false)}
              className="h-7 px-2 text-xs flex-shrink-0"
            >
              <Users className="h-3 w-3 mr-1" />
              All ({allKOLs})
            </Button>

            {/* Node Type Filters */}
            <div className="w-px h-4 bg-border mx-1" />
            <Button
              variant={filterMode === 'none' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setFilterMode('none');
                setSelectedKOLs(new Set());
                setSelectedTokens(new Set());
              }}
              className="h-7 px-2 text-xs flex-shrink-0"
            >
              All Nodes
            </Button>
            <Button
              variant={filterMode === 'kols' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setFilterMode('kols');
                setSelectedTokens(new Set());
              }}
              className="h-7 px-2 text-xs flex-shrink-0"
            >
              <UserCheck className="h-3 w-3 mr-1" />
              Filter KOLs
              {selectedKOLs.size > 0 && (
                <span className="ml-1">({selectedKOLs.size})</span>
              )}
            </Button>
            <Button
              variant={filterMode === 'tokens' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setFilterMode('tokens');
                setSelectedKOLs(new Set());
              }}
              className="h-7 px-2 text-xs flex-shrink-0"
            >
              <CircleDollarSign className="h-3 w-3 mr-1" />
              Filter Tokens
              {selectedTokens.size > 0 && (
                <span className="ml-1">({selectedTokens.size})</span>
              )}
            </Button>

            {/* Mindmap-specific controls */}
            {viewMode === 'mindmap' && (
              <>
                <div className="w-px h-4 bg-border mx-1" />
                
                {/* Highlight Mode Toggle */}
                <div className="flex items-center gap-1">
                  <Button
                    variant={highlightMode === 'none' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setHighlightMode('none')}
                    className="h-7 px-2 text-xs flex-shrink-0"
                  >
                    All
                  </Button>
                  <Button
                    variant={highlightMode === 'trending' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setHighlightMode('trending')}
                    className="h-7 px-2 text-xs flex-shrink-0"
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Trending
                  </Button>
                  <Button
                    variant={highlightMode === 'high-volume' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setHighlightMode('high-volume')}
                    className="h-7 px-2 text-xs flex-shrink-0"
                  >
                    <Activity className="h-3 w-3 mr-1" />
                    Volume
                  </Button>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-0.5 ml-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomIn}
                    className="h-7 w-7 p-0 flex-shrink-0"
                    title="Zoom in"
                  >
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomOut}
                    className="h-7 w-7 p-0 flex-shrink-0"
                    title="Zoom out"
                  >
                    <ZoomOut className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetZoom}
                    className="h-7 w-7 p-0 flex-shrink-0"
                    title="Reset zoom"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Filter Selection UI */}
        {(filterMode === 'kols' || filterMode === 'tokens') && (
          <div className="px-2 sm:px-4 py-2 bg-gray-50/10 dark:bg-gray-800/10 border-b border-gray-200/30 dark:border-gray-700/30">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-muted-foreground">
                Select {filterMode === 'kols' ? 'KOLs' : 'tokens'} to filter:
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (filterMode === 'kols') {
                      setSelectedKOLs(new Set(processedData.nodes.filter(n => n.type === 'kol').map(n => n.id)));
                    } else {
                      setSelectedTokens(new Set(processedData.nodes.filter(n => n.type === 'token').map(n => n.id)));
                    }
                  }}
                  className="h-5 px-2 text-xs"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (filterMode === 'kols') {
                      setSelectedKOLs(new Set());
                    } else {
                      setSelectedTokens(new Set());
                    }
                  }}
                  className="h-5 px-2 text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {filterMode === 'kols' ? (
                processedData.nodes
                  .filter(node => node.type === 'kol')
                  .map(kol => (
                    <Button
                      key={kol.id}
                      variant={selectedKOLs.has(kol.id) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const newSelected = new Set(selectedKOLs);
                        if (newSelected.has(kol.id)) {
                          newSelected.delete(kol.id);
                        } else {
                          newSelected.add(kol.id);
                        }
                        setSelectedKOLs(newSelected);
                      }}
                      className="h-6 px-2 text-xs flex-shrink-0"
                    >
                      {kol.image && (
                        <img 
                          src={kol.image} 
                          alt={kol.name || 'KOL'} 
                          className="w-3 h-3 rounded-full mr-1 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <span className="truncate max-w-[100px]">
                        {kol.name || `${kol.id.slice(0, 6)}...`}
                      </span>
                    </Button>
                  ))
              ) : (
                processedData.nodes
                  .filter(node => node.type === 'token')
                  .map(token => (
                    <Button
                      key={token.id}
                      variant={selectedTokens.has(token.id) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const newSelected = new Set(selectedTokens);
                        if (newSelected.has(token.id)) {
                          newSelected.delete(token.id);
                        } else {
                          newSelected.add(token.id);
                        }
                        setSelectedTokens(newSelected);
                      }}
                      className="h-6 px-2 text-xs flex-shrink-0"
                    >
                      {token.image && (
                        <img 
                          src={token.image} 
                          alt={token.symbol || token.name || 'Token'} 
                          className="w-3 h-3 rounded mr-1 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <span className="truncate max-w-[100px]">
                        {token.symbol || token.name || `${token.id.slice(0, 6)}...`}
                      </span>
                    </Button>
                  ))
              )}
            </div>
            {((filterMode === 'kols' && selectedKOLs.size === 0) || (filterMode === 'tokens' && selectedTokens.size === 0)) && (
              <div className="text-xs text-muted-foreground mt-1 text-center">
                Select {filterMode === 'kols' ? 'KOLs' : 'tokens'} to filter the network view
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full h-full min-h-0 overflow-hidden">
        {viewMode === 'mindmap' ? (
          <div className="relative w-full h-full">
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
            <div className="absolute top-1 sm:top-2 left-1 sm:left-2 p-1 sm:p-2 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm">
              <div className="space-y-0.5 text-xs">
                <div className="flex items-center space-x-1">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-accent-gradient flex items-center justify-center">
                    <CircleDollarSign className="h-1 w-1 sm:h-1.5 sm:w-1.5 text-white" />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    <span className="hidden sm:inline">Tokens</span>
                    <span className="sm:hidden">T</span>
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <div
                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border border-white flex items-center justify-center"
                    style={{
                      background:
                        'linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)',
                    }}
                  >
                    <UserCheck className="h-1 w-1 sm:h-1.5 sm:w-1.5 text-white" />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    <span className="hidden sm:inline">KOLs</span>
                    <span className="sm:hidden">K</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Search Results Indicator - Mobile Responsive */}
            {searchQuery && (
              <div className="absolute top-1 sm:top-2 right-1 sm:right-2 p-1 sm:p-2 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm max-w-[200px] sm:max-w-none">
                <div className="text-xs text-muted-foreground">
                  <Filter className="h-3 w-3 inline mr-1" />
                  <span className="hidden sm:inline">
                    {filteredNodes.length} results for "{searchQuery.length > 10 ? searchQuery.slice(0, 10) + '...' : searchQuery}"
                  </span>
                  <span className="sm:hidden">
                    {filteredNodes.length} results
                  </span>
                </div>
              </div>
            )}

            {/* Interaction Error Display */}
            {interactionErrors.length > 0 && (
              <div className="absolute top-12 left-1 z-50 space-y-2">
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
                connections={filteredLinks}
                onClose={() => setSelectedNode(null)}
                onError={handleInteractionError}
                className="sm:absolute sm:top-2 sm:right-2 z-50"
              />
            )}


          </div>
        ) : (
          <div className="w-full h-full overflow-auto p-2 sm:p-4">
            {filteredNodes.length === 0 && (searchQuery || filterMode !== 'none') ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                {searchQuery ? (
                  <>
                    <Search className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                    <h3 className="text-base sm:text-lg font-semibold mb-2">No results found</h3>
                    <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                      No tokens or KOLs match your search for "{searchQuery.length > 20 ? searchQuery.slice(0, 20) + '...' : searchQuery}"
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setSearchQuery('')}
                      size="sm"
                    >
                      Clear search
                    </Button>
                  </>
                ) : filterMode !== 'none' ? (
                  <>
                    <Filter className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                    <h3 className="text-base sm:text-lg font-semibold mb-2">No nodes selected</h3>
                    <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                      Select some {filterMode === 'kols' ? 'KOLs' : 'tokens'} from the filter bar above to view their connections
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (filterMode === 'kols') {
                            setSelectedKOLs(new Set(processedData.nodes.filter(n => n.type === 'kol').map(n => n.id)));
                          } else {
                            setSelectedTokens(new Set(processedData.nodes.filter(n => n.type === 'token').map(n => n.id)));
                          }
                        }}
                        size="sm"
                      >
                        Select All {filterMode === 'kols' ? 'KOLs' : 'Tokens'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFilterMode('none');
                          setSelectedKOLs(new Set());
                          setSelectedTokens(new Set());
                        }}
                        size="sm"
                      >
                        Clear Filter
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : (
              <TableView />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Unified NodeInfoPanel component for both hover and click states - Mobile Responsive
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
    const url =
      node.type === 'token'
        ? `https://dexscreener.com/solana/${node.id}`
        : `https://dexscreener.com/solana?q=${node.id}`;
    window.open(url, '_blank');
  };

  return (
    <div
      className={cn(
        'w-44 sm:w-56 md:w-64 bg-white/95 dark:bg-gray-800/95 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-w-[90vw]',
        className
      )}
    >
      <div className="flex items-center justify-between p-1.5 sm:p-2 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-medium">
          {node.type === 'token' ? (
            <>
              <CircleDollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span>Token</span>
            </>
          ) : (
            <>
              <UserCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span>KOL</span>
            </>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 flex-shrink-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="p-1.5 sm:p-2 space-y-2">
        {/* Token/KOL Name and Symbol with Image */}
        {(node.name || node.symbol || node.image) && (
          <div className="text-xs">
            <div className="text-muted-foreground mb-1">
              {node.type === 'token' ? 'Token' : 'KOL'}
            </div>
            <div className="flex items-center gap-2">
              {node.image && (
                <img 
                  src={node.image} 
                  alt={node.symbol || node.name || 'Token'} 
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded flex-shrink-0"
                  onError={(e) => {
                    // Hide image if it fails to load
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="font-semibold text-xs sm:text-sm min-w-0 flex-1">
                {node.type === 'token' ? (
                  <div>
                    <div className="truncate">{node.name || 'Unknown Token'}</div>
                    {node.symbol && (
                      <div className="text-muted-foreground">({node.symbol})</div>
                    )}
                  </div>
                ) : (
                  <div className="truncate">{node.name}</div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="text-xs">
          <div className="text-muted-foreground mb-1">
            {node.type === 'token' ? 'Address' : 'Wallet'}
          </div>
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs break-all flex-1 min-w-0">
              {node.id.slice(0, 8)}...{node.id.slice(-4)}
            </span>
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-5 w-5 p-0 text-primary hover:text-primary/80"
                title={`Copy ${node.type === 'token' ? 'address' : 'wallet'}`}
              >
                <Copy className="h-2.5 w-2.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDexScreener}
                className="h-5 w-5 p-0 text-primary hover:text-primary/80"
                title={
                  node.type === 'token'
                    ? 'View on DexScreener'
                    : 'Search on DexScreener'
                }
              >
                <ExternalLink className="h-2.5 w-2.5" />
              </Button>
            </div>
          </div>
        </div>

        {node.type === 'token' ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">KOLs</div>
              <div className="font-semibold text-sm">{node.connections}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Trades</div>
              <div className="font-semibold text-sm">{node.tradeCount}</div>
            </div>
            <div className="col-span-2">
              <div className="text-muted-foreground">Volume</div>
              <div className="font-semibold text-sm">
                {node.totalVolume?.toFixed(2)} SOL
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">Influence</div>
              <div className="font-semibold text-sm">
                {node.influenceScore?.toFixed(0)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Trades</div>
              <div className="font-semibold text-sm">{node.tradeCount}</div>
            </div>
            <div className="col-span-2">
              <div className="text-muted-foreground">Volume</div>
              <div className="font-semibold text-sm">
                {node.totalVolume?.toFixed(2)} SOL
              </div>
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
          <div className="block sm:hidden pt-2 border-t border-gray-200/30 dark:border-gray-700/30">
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
