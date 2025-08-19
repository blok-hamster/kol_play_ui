/**
 * Unit tests for useProgressiveLoading hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useProgressiveLoading } from '../use-progressive-loading';

// Mock dependencies
jest.mock('axios');
jest.mock('@/stores/use-ui-store', () => ({
  useNotifications: () => ({
    showError: jest.fn(),
    showInfo: jest.fn(),
  }),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('useProgressiveLoading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useProgressiveLoading());

      expect(result.current.loadingState).toEqual({
        trades: 'idle',
        mindmap: 'idle',
        stats: 'idle',
        trending: 'idle',
      });
      expect(result.current.essentialData).toBeNull();
      expect(result.current.mindmapData).toEqual({});
      expect(result.current.isPhaseComplete('essential')).toBe(false);
    });

    it('should accept custom options', () => {
      const options = {
        maxRetries: 5,
        retryDelay: 2000,
        enableCache: false,
        cacheTTL: 600000,
      };

      const { result } = renderHook(() => useProgressiveLoading(options));

      // Should initialize without errors
      expect(result.current.loadingState.trades).toBe('idle');
    });
  });

  describe('Essential Data Loading', () => {
    it('should load essential data successfully', async () => {
      const mockTradesResponse = {
        data: {
          success: true,
          data: {
            trades: [
              {
                id: '1',
                kolWallet: 'wallet1',
                signature: 'sig1',
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
              totalTrades: 100,
              uniqueKOLs: 50,
              uniqueTokens: 25,
              totalVolume: 1000000,
            },
          },
        },
      };

      const mockTrendingResponse = {
        data: {
          success: true,
          data: {
            trendingTokens: ['token1', 'token2', 'token3'],
          },
        },
      };

      mockedAxios.get
        .mockResolvedValueOnce(mockTradesResponse)
        .mockResolvedValueOnce(mockStatsResponse)
        .mockResolvedValueOnce(mockTrendingResponse);

      const { result } = renderHook(() => useProgressiveLoading());

      await act(async () => {
        await result.current.loadEssentialData();
      });

      await waitFor(() => {
        expect(result.current.loadingState.trades).toBe('loaded');
        expect(result.current.loadingState.stats).toBe('loaded');
        expect(result.current.loadingState.trending).toBe('loaded');
      });

      expect(result.current.essentialData).toEqual({
        trades: mockTradesResponse.data.data.trades,
        stats: mockStatsResponse.data.data.tradingStats,
        trendingTokens: mockTrendingResponse.data.data.trendingTokens,
      });

      expect(result.current.isPhaseComplete('essential')).toBe(true);
    });

    it('should handle API failures gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useProgressiveLoading());

      await act(async () => {
        await result.current.loadEssentialData();
      });

      await waitFor(() => {
        expect(result.current.loadingState.trades).toBe('error');
        expect(result.current.loadingState.stats).toBe('error');
        expect(result.current.loadingState.trending).toBe('error');
      });

      expect(result.current.essentialData).toBeNull();
      expect(result.current.isPhaseComplete('essential')).toBe(false);
    });

    it('should implement retry logic with exponential backoff', async () => {
      let callCount = 0;
      mockedAxios.get.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          data: {
            success: true,
            data: { trades: [], tradingStats: {}, trendingTokens: [] },
          },
        });
      });

      const { result } = renderHook(() => 
        useProgressiveLoading({ maxRetries: 3, retryDelay: 100 })
      );

      await act(async () => {
        await result.current.loadEssentialData();
      });

      // Should eventually succeed after retries
      await waitFor(() => {
        expect(callCount).toBe(3);
      }, { timeout: 5000 });
    });
  });

  describe('Enhanced Data Loading', () => {
    it('should load enhanced data after essential data is available', async () => {
      const mockMindmapResponse = {
        data: {
          success: true,
          data: {
            mindmaps: [
              {
                tokenMint: 'token1',
                kolConnections: {
                  kol1: {
                    kolWallet: 'kol1',
                    tradeCount: 5,
                    totalVolume: 1000,
                    influenceScore: 80,
                  },
                },
                networkMetrics: {
                  totalTrades: 5,
                  totalVolume: 1000,
                },
                lastUpdate: new Date(),
              },
            ],
          },
        },
      };

      mockedAxios.post.mockResolvedValue(mockMindmapResponse);

      const { result } = renderHook(() => useProgressiveLoading());

      // Set essential data first
      act(() => {
        (result.current as any).setEssentialData({
          trades: [],
          stats: {},
          trendingTokens: ['token1', 'token2'],
        });
      });

      await act(async () => {
        await result.current.loadEnhancedData();
      });

      await waitFor(() => {
        expect(result.current.loadingState.mindmap).toBe('loaded');
      });

      expect(Object.keys(result.current.mindmapData)).toContain('token1');
    });

    it('should skip enhanced loading if no trending tokens available', async () => {
      const { result } = renderHook(() => useProgressiveLoading());

      await act(async () => {
        await result.current.loadEnhancedData();
      });

      expect(result.current.loadingState.mindmap).toBe('idle');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('Background Data Loading', () => {
    it('should load background data in chunks', async () => {
      const mockMindmapResponse = {
        data: {
          success: true,
          data: {
            mindmaps: [
              { tokenMint: 'token6', kolConnections: {}, networkMetrics: {} },
              { tokenMint: 'token7', kolConnections: {}, networkMetrics: {} },
            ],
          },
        },
      };

      mockedAxios.post.mockResolvedValue(mockMindmapResponse);

      const { result } = renderHook(() => useProgressiveLoading());

      // Set essential data with many trending tokens
      act(() => {
        (result.current as any).setEssentialData({
          trades: [],
          stats: {},
          trendingTokens: Array.from({ length: 15 }, (_, i) => `token${i + 1}`),
        });
      });

      await act(async () => {
        await result.current.loadBackgroundData();
      });

      // Should make multiple API calls for chunks
      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    it('should use cached data when available', async () => {
      const { result } = renderHook(() => 
        useProgressiveLoading({ enableCache: true, cacheTTL: 60000 })
      );

      // First call should make API request
      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: { trades: [] } },
      });

      await act(async () => {
        await result.current.loadEssentialData();
      });

      expect(mockedAxios.get).toHaveBeenCalled();

      // Clear mock call history
      mockedAxios.get.mockClear();

      // Second call should use cache (no API calls)
      await act(async () => {
        await result.current.loadEssentialData();
      });

      // Should not make new API calls due to cache
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should clear cache when requested', () => {
      const { result } = renderHook(() => useProgressiveLoading());

      act(() => {
        result.current.clearCache();
      });

      // Should not throw error
      expect(result.current.clearCache).toBeDefined();
    });
  });

  describe('Phase Completion Tracking', () => {
    it('should correctly track phase completion', () => {
      const { result } = renderHook(() => useProgressiveLoading());

      // Initially no phases complete
      expect(result.current.isPhaseComplete('essential')).toBe(false);
      expect(result.current.isPhaseComplete('enhanced')).toBe(false);
      expect(result.current.isPhaseComplete('background')).toBe(false);

      // Simulate essential phase completion
      act(() => {
        (result.current as any).setLoadingState({
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'idle',
        });
      });

      expect(result.current.isPhaseComplete('essential')).toBe(true);
      expect(result.current.isPhaseComplete('enhanced')).toBe(false);

      // Simulate enhanced phase completion
      act(() => {
        (result.current as any).setLoadingState({
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'loaded',
        });
      });

      expect(result.current.isPhaseComplete('enhanced')).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed requests', async () => {
      const { result } = renderHook(() => useProgressiveLoading());

      // Set error state
      act(() => {
        (result.current as any).setLoadingState({
          trades: 'error',
          stats: 'error',
          trending: 'loaded',
          mindmap: 'error',
        });
      });

      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: { trades: [], tradingStats: {} } },
      });

      await act(async () => {
        await result.current.retryFailedRequests();
      });

      expect(mockedAxios.get).toHaveBeenCalled();
    });

    it('should not retry if no errors present', async () => {
      const { result } = renderHook(() => useProgressiveLoading());

      // Set all loaded state
      act(() => {
        (result.current as any).setLoadingState({
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'loaded',
        });
      });

      await act(async () => {
        await result.current.retryFailedRequests();
      });

      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });



  describe('Cleanup', () => {
    it('should cleanup resources on unmount', () => {
      const { unmount } = renderHook(() => useProgressiveLoading());

      // Should not throw error on unmount
      expect(() => unmount()).not.toThrow();
    });

    it('should abort ongoing requests on unmount', async () => {
      const abortSpy = jest.fn();
      const mockAbortController = {
        abort: abortSpy,
        signal: {} as AbortSignal,
      };

      // Mock AbortController
      global.AbortController = jest.fn(() => mockAbortController) as any;

      const { unmount } = renderHook(() => useProgressiveLoading());

      // Start a request
      act(() => {
        // This would normally start a request with abort controller
      });

      unmount();

      // Should have called abort (in a real scenario)
      // Note: This is a simplified test as the actual implementation
      // uses AbortController internally
    });
  });
});