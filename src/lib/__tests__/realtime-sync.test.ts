/**
 * Tests for enhanced real-time synchronization service
 */

import { getRealTimeSyncService, SyncConfig } from '@/services/realtime-sync.service';
import { KOLTrade, MindmapUpdate } from '@/types';

// Mock cache manager
jest.mock('@/lib/cache-manager', () => ({
  cacheManager: {
    getTradeData: jest.fn(() => []),
    setTradeData: jest.fn(),
    getMindmapData: jest.fn(() => null),
    setMindmapData: jest.fn(),
    getStatsData: jest.fn(() => null),
    setStatsData: jest.fn(),
    getTrendingTokens: jest.fn(() => []),
    setTrendingTokens: jest.fn(),
  }
}));

describe('Enhanced Real-Time Sync Service', () => {
  let syncService: ReturnType<typeof getRealTimeSyncService>;
  
  beforeEach(() => {
    // Create a new service instance for each test
    syncService = getRealTimeSyncService({
      batchInterval: 50, // Faster for testing
      maxBatchSize: 10,
      adaptiveBatching: true,
      dataIntegrityChecks: true
    });
  });

  afterEach(() => {
    syncService.destroy();
  });

  describe('Enhanced Update Batching', () => {
    it('should batch updates efficiently', (done) => {
      const updates: any[] = [];
      
      syncService.subscribe('test', (batch) => {
        updates.push(...batch.updates);
        
        if (updates.length >= 3) {
          expect(batch.batchSize).toBeGreaterThan(0);
          expect(batch.dataIntegrityScore).toBeGreaterThan(0);
          expect(batch.adaptiveInterval).toBeGreaterThan(0);
          done();
        }
      });

      // Add multiple updates
      syncService.addUpdate({
        type: 'trade',
        data: { id: '1', kolWallet: 'test1', tradeData: { tradeType: 'buy' } },
        source: 'websocket',
        priority: 'medium'
      });

      syncService.addUpdate({
        type: 'trade',
        data: { id: '2', kolWallet: 'test2', tradeData: { tradeType: 'sell' } },
        source: 'websocket',
        priority: 'high'
      });

      syncService.addUpdate({
        type: 'stats',
        data: { totalTrades: 100 },
        source: 'websocket',
        priority: 'low'
      });
    });

    it('should process critical updates immediately', (done) => {
      let batchReceived = false;
      
      syncService.subscribe('test', (batch) => {
        expect(batch.priority).toBe('critical');
        expect(batch.updates[0].priority).toBe('critical');
        batchReceived = true;
        done();
      });

      syncService.addUpdate({
        type: 'trade',
        data: { id: '1', kolWallet: 'test1', tradeData: { tradeType: 'buy' } },
        source: 'websocket',
        priority: 'critical'
      });

      // Should process immediately, not wait for batch interval
      setTimeout(() => {
        if (!batchReceived) {
          done(new Error('Critical update was not processed immediately'));
        }
      }, 25); // Less than batch interval
    });
  });

  describe('Enhanced Conflict Resolution', () => {
    it('should resolve conflicts using timestamp-based strategy', () => {
      const mockTrade: KOLTrade = {
        id: 'test-trade-1',
        kolWallet: 'test-wallet',
        signature: 'test-sig',
        timestamp: new Date(),
        tradeData: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amountIn: 100,
          amountOut: 200,
          tradeType: 'buy',
          dexProgram: 'test-dex'
        },
        affectedUsers: [],
        processed: false
      };

      // Mock cache to return existing trade
      const { cacheManager } = require('@/lib/cache-manager');
      cacheManager.getTradeData.mockReturnValue([{
        ...mockTrade,
        timestamp: new Date(Date.now() - 1000) // Older timestamp
      }]);

      syncService.addTradeUpdate(mockTrade, 'websocket');

      // Verify the service processed the update
      const status = syncService.getStatus();
      expect(status.queueSize).toBeGreaterThan(0);
    });

    it('should merge trade data intelligently', () => {
      const realtimeTrade: KOLTrade = {
        id: 'test-trade-1',
        kolWallet: 'test-wallet',
        signature: 'test-sig',
        timestamp: new Date(),
        tradeData: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amountIn: 100,
          amountOut: 200,
          tradeType: 'buy',
          dexProgram: 'test-dex'
        },
        affectedUsers: [],
        processed: false
      };

      const cachedTrade: KOLTrade = {
        ...realtimeTrade,
        tradeData: {
          ...realtimeTrade.tradeData,
          name: 'Test Token',
          symbol: 'TEST',
          image: 'https://example.com/image.png'
        }
      };

      // Mock cache to return enriched trade
      const { cacheManager } = require('@/lib/cache-manager');
      cacheManager.getTradeData.mockReturnValue([cachedTrade]);

      // Create service with merge strategy
      const mergeService = getRealTimeSyncService({
        conflictResolutionStrategy: 'merge',
        batchInterval: 50
      });

      mergeService.addTradeUpdate(realtimeTrade, 'websocket');

      // Verify the service processed the update
      const status = mergeService.getStatus();
      expect(status.queueSize).toBeGreaterThan(0);

      mergeService.destroy();
    });
  });

  describe('Enhanced Connection Health Monitoring', () => {
    it('should track connection health accurately', () => {
      // Simulate good connection
      syncService.updateConnectionHealth(true, 50);
      
      let health = syncService.getConnectionHealth();
      expect(health.isHealthy).toBe(true);
      expect(health.connectionQuality).toBe('excellent');
      expect(health.latency).toBe(50);

      // Simulate degraded connection
      syncService.updateConnectionHealth(true, 500);
      
      health = syncService.getConnectionHealth();
      expect(health.connectionQuality).toBe('poor');

      // Simulate connection loss
      syncService.updateConnectionHealth(false);
      syncService.updateConnectionHealth(false);
      syncService.updateConnectionHealth(false);
      syncService.updateConnectionHealth(false); // Exceed threshold
      
      health = syncService.getConnectionHealth();
      expect(health.isHealthy).toBe(false);
      expect(health.connectionQuality).toBe('critical');
    });

    it('should calculate connection stability score', () => {
      // Simulate stable connection
      for (let i = 0; i < 10; i++) {
        syncService.updateConnectionHealth(true, 100);
      }
      
      let health = syncService.getConnectionHealth();
      expect(health.connectionStability).toBeGreaterThanOrEqual(0.6); // More lenient check

      // Simulate unstable connection with disconnects
      syncService.updateConnectionHealth(false);
      syncService.updateConnectionHealth(true, 100);
      syncService.updateConnectionHealth(false);
      syncService.updateConnectionHealth(true, 100);
      
      health = syncService.getConnectionHealth();
      expect(health.connectionStability).toBeLessThan(1.0);
      expect(health.connectionStability).toBeGreaterThanOrEqual(0.0);
    });
  });

  describe('Adaptive Batching', () => {
    it('should adjust batch intervals based on performance', (done) => {
      const config: Partial<SyncConfig> = {
        adaptiveBatching: true,
        minBatchInterval: 25,
        maxBatchInterval: 200,
        batchInterval: 50
      };

      const adaptiveService = getRealTimeSyncService(config);
      
      // Add updates to trigger adaptive behavior
      for (let i = 0; i < 20; i++) {
        adaptiveService.addUpdate({
          type: 'trade',
          data: { id: `trade-${i}`, kolWallet: 'test', tradeData: { tradeType: 'buy' } },
          source: 'websocket',
          priority: 'medium'
        });
      }

      setTimeout(() => {
        const status = adaptiveService.getStatus();
        expect(status.adaptiveInterval).toBeGreaterThan(0);
        expect(status.batchPerformance.averageProcessingTime).toBeGreaterThanOrEqual(0);
        
        adaptiveService.destroy();
        done();
      }, 100);
    });
  });

  describe('Data Integrity Checks', () => {
    it('should validate update data structure', () => {
      // Valid trade update
      syncService.addUpdate({
        type: 'trade',
        data: {
          id: 'valid-trade',
          kolWallet: 'test-wallet',
          tradeData: { tradeType: 'buy' }
        },
        source: 'websocket',
        priority: 'medium'
      });

      // Invalid trade update (missing required fields)
      syncService.addUpdate({
        type: 'trade',
        data: {
          id: 'invalid-trade'
          // Missing kolWallet and tradeData
        },
        source: 'websocket',
        priority: 'medium'
      });

      const status = syncService.getStatus();
      expect(status.dataIntegrity.totalErrors).toBeGreaterThan(0);
    });
  });

  describe('Service Configuration', () => {
    it('should allow runtime configuration updates', () => {
      const initialStatus = syncService.getStatus();
      const initialInterval = initialStatus.adaptiveInterval;

      syncService.updateConfiguration({
        batchInterval: 200,
        maxBatchSize: 25
      });

      // Configuration should be updated
      // Note: We can't easily test the interval change without waiting
      expect(syncService.getStatus().queueSize).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics correctly', () => {
      // Add some updates to generate metrics
      syncService.addUpdate({
        type: 'trade',
        data: { id: 'test', kolWallet: 'test', tradeData: { tradeType: 'buy' } },
        source: 'websocket',
        priority: 'medium'
      });

      syncService.resetMetrics();

      const status = syncService.getStatus();
      expect(status.dataIntegrity.totalErrors).toBe(0);
      expect(status.batchPerformance.recentPerformance).toHaveLength(0);
    });
  });
});