'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ErrorBoundaryState {
  hasError: boolean;
  errorType: 'api' | 'render' | 'websocket' | 'unknown';
  errorMessage: string;
  errorStack?: string;
  canRecover: boolean;
  retryCount: number;
  lastErrorTime: number;
}

interface BaseErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: ErrorBoundaryState, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  isolate?: boolean; // Whether to isolate errors to this boundary
}

export class BaseErrorBoundary extends Component<BaseErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: BaseErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorType: 'unknown',
      errorMessage: '',
      errorStack: '',
      canRecover: true,
      retryCount: 0,
      lastErrorTime: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Analyze error to determine type and recovery options
    const errorMessage = error.message || 'An unexpected error occurred';
    const errorStack = error.stack;
    
    let errorType: ErrorBoundaryState['errorType'] = 'unknown';
    let canRecover = true;

    // Classify error types based on message patterns
    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('API')) {
      errorType = 'api';
    } else if (errorMessage.includes('WebSocket') || errorMessage.includes('socket')) {
      errorType = 'websocket';
    } else if (errorMessage.includes('render') || errorMessage.includes('Cannot read prop')) {
      errorType = 'render';
    }

    // Determine if error is recoverable
    if (errorMessage.includes('ChunkLoadError') || errorMessage.includes('Loading chunk')) {
      canRecover = true; // These are usually recoverable with a refresh
    } else if (errorMessage.includes('Maximum call stack') || errorMessage.includes('out of memory')) {
      canRecover = false; // These indicate serious issues
    }

    return {
      hasError: true,
      errorType,
      errorMessage,
      errorStack,
      canRecover,
      lastErrorTime: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to error tracking service (if available)
    if (typeof window !== 'undefined' && (window as any).reportError) {
      (window as any).reportError(error, {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      });
    }
  }

  componentDidUpdate(prevProps: BaseErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error state if props changed and resetOnPropsChange is enabled
    if (hasError && resetOnPropsChange && resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => prevProps.resetKeys?.[index] !== key
      );

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.setState({
      hasError: false,
      errorType: 'unknown',
      errorMessage: '',
      errorStack: '',
      canRecover: true,
      retryCount: 0,
      lastErrorTime: 0,
    });
  };

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      return;
    }

    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1,
    }));

    // Reset after a short delay to allow for cleanup
    this.resetTimeoutId = window.setTimeout(() => {
      this.resetErrorBoundary();
    }, 100);
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  getErrorTitle = (): string => {
    const { errorType } = this.state;
    
    switch (errorType) {
      case 'api':
        return 'Connection Error';
      case 'websocket':
        return 'Real-time Connection Lost';
      case 'render':
        return 'Display Error';
      default:
        return 'Something went wrong';
    }
  };

  getErrorDescription = (): string => {
    const { errorType, errorMessage } = this.state;
    
    switch (errorType) {
      case 'api':
        return 'Unable to connect to our servers. Please check your internet connection and try again.';
      case 'websocket':
        return 'Lost connection to real-time updates. Some features may not work properly.';
      case 'render':
        return 'There was a problem displaying this content. This might be a temporary issue.';
      default:
        return errorMessage || 'An unexpected error occurred. Please try refreshing the page.';
    }
  };

  getRecoveryActions = () => {
    const { errorType, canRecover, retryCount } = this.state;
    const { maxRetries = 3 } = this.props;
    const canRetry = canRecover && retryCount < maxRetries;

    const actions = [];

    if (canRetry) {
      actions.push(
        <Button
          key="retry"
          onClick={this.handleRetry}
          className="flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Try Again</span>
        </Button>
      );
    }

    if (errorType === 'api' || errorType === 'websocket' || !canRecover) {
      actions.push(
        <Button
          key="reload"
          variant="outline"
          onClick={this.handleReload}
          className="flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Reload Page</span>
        </Button>
      );
    }

    actions.push(
      <Button
        key="home"
        variant="outline"
        onClick={this.handleGoHome}
        className="flex items-center space-x-2"
      >
        <Home className="h-4 w-4" />
        <span>Go Home</span>
      </Button>
    );

    return actions;
  };

  renderDefaultFallback = () => {
    const { retryCount } = this.state;
    const { maxRetries = 3 } = this.props;

    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{this.getErrorTitle()}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {this.getErrorDescription()}
          </p>

          {retryCount > 0 && (
            <p className="text-sm text-muted-foreground">
              Retry attempt {retryCount} of {maxRetries}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {this.getRecoveryActions()}
          </div>

          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground flex items-center space-x-1">
                <Bug className="h-3 w-3" />
                <span>Error Details (Development)</span>
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                {this.state.errorStack || this.state.errorMessage}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    );
  };

  render() {
    const { hasError } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback(this.state, this.handleRetry);
      }
      return this.renderDefaultFallback();
    }

    return children;
  }
}