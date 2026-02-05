import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { ApiResponse } from '@/types';
import { AuthRedirectManager } from './auth-redirect';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL  || 'http://localhost:5000', // Change this URL to match your backend
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.loadTokenFromStorage();
  }

  private setupInterceptors(): void {
    // Request interceptor to add JWT token and prevent circular calls
    this.client.interceptors.request.use(
      config => {
        // Define authentication-related endpoints that should be allowed during auth sessions
        const authEndpoints = [
          '/api/auth/signin',
          '/api/auth/signup',
          '/api/auth/signup-vcs',
          '/api/auth/verify-otp',
          '/api/auth/resend-otp',
          '/api/auth/forgot-password',
          '/api/auth/reset-password',
          '/api/wallet/challenge',
          '/api/wallet/signup',
          '/api/wallet/verify',
          '/api/wallet/link',
          '/api/wallet/unlink',
          '/api/wallet/info',
          '/api/oauth/google/url',
          '/api/oauth/google/callback',
          '/api/oauth/verify-token',
          '/api/oauth/auth/oauth/signin',
          '/api/oauth/google',
          '/api/oauth/facebook'
        ];

        const isAuthEndpoint = authEndpoints.some(endpoint => 
          config.url?.includes(endpoint)
        );

        // Debug logging for wallet challenge specifically
        if (config.url?.includes('/wallet/challenge')) {
          console.log('🔍 Wallet Challenge Debug:', {
            url: config.url,
            isAuthEndpoint,
            isModalOpening: AuthRedirectManager.isModalOpening(),
            isAuthenticationInProgress: AuthRedirectManager.isAuthenticationInProgress(),
            matchedEndpoints: authEndpoints.filter(endpoint => config.url?.includes(endpoint))
          });
        }

        // Prevent non-auth API calls when authentication is in progress to avoid infinite loops
        // But allow authentication-related calls to proceed
        if (!isAuthEndpoint && (AuthRedirectManager.isModalOpening() || AuthRedirectManager.isAuthenticationInProgress())) {
          void 0 && ('🚫 API Request - Blocked non-auth call during authentication to prevent infinite loop:', config.url);
          const error = new Error('API call blocked during authentication session') as any;
          error.config = config;
          error.isBlocked = true;
          return Promise.reject(error);
        }

        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
          void 0 && (
            '🚀 API Request - Adding Authorization header:',
            `Bearer ${this.token.substring(0, 50)}...`
          );
        } else {
          void 0 && (
            '🚀 API Request - No token available, no Authorization header added'
          );
        }
        void 0 && ('🚀 API Request - URL:', config.url);
        void 0 && ('🚀 API Request - Method:', config.method?.toUpperCase());
        return config;
      },
      error => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Check for "access denied" messages in successful responses
        if (this.isAccessDeniedResponse(response.data)) {
          this.handleAuthenticationError();
          // Create a synthetic error to maintain consistent error handling
          const syntheticError = new Error('Access denied') as AxiosError;
          syntheticError.response = response;
          return Promise.reject(syntheticError);
        }
        return response;
      },
      (error: AxiosError) => {
        // Handle blocked requests gracefully (don't trigger auth errors)
        if ((error as any).isBlocked) {
          void 0 && ('🚫 API Request - Request was blocked during modal opening, rejecting silently');
          return Promise.reject(error);
        }

        if (error.response?.status === 401) {
          // Token expired or invalid - use enhanced clearing
          this.clearAuthenticationState();
          // Redirect to login with URL preservation
          AuthRedirectManager.redirectToSignin(true);
        } else if (error.response?.status === 403 || this.isAccessDeniedResponse(error.response?.data)) {
          // Handle 403 status codes and access denied messages
          this.handleAuthenticationError();
        }
        return Promise.reject(error);
      }
    );
  }

  private loadTokenFromStorage(): void {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('authToken');
      void 0 && (
        '🔑 API Client - Loading token from storage:',
        this.token ? this.token.substring(0, 50) + '...' : 'No token found'
      );
    }
  }

  private isAccessDeniedResponse(responseData: any): boolean {
    if (!responseData) return false;

    // Check for "access denied" message in various response formats (case-insensitive)
    const accessDeniedPattern = /access\s+denied/i;
    
    // Check direct message properties
    if (typeof responseData.message === 'string' && accessDeniedPattern.test(responseData.message)) {
      return true;
    }
    
    if (typeof responseData.error === 'string' && accessDeniedPattern.test(responseData.error)) {
      return true;
    }
    
    // Check nested data object
    if (responseData.data) {
      if (typeof responseData.data.message === 'string' && accessDeniedPattern.test(responseData.data.message)) {
        return true;
      }
      
      if (typeof responseData.data.error === 'string' && accessDeniedPattern.test(responseData.data.error)) {
        return true;
      }
    }
    
    return false;
  }

  private handleAuthenticationError(): void {
    void 0 && ('🚫 API Client - Authentication error detected, clearing token and redirecting');
    
    // Check if authentication is already in progress to prevent infinite loops
    if (AuthRedirectManager.isModalOpening() || AuthRedirectManager.isAuthenticationInProgress()) {
      void 0 && ('🚫 API Client - Authentication already in progress, skipping redirect to prevent infinite loop');
      return;
    }
    
    // Clear authentication state comprehensively
    this.clearAuthenticationState();
    
    // Redirect to signin page with URL preservation
    AuthRedirectManager.redirectToSignin(true);
  }

  /**
   * Comprehensive authentication state clearing for 403 error handling
   * Ensures all authentication-related data is properly cleared
   */
  private clearAuthenticationState(): void {
    void 0 && ('🧹 API Client - Clearing comprehensive authentication state');
    
    // Clear token using enhanced method for authentication failures
    this.clearTokenForAuthFailure();
    
    // Clear any additional authentication-related data
    if (typeof window !== 'undefined') {
      // Clear any cached user data that might be stored
      const keysToRemove = [
        'user-data', // Zustand persist key
        'wallet-auth-data',
        'auth-cache',
        'user-profile-cache'
      ];
      
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
          void 0 && (`🧹 Cleared localStorage key: ${key}`);
        } catch (error) {
          // Silently continue if removal fails
        }
      });
      
      // Clear any auth-related session storage
      try {
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('user-session');
        void 0 && ('🧹 Cleared sessionStorage auth data');
      } catch (error) {
        // Silently continue if removal fails
      }
    }
    
    void 0 && ('✅ API Client - Authentication state cleared comprehensively');
  }

  public getPreservedUrl(): string | null {
    return AuthRedirectManager.getPreservedUrl();
  }

  public clearPreservedUrl(): void {
    AuthRedirectManager.clearPreservedUrl();
  }

  public handleSuccessfulAuth(): void {
    AuthRedirectManager.handleSuccessfulAuth();
  }

  public setToken(token: string): void {
    void 0 && (
      '🔑 API Client - Setting new token:',
      token.substring(0, 50) + '...'
    );
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
      void 0 && ('🔑 API Client - Token stored in localStorage');

      // Set a lightweight auth presence cookie for middleware checks
      const isSecure = window.location.protocol === 'https:';
      const maxAge = 60 * 60 * 24 * 30; // 30 days
      document.cookie = `isAuth=1; Path=/; Max-Age=${maxAge}; SameSite=Lax${isSecure ? '; Secure' : ''}`;
    }
  }

  public clearToken(): void {
    void 0 && ('🔑 API Client - Clearing token');
    this.token = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('authToken');
      } catch (error) {
        // Silently handle localStorage errors
        void 0 && ('⚠️ Failed to remove authToken from localStorage:', error);
      }
      
      try {
        // Clear auth presence cookie
        document.cookie = 'isAuth=; Path=/; Max-Age=0; SameSite=Lax';
      } catch (error) {
        // Silently handle cookie errors
        void 0 && ('⚠️ Failed to clear auth cookie:', error);
      }
      
      // Clear redirect data when clearing tokens (useful for logout)
      AuthRedirectManager.clearAll();
    }
  }

  /**
   * Enhanced token clearing for authentication failures
   * Works with the new 403 error handling system
   */
  public clearTokenForAuthFailure(): void {
    void 0 && ('🔑 API Client - Clearing token for authentication failure');
    
    // Clear the token from memory and storage
    this.clearToken();
    
    // Additional cleanup for authentication failures
    if (typeof window !== 'undefined') {
      try {
        // Clear any additional auth-related cookies
        const authCookies = ['authToken', 'refreshToken', 'sessionId'];
        authCookies.forEach(cookieName => {
          try {
            document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
            document.cookie = `${cookieName}=; Path=/; Domain=${window.location.hostname}; Max-Age=0; SameSite=Lax`;
          } catch (error) {
            // Silently handle individual cookie clearing errors
            void 0 && (`⚠️ Failed to clear cookie ${cookieName}:`, error);
          }
        });
        
        void 0 && ('🔑 API Client - Cleared additional auth cookies');
      } catch (error) {
        // Silently handle cookie clearing errors
        void 0 && ('⚠️ Failed to clear additional auth cookies:', error);
      }
    }
  }

  public getToken(): string | null {
    void 0 && (
      '🔑 API Client - Getting token:',
      this.token ? this.token.substring(0, 50) + '...' : 'No token'
    );
    return this.token;
  }

  // Generic API methods
  public async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    const response = await this.client.get(url, { params });
    return response.data;
  }

  public async post<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.post(url, data);
    return response.data;
  }

  // Raw methods for endpoints that don't follow ApiResponse format
  public async postRaw<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post(url, data);
    return response.data;
  }

  public async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.put(url, data);
    return response.data;
  }

  public async patch<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.patch(url, data);
    return response.data;
  }

  public async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await this.client.delete(url);
    return response.data;
  }

  // Utility method to handle API errors
  public handleError(error: any): string {
    // Handle Network Errors gracefully
    if (this.isOfflineError(error)) {
      return 'Unable to connect to server. The backend may be offline.';
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }

  public isOfflineError(error: any): boolean {
    return (
      error.message === 'Network Error' ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNREFUSED' ||
      // Axios specific offline checks
      !error.response
    );
  }
}

// Create a singleton instance
const apiClient = new ApiClient();

export default apiClient;
