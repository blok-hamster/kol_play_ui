'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  getWebSocketService,
  WebSocketEventHandlers,
  WebSocketConfig,
} from '@/services/websocket.service';
import { getRealTimeUpdateService } from '@/services/realtime-update.service';
import {
  useTradingStore,
  useUserStore,
  useNotifications,
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

  // Store references
  const { setError: setTradingError } = useTradingStore();
  const { isAuthenticated } = useUserStore();
  const { addNotification } = useNotifications(); // Toast notifications
  const { addNotification: addBackendNotification } = useNotificationStore(); // Backend notifications

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
  const serviceRef = useRef(getWebSocketService(config));
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
      console.log('Received trade update:', trade);

      // Route through real-time update service for batching
      const updateService = updateServiceRef.current;
      updateService.addTradeUpdate(trade);

      // Still show immediate notification for important trades
      addNotification({
        type: 'info',
        title: 'New Trade Alert',
        message: `${trade.tradeType.toUpperCase()} ${trade.tokenOut || trade.tokenIn} - ${trade.amountOut || trade.amountIn}`,
      });
    },
    [addNotification]
  );

  const handlePriceUpdate = useCallback(
    (data: { mint: string; price: number; change24h: number }) => {
      console.log('Received price update:', data);

      // Route through real-time update service for batching and change detection
      const updateService = updateServiceRef.current;
      updateService.addPriceUpdate(data.mint, data.price, data.change24h);
    },
    []
  );

  const handleBalanceUpdate = useCallback(
    (data: { balance: number; timestamp: number }) => {
      console.log('Received balance update:', data);

      // Route through real-time update service for batching
      const updateService = updateServiceRef.current;
      updateService.addBalanceUpdate(data.balance);
    },
    []
  );

  const handleNotification = useCallback(
    (notification: TradeAlert | any) => {
      console.log('Received notification:', notification);

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

  const handleConnect = useCallback(() => {
    console.log('WebSocket connected');
    setStatus(prev => ({
      ...prev,
      isConnected: true,
      isConnecting: false,
      isReconnecting: false,
      error: null,
    }));

    // Subscribe to channels after connection
    if (!isSubscribedRef.current && subscriptions) {
      const service = serviceRef.current;
      service.subscribe(subscriptions);
      isSubscribedRef.current = true;
    }
  }, [subscriptions]);

  const handleDisconnect = useCallback(() => {
    console.log('WebSocket disconnected');
    setStatus(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
    }));
    isSubscribedRef.current = false;
  }, []);

  const handleError = useCallback(
    (error: Error) => {
      console.error('WebSocket error:', error);
      setStatus(prev => ({
        ...prev,
        error,
        isConnected: false,
        isConnecting: false,
        isReconnecting: false,
      }));
      setTradingError(error.message);
    },
    [setTradingError]
  );

  const handleReconnecting = useCallback((attempt: number) => {
    console.log('WebSocket reconnecting, attempt:', attempt);
    setStatus(prev => ({
      ...prev,
      isReconnecting: true,
      reconnectAttempts: attempt,
    }));
  }, []);

  // Connect function
  const connect = useCallback(async () => {
    if (status.isConnected || status.isConnecting) {
      return;
    }

    setStatus(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const service = serviceRef.current;

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
      };

      service.on(handlers);
      await service.connect();
    } catch (error) {
      const connectionError =
        error instanceof Error ? error : new Error('Connection failed');
      handleError(connectionError);
    }
  }, [
    status.isConnected,
    status.isConnecting,
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
    }) => {
      const service = serviceRef.current;
      return service.unsubscribe(subscriptionsToRemove);
    },
    []
  );

  // Send message function
  const send = useCallback((message: any) => {
    const service = serviceRef.current;
    return service.send(message);
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
    if (
      autoConnect &&
      isAuthenticated &&
      !status.isConnected &&
      !status.isConnecting
    ) {
      connect().catch(error => {
        if (!cleanup) {
          console.error('Auto-connect failed:', error);
        }
      });
    }

    // Update status periodically
    const statusInterval = setInterval(updateStatus, 1000);

    return () => {
      cleanup = true;
      clearInterval(statusInterval);
    };
  }, [
    autoConnect,
    isAuthenticated,
    status.isConnected,
    status.isConnecting,
    connect,
    updateStatus,
  ]);

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
