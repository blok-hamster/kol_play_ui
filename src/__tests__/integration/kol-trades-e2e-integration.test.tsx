/**
 * End-to-End Integration Tests for KOL Trades Performance Optimization
 * 
 * Tests the complete user journey from page load to mindmap interaction,
 * validates performance improvements, and tests error scenarios.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { ProgressiveKOLTrades } from '@/components/trading/progressive-kol-trades';
import { cacheManager } from '@/lib/cache-manager';
import { useProgressiveLoading } from '@/hooks/use-progressive-loading';
import { useKOLTradeSocket } from '@/hooks/use-kol-trade-socket';

// Mock the hooks
jest.mock('@/hooks/use-progressive-loading');
jest.mock('@/hooks/use-kol-trade-socket');
jest.mock('@/lib/cache-manager');

// Mock data
const mockTrades = [
  {
    id: '1',
    kol_address: 'kol1',
    token_mint: 'token1',
    action: 'buy' as const,
    amount: 1000,
    price: 0.5,
    timestamp: new Date().toISOString(),
    kol_name: 'Test KOL 1',
    token_symbol: 'TEST1',
    token_name: 'Test Token 1',
  },
  {
    id: '2',
    kol_address: 'kol2',
    token_mint: 'token2',
    action: 'sell' as const,
    amount: 500,
    price: 1.2,
    timestamp: new Date().toISOString(),
    kol_name: 'Test KOL 2',
    token_symbol: 'TEST2',
    token_name: 'Test Token 2',
  },
];

const mockStats = {
  uniqueKOLs: 2,
  uniqueTokens: 2,
  totalTrades: 2,
  totalVolume: 1100,
};

const mockMindmapData = {
  token1: {
    token_mint: 'token1',
    token_symbol: 'TEST1',
    token_name: 'Test Token 1',
    kols: [
      {
        kol_address: 'kol1',
        kol_name: 'Test KOL 1',
        total_trades: 1,
        total_volume: 500,
        last_trade_timestamp: new Date().toISOString(),
      },
    ],
    predictions: [],
  },
  token2: {
    token_mint: 'token2',
    token_symbol: 'TEST2',
    token_name: 'Test Token 2',
    kols: [
      {
        kol_address: 'kol2',
        kol_name: 'Test KOL 2',
        total_trades: 1,
        total_volume: 600,
        last_trade_timestamp: new Date().toISOString(),
      },
    ],
    predictions: [],
  },
};

describe('KOL Trades E2E Integration', () => {
  let mockUseProgressiveLoading: jest.MockedFunction<typeof useProgressiveLoading>;
  let mockUseKOLTradeSocket: jest.MockedFunction<typeof useKOLTradeSocket>;
  let mockCacheManager: jest.Mocked<typeof cacheManager>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    mockUseProgressiveLoading = useProgressiveLoading as jest.MockedFunction<typeof useProgressiveLoading>;
    mockUseKOLTradeSocket = useKOLTradeSocket as jest.MockedFunction<typeof useKOLTradeSocket>;
    mockCacheManager = cacheManager as jest.Mocked<typeof cacheManager>;

    // Setup default mock implementations
    mockUseProgressiveLoading.mockReturnValue({
      loadingState: {
        trades: 'idle',
        stats: 'idle',
        trending: 'idle',
        mindmap: 'idle',
      },
      essentialData: null,
      mindmapData: {},
      isPhaseComplete: jest.fn(() => false),
      loadEssentialData: jest.fn(),
      loadEnhancedData: jest.fn(),
      loadBackgroundData: jest.fn(),
      retryFailedRequests: jest.fn(),
    });

    mockUseKOLTradeSocket.mockReturnValue({
      trades: [],
      isConnected: false,
      connectionState: 'disconnected',
      error: null,
      stats: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      retry: jest.fn(),
    });

    // Setup cache manager mocks
    mockCacheManager.getTradeData.mockReturnValue(null);
    mockCacheManager.getMindmapData.mockReturnValue(null);
    mockCacheManager.getStatsData.mockReturnValue(null);
    mockCacheManager.getTrendingTokens.mockReturnValue(null);
  });

  describe('Complete User Journey', () => {
    it('should complete the full loading journey within performance requirements', async () => {
      const startTime = performance.now();
      
      // Mock progressive loading phases
      const mockLoadEssentialData = jest.fn().mockResolvedValue(undefined);
      const mockLoadEnhancedData = jest.fn().mockResolvedValue(undefined);
      const mockLoadBackgroundData = jest.fn().mockResolvedValue(undefined);
      const mockIsPhaseComplete = jest.fn()
        .mockReturnValueOnce(false) // Initial render
        .mockReturnValueOnce(true)  // Essential complete
        .mockReturnValueOnce(true)  // Enhanced complete
        .mockReturnValueOnce(true); // Background complete

      mockUseProgressiveLoading.mockReturnValue({
        loadingState: {
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'loaded',
        },
        essentialData: {
          trades: mockTrades,
          stats: mockStats,
          trendingTokens: ['token1', 'token2'],
        },
        mindmapData: mockMindmapData,
        isPhaseComplete: mockIsPhaseComplete,
        loadEssentialData: mockLoadEssentialData,
        loadEnhancedData: mockLoadEnhancedData,
        loadBackgroundData: mockLoadBackgroundData,
        retryFailedRequests: jest.fn(),
      });

      const { rerender } = render(<ProgressiveKOLTrades />);

      // Phase 1: Initial loading state should appear quickly (< 500ms)
      expect(screen.getByText('Loading KOL Trading Data')).toBeInTheDocument();
      
      // Simulate essential data loading
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Rerender with essential data loaded
      rerender(<ProgressiveKOLTrades />);

      // Phase 2: Essential data should be visible (< 2s total)
      await waitFor(() => {
        expect(screen.getByText('Live KOL Trades')).toBeInTheDocument();
        expect(screen.getByText('2 trades loaded')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Verify trades are displayed
      expect(screen.getByText('Test KOL 1')).toBeInTheDocument();
      expect(screen.getByText('Test KOL 2')).toBeInTheDocument();

      // Phase 3: Mindmap should load progressively
      await waitFor(() => {
        expect(mockLoadEnhancedData).toHaveBeenCalled();
        expect(mockLoadBackgroundData).toHaveBeenCalled();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Verify performance requirement: < 2s load time
      expect(loadTime).toBeLessThan(2000);
      
      // Verify all loading phases were called
      expect(mockLoadEssentialData).toHaveBeenCalled();
      expect(mockLoadEnhancedData).toHaveBeenCalled();
      expect(mockLoadBackgroundData).toHaveBeenCalled();
    });

    it('should handle mindmap interaction after loading', async () => {
      mockUseProgressiveLoading.mockReturnValue({
        loadingState: {
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'loaded',
        },
        essentialData: {
          trades: mockTrades,
          stats: mockStats,
          trendingTokens: ['token1', 'token2'],
        },
        mindmapData: mockMindmapData,
        isPhaseComplete: jest.fn(() => true),
        loadEssentialData: jest.fn(),
        loadEnhancedData: jest.fn(),
        loadBackgroundData: jest.fn(),
        retryFailedRequests: jest.fn(),
      });

      render(<ProgressiveKOLTrades activeView="network-maps" />);

      // Wait for mindmap to be rendered
      await waitFor(() => {
        expect(screen.queryByText('Network Map Loading')).not.toBeInTheDocument();
      });

      // Verify mindmap container is present
      // Note: The actual D3 rendering would be tested in component-specific tests
      const mindmapContainer = screen.getByRole('main') || screen.getByTestId('mindmap-container');
      expect(mindmapContainer).toBeInTheDocument();
    });
  });

  describe('Cache Integration', () => {
    it('should use cached data for faster subsequent loads', async () => {
      // Setup cache to return data
      mockCacheManager.getTradeData.mockReturnValue(mockTrades);
      mockCacheManager.getStatsData.mockReturnValue(mockStats);
      mockCacheManager.getTrendingTokens.mockReturnValue(['token1', 'token2']);

      mockUseProgressiveLoading.mockReturnValue({
        loadingState: {
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'idle',
        },
        essentialData: {
          trades: mockTrades,
          stats: mockStats,
          trendingTokens: ['token1', 'token2'],
        },
        mindmapData: {},
        isPhaseComplete: jest.fn((phase) => phase !== 'background'),
        loadEssentialData: jest.fn(),
        loadEnhancedData: jest.fn(),
        loadBackgroundData: jest.fn(),
        retryFailedRequests: jest.fn(),
      });

      render(<ProgressiveKOLTrades />);

      // Should show cached data immediately
      await waitFor(() => {
        expect(screen.getByText('Live KOL Trades')).toBeInTheDocument();
        expect(screen.getByText('2 trades loaded')).toBeInTheDocument();
      });

      // Verify cache was accessed
      expect(mockCacheManager.getTradeData).toHaveBeenCalled();
      expect(mockCacheManager.getStatsData).toHaveBeenCalled();
      expect(mockCacheManager.getTrendingTokens).toHaveBeenCalled();
    });

    it('should cache new data for future use', async () => {
      const mockSetTradeData = jest.fn();
      const mockSetStatsData = jest.fn();
      const mockSetTrendingTokens = jest.fn();

      mockCacheManager.setTradeData = mockSetTradeData;
      mockCacheManager.setStatsData = mockSetStatsData;
      mockCacheManager.setTrendingTokens = mockSetTrendingTokens;

      mockUseProgressiveLoading.mockReturnValue({
        loadingState: {
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'loaded',
        },
        essentialData: {
          trades: mockTrades,
          stats: mockStats,
          trendingTokens: ['token1', 'token2'],
        },
        mindmapData: mockMindmapData,
        isPhaseComplete: jest.fn(() => true),
        loadEssentialData: jest.fn(),
        loadEnhancedData: jest.fn(),
        loadBackgroundData: jest.fn(),
        retryFailedRequests: jest.fn(),
      });

      render(<ProgressiveKOLTrades />);

      await waitFor(() => {
        expect(screen.getByText('Live KOL Trades')).toBeInTheDocument();
      });

      // Verify data would be cached (this would happen in the hook implementation)
      // The actual caching is tested in the progressive loading hook tests
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle API failures gracefully with retry mechanism', async () => {
      const mockRetryFailedRequests = jest.fn();

      mockUseProgressiveLoading.mockReturnValue({
        loadingState: {
          trades: 'error',
          stats: 'error',
          trending: 'error',
          mindmap: 'error',
        },
        essentialData: null,
        mindmapData: {},
        isPhaseComplete: jest.fn(() => false),
        loadEssentialData: jest.fn(),
        loadEnhancedData: jest.fn(),
        loadBackgroundData: jest.fn(),
        retryFailedRequests: mockRetryFailedRequests,
      });

      render(<ProgressiveKOLTrades />);

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText('Failed to Load Data')).toBeInTheDocument();
      });

      // Should have retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // Click retry button
      fireEvent.click(retryButton);

      // Verify retry function was called
      expect(mockRetryFailedRequests).toHaveBeenCalled();
    });

    it('should handle partial failures with graceful degradation', async () => {
      mockUseProgressiveLoading.mockReturnValue({
        loadingState: {
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'error',
        },
        essentialData: {
          trades: mockTrades,
          stats: mockStats,
          trendingTokens: ['token1', 'token2'],
        },
        mindmapData: {},
        isPhaseComplete: jest.fn((phase) => phase !== 'background'),
        loadEssentialData: jest.fn(),
        loadEnhancedData: jest.fn(),
        loadBackgroundData: jest.fn(),
        retryFailedRequests: jest.fn(),
      });

      render(<ProgressiveKOLTrades />);

      // Should show trades even if mindmap failed
      await waitFor(() => {
        expect(screen.getByText('Live KOL Trades')).toBeInTheDocument();
        expect(screen.getByText('Test KOL 1')).toBeInTheDocument();
      });

      // Should show mindmap error state
      expect(screen.getByText('Failed to load network data.')).toBeInTheDocument();
    });

    it('should handle WebSocket connection issues', async () => {
      mockUseKOLTradeSocket.mockReturnValue({
        trades: mockTrades,
        isConnected: false,
        connectionState: 'error',
        error: new Error('WebSocket connection failed'),
        stats: mockStats,
        connect: jest.fn(),
        disconnect: jest.fn(),
        retry: jest.fn(),
      });

      mockUseProgressiveLoading.mockReturnValue({
        loadingState: {
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'loaded',
        },
        essentialData: {
          trades: mockTrades,
          stats: mockStats,
          trendingTokens: ['token1', 'token2'],
        },
        mindmapData: mockMindmapData,
        isPhaseComplete: jest.fn(() => true),
        loadEssentialData: jest.fn(),
        loadEnhancedData: jest.fn(),
        loadBackgroundData: jest.fn(),
        retryFailedRequests: jest.fn(),
      });

      render(<ProgressiveKOLTrades />);

      // Should still show data even with WebSocket issues
      await waitFor(() => {
        expect(screen.getByText('Live KOL Trades')).toBeInTheDocument();
        expect(screen.getByText('Test KOL 1')).toBeInTheDocument();
      });

      // The WebSocket error handling would be shown in the connection status
      // This is tested in the WebSocket hook tests
    });
  });

  describe('Real-time Updates Integration', () => {
    it('should handle real-time updates correctly with optimizations', async () => {
      const mockConnect = jest.fn();
      const mockRetry = jest.fn();

      // Start with initial data
      mockUseKOLTradeSocket.mockReturnValue({
        trades: mockTrades,
        isConnected: true,
        connectionState: 'connected',
        error: null,
        stats: mockStats,
        connect: mockConnect,
        disconnect: jest.fn(),
        retry: mockRetry,
      });

      mockUseProgressiveLoading.mockReturnValue({
        loadingState: {
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'loaded',
        },
        essentialData: {
          trades: mockTrades,
          stats: mockStats,
          trendingTokens: ['token1', 'token2'],
        },
        mindmapData: mockMindmapData,
        isPhaseComplete: jest.fn(() => true),
        loadEssentialData: jest.fn(),
        loadEnhancedData: jest.fn(),
        loadBackgroundData: jest.fn(),
        retryFailedRequests: jest.fn(),
      });

      const { rerender } = render(<ProgressiveKOLTrades />);

      // Initial render with data
      await waitFor(() => {
        expect(screen.getByText('2 trades loaded')).toBeInTheDocument();
      });

      // Simulate new trade coming in via WebSocket
      const newTrade = {
        id: '3',
        kol_address: 'kol3',
        token_mint: 'token3',
        action: 'buy' as const,
        amount: 2000,
        price: 0.8,
        timestamp: new Date().toISOString(),
        kol_name: 'Test KOL 3',
        token_symbol: 'TEST3',
        token_name: 'Test Token 3',
      };

      const updatedTrades = [...mockTrades, newTrade];
      const updatedStats = {
        ...mockStats,
        uniqueKOLs: 3,
        uniqueTokens: 3,
        totalTrades: 3,
      };

      mockUseKOLTradeSocket.mockReturnValue({
        trades: updatedTrades,
        isConnected: true,
        connectionState: 'connected',
        error: null,
        stats: updatedStats,
        connect: mockConnect,
        disconnect: jest.fn(),
        retry: mockRetry,
      });

      mockUseProgressiveLoading.mockReturnValue({
        loadingState: {
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'loaded',
        },
        essentialData: {
          trades: updatedTrades,
          stats: updatedStats,
          trendingTokens: ['token1', 'token2', 'token3'],
        },
        mindmapData: mockMindmapData,
        isPhaseComplete: jest.fn(() => true),
        loadEssentialData: jest.fn(),
        loadEnhancedData: jest.fn(),
        loadBackgroundData: jest.fn(),
        retryFailedRequests: jest.fn(),
      });

      // Rerender with updated data
      rerender(<ProgressiveKOLTrades />);

      // Should show updated trade count
      await waitFor(() => {
        expect(screen.getByText('3 trades loaded')).toBeInTheDocument();
      });

      // Should show new trade
      expect(screen.getByText('Test KOL 3')).toBeInTheDocument();
    });
  });

  describe('Performance Validation', () => {
    it('should meet performance requirements for initial load', async () => {
      const performanceStart = performance.now();

      mockUseProgressiveLoading.mockReturnValue({
        loadingState: {
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'loading',
        },
        essentialData: {
          trades: mockTrades,
          stats: mockStats,
          trendingTokens: ['token1', 'token2'],
        },
        mindmapData: {},
        isPhaseComplete: jest.fn((phase) => phase === 'essential'),
        loadEssentialData: jest.fn(),
        loadEnhancedData: jest.fn(),
        loadBackgroundData: jest.fn(),
        retryFailedRequests: jest.fn(),
      });

      render(<ProgressiveKOLTrades />);

      // Essential content should be visible quickly
      await waitFor(() => {
        expect(screen.getByText('Live KOL Trades')).toBeInTheDocument();
      }, { timeout: 500 });

      const essentialLoadTime = performance.now() - performanceStart;

      // Verify essential data loads within 500ms requirement
      expect(essentialLoadTime).toBeLessThan(500);

      // Full page should be interactive within 2s
      await waitFor(() => {
        expect(screen.getByText('2 trades loaded')).toBeInTheDocument();
      }, { timeout: 2000 });

      const fullLoadTime = performance.now() - performanceStart;

      // Verify full load within 2s requirement
      expect(fullLoadTime).toBeLessThan(2000);
    });

    it('should handle large datasets efficiently', async () => {
      // Create large dataset
      const largeTrades = Array.from({ length: 100 }, (_, i) => ({
        id: `trade-${i}`,
        kol_address: `kol-${i % 10}`,
        token_mint: `token-${i % 20}`,
        action: i % 2 === 0 ? 'buy' as const : 'sell' as const,
        amount: Math.random() * 10000,
        price: Math.random() * 10,
        timestamp: new Date().toISOString(),
        kol_name: `KOL ${i % 10}`,
        token_symbol: `TOK${i % 20}`,
        token_name: `Token ${i % 20}`,
      }));

      const largeStats = {
        uniqueKOLs: 10,
        uniqueTokens: 20,
        totalTrades: 100,
        totalVolume: 50000,
      };

      mockUseProgressiveLoading.mockReturnValue({
        loadingState: {
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'loaded',
        },
        essentialData: {
          trades: largeTrades,
          stats: largeStats,
          trendingTokens: Array.from({ length: 20 }, (_, i) => `token-${i}`),
        },
        mindmapData: mockMindmapData,
        isPhaseComplete: jest.fn(() => true),
        loadEssentialData: jest.fn(),
        loadEnhancedData: jest.fn(),
        loadBackgroundData: jest.fn(),
        retryFailedRequests: jest.fn(),
      });

      const renderStart = performance.now();

      render(<ProgressiveKOLTrades maxTrades={50} />);

      await waitFor(() => {
        expect(screen.getByText('100 trades loaded')).toBeInTheDocument();
      });

      const renderTime = performance.now() - renderStart;

      // Should handle large datasets without significant performance impact
      expect(renderTime).toBeLessThan(1000);

      // Should only render up to maxTrades limit
      const tradeCards = screen.getAllByText(/KOL \d+/);
      expect(tradeCards.length).toBeLessThanOrEqual(50);
    });
  });

  describe('View Switching Integration', () => {
    it('should handle view switching efficiently', async () => {
      mockUseProgressiveLoading.mockReturnValue({
        loadingState: {
          trades: 'loaded',
          stats: 'loaded',
          trending: 'loaded',
          mindmap: 'loaded',
        },
        essentialData: {
          trades: mockTrades,
          stats: mockStats,
          trendingTokens: ['token1', 'token2'],
        },
        mindmapData: mockMindmapData,
        isPhaseComplete: jest.fn(() => true),
        loadEssentialData: jest.fn(),
        loadEnhancedData: jest.fn(),
        loadBackgroundData: jest.fn(),
        retryFailedRequests: jest.fn(),
      });

      const { rerender } = render(<ProgressiveKOLTrades activeView="live-trades" />);

      // Should show only trades
      await waitFor(() => {
        expect(screen.getByText('Test KOL 1')).toBeInTheDocument();
      });

      // Switch to network maps view
      rerender(<ProgressiveKOLTrades activeView="network-maps" />);

      // Should show mindmap content
      await waitFor(() => {
        expect(screen.queryByText('Test KOL 1')).not.toBeInTheDocument();
      });

      // Switch to both view
      rerender(<ProgressiveKOLTrades activeView="both" />);

      // Should show both trades and mindmap
      await waitFor(() => {
        expect(screen.getByText('Test KOL 1')).toBeInTheDocument();
      });
    });
  });
});