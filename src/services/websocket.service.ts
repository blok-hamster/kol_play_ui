import { io, Socket } from 'socket.io-client';
import { APP_CONFIG } from '@/lib/constants';
import { WebSocketMessage, TradeAlert, KOLTrade } from '@/types';
import apiClient from '@/lib/api';

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  messageTimeout: number;
  path?: string;
}

export interface QueueMessage {
  id: string;
  type:
    | 'TRADE_UPDATE'
    | 'PRICE_UPDATE'
    | 'BALANCE_UPDATE'
    | 'NOTIFICATION'
    | 'KOL_TRADE'
    | 'USER_EVENT';
  payload: any;
  timestamp: number;
  ttl: number;
  queue?: 'trades' | 'notifications';
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
  onUserEvent?: (event: any) => void;
  onAgentData?: (data: any) => void;
  onAgentToken?: (data: any) => void;
  onAgentStatus?: (data: any) => void;
  onAgentHistoryResponse?: (data: any) => void;
  onAgentComplete?: (data: any) => void;
  onAgentError?: (data: any) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private handlers: WebSocketEventHandlers = {};
  private isConnecting = false;
  private isConnected = false;
  private messageQueue: QueueMessage[] = [];
  private messageCleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<WebSocketConfig>) {
    // Default URL from env or fallback
    const defaultUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000';
    
    this.config = {
      url: defaultUrl,
      reconnectInterval: APP_CONFIG.WS_RECONNECT_INTERVAL || 1000,
      maxReconnectAttempts: APP_CONFIG.WS_MAX_RECONNECT_ATTEMPTS || 5,
      heartbeatInterval: 30000,
      messageTimeout: 3600000,
      path: '/socket.io',
      ...config,
    };

    this.startMessageCleanup();
  }

  private connectPromise: Promise<void> | null = null;

  /**
   * Connect to the Socket.IO server
   */
  public connect(): Promise<void> {
    if (this.isConnected) {
      return Promise.resolve();
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.isConnecting = true;
    this.connectPromise = new Promise((resolve, reject) => {
      try {
        const token = apiClient.getToken();
        
        if (!token) {
          this.isConnecting = false;
          this.connectPromise = null; // Reset promise on immediate error
          const error = new Error('No authentication token available for WebSocket');
          this.handlers.onError?.(error);
          reject(error);
          return;
        }

        // Initialize Socket.IO connection
        this.socket = io(this.config.url, {
          path: this.config.path || '/socket.io', // Ensure string default
          auth: { token },
          reconnection: true,
          reconnectionAttempts: this.config.maxReconnectAttempts,
          reconnectionDelay: this.config.reconnectInterval,
          timeout: 20000,
          transports: ['websocket', 'polling'], // Prefer websocket for stability and to avoid CORS poll errors
        });

        // Connection events
        this.socket.on('connect', () => {
          console.log('✅ Socket.IO connected');
          this.isConnected = true;
          this.isConnecting = false;
          this.handlers.onConnect?.();
          this.connectPromise = null;
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Socket.IO connection error:', error);
          this.isConnecting = false;
          this.handlers.onError?.(error);
          this.connectPromise = null;
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.warn('⚠️ Socket.IO disconnected:', reason);
          this.isConnected = false;
          this.isConnecting = false;
          this.handlers.onDisconnect?.();
        });

        this.socket.on('reconnect_attempt', (attempt) => {
          console.log(`🔄 Socket.IO reconnecting (attempt ${attempt})...`);
          this.handlers.onReconnecting?.(attempt);
        });

        // Map Backend Events to Handlers
        
        // 1. Initial connection receipt
        this.socket.on('connected', (data) => {
          console.log('📩 WebSocket confirmed connection:', data);
        });

        // 2. KOL Trade Updates (Broadcast)
        this.socket.on('kol_trade_update', (data) => {
          // Flatten data if it comes in { trade, event, timestamp } format
          const trade = data.trade?.tradeData || data.trade || data;
          this.handleMessage({
            id: trade.id || Math.random().toString(),
            type: 'KOL_TRADE',
            payload: trade,
            timestamp: Date.now(),
            ttl: this.config.messageTimeout
          });
        });

        // 3. Personal Alerts
        this.socket.on('personal_kol_trade_alert', (data) => {
          this.handlers.onNotification?.(data);
        });

        // 4. User Specific Events (Balance, Position Closed, etc.)
        this.socket.on('user_event', (data) => {
          this.handlers.onUserEvent?.(data);
          
          if (data.type === 'BALANCE_UPDATE') {
            this.handlers.onBalanceUpdate?.(data);
          }
        });

        // 5. Subscription confirmations
        this.socket.on('subscription_confirmed', (data) => {
          console.log('✅ Subscription confirmed:', data);
        });

         // 6. Agent Events (Sentiment, Swarms, etc)
        this.socket.on('agent:data', (data) => this.handlers.onAgentData?.(data));
        this.socket.on('agent:token', (data) => this.handlers.onAgentToken?.(data));
        this.socket.on('agent:status', (data) => this.handlers.onAgentStatus?.(data));
        this.socket.on('agent:history:response', (data) => this.handlers.onAgentHistoryResponse?.(data));
        this.socket.on('agent:complete', (data) => this.handlers.onAgentComplete?.(data));
        this.socket.on('agent:error', (data) => this.handlers.onAgentError?.(data));

      } catch (error) {
        this.isConnecting = false;
        const connectionError = error instanceof Error ? error : new Error('Failed to initialize Socket.IO');
        this.handlers.onError?.(connectionError);
        this.connectPromise = null;
        reject(connectionError);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.stopMessageCleanup();
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
   * Send a message to the server (Socket.IO emit)
   */
  public send(event: string, data: any): boolean {
    if (!this.isConnected || !this.socket) {
      console.warn(`[WebSocketService] Cannot send event "${event}". Socket not connected. (isConnected: ${this.isConnected}, isConnecting: ${this.isConnecting})`);
      return false;
    }

    try {
      console.log(`[WebSocketService] Emitting event: ${event}`, data);
      this.socket.emit(event, data);
      return true;
    } catch (error) {
      console.error(`Failed to emit Socket.IO event "${event}":`, error);
      return false;
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  public emit(message: any): boolean {
    if (typeof message === 'object' && message.type) {
      return this.send(message.type.toLowerCase(), message.payload || message);
    }
    return this.send('message', message);
  }

  /**
   * Subscribe to trades/notifications
   */
  public subscribe(subscriptions: {
    trades?: boolean;
    notifications?: boolean;
    priceUpdates?: boolean;
    balanceUpdates?: boolean;
    tokens?: string[];
    kols?: string[];
  }): boolean {
    const { tokens = [], kols = [] } = subscriptions;
    
    // The backend expect 'subscribe_kol_trades' with tokens and kols
    return this.send('subscribe_kol_trades', {
      tokens,
      kols,
      limit: 50
    });
  }

  /**
   * Unsubscribe
   */
  public unsubscribe(subscriptions: {
    tokens?: string[];
    kols?: string[];
  }): boolean {
    return this.send('unsubscribe_kol_trades', subscriptions);
  }

  /**
   * Get Status
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
      reconnectAttempts: (this.socket as any)?.reconnectionAttempts || 0,
      messageQueueSize: this.messageQueue.length,
    };
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: QueueMessage): void {
    const now = Date.now();
    const messageAge = now - message.timestamp;

    if (messageAge > message.ttl) {
      return; // Expired
    }

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

      case 'USER_EVENT':
        this.handlers.onUserEvent?.(message.payload);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private startMessageCleanup(): void {
    this.messageCleanupTimer = setInterval(() => {
      this.cleanupExpiredMessages();
    }, 60000);
  }

  private stopMessageCleanup(): void {
    if (this.messageCleanupTimer) {
      clearInterval(this.messageCleanupTimer);
      this.messageCleanupTimer = null;
    }
  }

  private cleanupExpiredMessages(): void {
    const now = Date.now();
    this.messageQueue = this.messageQueue.filter(message => {
      const messageAge = now - message.timestamp;
      return messageAge <= message.ttl;
    });
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

export const getWebSocketService = (
  config?: Partial<WebSocketConfig>
): WebSocketService => {
  if (!webSocketService) {
    webSocketService = new WebSocketService(config);
  }
  return webSocketService;
};

export const initializeWebSocket = (
  handlers: WebSocketEventHandlers
): Promise<WebSocketService> => {
  const service = getWebSocketService();
  service.on(handlers);
  return service.connect().then(() => service);
};

export default WebSocketService;
