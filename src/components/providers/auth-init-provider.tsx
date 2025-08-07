'use client';

import React, { useEffect, ReactNode } from 'react';
import { useUserStore } from '@/stores/use-user-store';

interface AuthInitProviderProps {
  children: ReactNode;
}

export const AuthInitProvider: React.FC<AuthInitProviderProps> = ({
  children,
}) => {
  const initialize = useUserStore(state => state.initialize);

  useEffect(() => {
    // Initialize authentication and user store on app startup
    console.log('🚀 Initializing authentication...');
    initialize().catch(error => {
      console.error('Failed to initialize authentication:', error);
    });
  }, [initialize]);

  return <>{children}</>;
};

export default AuthInitProvider; 