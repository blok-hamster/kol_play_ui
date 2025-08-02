'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/shadcn-tabs';
import { Badge } from '@/components/ui/badge';
import { Wallet, Mail, ArrowRight } from 'lucide-react';
import { WalletAuth } from './wallet-auth';
import { useUserStore } from '@/stores/use-user-store';

interface AuthenticationPageProps {
  onSuccess?: () => void;
  defaultMode?: 'signin' | 'signup';
  defaultMethod?: 'wallet' | 'email';
}

export const AuthenticationPage: React.FC<AuthenticationPageProps> = ({
  onSuccess,
  defaultMode = 'signin',
  defaultMethod = 'wallet',
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode);
  const [authMethod, setAuthMethod] = useState<'wallet' | 'email'>(
    defaultMethod
  );
  const { user, isAuthenticated } = useUserStore();

  const handleSuccess = () => {
    onSuccess?.();
  };

  const handleError = (error: string) => {
    console.error('Authentication error:', error);
  };

  const handleModeChange = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
  };

  // If user is already authenticated, show welcome message
  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                <ArrowRight className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Welcome Back!</CardTitle>
            <CardDescription>You're already signed in</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="font-medium">Account Details:</p>
              <p className="text-sm text-muted-foreground">ID: {user.id}</p>
              {user.email && (
                <p className="text-sm text-muted-foreground">
                  Email: {user.email}
                </p>
              )}
              {user.walletAddress && (
                <p className="text-sm text-muted-foreground">
                  Wallet: {user.walletAddress.slice(0, 8)}...
                  {user.walletAddress.slice(-8)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="w-full max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {mode === 'signin'
              ? 'Sign in to your account to continue'
              : 'Get started with your new account'}
          </p>
        </div>

        {/* Main Authentication Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-center space-x-4 mb-4">
              <Badge variant={mode === 'signin' ? 'default' : 'secondary'}>
                {mode === 'signin' ? 'Sign In' : 'Sign Up'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            {/* Authentication Method Tabs */}
            <Tabs
              value={authMethod}
              onValueChange={value =>
                setAuthMethod(value as 'wallet' | 'email')
              }
            >
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger
                  value="wallet"
                  className="flex items-center space-x-2"
                >
                  <Wallet className="h-4 w-4" />
                  <span>Wallet</span>
                </TabsTrigger>
                <TabsTrigger
                  value="email"
                  className="flex items-center space-x-2"
                >
                  <Mail className="h-4 w-4" />
                  <span>Email</span>
                </TabsTrigger>
              </TabsList>

              {/* Wallet Authentication */}
              <TabsContent value="wallet" className="space-y-0">
                <WalletAuth
                  mode={mode}
                  onSuccess={handleSuccess}
                  onError={handleError}
                  onModeChange={handleModeChange}
                />
              </TabsContent>

              {/* Email Authentication - Coming Soon */}
              <TabsContent value="email" className="space-y-0">
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Email Authentication
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Email/password authentication is coming soon. For now,
                    please use wallet authentication.
                  </p>
                  <button
                    onClick={() => setAuthMethod('wallet')}
                    className="text-primary hover:underline font-medium"
                  >
                    Use Wallet Authentication →
                  </button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>
            By signing {mode === 'signin' ? 'in' : 'up'}, you agree to our{' '}
            <a href="/terms" className="text-primary hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
