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

export class AuthRedirectManager {
  private static readonly REDIRECT_STATE_KEY = 'authRedirectState';
  private static readonly PRESERVED_URL_KEY = 'redirectUrl';
  private static readonly REDIRECT_TIMEOUT = 5000; // 5 seconds
  private static readonly MODAL_OPENING_TIMEOUT = 2000; // 2 seconds to prevent rapid modal opening
  private static readonly EXCLUDED_PATHS = ['/login', '/signup', '/auth', '/oauth'];

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

    // Set redirect flag to prevent multiple redirects
    this.setRedirectFlag();

    // Set modal opening flag to prevent circular API calls
    this.setModalOpeningFlag();

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
        this.handleModalOpeningFallback();
      }
    } else {
      console.warn('🚫 AuthRedirect - Modal opener not set, falling back to page redirect');
      this.clearModalOpeningFlag();
      this.handleModalOpeningFallback();
    }
  }

  /**
   * Handle fallback when modal opening fails
   */
  private static handleModalOpeningFallback(): void {
    // Clear the redirect flag since we're not actually redirecting
    this.clearRedirectFlag();
    
    // Fallback to page redirect if modal opener is not available
    // Use a small delay to prevent immediate API calls
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }, 100);
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
    // Clear redirect flag when authentication is successful
    this.clearRedirectFlag();
    
    // Clear modal opening flag when authentication is successful
    this.clearModalOpeningFlag();
    
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
   * Clear all redirect-related data (useful for logout)
   */
  static clearAll(): void {
    this.clearRedirectFlag();
    this.clearPreservedUrl();
    this.clearModalOpeningFlag();
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