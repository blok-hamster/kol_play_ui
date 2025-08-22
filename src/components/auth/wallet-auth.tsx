'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertCircle, Wallet, Loader2, ExternalLink } from 'lucide-react';
import {
  SiwsAuthService,
  WalletSignUpRequest,
} from '@/services/siws-auth.service';
import { useUserStore } from '@/stores/use-user-store';
import { useNotifications } from '@/stores/use-ui-store';
import { User } from '@/types';
import { useInviteCode, isAlphaOrBeta } from '@/contexts/invite-context';

interface WalletAuthProps {
  mode: 'signin' | 'signup' | 'link';
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onModeChange?: (mode: 'signin' | 'signup') => void;
}

export const WalletAuth: React.FC<WalletAuthProps> = ({
  mode,
  onSuccess,
  onError,
  onModeChange,
}) => {
  const { wallet, signIn, publicKey, connected, connecting, wallets } =
    useWallet();
  const { setUser, user } = useUserStore();
  const { showSuccess, showError, showInfo } = useNotifications();
  const { inviteCode } = useInviteCode();
  const [isLoading, setIsLoading] = useState(false);
  const [walletDetected, setWalletDetected] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });

  // Check if any wallets are detected
  useEffect(() => {
    const checkWallets = () => {
      const detected = wallets.some(
        wallet => wallet.readyState === 'Installed'
      );
      setWalletDetected(detected);

      // Check specifically for Phantom
      const phantomDetected = window.phantom?.solana?.isPhantom;
      if (!phantomDetected && !detected) {
        showInfo(
          'Wallet Not Detected',
          'Please install Phantom wallet or another Solana wallet to continue.'
        );
      }
    };

    checkWallets();

    // Check again after a short delay in case wallets are still loading
    const timer = setTimeout(checkWallets, 1000);
    return () => clearTimeout(timer);
  }, [wallets, showInfo]);

  const handleInputChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleWalletAuth = useCallback(async () => {
    if (!wallet) {
      const error = 'No wallet selected';
      onError?.(error);
      showError('Wallet Error', error);
      return;
    }

    if (!connected || !publicKey) {
      const error = 'Please connect your wallet first';
      onError?.(error);
      showError('Connection Error', error);
      return;
    }

    // Check if wallet supports signIn (SIWS)
    if (!signIn) {
      const error = `${wallet.adapter.name} wallet does not support Sign-in with Solana`;
      onError?.(error);
      showError('Wallet Not Supported', error);
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create SIWS challenge
      showSuccess(
        'Creating Challenge',
        'Preparing authentication challenge...'
      );
      const { challenge } = await SiwsAuthService.createChallenge();

      // Step 2: Sign the challenge with wallet
      showSuccess('Sign Message', 'Please sign the message in your wallet...');
      const output = await signIn(challenge);

      // Step 3: Process based on mode
      let result;
      switch (mode) {
        case 'signup':
          const signUpRequest: WalletSignUpRequest = {
            input: challenge,
            output,
            ...(formData.firstName && { firstName: formData.firstName }),
            ...(formData.lastName && { lastName: formData.lastName }),
            ...(formData.email && { email: formData.email }),
          };
          result = await SiwsAuthService.walletSignUp(signUpRequest);
          break;

        case 'signin':
          result = await SiwsAuthService.walletSignIn(challenge, output);
          break;

        case 'link':
          await SiwsAuthService.linkWallet(challenge, output);
          showSuccess(
            'Wallet Linked',
            'Your wallet has been successfully linked to your account!'
          );
          onSuccess?.();
          return;

        default:
          throw new Error('Invalid authentication mode');
      }

      // Store token and update user state
      if (result.token) {
        // CRITICAL: Store token FIRST so API calls can be authenticated
        SiwsAuthService.storeToken(result.token);
        
        // Set initial user state (even if account details have errors)
        setUser({
          id: result.user.id,
          email: result.user.email || '',
          walletAddress: result.user.walletAddress,
          accountDetails: result.user.accountDetails,
        });

        // If account details have errors, try to fetch them now that token is stored
        if (result.user.accountDetails?._hasError) {
          void 0 && ('🔄 Account details have error, attempting to fetch after token storage...');
          try {
            const freshAccountDetails = await SiwsAuthService.refreshAccountDetails();
            // Update user with fresh account details
            const currentUser = user;
            if (currentUser) {
              setUser({
                ...currentUser,
                accountDetails: freshAccountDetails
              });
            }
            void 0 && ('✅ Successfully fetched account details after login');
          } catch (fetchError: any) {
            console.warn('⚠️ Could not fetch account details after login:', fetchError.message);
            // User is still logged in, they can use refresh button later
            showInfo(
              'Account Details Unavailable',
              'Your account details could not be loaded. Use the refresh button in the wallet dropdown to try again.'
            );
          }
        }

        showSuccess(
          mode === 'signin' ? 'Sign In Successful' : 'Sign Up Successful',
          `Welcome! You've been authenticated with your ${wallet.adapter.name} wallet.`
        );

        onSuccess?.();
      }
    } catch (error: any) {
      console.error('Wallet authentication error:', error);
      let errorMessage = error.message || 'Authentication failed';

      // Handle specific error cases
      if (
        errorMessage.includes('User rejected') ||
        errorMessage.includes('rejected')
      ) {
        errorMessage = 'You rejected the signature request. Please try again.';
        showError('Signature Rejected', errorMessage);
      } else if (errorMessage.includes('Wallet not registered')) {
        showError(
          'Wallet Not Registered',
          'This wallet is not registered. Please sign up first.'
        );
        onModeChange?.('signup');
      } else if (errorMessage.includes('already registered')) {
        showError(
          'Wallet Already Exists',
          'This wallet is already registered. Please sign in instead.'
        );
        onModeChange?.('signin');
      } else {
        showError('Authentication Failed', errorMessage);
      }

      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [
    wallet,
    signIn,
    connected,
    publicKey,
    mode,
    formData,
    onSuccess,
    onError,
    onModeChange,
    setUser,
    showSuccess,
    showError,
    user,
  ]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Wallet className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>
          {mode === 'signin' && 'Sign in with Wallet'}
          {mode === 'signup' && 'Sign up with Wallet'}
          {mode === 'link' && 'Link Wallet to Account'}
        </CardTitle>
        <CardDescription>
          {mode === 'signin' &&
            'Connect and authenticate with your Solana wallet'}
          {mode === 'signup' && 'Create a new account using your Solana wallet'}
          {mode === 'link' &&
            'Link your Solana wallet to your existing account'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Sign up form fields */}
        {mode === 'signup' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Optional"
                  value={formData.firstName}
                  onChange={e => handleInputChange('firstName', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Optional"
                  value={formData.lastName}
                  onChange={e => handleInputChange('lastName', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Optional"
                value={formData.email}
                onChange={e => handleInputChange('email', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Wallet not detected warning */}
        {!walletDetected && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-800">
                  No Wallet Detected
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Please install a Solana wallet to continue. We recommend
                  Phantom wallet.
                </p>
                <div className="mt-3">
                  <a
                    href="https://phantom.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-sm font-medium text-yellow-800 hover:text-yellow-900"
                  >
                    <span>Install Phantom Wallet</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wallet connection */}
        <div className="space-y-4">
          <div className="text-center">
            <Label className="text-sm font-medium">Connect Your Wallet</Label>
          </div>
          <div className="flex justify-center">
            <WalletMultiButton className="!bg-primary hover:!bg-primary/90" />
          </div>

          {/* Connection status */}
          {connecting && (
            <div className="text-center text-sm text-muted-foreground">
              <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
              Connecting to wallet...
            </div>
          )}
        </div>

        {/* Authentication button */}
        {connected && wallet && (
          <div className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              Connected: {publicKey?.toString().slice(0, 8)}...
              {publicKey?.toString().slice(-8)}
            </div>

            {signIn ? (
              <Button
                onClick={handleWalletAuth}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Wallet className="mr-2 h-4 w-4" />
                    {mode === 'signin' && `Sign In with ${wallet.adapter.name}`}
                    {mode === 'signup' && `Sign Up with ${wallet.adapter.name}`}
                    {mode === 'link' && `Link ${wallet.adapter.name}`}
                  </>
                )}
              </Button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">
                      Wallet Not Compatible
                    </h3>
                    <p className="text-sm text-red-700 mt-1">
                      {wallet.adapter.name} wallet does not support Sign-in with
                      Solana. Please use Phantom or another compatible wallet.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info message */}
        <div className="flex items-start space-x-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Secure Authentication</p>
            <p className="text-xs">
              This will prompt you to sign a message with your wallet. No tokens
              will be spent, and no transactions will be created.
            </p>
          </div>
        </div>

        {/* Mode switcher for sign in/up */}
        {(mode === 'signin' || mode === 'signup') && onModeChange && (
          <div className="text-center text-sm">
            {mode === 'signin' ? (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => onModeChange('signup')}
                  className="text-primary hover:underline"
                >
                  Sign up with wallet
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => onModeChange('signin')}
                  className="text-primary hover:underline"
                >
                  Sign in with wallet
                </button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
