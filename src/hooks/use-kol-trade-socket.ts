'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { useNotifications } from '@/stores/use-ui-store';
import { PredictionResult, KOLWallet, UserSubscription } from '@/types';
import { cacheManager } from '@/lib/cache-manager';
import { TradingService } from '@/services/trading.service';
import { TokenMetadataService } from '@/services/token-metadata.service';

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
    dexProgram: string;
    fee?: number;
    name?: string | undefined;
    symbol?: string | undefined;
    image?: string | undefined;
    metadataUri?: string | undefined;
  };
  affectedUsers: string[];
  processed: boolean;
  prediction?: PredictionResult;
  isFeatured?: boolean;
  label?: string;
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

type LoadingPhase =
  | 'idle'
  | 'essential'
  | 'enhanced'
  | 'background'
  | 'complete';

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  retryCount: number;
  lastError: string | null;
  connectionHealth: 'healthy' | 'unstable' | 'failed';
}

interface UseKOLTradeSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  recentTrades: KOLTrade[];
  allMindmapData: { [tokenMint: string]: MindmapUpdate };
  trendingTokens: string[];
  isLoadingInitialData: boolean;
  loadingPhase: LoadingPhase;
  connectionState: ConnectionState;
  stats: {
    totalTrades: number;
    uniqueKOLs: number;
    uniqueTokens: number;
    totalVolume: number;
  };
  // Enhanced subscription management
  featuredKOLs: string[];
  subscribedKOLs: string[];
  relevantKOLs: string[];
  subscriptionManager: {
    subscribeToKOL: (kolWallet: string) => void;
    unsubscribeFromKOL: (kolWallet: string) => void;
    refreshSubscriptions: () => Promise<void>;
  };
}

// Global state to ensure single requests across all hook instances
const globalState = {
  hasInitialized: false,
  isInitializing: false,
  mindmapInitialized: false,
  socket: null as Socket | null,
  isConnected: false,
  data: {
    trades: [] as KOLTrade[],
    stats: {
      totalTrades: 0,
      uniqueKOLs: 0,
      uniqueTokens: 0,
      totalVolume: 0,
    },
    trendingTokens: [] as string[],
    mindmapData: {} as { [tokenMint: string]: MindmapUpdate },
  },
  loadingPhase: 'idle' as LoadingPhase,
  isLoadingInitialData: true,
  // Enhanced subscription management
  subscriptions: {
    featuredKOLs: [] as string[],
    subscribedKOLs: [] as string[],
    relevantKOLs: [] as string[],
    subscribedTokens: new Set<string>(), // Track which tokens we're subscribed to for mindmap
    subscribedKOLs_mindmap: new Set<string>(), // Track which KOLs we're subscribed to for mindmap
    pendingSubscriptions: new Set<string>(), // Track pending subscription requests to prevent duplicates
    subscriptionTimestamps: new Map<string, number>(), // Track when subscriptions were made
  },
};

// Memory optimization: Limit data sizes
const MAX_TRADES = 25; // Reduced from 50
const MAX_MINDMAP_ENTRIES = 20; // Increased limit for better coverage
const CLEANUP_INTERVAL = 300000; // 5 minutes

// Global listeners for state updates
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error('Listener notification failed:', error);
    }
  });
}

// Memory cleanup function
function cleanupOldData() {
  // Keep only recent trades
  if (globalState.data.trades.length > MAX_TRADES) {
    globalState.data.trades = globalState.data.trades.slice(0, MAX_TRADES);
  }

  // Clean up old mindmap data - keep data for tokens that appear in recent trades
  const mindmapKeys = Object.keys(globalState.data.mindmapData);
  if (mindmapKeys.length > MAX_MINDMAP_ENTRIES) {
    // Get tokens from recent trades to prioritize
    const recentTokens = new Set(
      globalState.data.trades
        .slice(0, MAX_TRADES)
        .map(trade => trade.tradeData?.mint)
        .filter(Boolean)
    );

    // Remove mindmap data for tokens not in recent trades, starting with oldest
    const keysToRemove = mindmapKeys
      .filter(key => !recentTokens.has(key))
      .slice(MAX_MINDMAP_ENTRIES - recentTokens.size);

    keysToRemove.forEach(key => {
      delete globalState.data.mindmapData[key];
    });
  }
}

