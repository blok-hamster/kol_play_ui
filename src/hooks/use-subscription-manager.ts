'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useSubscriptions } from '@/stores/use-trading-store';
import { useNotifications } from '@/stores/use-ui-store';

interface UseSubscriptionManagerOptions {
  autoLoad?: boolean;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Custom hook to manage subscription loading with deduplication and caching
 * Prevents multiple API calls and provides centralized subscription management
 */
export const useSubscriptionManager = (options: UseSubscriptionManagerOptions = {}) => {
  const { autoLoad = true, onSuccess, onError } = options;
  
  const {
    subscriptions,
    isLoadingSubscriptions,
    hasLoadedSubscriptions,
    initializeSubscriptions,
    refreshSubscriptions,
  } = useSubscriptions();
  
  const { showSuccess, showError } = useNotifications();
  
  // Track if we've already attempted to load subscriptions in this session
  const hasAttemptedLoad = useRef(false);
  
  // Initialize subscriptions with deduplication
  const initialize = useCallback(async () => {
    if (hasLoadedSubscriptions || isLoadingSubscriptions || hasAttemptedLoad.current) {
      return;
    }
    
    hasAttemptedLoad.current = true;
    
    try {
      await initializeSubscriptions();
      onSuccess?.();
      
      if (subscriptions.length > 0) {
        showSuccess('Loaded!', `Found ${subscriptions.length} subscriptions`);
      }
    } catch (error: any) {
      console.error('Failed to initialize subscriptions:', error);
      const errorMessage = error.message || 'Failed to load subscriptions';
      showError('Load Error', errorMessage);
      onError?.(errorMessage);
    }
  }, [
    hasLoadedSubscriptions,
    isLoadingSubscriptions,
    initializeSubscriptions,
    onSuccess,
    onError,
    showSuccess,
    showError,
    subscriptions.length,
  ]);
  
  // Refresh subscriptions
  const refresh = useCallback(async () => {
    try {
      await refreshSubscriptions();
      showSuccess('Refreshed!', `Updated ${subscriptions.length} subscriptions`);
      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to refresh subscriptions:', error);
      const errorMessage = error.message || 'Failed to refresh subscriptions';
      showError('Refresh Error', errorMessage);
      onError?.(errorMessage);
    }
  }, [refreshSubscriptions, showSuccess, showError, subscriptions.length, onSuccess, onError]);
  
  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      initialize();
    }
  }, [autoLoad, initialize]);
  
  // Reset attempt flag when component unmounts or subscriptions are cleared
  useEffect(() => {
    return () => {
      hasAttemptedLoad.current = false;
    };
  }, []);
  
  return {
    subscriptions,
    isLoading: isLoadingSubscriptions,
    hasLoaded: hasLoadedSubscriptions,
    initialize,
    refresh,
    isEmpty: subscriptions.length === 0,
    count: subscriptions.length,
  };
};

export default useSubscriptionManager; 