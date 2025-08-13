import { APP_CONFIG } from '@/lib/constants';
import { WebSocketMessage, TradeAlert, KOLTrade } from '@/types';

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  messageTimeout: number;
}

export interface QueueMessage {
  id: string;
  type:
    | 'TRADE_UPDATE'
    | 'PRICE_UPDATE'
    | 'BALANCE_UPDATE'
    | 'NOTIFICATION'
    | 'KOL_TRADE';
  payload: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  queue: 'trades' | 'notifications';
}

export interface WebSocketEventHandlers {
  onTradeUpdate?: (trade: KOLTrade) => void;
  onPriceUpdate?: (data: {
    mint: string;
    price: number;
    change24h: number;
  }) => void;
  onBalanceUpdate?: (data: { balance: number; timestamp: number }) => void;
  onNotification?: (notification: TradeAlert) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onReconnecting?: (attempt: number) => void;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private handlers: WebSocketEventHandlers = {};
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isConnected = false;
  private messageQueue: QueueMessage[] = [];
  private messageCleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<WebSocketConfig>) {
    this.config = {
      url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws',
      reconnectInterval: APP_CONFIG.WS_RECONNECT_INTERVAL,
      maxReconnectAttempts: APP_CONFIG.WS_MAX_RECONNECT_ATTEMPTS,
      heartbeatInterval: 30000, // 30 seconds
      messageTimeout: 3600000, // 1 hour TTL
      ...config,
    };

    // Start message cleanup timer
    this.startMessageCleanup();
  }

  /**
   * Connect to the WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected || this.isConnecting) {
        resolve();
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          void 0 && ('WebSocket connected');
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;

          this.startHeartbeat();
          this.handlers.onConnect?.();
          resolve();
        };

        this.ws.onmessage = event => {
          try {
            const message: QueueMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = event => {
          void 0 && ('WebSocket disconnected:', event.code, event.reason);
          this.isConnected = false;
          this.isConnecting = false;
          this.stopHeartbeat();

          this.handlers.onDisconnect?.();

          // Attempt to reconnect if not manually closed
          if (
            event.code !== 1000 &&
            this.reconnectAttempts < this.config.maxReconnectAttempts
          ) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = error => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          const wsError = new Error('WebSocket connection failed');
          this.handlers.onError?.(wsError);
          reject(wsError);
        };
      } catch (error) {
        this.isConnecting = false;
        const connectionError =
          error instanceof Error
            ? error
            : new Error('Failed to create WebSocket connection');
        this.handlers.onError?.(connectionError);
        reject(connectionError);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();
    this.stopMessageCleanup();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Manual disconnect');
    }

    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Register event handlers
   */
  public on(handlers: WebSocketEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Remove event handlers
   */
  public off(eventTypes: (keyof WebSocketEventHandlers)[]): void {
    eventTypes.forEach(eventType => {
      delete this.handlers[eventType];
    });
  }

  /**
   * Send a message to the server
   */
  public send(message: any): boolean {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket not connected, message not sent:', message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }

  /**
   * Subscribe to specific queues or message types
   */
  public subscribe(subscriptions: {
    trades?: boolean;
    notifications?: boolean;
    priceUpdates?: boolean;
    balanceUpdates?: boolean;
  }): boolean {
    return this.send({
      type: 'SUBSCRIBE',
      payload: subscriptions,
      timestamp: Date.now(),
    });
  }

  /**
   * Unsubscribe from specific queues or message types
   */
  public unsubscribe(subscriptions: {
    trades?: boolean;
    notifications?: boolean;
    priceUpdates?: boolean;
    balanceUpdates?: boolean;
  }): boolean {
    return this.send({
      type: 'UNSUBSCRIBE',
      payload: subscriptions,
      timestamp: Date.now(),
    });
  }

  /**
   * Get connection status
   */
  public getStatus(): {
    isConnected: boolean;
    isConnecting: boolean;
    reconnectAttempts: number;
    messageQueueSize: number;
  } {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      messageQueueSize: this.messageQueue.length,
    };
  }

  /**
   * Handle incoming messages from RabbitMQ queues
   */
  private handleMessage(message: QueueMessage): void {
    // Check if message has expired (TTL handling)
    const now = Date.now();
    const messageAge = now - message.timestamp;

    if (messageAge > message.ttl) {
      console.warn(
        'Discarding expired message:',
        message.id,
        'Age:',
        messageAge,
        'TTL:',
        message.ttl
      );
      return;
    }

    // Add to message queue for tracking
    this.messageQueue.push(message);

    // Route message to appropriate handler
    switch (message.type) {
      case 'TRADE_UPDATE':
      case 'KOL_TRADE':
        this.handlers.onTradeUpdate?.(message.payload as KOLTrade);
        break;

      case 'PRICE_UPDATE':
        this.handlers.onPriceUpdate?.(message.payload);
        break;

      case 'BALANCE_UPDATE':
        this.handlers.onBalanceUpdate?.(message.payload);
        break;

      case 'NOTIFICATION':
        this.handlers.onNotification?.(message.payload as TradeAlert);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const backoffDelay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    void 0 && (
      `Scheduling reconnect attempt ${this.reconnectAttempts} in ${backoffDelay}ms`
    );
    this.handlers.onReconnecting?.(this.reconnectAttempts);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection attempt failed:', error);
      });
    }, backoffDelay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: 'PING',
          timestamp: Date.now(),
        });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Start message cleanup timer to remove expired messages
   */
  private startMessageCleanup(): void {
    this.messageCleanupTimer = setInterval(() => {
      this.cleanupExpiredMessages();
    }, 60000); // Clean up every minute
  }

  /**
   * Stop message cleanup timer
   */
  private stopMessageCleanup(): void {
    if (this.messageCleanupTimer) {
      clearInterval(this.messageCleanupTimer);
      this.messageCleanupTimer = null;
    }
  }

  /**
   * Remove expired messages from the queue
   */
  private cleanupExpiredMessages(): void {
    const now = Date.now();
    const initialLength = this.messageQueue.length;

    this.messageQueue = this.messageQueue.filter(message => {
      const messageAge = now - message.timestamp;
      return messageAge <= message.ttl;
    });

    const removed = initialLength - this.messageQueue.length;
    if (removed > 0) {
      void 0 && (`Cleaned up ${removed} expired messages from queue`);
    }
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

/**
 * Get the singleton WebSocket service instance
 */
export const getWebSocketService = (
  config?: Partial<WebSocketConfig>
): WebSocketService => {
  if (!webSocketService) {
    webSocketService = new WebSocketService(config);
  }
  return webSocketService;
};

/**
 * Initialize WebSocket service with default configuration
 */
export const initializeWebSocket = (
  handlers: WebSocketEventHandlers
): Promise<WebSocketService> => {
  const service = getWebSocketService();
  service.on(handlers);

  return service.connect().then(() => service);
};

export default WebSocketService;
