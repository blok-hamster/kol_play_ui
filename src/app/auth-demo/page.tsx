'use client';

import React from 'react';
import { AuthenticationPage } from '@/components/auth/authentication-page';
import { WalletDebug } from '@/components/auth/wallet-debug';

export default function AuthDemoPage() {
  const handleSuccess = () => {
    console.log('Authentication successful!');
    // In a real app, you would redirect or update state here
  };

  return (
    <div className="min-h-screen bg-background">
      <AuthenticationPage
        defaultMode="signin"
        defaultMethod="wallet"
        onSuccess={handleSuccess}
      />

      {/* Debug component - remove in production */}
      <div className="container mx-auto px-4 pb-8">
        <WalletDebug />
      </div>
    </div>
  );
}