// Metadata enrichment for trades
async function enrichTradesMetadata(trades: KOLTrade[]) {
  // Find mints that need enrichment (missing name, symbol, OR image)
  const mintsToEnrich = new Set<string>();
  trades.forEach(trade => {
    if (trade.tradeData?.mint) {
      const { name, symbol, image } = trade.tradeData;
      // Aggressive check: if ANY key field is missing or looks like a placeholder/default
      const isMissingData = !name || !symbol || !image || 
                            name === 'Unknown' || name === 'Unknown Token' ||
                            symbol === 'Unknown' || symbol === 'UNKNOWN' ||
                            name === trade.tradeData.mint;
      
      if (isMissingData) {
        mintsToEnrich.add(trade.tradeData.mint);
      }
    }
  });

  if (mintsToEnrich.size === 0) return;

  try {
    const mintList = Array.from(mintsToEnrich);
    // Use the service to get rich metadata (uses cache internally)
    const metadataMap = await TokenMetadataService.getMultipleTokenMetadata(mintList);

    if (metadataMap.size === 0) return;

    let hasChanges = false;
    trades.forEach(trade => {
      if (trade.tradeData?.mint && metadataMap.has(trade.tradeData.mint)) {
        const metadata = metadataMap.get(trade.tradeData.mint)!;
        
        // Enrich name if missing or placeholder
        if (!trade.tradeData.name || trade.tradeData.name === 'Unknown' || trade.tradeData.name === 'Unknown Token' || trade.tradeData.name === trade.tradeData.mint) {
          trade.tradeData.name = metadata.name;
          hasChanges = true;
        }
        
        // Enrich symbol if missing or placeholder
        if (!trade.tradeData.symbol || trade.tradeData.symbol === 'N/A' || trade.tradeData.symbol === 'Unknown' || trade.tradeData.symbol === 'UNKNOWN') {
          trade.tradeData.symbol = metadata.symbol;
          hasChanges = true;
        }
        
        // Always prefer external high-quality image if available and current is missing or we want to ensure quality
        if (metadata.image && (!trade.tradeData.image || trade.tradeData.image.includes('dicebear'))) {
          trade.tradeData.image = metadata.image;
          hasChanges = true;
        }

        // Also attach Solscan link if not present? (Optional, but good for data completeness)
      }
    });

    if (hasChanges) {
      notifyListeners();
    }
  } catch (error) {
    console.warn('Failed to enrich trade metadata:', error);
  }
}

// Smart subscription management functions
async function fetchFeaturedKOLs(): Promise<string[]> {
  try {
    // Fetch featured KOLs from the backend
    const response = await TradingService.getKOLWallets({
      limit: 20, // Get top 20 featured KOLs
      sortBy: 'subscriberCount',
      sortOrder: 'desc',
    });

    if (response.data) {
      return response.data.map((kol: KOLWallet) => kol.walletAddress);
    }
    return [];
  } catch (error: any) {
    const isNetworkError = 
      error.message?.includes('Network Error') || 
      error.message?.includes('Unable to connect') || 
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNREFUSED';
    
    if (!isNetworkError) {
      console.warn('Failed to fetch featured KOLs:', error);
    }
    return [];
  }
}

async function fetchUserSubscribedKOLs(): Promise<string[]> {
  try {
    const response = await TradingService.getUserSubscriptions();
    if (response.data) {
      return response.data
        .filter((sub: UserSubscription) => sub.isActive)
        .map((sub: UserSubscription) => sub.kolWallet);
    }
    return [];
  } catch (error: any) {
    const isNetworkError = 
      error.message?.includes('Network Error') || 
      error.message?.includes('Unable to connect') || 
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNREFUSED';
      
    if (!isNetworkError) {
      console.warn('Failed to fetch user subscriptions:', error);
    }
    return [];
  }
}

function mergeKOLLists(featured: string[], subscribed: string[]): string[] {
  // Merge and deduplicate KOL lists
  const uniqueKOLs = new Set([...featured, ...subscribed]);
  return Array.from(uniqueKOLs);
}

function subscribeToRelevantKOLs() {
  if (!globalState.socket || !globalState.isConnected) return;

  const { relevantKOLs } = globalState.subscriptions;

  // Subscribe to mindmap updates for each relevant KOL
  relevantKOLs.forEach(kolWallet => {
    globalState.socket!.emit('subscribe_kol_mindmap', { kolWallet });
  });

  console.log(
    `📡 Subscribed to mindmap updates for ${relevantKOLs.length} relevant KOLs`
  );
}

function subscribeToKOLMindmap(kolWallet: string) {
  if (!globalState.socket || !globalState.isConnected) return;

  // Prevent redundant subscriptions
  if (globalState.subscriptions.subscribedKOLs_mindmap.has(kolWallet)) {
    console.log(
      `📡 Already subscribed to mindmap updates for KOL: ${kolWallet}`
    );
    return;
  }

  // Prevent duplicate pending requests
  if (globalState.subscriptions.pendingSubscriptions.has(`kol_${kolWallet}`)) {
    console.log(
      `📡 Subscription request already pending for KOL: ${kolWallet}`
    );
    return;
  }

  globalState.subscriptions.pendingSubscriptions.add(`kol_${kolWallet}`);
  globalState.socket.emit('subscribe_kol_mindmap', { kolWallet });

  // Track successful subscription
  globalState.subscriptions.subscribedKOLs_mindmap.add(kolWallet);
  globalState.subscriptions.subscriptionTimestamps.set(
    `kol_${kolWallet}`,
    Date.now()
  );

  // Remove from pending after a short delay
  setTimeout(() => {
    globalState.subscriptions.pendingSubscriptions.delete(`kol_${kolWallet}`);
  }, 1000);

  console.log(`📡 Subscribed to mindmap updates for KOL: ${kolWallet}`);
}

