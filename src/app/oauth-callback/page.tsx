'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserStore } from '@/stores';
import { useNotifications } from '@/stores';
import apiClient from '@/lib/api';
import AuthService from '@/services/auth.service';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useUserStore();
  const { showSuccess, showError } = useNotifications();

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>(
    'processing'
  );
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Get parameters from URL
        const token = searchParams.get('token');
        const error = searchParams.get('error');
        const code = searchParams.get('code');

        console.log('🔐 OAuth Callback - URL params:', { token, error, code });

        if (error) {
          // Handle OAuth error
          console.error('🔐 OAuth Error:', error);
          setStatus('error');

          let errorMessage = 'Authentication failed';
          if (error === 'auth_failed') {
            errorMessage = 'Google authentication failed. Please try again.';
          } else if (error === 'access_denied') {
            errorMessage = 'Access denied. Please contact support for access.';
          }

          setMessage(errorMessage);
          showError('Authentication Failed', errorMessage);

          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push('/?auth=signin');
          }, 3000);
          return;
        }

        if (token) {
          // Direct token from backend redirect
          console.log('🔐 Received token from redirect:', token);

          // Set the token
          apiClient.setToken(token);

          // Get user info from the token
          try {
            console.log('🔐 Fetching user data from token...');
            const user = await AuthService.getCurrentUser();

            if (user) {
              setUser(user);
              setStatus('success');
              setMessage('Authentication successful! Redirecting...');
              showSuccess(
                'Welcome!',
                'You have been successfully authenticated.'
              );

              // Redirect to portfolio
              console.log(
                'OAuth callback successful, redirecting to portfolio'
              );
              router.push('/portfolio');
            } else {
              throw new Error('Failed to get user information from token');
            }
          } catch (userError: any) {
            console.error('🔐 Failed to get user info:', userError);
            setStatus('error');
            setMessage('Failed to get user information');
            showError('Authentication Error', 'Failed to get user information');

            // Clear the invalid token
            apiClient.clearToken();

            // Redirect to login
            setTimeout(() => {
              router.push('/?auth=signin');
            }, 3000);
          }

          return;
        }

        if (code) {
          // Handle authorization code exchange
          console.log('🔐 Exchanging authorization code:', code);
          setMessage('Exchanging authorization code...');

          try {
            const response = await fetch('/api/oauth/google/callback', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ code }),
            });

            const data = await response.json();

            if (response.ok && data.token) {
              apiClient.setToken(data.token);
              setUser(data.user);

              setStatus('success');
              setMessage('Authentication successful! Redirecting...');

              if (data.isNewUser) {
                showSuccess(
                  'Welcome to KOL Play!',
                  'Your account has been created successfully.'
                );
              } else {
                showSuccess(
                  'Welcome back!',
                  'You have been successfully signed in.'
                );
              }

              // Redirect to portfolio
              console.log(
                'OAuth callback successful, redirecting to portfolio'
              );
              router.push('/portfolio');
            } else {
              throw new Error(data.message || 'Authentication failed');
            }
          } catch (exchangeError: any) {
            console.error('🔐 Code exchange failed:', exchangeError);
            setStatus('error');
            setMessage('Failed to complete authentication');
            showError(
              'Authentication Error',
              exchangeError.message || 'Failed to complete authentication'
            );
          }

          return;
        }

        // No valid parameters found
        console.error('🔐 No valid OAuth parameters found');
        setStatus('error');
        setMessage('Invalid authentication response');
        showError('Authentication Error', 'Invalid authentication response');

        // Redirect to login
        setTimeout(() => {
          router.push('/?auth=signin');
        }, 3000);
      } catch (error: any) {
        console.error('🔐 OAuth callback error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred');
        showError('Authentication Error', 'An unexpected error occurred');

        // Redirect to login
        setTimeout(() => {
          router.push('/?auth=signin');
        }, 3000);
      }
    };

    handleOAuthCallback();
  }, [searchParams, router, setUser, showSuccess, showError]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          {status === 'processing' && (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
              <svg
                className="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}

          {status === 'success' && (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
              <svg
                className="h-8 w-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}

          {status === 'error' && (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full mb-4">
              <svg
                className="h-8 w-8 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {status === 'processing' && 'Authenticating...'}
          {status === 'success' && 'Success!'}
          {status === 'error' && 'Authentication Failed'}
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>

        {status === 'error' && (
          <button
            onClick={() => router.push('/?auth=signin')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
          >
            Try Again
          </button>
        )}

        {status === 'success' && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Redirecting to portfolio...
          </div>
        )}
      </div>
    </div>
  );
}
