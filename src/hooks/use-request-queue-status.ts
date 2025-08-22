/**
 * Hook to monitor request queue status during authentication
 */

import { useState, useEffect } from 'react';
import { requestManager } from '@/lib/request-manager';

interface RequestQueueStatus {
  pendingCount: number;
  isBlocking: boolean;
  isAuthenticating: boolean;
}

export const useRequestQueueStatus = () => {
  const [status, setStatus] = useState<RequestQueueStatus>({
    pendingCount: 0,
    isBlocking: false,
    isAuthenticating: false,
  });

  useEffect(() => {
    const updateStatus = async () => {
      try {
        const queueStatus = requestManager.getQueueStatus();
        const { AuthRedirectManager } = await import('@/lib/auth-redirect');
        
        setStatus({
          pendingCount: queueStatus.pendingCount,
          isBlocking: queueStatus.isBlocking,
          isAuthenticating: AuthRedirectManager.isAuthenticationInProgress(),
        });
      } catch (error) {
        console.error('Failed to get request queue status:', error);
      }
    };

    // Update immediately
    updateStatus();

    // Update periodically while authentication is in progress
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  return status;
};