function unsubscribeFromKOLMindmap(kolWallet: string) {
  if (!globalState.socket || !globalState.isConnected) return;

  // Only unsubscribe if we're actually subscribed
  if (!globalState.subscriptions.subscribedKOLs_mindmap.has(kolWallet)) {
    console.log(`📡 Not subscribed to mindmap updates for KOL: ${kolWallet}`);
    return;
  }

  globalState.socket.emit('unsubscribe_kol_mindmap', { kolWallet });

  // Track unsubscription
  globalState.subscriptions.subscribedKOLs_mindmap.delete(kolWallet);
  globalState.subscriptions.subscriptionTimestamps.delete(`kol_${kolWallet}`);

  console.log(`📡 Unsubscribed from mindmap updates for KOL: ${kolWallet}`);
}

function optimizeSubscriptions() {
  // Clean up stale subscriptions (older than 1 hour)
  const now = Date.now();
  const staleThreshold = 60 * 60 * 1000; // 1 hour

  globalState.subscriptions.subscriptionTimestamps.forEach((timestamp, key) => {
    if (now - timestamp > staleThreshold) {
      if (key.startsWith('kol_')) {
        const kolWallet = key.substring(4);
        // Only clean up if not in relevant KOLs
        if (!globalState.subscriptions.relevantKOLs.includes(kolWallet)) {
          unsubscribeFromKOLMindmap(kolWallet);
        }
      } else if (key.startsWith('token_')) {
        const tokenMint = key.substring(6);
        globalState.subscriptions.subscribedTokens.delete(tokenMint);
        globalState.subscriptions.subscriptionTimestamps.delete(key);
      }
    }
  });

  // Ensure all relevant KOLs are subscribed
  globalState.subscriptions.relevantKOLs.forEach(kolWallet => {
    if (!globalState.subscriptions.subscribedKOLs_mindmap.has(kolWallet)) {
      subscribeToKOLMindmap(kolWallet);
    }
  });

  console.log('🔧 Subscription optimization completed', {
    subscribedKOLs: globalState.subscriptions.subscribedKOLs_mindmap.size,
    subscribedTokens: globalState.subscriptions.subscribedTokens.size,
    relevantKOLs: globalState.subscriptions.relevantKOLs.length,
  });
}

// Function to ensure mindmap subscription for active tokens (legacy support)
function ensureMindmapSubscriptions() {
  if (!globalState.socket || !globalState.isConnected) return;

  // Get unique tokens from recent trades
  const activeTokens = new Set(
    globalState.data.trades
      .slice(0, 10) // Only check last 10 trades
      .map(trade => trade.tradeData?.mint)
      .filter(Boolean)
  );

  // Subscribe to mindmap updates for active tokens that we don't have data for
  activeTokens.forEach(tokenMint => {
    if (!tokenMint) return;
    if (
      !globalState.data.mindmapData[tokenMint] &&
      !globalState.subscriptions.subscribedTokens.has(tokenMint)
    ) {
      // Prevent duplicate pending requests
      if (
        !globalState.subscriptions.pendingSubscriptions.has(
          `token_${tokenMint}`
        )
      ) {
        globalState.subscriptions.pendingSubscriptions.add(
          `token_${tokenMint}`
        );
        globalState.socket!.emit('subscribe_mindmap', { tokenMint });
        globalState.subscriptions.subscribedTokens.add(tokenMint);
        globalState.subscriptions.subscriptionTimestamps.set(
          `token_${tokenMint}`,
          Date.now()
        );

        // Remove from pending after a short delay
        setTimeout(() => {
          globalState.subscriptions.pendingSubscriptions.delete(
            `token_${tokenMint}`
          );
        }, 1000);
      }
    }
  });
}

