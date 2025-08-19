import { KOLTrade, MindmapUpdate } from '@/types';
import { cacheManager } from '@/lib/cache-manager';

export interface SyncConfig {
  batchInterval: number;
  maxBatchSize: number;
  conflictResolutionStrategy: 'realtime-wins' | 'timestamp-based' | 'merge';
  healthCheckInterval: number;
  pollingFallbackInterval: number;
  maxMissedHeartbeats: number;
  // Enhanced batching configuration
  adaptiveBatching: boolean;
  minBatchInterval: number;
  maxBatchInterval: number;
  batchSizeThresholds: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  // Enhanced conflict resolution
  conflictResolutionTimeout: number;
  dataIntegrityChecks: boolean;
  // Enhanced health monitoring
  connectionQualityThresholds: {
    excellent: number;
    good: number;
    poor: number;
  };
  pollingBackoffMultiplier: number;
  maxPollingInterval: number;
}

export interface UpdateBatch {
  id: string;
  timestamp: number;
  updates: SyncUpdate[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  // Enhanced batching metadata
  batchSize: number;
  processingTime?: number;
  conflictsResolved: number;
  dataIntegrityScore: number;
  adaptiveInterval: number;
}

export interface SyncUpdate {
  type: 'trade' | 'mindmap' | 'stats' | 'trending';
  data: any;
  timestamp: number;
  source: 'websocket' | 'polling' | 'cache';
  priority: 'critical' | 'high' | 'medium' | 'low';
  // Enhanced update metadata
  id: string;
  sequenceNumber?: number;
  dataHash?: string;
  conflictResolution?: {
    hadConflict: boolean;
    resolutionStrategy: string;
    originalData?: any;
  };
}

export interface ConnectionHealth {
  isHealthy: boolean;
  lastHeartbeat: number;
  missedHeartbeats: number;
  latency: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'critical';
  // Enhanced health monitoring
  averageLatency: number;
  latencyHistory: number[];
  connectionStability: number; // 0-1 score
  reconnectCount: number;
  lastReconnect: number;
  dataLossDetected: boolean;
  pollingFallbackActive: boolean;
  pollingInterval: number;
}

export interface ConflictResolution {
  strategy: 'realtime-wins' | 'timestamp-based' | 'merge';
  resolve<T>(realtimeData: T, cachedData: T, realtimeTimestamp: number, cachedTimestamp: number): T;
}

class RealTimeSyncService {
  private config: SyncConfig;
  private updateQueue: SyncUpdate[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  
  private connectionHealth: ConnectionHealth = {
    isHealthy: true,
    lastHeartbeat: Date.now(),
    missedHeartbeats: 0,
    latency: 0,
    connectionQuality: 'excellent',
    // Enhanced health monitoring
    averageLatency: 0,
    latencyHistory: [],
    connectionStability: 1.0,
    reconnectCount: 0,
    lastReconnect: 0,
    dataLossDetected: false,
    pollingFallbackActive: false,
    pollingInterval: 10000
  };

  private subscribers: Map<string, (batch: UpdateBatch) => void> = new Map();
  private isProcessing = false;
  private isPollingMode = false;
  private lastBatchId = 0;

  // Enhanced batching state
  private adaptiveInterval = 100;
  private lastBatchProcessTime = 0;
  private batchPerformanceHistory: number[] = [];
  private sequenceCounter = 0;

  // Enhanced conflict resolution
  private conflictResolver: ConflictResolution;
  private pendingConflicts: Map<string, { update: SyncUpdate; cachedData: any; timestamp: number }> = new Map();

  // Enhanced health monitoring
  private latencyMeasurements: number[] = [];
  private connectionEvents: Array<{ type: 'connect' | 'disconnect' | 'error'; timestamp: number }> = [];
  private dataIntegrityErrors = 0;

  constructor(config?: Partial<SyncConfig>) {
    this.config = {
      batchInterval: 100, // 100ms batching
      maxBatchSize: 50,
      conflictResolutionStrategy: 'timestamp-based',
      healthCheckInterval: 5000, // 5 seconds
      pollingFallbackInterval: 10000, // 10 seconds
      maxMissedHeartbeats: 3,
      // Enhanced batching configuration
      adaptiveBatching: true,
      minBatchInterval: 50, // 50ms minimum
      maxBatchInterval: 1000, // 1 second maximum
      batchSizeThresholds: {
        critical: 10,
        high: 25,
        medium: 50,
        low: 100
      },
      // Enhanced conflict resolution
      conflictResolutionTimeout: 5000, // 5 seconds
      dataIntegrityChecks: true,
      // Enhanced health monitoring
      connectionQualityThresholds: {
        excellent: 100, // < 100ms latency
        good: 300,      // < 300ms latency
        poor: 1000      // < 1000ms latency
      },
      pollingBackoffMultiplier: 1.5,
      maxPollingInterval: 60000, // 1 minute max polling
      ...config
    };

    this.conflictResolver = this.createConflictResolver();
    this.startBatchProcessing();
    this.startHealthMonitoring();
  }

  /**
   * Add an update to the synchronization queue with enhanced conflict resolution
   */
  public addUpdate(update: Omit<SyncUpdate, 'timestamp' | 'id' | 'sequenceNumber'>): void {
    const syncUpdate: SyncUpdate = {
      ...update,
      id: `update_${++this.sequenceCounter}_${Date.now()}`,
      timestamp: Date.now(),
      sequenceNumber: this.sequenceCounter
    };

    // Enhanced data integrity checks
    if (this.config.dataIntegrityChecks) {
      syncUpdate.dataHash = this.calculateDataHash(syncUpdate.data);
      
      // Validate data structure
      if (!this.validateUpdateData(syncUpdate)) {
        console.warn('Invalid update data detected, skipping:', syncUpdate.id);
        this.dataIntegrityErrors++;
        return;
      }
    }

    // Enhanced conflict resolution
    const conflictResult = this.resolveConflicts(syncUpdate);
    if (conflictResult.hadConflict) {
      syncUpdate.conflictResolution = conflictResult;
    }

    this.updateQueue.push(syncUpdate);

    // Adaptive batching - adjust processing based on priority and queue state
    if (this.shouldProcessImmediately(syncUpdate)) {
      this.processBatch();
    } else if (this.config.adaptiveBatching) {
      this.adjustBatchInterval();
    }
  }

  /**
   * Add trade update with enhanced conflict resolution
   */
  public addTradeUpdate(trade: KOLTrade, source: 'websocket' | 'polling' = 'websocket'): void {
    // Enhanced conflict detection and resolution
    const cachedTrades = cacheManager.getTradeData('recent') || [];
    const existingTrade = cachedTrades.find(t => t.id === trade.id);

    let resolvedTrade = trade;
    let conflictResolution: any = { hadConflict: false, resolutionStrategy: 'none' };

    if (existingTrade) {
      const realtimeTimestamp = Date.now();
      const cachedTimestamp = existingTrade.timestamp ? new Date(existingTrade.timestamp).getTime() : 0;
      
      // Enhanced conflict resolution with multiple strategies
      conflictResolution = {
        hadConflict: true,
        resolutionStrategy: this.config.conflictResolutionStrategy,
        originalData: { ...existingTrade }
      };

      switch (this.config.conflictResolutionStrategy) {
        case 'realtime-wins':
          resolvedTrade = trade;
          break;
          
        case 'timestamp-based':
          resolvedTrade = realtimeTimestamp > cachedTimestamp ? trade : existingTrade;
          break;
          
        case 'merge':
          resolvedTrade = this.mergeTradeData(trade, existingTrade, realtimeTimestamp, cachedTimestamp);
          break;
      }

      // Validate merged data integrity
      if (this.config.dataIntegrityChecks && !this.validateTradeData(resolvedTrade)) {
        console.warn('Trade data integrity check failed, using cached data:', trade.id);
        resolvedTrade = existingTrade;
        conflictResolution.resolutionStrategy = 'fallback-to-cache';
      }
    }

    this.addUpdate({
      type: 'trade',
      data: resolvedTrade,
      source,
      priority: this.getUpdatePriority('trade', resolvedTrade)
    });
  }

  /**
   * Add mindmap update with efficient merging
   */
  public addMindmapUpdate(mindmapUpdate: MindmapUpdate, source: 'websocket' | 'polling' = 'websocket'): void {
    // Check for conflicts with cached mindmap data
    const cachedMindmap = cacheManager.getMindmapData(mindmapUpdate.tokenMint);
    
    let resolvedMindmap = mindmapUpdate;
    if (cachedMindmap) {
      resolvedMindmap = this.mergeMindmapData(mindmapUpdate, cachedMindmap);
    }

    this.addUpdate({
      type: 'mindmap',
      data: resolvedMindmap,
      source,
      priority: this.getUpdatePriority('mindmap', resolvedMindmap)
    });
  }

  /**
   * Subscribe to batched updates
   */
  public subscribe(id: string, callback: (batch: UpdateBatch) => void): void {
    this.subscribers.set(id, callback);
  }

  /**
   * Unsubscribe from updates
   */
  public unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  /**
   * Update connection health status with enhanced monitoring
   */
  public updateConnectionHealth(isConnected: boolean, latency?: number): void {
    const now = Date.now();
    
    // Track connection events for stability analysis
    if (isConnected !== this.connectionHealth.isHealthy) {
      this.connectionEvents.push({
        type: isConnected ? 'connect' : 'disconnect',
        timestamp: now
      });
      
      // Keep only recent events (last hour)
      this.connectionEvents = this.connectionEvents.filter(
        event => now - event.timestamp < 3600000
      );
    }
    
    if (isConnected) {
      this.connectionHealth.lastHeartbeat = now;
      this.connectionHealth.missedHeartbeats = 0;
      this.connectionHealth.isHealthy = true;
      
      if (latency !== undefined) {
        this.connectionHealth.latency = latency;
        
        // Enhanced latency tracking
        this.latencyMeasurements.push(latency);
        if (this.latencyMeasurements.length > 100) {
          this.latencyMeasurements.shift(); // Keep last 100 measurements
        }
        
        // Calculate average latency
        this.connectionHealth.averageLatency = 
          this.latencyMeasurements.reduce((sum, l) => sum + l, 0) / this.latencyMeasurements.length;
        
        // Update latency history for connection quality analysis
        this.connectionHealth.latencyHistory = [...this.latencyMeasurements.slice(-10)];
      }
      
      // Enhanced connection quality assessment
      this.updateConnectionQuality();
      
      // Calculate connection stability score
      this.updateConnectionStability();
      
      // Switch back from polling mode if we were in it
      if (this.isPollingMode) {
        this.stopPollingMode();
      }
    } else {
      this.connectionHealth.missedHeartbeats++;
      
      // Enhanced health degradation logic
      const healthThreshold = Math.max(1, this.config.maxMissedHeartbeats - 
        Math.floor(this.connectionHealth.connectionStability * 2));
      
      if (this.connectionHealth.missedHeartbeats >= healthThreshold) {
        this.connectionHealth.isHealthy = false;
        this.connectionHealth.connectionQuality = 'critical';
        this.connectionHealth.dataLossDetected = true;
        
        // Switch to polling mode with adaptive interval
        if (!this.isPollingMode) {
          this.startPollingMode();
        }
      }
    }
  }

  /**
   * Get current connection health
   */
  public getConnectionHealth(): ConnectionHealth {
    return { ...this.connectionHealth };
  }

  /**
   * Force flush all pending updates
   */
  public flush(): void {
    this.processBatch();
  }

  /**
   * Get enhanced service status
   */
  public getStatus(): {
    queueSize: number;
    subscriberCount: number;
    isProcessing: boolean;
    isPollingMode: boolean;
    connectionHealth: ConnectionHealth;
    adaptiveInterval: number;
    batchPerformance: {
      averageProcessingTime: number;
      recentPerformance: number[];
    };
    dataIntegrity: {
      totalErrors: number;
      conflictsResolved: number;
    };
  } {
    const avgProcessingTime = this.batchPerformanceHistory.length > 0 ?
      this.batchPerformanceHistory.reduce((sum, time) => sum + time, 0) / this.batchPerformanceHistory.length : 0;

    return {
      queueSize: this.updateQueue.length,
      subscriberCount: this.subscribers.size,
      isProcessing: this.isProcessing,
      isPollingMode: this.isPollingMode,
      connectionHealth: this.getConnectionHealth(),
      adaptiveInterval: this.adaptiveInterval,
      batchPerformance: {
        averageProcessingTime: avgProcessingTime,
        recentPerformance: [...this.batchPerformanceHistory.slice(-10)]
      },
      dataIntegrity: {
        totalErrors: this.dataIntegrityErrors,
        conflictsResolved: this.updateQueue.filter(u => u.conflictResolution?.hadConflict).length
      }
    };
  }

  /**
   * Update service configuration at runtime
   */
  public updateConfiguration(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart timers with new configuration
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.startBatchProcessing();
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.startHealthMonitoring();
    }
    
    console.log('🔧 Real-time sync service configuration updated:', newConfig);
  }

