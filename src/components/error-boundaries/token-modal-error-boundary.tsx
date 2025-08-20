'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TokenModalErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface TokenModalErrorBoundaryProps {
  children: React.ReactNode;
  onClose?: () => void;
  fallbackTitle?: string;
}

class TokenModalErrorBoundary extends React.Component<
  TokenModalErrorBoundaryProps,
  TokenModalErrorBoundaryState
> {
  constructor(props: TokenModalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): TokenModalErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('TokenModalErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      hasError: true,
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={this.props.onClose}
          />

          {/* Error Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {this.props.fallbackTitle || 'Token Modal Error'}
                </h2>
              </div>
              {this.props.onClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.props.onClose}
                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Error Message */}
            <div className="mb-6">
              <p className="text-gray-600 dark:text-gray-300 mb-3">
                Something went wrong while loading the token details. This could be due to:
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 ml-4">
                <li>• Network connectivity issues</li>
                <li>• Invalid or incomplete token data</li>
                <li>• Temporary service unavailability</li>
              </ul>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                  <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-red-600 dark:text-red-400 whitespace-pre-wrap">
                    {this.state.error.message}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <Button
                onClick={this.handleRetry}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              {this.props.onClose && (
                <Button
                  variant="outline"
                  onClick={this.props.onClose}
                  className="flex-1"
                >
                  Close
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default TokenModalErrorBoundary;