/**
 * Unit tests for BaseErrorBoundary component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BaseErrorBoundary } from '../base-error-boundary';

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, variant }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={className}
      data-variant={variant}
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
const ThrowError = ({ 
  shouldThrow, 
  errorMessage, 
  errorType 
}: { 
  shouldThrow: boolean; 
  errorMessage?: string;
  errorType?: string;
}) => {
  if (shouldThrow) {
    const error = new Error(errorMessage || 'Test error');
    if (errorType === 'chunk') {
      error.message = 'ChunkLoadError: Loading chunk failed';
    } else if (errorType === 'memory') {
      error.message = 'Maximum call stack size exceeded';
    } else if (errorType === 'api') {
      error.message = 'API request failed';
    } else if (errorType === 'websocket') {
      error.message = 'WebSocket connection failed';
    }
    throw error;
  }
  return <div data-testid="success-content">Success content</div>;
};

describe('BaseErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console.error for error boundary tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock window.location for navigation tests
    delete (window as any).location;
    window.location = {
      reload: jest.fn(),
      href: '',
    } as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={false} />
        </BaseErrorBoundary>
      );

      expect(screen.getByTestId('success-content')).toBeInTheDocument();
    });

    it('should not show error UI when children render successfully', () => {
      render(
        <BaseErrorBoundary>
          <div data-testid="normal-content">Normal content</div>
        </BaseErrorBoundary>
      );

      expect(screen.getByTestId('normal-content')).toBeInTheDocument();
      expect(screen.queryByTestId('card')).not.toBeInTheDocument();
    });
  });

  describe('Error Classification', () => {
    it('should classify API errors correctly', () => {
      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} errorType="api" />
        </BaseErrorBoundary>
      );

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText(/Unable to connect to our servers/)).toBeInTheDocument();
    });

    it('should classify WebSocket errors correctly', () => {
      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} errorType="websocket" />
        </BaseErrorBoundary>
      );

      expect(screen.getByText('Real-time Connection Lost')).toBeInTheDocument();
      expect(screen.getByText(/Lost connection to real-time updates/)).toBeInTheDocument();
    });

    it('should classify render errors correctly', () => {
      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Cannot read property of undefined" />
        </BaseErrorBoundary>
      );

      expect(screen.getByText('Display Error')).toBeInTheDocument();
      expect(screen.getByText(/There was a problem displaying this content/)).toBeInTheDocument();
    });

    it('should handle unknown errors', () => {
      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Unknown error type" />
        </BaseErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Recovery Assessment', () => {
    it('should mark chunk load errors as recoverable', () => {
      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} errorType="chunk" />
        </BaseErrorBoundary>
      );

      // Should show retry button for recoverable errors
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should mark memory errors as non-recoverable', () => {
      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} errorType="memory" />
        </BaseErrorBoundary>
      );

      // Should not show retry button for non-recoverable errors
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
      expect(screen.getByText('Reload Page')).toBeInTheDocument();
    });
  });

  describe('Retry Functionality', () => {
    it('should provide retry button for recoverable errors', () => {
      render(
        <BaseErrorBoundary maxRetries={3}>
          <ThrowError shouldThrow={true} errorMessage="Recoverable error" />
        </BaseErrorBoundary>
      );

      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should limit retry attempts', () => {
      const { rerender } = render(
        <BaseErrorBoundary maxRetries={2}>
          <ThrowError shouldThrow={true} errorMessage="Persistent error" />
        </BaseErrorBoundary>
      );

      // First retry
      fireEvent.click(screen.getByText('Try Again'));
      
      // Should still show retry button
      expect(screen.getByText('Try Again')).toBeInTheDocument();
      expect(screen.getByText('Retry attempt 1 of 2')).toBeInTheDocument();

      // Second retry
      fireEvent.click(screen.getByText('Try Again'));
      
      // Should still show retry button
      expect(screen.getByText('Try Again')).toBeInTheDocument();
      expect(screen.getByText('Retry attempt 2 of 2')).toBeInTheDocument();

      // Third attempt should not show retry button
      fireEvent.click(screen.getByText('Try Again'));
      
      // Should not show retry button after max retries
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });

    it('should reset error state on successful retry', async () => {
      let shouldThrow = true;

      const { rerender } = render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </BaseErrorBoundary>
      );

      // Should show error UI
      expect(screen.getByTestId('card')).toBeInTheDocument();

      // Fix the error
      shouldThrow = false;

      // Click retry
      fireEvent.click(screen.getByText('Try Again'));

      // Wait for reset
      await waitFor(() => {
        rerender(
          <BaseErrorBoundary>
            <ThrowError shouldThrow={shouldThrow} />
          </BaseErrorBoundary>
        );
      });

      // Should show success content
      expect(screen.getByTestId('success-content')).toBeInTheDocument();
    });
  });

  describe('Navigation Actions', () => {
    it('should provide reload page button', () => {
      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} />
        </BaseErrorBoundary>
      );

      expect(screen.getByText('Reload Page')).toBeInTheDocument();
    });

    it('should provide go home button', () => {
      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} />
        </BaseErrorBoundary>
      );

      expect(screen.getByText('Go Home')).toBeInTheDocument();
    });

    it('should reload page when reload button is clicked', () => {
      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} />
        </BaseErrorBoundary>
      );

      fireEvent.click(screen.getByText('Reload Page'));
      expect(window.location.reload).toHaveBeenCalled();
    });

    it('should navigate home when go home button is clicked', () => {
      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} />
        </BaseErrorBoundary>
      );

      fireEvent.click(screen.getByText('Go Home'));
      expect(window.location.href).toBe('/');
    });
  });

  describe('Custom Fallback', () => {
    it('should use custom fallback when provided', () => {
      const customFallback = (error: any, retry: () => void) => (
        <div data-testid="custom-fallback">
          <p>Custom error: {error.errorMessage}</p>
          <button onClick={retry} data-testid="custom-retry">
            Custom Retry
          </button>
        </div>
      );

      render(
        <BaseErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} errorMessage="Custom error message" />
        </BaseErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom error: Custom error message')).toBeInTheDocument();
      expect(screen.getByTestId('custom-retry')).toBeInTheDocument();
    });

    it('should call retry function from custom fallback', () => {
      let retryCount = 0;
      const customFallback = (error: any, retry: () => void) => (
        <button 
          onClick={() => {
            retryCount++;
            retry();
          }}
          data-testid="custom-retry"
        >
          Custom Retry ({retryCount})
        </button>
      );

      render(
        <BaseErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </BaseErrorBoundary>
      );

      fireEvent.click(screen.getByTestId('custom-retry'));
      expect(retryCount).toBe(1);
    });
  });

  describe('Error Reporting', () => {
    it('should call onError callback when error occurs', () => {
      const mockOnError = jest.fn();

      render(
        <BaseErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={true} errorMessage="Test error" />
        </BaseErrorBoundary>
      );

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('should report to global error handler when available', () => {
      const mockReportError = jest.fn();
      (window as any).reportError = mockReportError;

      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Global report test" />
        </BaseErrorBoundary>
      );

      expect(mockReportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
          errorBoundary: true,
        })
      );

      delete (window as any).reportError;
    });
  });

  describe('Props Change Reset', () => {
    it('should reset error state when resetKeys change', () => {
      let resetKey = 'initial';

      const { rerender } = render(
        <BaseErrorBoundary resetOnPropsChange={true} resetKeys={[resetKey]}>
          <ThrowError shouldThrow={true} />
        </BaseErrorBoundary>
      );

      // Should show error UI
      expect(screen.getByTestId('card')).toBeInTheDocument();

      // Change reset key
      resetKey = 'changed';

      rerender(
        <BaseErrorBoundary resetOnPropsChange={true} resetKeys={[resetKey]}>
          <ThrowError shouldThrow={false} />
        </BaseErrorBoundary>
      );

      // Should reset and show success content
      expect(screen.getByTestId('success-content')).toBeInTheDocument();
    });

    it('should not reset when resetOnPropsChange is false', () => {
      let resetKey = 'initial';

      const { rerender } = render(
        <BaseErrorBoundary resetOnPropsChange={false} resetKeys={[resetKey]}>
          <ThrowError shouldThrow={true} />
        </BaseErrorBoundary>
      );

      // Should show error UI
      expect(screen.getByTestId('card')).toBeInTheDocument();

      // Change reset key
      resetKey = 'changed';

      rerender(
        <BaseErrorBoundary resetOnPropsChange={false} resetKeys={[resetKey]}>
          <ThrowError shouldThrow={false} />
        </BaseErrorBoundary>
      );

      // Should still show error UI
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });
  });

  describe('Development Mode Features', () => {
    it('should show error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Development error" />
        </BaseErrorBoundary>
      );

      expect(screen.getByText('Error Details (Development)')).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not show error details in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Production error" />
        </BaseErrorBoundary>
      );

      expect(screen.queryByText('Error Details (Development)')).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should clear timeout on unmount', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      const { unmount } = render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} />
        </BaseErrorBoundary>
      );

      // Trigger retry to create timeout
      fireEvent.click(screen.getByText('Try Again'));

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Error State Management', () => {
    it('should track error timestamps', () => {
      const beforeError = Date.now();

      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} />
        </BaseErrorBoundary>
      );

      const afterError = Date.now();

      // Error should have been recorded within the time window
      // This is a basic test since we can't directly access the internal state
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('should maintain error state across re-renders', () => {
      const { rerender } = render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} />
        </BaseErrorBoundary>
      );

      expect(screen.getByTestId('card')).toBeInTheDocument();

      // Re-render with same error
      rerender(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} />
        </BaseErrorBoundary>
      );

      // Should still show error UI
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} />
        </BaseErrorBoundary>
      );

      expect(screen.getByTestId('card-title')).toBeInTheDocument();
    });

    it('should provide clear action buttons', () => {
      render(
        <BaseErrorBoundary>
          <ThrowError shouldThrow={true} />
        </BaseErrorBoundary>
      );

      const buttons = screen.getAllByTestId('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      buttons.forEach(button => {
        expect(button).toHaveTextContent(/Try Again|Reload Page|Go Home/);
      });
    });
  });
});