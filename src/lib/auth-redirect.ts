/**
 * Authentication redirect utilities
 * Provides centralized URL preservation and redirect logic for authentication errors
 */

interface RedirectState {
  isRedirecting: boolean;
  timestamp: number;
}

// Global modal opener function - will be set by the app initialization
let globalModalOpener: ((modalId: string, data?: any) => void) | null = null;

// Track modal opening state to prevent infinite loops
let isModalOpening = false;
let modalOpeningTimeout: NodeJS.Timeout | null = null;

// Global authentication session state to prevent cascading auth errors
let authenticationInProgress = false;
let authSessionTimeout: NodeJS.Timeout | null = null;
let lastAuthError: number = 0;

export class AuthRedirectManager {
  private static readonly REDIRECT_STATE_KEY = 'authRedirectState';
  private static readonly PRESERVED_URL_KEY = 'redirectUrl';
  private static readonly REDIRECT_TIMEOUT = 5000; // 5 seconds
  private static readonly MODAL_OPENING_TIMEOUT = 2000; // 2 seconds to prevent rapid modal opening
  private static readonly AUTH_SESSION_TIMEOUT = 30000; // 30 seconds to prevent cascading auth errors
  private static readonly MIN_AUTH_ERROR_INTERVAL = 5000; // 5 seconds minimum between auth errors
  private static readonly EXCLUDED_PATHS = ['/api/login', '/api/signup', '/api/auth', '/api/oauth', '/api/signin', '/api/wallet/challenge'];

  /**
   * Set the global modal opener function (should be called during app initialization)
   */
  static setModalOpener(opener: (modalId: string, data?: any) => void): void {
    globalModalOpener = opener;
  }

  /**
   * Check if modal is currently being opened to prevent infinite loops
   */
  static isModalOpening(): boolean {
    return isModalOpening;
  }

  /**
   * Check if authentication is currently in progress (global session state)
   */
  static isAuthenticationInProgress(): boolean {
    return authenticationInProgress;
  }

  /**
   * Check if we should throttle auth errors (prevent too frequent auth attempts)
   */
  static shouldThrottleAuthError(): boolean {
    const now = Date.now();
    return (now - lastAuthError) < this.MIN_AUTH_ERROR_INTERVAL;
  }

  /**
   * Set modal opening flag with automatic timeout
   */
  private static setModalOpeningFlag(): void {
    isModalOpening = true;
    
    // Clear any existing timeout
    if (modalOpeningTimeout) {
      clearTimeout(modalOpeningTimeout);
    }
    
    // Auto-clear the flag after timeout
    modalOpeningTimeout = setTimeout(() => {
      isModalOpening = false;
      modalOpeningTimeout = null;
    }, this.MODAL_OPENING_TIMEOUT);
  }

  /**
   * Clear modal opening flag
   */
  static clearModalOpeningFlag(): void {
    isModalOpening = false;
    if (modalOpeningTimeout) {
      clearTimeout(modalOpeningTimeout);
      modalOpeningTimeout = null;
    }
  }

  /**
   * Set authentication in progress flag with automatic timeout
   */
  private static setAuthenticationInProgressFlag(): void {
    authenticationInProgress = true;
    lastAuthError = Date.now();
    
    // Clear any existing timeout
    if (authSessionTimeout) {
      clearTimeout(authSessionTimeout);
    }
    
    // Auto-clear the flag after timeout
    authSessionTimeout = setTimeout(() => {
      authenticationInProgress = false;
      authSessionTimeout = null;
    }, this.AUTH_SESSION_TIMEOUT);
  }

  /**
   * Clear authentication in progress flag
   */
  static clearAuthenticationInProgressFlag(): void {
    authenticationInProgress = false;
    if (authSessionTimeout) {
      clearTimeout(authSessionTimeout);
      authSessionTimeout = null;
    }
  }

  /**
   * Check if a redirect is currently in progress
   */
  static isRedirecting(): boolean {
    if (typeof window === 'undefined') return false;
    
    const redirectState = localStorage.getItem(this.REDIRECT_STATE_KEY);
    if (!redirectState) return false;

    try {
      const state: RedirectState = JSON.parse(redirectState);
      const now = Date.now();
      
      // Consider redirect in progress if less than timeout period has passed
      return state.isRedirecting && (now - state.timestamp) < this.REDIRECT_TIMEOUT;
    } catch {
      // If we can't parse the state, assume no redirect in progress
      return false;
    }
  }

  /**
   * Set the redirect flag to prevent multiple simultaneous redirects
   */
  static setRedirectFlag(): void {
    if (typeof window === 'undefined') return;
    
    const redirectState: RedirectState = {
      isRedirecting: true,
      timestamp: Date.now()
    };
    
    try {
      localStorage.setItem(this.REDIRECT_STATE_KEY, JSON.stringify(redirectState));
    } catch (error) {
      // Silently handle localStorage errors
      console.warn('Failed to set redirect flag:', error);
    }
  }

