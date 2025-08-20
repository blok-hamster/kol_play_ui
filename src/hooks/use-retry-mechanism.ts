'use client';

import { useState, useCallback } from 'react';

interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
}

interface RetryState {
  isRetrying: boolean;
  retryCount: number;
  lastError?: Error;
}

export function useRetryMechanism(config: RetryConfig = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    backoffMultiplier = 2,
  } = config;

  const [retryState, setRetryState] = useState<RetryState>({
    isRetrying: false,
    retryCount: 0,
  });

  const executeWithRetry = useCallback(
    async <T>(
      operation: () => Promise<T>,
      onError?: (error: Error, retryCount: number) => void
    ): Promise<T> => {
      let currentRetryCount = 0;
      let currentDelay = retryDelay;

      while (currentRetryCount <= maxRetries) {
        try {
          setRetryState({
            isRetrying: currentRetryCount > 0,
            retryCount: currentRetryCount,
          });

          const result = await operation();
          
          // Success - reset state
          setRetryState({
            isRetrying: false,
            retryCount: 0,
          });
          
          return result;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          
          setRetryState({
            isRetrying: true,
            retryCount: currentRetryCount,
            lastError: err,
          });

          if (onError) {
            onError(err, currentRetryCount);
          }

          if (currentRetryCount >= maxRetries) {
            // Final failure
            setRetryState({
              isRetrying: false,
              retryCount: currentRetryCount,
              lastError: err,
            });
            throw err;
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          
          currentRetryCount++;
          currentDelay *= backoffMultiplier;
        }
      }

      throw new Error('Retry mechanism failed unexpectedly');
    },
    [maxRetries, retryDelay, backoffMultiplier]
  );

  const reset = useCallback(() => {
    setRetryState({
      isRetrying: false,
      retryCount: 0,
    });
  }, []);

  const canRetry = retryState.retryCount < maxRetries;

  return {
    executeWithRetry,
    reset,
    canRetry,
    ...retryState,
  };
}

export default useRetryMechanism;