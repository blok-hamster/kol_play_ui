'use client';

import React, { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

export default function OAuthPopupCallbackPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const sendMessageToParent = () => {
      try {
        // Get OAuth parameters from URL
        const token = searchParams.get('token');
        const error = searchParams.get('error');

        console.log('🔐 Popup Callback - URL params:', { token, error });

        if (error) {
          // Send error message to parent window
          const errorMessage = {
            type: 'OAUTH_ERROR',
            error: error,
          };

          console.log('🔐 Sending error message to parent:', errorMessage);
          window.opener?.postMessage(errorMessage, window.location.origin);
        } else if (token) {
          // Send success message to parent window
          const successMessage = {
            type: 'OAUTH_SUCCESS',
            token: token,
            // We don't have user data from the redirect, parent will fetch it
            user: null,
            isNewUser: false, // This will be determined by the parent
          };

          console.log('🔐 Sending success message to parent:', successMessage);
          window.opener?.postMessage(successMessage, window.location.origin);
        } else {
          // No valid parameters
          const errorMessage = {
            type: 'OAUTH_ERROR',
            error: 'No valid OAuth parameters received',
          };

          console.log('🔐 Sending no-params error to parent:', errorMessage);
          window.opener?.postMessage(errorMessage, window.location.origin);
        }

        // Close the popup after sending the message
        setTimeout(() => {
          window.close();
        }, 1000);
      } catch (error) {
        console.error('🔐 Error in popup callback:', error);

        // Send generic error to parent
        const errorMessage = {
          type: 'OAUTH_ERROR',
          error: 'An unexpected error occurred in popup callback',
        };

        window.opener?.postMessage(errorMessage, window.location.origin);

        // Close popup
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    };

    // Send message to parent immediately
    sendMessageToParent();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full">
            <svg
              className="animate-spin h-6 w-6 text-blue-600 dark:text-blue-400"
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
        </div>

        <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Completing Authentication
        </h1>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          Please wait while we complete the authentication process...
        </p>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          This window will close automatically.
        </div>
      </div>
    </div>
  );
}
