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
        const code = searchParams.get('code'); // Google OAuth returns a code parameter

        console.log('🔐 Popup Callback - URL params:', { token, error, code, fullUrl: window.location.href });

        if (error) {
          // Send error message to parent window
          const errorMessage = {
            type: 'OAUTH_ERROR',
            error: error,
          };

          console.log('🔐 Sending error message to parent:', errorMessage);

          // Try multiple ways to communicate with parent
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(errorMessage, window.location.origin);
            } else if (window.parent && window.parent !== window) {
              window.parent.postMessage(errorMessage, window.location.origin);
            }
          } catch (e) {
            console.error('🔐 Failed to send message to parent:', e);
          }
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

          // Try multiple ways to communicate with parent
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(successMessage, window.location.origin);
            } else if (window.parent && window.parent !== window) {
              window.parent.postMessage(successMessage, window.location.origin);
            }
          } catch (e) {
            console.error('🔐 Failed to send message to parent:', e);
          }
        } else if (code) {
          // If we have a code but no token, send the code to parent for processing
          const codeMessage = {
            type: 'OAUTH_CODE',
            code: code,
          };

          console.log('🔐 Sending OAuth code to parent:', codeMessage);

          // Try multiple ways to communicate with parent
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(codeMessage, window.location.origin);
            } else if (window.parent && window.parent !== window) {
              window.parent.postMessage(codeMessage, window.location.origin);
            }
          } catch (e) {
            console.error('🔐 Failed to send message to parent:', e);
          }
        } else {
          // No valid parameters
          const errorMessage = {
            type: 'OAUTH_ERROR',
            error: 'No valid OAuth parameters received',
          };

          console.log('🔐 Sending no-params error to parent:', errorMessage);

          // Try multiple ways to communicate with parent
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(errorMessage, window.location.origin);
            } else if (window.parent && window.parent !== window) {
              window.parent.postMessage(errorMessage, window.location.origin);
            }
          } catch (e) {
            console.error('🔐 Failed to send message to parent:', e);
          }
        }

        // Close the popup after sending the message
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            console.log('🔐 Could not close popup window:', e);
          }
        }, 1000);
      } catch (error) {
        console.error('🔐 Error in popup callback:', error);

        // Send generic error to parent
        const errorMessage = {
          type: 'OAUTH_ERROR',
          error: 'An unexpected error occurred in popup callback',
        };

        // Try multiple ways to communicate with parent
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(errorMessage, window.location.origin);
          } else if (window.parent && window.parent !== window) {
            window.parent.postMessage(errorMessage, window.location.origin);
          }
        } catch (e) {
          console.error('🔐 Failed to send error message to parent:', e);
        }

        // Close popup
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            console.log('🔐 Could not close popup window:', e);
          }
        }, 1000);
      }
    };

    // Send message to parent immediately
    sendMessageToParent();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#171616] flex items-center justify-center p-6 font-sans">
      <div className="relative max-w-sm w-full">
        {/* Glow effect background */}
        <div className="absolute -inset-4 bg-gradient-to-r from-[#14f195] to-[#9945ff] rounded-2xl blur-xl opacity-20 animate-pulse" />

        <div className="relative bg-[#1f1f1f] border border-[#374151] rounded-2xl p-8 text-center shadow-2xl">
          <div className="mb-8 relative flex justify-center">
            {/* Animated outer ring */}
            <div className="absolute w-16 h-16 border-2 border-[#14f195]/30 rounded-full animate-ping" />

            <div className="relative flex items-center justify-center w-16 h-16 bg-[#171616] rounded-full border border-[#374151] shadow-inner">
              <svg
                className="animate-spin h-8 w-8 text-[#14f195]"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-10"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-3 tracking-tight">
            Authenticating
          </h1>

          <p className="text-[#9ca3af] text-base font-medium leading-relaxed mb-6">
            Connecting your Google account to <span className="text-[#14f195]">KOL Play</span>...
          </p>

          <div className="flex flex-col space-y-4">
            <div className="h-1.5 w-full bg-[#374151] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#14f195] to-[#9945ff] w-2/3 rounded-full animate-[progress_2s_ease-in-out_infinite]" />
            </div>

            <p className="text-xs text-[#6b7280] font-semibold uppercase tracking-widest animate-pulse">
              Securing Session
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(50%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
