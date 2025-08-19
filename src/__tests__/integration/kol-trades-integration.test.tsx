/**
 * Integration tests for KOL trades system
 * Tests the complete flow from data loading to UI rendering
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useKOLTradeSocket } from '@/hooks/use-kol-trade-socket';
import { useProgressiveLoading } from '@/hooks/use-progressive-loading';
import { ApiErrorBoundary } from '@/components/error-boundaries/api-error-boundary';
import { cacheManager } from '@/lib/cache-manager';

// Mock dependencies
jest.mock('axios');
jest.mock('socket.io-client');
jest.mock('@/lib/cache-manager');
jest.mock('@/stores/use-user-store', () => ({
  useUserStore: () => ({ user: { id: 'test-user' } }),
}));
jest.mock('@/stores/use-ui-store', () => ({
  useNotifications: () => ({
    showError: jest.fn(),
    showInfo: jest.fn(),
  }),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedIo = io as jest.MockedFunction<typeof io>;
const mockedCacheManager = cacheManager as jest.Mocked<typeof cacheManager>;

// Mock socket instance
const mockSocket = {
  connected: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
};

// Test component that uses KOL trades functionality
const KOLTradesTestComponent: React.FC = () => {
  const {
    recentTrades,
    allMindmapData,
    trendingTokens,
    isLoadingInitialData,
    loadingPhase,
    stats,
    isConnected,
  } = useKOLTradeSocket();

  const {
    loadingState,
    essentialData,
    mindmapData,
    isPhaseComplete,
  } = useProgressiveLoading();

  return (
    <div data-testid="kol-trades-component">
      <div data-testid="loading-phase">{loadingPhase}</div>
      <div data-testid="is-loading">{isLoadingInitialData.toString()}</div>
      <div data-testid="is-connected">{isConnected.toString()}</div>
      <div data-testid="trades-count">{recentTrades.length}</div>
      <div data-testid="mindmap-tokens-count">{Object.keys(allMindmapData).length}</div>
      <div data-testid="trending-count">{trendingTokens.length}</div>
      <div data-testid="total-trades">{stats.totalTrades}</div>
      <div data-testid="essential-complete">{isPhaseComplete('essential').toString()}</div>
      <div data-testid="enhanced-complete">{isPhaseComplete('enhanced').toString()}</div>
      
      {recentTrades.map(trade => (
        <div key={trade.id} data-testid={`trade-${trade.id}`}>
          {trade.kolWallet} - {trade.tradeData.tradeType}
        </div>
      ))}
      
      {Object.entries(allMindmapData).map(([tokenMint, data]) => (
        <div key={tokenMint} data-testid={`mindmap-${tokenMint}`}>
          {tokenMint} - {Object.keys(data.kolConnections).length} KOLs
        </div>
      ))}
    </div>
  );
};

describe('KOL Trades Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockedIo.mockReturnValue(mockSocket as any);
    mockedCacheManager.getTradeData.mockReturnValue(null);
    mockedCacheManager.getMindmapData.mockReturnValue(null);
    mockedCacheManager.getStatsData.mockReturnValue(null);
    mockedCacheManager.getTrendingTokens.mockReturnValue([]);
    mockedCacheManager.setTradeData.mockImplementation(() => {});
    mockedCacheManager.setMindmapData.mockImplementation(() => {});
    mockedCacheManager.setStatsData.mockImplementation(() => {});
    mockedCacheManager.setTrendingTokens.mockImplementation(() => {});
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'test-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });

    // Set environment variables
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:5000';
  });

  describe('Complete Data Loading Flow', () => {
    it('should complete the full progressive loading cycle', async () => {
      // Mock API responses
      const mockTradesResponse = {
        data: {
          success: true,
          data: {
            trades: [
              {
                id: 'trade-1',
                kolWallet: 'wallet-1',
                signature: 'sig-1',
                timestamp: new Date(),
                tradeData: {
                  tokenIn: 'SOL',
                  tokenOut: 'USDC',
                  amountIn: 100,
                  amountOut: 200,
                  tradeType: 'buy',
                  dexProgram: 'jupiter',
                },
                affectedUsers: [],
                processed: false,
              },
            ],
          },
        },
      };

      const mockStatsResponse = {
        data: {
          success: true,
          data: {
            tradingStats: {
              totalTrades: 150,
              uniqueKOLs: 75,
              uniqueTokens: 50,
              totalVolume: 2000000,
            },
          },
        },
      };

      const mockTrendingResponse = {
        data: {
          success: true,
          data: {
            trendingTokens: ['token-1', 'token-2', 'token-3'],
          },
        },
      };

      const mockMindmapResponse = {
        data: {
          success: true,
          data: {
            mindmaps: [
              {
                tokenMint: 'token-1',
                kolConnections: {
                  'kol-1': {
                    kolWallet: 'kol-1',
                    tradeCount: 10,
                    totalVolume: 5000,
                    influenceScore: 85,
                  },
                },
                networkMetrics: {
                  totalTrades: 10,
                  totalVolume: 5000,
                },
                lastUpdate: new Date(),
              },
            ],
          },
        },
      };

      // Setup API call sequence
      mockedAxios.get
        .mockResolvedValueOnce(mockTradesResponse)
        .mockResolvedValueOnce(mockStatsResponse)
        .mockResolvedValueOnce(mockTrendingResponse);
      
      mockedAxios.post.mockResolvedValue(mockMindmapResponse);

      render(
        <ApiErrorBoundary>
          <KOLTradesTestComponent />
        </ApiErrorBoundary>
      );

      // Should start in loading state
      expect(screen.getByTestId('is-loading')).toHaveTextContent('true');
      expect(screen.getByTestId('loading-phase')).toHaveTextContent('idle');

      // Wait for essential data to load
      await waitFor(() => {
        expect(screen.getByTestId('loading-phase')).toHaveTextContent('essential');
      }, { timeout: 5000 });

      // Wait for data to be processed
      await waitFor(() => {
        expect(screen.getByTestId('trades-count')).toHaveTextContent('1');
        expect(screen.getByTestId('total-trades')).toHaveTextContent('150');
        expect(screen.getByTestId('trending-count')).toHaveTextContent('3');
      }, { timeout: 5000 });

      // Wait for enhanced data
      await waitFor(() => {
        expect(screen.getByTestId('loading-phase')).toHaveTextContent('enhanced');
      }, { timeout: 5000 });

      // Wait for mindmap data
      await waitFor(() => {
        expect(screen.getByTestId('mindmap-tokens-count')).toHaveTextContent('1');
      }, { timeout: 5000 });

      // Verify complete loading
      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
        expect(screen.getByTestId('loading-phase')).toHaveTextContent('complete');
      }, { timeout: 10000 });

      // Verify data is displayed
      expect(screen.getByTestId('trade-trade-1')).toBeInTheDocument();
      expect(screen.getByTestId('mindmap-token-1')).toBeInTheDocument();
    });

    it('should handle API failures gracefully and show error boundaries', async () => {
      // Mock API failures
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      render(
        <ApiErrorBoundary apiName="KOL Trades API">
          <KOLTradesTestComponent />
        </ApiErrorBoundary>
      );

      // Should handle errors gracefully
      await waitFor(() => {
        expect(screen.getByTestId('trades-count')).toHaveTextContent('0');
      });

      // Should not crash the application
      expect(screen.getByTestId('kol-trades-component')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates Integration', () => {
    it('should handle WebSocket connection and real-time updates', async () => {
      let connectHandler: () => void;
      let tradeUpdateHandler: (data: any) => void;
      let mindmapUpdateHandler: (data: any) => void;

      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'connect') {
          connectHandler = handler;
        } else if (event === 'kol_trade_update') {
          tradeUpdateHandler = handler;
        } else if (event === 'mindmap_update') {
          mindmapUpdateHandler = handler;
        }
      });

      // Mock initial API responses
      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: { trades: [], tradingStats: {}, trendingTokens: [] } },
      });

      render(
        <ApiErrorBoundary>
          <KOLTradesTestComponent />
        </ApiErrorBoundary>
      );

      // Simulate WebSocket connection
      await act(async () => {
        if (connectHandler) {
          mockSocket.connected = true;
          connectHandler();
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      // Simulate real-time trade update
      const newTrade = {
        id: 'realtime-trade-1',
        kolWallet: 'realtime-wallet',
        signature: 'realtime-sig',
        timestamp: new Date(),
        tradeData: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amountIn: 150,
          amountOut: 300,
          tradeType: 'sell',
          dexProgram: 'jupiter',
        },
        affectedUsers: [],
        processed: false,
      };

      await act(async () => {
        if (tradeUpdateHandler) {
          tradeUpdateHandler(newTrade);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('trade-realtime-trade-1')).toBeInTheDocument();
        expect(screen.getByTestId('trades-count')).toHaveTextContent('1');
      });

      // Simulate mindmap update
      const mindmapUpdate = {
        tokenMint: 'realtime-token',
        kolConnections: {
          'realtime-kol': {
            kolWallet: 'realtime-kol',
            tradeCount: 5,
            totalVolume: 2500,
            influenceScore: 70,
          },
        },
        networkMetrics: {
          totalTrades: 5,
          totalVolume: 2500,
        },
        lastUpdate: new Date(),
      };

      await act(async () => {
        if (mindmapUpdateHandler) {
          mindmapUpdateHandler(mindmapUpdate);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('mindmap-realtime-token')).toBeInTheDocument();
        expect(screen.getByTestId('mindmap-tokens-count')).toHaveTextContent('1');
      });
    });

    it('should handle WebSocket disconnection and reconnection', async () => {
      let connectHandler: () => void;
      let disconnectHandler: (reason: string) => void;

      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'connect') {
          connectHandler = handler;
        } else if (event === 'disconnect') {
          disconnectHandler = handler;
        }
      });

      render(
        <ApiErrorBoundary>
          <KOLTradesTestComponent />
        </ApiErrorBoundary>
      );

      // Simulate initial connection
      await act(async () => {
        if (connectHandler) {
          mockSocket.connected = true;
          connectHandler();
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      // Simulate disconnection
      await act(async () => {
        if (disconnectHandler) {
          mockSocket.connected = false;
          disconnectHandler('transport close');
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('false');
      });

      // Simulate reconnection
      await act(async () => {
        if (connectHandler) {
          mockSocket.connected = true;
          connectHandler();
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });
    });
  });

  describe('Cache Integration', () => {
    it('should use cached data when available and update cache with new data', async () => {
      // Setup cached data
      const cachedTrades = [
        {
          id: 'cached-trade',
          kolWallet: 'cached-wallet',
          signature: 'cached-sig',
          timestamp: new Date(),
          tradeData: {
            tokenIn: 'SOL',
            tokenOut: 'USDC',
            amountIn: 75,
            amountOut: 150,
            tradeType: 'buy',
            dexProgram: 'jupiter',
          },
          affectedUsers: [],
          processed: true,
        },
      ];

      const cachedStats = {
        totalTrades: 100,
        uniqueKOLs: 50,
        uniqueTokens: 30,
        totalVolume: 1500000,
      };

      mockedCacheManager.getTradeData.mockReturnValue(cachedTrades);
      mockedCacheManager.getStatsData.mockReturnValue(cachedStats);

      // Mock fresh API data
      mockedAxios.get.mockResolvedValue({
        data: {
          success: true,
          data: {
            trades: [
              {
                id: 'fresh-trade',
                kolWallet: 'fresh-wallet',
                signature: 'fresh-sig',
                timestamp: new Date(),
                tradeData: {
                  tokenIn: 'SOL',
                  tokenOut: 'USDC',
                  amountIn: 200,
                  amountOut: 400,
                  tradeType: 'sell',
                  dexProgram: 'jupiter',
                },
                affectedUsers: [],
                processed: false,
              },
            ],
            tradingStats: {
              totalTrades: 125,
              uniqueKOLs: 60,
              uniqueTokens: 35,
              totalVolume: 1750000,
            },
          },
        },
      });

      render(
        <ApiErrorBoundary>
          <KOLTradesTestComponent />
        </ApiErrorBoundary>
      );

      // Should initially show cached data
      await waitFor(() => {
        expect(screen.getByTestId('trade-cached-trade')).toBeInTheDocument();
        expect(screen.getByTestId('total-trades')).toHaveTextContent('100');
      });

      // Should update with fresh data
      await waitFor(() => {
        expect(screen.getByTestId('trade-fresh-trade')).toBeInTheDocument();
        expect(screen.getByTestId('total-trades')).toHaveTextContent('125');
      }, { timeout: 5000 });

      // Verify cache was updated
      expect(mockedCacheManager.setTradeData).toHaveBeenCalled();
      expect(mockedCacheManager.setStatsData).toHaveBeenCalled();
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from errors when retry is successful', async () => {
      let callCount = 0;
      mockedAxios.get.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          data: {
            success: true,
            data: {
              trades: [
                {
                  id: 'recovered-trade',
                  kolWallet: 'recovered-wallet',
                  signature: 'recovered-sig',
                  timestamp: new Date(),
                  tradeData: {
                    tokenIn: 'SOL',
                    tokenOut: 'USDC',
                    amountIn: 300,
                    amountOut: 600,
                    tradeType: 'buy',
                    dexProgram: 'jupiter',
                  },
                  affectedUsers: [],
                  processed: false,
                },
              ],
              tradingStats: {
                totalTrades: 200,
                uniqueKOLs: 100,
                uniqueTokens: 60,
                totalVolume: 3000000,
              },
            },
          },
        });
      });

      render(
        <ApiErrorBoundary>
          <KOLTradesTestComponent />
        </ApiErrorBoundary>
      );

      // Should eventually recover and show data
      await waitFor(() => {
        expect(screen.getByTestId('trade-recovered-trade')).toBeInTheDocument();
        expect(screen.getByTestId('total-trades')).toHaveTextContent('200');
      }, { timeout: 10000 });

      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    it('should show error boundary when all retries fail', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Persistent network error'));

      const { container } = render(
        <ApiErrorBoundary apiName="Test API">
          <KOLTradesTestComponent />
        </ApiErrorBoundary>
      );

      // Should show error boundary UI
      await waitFor(() => {
        expect(screen.getByText('Test API Connection Error')).toBeInTheDocument();
      });

      // Should provide retry functionality
      expect(screen.getByText('Retry Now')).toBeInTheDocument();
    });
  });

  describe('Performance Integration', () => {
    it('should handle large datasets efficiently', async () => {
      // Create large dataset
      const largeTrades = Array.from({ length: 500 }, (_, i) => ({
        id: `large-trade-${i}`,
        kolWallet: `large-wallet-${i}`,
        signature: `large-sig-${i}`,
        timestamp: new Date(),
        tradeData: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amountIn: 100 + i,
          amountOut: 200 + i,
          tradeType: i % 2 === 0 ? 'buy' : 'sell',
          dexProgram: 'jupiter',
        },
        affectedUsers: [],
        processed: false,
      }));

      mockedAxios.get.mockResolvedValue({
        data: {
          success: true,
          data: {
            trades: largeTrades,
            tradingStats: {
              totalTrades: 500,
              uniqueKOLs: 250,
              uniqueTokens: 100,
              totalVolume: 5000000,
            },
          },
        },
      });

      const startTime = performance.now();

      render(
        <ApiErrorBoundary>
          <KOLTradesTestComponent />
        </ApiErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByTestId('trades-count')).toHaveTextContent('100'); // Should be limited
        expect(screen.getByTestId('total-trades')).toHaveTextContent('500');
      }, { timeout: 5000 });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should handle large datasets within reasonable time
      expect(renderTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should maintain responsive UI during data updates', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: { trades: [], tradingStats: {}, trendingTokens: [] } },
      });

      let tradeUpdateHandler: (data: any) => void;
      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'kol_trade_update') {
          tradeUpdateHandler = handler;
        }
      });

      render(
        <ApiErrorBoundary>
          <KOLTradesTestComponent />
        </ApiErrorBoundary>
      );

      // Simulate rapid updates
      const rapidUpdates = Array.from({ length: 50 }, (_, i) => ({
        id: `rapid-${i}`,
        kolWallet: `rapid-wallet-${i}`,
        signature: `rapid-sig-${i}`,
        timestamp: new Date(),
        tradeData: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amountIn: 100,
          amountOut: 200,
          tradeType: 'buy',
          dexProgram: 'jupiter',
        },
        affectedUsers: [],
        processed: false,
      }));

      const startTime = performance.now();

      await act(async () => {
        rapidUpdates.forEach(update => {
          if (tradeUpdateHandler) {
            tradeUpdateHandler(update);
          }
        });
      });

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Should handle rapid updates efficiently
      expect(updateTime).toBeLessThan(1000); // 1 second max

      // UI should remain responsive
      expect(screen.getByTestId('kol-trades-component')).toBeInTheDocument();
    });
  });

  describe('End-to-End User Journey', () => {
    it('should complete full user journey from page load to interaction', async () => {
      // Setup complete mock responses
      const mockTradesResponse = {
        data: {
          success: true,
          data: {
            trades: [
              {
                id: 'journey-trade-1',
                kolWallet: 'journey-wallet-1',
                signature: 'journey-sig-1',
                timestamp: new Date(),
                tradeData: {
                  tokenIn: 'SOL',
                  tokenOut: 'USDC',
                  amountIn: 100,
                  amountOut: 200,
                  tradeType: 'buy',
                  dexProgram: 'jupiter',
                },
                affectedUsers: [],
                processed: false,
              },
            ],
          },
        },
      };

      const mockStatsResponse = {
        data: {
          success: true,
          data: {
            tradingStats: {
              totalTrades: 1000,
              uniqueKOLs: 500,
              uniqueTokens: 200,
              totalVolume: 10000000,
            },
          },
        },
      };

      const mockTrendingResponse = {
        data: {
          success: true,
          data: {
            trendingTokens: ['journey-token-1', 'journey-token-2'],
          },
        },
      };

      const mockMindmapResponse = {
        data: {
          success: true,
          data: {
            mindmaps: [
              {
                tokenMint: 'journey-token-1',
                kolConnections: {
                  'journey-kol-1': {
                    kolWallet: 'journey-kol-1',
                    tradeCount: 25,
                    totalVolume: 12500,
                    influenceScore: 90,
                  },
                },
                networkMetrics: {
                  totalTrades: 25,
                  totalVolume: 12500,
                },
                lastUpdate: new Date(),
              },
            ],
          },
        },
      };

      mockedAxios.get
        .mockResolvedValueOnce(mockTradesResponse)
        .mockResolvedValueOnce(mockStatsResponse)
        .mockResolvedValueOnce(mockTrendingResponse);
      
      mockedAxios.post.mockResolvedValue(mockMindmapResponse);

      // Setup WebSocket handlers
      let connectHandler: () => void;
      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'connect') {
          connectHandler = handler;
        }
      });

      render(
        <ApiErrorBoundary>
          <KOLTradesTestComponent />
        </ApiErrorBoundary>
      );

      // 1. Initial loading state
      expect(screen.getByTestId('is-loading')).toHaveTextContent('true');
      expect(screen.getByTestId('loading-phase')).toHaveTextContent('idle');

      // 2. Essential data loads
      await waitFor(() => {
        expect(screen.getByTestId('essential-complete')).toHaveTextContent('true');
        expect(screen.getByTestId('trades-count')).toHaveTextContent('1');
        expect(screen.getByTestId('total-trades')).toHaveTextContent('1000');
      }, { timeout: 5000 });

      // 3. Enhanced data loads
      await waitFor(() => {
        expect(screen.getByTestId('enhanced-complete')).toHaveTextContent('true');
        expect(screen.getByTestId('mindmap-tokens-count')).toHaveTextContent('1');
      }, { timeout: 5000 });

      // 4. WebSocket connects
      await act(async () => {
        if (connectHandler) {
          mockSocket.connected = true;
          connectHandler();
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      // 5. Complete loading
      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
        expect(screen.getByTestId('loading-phase')).toHaveTextContent('complete');
      }, { timeout: 10000 });

      // 6. Verify all data is present and accessible
      expect(screen.getByTestId('trade-journey-trade-1')).toBeInTheDocument();
      expect(screen.getByTestId('mindmap-journey-token-1')).toBeInTheDocument();
      expect(screen.getByTestId('trending-count')).toHaveTextContent('2');

      // Journey complete - user can now interact with the data
      expect(screen.getByTestId('kol-trades-component')).toBeInTheDocument();
    });
  });
});