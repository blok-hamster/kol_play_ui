'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  getRealTimeSyncService,
  UpdateBatch,
  SyncUpdate,
} from '@/services/realtime-sync.service';
import { KOLTrade, MindmapUpdate } from '@/types';
import { cacheManager } from '@/lib/cache-manager';

export interface EnhancedWebSocketConfig {
  url?: string;
  path?: string;
  auth?: {
    token?: string;
  };
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelayMax?: number;
  timeout?: number;
  batchInterval?: number;
  maxBatchSize?: number;
  healthCheckInterval?: number;
  pollingFallbackInterval?: number;
}

export interface WebSocketHealth {
  isConnected: boolean;
  isConnecting: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'critical';
  latency: number;
  missedHeartbeats: number;
  lastHeartbeat: number;
  isPollingMode: boolean;
}

export interface EnhancedWebSocketReturn {
  socket: Socket | null;
  health: WebSocketHealth;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
  send: (event: string, data: any) => boolean;
  onBatchUpdate: (callback: (batch: UpdateBatch) => void) => () => void;
}

export const useEnhancedWebSocket = (
  config: EnhancedWebSocketConfig = {}
): EnhancedWebSocketReturn => {
  const {
    url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    path = '/socket.io',
    auth,
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelayMax = 30000,
    timeout = 20000,
    batchInterval = 100,
    maxBatchSize = 50,
    healthCheckInterval = 5000,
    pollingFallbackInterval = 10000,
  } = config;

  // State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [health, setHealth] = useState<WebSocketHealth>({
    isConnected: false,
    isConnecting: false,
    connectionQuality: 'excellent',
    latency: 0,
    missedHeartbeats: 0,
    lastHeartbeat: Date.now(),
    isPollingMode: false,
  });

  // Refs
  const syncServiceRef = useRef(
    getRealTimeSyncService({
      batchInterval,
      maxBatchSize,
      healthCheckInterval,
      pollingFallbackInterval,
    })
  );
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const latencyMeasurementRef = useRef<Map<string, number>>(new Map());
  const subscribedChannelsRef = useRef<Set<string>>(new Set());
  const batchCallbacksRef = useRef<Map<string, (batch: UpdateBatch) => void>>(
    new Map()
  );

  /**
   * Measure connection latency
   */
  const measureLatency = useCallback((socket: Socket) => {
    const pingId = `ping_${Date.now()}_${Math.random()}`;
    const startTime = Date.now();

    latencyMeasurementRef.current.set(pingId, startTime);
    socket.emit('ping', { id: pingId, timestamp: startTime });
  }, []);

  /**
   * Start heartbeat monitoring
   */
  const startHeartbeat = useCallback(
    (socket: Socket) => {
      heartbeatIntervalRef.current = setInterval(() => {
        if (socket.connected) {
          measureLatency(socket);
        }
      }, healthCheckInterval);
    },
    [healthCheckInterval, measureLatency]
  );

  /**
   * Stop heartbeat monitoring
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  /**
   * Update health status
   */
  const updateHealth = useCallback((updates: Partial<WebSocketHealth>) => {
    setHealth(prev => {
      const newHealth = { ...prev, ...updates };

      // Update sync service with connection health
      const syncService = syncServiceRef.current;
      syncService.updateConnectionHealth(
        newHealth.isConnected,
        newHealth.latency
      );

      return newHealth;
    });
  }, []);

  /**
   * Handle WebSocket events with batching
   */
  const setupEventHandlers = useCallback(
    (socket: Socket) => {
      // Connection events
      socket.on('connect', () => {
        console.log('✅ Enhanced WebSocket connected');
        updateHealth({
          isConnected: true,
          isConnecting: false,
          lastHeartbeat: Date.now(),
          missedHeartbeats: 0,
        });

        // Re-subscribe to channels
        const channels = Array.from(subscribedChannelsRef.current);
        if (channels.length > 0) {
          channels.forEach(channel => {
            socket.emit('subscribe', { channel });
          });
        }

        startHeartbeat(socket);
      });

      socket.on('disconnect', reason => {
        console.log(`❌ Enhanced WebSocket disconnected: ${reason}`);
        updateHealth({
          isConnected: false,
          isConnecting: false,
        });
        stopHeartbeat();
      });

      socket.on('connect_error', error => {
        console.error('❌ Enhanced WebSocket connection error:', error);
        updateHealth({
          isConnected: false,
          isConnecting: false,
          connectionQuality: 'critical',
        });
      });

      // Latency measurement
      socket.on('pong', (data: { id: string; timestamp: number }) => {
        const startTime = latencyMeasurementRef.current.get(data.id);
        if (startTime) {
          const latency = Date.now() - startTime;
          latencyMeasurementRef.current.delete(data.id);

          updateHealth({
            latency,
            lastHeartbeat: Date.now(),
            missedHeartbeats: 0,
            connectionQuality:
              latency < 100
                ? 'excellent'
                : latency < 300
                  ? 'good'
                  : latency < 1000
                    ? 'poor'
                    : 'critical',
          });
        }
      });

      // Enhanced data events with better batching and error handling
      socket.on('kol_trade_update', (trade: KOLTrade) => {
        try {
          const syncService = syncServiceRef.current;
          syncService.addTradeUpdate(trade, 'websocket');
        } catch (error) {
          console.error('Error processing trade update:', error);
        }
      });

      socket.on('mindmap_update', (mindmapUpdate: MindmapUpdate) => {
        try {
          const syncService = syncServiceRef.current;
          syncService.addMindmapUpdate(mindmapUpdate, 'websocket');
        } catch (error) {
          console.error('Error processing mindmap update:', error);
        }
      });

      // Enhanced bulk update handling with batching optimization
      socket.on('bulk_trade_updates', (trades: KOLTrade[]) => {
        try {
          const syncService = syncServiceRef.current;

          // Process in smaller chunks to prevent overwhelming the system
          const chunkSize = 25;
          for (let i = 0; i < trades.length; i += chunkSize) {
            const chunk = trades.slice(i, i + chunkSize);

            // Add slight delay between chunks for large batches
            if (i > 0 && trades.length > 50) {
              setTimeout(
                () => {
                  chunk.forEach(trade =>
                    syncService.addTradeUpdate(trade, 'websocket')
                  );
                },
                Math.floor(i / chunkSize) * 10
              ); // 10ms delay per chunk
            } else {
              chunk.forEach(trade =>
                syncService.addTradeUpdate(trade, 'websocket')
              );
            }
          }
        } catch (error) {
          console.error('Error processing bulk trade updates:', error);
        }
      });

      socket.on('bulk_mindmap_updates', (updates: MindmapUpdate[]) => {
        try {
          const syncService = syncServiceRef.current;

          // Process mindmap updates with priority handling
          const priorityUpdates = updates.filter(
            update => update.networkMetrics?.totalTrades > 100
          );
          const regularUpdates = updates.filter(
            update =>
              !update.networkMetrics || update.networkMetrics.totalTrades <= 100
          );

          // Process priority updates first
          priorityUpdates.forEach(update =>
            syncService.addMindmapUpdate(update, 'websocket')
          );

          // Process regular updates with slight delay
          setTimeout(() => {
            regularUpdates.forEach(update =>
              syncService.addMindmapUpdate(update, 'websocket')
            );
          }, 50);
        } catch (error) {
          console.error('Error processing bulk mindmap updates:', error);
        }
      });

      socket.on('stats_update', (stats: any) => {
        try {
          const syncService = syncServiceRef.current;
          syncService.addUpdate({
            type: 'stats',
            data: stats,
            source: 'websocket',
            priority: 'medium',
          });
        } catch (error) {
          console.error('Error processing stats update:', error);
        }
      });

      socket.on('trending_tokens_update', (tokens: string[]) => {
        try {
          const syncService = syncServiceRef.current;
          syncService.addUpdate({
            type: 'trending',
            data: tokens,
            source: 'websocket',
            priority: 'low',
          });
        } catch (error) {
          console.error('Error processing trending tokens update:', error);
        }
      });

      // Enhanced connection monitoring events
      socket.on(
        'connection_quality_update',
        (qualityData: { latency: number; quality: string }) => {
          updateHealth({
            latency: qualityData.latency,
            connectionQuality: qualityData.quality as any,
          });
        }
      );

      socket.on('server_overload', (data: { recommendedAction: string }) => {
        console.warn('⚠️ Server overload detected:', data.recommendedAction);

        if (data.recommendedAction === 'reduce_frequency') {
          // Temporarily increase batch intervals
          const syncService = syncServiceRef.current;
          // This would require exposing a method to adjust intervals
        }
      });

      // Handle polling fallback
      socket.on('connection_degraded', () => {
        console.warn('⚠️ Connection degraded, may switch to polling mode');
        updateHealth({ connectionQuality: 'poor' });
      });
    },
    [updateHealth, startHeartbeat, stopHeartbeat]
  );

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(async (): Promise<void> => {
    if (health.isConnected || health.isConnecting) {
      return;
    }

    updateHealth({ isConnecting: true });

    try {
      let socketBaseUrl = url;
      let socketPath = path;

      // Parse URL if needed
      try {
        const parsed = new URL(url);
        socketBaseUrl = `${parsed.protocol}//${parsed.host}`;
        if (
          parsed.pathname &&
          parsed.pathname !== '/' &&
          path === '/socket.io'
        ) {
          socketPath = `${parsed.pathname.replace(/\/+$/, '')}/socket.io`;
        }
      } catch (error) {
        console.warn('⚠️ Failed to parse WebSocket URL, using as-is');
      }

      const socketOptions: any = {
        path: socketPath,
        transports: ['websocket', 'polling'],
        timeout,
        withCredentials: true,
        reconnection,
        reconnectionAttempts,
        reconnectionDelayMax,
        forceNew: true,
      };

      if (auth?.token) {
        socketOptions.auth = { token: auth.token };
      }

      const newSocket = io(socketBaseUrl, socketOptions);

      setupEventHandlers(newSocket);
      setSocket(newSocket);

      // Wait for connection
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        newSocket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        newSocket.on('connect_error', error => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      updateHealth({
        isConnecting: false,
        connectionQuality: 'critical',
      });
      throw error;
    }
  }, [
    health.isConnected,
    health.isConnecting,
    url,
    path,
    auth,
    timeout,
    reconnection,
    reconnectionAttempts,
    reconnectionDelayMax,
    setupEventHandlers,
    updateHealth,
  ]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    stopHeartbeat();
    updateHealth({
      isConnected: false,
      isConnecting: false,
    });
  }, [socket, stopHeartbeat, updateHealth]);

  /**
   * Subscribe to channels
   */
  const subscribe = useCallback(
    (channels: string[]) => {
      channels.forEach(channel => {
        subscribedChannelsRef.current.add(channel);
        if (socket?.connected) {
          socket.emit('subscribe', { channel });
        }
      });
    },
    [socket]
  );

  /**
   * Unsubscribe from channels
   */
  const unsubscribe = useCallback(
    (channels: string[]) => {
      channels.forEach(channel => {
        subscribedChannelsRef.current.delete(channel);
        if (socket?.connected) {
          socket.emit('unsubscribe', { channel });
        }
      });
    },
    [socket]
  );

  /**
   * Send message
   */
  const send = useCallback(
    (event: string, data: any): boolean => {
      if (socket?.connected) {
        socket.emit(event, data);
        return true;
      }
      return false;
    },
    [socket]
  );

  /**
   * Register callback for batched updates
   */
  const onBatchUpdate = useCallback(
    (callback: (batch: UpdateBatch) => void): (() => void) => {
      const id = `callback_${Date.now()}_${Math.random()}`;
      batchCallbacksRef.current.set(id, callback);

      const syncService = syncServiceRef.current;
      syncService.subscribe(id, callback);

      // Return unsubscribe function
      return () => {
        batchCallbacksRef.current.delete(id);
        syncService.unsubscribe(id);
      };
    },
    []
  );

  /**
   * Enhanced polling fallback with adaptive intervals and better error handling
   */
  const handlePollingFallback = useCallback(async () => {
    if (health.isPollingMode) return;

    console.warn('🔄 Switching to enhanced polling mode');
    updateHealth({ isPollingMode: true });

    let currentPollingInterval = pollingFallbackInterval;
    let consecutiveFailures = 0;
    const maxFailures = 5;
    const backoffMultiplier = 1.5;
    const maxPollingInterval = 60000; // 1 minute max

    // Enhanced polling logic with adaptive intervals
    const pollData = async () => {
      try {
        const apiUrl = url.replace(/^ws/, 'http');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (auth?.token) {
          headers['Authorization'] = `Bearer ${auth.token}`;
        }

        // Parallel polling for better performance
        const [tradesResponse, statsResponse, trendingResponse] =
          await Promise.allSettled([
            fetch(`${apiUrl}/api/kol-trades/recent?limit=20`, {
              headers,
              signal: AbortSignal.timeout(5000), // 5 second timeout
            }),
            fetch(`${apiUrl}/api/kol-trades/stats`, {
              headers,
              signal: AbortSignal.timeout(5000),
            }),
            fetch(`${apiUrl}/api/kol-trades/trending-tokens?limit=10`, {
              headers,
              signal: AbortSignal.timeout(5000),
            }),
          ]);

        const syncService = syncServiceRef.current;
        let successCount = 0;

        // Process trades response
        if (tradesResponse.status === 'fulfilled' && tradesResponse.value.ok) {
          const tradesData = await tradesResponse.value.json();
          if (tradesData.success && tradesData.data?.trades) {
            tradesData.data.trades.forEach((trade: KOLTrade) => {
              syncService.addTradeUpdate(trade, 'polling');
            });
            successCount++;
          }
        }

        // Process stats response
        if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
          const statsData = await statsResponse.value.json();
          if (statsData.success && statsData.data) {
            syncService.addUpdate({
              type: 'stats',
              data: statsData.data,
              source: 'polling',
              priority: 'medium',
            });
            successCount++;
          }
        }

        // Process trending tokens response
        if (
          trendingResponse.status === 'fulfilled' &&
          trendingResponse.value.ok
        ) {
          const trendingData = await trendingResponse.value.json();
          if (trendingData.success && trendingData.data?.trendingTokens) {
            syncService.addUpdate({
              type: 'trending',
              data: trendingData.data.trendingTokens.map(
                (t: any) => t.tokenMint || t
              ),
              source: 'polling',
              priority: 'low',
            });
            successCount++;
          }
        }

        // Adaptive interval adjustment based on success rate
        if (successCount > 0) {
          consecutiveFailures = 0;
          // Gradually decrease interval on success (but not below minimum)
          currentPollingInterval = Math.max(
            pollingFallbackInterval,
            currentPollingInterval * 0.9
          );
        } else {
          consecutiveFailures++;
        }

        // Update connection health based on polling success
        const connectionQuality =
          successCount === 3
            ? 'good'
            : successCount === 2
              ? 'poor'
              : 'critical';

        updateHealth({
          connectionQuality,
          latency: currentPollingInterval, // Use polling interval as pseudo-latency
        });
      } catch (error) {
        console.error('Enhanced polling failed:', error);
        consecutiveFailures++;

        // Exponential backoff on consecutive failures
        if (consecutiveFailures >= maxFailures) {
          currentPollingInterval = Math.min(
            currentPollingInterval * backoffMultiplier,
            maxPollingInterval
          );
          consecutiveFailures = 0; // Reset counter after backoff
        }

        updateHealth({ connectionQuality: 'critical' });
      }
    };

    // Start polling with adaptive interval
    let pollingTimer: NodeJS.Timeout;

    const scheduleNextPoll = () => {
      pollingTimer = setTimeout(() => {
        pollData().then(() => {
          if (health.isPollingMode) {
            // Only continue if still in polling mode
            scheduleNextPoll();
          }
        });
      }, currentPollingInterval);
    };

    // Start first poll immediately
    pollData().then(() => {
      if (health.isPollingMode) {
        scheduleNextPoll();
      }
    });

    // Return cleanup function
    return () => {
      if (pollingTimer) {
        clearTimeout(pollingTimer);
      }
      updateHealth({ isPollingMode: false });
    };
  }, [health.isPollingMode, url, auth, pollingFallbackInterval, updateHealth]);

  /**
   * Monitor connection health and switch to polling if needed
   */
  useEffect(() => {
    const syncService = syncServiceRef.current;

    const healthCheckInterval = setInterval(() => {
      const syncHealth = syncService.getConnectionHealth();

      if (!syncHealth.isHealthy && !health.isPollingMode) {
        handlePollingFallback();
      }
    }, 5000);

    return () => clearInterval(healthCheckInterval);
  }, [health.isPollingMode, handlePollingFallback]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      disconnect();
      const syncService = syncServiceRef.current;
      syncService.destroy();
    };
  }, [disconnect]);

  return {
    socket,
    health,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    send,
    onBatchUpdate,
  };
};