export const useKOLTradeSocket = (): UseKOLTradeSocketReturn => {
  const { showError } = useNotifications();

  // Local state that syncs with global state
  const [, forceUpdate] = useState({});
  const rerender = useCallback(() => forceUpdate({}), []);

  // Subscribe to global state changes
  useEffect(() => {
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, [rerender]);

  // Dynamic subscription management functions
  const handleSubscribeToKOL = useCallback((kolWallet: string) => {
    // Add to subscribed KOLs if not already present
    if (!globalState.subscriptions.subscribedKOLs.includes(kolWallet)) {
      globalState.subscriptions.subscribedKOLs.push(kolWallet);
      globalState.subscriptions.relevantKOLs = mergeKOLLists(
        globalState.subscriptions.featuredKOLs,
        globalState.subscriptions.subscribedKOLs
      );

      // Subscribe to mindmap updates for this KOL (with optimization)
      subscribeToKOLMindmap(kolWallet);

      // Trigger subscription optimization to ensure consistency
      setTimeout(optimizeSubscriptions, 100);

      notifyListeners();
    }
  }, []);

  const handleUnsubscribeFromKOL = useCallback((kolWallet: string) => {
    // Remove from subscribed KOLs
    globalState.subscriptions.subscribedKOLs =
      globalState.subscriptions.subscribedKOLs.filter(kol => kol !== kolWallet);
    globalState.subscriptions.relevantKOLs = mergeKOLLists(
      globalState.subscriptions.featuredKOLs,
      globalState.subscriptions.subscribedKOLs
    );

    // Unsubscribe from mindmap updates for this KOL (only if not featured)
    if (!globalState.subscriptions.featuredKOLs.includes(kolWallet)) {
      unsubscribeFromKOLMindmap(kolWallet);
    }

    // Trigger subscription optimization to clean up
    setTimeout(optimizeSubscriptions, 100);

    notifyListeners();
  }, []);

  const refreshSubscriptions = useCallback(async () => {
    try {
      const [featuredKOLs, subscribedKOLs] = await Promise.all([
        fetchFeaturedKOLs(),
        fetchUserSubscribedKOLs(),
      ]);

      const previousRelevantKOLs = [...globalState.subscriptions.relevantKOLs];

      globalState.subscriptions.featuredKOLs = featuredKOLs;
      globalState.subscriptions.subscribedKOLs = subscribedKOLs;
      globalState.subscriptions.relevantKOLs = mergeKOLLists(
        featuredKOLs,
        subscribedKOLs
      );

      // Update WebSocket subscriptions based on changes
      const newRelevantKOLs = globalState.subscriptions.relevantKOLs;
      const addedKOLs = newRelevantKOLs.filter(
        kol => !previousRelevantKOLs.includes(kol)
      );
      const removedKOLs = previousRelevantKOLs.filter(
        kol => !newRelevantKOLs.includes(kol)
      );

      // Subscribe to new KOLs (with optimization)
      addedKOLs.forEach(kolWallet => {
        subscribeToKOLMindmap(kolWallet);
      });

      // Unsubscribe from removed KOLs (with optimization)
      removedKOLs.forEach(kolWallet => {
        unsubscribeFromKOLMindmap(kolWallet);
      });

      // Run full optimization to ensure consistency
      setTimeout(optimizeSubscriptions, 100);

      notifyListeners();
    } catch (error) {
      console.error('Failed to refresh subscriptions:', error);
    }
  }, []);

  // Mock data for fallback
  const getMockData = useCallback(() => {
    return {
      trades: [
        {
          id: 'mock-1',
          kolWallet: 'mock-kol-1',
          signature: 'mock-sig-1',
          timestamp: new Date(),
          tradeData: {
            tokenIn: 'SOL',
            tokenOut: 'DEMO1',
            amountIn: 1000,
            amountOut: 500,
            tradeType: 'buy' as const,
            mint: 'mock-token-1',
            dexProgram: 'demo',
            name: 'Demo Token 1',
            symbol: 'DEMO1',
          },
          affectedUsers: [],
          processed: true,
        },
        {
          id: 'mock-2',
          kolWallet: 'mock-kol-2',
          signature: 'mock-sig-2',
          timestamp: new Date(),
          tradeData: {
            tokenIn: 'DEMO2',
            tokenOut: 'SOL',
            amountIn: 500,
            amountOut: 1200,
            tradeType: 'sell' as const,
            mint: 'mock-token-2',
            dexProgram: 'demo',
            name: 'Demo Token 2',
            symbol: 'DEMO2',
          },
          affectedUsers: [],
          processed: true,
        },
      ],
      stats: {
        totalTrades: 1250,
        uniqueKOLs: 45,
        uniqueTokens: 128,
        totalVolume: 2500000,
      },
      trendingTokens: ['mock-token-1', 'mock-token-2', 'mock-token-3'],
    };
  }, []);

  // WebSocket connection setup
  const setupWebSocket = useCallback(async (authToken: string) => {
    if (globalState.socket) {
      return; // Already connected
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      let socketBaseUrl = apiUrl;
      let socketPath = '/socket.io';

      // Parse URL for WebSocket
      try {
        const parsed = new URL(apiUrl);
        socketBaseUrl = `${parsed.protocol}//${parsed.host}`;
        if (parsed.pathname && parsed.pathname !== '/') {
          socketPath = `${parsed.pathname.replace(/\/+$/, '')}/socket.io`;
        }
      } catch (error) {
        console.warn('Failed to parse WebSocket URL, using as-is');
      }

      const socket = io(socketBaseUrl, {
        path: socketPath,
        auth: { token: authToken },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelayMax: 30000,
        forceNew: true,
      });

      // WebSocket event handlers
      socket.on('connect', () => {
        globalState.socket = socket;
        globalState.isConnected = true;

        // Subscribe to real-time channels simultaneously
        socket.emit('subscribe_kol_trades');
        socket.emit('subscribe_all_token_activity');

        // Smart subscription: Subscribe to mindmap updates for relevant KOLs only
        subscribeToRelevantKOLs();

        // Legacy support: Subscribe to mindmap updates for trending tokens
        const tokensToSubscribe =
          globalState.data.trendingTokens.length > 0
            ? globalState.data.trendingTokens.slice(0, 5)
            : [];

        tokensToSubscribe.forEach(tokenMint => {
          if (!globalState.subscriptions.subscribedTokens.has(tokenMint)) {
            socket.emit('subscribe_mindmap', { tokenMint });
            globalState.subscriptions.subscribedTokens.add(tokenMint);
          }
        });

        notifyListeners();
      });

      socket.on('disconnect', () => {
        globalState.isConnected = false;
        notifyListeners();
      });

      socket.on('connect_error', () => {
        globalState.isConnected = false;
        notifyListeners();
      });

      // Real-time trade updates
      socket.on('kol_trade_update', (eventData: any) => {
        // Extract trade from event structure
        let trade: KOLTrade;
        if (eventData.trade) {
          trade = eventData.trade;
        } else if (eventData.event?.trade) {
          trade = eventData.event.trade;
        } else {
          trade = eventData;
        }

        // Add new trade with memory optimization
        globalState.data.trades = [
          trade,
          ...globalState.data.trades.slice(0, MAX_TRADES - 1),
        ];

        // Auto-subscribe to mindmap updates for the token in this trade (only if from relevant KOL)
        if (trade.tradeData?.mint && globalState.socket && trade.kolWallet) {
          const tokenMint = trade.tradeData.mint;
          const isRelevantKOL = globalState.subscriptions.relevantKOLs.includes(
            trade.kolWallet
          );

          if (
            isRelevantKOL &&
            !globalState.data.mindmapData[tokenMint] &&
            !globalState.subscriptions.subscribedTokens.has(tokenMint)
          ) {
            globalState.socket.emit('subscribe_mindmap', { tokenMint });
            globalState.subscriptions.subscribedTokens.add(tokenMint);
          }
        }

        // Update cache
        cacheManager.setTradeData('recent', globalState.data.trades, 300000);

        // Ensure mindmap subscriptions for active tokens
        ensureMindmapSubscriptions();

        // Cleanup old data periodically
        cleanupOldData();

        // Enrich metadata for the new trade
        enrichTradesMetadata([trade]);

        notifyListeners();
      });

      // Handle kol_trade_detected events (alternative event type)
      socket.on('kol_trade_detected', (eventData: any) => {
        // Extract trade from event structure
        let trade: KOLTrade;
        if (eventData.trade) {
          trade = eventData.trade;
        } else if (eventData.event?.trade) {
          trade = eventData.event.trade;
        } else {
          trade = eventData;
        }

        // Add new trade with memory optimization
        globalState.data.trades = [
          trade,
          ...globalState.data.trades.slice(0, MAX_TRADES - 1),
        ];

        // Auto-subscribe to mindmap updates for the token in this trade (only if from relevant KOL)
        if (trade.tradeData?.mint && globalState.socket && trade.kolWallet) {
          const tokenMint = trade.tradeData.mint;
          const isRelevantKOL = globalState.subscriptions.relevantKOLs.includes(
            trade.kolWallet
          );

          if (
            isRelevantKOL &&
            !globalState.data.mindmapData[tokenMint] &&
            !globalState.subscriptions.subscribedTokens.has(tokenMint)
          ) {
            globalState.socket.emit('subscribe_mindmap', { tokenMint });
            globalState.subscriptions.subscribedTokens.add(tokenMint);
          }
        }

        // Update cache
        cacheManager.setTradeData('recent', globalState.data.trades, 300000);

        // Ensure mindmap subscriptions for active tokens
        ensureMindmapSubscriptions();

        // Cleanup old data periodically
        cleanupOldData();

        // Enrich metadata for the new trade
        enrichTradesMetadata([trade]);

        notifyListeners();
      });

      // Real-time mindmap updates (from WebSocket, not bulk endpoint)
      socket.on('mindmap_update', (eventData: any) => {
        // Extract mindmap data from event structure
        let update: MindmapUpdate;
        if (eventData.data) {
          // Event wrapper structure with nested data object
          update = eventData.data;
        } else if (eventData.tokenMint) {
          // Direct mindmap structure
          update = eventData;
        } else {
          console.warn('Invalid mindmap update format:', eventData);
          return;
        }

        // Only store if we have space or it's already tracked
        const mindmapKeys = Object.keys(globalState.data.mindmapData);
        if (
          mindmapKeys.length < MAX_MINDMAP_ENTRIES ||
          globalState.data.mindmapData[update.tokenMint]
        ) {
          globalState.data.mindmapData[update.tokenMint] = update;
          cacheManager.setMindmapData(update.tokenMint, update, 600000);
        }

        cleanupOldData();
        notifyListeners();
      });

      // Handle initial_mindmap_data events (alternative event type)
      socket.on('initial_mindmap_data', (eventData: any) => {
        console.log('📊 Initial mindmap data received:', {
          eventData,
          hasData: !!eventData.data,
          hasTokenMint: !!eventData.tokenMint,
          currentMindmapCount: Object.keys(globalState.data.mindmapData).length,
        });

        // Extract mindmap data from event structure
        let update: MindmapUpdate;
        if (eventData.data) {
          update = eventData.data;
        } else if (eventData.tokenMint) {
          update = eventData;
        } else {
          console.warn('Invalid initial mindmap data format:', eventData);
          return;
        }

        console.log('📊 Processing mindmap update:', {
          tokenMint: update.tokenMint,
          kolConnectionsCount: Object.keys(update.kolConnections || {}).length,
          networkMetrics: update.networkMetrics,
        });

        // Store initial mindmap data
        const mindmapKeys = Object.keys(globalState.data.mindmapData);
        if (
          mindmapKeys.length < MAX_MINDMAP_ENTRIES ||
          globalState.data.mindmapData[update.tokenMint]
        ) {
          globalState.data.mindmapData[update.tokenMint] = update;
          cacheManager.setMindmapData(update.tokenMint, update, 600000);

          console.log('📊 Mindmap data stored:', {
            tokenMint: update.tokenMint,
            totalMindmapEntries: Object.keys(globalState.data.mindmapData)
              .length,
            kolConnections: Object.keys(update.kolConnections || {}).length,
          });
        } else {
          console.log('📊 Mindmap data rejected (limit reached):', {
            currentCount: mindmapKeys.length,
            maxEntries: MAX_MINDMAP_ENTRIES,
            tokenMint: update.tokenMint,
          });
        }

        cleanupOldData();
        notifyListeners();
      });

      // Handle subscription change events
      socket.on('subscription_updated', (eventData: any) => {
        console.log('📡 Subscription updated:', eventData);

        // Refresh subscriptions when user subscription status changes
        if (eventData.kolWallet) {
          const { kolWallet, isActive } = eventData;

          if (isActive) {
            // User subscribed to a KOL
            if (!globalState.subscriptions.subscribedKOLs.includes(kolWallet)) {
              globalState.subscriptions.subscribedKOLs.push(kolWallet);
              globalState.subscriptions.relevantKOLs = mergeKOLLists(
                globalState.subscriptions.featuredKOLs,
                globalState.subscriptions.subscribedKOLs
              );

              // Subscribe to mindmap updates for this KOL
              subscribeToKOLMindmap(kolWallet);
            }
          } else {
            // User unsubscribed from a KOL
            globalState.subscriptions.subscribedKOLs =
              globalState.subscriptions.subscribedKOLs.filter(
                kol => kol !== kolWallet
              );
            globalState.subscriptions.relevantKOLs = mergeKOLLists(
              globalState.subscriptions.featuredKOLs,
              globalState.subscriptions.subscribedKOLs
            );

            // Unsubscribe from mindmap updates for this KOL (only if not featured)
            if (!globalState.subscriptions.featuredKOLs.includes(kolWallet)) {
              unsubscribeFromKOLMindmap(kolWallet);
            }
          }

          notifyListeners();
        }
      });

      // Handle featured KOLs updates
      socket.on('featured_kols_updated', (eventData: any) => {
        console.log('🌟 Featured KOLs updated:', eventData);

        if (eventData.featuredKOLs) {
          const previousFeaturedKOLs = [
            ...globalState.subscriptions.featuredKOLs,
          ];
          globalState.subscriptions.featuredKOLs = eventData.featuredKOLs;
          globalState.subscriptions.relevantKOLs = mergeKOLLists(
            globalState.subscriptions.featuredKOLs,
            globalState.subscriptions.subscribedKOLs
          );

          // Handle subscription changes for featured KOLs
          const newFeaturedKOLs = globalState.subscriptions.featuredKOLs.filter(
            kol => !previousFeaturedKOLs.includes(kol)
          );
          const removedFeaturedKOLs = previousFeaturedKOLs.filter(
            kol => !globalState.subscriptions.featuredKOLs.includes(kol)
          );

          // Subscribe to new featured KOLs
          newFeaturedKOLs.forEach(kolWallet => {
            subscribeToKOLMindmap(kolWallet);
          });

          // Unsubscribe from removed featured KOLs (only if not subscribed by user)
          removedFeaturedKOLs.forEach(kolWallet => {
            if (!globalState.subscriptions.subscribedKOLs.includes(kolWallet)) {
              unsubscribeFromKOLMindmap(kolWallet);
            }
          });

          notifyListeners();
        }
      });

      // Generic event handler to catch mindmap-related events
      socket.onAny((eventName: string, ...args: any[]) => {
        if (eventName.includes('mindmap') || eventName.includes('network')) {
          console.log(`🗺️ Mindmap-related WebSocket event: ${eventName}`, args);
        }
      });

      // Real-time stats updates
      socket.on('stats_update', (newStats: any) => {
        globalState.data.stats = newStats;
        cacheManager.setStatsData('current', newStats, 600000);
        notifyListeners();
      });

      // Real-time trending tokens updates
      socket.on('trending_tokens_update', (tokens: string[]) => {
        // Limit trending tokens to prevent memory bloat
        const previousTokens = globalState.data.trendingTokens;
        globalState.data.trendingTokens = tokens.slice(0, 10);
        cacheManager.setTrendingTokens(globalState.data.trendingTokens, 900000);

        // Subscribe to mindmap updates for new trending tokens immediately (only if we have relevant KOLs)
        if (globalState.subscriptions.relevantKOLs.length > 0) {
          globalState.data.trendingTokens.slice(0, 5).forEach(tokenMint => {
            if (
              !previousTokens.includes(tokenMint) &&
              !globalState.data.mindmapData[tokenMint] &&
              !globalState.subscriptions.subscribedTokens.has(tokenMint)
            ) {
              socket.emit('subscribe_mindmap', { tokenMint });
              globalState.subscriptions.subscribedTokens.add(tokenMint);
            }
          });
        }

        notifyListeners();
      });

      globalState.socket = socket;
    } catch (error) {
      console.error('❌ WebSocket setup failed:', error);
    }
  }, []);

  // Single initialization function
  const initializeOnce = useCallback(async () => {
    if (globalState.hasInitialized || globalState.isInitializing) {
      return;
    }

    globalState.isInitializing = true;
    globalState.loadingPhase = 'essential';
    notifyListeners();

    try {
      const authToken =
        typeof window !== 'undefined'
          ? localStorage.getItem('authToken')
          : null;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // Fetch featured and subscribed KOLs for smart subscription management
      const [featuredKOLs, subscribedKOLs] = await Promise.all([
        fetchFeaturedKOLs(),
        fetchUserSubscribedKOLs(),
      ]);

      globalState.subscriptions.featuredKOLs = featuredKOLs;
      globalState.subscriptions.subscribedKOLs = subscribedKOLs;
      globalState.subscriptions.relevantKOLs = mergeKOLLists(
        featuredKOLs,
        subscribedKOLs
      );

      console.log('🎯 Smart KOL subscription initialized:', {
        featured: featuredKOLs.length,
        subscribed: subscribedKOLs.length,
        relevant: globalState.subscriptions.relevantKOLs.length,
      });

      // Check cache first
      const cachedTrades = cacheManager.getTradeData('recent');
      const cachedStats = cacheManager.getStatsData('current');
      const cachedTrending = cacheManager.getTrendingTokens();
      const cachedMindmap = cacheManager.getAllMindmapData();

      if (cachedTrades) {
        globalState.data.trades = cachedTrades.slice(0, MAX_TRADES);
      }
      if (cachedStats) {
        globalState.data.stats = cachedStats;
      }
      if (cachedTrending) {
        globalState.data.trendingTokens = cachedTrending.slice(0, 10);
      }
      if (Object.keys(cachedMindmap).length > 0) {
        // Hydrate mindmap data from cache
        Object.entries(cachedMindmap).forEach(([tokenMint, data]) => {
          globalState.data.mindmapData[tokenMint] = data;
        });
        console.log(`🧠 Hydrated mindmap with ${Object.keys(cachedMindmap).length} cached tokens`);
      }

      // If we have all cached data, use it and skip API calls
      if (cachedTrades && cachedStats && cachedTrending) {
        globalState.loadingPhase = 'complete';
        globalState.isLoadingInitialData = false;
        globalState.hasInitialized = true;
        globalState.isInitializing = false;
        notifyListeners();
        return;
      }

      // Call each endpoint only once
      // Import request manager for authenticated requests
      const { authenticatedRequest } = await import('@/lib/request-manager');

      const promises = [];

      if (!cachedTrades) {
        promises.push(
          authenticatedRequest(
            () =>
              axios.get(`${apiUrl}/api/kol-trades/recent?limit=${MAX_TRADES}`, {
                headers,
                timeout: 30000,
              }),
            { priority: 'high', timeout: 30000 }
          )
            .then(response => ({ type: 'trades', data: response.data }))
            .catch(error => ({ type: 'trades', error }))
        );
      }

      if (!cachedStats) {
        promises.push(
          authenticatedRequest(
            () =>
              axios.get(`${apiUrl}/api/kol-trades/stats`, {
                headers,
                timeout: 30000,
              }),
            { priority: 'medium', timeout: 30000 }
          )
            .then(response => ({ type: 'stats', data: response.data }))
            .catch(error => ({ type: 'stats', error }))
        );
      }

      if (!cachedTrending) {
        promises.push(
          authenticatedRequest(
            () =>
              axios.get(`${apiUrl}/api/kol-trades/trending-tokens?limit=10`, {
                headers,
                timeout: 30000,
              }),
            { priority: 'medium', timeout: 30000 }
          )
            .then(response => ({ type: 'trending', data: response.data }))
            .catch(error => ({ type: 'trending', error }))
        );
      }

      // Wait for all API calls to complete
      const results = await Promise.allSettled(promises);

      // Process results
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          const { type, data, error } = result.value;

          if (error) {
            return;
          }

          if (data?.success) {
            switch (type) {
              case 'trades':
                const trades = (data.data?.trades || []).slice(0, MAX_TRADES);
                globalState.data.trades = trades;
                cacheManager.setTradeData('recent', trades, 300000);
                break;

              case 'stats':
                const stats = data.data?.tradingStats || globalState.data.stats;
                globalState.data.stats = stats;
                cacheManager.setStatsData('current', stats, 600000);
                break;

              case 'trending':
                const tokens = (data.data?.trendingTokens || [])
                  .map((t: any) => t.tokenMint || t)
                  .slice(0, 10);
                globalState.data.trendingTokens = tokens;
                cacheManager.setTrendingTokens(tokens, 900000);
                break;
            }
          }
        }
      });

      // Load mindmap data for trending tokens synchronously with trades
      if (
        globalState.data.trendingTokens.length > 0 &&
        !globalState.mindmapInitialized
      ) {
        globalState.loadingPhase = 'enhanced'; // Changed from 'background' to 'enhanced'
        globalState.mindmapInitialized = true;
        notifyListeners();

        try {
          // Load mindmap data for trending tokens to ensure it's available with trades
          const mindmapResponse = await authenticatedRequest(
            () =>
              axios.post(
                `${apiUrl}/api/kol-trades/mindmap/bulk`,
                {
                  tokenMints: globalState.data.trendingTokens.slice(0, 5), // Increased to 5 for better coverage
                },
                {
                  headers,
                  timeout: 30000,
                }
              ),
            { priority: 'low', timeout: 30000 }
          );

          if (
            mindmapResponse.data?.success &&
            mindmapResponse.data.data?.mindmaps
          ) {
            mindmapResponse.data.data.mindmaps.forEach(
              (mindmap: MindmapUpdate) => {
                globalState.data.mindmapData[mindmap.tokenMint] = mindmap;
                cacheManager.setMindmapData(mindmap.tokenMint, mindmap, 600000);
              }
            );
          }
        } catch (error) {
          globalState.mindmapInitialized = false;
        }
      }

      // Ensure we move to background phase after mindmap loading
      globalState.loadingPhase = 'background';
      notifyListeners();

      // Set up WebSocket for real-time updates (after initial data is loaded)
      if (authToken) {
        await setupWebSocket(authToken);
      }
    } catch (error) {
      // Use mock data as fallback
      const mockData = getMockData();
      globalState.data.trades = mockData.trades;
      globalState.data.stats = mockData.stats;
      globalState.data.trendingTokens = mockData.trendingTokens;

      showError(
        'Using demo data',
        'Unable to connect to live data. Showing demo data for testing.'
      );
    } finally {
      globalState.loadingPhase = 'complete';
      globalState.isLoadingInitialData = false;
      globalState.hasInitialized = true;
      globalState.isInitializing = false;
      notifyListeners();
    }
  }, [getMockData, showError, setupWebSocket]);

  // Initialize once on first mount
  useEffect(() => {
    initializeOnce();

    // Set up periodic cleanup and subscription optimization
    const cleanupInterval = setInterval(cleanupOldData, CLEANUP_INTERVAL);
    const optimizationInterval = setInterval(
      optimizeSubscriptions,
      CLEANUP_INTERVAL * 2
    ); // Every 10 minutes

    return () => {
      clearInterval(cleanupInterval);
      clearInterval(optimizationInterval);
    };
  }, [initializeOnce]);

  return {
    socket: globalState.socket,
    isConnected: globalState.isConnected,
    recentTrades: globalState.data.trades,
    allMindmapData: globalState.data.mindmapData,
    trendingTokens: globalState.data.trendingTokens,
    isLoadingInitialData: globalState.isLoadingInitialData,
    loadingPhase: globalState.loadingPhase,
    connectionState: {
      isConnected: globalState.isConnected,
      isConnecting: false,
      retryCount: 0,
      lastError: null,
      connectionHealth: globalState.isConnected ? 'healthy' : 'unstable',
    },
    stats: globalState.data.stats,
    // Enhanced subscription management
    featuredKOLs: globalState.subscriptions.featuredKOLs,
    subscribedKOLs: globalState.subscriptions.subscribedKOLs,
    relevantKOLs: globalState.subscriptions.relevantKOLs,
    subscriptionManager: {
      subscribeToKOL: handleSubscribeToKOL,
      unsubscribeFromKOL: handleUnsubscribeFromKOL,
      refreshSubscriptions,
    },
  };
};