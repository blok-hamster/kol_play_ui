import { KOLTrade, SearchTokenResult, OverallPnL } from '@/types';

export interface UpdateBatch {
  id: string;
  timestamp: number;
  updates: Array<{
    type: 'TRADE' | 'PRICE' | 'BALANCE' | 'TOKEN' | 'PORTFOLIO';
    data: any;
    priority: 'high' | 'medium' | 'low';
  }>;
}

export interface UpdateSubscription {
  id: string;
  type: string;
  callback: (data: any) => void;
  condition?: (data: any) => boolean;
  throttle?: number;
  lastUpdate?: number;
}

export interface BatchingConfig {
  batchInterval: number; // milliseconds
  maxBatchSize: number;
  highPriorityThreshold: number; // immediate processing threshold
  enableThrottling: boolean;
}

class RealTimeUpdateService {
  private updateQueue: Array<{
    type: string;
    data: any;
    priority: 'high' | 'medium' | 'low';
    timestamp: number;
  }> = [];

  private subscriptions: Map<string, UpdateSubscription> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private processingBatch = false;

  private config: BatchingConfig = {
    batchInterval: 100, // 100ms batching
    maxBatchSize: 50,
    highPriorityThreshold: 5, // Process immediately if 5+ high priority updates
    enableThrottling: true,
  };

  // Price cache to detect significant changes
  private priceCache: Map<string, { price: number; timestamp: number }> =
    new Map();
  private balanceCache: { balance: number; timestamp: number } | null = null;

  constructor(config?: Partial<BatchingConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.startBatchProcessing();
  }

  /**
   * Subscribe to specific update types with optional conditions and throttling
   */
  public subscribe(subscription: Omit<UpdateSubscription, 'id'>): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.subscriptions.set(id, {
      id,
      ...subscription,
    });