  /**
   * Clear the redirect flag
   */
  static clearRedirectFlag(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(this.REDIRECT_STATE_KEY);
    } catch (error) {
      // Silently handle localStorage errors
      console.warn('Failed to clear redirect flag:', error);
    }
  }

  /**
   * Preserve the current URL for post-login redirect
   */
  static preserveCurrentUrl(): void {
    if (typeof window === 'undefined') return;
    
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    
    // Don't preserve certain URLs (signin, signup, etc.)
    const shouldPreserve = !this.EXCLUDED_PATHS.some(path => currentUrl.startsWith(path));
    
    if (shouldPreserve) {
      try {
        localStorage.setItem(this.PRESERVED_URL_KEY, currentUrl);
        console.log('🔄 AuthRedirect - Preserved URL for post-login redirect:', currentUrl);
      } catch (error) {
        // Silently handle localStorage errors
        console.warn('Failed to preserve URL:', error);
      }
    }
  }

  /**
   * Get the preserved URL
   */
  static getPreservedUrl(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.PRESERVED_URL_KEY);
  }

  /**
   * Clear the preserved URL
   */
  static clearPreservedUrl(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(this.PRESERVED_URL_KEY);
      console.log('🔄 AuthRedirect - Cleared preserved URL');
    } catch (error) {
      // Silently handle localStorage errors
      console.warn('Failed to clear preserved URL:', error);
    }
  }

  /**
   * Show signin modal with optional URL preservation
   */
  static redirectToSignin(preserveUrl: boolean = true): void {
    if (typeof window === 'undefined') return;

    // Check if we're already redirecting to prevent multiple simultaneous redirects
    if (this.isRedirecting()) {
      console.log('🚫 AuthRedirect - Redirect already in progress, skipping');
      return;
    }

    // Check if modal is currently being opened to prevent infinite loops
    if (this.isModalOpening()) {
      console.log('🚫 AuthRedirect - Modal opening already in progress, preventing infinite loop');
      return;
    }

    // Check if authentication is already in progress globally
    if (this.isAuthenticationInProgress()) {
      console.log('🚫 AuthRedirect - Authentication session already in progress, preventing cascade');
      return;
    }

    // Throttle auth errors to prevent rapid-fire attempts
    if (this.shouldThrottleAuthError()) {
      console.log('🚫 AuthRedirect - Auth error throttled, too frequent attempts');
      return;
    }

    // Set all protection flags
    this.setRedirectFlag();
    this.setModalOpeningFlag();
    this.setAuthenticationInProgressFlag();

    // Preserve current URL if requested and not already on auth-related pages
    if (preserveUrl && !this.isAuthRelatedPage()) {
      this.preserveCurrentUrl();
    }

    // Open auth modal instead of redirecting to a page
    if (globalModalOpener) {
      try {
        globalModalOpener('auth', { defaultTab: 'signin' });
        console.log('🔄 AuthRedirect - Opened signin modal');
      } catch (error) {
        console.error('🚫 AuthRedirect - Error opening modal:', error);
        this.clearModalOpeningFlag();
        this.clearAuthenticationInProgressFlag();
        this.handleModalOpeningFallback();
      }
    } else {
      console.warn('🚫 AuthRedirect - Modal opener not set, falling back to page redirect');
      this.clearModalOpeningFlag();
      this.clearAuthenticationInProgressFlag();
      this.handleModalOpeningFallback();
    }
  }

  /**
   * Handle fallback when modal opening fails
   */
  private static handleModalOpeningFallback(): void {
    // Clear the redirect flag since we're not actually redirecting
    this.clearRedirectFlag();
    
    // Don't redirect to home page as it causes infinite loops
    // Instead, just log the issue and let the user manually refresh or navigate
    console.error('🚫 AuthRedirect - Modal opener failed and no fallback available. User needs to manually authenticate.');
  }

  /**
   * Check if current page is auth-related and shouldn't be preserved
   */
  private static isAuthRelatedPage(): boolean {
    if (typeof window === 'undefined') return false;
    
    const currentPath = window.location.pathname;
    return this.EXCLUDED_PATHS.some(path => currentPath.startsWith(path));
  }

  /**
   * Handle successful authentication - clear flags and redirect to preserved URL if available
   */
  static handleSuccessfulAuth(): void {
    // Clear all authentication flags when authentication is successful
    this.clearRedirectFlag();
    this.clearModalOpeningFlag();
    this.clearAuthenticationInProgressFlag();
    
    // Execute any pending requests that were queued during authentication
    this.executePendingRequests();
    
    // Handle post-login redirect if URL was preserved
    const preservedUrl = this.getPreservedUrl();
    if (preservedUrl && typeof window !== 'undefined') {
      this.clearPreservedUrl();
      console.log('🔄 AuthRedirect - Redirecting to preserved URL:', preservedUrl);
      
      // Use a small delay to ensure the modal closes first
      setTimeout(() => {
        window.location.href = preservedUrl;
      }, 100);
    }
  }

  /**
   * Execute pending requests after authentication completes
   */
  private static async executePendingRequests(): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { requestManager } = await import('./request-manager');
      await requestManager.executePendingRequests();
    } catch (error) {
      console.error('Failed to execute pending requests:', error);
    }
  }

  /**
   * Clear all redirect-related data (useful for logout)
   */
  static clearAll(): void {
    this.clearRedirectFlag();
    this.clearPreservedUrl();
    this.clearModalOpeningFlag();
    this.clearAuthenticationInProgressFlag();
    
    // Clear any pending requests
    this.clearPendingRequests('Authentication cleared');
  }

  /**
   * Clear pending requests
   */
  private static async clearPendingRequests(reason: string): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { requestManager } = await import('./request-manager');
      requestManager.clearPendingRequests(reason);
    } catch (error) {
      console.error('Failed to clear pending requests:', error);
    }
  }
}

// Export convenience functions for easier usage
export const {
  isRedirecting,
  setRedirectFlag,
  clearRedirectFlag,
  preserveCurrentUrl,
  getPreservedUrl,
  clearPreservedUrl,
  redirectToSignin,
  handleSuccessfulAuth,
  clearAll: clearAllRedirectData
} = AuthRedirectManager;