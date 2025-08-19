'use client';

import React, { ReactNode } from 'react';
import { BaseErrorBoundary, ErrorBoundaryState } from './base-error-boundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Wifi, WifiOff, Activity } from 'lucide-react';
import { useNotifications } from '@/stores/use-ui-store';

interface WebSocketErrorBoundaryProps {
  children: ReactNode;
  connectionName?: string;
  onReconnect?: () => void;
  enablePollingFallback?: boolean;
  pollingInterval?: number;
}

export const WebSocketErrorBoundary: React.FC<WebSocketErrorBoundaryProps> = ({
  children,
  connectionName = 'Real-time connection',
  onReconnect,
  enablePollingFallback = true,
  pollingInterval = 30000,
}) => {
  const { showError, showWarning, showInfo } = useNotifications();
  const [connectionStatus, setConnectionStatus] = React.useState<'connected' | 'connecting' | 'disconnected'>('connected');
  const [fallbackActive, setFallbackActive] = React.useState(false);
  const pollingRef = React.useRef<NodeJS.Timeout>();

  const handleError = (error: Error) => {
    console.error(`WebSocket Error (${connectionName}):`, error);
    
    if (error.message.includes('WebSocket') || error.message.includes('socket')) {
      setConnectionStatus('disconnected');
      showWarning(
        'Real-time Connection Lost',
        `${connectionName} has been interrupted. Attempting to reconnect...`
      );
      
      if (enablePollingFallback) {
        startPollingFallback();
      }
    }
  };

  const startPollingFallback = () => {
    if (fallbackActive) return;
    
    setFallbackActive(true);
    showInfo(
      'Fallback Mode Active',
      `Using periodic updates while reconnecting ${connectionName.toLowerCase()}.`
    );

    pollingRef.current = setInterval(() => {
      // Trigger data refresh - this would be handled by parent component
      if (onReconnect) {
        onReconnect();
      }
    }, pollingInterval);
  };

  const stopPollingFallback = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = undefined;
    }
    setFallbackActive(false);
  };

  const handleReconnect = (retry: () => void) => {
    setConnectionStatus('connecting');
    stopPollingFallback();
    
    if (onReconnect) {
      onReconnect();
    }
    
    // Simulate connection attempt
    setTimeout(() => {
      retry();
      setConnectionStatus('connected');
      showInfo('Reconnected', `${connectionName} has been restored.`);
    }, 1000);
  };

  React.useEffect(() => {
    return () => {
      stopPollingFallback();
    };
  }, []);

  const renderWebSocketFallback = (errorState: ErrorBoundaryState, retry: () => void) => {
    return (
      <Card className="w-full border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-orange-700 dark:text-orange-400">
            <Activity className="h-5 w-5" />
            <span>Real-time Updates Unavailable</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                {connectionName} is currently unavailable. Some features may not update automatically.
              </p>
              
              {fallbackActive && (
                <div className="flex items-center space-x-2 text-sm text-orange-700 dark:text-orange-300">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                  <span>Using periodic updates every {pollingInterval / 1000} seconds</span>
                </div>
              )}

              <p className="text-sm text-orange-600 dark:text-orange-400">
                Data will still be available, but may not be as up-to-date as usual.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleReconnect(retry)}
              disabled={connectionStatus === 'connecting'}
              className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white"
            >
              {connectionStatus === 'connecting' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
              <span>
                {connectionStatus === 'connecting' ? 'Reconnecting...' : 'Reconnect Now'}
              </span>
            </Button>

            {!fallbackActive && enablePollingFallback && (
              <Button
                variant="outline"
                onClick={startPollingFallback}
                className="flex items-center space-x-2 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Enable Periodic Updates</span>
              </Button>
            )}

            {fallbackActive && (
              <Button
                variant="outline"
                onClick={stopPollingFallback}
                className="flex items-center space-x-2 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
              >
                <WifiOff className="h-4 w-4" />
                <span>Stop Periodic Updates</span>
              </Button>
            )}
          </div>

          <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              <strong>What this means:</strong> You can still use all features, but live updates 
              (like new trades, price changes, etc.) may be delayed. Manual refresh will always 
              show the latest data.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <BaseErrorBoundary
      onError={handleError}
      fallback={renderWebSocketFallback}
      maxRetries={3}
      resetOnPropsChange={true}
      resetKeys={[connectionStatus]}
    >
      {children}
    </BaseErrorBoundary>
  );
};