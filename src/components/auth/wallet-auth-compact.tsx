'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Wallet, Loader2, ExternalLink } from 'lucide-react';
import {
  SiwsAuthService,
  WalletSignUpRequest,
} from '@/services/siws-auth.service';
import { useUserStore } from '@/stores/use-user-store';
import { useNotifications } from '@/stores/use-ui-store';

interface WalletAuthCompactProps {
  mode: 'signin' | 'signup' | 'link';
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onModeChange?: (mode: 'signin' | 'signup') => void;
}

export const WalletAuthCompact: React.FC<WalletAuthCompactProps> = ({
  mode,
  onSuccess,
  onError,
  onModeChange,
}) => {
  const { wallet, signIn, publicKey, connected, connecting, wallets } =
    useWallet();
  const { setUser } = useUserStore();
  const { showSuccess, showError, showInfo } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [walletDetected, setWalletDetected] = useState(false);

  // Check if any wallets are detected
  useEffect(() => {
    const checkWallets = () => {
      const detected = wallets.some(
        wallet => wallet.readyState === 'Installed'
      );
      setWalletDetected(detected);
    };

    checkWallets();
    const interval = setInterval(checkWallets, 1000);
    return () => clearInterval(interval);
  }, [wallets]);

  const handleWalletAuth = useCallback(async () => {
    if (!connected || !publicKey || !wallet) {
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
      showInfo('Creating Challenge', 'Preparing authentication challenge...');
      const { challenge } = await SiwsAuthService.createChallenge();

      void 0 && ('🔐 Challenge object:', challenge);
      void 0 && ('🔐 Challenge JSON:', JSON.stringify(challenge, null, 2));
      void 0 && ('🔐 Wallet adapter name:', wallet.adapter.name);
      void 0 && (
        '🔐 Wallet features:',
        wallet.adapter.supportedTransactionVersions
      );

      // Step 2: Sign the challenge with wallet
      showInfo('Sign Message', 'Please sign the message in your wallet...');

      // Add validation before signing
      if (!challenge || typeof challenge !== 'object') {
        throw new Error('Invalid challenge format received');
      }

      // Validate required SIWS fields
      const requiredFields = [
        'domain',
        'statement',
        'uri',
        'version',
        'chainId',
        'nonce',
        'issuedAt',
      ];
      const missingFields = requiredFields.filter(
        field => !challenge[field as keyof typeof challenge]
      );

      if (missingFields.length > 0) {
        throw new Error(
          `Missing required SIWS fields: ${missingFields.join(', ')}`
        );
      }

      void 0 && ('🔐 About to call signIn with challenge:', challenge);

      let output;
      try {
        output = await signIn(challenge);
        void 0 && ('🔐 SignIn output received:', output);
      } catch (signError: any) {
        console.error('🔐 SignIn failed:', signError);

        // If it's a formatting error, try with an even simpler challenge
        if (
          signError.message?.includes('formatting') ||
          signError.message?.includes('invalid')
        ) {
          void 0 && ('🔐 Retrying with ultra-simple challenge format...');
          showInfo('Retrying', 'Trying alternative signature format...');

          const simpleChallenge = {
            domain: 'localhost:3000',
            statement: 'Sign in to verify your wallet',
            uri: 'http://localhost:3000',
            version: '1',
            chainId: 'mainnet-beta',
            nonce: Math.random().toString(36).substring(2, 10),
            issuedAt: new Date().toISOString(),
          };

          void 0 && (
            '🔐 Simple challenge:',
            JSON.stringify(simpleChallenge, null, 2)
          );
          output = await signIn(simpleChallenge);
        } else {
          throw signError;
        }
      }

      // Step 3: Process based on mode (rest remains the same)
      let result;
      switch (mode) {
        case 'signup':
          const signUpRequest: WalletSignUpRequest = {
            input: challenge,
            output,
            firstName: undefined, // No form data, so pass undefined
            lastName: undefined, // No form data, so pass undefined
            email: undefined, // No form data, so pass undefined
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
        void 0 && (
          '🎉 Authentication successful! Storing token and updating user state'
        );
        void 0 && ('🎉 Result:', result);

        // CRITICAL: Store token FIRST so API calls can be authenticated
        SiwsAuthService.storeToken(result.token);
        void 0 && ('🎉 Token stored via SiwsAuthService');

        // Set initial user state (even if account details have errors)
        setUser({
          id: result.user.id,
          email: result.user.email,
          walletAddress: result.user.walletAddress,
          accountDetails: result.user.accountDetails,
        });
        void 0 && ('🎉 User state updated');

        // If account details have errors, try to fetch them now that token is stored
        if (result.user.accountDetails?._hasError) {
          void 0 && ('🔄 Account details have error, attempting to fetch after token storage...');
          try {
            const freshAccountDetails = await SiwsAuthService.refreshAccountDetails();
            // Update user with fresh account details
            setUser(prevUser => ({
              ...prevUser!,
              accountDetails: freshAccountDetails
            }));
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

        // Test the token by making a protected API call
        setTimeout(async () => {
          void 0 && (
            '🧪 Testing authentication token with protected endpoint...'
          );
          try {
            const walletInfo = await SiwsAuthService.getWalletInfo();
            void 0 && ('🧪 Protected endpoint success:', walletInfo);
          } catch (error) {
            console.error('🧪 Protected endpoint failed:', error);
            showError(
              'Token Test Failed',
              'The authentication token is not working properly for protected endpoints.'
            );
          }
        }, 1000);

        showSuccess(
          mode === 'signin' ? 'Sign In Successful' : 'Sign Up Successful',
          `Welcome! You've been authenticated with your ${wallet.adapter.name} wallet.`
        );

        void 0 && ('🎉 Calling onSuccess callback');
        onSuccess?.();
      } else {
        console.error('🎉 No token in authentication result:', result);
      }
    } catch (error: any) {
      console.error('🔐 Wallet authentication error:', error);
      console.error('🔐 Error stack:', error.stack);
      let errorMessage = error.message || 'Authentication failed';

      // Handle specific error cases
      if (
        errorMessage.includes('User rejected') ||
        errorMessage.includes('rejected')
      ) {
        errorMessage = 'You rejected the signature request. Please try again.';
        showError('Signature Rejected', errorMessage);
      } else if (
        errorMessage.includes('invalid formatting') ||
        errorMessage.includes('formatting')
      ) {
        errorMessage =
          'The signature request format is invalid. This might be due to an incompatible wallet or incorrect SIWS challenge format.';
        showError('Invalid Format', errorMessage);
        console.error('🔐 Formatting error - check challenge structure');
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
    onSuccess,
    onError,
    onModeChange,
    setUser,
    showSuccess,
    showError,
    showInfo,
  ]);

  // Compact layout for modal use
  return (
    <div className="space-y-4">
      {/* Wallet Connection */}
      <div className="space-y-3">
        <div className="flex items-center justify-center">
          <WalletMultiButton className="!bg-primary hover:!bg-primary/90" />
        </div>

        {!walletDetected && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-yellow-800 font-medium">
                  No Wallet Detected
                </p>
                <p className="text-yellow-700 mt-1">
                  Install{' '}
                  <a
                    href="https://phantom.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Phantom
                  </a>{' '}
                  or another Solana wallet.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Authentication Button */}
      {connected && publicKey && (
        <Button
          onClick={handleWalletAuth}
          disabled={isLoading || connecting}
          className="w-full"
          size="sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === 'signin'
                ? 'Signing In...'
                : mode === 'signup'
                  ? 'Signing Up...'
                  : 'Linking...'}
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              {mode === 'signin' &&
                `Sign In with ${wallet?.adapter.name || 'Wallet'}`}
              {mode === 'signup' &&
                `Sign Up with ${wallet?.adapter.name || 'Wallet'}`}
              {mode === 'link' && `Link ${wallet?.adapter.name || 'Wallet'}`}
            </>
          )}
        </Button>
      )}
    </div>
  );
};
