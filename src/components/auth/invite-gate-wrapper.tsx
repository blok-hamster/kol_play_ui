'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useInviteCode, isAlphaOrBeta } from '@/contexts/invite-context';
import { useUserStore } from '@/stores/use-user-store';
import InviteGate from './invite-gate';

interface InviteGateWrapperProps {
  children: React.ReactNode;
}

const InviteGateWrapper: React.FC<InviteGateWrapperProps> = ({ children }) => {
  const pathname = usePathname();
  const { hasInviteCode, setInviteCode, isInitialized, inviteCode } = useInviteCode();
  const { user, isAuthenticated } = useUserStore();
  const isAlphaBeta = isAlphaOrBeta();

  // OAuth callback routes that should bypass the invite gate
  const oauthCallbackRoutes = ['/oauth-popup-callback', '/oauth-callback'];
  const isOAuthCallback = oauthCallbackRoutes.includes(pathname);

  // Force re-render when invite code changes
  React.useEffect(() => {
    console.log('🎫 InviteGateWrapper effect - invite code changed:', inviteCode);
  }, [inviteCode]);

  console.log('🎫 InviteGateWrapper render:', { 
    pathname,
    isOAuthCallback,
    stage: process.env.NEXT_PUBLIC_STAGE,
    isAlphaBeta, 
    isInitialized, 
    hasInviteCode,
    isAuthenticated,
    user: user ? `${user.firstName} ${user.lastName}` : 'null',
    inviteCode: inviteCode ? `"${inviteCode}"` : 'null',
    timestamp: new Date().toISOString()
  });

  // If this is an OAuth callback route, bypass the invite gate entirely
  if (isOAuthCallback) {
    console.log('🎫 OAuth callback route detected, bypassing invite gate');
    return <>{children}</>;
  }

  // If not in alpha/beta stage, show the app normally
  if (!isAlphaBeta) {
    console.log('🎫 Not in alpha/beta stage, showing main app');
    return <>{children}</>;
  }

  // Show loading state while initializing
  if (!isInitialized) {
    console.log('🎫 Still initializing, showing loader');
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent-to/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated, show the app (bypass invite code requirement)
  if (isAuthenticated && user) {
    console.log('🎫 User is authenticated, showing main app');
    
    // Set a dummy invite code so user doesn't see gate again in this session
    if (!hasInviteCode) {
      console.log('🎫 Setting dummy invite code for authenticated user');
      setInviteCode('authenticated-user');
    }
    
    return <>{children}</>;
  }

  // If in alpha/beta but no invite code provided, show invite gate
  if (!hasInviteCode) {
    console.log('🎫 No invite code found, showing invite gate');
    return <InviteGate onInviteCodeProvided={setInviteCode} />;
  }

  // If invite code is provided, show the app
  console.log('🎫 Valid invite code found, showing main app');
  return <>{children}</>;
};

export default InviteGateWrapper;