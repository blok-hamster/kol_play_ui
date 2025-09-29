'use client';

import React, { useEffect, ReactNode } from 'react';
import { useUserStore } from '@/stores/use-user-store';
import { useAuthRedirectSetup } from '@/hooks/use-auth-redirect-setup';

interface AuthInitProviderProps {
  children: ReactNode;
}

export const AuthInitProvider: React.FC<AuthInitProviderProps> = ({
  children,
}) => {
  const initialize = useUserStore(state => state.initialize);
  
  // Set up auth redirect modal opener
  useAuthRedirectSetup();

  useEffect(() => {
    // Initialize authentication and user store on app startup
    void 0 && ('🚀 Initializing authentication...');
    initialize().catch(error => {
      console.error('Failed to initialize authentication:', error);
    });
  }, [initialize]);

  return <>{children}</>;
};

export default AuthInitProvider; 