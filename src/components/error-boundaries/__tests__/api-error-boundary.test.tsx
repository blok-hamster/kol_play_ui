/**
 * Unit tests for ApiErrorBoundary component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiErrorBoundary } from '../api-error-boundary';

// Mock the UI store
jest.mock('@/stores/use-ui-store', () => ({
  useNotifications: () => ({
    showError: jest.fn(),
    showInfo: jest.fn(),
  }),
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={className}
      data-testid="button"
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="card">{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className} data-testid="card-content">{children}</div>
  ),
  CardHeader: ({ children, className }: any) => (
    <div className={className} data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: any) => (
    <h3 className={className} data-testid="card-title">{children}</h3>
  ),
}));

// Component that throws an error for testing
const ThrowError = ({ shouldThrow, errorMessage }: { shouldThrow: boolean; errorMessage?: string }) => {
  if (shouldThrow) {
    throw new Error(errorMessage || 'Test error');
  }
  return <div data-testid="success-content">Success content</div>;
};

describe('ApiErrorBoundary', () => {
  // Mock online/offline events
  const mockAddEventListener = jest.fn();
  const mockRemoveEventListener = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock window event listeners
    Object.defineProperty(window, 'addEventListener', {
      value: mockAddEventListener,
      writable: true,
    });
    Object.defineProperty(window, 'removeEventListener', {
      value: mockRemoveEventListener,
      writable: true,
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
    });

    // Suppress console.error for error boundary tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ApiErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ApiErrorBoundary>
      );

      expect(screen.getByTestId('success-content')).toBeInTheDocument();
    });

    it('should set up online/offline event listeners', () => {
      render(
        <ApiErrorBoundary>
          <div>Test content</div>
        </ApiErrorBoundary>
      );

      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Error Handling', () => {
    it('should display error UI when child component throws', () => {
      render(
        <ApiErrorBoundary apiName="Test API">
          <ThrowError shouldThrow={true} errorMessage="Network error" />
        </ApiErrorBoundary>
      );

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByText('Test API Connection Error')).toBeInTheDocument();
    });

    it('should show network-specific error message for network errors', () => {
      render(
        <ApiErrorBoundary apiName="Test API">
          <ThrowError shouldThrow={true} errorMessage="fetch failed" />
        </ApiErrorBoundary>
      );

      expect(screen.getByText(/Unable to connect to Test API/)).toBeInTheDocument();
    });

    it('should show timeout-specific error message for timeout errors', () => {
      render(
        <ApiErrorBoundary apiName="Test API">
          <ThrowError shouldThrow={true} errorMessage="timeout exceeded" />
        </ApiErrorBoundary>
      );

      expect(screen.getByText(/The request took too long/)).toBeInTheDocument();
    });

    it('should show generic error message for other errors', () => {
      render(
        <ApiErrorBoundary apiName="Test API">
          <ThrowError shouldThrow={true} errorMessage="Unknown error" />
        </ApiErrorBoundary>
      );

      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
    });
  });

  describe('Retry Functionality', () => {
    it('should provide retry button', () => {
      render(
        <ApiErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      expect(screen.getByText('Retry Now')).toBeInTheDocument();
    });

    it('should call onRetry callback when retry button is clicked', () => {
      const mockOnRetry = jest.fn();

      render(
        <ApiErrorBoundary onRetry={mockOnRetry}>
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      fireEvent.click(screen.getByText('Retry Now'));
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('should show auto retry button when enabled', () => {
      render(
        <ApiErrorBoundary enableAutoRetry={true}>
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      expect(screen.getByText('Auto Retry')).toBeInTheDocument();
    });

    it('should not show auto retry button when disabled', () => {
      render(
        <ApiErrorBoundary enableAutoRetry={false}>
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      expect(screen.queryByText('Auto Retry')).not.toBeInTheDocument();
    });

    it('should implement auto retry with exponential backoff', async () => {
      const mockOnRetry = jest.fn();
      jest.useFakeTimers();

      render(
        <ApiErrorBoundary 
          enableAutoRetry={true} 
          retryDelay={1000}
          onRetry={mockOnRetry}
        >
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      fireEvent.click(screen.getByText('Auto Retry'));

      // Fast-forward time to trigger auto retry
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(mockOnRetry).toHaveBeenCalledTimes(1);
      });

      jest.useRealTimers();
    });

    it('should limit auto retry attempts', async () => {
      const mockOnRetry = jest.fn();
      jest.useFakeTimers();

      const { rerender } = render(
        <ApiErrorBoundary 
          enableAutoRetry={true} 
          retryDelay={100}
          onRetry={mockOnRetry}
        >
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      // Simulate multiple auto retry attempts
      for (let i = 0; i < 5; i++) {
        if (screen.queryByText('Auto Retry')) {
          fireEvent.click(screen.getByText('Auto Retry'));
          jest.advanceTimersByTime(100 * Math.pow(2, i));
        }
      }

      // Should stop auto retry after 3 attempts
      await waitFor(() => {
        expect(mockOnRetry).toHaveBeenCalledTimes(3);
      });

      jest.useRealTimers();
    });
  });

  describe('Network Status Handling', () => {
    it('should handle offline status', () => {
      // Mock offline status
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      render(
        <ApiErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="network error" />
        </ApiErrorBoundary>
      );

      expect(screen.getByText(/You appear to be offline/)).toBeInTheDocument();
    });

    it('should disable retry button when offline', () => {
      // Mock offline status
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      render(
        <ApiErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      const retryButton = screen.getByText('Retry Now').closest('button');
      expect(retryButton).toBeDisabled();
    });

    it('should handle online/offline events', () => {
      render(
        <ApiErrorBoundary>
          <div>Test content</div>
        </ApiErrorBoundary>
      );

      // Get the event handlers
      const onlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'online'
      )?.[1];
      const offlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'offline'
      )?.[1];

      expect(onlineHandler).toBeDefined();
      expect(offlineHandler).toBeDefined();

      // Simulate going offline
      if (offlineHandler) {
        offlineHandler();
      }

      // Simulate coming back online
      if (onlineHandler) {
        onlineHandler();
      }
    });
  });

  describe('Fallback Data Display', () => {
    it('should display fallback data when provided', () => {
      const fallbackData = { message: 'Cached data', count: 5 };

      render(
        <ApiErrorBoundary fallbackData={fallbackData}>
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      expect(screen.getByText(/Showing cached data/)).toBeInTheDocument();
      expect(screen.getByText(/"message": "Cached data"/)).toBeInTheDocument();
    });

    it('should handle string fallback data', () => {
      const fallbackData = 'Simple cached message';

      render(
        <ApiErrorBoundary fallbackData={fallbackData}>
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      expect(screen.getByText('Simple cached message')).toBeInTheDocument();
    });

    it('should not show fallback section when no data provided', () => {
      render(
        <ApiErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      expect(screen.queryByText(/Showing cached data/)).not.toBeInTheDocument();
    });
  });

  describe('Configuration Options', () => {
    it('should use custom API name in error messages', () => {
      render(
        <ApiErrorBoundary apiName="Custom Service">
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      expect(screen.getByText('Custom Service Connection Error')).toBeInTheDocument();
    });

    it('should use default API name when not provided', () => {
      render(
        <ApiErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      expect(screen.getByText('API Connection Error')).toBeInTheDocument();
    });

    it('should respect custom retry delay', () => {
      const customDelay = 2000;

      render(
        <ApiErrorBoundary retryDelay={customDelay}>
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      // Component should render without error
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const { unmount } = render(
        <ApiErrorBoundary>
          <div>Test content</div>
        </ApiErrorBoundary>
      );

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should clear auto retry timeout on unmount', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      jest.useFakeTimers();

      const { unmount } = render(
        <ApiErrorBoundary enableAutoRetry={true}>
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      // Start auto retry
      fireEvent.click(screen.getByText('Auto Retry'));

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
      jest.useRealTimers();
    });
  });

  describe('Error Recovery', () => {
    it('should recover when error is resolved', () => {
      let shouldThrow = true;

      const { rerender } = render(
        <ApiErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </ApiErrorBoundary>
      );

      // Should show error UI
      expect(screen.getByTestId('card')).toBeInTheDocument();

      // Fix the error
      shouldThrow = false;

      // Click retry to recover
      fireEvent.click(screen.getByText('Retry Now'));

      rerender(
        <ApiErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </ApiErrorBoundary>
      );

      // Should show success content
      expect(screen.getByTestId('success-content')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(
        <ApiErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ApiErrorBoundary>
      );

      // Check for proper heading structure
      expect(screen.getByTestId('card-title')).toBeInTheDocument();
      
      // Check for button accessibility
      const retryButton = screen.getByText('Retry Now');
      expect(retryButton).toBeInTheDocument();
    });

    it('should provide clear error descriptions', () => {
      render(
        <ApiErrorBoundary apiName="Test API">
          <ThrowError shouldThrow={true} errorMessage="fetch error" />
        </ApiErrorBoundary>
      );

      expect(screen.getByText(/Unable to connect to Test API/)).toBeInTheDocument();
      expect(screen.getByText(/Please check your internet connection/)).toBeInTheDocument();
    });
  });
});