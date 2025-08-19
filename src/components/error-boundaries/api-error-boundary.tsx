'use client';

import React, { ReactNode } from 'react';
import { BaseErrorBoundary, ErrorBoundaryState } from './base-error-boundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useNotifications } from '@/stores/use-ui-store';

interface ApiErrorBoundaryProps {
  children: ReactNode;
  apiName?: string;
  enableAutoRetry?: boolean;
  retryDelay?: number;
  onRetry?: () => void;
  fallbackData?: any;
}

export const ApiErrorBoundary: React.FC<ApiErrorBoundaryProps> = ({
  children,
  apiName = 'API',
  enableAutoRetry = true,
  retryDelay = 5000,
  onRetry,
  fallbackData,
}) => {
  const { showError, showInfo } = useNotifications();
  const [isOnline, setIsOnline] = React.useState(true);
  const [autoRetryCount, setAutoRetryCount] = React.useState(0);
  const autoRetryRef = React.useRef<NodeJS.Timeout>();

  // Monitor network status
  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showInfo('Connection Restored', 'Your internet connection has been restored.');
    };

    const handleOffline = () => {
      setIsOnline(false);
      showError('Connection Lost', 'Please check your internet connection.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (autoRetryRef.current) {
        clearTimeout(autoRetryRef.current);
      }
    };
  }, [showError, showInfo]);

  const handleError = (error: Error) => {
    console.error(`${apiName} Error:`, error);
    
    // Show user-friendly notification
    if (error.message.includes('fetch') || error.message.includes('network')) {
      showError(
        `${apiName} Connection Error`,
        'Unable to connect to the server. Please check your connection.'
      );
    } else if (error.message.includes('timeout')) {
      showError(
        `${apiName} Timeout`,
        'The request took too long to complete. Please try again.'
      );
    } else {
      showError(
        `${apiName} Error`,
        'An unexpected error occurred. Please try again.'
      );
    }
  };

  const handleAutoRetry = (retry: () => void) => {
    if (!enableAutoRetry || !isOnline || autoRetryCount >= 3) {
      return;
    }

    const delay = retryDelay * Math.pow(2, autoRetryCount); // Exponential backoff
    
    showInfo(
      'Auto Retry',
      `Attempting to reconnect in ${delay / 1000} seconds...`
    );

    autoRetryRef.current = setTimeout(() => {
      setAutoRetryCount(prev => prev + 1);
      if (onRetry) {
        onRetry();
      }
      retry();
    }, delay);
  };

  const renderApiFallback = (errorState: ErrorBoundaryState, retry: () => void) => {
    const isNetworkError = errorState.errorMessage.includes('fetch') || 
                          errorState.errorMessage.includes('network') ||
                          !isOnline;

    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-destructive">
            {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            <span>{apiName} Connection Error</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm">
                {isNetworkError
                  ? `Unable to connect to ${apiName}. Please check your internet connection.`
                  : `There was an error loading data from ${apiName}.`}
              </p>
              
              {!isOnline && (
                <p className="text-sm text-muted-foreground">
                  You appear to be offline. Please check your network connection.
                </p>
              )}

              {autoRetryCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  Auto-retry attempt {autoRetryCount} of 3
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setAutoRetryCount(0);
                if (onRetry) onRetry();
                retry();
              }}
              disabled={!isOnline}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry Now</span>
            </Button>

            {enableAutoRetry && isOnline && autoRetryCount < 3 && (
              <Button
                variant="outline"
                onClick={() => handleAutoRetry(retry)}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Auto Retry</span>
              </Button>
            )}
          </div>

          {fallbackData && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                Showing cached data while we try to reconnect:
              </p>
              <div className="text-sm">
                {typeof fallbackData === 'object' 
                  ? JSON.stringify(fallbackData, null, 2)
                  : String(fallbackData)
                }
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <BaseErrorBoundary
      onError={handleError}
      fallback={renderApiFallback}
      maxRetries={5}
      resetOnPropsChange={true}
      resetKeys={[isOnline]}
    >
      {children}
    </BaseErrorBoundary>
  );
};