'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  getWebSocketService,
  WebSocketEventHandlers,
  WebSocketConfig,
} from '@/services/websocket.service';
import { getRealTimeUpdateService } from '@/services/realtime-update.service';
import {
  useTradingStore,
  useUserStore,
  useUIStore,
  useNotificationStore,
} from '@/stores';
import { KOLTrade, TradeAlert } from '@/types';

export interface UseWebSocketOptions {
  config?: Partial<WebSocketConfig>;
  autoConnect?: boolean;
  subscriptions?: {
    trades?: boolean;
    notifications?: boolean;
    priceUpdates?: boolean;
    balanceUpdates?: boolean;
    tokens?: string[];
    kols?: string[];
  };
}

export interface WebSocketStatus {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  error: Error | null;
  messageQueueSize: number;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    config,
    autoConnect = true,
    subscriptions = {
      trades: true,
      notifications: true,
      priceUpdates: true,
      balanceUpdates: true,
    },
  } = options;
  
  // Memoize subscriptions and config to avoid identity changes if the parent passes object literals
  const memoizedSubscriptions = useMemo(() => subscriptions, [
    subscriptions.trades,
    subscriptions.notifications,
    subscriptions.priceUpdates,
    subscriptions.balanceUpdates
  ]);
  
  const memoizedConfig = useMemo(() => config, [JSON.stringify(config)]);

  // Store references
  // Store references with stable selectors
  const setTradingError = useTradingStore(s => s.setError);
  const isAuthenticated = useUserStore(s => s.isAuthenticated);
  const addNotification = useUIStore(s => s.addNotification);
  const addBackendNotification = useNotificationStore(s => s.addNotification);

  // Local state for connection status
  const [status, setStatus] = useState<WebSocketStatus>({
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    reconnectAttempts: 0,
    error: null,
    messageQueueSize: 0,
  });

  // Service references
  const serviceRef = useRef(getWebSocketService(memoizedConfig));
  const updateServiceRef = useRef(getRealTimeUpdateService());
  const isSubscribedRef = useRef(false);

  // Update connection status
  const updateStatus = useCallback(() => {
    const service = serviceRef.current;
    const serviceStatus = service.getStatus();

    setStatus(prevStatus => ({
      ...prevStatus,
      isConnected: serviceStatus.isConnected,
      isConnecting: serviceStatus.isConnecting,
      reconnectAttempts: serviceStatus.reconnectAttempts,
      messageQueueSize: serviceStatus.messageQueueSize,
    }));
  }, []);

  // WebSocket event handlers with real-time update integration
  const handleTradeUpdate = useCallback(
    (trade: KOLTrade) => {
      // console.log('Received trade update:', trade);

      // Route through real-time update service for batching
      const updateService = updateServiceRef.current;
      updateService.addTradeUpdate(trade);
    },
    []
  );

  const handlePriceUpdate = useCallback(
    (data: { mint: string; price: number; change24h: number }) => {
      // console.log('Received price update:', data);

      // Route through real-time update service for batching and change detection
      const updateService = updateServiceRef.current;
      updateService.addPriceUpdate(data.mint, data.price, data.change24h);
    },
    []
  );

  const handleBalanceUpdate = useCallback(
    (data: { balance: number; timestamp: number }) => {
      // console.log('Received balance update:', data);

      // Route through real-time update service for batching
      const updateService = updateServiceRef.current;
      updateService.addBalanceUpdate(data.balance);
    },
    []
  );

  const handleNotification = useCallback(
    (notification: TradeAlert | any) => {
      // console.log('Received notification:', notification);

      // Handle different notification formats
      if (notification.id && notification.type && notification.title) {
        // Backend notification format - add to notification store
        addBackendNotification(notification);

        // Also show as toast for immediate visibility
        addNotification({
          type:
            notification.priority === 'urgent'
              ? 'error'
              : notification.priority === 'high'
                ? 'warning'
                : 'info',
          title: notification.title,
          message: notification.message,
        });
      } else if (notification.notification) {
        // Legacy trade alert format - show as toast
        addNotification({
          type: 'info',
          title: 'Trade Notification',
          message: notification.notification,
        });
      }
    },
    [addNotification, addBackendNotification]
  );

  const handleUserEvent = useCallback(
    (event: any) => {
      // console.log('Received user event:', event);
      // This is a generic handler for any user-specific events
      // Specific logic (like balance update) is already handled in service mapping
      // but we can add more logic here if needed.
    },
    []
  );

  const handleConnect = useCallback(() => {
    // console.log('WebSocket connected');
    setStatus(prev => ({
      ...prev,
      isConnected: true,
      isConnecting: false,
      isReconnecting: false,
      error: null,
    }));

    // Subscribe to channels after connection
    if (!isSubscribedRef.current && memoizedSubscriptions) {
      const service = serviceRef.current;
      // Use latest subscriptions from a ref to avoid dependency loop
      service.subscribe(memoizedSubscriptions);
      isSubscribedRef.current = true;
    }
  }, [memoizedSubscriptions]); // memoizedSubscriptions is now stable

  const handleDisconnect = useCallback(() => {
    // console.log('WebSocket disconnected');
    setStatus(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
    }));
    isSubscribedRef.current = false;
  }, []);

  const handleError = useCallback(
    (error: Error) => {
      // Suppress noisy logs for connection errors (common when backend is down)
      const isConnectionError = 
        error.message === 'websocket error' || 
        error.message === 'xhr poll error' || 
        error.message?.includes('TransportError');

      if (!isConnectionError) {
        console.error('WebSocket error:', error);
      }
      
      setStatus(prev => ({
        ...prev,
        error,
        isConnected: false,
        isConnecting: false,
        isReconnecting: false,
      }));
      
      // Still set the error in the store, but maybe with a friendly message if needed
      setTradingError(isConnectionError ? 'Connection lost' : error.message);
    },
    [setTradingError]
  );

  const handleReconnecting = useCallback((attempt: number) => {
    // console.log('WebSocket reconnecting, attempt:', attempt);
    setStatus(prev => ({
      ...prev,
      isReconnecting: true,
      reconnectAttempts: attempt,
    }));
  }, []);

  // Connect function
  const connect = useCallback(async () => {
    // Check current status without making the effect depend on the whole status object
    const service = serviceRef.current;
    const currentStatus = service.getStatus();
    
    if (currentStatus.isConnected || currentStatus.isConnecting) {
      return;
    }

    setStatus(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Set up event handlers
      const handlers: WebSocketEventHandlers = {
        onTradeUpdate: handleTradeUpdate,
        onPriceUpdate: handlePriceUpdate,
        onBalanceUpdate: handleBalanceUpdate,
        onNotification: handleNotification,
        onConnect: handleConnect,
        onDisconnect: handleDisconnect,
        onError: handleError,
        onReconnecting: handleReconnecting,
        onUserEvent: handleUserEvent,
      };

      service.on(handlers);
      await service.connect();
    } catch (error) {
      const connectionError =
        error instanceof Error ? error : new Error('Connection failed');
      handleError(connectionError);
    }
  }, [
    handleTradeUpdate,
    handlePriceUpdate,
    handleBalanceUpdate,
    handleNotification,
    handleConnect,
    handleDisconnect,
    handleError,
    handleReconnecting,
  ]);

  // Disconnect function
  const disconnect = useCallback(() => {
    const service = serviceRef.current;
    service.disconnect();
    isSubscribedRef.current = false;
  }, []);

  // Subscribe function
  const subscribe = useCallback(
    (newSubscriptions: {
      trades?: boolean;
      notifications?: boolean;
      priceUpdates?: boolean;
      balanceUpdates?: boolean;
      tokens?: string[];
      kols?: string[];
    }) => {
      const service = serviceRef.current;
      return service.subscribe(newSubscriptions);
    },
    []
  );

  // Unsubscribe function
  const unsubscribe = useCallback(
    (subscriptionsToRemove: {
      trades?: boolean;
      notifications?: boolean;
      priceUpdates?: boolean;
      balanceUpdates?: boolean;
      tokens?: string[];
      kols?: string[];
    }) => {
      const service = serviceRef.current;
      return service.unsubscribe(subscriptionsToRemove);
    },
    []
  );

  // Send message function (can take event and data or just data for legacy support)
  const send = useCallback((eventOrData: any, data?: any) => {
    const service = serviceRef.current;
    if (typeof eventOrData === 'string') {
      return service.send(eventOrData, data);
    }
    return service.emit(eventOrData);
  }, []);

  // Flush real-time updates (useful for testing or immediate processing)
  const flushUpdates = useCallback(() => {
    const updateService = updateServiceRef.current;
    updateService.flush();
  }, []);

  // Get real-time update service status
  const getUpdateServiceStatus = useCallback(() => {
    const updateService = updateServiceRef.current;
    return updateService.getStatus();
  }, []);

  // Effect to handle auto-connection and cleanup
  useEffect(() => {
    let cleanup = false;

    // Only auto-connect if user is authenticated and autoConnect is enabled
    // We check the service status directly to avoid depending on 'status' state
    const service = serviceRef.current;
    const serviceStatus = service.getStatus();

    if (
      autoConnect &&
      isAuthenticated &&
      !serviceStatus.isConnected &&
      !serviceStatus.isConnecting
    ) {
      connect().catch(error => {
        if (!cleanup) {
          console.error('Auto-connect failed:', error);
        }
      });
    }

    return () => {
      cleanup = true;
    };
  }, [
    autoConnect,
    isAuthenticated,
    connect
  ]);

  // Separate effect for periodic status updates
  useEffect(() => {
    const statusInterval = setInterval(() => {
      // Only update if we are not in a transitional state or if status changed
      updateStatus();
    }, 1000);
    return () => clearInterval(statusInterval);
  }, [updateStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // Connection methods
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    send,

    // Real-time update methods
    flushUpdates,
    getUpdateServiceStatus,

    // Status
    status,
    isConnected: status.isConnected,
    isConnecting: status.isConnecting,
    isReconnecting: status.isReconnecting,
    error: status.error,

    // Service references for advanced usage
    service: serviceRef.current,
    updateService: updateServiceRef.current,
  };
};

// Helper hook for connection status only
export const useWebSocketStatus = () => {
  const service = getWebSocketService();
  const [status, setStatus] = useState(service.getStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(service.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, [service]);

  return status;
};
