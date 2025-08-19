'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { useNotifications } from '@/stores/use-ui-store';
import { PredictionResult } from '@/types';
import { cacheManager } from '@/lib/cache-manager';

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

// Function to ensure mindmap subscription for active tokens
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
    if (!globalState.data.mindmapData[tokenMint]) {
      globalState.socket!.emit('subscribe_mindmap', { tokenMint });
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

        // Subscribe to mindmap updates for all available trending tokens immediately
        // This ensures mindmap data is available when trades start coming in
        const tokensToSubscribe =
          globalState.data.trendingTokens.length > 0
            ? globalState.data.trendingTokens.slice(0, 5)
            : ['default']; // Subscribe to a default channel if no trending tokens yet

        tokensToSubscribe.forEach(tokenMint => {
          socket.emit('subscribe_mindmap', { tokenMint });
        });

        // Also subscribe to general mindmap updates
        socket.emit('subscribe_all_mindmap_updates');

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

        // Auto-subscribe to mindmap updates for the token in this trade
        if (trade.tradeData?.mint && globalState.socket) {
          const tokenMint = trade.tradeData.mint;
          if (!globalState.data.mindmapData[tokenMint]) {
            globalState.socket.emit('subscribe_mindmap', { tokenMint });
          }
        }

        // Update cache
        cacheManager.setTradeData('recent', globalState.data.trades, 300000);

        // Ensure mindmap subscriptions for active tokens
        ensureMindmapSubscriptions();

        // Cleanup old data periodically
        cleanupOldData();

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

        // Auto-subscribe to mindmap updates for the token in this trade
        if (trade.tradeData?.mint && globalState.socket) {
          const tokenMint = trade.tradeData.mint;
          if (!globalState.data.mindmapData[tokenMint]) {
            globalState.socket.emit('subscribe_mindmap', { tokenMint });
          }
        }

        // Update cache
        cacheManager.setTradeData('recent', globalState.data.trades, 300000);

        // Ensure mindmap subscriptions for active tokens
        ensureMindmapSubscriptions();

        // Cleanup old data periodically
        cleanupOldData();

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

        // Subscribe to mindmap updates for new trending tokens immediately
        globalState.data.trendingTokens.slice(0, 5).forEach(tokenMint => {
          if (
            !previousTokens.includes(tokenMint) &&
            !globalState.data.mindmapData[tokenMint]
          ) {
            socket.emit('subscribe_mindmap', { tokenMint });
          }
        });

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

      // Check cache first
      const cachedTrades = cacheManager.getTradeData('recent');
      const cachedStats = cacheManager.getStatsData('current');
      const cachedTrending = cacheManager.getTrendingTokens();

      if (cachedTrades) {
        globalState.data.trades = cachedTrades.slice(0, MAX_TRADES);
      }
      if (cachedStats) {
        globalState.data.stats = cachedStats;
      }
      if (cachedTrending) {
        globalState.data.trendingTokens = cachedTrending.slice(0, 10);
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
      const promises = [];

      if (!cachedTrades) {
        promises.push(
          axios
            .get(`${apiUrl}/api/kol-trades/recent?limit=${MAX_TRADES}`, {
              headers,
              timeout: 30000,
            })
            .then(response => ({ type: 'trades', data: response.data }))
            .catch(error => ({ type: 'trades', error }))
        );
      }

      if (!cachedStats) {
        promises.push(
          axios
            .get(`${apiUrl}/api/kol-trades/stats`, {
              headers,
              timeout: 30000,
            })
            .then(response => ({ type: 'stats', data: response.data }))
            .catch(error => ({ type: 'stats', error }))
        );
      }

      if (!cachedTrending) {
        promises.push(
          axios
            .get(`${apiUrl}/api/kol-trades/trending-tokens?limit=10`, {
              headers,
              timeout: 30000,
            })
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
          const mindmapResponse = await axios.post(
            `${apiUrl}/api/kol-trades/mindmap/bulk`,
            {
              tokenMints: globalState.data.trendingTokens.slice(0, 5), // Increased to 5 for better coverage
            },
            {
              headers,
              timeout: 30000,
            }
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

    // Set up periodic cleanup
    const cleanupInterval = setInterval(cleanupOldData, CLEANUP_INTERVAL);

    return () => {
      clearInterval(cleanupInterval);
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
  };
};