  /**
   * Force immediate processing of all queued updates
   */
  public forceFlush(): void {
    while (this.updateQueue.length > 0 && !this.isProcessing) {
      this.processBatch();
    }
  }

  /**
   * Reset performance metrics and error counters
   */
  public resetMetrics(): void {
    this.batchPerformanceHistory = [];
    this.dataIntegrityErrors = 0;
    this.latencyMeasurements = [];
    this.connectionEvents = [];
    this.connectionHealth.reconnectCount = 0;
    
    console.log('📊 Real-time sync service metrics reset');
  }

  /**
   * Cleanup and destroy the service
   */
  public destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    this.subscribers.clear();
    this.updateQueue = [];
  }

  /**
   * Create conflict resolution strategy
   */
  private createConflictResolver(): ConflictResolution {
    const strategy = this.config.conflictResolutionStrategy;
    
    return {
      strategy,
      resolve: <T>(realtimeData: T, cachedData: T, realtimeTimestamp: number, cachedTimestamp: number): T => {
        switch (strategy) {
          case 'realtime-wins':
            return realtimeData;
            
          case 'timestamp-based':
            return realtimeTimestamp > cachedTimestamp ? realtimeData : cachedData;
            
          case 'merge':
            return this.mergeData(realtimeData, cachedData, realtimeTimestamp, cachedTimestamp);
            
          default:
            return realtimeData;
        }
      }
    };
  }

