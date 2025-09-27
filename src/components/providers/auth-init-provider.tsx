'use client';

import React, { useEffect, ReactNode } from 'react';
import { useUserStore } from '@/stores/use-user-store';
import { useAuthRedirectSetup } from '@/hooks/use-auth-redirect-setup';
import { AuthCookieSync } from '@/lib/auth-cookie-sync';
import { AuthDebug } from '@/lib/auth-debug';

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
    // Sync auth cookie with localStorage token first (fixes reload issue after deployment)
    AuthCookieSync.syncAuthCookie();
    
    // Debug authentication state in development
    if (process.env.NODE_ENV === 'development') {
      AuthDebug.logAuthState();
      AuthDebug.checkAuthConsistency();
    }
    
    // Initialize authentication and user store on app startup
    void 0 && ('🚀 Initializing authentication...');
    initialize().catch(error => {
      console.error('Failed to initialize authentication:', error);
    });
  }, [initialize]);

  return <>{children}</>;
};

export default AuthInitProvider; 