'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface InviteContextType {
  inviteCode: string | null;
  setInviteCode: (code: string) => void;
  clearInviteCode: () => void;
  hasInviteCode: boolean;
  isInitialized: boolean;
}

const InviteContext = createContext<InviteContextType | undefined>(undefined);

interface InviteProviderProps {
  children: ReactNode;
}

export const InviteProvider: React.FC<InviteProviderProps> = ({ children }) => {
  const [inviteCode, setInviteCodeState] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const setInviteCode = (code: string) => {
    console.log('🎫 Setting invite code:', code);
    setInviteCodeState(code);
    // Store in sessionStorage for persistence during the session
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('inviteCode', code);
    }
  };

  const clearInviteCode = () => {
    console.log('🎫 Clearing invite code');
    setInviteCodeState(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('inviteCode');
    }
  };

  // Initialize from sessionStorage on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // For testing purposes, let's clear any existing stored code first
      // Remove this line once testing is complete
      console.log('🎫 Clearing any existing session storage for testing');
      sessionStorage.removeItem('inviteCode');
      
      const storedCode = sessionStorage.getItem('inviteCode');
      console.log('🎫 Initializing invite context, stored code after clear:', storedCode);
      
      // Only set invite code if it exists and is not empty
      if (storedCode && storedCode.trim() !== '') {
        console.log('🎫 Setting stored invite code:', storedCode);
        setInviteCodeState(storedCode);
      } else {
        console.log('🎫 No valid stored invite code, keeping null');
        setInviteCodeState(null);
      }
      
      setIsInitialized(true);
      console.log('🎫 Invite context initialized');

      // Add debug function to window for testing
      (window as any).clearInviteCode = () => {
        console.log('🎫 Debug: Clearing invite code from console');
        sessionStorage.removeItem('inviteCode');
        setInviteCodeState(null);
      };

      // Add debug function to check current state
      (window as any).checkInviteState = () => {
        const currentState = {
          inviteCode,
          hasInviteCode: !!inviteCode,
          storedCode: sessionStorage.getItem('inviteCode'),
          stage: process.env.NEXT_PUBLIC_STAGE,
          isAlphaOrBeta: process.env.NEXT_PUBLIC_STAGE === 'alpha' || process.env.NEXT_PUBLIC_STAGE === 'beta'
        };
        console.log('🎫 Current invite state:', currentState);
        return currentState;
      };
    }
  }, []);

  const value: InviteContextType = {
    inviteCode,
    setInviteCode,
    clearInviteCode,
    hasInviteCode: !!inviteCode,
    isInitialized,
  };

  return (
    <InviteContext.Provider value={value}>
      {children}
    </InviteContext.Provider>
  );
};

export const useInviteCode = (): InviteContextType => {
  const context = useContext(InviteContext);
  if (context === undefined) {
    throw new Error('useInviteCode must be used within an InviteProvider');
  }
  return context;
};

// Utility function to check if app is in alpha/beta stage
export const isAlphaOrBeta = (): boolean => {
  const stage = process.env.NEXT_PUBLIC_STAGE;
  console.log('🎫 Checking stage:', stage, 'isAlphaOrBeta:', stage === 'alpha' || stage === 'beta');
  return stage === 'alpha' || stage === 'beta';
};