  /**
   * Merge data intelligently based on type
   */
  private mergeData<T>(realtimeData: T, cachedData: T, realtimeTimestamp: number, cachedTimestamp: number): T {
    // For KOL trades, prefer realtime data but preserve metadata from cache
    if (this.isKOLTrade(realtimeData) && this.isKOLTrade(cachedData)) {
      return {
        ...realtimeData,
        tradeData: {
          ...realtimeData.tradeData,
          // Preserve enriched metadata from cache if not present in realtime
          name: realtimeData.tradeData?.name || cachedData.tradeData?.name,
          symbol: realtimeData.tradeData?.symbol || cachedData.tradeData?.symbol,
          image: realtimeData.tradeData?.image || cachedData.tradeData?.image,
        }
      } as T;
    }
    
    // For other types, use timestamp-based resolution
    return realtimeTimestamp > cachedTimestamp ? realtimeData : cachedData;
  }

  /**
   * Merge mindmap data efficiently
   */
  private mergeMindmapData(realtimeData: MindmapUpdate, cachedData: MindmapUpdate): MindmapUpdate {
    // Always prefer realtime data but merge KOL connections intelligently
    const mergedConnections = { ...cachedData.kolConnections };
    
    // Update with realtime connections
    Object.entries(realtimeData.kolConnections).forEach(([kolWallet, connection]) => {
      mergedConnections[kolWallet] = connection;
    });

    return {
      ...realtimeData,
      kolConnections: mergedConnections,
      // Merge related tokens (union of both sets)
      relatedTokens: Array.from(new Set([
        ...realtimeData.relatedTokens,
        ...cachedData.relatedTokens
      ]))
    };
  }

