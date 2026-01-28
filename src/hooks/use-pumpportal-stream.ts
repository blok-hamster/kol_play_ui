'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

const PUMPPORTAL_WS_URL = 'wss://pumpportal.fun/api/data';

// PumpPortal WebSocket message types
export interface PumpPortalNewToken {
  signature: string;
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  description?: string;
  image?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  created_timestamp?: number;
}

export interface PumpPortalTrade {
  signature: string;
  mint: string;
  sol_amount: number;
  token_amount: number;
  is_buy: boolean;
  user: string;
  timestamp: number;
  slot: number;
  tx_index?: number;
}

export interface PumpPortalSubscription {
  method: 'subscribeNewToken' | 'subscribeTokenTrade' | 'unsubscribeTokenTrade';
  keys?: string[]; // Token mint addresses for trade subscriptions
}

interface UsePumpPortalStreamOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export const usePumpPortalStream = (options: UsePumpPortalStreamOptions = {}) => {
  const {
    autoConnect = false,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const connectingRef = useRef<boolean>(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentReconnectAttempts, setReconnectAttempts] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const newTokenCallbacksRef = useRef<Array<(token: PumpPortalNewToken) => void>>([]);
  const tradeCallbacksRef = useRef<Map<string, Array<(trade: PumpPortalTrade) => void>>>(
    new Map()
  );
  const isSubscribedToNewTokensRef = useRef(false);
  const subscribedTokensRef = useRef<Set<string>>(new Set());


  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (connectingRef.current) {
      return;
    }

    console.log('🔌 Connecting to PumpPortal WebSocket...');
    connectingRef.current = true;
    setIsConnecting(true);
    setError(null); // Clear previous errors on new connection attempt

    try {
      const ws = new WebSocket(PUMPPORTAL_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ PumpPortal WebSocket connected');
        connectingRef.current = false;
        setIsConnected(true);
        setIsConnecting(false);
        setReconnectAttempts(0);
        reconnectAttemptsRef.current = 0;

        // Resubscribe to channels after reconnection
        if (isSubscribedToNewTokensRef.current) {
          ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
          console.log('🔔 Resubscribed to new tokens');
        }

        subscribedTokensRef.current.forEach(mint => {
          ws.send(
            JSON.stringify({
              method: 'subscribeTokenTrade',
              keys: [mint],
            })
          );
          console.log(`🔔 Resubscribed to trades for ${mint}`);
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle new token events
          if (data.mint && data.name && data.symbol) {
            const token: PumpPortalNewToken = {
              signature: data.signature || '',
              mint: data.mint,
              name: data.name,
              symbol: data.symbol,
              uri: data.uri || '',
              description: data.description,
              image: data.image,
              twitter: data.twitter,
              telegram: data.telegram,
              website: data.website,
              created_timestamp: data.created_timestamp || Date.now(),
            };

            newTokenCallbacksRef.current.forEach(callback => callback(token));
          }

          // Handle trade events
          if (data.is_buy !== undefined && data.sol_amount !== undefined) {
            const trade: PumpPortalTrade = {
              signature: data.signature || '',
              mint: data.mint,
              sol_amount: data.sol_amount,
              token_amount: data.token_amount,
              is_buy: data.is_buy,
              user: data.user || '',
              timestamp: data.timestamp || Date.now(),
              slot: data.slot || 0,
              tx_index: data.tx_index,
            };

            const callbacks = tradeCallbacksRef.current.get(data.mint);
            if (callbacks) {
              callbacks.forEach(callback => callback(trade));
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('❌ PumpPortal WebSocket error:', err);
        connectingRef.current = false;
        // Don't call setError here to avoid infinite loop, onclose will handle reconnection logic
      };

      ws.onclose = () => {
        console.log('🔌 PumpPortal WebSocket disconnected');
        connectingRef.current = false;
        setIsConnected(false);
        setIsConnecting(false);

        // Attempt reconnection with exponential backoff
        const currentAttempt = reconnectAttemptsRef.current;
        if (currentAttempt < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, currentAttempt), 30000); // Max 30 seconds delay
          console.log(
            `🔄 Reconnecting in ${delay / 1000}s (attempt ${currentAttempt + 1}/${maxReconnectAttempts})...`
          );
          reconnectAttemptsRef.current = currentAttempt + 1;
          setReconnectAttempts(currentAttempt + 1);

          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached');
          setError(new Error('Failed to connect. PumpPortal API may be unavailable.'));
        }
      };
    } catch (err) {
      console.error('❌ Failed to create WebSocket:', err);
      connectingRef.current = false;
      setIsConnecting(false);
      setError(err instanceof Error ? err : new Error('Failed to create WebSocket connection'));
    }
  }, [maxReconnectAttempts]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting PumpPortal WebSocket...');

    // Reset reconnection attempts
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);

    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    isSubscribedToNewTokensRef.current = false;
    subscribedTokensRef.current.clear();
    newTokenCallbacksRef.current = [];
    tradeCallbacksRef.current.clear();

    setIsConnected(false);
    setIsConnecting(false);
    setReconnectAttempts(0);
    setError(null);
  }, []);

  // Subscribe to new token events
  const subscribeNewTokens = useCallback((callback: (token: PumpPortalNewToken) => void) => {
    newTokenCallbacksRef.current.push(callback);

    if (wsRef.current?.readyState === WebSocket.OPEN && !isSubscribedToNewTokensRef.current) {
      wsRef.current.send(JSON.stringify({ method: 'subscribeNewToken' }));
      isSubscribedToNewTokensRef.current = true;
      console.log('🔔 Subscribed to new tokens');
    }

    // Return unsubscribe function
    return () => {
      newTokenCallbacksRef.current = newTokenCallbacksRef.current.filter(cb => cb !== callback);
    };
  }, []);

  // Subscribe to token trades
  const subscribeTokenTrades = useCallback(
    (mint: string, callback: (trade: PumpPortalTrade) => void) => {
      const callbacks = tradeCallbacksRef.current.get(mint) || [];
      callbacks.push(callback);
      tradeCallbacksRef.current.set(mint, callbacks);

      if (wsRef.current?.readyState === WebSocket.OPEN && !subscribedTokensRef.current.has(mint)) {
        wsRef.current.send(
          JSON.stringify({
            method: 'subscribeTokenTrade',
            keys: [mint],
          })
        );
        subscribedTokensRef.current.add(mint);
        console.log(`🔔 Subscribed to trades for ${mint}`);
      }

      // Return unsubscribe function
      return () => {
        const cbs = tradeCallbacksRef.current.get(mint) || [];
        const filtered = cbs.filter(cb => cb !== callback);

        if (filtered.length === 0) {
          tradeCallbacksRef.current.delete(mint);

          if (wsRef.current?.readyState === WebSocket.OPEN && subscribedTokensRef.current.has(mint)) {
            wsRef.current.send(
              JSON.stringify({
                method: 'unsubscribeTokenTrade',
                keys: [mint],
              })
            );
            subscribedTokensRef.current.delete(mint);
            console.log(`🔕 Unsubscribed from trades for ${mint}`);
          }
        } else {
          tradeCallbacksRef.current.set(mint, filtered);
        }
      };
    },
    []
  );

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connect,
    disconnect,
    subscribeNewTokens,
    subscribeTokenTrades,
    isConnected,
    isConnecting,
    reconnectAttempts: currentReconnectAttempts,
    error,
  };
};
