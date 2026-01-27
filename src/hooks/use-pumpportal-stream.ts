'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

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

interface StreamStatus {
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  error: Error | null;
}

export const usePumpPortalStream = (options: UsePumpPortalStreamOptions = {}) => {
  const {
    autoConnect = false,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const subscribedTokensRef = useRef<Set<string>>(new Set());
  const isSubscribedToNewTokensRef = useRef(false);

  // Callback refs to avoid stale closures
  const newTokenCallbacksRef = useRef<Array<(token: PumpPortalNewToken) => void>>([]);
  const tradeCallbacksRef = useRef<Map<string, Array<(trade: PumpPortalTrade) => void>>>(
    new Map()
  );

  const [status, setStatus] = useState<StreamStatus>({
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
    error: null,
  });

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || status.isConnecting) {
      return;
    }

    setStatus(prev => ({ ...prev, isConnecting: true, error: null }));
    console.log('🔌 Connecting to PumpPortal WebSocket...');

    try {
      const ws = new WebSocket('wss://pumpportal.fun/api/data');

      ws.onopen = () => {
        console.log('✅ PumpPortal WebSocket connected');
        setStatus({
          isConnected: true,
          isConnecting: false,
          reconnectAttempts: 0,
          error: null,
        });
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
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ PumpPortal WebSocket error:', error);
        setStatus(prev => ({
          ...prev,
          error: new Error('WebSocket connection error'),
        }));
      };

      ws.onclose = () => {
        console.log('🔌 PumpPortal WebSocket disconnected');
        setStatus(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));

        wsRef.current = null;

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          setStatus(prev => ({
            ...prev,
            reconnectAttempts: reconnectAttemptsRef.current,
          }));

          console.log(
            `🔄 Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          console.error('❌ Max reconnection attempts reached');
          setStatus(prev => ({
            ...prev,
            error: new Error('Max reconnection attempts reached'),
          }));
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setStatus(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error : new Error('Connection failed'),
      }));
    }
  }, [status.isConnecting, reconnectInterval, maxReconnectAttempts]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    isSubscribedToNewTokensRef.current = false;
    subscribedTokensRef.current.clear();
    newTokenCallbacksRef.current = [];
    tradeCallbacksRef.current.clear();

    setStatus({
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      error: null,
    });
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
    status,
    isConnected: status.isConnected,
    isConnecting: status.isConnecting,
    error: status.error,
  };
};