    return id;
  }

  /**
   * Unsubscribe from updates
   */
  public unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Add an update to the queue
   */
  public addUpdate(
    type: string,
    data: any,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): void {
    const update = {
      type,
      data,
      priority,
      timestamp: Date.now(),
    };

    this.updateQueue.push(update);

    // Process immediately for high priority updates if threshold is met
    if (this.shouldProcessImmediately()) {
      this.processBatch();
    }
  }

  /**
   * Add a trade update with intelligent batching
   */
  public addTradeUpdate(trade: KOLTrade): void {
    // High priority for user's subscribed KOLs
    const priority = this.isUserSubscribedKOL(trade.kolWallet)
      ? 'high'
      : 'medium';

    this.addUpdate('TRADE', trade, priority);
  }

  /**
   * Add price update with change detection
   */
  public addPriceUpdate(mint: string, price: number, change24h: number): void {
    const cached = this.priceCache.get(mint);
    const now = Date.now();

    // Check if this is a significant price change
    let priority: 'high' | 'medium' | 'low' = 'low';

    if (!cached || Math.abs(change24h) > 5) {
      priority = 'high'; // Significant price movement
    } else if (Math.abs((price - cached.price) / cached.price) > 0.01) {
      priority = 'medium'; // 1%+ price change
    }

    // Update cache
    this.priceCache.set(mint, { price, timestamp: now });

    this.addUpdate('PRICE', { mint, price, change24h }, priority);
  }

  /**
   * Add balance update with change detection
   */
  public addBalanceUpdate(balance: number): void {
    const cached = this.balanceCache;
    const now = Date.now();

    // Determine priority based on balance change
    let priority: 'high' | 'medium' | 'low' = 'low';

    if (!cached) {
      priority = 'medium';
    } else {
      const changePercent = Math.abs(
        (balance - cached.balance) / cached.balance
      );
      if (changePercent > 0.1)
        priority = 'high'; // 10%+ change
      else if (changePercent > 0.01) priority = 'medium'; // 1%+ change
    }

    // Update cache
    this.balanceCache = { balance, timestamp: now };

    this.addUpdate('BALANCE', { balance, timestamp: now }, priority);
  }

  /**
   * Add portfolio update
   */
  public addPortfolioUpdate(portfolio: OverallPnL): void {
    this.addUpdate('PORTFOLIO', portfolio, 'medium');
  }

  /**
   * Add token list update (trending, high volume, etc.)
   */
  public addTokenUpdate(tokens: SearchTokenResult[], category: string): void {
    this.addUpdate('TOKEN', { tokens, category }, 'low');
  }

  /**
   * Force process all pending updates immediately
   */
  public flush(): void {
    this.processBatch();
  }

  /**
   * Clear all pending updates
   */
  public clear(): void {
    this.updateQueue = [];
  }

  /**
   * Get current queue status
   */
  public getStatus(): {
    queueSize: number;
    subscriptionCount: number;
    isProcessing: boolean;
    lastProcessTime?: number;
  } {
    return {
      queueSize: this.updateQueue.length,
      subscriptionCount: this.subscriptions.size,
      isProcessing: this.processingBatch,
    };
  }

  /**
   * Check if immediate processing is needed
   */
  private shouldProcessImmediately(): boolean {
    const highPriorityCount = this.updateQueue.filter(
      u => u.priority === 'high'
    ).length;
    return highPriorityCount >= this.config.highPriorityThreshold;
  }

  /**
   * Check if a KOL is subscribed by the user (stub - would integrate with user subscriptions)
   */
  private isUserSubscribedKOL(kolWallet: string): boolean {
    // This would check against user's subscriptions from the trading store
    // For now, return false as we don't have direct access to stores here
    return false;
  }

  /**
   * Start the batch processing timer
   */
  private startBatchProcessing(): void {
    this.batchTimer = setInterval(() => {
      if (this.updateQueue.length > 0) {
        this.processBatch();
      }
    }, this.config.batchInterval);
  }

  /**
   * Process a batch of updates
   */
  private processBatch(): void {
    if (this.processingBatch || this.updateQueue.length === 0) {
      return;
    }

    this.processingBatch = true;

    try {
      // Get updates to process (up to max batch size)
      const updatesToProcess = this.updateQueue.splice(
        0,
        this.config.maxBatchSize
      );

      // Group updates by type for efficient processing
      const groupedUpdates = this.groupUpdatesByType(updatesToProcess);

      // Process each group
      for (const [type, updates] of groupedUpdates.entries()) {
        this.processUpdateGroup(type, updates);
      }
    } catch (error) {
      console.error('Error processing update batch:', error);
    } finally {
      this.processingBatch = false;
    }
  }

  /**
   * Group updates by type for efficient batch processing
   */
  private groupUpdatesByType(
    updates: Array<{
      type: string;
      data: any;
      priority: 'high' | 'medium' | 'low';
      timestamp: number;
    }>
  ): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    for (const update of updates) {
      if (!grouped.has(update.type)) {
        grouped.set(update.type, []);
      }
      grouped.get(update.type)!.push(update.data);
    }

    return grouped;
  }

  /**
   * Process a group of updates of the same type
   */
  private processUpdateGroup(type: string, updates: any[]): void {
    // Find relevant subscriptions
    const relevantSubscriptions = Array.from(
      this.subscriptions.values()
    ).filter(sub => sub.type === type || sub.type === '*');

    for (const subscription of relevantSubscriptions) {
      try {
        // Check throttling
        if (this.config.enableThrottling && subscription.throttle) {
          const now = Date.now();
          const lastUpdate = subscription.lastUpdate || 0;

          if (now - lastUpdate < subscription.throttle) {
            continue; // Skip this update due to throttling
          }

          subscription.lastUpdate = now;
        }

        // Process updates based on type
        if (updates.length === 1) {
          // Single update
          const data = updates[0];
          if (!subscription.condition || subscription.condition(data)) {
            subscription.callback(data);
          }
        } else {
          // Batch of updates - pass the most recent or aggregate
          const processedData = this.aggregateUpdates(type, updates);
          if (
            !subscription.condition ||
            subscription.condition(processedData)
          ) {
            subscription.callback(processedData);
          }
        }
      } catch (error) {
        console.error('Error processing subscription callback:', error);
      }
    }
  }

  /**
   * Aggregate multiple updates of the same type
   */
  private aggregateUpdates(type: string, updates: any[]): any {
    switch (type) {
      case 'TRADE':
        // For trades, return the most recent ones (up to 10)
        return updates.slice(-10);

      case 'PRICE':
        // For prices, group by mint and return latest for each
        const priceMap = new Map();
        updates.forEach(update => {
          priceMap.set(update.mint, update);
        });
        return Array.from(priceMap.values());

      case 'BALANCE':
        // For balance, return the latest
        return updates[updates.length - 1];

      case 'PORTFOLIO':
        // For portfolio, return the latest
        return updates[updates.length - 1];

      case 'TOKEN':
        // For tokens, merge by category
        const tokenMap = new Map();
        updates.forEach(update => {
          tokenMap.set(update.category, update);
        });
        return Array.from(tokenMap.values());

      default:
        // For unknown types, return all updates
        return updates;
    }
  }

  /**
   * Cleanup method
   */
  public destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    this.subscriptions.clear();
    this.updateQueue = [];
    this.priceCache.clear();
    this.balanceCache = null;
  }
}

// Singleton instance
let realTimeUpdateService: RealTimeUpdateService | null = null;

/**
 * Get the singleton real-time update service
 */
export const getRealTimeUpdateService = (
  config?: Partial<BatchingConfig>
): RealTimeUpdateService => {
  if (!realTimeUpdateService) {
    realTimeUpdateService = new RealTimeUpdateService(config);
  }
  return realTimeUpdateService;
};

export default RealTimeUpdateService;
