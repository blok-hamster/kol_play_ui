/**
 * Example usage of AuthRedirectManager for authentication error handling
 * Note: The AuthRedirectManager now opens the auth modal instead of redirecting to /login
 */

import { AuthRedirectManager } from '@/lib/auth-redirect';
import apiClient from '@/lib/api';

// Example 1: Using in a service that makes API calls
export class ExampleService {
  async fetchUserData() {
    try {
      const response = await apiClient.get('/user/profile');
      return response.data;
    } catch (error: any) {
      // The API client will automatically handle 403 errors and open auth modal
      // But you can also manually trigger the auth modal if needed
      if (error.response?.status === 403) {
        console.log('Access denied - opening signin modal');
        // This is already handled by the API client, but shown for example
        AuthRedirectManager.redirectToSignin(true);
      }
      throw error;
    }
  }
}

// Example 2: Using in authentication flow
export class AuthService {
  async login(credentials: { email: string; password: string }) {
    try {
      const response = await apiClient.post('/auth/login', credentials);
      
      if (response.success) {
        // Set the token in API client
        apiClient.setToken(response.data.token);
        
        // Handle successful authentication - this will redirect to preserved URL if available
        AuthRedirectManager.handleSuccessfulAuth();
        
        return response.data;
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear tokens and redirect data
      apiClient.clearToken(); // This also calls AuthRedirectManager.clearAll()
      
      // Redirect to home page
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  }
}

// Example 3: Manual URL preservation and auth modal opening
export function preserveCurrentPageForLogin() {
  // This is automatically handled by the API client, but can be called manually if needed
  AuthRedirectManager.preserveCurrentUrl();
  
  // Then open auth modal (this will also preserve URL automatically)
  AuthRedirectManager.redirectToSignin(true);
}

// Example 4: Check if redirect is in progress (useful for UI state)
export function isAuthRedirectInProgress(): boolean {
  return AuthRedirectManager.isRedirecting();
}

// Example 5: Get preserved URL for custom redirect logic
export function getPreservedRedirectUrl(): string | null {
  return AuthRedirectManager.getPreservedUrl();
}

// Example 6: Clear all redirect data (useful for cleanup)
export function clearAuthRedirectData() {
  AuthRedirectManager.clearAll();
}

// Example 7: Setting up AuthRedirectManager in your app (should be done in root layout or app component)
export function setupAuthRedirectInApp() {
  // This should be done in your root component using the useAuthRedirectSetup hook
  // 
  // import { useAuthRedirectSetup } from '@/hooks/use-auth-redirect-setup';
  // 
  // function RootLayout() {
  //   useAuthRedirectSetup(); // This sets up the modal opener
  //   return <YourAppContent />;
  // }
}

// Example 8: Manual modal opener setup (alternative to using the hook)
import { useModal } from '@/stores/use-ui-store';

export function manualSetupAuthRedirect() {
  const { openModal } = useModal();
  
  // Set up the modal opener manually
  AuthRedirectManager.setModalOpener(openModal);
}