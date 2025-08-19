/**
 * Unit tests for ProgressiveLoadingService
 */

import axios, { AxiosResponse } from 'axios';
import ProgressiveLoadingService from '../progressive-loading.service';

// Mock axios
jest.mock('axios');
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

describe('ProgressiveLoadingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    
    // Set default environment
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:5000';
  });

  describe('executeParallelCalls', () => {
    it('should execute multiple API calls in parallel successfully', async () => {
      const mockResponse1: AxiosResponse = {
        data: { result: 'data1' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const mockResponse2: AxiosResponse = {
        data: { result: 'data2' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const calls = {
        call1: jest.fn().mockResolvedValue(mockResponse1),
        call2: jest.fn().mockResolvedValue(mockResponse2),
      };

      const results = await ProgressiveLoadingService.executeParallelCalls(calls);

      expect(results.call1.success).toBe(true);
      expect(results.call1.data).toEqual({ result: 'data1' });

      expect(results.call2.success).toBe(true);
      expect(results.call2.data).toEqual({ result: 'data2' });

      expect(calls.call1).toHaveBeenCalledTimes(1);
      expect(calls.call2).toHaveBeenCalledTimes(1);
    });

    it('should handle individual call failures gracefully', async () => {
      const mockResponse: AxiosResponse = {
        data: { result: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const calls = {
        successCall: jest.fn().mockResolvedValue(mockResponse),
        failCall: jest.fn().mockRejectedValue(new Error('Network error')),
      };

      const results = await ProgressiveLoadingService.executeParallelCalls(calls);

      expect(results.successCall.success).toBe(true);
      expect(results.successCall.data).toEqual({ result: 'success' });

      expect(results.failCall.success).toBe(false);
      expect(results.failCall.error).toBe('Network error');
    });

    it('should implement retry logic with exponential backoff', async () => {
      let callCount = 0;
      const calls = {
        retryCall: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount < 3) {
            return Promise.reject(new Error('Temporary failure'));
          }
          return Promise.resolve({
            data: { result: 'success after retry' },
            status: 200,
          } as AxiosResponse);
        }),
      };

      const results = await ProgressiveLoadingService.executeParallelCalls(calls, {
        retries: 3,
        retryDelay: 10, // Short delay for testing
      });

      expect(results.retryCall.success).toBe(true);
      expect(results.retryCall.data).toEqual({ result: 'success after retry' });
      expect(callCount).toBe(3);
    });

    it('should respect timeout configuration', async () => {
      const calls = {
        slowCall: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 200))
        ),
      };

      const results = await ProgressiveLoadingService.executeParallelCalls(calls, {
        timeout: 50, // Very short timeout
      });

      expect(results.slowCall.success).toBe(false);
      expect(results.slowCall.error).toBe('Timeout');
    });
  });

  describe('loadEssentialData', () => {
    it('should load essential data successfully', async () => {
      const mockTradesResponse = {
        data: { success: true, data: { trades: [] } },
        status: 200,
      } as AxiosResponse;

      const mockStatsResponse = {
        data: { success: true, data: { stats: {} } },
        status: 200,
      } as AxiosResponse;

      const mockTrendingResponse = {
        data: { success: true, data: { trending: [] } },
        status: 200,
      } as AxiosResponse;

      mockedAxios.get
        .mockResolvedValueOnce(mockTradesResponse)
        .mockResolvedValueOnce(mockStatsResponse)
        .mockResolvedValueOnce(mockTrendingResponse);

      const results = await ProgressiveLoadingService.loadEssentialData();

      expect(results.trades.success).toBe(true);
      expect(results.stats.success).toBe(true);
      expect(results.trending.success).toBe(true);

      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:5000/api/kol-trades/recent?limit=50',
        expect.any(Object)
      );
    });

    it('should include auth token when available', async () => {
      mockLocalStorage.setItem('authToken', 'test-token');

      mockedAxios.get.mockResolvedValue({
        data: { success: true },
        status: 200,
      } as AxiosResponse);

      await ProgressiveLoadingService.loadEssentialData();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('loadMindmapData', () => {
    it('should split tokens into chunks for bulk requests', async () => {
      const tokens = Array.from({ length: 25 }, (_, i) => `token${i}`);
      
      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: { mindmaps: [] } },
        status: 200,
      } as AxiosResponse);

      const results = await ProgressiveLoadingService.loadMindmapData(tokens);

      // Should create 3 chunks (10, 10, 5)
      expect(Object.keys(results)).toHaveLength(3);
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);

      // Verify chunk sizes
      expect(mockedAxios.post).toHaveBeenNthCalledWith(1, 
        'http://localhost:5000/api/kol-trades/mindmap/bulk',
        { tokenMints: tokens.slice(0, 10) },
        expect.any(Object)
      );
      expect(mockedAxios.post).toHaveBeenNthCalledWith(2,
        'http://localhost:5000/api/kol-trades/mindmap/bulk',
        { tokenMints: tokens.slice(10, 20) },
        expect.any(Object)
      );
      expect(mockedAxios.post).toHaveBeenNthCalledWith(3,
        'http://localhost:5000/api/kol-trades/mindmap/bulk',
        { tokenMints: tokens.slice(20, 25) },
        expect.any(Object)
      );
    });

    it('should handle empty token array', async () => {
      const results = await ProgressiveLoadingService.loadMindmapData([]);

      expect(Object.keys(results)).toHaveLength(0);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('loadKOLData', () => {
    it('should load KOL data for multiple wallets', async () => {
      const wallets = ['wallet1', 'wallet2', 'wallet3'];
      
      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: { kol: {} } },
        status: 200,
      } as AxiosResponse);

      const results = await ProgressiveLoadingService.loadKOLData(wallets);

      expect(Object.keys(results)).toHaveLength(3);
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);

      wallets.forEach((wallet, index) => {
        expect(mockedAxios.get).toHaveBeenNthCalledWith(index + 1,
          `http://localhost:5000/api/kol-trades/kol/${wallet}`,
          expect.any(Object)
        );
      });
    });
  });

  describe('loadTokenMetadata', () => {
    it('should load metadata from multiple URIs', async () => {
      const uris = [
        'https://example.com/metadata1.json',
        'https://example.com/metadata2.json',
      ];
      
      mockedAxios.get.mockResolvedValue({
        data: { name: 'Token', symbol: 'TKN' },
        status: 200,
      } as AxiosResponse);

      const results = await ProgressiveLoadingService.loadTokenMetadata(uris);

      expect(Object.keys(results)).toHaveLength(2);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      uris.forEach((uri, index) => {
        expect(mockedAxios.get).toHaveBeenNthCalledWith(index + 1, uri);
      });
    });
  });

  describe('preloadCriticalData', () => {
    it('should preload critical resources', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: true },
        status: 200,
      } as AxiosResponse);

      const results = await ProgressiveLoadingService.preloadCriticalData();

      expect(results.recentTrades.success).toBe(true);
      expect(results.topKOLs.success).toBe(true);
      expect(results.activeTokens.success).toBe(true);

      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('healthCheck', () => {
    it('should return health status when API is healthy', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { websocket: true, database: true },
        status: 200,
      } as AxiosResponse);

      const health = await ProgressiveLoadingService.healthCheck();

      expect(health.api).toBe(true);
      expect(health.websocket).toBe(true);
      expect(health.database).toBe(true);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:5000/api/health',
        expect.objectContaining({ timeout: 5000 })
      );
    });

    it('should return unhealthy status when API fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Connection failed'));

      const health = await ProgressiveLoadingService.healthCheck();

      expect(health.api).toBe(false);
      expect(health.websocket).toBe(false);
      expect(health.database).toBe(false);
    });
  });



  describe('Configuration', () => {
    it('should use custom API URL from environment', async () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://custom-api.com';

      mockedAxios.get.mockResolvedValue({
        data: { success: true },
        status: 200,
      } as AxiosResponse);

      await ProgressiveLoadingService.loadEssentialData();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('https://custom-api.com'),
        expect.any(Object)
      );
    });

    it('should fall back to default URL when environment variable not set', async () => {
      delete process.env.NEXT_PUBLIC_API_URL;

      mockedAxios.get.mockResolvedValue({
        data: { success: true },
        status: 200,
      } as AxiosResponse);

      await ProgressiveLoadingService.loadEssentialData();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:5000'),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const calls = {
        networkCall: jest.fn().mockRejectedValue(new Error('Network Error')),
      };

      const results = await ProgressiveLoadingService.executeParallelCalls(calls);

      expect(results.networkCall.success).toBe(false);
      expect(results.networkCall.error).toBe('Network Error');
    });

    it('should handle timeout errors', async () => {
      const calls = {
        timeoutCall: jest.fn().mockImplementation(() => 
          new Promise(() => {}) // Never resolves
        ),
      };

      const results = await ProgressiveLoadingService.executeParallelCalls(calls, {
        timeout: 10,
      });

      expect(results.timeoutCall.success).toBe(false);
      expect(results.timeoutCall.error).toBe('Timeout');
    });

    it('should handle malformed responses', async () => {
      const calls = {
        malformedCall: jest.fn().mockResolvedValue({ data: null }), // Valid response with null data
      };

      const results = await ProgressiveLoadingService.executeParallelCalls(calls);

      expect(results.malformedCall.success).toBe(true);
      expect(results.malformedCall.data).toBeNull();
    });
  });
});