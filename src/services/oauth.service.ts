import apiClient from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/constants';
import type { AuthResponse, OAuthResponse } from '@/types';

/**
 * OAuth Service
 * Handles Google OAuth authentication flows
 */

export class OAuthService {
  /**
   * Get Google OAuth authorization URL
   */
  static async getGoogleAuthUrl(): Promise<{ url: string }> {
    try {
      const response = await apiClient.get<{ url: string }>(
        API_ENDPOINTS.OAUTH.GOOGLE_URL
      );
      // Handle both wrapped and unwrapped responses
      return response.data || response;
    } catch (error: any) {
      console.error('🔐 Google OAuth URL Error:', error);
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Exchange Google authorization code for JWT token
   */
  static async googleCallback(code: string): Promise<OAuthResponse> {
    try {
      const response = await apiClient.post<
        AuthResponse['data'] & { isNewUser: boolean }
      >(API_ENDPOINTS.OAUTH.GOOGLE_CALLBACK, { code });

      // Set the token for future requests
      if (response.data.token) {
        apiClient.setToken(response.data.token);
      }

      return {
        success: true,
        token: response.data.token,
        user: response.data.user,
        isNewUser: response.data.isNewUser,
      };
    } catch (error: any) {
      console.error('🔐 Google OAuth Callback Error:', error);
      return {
        success: false,
        error: apiClient.handleError(error),
      };
    }
  }

  /**
   * Verify Google ID token and authenticate user
   */
  static async verifyGoogleToken(idToken: string, inviteCode?: string): Promise<OAuthResponse> {
    try {
      const payload: { idToken: string; inviteCode?: string } = { idToken };
      
      // Add invite code if in alpha/beta stage
      const stage = process.env.NEXT_PUBLIC_STAGE;
      if ((stage === 'alpha' || stage === 'beta') && inviteCode) {
        payload.inviteCode = inviteCode;
      }
      
      const response = await apiClient.post<
        AuthResponse['data'] & { isNewUser: boolean }
      >(API_ENDPOINTS.OAUTH.VERIFY_TOKEN, payload);

      // Set the token for future requests
      if (response.data.token) {
        apiClient.setToken(response.data.token);
      }

      return {
        success: true,
        token: response.data.token,
        user: response.data.user,
        isNewUser: response.data.isNewUser,
      };
    } catch (error: any) {
      console.error('🔐 Google Token Verification Error:', error);
      return {
        success: false,
        error: apiClient.handleError(error),
      };
    }
  }

  /**
   * Multi-provider OAuth sign in (Google/Facebook)
   */
  static async oauthSignIn(
    provider: 'google' | 'facebook',
    token: string,
    userData?: any
  ): Promise<OAuthResponse> {
    try {
      const payload =
        provider === 'facebook'
          ? { provider, token, userData }
          : { provider, token };

      const response = await apiClient.post<
        AuthResponse['data'] & { isNewUser: boolean }
      >('/oauth/auth/oauth/signin', payload);

      // Set the token for future requests
      if (response.data.token) {
        apiClient.setToken(response.data.token);
      }

      return {
        success: true,
        token: response.data.token,
        user: response.data.user,
        isNewUser: response.data.isNewUser,
      };
    } catch (error: any) {
      console.error(`🔐 ${provider} OAuth Sign In Error:`, error);
      return {
        success: false,
        error: apiClient.handleError(error),
      };
    }
  }

  /**
   * Initiate Google OAuth redirect flow
   */
  static initiateGoogleOAuth(): void {
    window.location.href = `${apiClient['client'].defaults.baseURL}${API_ENDPOINTS.OAUTH.GOOGLE}`;
  }

  /**
   * Google OAuth with popup window
   */
  static async googleOAuthPopup(): Promise<OAuthResponse> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔐 Starting Google OAuth popup flow...');

        // Use the backend OAuth redirect endpoint
        // The backend will redirect to Google OAuth and then back to the main callback
        // We'll monitor the popup to detect when it reaches the callback
        const oauthUrl = `${API_ENDPOINTS.BASE_URL}${API_ENDPOINTS.OAUTH.GOOGLE}`;
        
        console.log('🔐 Opening popup with backend OAuth URL:', oauthUrl);

        const popup = window.open(
          oauthUrl,
          'google-oauth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        if (!popup) {
          reject(
            new Error('Popup blocked. Please allow popups for this site.')
          );
          return;
        }

            // Listen for messages from popup
            const messageListener = (event: MessageEvent) => {
              console.log('🔐 Received message from popup:', event);

              if (event.origin !== window.location.origin) {
                console.warn(
                  '🔐 Ignoring message from unknown origin:',
                  event.origin
                );
                return;
              }

              if (event.data.type === 'OAUTH_SUCCESS') {
                console.log('🔐 OAuth success message received:', event.data);
                window.removeEventListener('message', messageListener);
                popup.close();

                // Set the token immediately
                if (event.data.token) {
                  apiClient.setToken(event.data.token);
                }

                resolve({
                  success: true,
                  token: event.data.token,
                  user: event.data.user,
                  isNewUser: event.data.isNewUser,
                });
              } else if (event.data.type === 'OAUTH_CODE') {
                console.log('🔐 OAuth code message received:', event.data);
                window.removeEventListener('message', messageListener);
                popup.close();

                // Exchange the code for a token
                this.googleCallback(event.data.code)
                  .then(result => {
                    if (result.success && result.token) {
                      resolve({
                        success: true,
                        token: result.token,
                        user: result.user,
                        isNewUser: result.isNewUser,
                      });
                    } else {
                      resolve({
                        success: false,
                        error: result.error || 'Failed to exchange OAuth code',
                      });
                    }
                  })
                  .catch(error => {
                    console.error('🔐 Failed to exchange OAuth code:', error);
                    resolve({
                      success: false,
                      error: 'Failed to complete authentication',
                    });
                  });
              } else if (event.data.type === 'OAUTH_ERROR') {
                console.error('🔐 OAuth error message received:', event.data);
                window.removeEventListener('message', messageListener);
                popup.close();

                resolve({
                  success: false,
                  error: event.data.error || 'Authentication failed',
                });
              }
            };

            window.addEventListener('message', messageListener);

            // Monitor popup URL for callback detection
            const urlMonitor = setInterval(() => {
              try {
                if (popup.closed) {
                  return; // Will be handled by checkClosed
                }

                // Try to access popup URL to detect callback
                const popupUrl = popup.location?.href;
                console.log('🔐 Monitoring popup URL:', popupUrl);
                
                if (popupUrl && (popupUrl.includes('/oauth-callback') || popupUrl.includes('token=') || popupUrl.includes('error='))) {
                  // Extract parameters from URL
                  const url = new URL(popupUrl);
                  const token = url.searchParams.get('token');
                  const error = url.searchParams.get('error');

                  console.log('🔐 Detected callback in popup:', { token: !!token, error });

                  clearInterval(urlMonitor);
                  clearInterval(checkClosed);
                  clearTimeout(timeout);
                  window.removeEventListener('message', wrappedListener);
                  popup.close();

                  if (token) {
                    apiClient.setToken(token);
                    resolve({
                      success: true,
                      token: token,
                      user: null, // Will be fetched by parent
                      isNewUser: false,
                    });
                  } else {
                    resolve({
                      success: false,
                      error: error || 'Authentication failed',
                    });
                  }
                }
              } catch (e) {
                // Expected when popup is on different domain (Google OAuth)
                // Continue monitoring
              }
            }, 500);

            // Check if popup was closed manually
            const checkClosed = setInterval(() => {
              try {
                if (popup.closed) {
                  clearInterval(checkClosed);
                  clearInterval(urlMonitor);
                  clearTimeout(timeout);
                  window.removeEventListener('message', wrappedListener);

                  resolve({
                    success: false,
                    error: 'Authentication was cancelled by user',
                  });
                }
              } catch (error) {
                // This might happen due to Cross-Origin-Opener-Policy
                console.warn('🔐 Cannot check popup status due to COOP policy:', error);
                // Continue checking, the message listener will handle success/error
              }
            }, 1000);

            // Add a timeout to prevent hanging indefinitely
            const timeout = setTimeout(() => {
              clearInterval(checkClosed);
              clearInterval(urlMonitor);
              clearTimeout(timeout);
              window.removeEventListener('message', wrappedListener);
              
              try {
                popup.close();
              } catch (e) {
                console.warn('🔐 Could not close popup:', e);
              }

              resolve({
                success: false,
                error: 'Authentication timed out',
              });
            }, 60000); // 60 second timeout

            // Clean up timeout and intervals if we get a message
            const originalListener = messageListener;
            const wrappedListener = (event: MessageEvent) => {
              clearTimeout(timeout);
              clearInterval(checkClosed);
              clearInterval(urlMonitor);
              originalListener(event);
            };

        window.removeEventListener('message', messageListener);
        window.addEventListener('message', wrappedListener);
      } catch (error) {
        console.error('🔐 OAuth popup setup error:', error);
        reject(error);
      }
    });
  }

  /**
   * Initiate Google OAuth redirect flow
   * This will redirect the entire page to Google OAuth
   */
  static async googleOAuthRedirect(): Promise<void> {
    try {
      console.log('🔐 Starting Google OAuth redirect flow...');

      // Use backend redirect endpoint directly
      const redirectUrl = `${API_ENDPOINTS.BASE_URL}/oauth/google`;

      console.log('🔐 Redirecting to:', redirectUrl);
      window.location.href = redirectUrl;
    } catch (error: any) {
      console.error('🔐 Failed to initiate OAuth redirect:', error);
      throw new Error('Failed to start Google authentication');
    }
  }

  /**
   * Handle OAuth callback from URL parameters (for redirect flow)
   */
  static handleOAuthCallback(): { token?: string; error?: string } {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');

    if (token) {
      apiClient.setToken(token);
      return { token };
    }

    if (error) {
      return { error };
    }

    return {};
  }
}

export default OAuthService;