  /**
   * Determine update priority based on type and content
   */
  private getUpdatePriority(type: string, data: any): 'critical' | 'high' | 'medium' | 'low' {
    switch (type) {
      case 'trade':
        // High priority for large trades or user's subscribed KOLs
        if (data.tradeData?.amountIn > 10000 || this.isUserSubscribedKOL(data.kolWallet)) {
          return 'high';
        }
        return 'medium';
        
      case 'mindmap':
        // High priority for tokens with high activity
        if (data.networkMetrics?.totalTrades > 100) {
          return 'high';
        }
        return 'medium';
        
      case 'stats':
        return 'medium';
        
      case 'trending':
        return 'low';
        
      default:
        return 'low';
    }
  }

  /**
   * Check if immediate processing is needed
   */
  private shouldProcessImmediately(): boolean {
    const criticalCount = this.updateQueue.filter(u => u.priority === 'critical').length;
    const highCount = this.updateQueue.filter(u => u.priority === 'high').length;
    
    return criticalCount > 0 || highCount >= 5 || this.updateQueue.length >= this.config.maxBatchSize;
  }

  /**
   * Start batch processing timer
   */
  private startBatchProcessing(): void {
    this.batchTimer = setInterval(() => {
      if (this.updateQueue.length > 0 && !this.isProcessing) {
        this.processBatch();
      }
    }, this.config.batchInterval);
  }

