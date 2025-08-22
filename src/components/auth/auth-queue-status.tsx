/**
 * Component to show request queue status during authentication
 */

'use client';

import React from 'react';
import { Loader2, Clock, CheckCircle } from 'lucide-react';
import { useRequestQueueStatus } from '@/hooks/use-request-queue-status';
import { cn } from '@/lib/utils';

interface AuthQueueStatusProps {
  className?: string;
}

export const AuthQueueStatus: React.FC<AuthQueueStatusProps> = ({
  className,
}) => {
  const { pendingCount, isBlocking, isAuthenticating } = useRequestQueueStatus();

  // Don't show if not authenticating and no pending requests
  if (!isAuthenticating && pendingCount === 0) {
    return null;
  }

  return (
    <div className={cn(
      'fixed bottom-4 right-4 bg-background border border-border rounded-lg shadow-lg p-4 z-50',
      'max-w-sm transition-all duration-300',
      className
    )}>
      <div className="flex items-center space-x-3">
        {isAuthenticating ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : pendingCount > 0 ? (
          <Clock className="w-5 h-5 text-orange-500" />
        ) : (
          <CheckCircle className="w-5 h-5 text-green-500" />
        )}
        
        <div className="flex-1">
          <div className="text-sm font-medium">
            {isAuthenticating ? (
              'Authentication in progress...'
            ) : pendingCount > 0 ? (
              'Processing queued requests...'
            ) : (
              'All requests completed'
            )}
          </div>
          
          {pendingCount > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {pendingCount} request{pendingCount !== 1 ? 's' : ''} queued
            </div>
          )}
          
          {isBlocking && (
            <div className="text-xs text-orange-600 mt-1">
              New requests are being queued
            </div>
          )}
        </div>
      </div>
      
      {pendingCount > 0 && (
        <div className="mt-3">
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ 
                width: isAuthenticating ? '30%' : '100%',
                animation: isAuthenticating ? 'pulse 2s infinite' : 'none'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};