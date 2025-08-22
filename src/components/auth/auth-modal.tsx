'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Tabs, TabItem } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useModal } from '@/stores/use-ui-store';
import { useUserStore } from '@/stores/use-user-store';
import { useNotifications } from '@/stores/use-ui-store';
import SignInForm from './sign-in-form';
import SignUpForm from './sign-up-form';
import { WalletAuthCompact } from './wallet-auth-compact';
import OAuthService from '@/services/oauth.service';
import { SUCCESS_MESSAGES } from '@/lib/constants';
import AuthService from '@/services/auth.service';
import { AuthRedirectManager } from '@/lib/auth-redirect';
import { useInviteCode } from '@/contexts/invite-context';

interface AuthModalProps {
  defaultTab?: 'signin' | 'signup';
}

const AuthModal: React.FC<AuthModalProps> = ({ defaultTab = 'signin' }) => {
  const { isModalOpen, closeModal, modalData } = useModal();

  // Use modal data to override default tab if provided
  const initialTab = modalData?.defaultTab || defaultTab;
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { setUser } = useUserStore();
  const { showSuccess, showError } = useNotifications();
  const { inviteCode } = useInviteCode();

  const isOpen = isModalOpen('auth');

  // Reset tab when modal data changes
  React.useEffect(() => {
    if (modalData?.defaultTab) {
      console.log(
        '🔐 Auth modal setting tab from modal data:',
        modalData.defaultTab
      );
      setActiveTab(modalData.defaultTab);
    }
  }, [modalData]);

  React.useEffect(() => {
    console.log('🔐 Auth modal state:', { isOpen, activeTab, modalData });
  }, [isOpen, activeTab, modalData]);

  const handleAuthSuccess = () => {
    // Clear all authentication flags when authentication succeeds
    AuthRedirectManager.clearModalOpeningFlag();
    AuthRedirectManager.clearAuthenticationInProgressFlag();

    // Execute any pending requests
    AuthRedirectManager.handleSuccessfulAuth();

    closeModal();
    // Additional success handling can be added here
  };

  const handleModalClose = () => {
    // Clear all authentication flags when modal is closed
    AuthRedirectManager.clearModalOpeningFlag();
    AuthRedirectManager.clearAuthenticationInProgressFlag();
    closeModal();
  };

  const handleRedirectToLogin = () => {
    setActiveTab('signin');
  };

  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);

    try {
      void 0 && '🔐 Starting Google OAuth from auth modal...';
      const response = await OAuthService.googleOAuthPopup();

      void 0 && ('🔐 OAuth response received:', response);

      if (response.success && response.token) {
        let user = response.user;

        // If user data is not provided, fetch it
        if (!user && response.token) {
          void 0 && '🔐 Fetching user data from token...';
          try {
            const fetchedUser = await AuthService.getCurrentUser();
            user = fetchedUser || undefined; // Convert null to undefined
          } catch (userError) {
            console.error('🔐 Failed to fetch user data:', userError);
            showError('Authentication Error', 'Failed to get user information');
            return;
          }
        }

        if (user) {
          // OAuth was successful
          setUser(user);

          if (response.isNewUser) {
            showSuccess(
              'Welcome to KOL Play!',
              'Your account has been created successfully.'
            );
          } else {
            showSuccess('Welcome back!', SUCCESS_MESSAGES.LOGIN_SUCCESS);
          }

          handleAuthSuccess();
        } else {
          showError('Authentication Error', 'Failed to get user information');
        }
      } else {
        // OAuth failed
        const errorMessage = response.error || 'Google authentication failed';
        console.error('🔐 OAuth failed:', errorMessage);
        showError('Google Authentication Failed', errorMessage);
      }
    } catch (error: any) {
      console.error('🔐 OAuth error caught:', error);
      showError(
        'Google Authentication Failed',
        error.message || 'An unexpected error occurred'
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleRedirect = async () => {
    try {
      void 0 && '🔐 Starting Google OAuth redirect from auth modal...';
      await OAuthService.googleOAuthRedirect();
      // This will redirect the page, so no further code executes
    } catch (error: any) {
      console.error('🔐 OAuth redirect error caught:', error);
      showError(
        'Google Authentication Failed',
        error.message || 'Failed to start Google authentication'
      );
    }
  };

  const tabItems: TabItem[] = [
    {
      id: 'signin',
      label: 'Sign In',
      content: (
        <div className="space-y-6">
          <SignInForm
            onSuccess={handleAuthSuccess}
            onForgotPassword={() => {
              // Handle forgot password if needed
            }}
          />

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {/* OAuth and Wallet Options */}
          <div className="space-y-3">
            {/* Google OAuth Options */}
            <div className="space-y-2">
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handleGoogleAuth}
                loading={isGoogleLoading}
                disabled={isGoogleLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
              </Button>

              {/* Alternative redirect option */}
              <div className="text-center">
                <button
                  onClick={handleGoogleRedirect}
                  className="text-sm text-muted-foreground hover:text-primary underline focus:outline-none"
                  disabled={isGoogleLoading}
                >
                  Having popup issues? Try redirect method
                </button>
              </div>
            </div>

            <WalletAuthCompact
              mode="signin"
              onSuccess={handleAuthSuccess}
              onError={error =>
                showError('Wallet Authentication Failed', error)
              }
            />
          </div>

          {/* Switch to Sign Up */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <button
                className="text-primary hover:underline focus:outline-none focus:underline"
                onClick={() => setActiveTab('signup')}
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'signup',
      label: 'Sign Up',
      content: (
        <div className="space-y-6">
          <SignUpForm
            onSuccess={handleAuthSuccess}
            onRedirectToLogin={handleRedirectToLogin}
          />

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {/* OAuth and Wallet Options */}
          <div className="space-y-3">
            {/* Google OAuth Options */}
            <div className="space-y-2">
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handleGoogleAuth}
                loading={isGoogleLoading}
                disabled={isGoogleLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
              </Button>

              {/* Alternative redirect option */}
              <div className="text-center">
                <button
                  onClick={handleGoogleRedirect}
                  className="text-sm text-muted-foreground hover:text-primary underline focus:outline-none"
                  disabled={isGoogleLoading}
                >
                  Having popup issues? Try redirect method
                </button>
              </div>
            </div>

            <WalletAuthCompact
              mode="signup"
              onSuccess={handleAuthSuccess}
              onError={error =>
                showError('Wallet Authentication Failed', error)
              }
              onModeChange={mode => setActiveTab(mode)}
            />
          </div>

          {/* Switch to Sign In */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <button
                className="text-primary hover:underline focus:outline-none focus:underline"
                onClick={() => setActiveTab('signin')}
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Welcome to KOL Play"
      description="The ultimate Solana copy trading platform"
      size="lg"
      className="max-w-md"
    >
      <Tabs items={tabItems} activeTab={activeTab} onTabChange={setActiveTab} />
    </Modal>
  );
};

export default AuthModal;