  /**
   * Process a batch of updates with enhanced batching and performance tracking
   */
  private processBatch(): void {
    if (this.isProcessing || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batchStartTime = Date.now();

    try {
      // Adaptive batch size based on priority distribution
      const batchSize = this.calculateAdaptiveBatchSize();
      const updatesToProcess = this.updateQueue.splice(0, batchSize);
      
      // Sort updates by priority and timestamp for optimal processing
      updatesToProcess.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
      });
      
      // Count conflicts resolved in this batch
      const conflictsResolved = updatesToProcess.filter(
        update => update.conflictResolution?.hadConflict
      ).length;
      
      // Calculate data integrity score
      const dataIntegrityScore = this.calculateDataIntegrityScore(updatesToProcess);
      
      // Determine batch priority (highest priority of contained updates)
      const batchPriority = this.getBatchPriority(updatesToProcess);
      
      // Create enhanced batch
      const batch: UpdateBatch = {
        id: `batch_${++this.lastBatchId}_${Date.now()}`,
        timestamp: Date.now(),
        updates: updatesToProcess,
        priority: batchPriority,
        batchSize: updatesToProcess.length,
        conflictsResolved,
        dataIntegrityScore,
        adaptiveInterval: this.adaptiveInterval
      };

      // Notify all subscribers
      this.subscribers.forEach(callback => {
        try {
          callback(batch);
        } catch (error) {
          console.error('Error in batch subscriber callback:', error);
        }
      });

      // Track batch processing performance
      const processingTime = Date.now() - batchStartTime;
      batch.processingTime = processingTime;
      this.trackBatchPerformance(processingTime);

    } catch (error) {
      console.error('Error processing update batch:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get batch priority based on contained updates
   */
  private getBatchPriority(updates: SyncUpdate[]): 'critical' | 'high' | 'medium' | 'low' {
    if (updates.some(u => u.priority === 'critical')) return 'critical';
    if (updates.some(u => u.priority === 'high')) return 'high';
    if (updates.some(u => u.priority === 'medium')) return 'medium';
    return 'low';
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - this.connectionHealth.lastHeartbeat;
      
      if (timeSinceLastHeartbeat > this.config.healthCheckInterval * 2) {
        this.updateConnectionHealth(false);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Update connection quality based on latency
   */
  private updateConnectionQuality(): void {
    const latency = this.connectionHealth.latency;
    
    if (latency < 100) {
      this.connectionHealth.connectionQuality = 'excellent';
    } else if (latency < 300) {
      this.connectionHealth.connectionQuality = 'good';
    } else if (latency < 1000) {
      this.connectionHealth.connectionQuality = 'poor';
    } else {
      this.connectionHealth.connectionQuality = 'critical';
    }
  }

  /**
   * Start polling mode as fallback
   */
  private startPollingMode(): void {
    if (this.isPollingMode) return;
    
    this.isPollingMode = true;
    console.warn('🔄 Switching to polling mode due to connection issues');
    
    // Start polling timer
    this.pollingTimer = setInterval(() => {
      this.performPollingUpdate();
    }, this.config.pollingFallbackInterval);
  }

  /**
   * Stop polling mode
   */
  private stopPollingMode(): void {
    if (!this.isPollingMode) return;
    
    this.isPollingMode = false;
    console.log('✅ Switching back to WebSocket mode');
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Perform polling update when WebSocket is unavailable
   */
  private async performPollingUpdate(): void {
    try {
      // This would make HTTP requests to get latest data
      // For now, we'll just emit a polling event that can be handled by the hook
      this.addUpdate({
        type: 'stats',
        data: { type: 'polling_update', timestamp: Date.now() },
        source: 'polling',
        priority: 'low'
      });
    } catch (error) {
      console.error('Polling update failed:', error);
    }
  }

  /**
   * Type guard for KOL trade
   */
  private isKOLTrade(data: any): data is KOLTrade {
    return data && typeof data === 'object' && 'kolWallet' in data && 'tradeData' in data;
  }

  /**
   * Check if KOL is subscribed by user (stub)
   */
  private isUserSubscribedKOL(kolWallet: string): boolean {
    // This would integrate with user subscription data
    return false;
  }

  /**
   * Calculate data hash for integrity checking
   */
  private calculateDataHash(data: any): string {
    try {
      const jsonString = JSON.stringify(data, Object.keys(data).sort());
      let hash = 0;
      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString(16);
    } catch (error) {
      return 'invalid';
    }
  }

  /**
   * Validate update data structure
   */
  private validateUpdateData(update: SyncUpdate): boolean {
    if (!update.data || typeof update.data !== 'object') {
      return false;
    }

    switch (update.type) {
      case 'trade':
        return this.validateTradeData(update.data);
      case 'mindmap':
        return this.validateMindmapData(update.data);
      case 'stats':
        return typeof update.data === 'object';
      case 'trending':
        return Array.isArray(update.data);
      default:
        return true;
    }
  }

  /**
   * Validate trade data structure
   */
  private validateTradeData(trade: any): boolean {
    return !!(
      trade &&
      typeof trade === 'object' &&
      trade.id &&
      trade.kolWallet &&
      trade.tradeData &&
      typeof trade.tradeData === 'object' &&
      ['buy', 'sell'].includes(trade.tradeData.tradeType)
    );
  }

  /**
   * Validate mindmap data structure
   */
  private validateMindmapData(mindmap: any): boolean {
    return !!(
      mindmap &&
      typeof mindmap === 'object' &&
      mindmap.tokenMint &&
      mindmap.kolConnections &&
      typeof mindmap.kolConnections === 'object' &&
      Array.isArray(mindmap.relatedTokens)
    );
  }

  /**
   * Enhanced conflict resolution with multiple strategies
   */
  private resolveConflicts(update: SyncUpdate): { hadConflict: boolean; resolutionStrategy: string; originalData?: any } {
    const result = { hadConflict: false, resolutionStrategy: 'none' };

    // Check for existing data in cache
    let cachedData: any = null;
    switch (update.type) {
      case 'trade':
        const cachedTrades = cacheManager.getTradeData('recent') || [];
        cachedData = cachedTrades.find((t: any) => t.id === update.data.id);
        break;
      case 'mindmap':
        cachedData = cacheManager.getMindmapData(update.data.tokenMint);
        break;
      case 'stats':
        cachedData = cacheManager.getStatsData('current');
        break;
    }

    if (cachedData) {
      result.hadConflict = true;
      result.resolutionStrategy = this.config.conflictResolutionStrategy;
      result.originalData = { ...cachedData };

      // Apply conflict resolution
      update.data = this.conflictResolver.resolve(
        update.data,
        cachedData,
        update.timestamp,
        cachedData.timestamp || 0
      );
    }

    return result;
  }

  /**
   * Enhanced trade data merging
   */
  private mergeTradeData(realtimeData: KOLTrade, cachedData: KOLTrade, realtimeTimestamp: number, cachedTimestamp: number): KOLTrade {
    // Use realtime data as base but preserve enriched metadata from cache
    return {
      ...realtimeData,
      tradeData: {
        ...realtimeData.tradeData,
        // Preserve enriched metadata from cache if not present in realtime
        name: realtimeData.tradeData?.name || cachedData.tradeData?.name,
        symbol: realtimeData.tradeData?.symbol || cachedData.tradeData?.symbol,
        image: realtimeData.tradeData?.image || cachedData.tradeData?.image,
        metadataUri: realtimeData.tradeData?.metadataUri || cachedData.tradeData?.metadataUri,
      },
      // Preserve prediction data if available
      prediction: realtimeData.prediction || cachedData.prediction,
      // Preserve mindmap contribution if available
      mindmapContribution: realtimeData.mindmapContribution || cachedData.mindmapContribution
    };
  }

  /**
   * Calculate adaptive batch size based on queue state and priority distribution
   */
  private calculateAdaptiveBatchSize(): number {
    if (!this.config.adaptiveBatching) {
      return this.config.maxBatchSize;
    }

    const queueLength = this.updateQueue.length;
    const criticalCount = this.updateQueue.filter(u => u.priority === 'critical').length;
    const highCount = this.updateQueue.filter(u => u.priority === 'high').length;

    // Prioritize critical and high priority updates
    if (criticalCount > 0) {
      return Math.min(this.config.batchSizeThresholds.critical, queueLength);
    }
    if (highCount > 0) {
      return Math.min(this.config.batchSizeThresholds.high, queueLength);
    }

    // Use adaptive sizing based on connection quality
    const qualityMultiplier = this.connectionHealth.connectionQuality === 'excellent' ? 1.0 :
                             this.connectionHealth.connectionQuality === 'good' ? 0.8 :
                             this.connectionHealth.connectionQuality === 'poor' ? 0.6 : 0.4;

    return Math.min(
      Math.floor(this.config.maxBatchSize * qualityMultiplier),
      queueLength
    );
  }

  /**
   * Calculate data integrity score for a batch
   */
  private calculateDataIntegrityScore(updates: SyncUpdate[]): number {
    if (updates.length === 0) return 1.0;

    const validUpdates = updates.filter(update => 
      update.dataHash && update.dataHash !== 'invalid'
    ).length;

    const conflictResolutionSuccesses = updates.filter(update =>
      !update.conflictResolution?.hadConflict || 
      update.conflictResolution?.resolutionStrategy !== 'fallback-to-cache'
    ).length;

    return (validUpdates + conflictResolutionSuccesses) / (updates.length * 2);
  }

  /**
   * Adjust batch interval based on performance and connection quality
   */
  private adjustBatchInterval(): void {
    if (!this.config.adaptiveBatching) return;

    const avgProcessingTime = this.batchPerformanceHistory.length > 0 ?
      this.batchPerformanceHistory.reduce((sum, time) => sum + time, 0) / this.batchPerformanceHistory.length : 0;

    const connectionQualityFactor = this.connectionHealth.connectionQuality === 'excellent' ? 0.8 :
                                   this.connectionHealth.connectionQuality === 'good' ? 1.0 :
                                   this.connectionHealth.connectionQuality === 'poor' ? 1.5 : 2.0;

    // Adjust interval based on processing time and connection quality
    let newInterval = this.config.batchInterval;
    
    if (avgProcessingTime > 100) { // If processing is slow, increase interval
      newInterval = Math.min(this.config.maxBatchInterval, newInterval * 1.2);
    } else if (avgProcessingTime < 50) { // If processing is fast, decrease interval
      newInterval = Math.max(this.config.minBatchInterval, newInterval * 0.9);
    }

    // Apply connection quality factor
    newInterval = Math.floor(newInterval * connectionQualityFactor);

    // Clamp to configured bounds
    this.adaptiveInterval = Math.max(
      this.config.minBatchInterval,
      Math.min(this.config.maxBatchInterval, newInterval)
    );

    // Restart batch timer with new interval
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.startBatchProcessing();
    }
  }

  /**
   * Track batch processing performance
   */
  private trackBatchPerformance(processingTime: number): void {
    this.batchPerformanceHistory.push(processingTime);
    if (this.batchPerformanceHistory.length > 50) {
      this.batchPerformanceHistory.shift(); // Keep last 50 measurements
    }
  }

  /**
   * Enhanced connection quality assessment
   */
  private updateConnectionQuality(): void {
    const latency = this.connectionHealth.latency;
    const thresholds = this.config.connectionQualityThresholds;
    
    if (latency < thresholds.excellent) {
      this.connectionHealth.connectionQuality = 'excellent';
    } else if (latency < thresholds.good) {
      this.connectionHealth.connectionQuality = 'good';
    } else if (latency < thresholds.poor) {
      this.connectionHealth.connectionQuality = 'poor';
    } else {
      this.connectionHealth.connectionQuality = 'critical';
    }
  }

  /**
   * Calculate connection stability score based on recent events
   */
  private updateConnectionStability(): void {
    const now = Date.now();
    const recentEvents = this.connectionEvents.filter(
      event => now - event.timestamp < 300000 // Last 5 minutes
    );

    if (recentEvents.length === 0) {
      this.connectionHealth.connectionStability = 1.0;
      return;
    }

    // Calculate stability based on disconnect frequency
    const disconnects = recentEvents.filter(event => event.type === 'disconnect').length;
    const stability = Math.max(0, 1.0 - (disconnects * 0.2)); // Each disconnect reduces stability by 20%

    this.connectionHealth.connectionStability = stability;
  }

  /**
   * Enhanced immediate processing check
   */
  private shouldProcessImmediately(update?: SyncUpdate): boolean {
    const criticalCount = this.updateQueue.filter(u => u.priority === 'critical').length;
    const highCount = this.updateQueue.filter(u => u.priority === 'high').length;
    
    // Process immediately for critical updates
    if (update?.priority === 'critical' || criticalCount > 0) {
      return true;
    }
    
    // Process when high priority threshold is reached
    if (highCount >= this.config.batchSizeThresholds.high) {
      return true;
    }
    
    // Process when queue is full
    if (this.updateQueue.length >= this.config.maxBatchSize) {
      return true;
    }
    
    // Process based on connection quality - process more frequently on poor connections
    if (this.connectionHealth.connectionQuality === 'poor' && this.updateQueue.length >= 10) {
      return true;
    }
    
    return false;
  }

  /**
   * Enhanced polling mode with adaptive intervals
   */
  private startPollingMode(): void {
    if (this.isPollingMode) return;
    
    this.isPollingMode = true;
    this.connectionHealth.pollingFallbackActive = true;
    
    // Start with configured interval
    this.connectionHealth.pollingInterval = this.config.pollingFallbackInterval;
    
    console.warn('🔄 Switching to enhanced polling mode due to connection issues');
    
    // Start polling timer with adaptive interval
    this.pollingTimer = setInterval(() => {
      this.performEnhancedPollingUpdate();
    }, this.connectionHealth.pollingInterval);
  }

  /**
   * Enhanced polling update with backoff strategy
   */
  private async performEnhancedPollingUpdate(): void {
    try {
      // Emit polling event that can be handled by the enhanced WebSocket hook
      this.addUpdate({
        type: 'stats',
        data: { 
          type: 'enhanced_polling_update', 
          timestamp: Date.now(),
          pollingInterval: this.connectionHealth.pollingInterval,
          connectionHealth: this.getConnectionHealth()
        },
        source: 'polling',
        priority: 'low'
      });

      // Adaptive polling interval based on success/failure
      if (this.connectionHealth.connectionQuality === 'critical') {
        // Increase polling interval on poor connection
        this.connectionHealth.pollingInterval = Math.min(
          this.connectionHealth.pollingInterval * this.config.pollingBackoffMultiplier,
          this.config.maxPollingInterval
        );
      } else {
        // Decrease polling interval on improving connection
        this.connectionHealth.pollingInterval = Math.max(
          this.config.pollingFallbackInterval,
          this.connectionHealth.pollingInterval / this.config.pollingBackoffMultiplier
        );
      }

      // Restart timer with new interval
      if (this.pollingTimer) {
        clearInterval(this.pollingTimer);
        this.pollingTimer = setInterval(() => {
          this.performEnhancedPollingUpdate();
        }, this.connectionHealth.pollingInterval);
      }

    } catch (error) {
      console.error('Enhanced polling update failed:', error);
      
      // Increase polling interval on failure
      this.connectionHealth.pollingInterval = Math.min(
        this.connectionHealth.pollingInterval * this.config.pollingBackoffMultiplier,
        this.config.maxPollingInterval
      );
    }
  }

  /**
   * Enhanced stop polling mode
   */
  private stopPollingMode(): void {
    if (!this.isPollingMode) return;
    
    this.isPollingMode = false;
    this.connectionHealth.pollingFallbackActive = false;
    this.connectionHealth.pollingInterval = this.config.pollingFallbackInterval;
    
    console.log('✅ Switching back to WebSocket mode from enhanced polling');
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Enhanced batch processing timer with adaptive intervals
   */
  private startBatchProcessing(): void {
    this.batchTimer = setInterval(() => {
      if (this.updateQueue.length > 0 && !this.isProcessing) {
        this.processBatch();
      }
    }, this.adaptiveInterval);
  }
}

// Singleton instance
let realTimeSyncService: RealTimeSyncService | null = null;

/**
 * Get the singleton real-time sync service
 */
export const getRealTimeSyncService = (config?: Partial<SyncConfig>): RealTimeSyncService => {
  if (!realTimeSyncService) {
    realTimeSyncService = new RealTimeSyncService(config);
  }
  return realTimeSyncService;
};

export default RealTimeSyncService;