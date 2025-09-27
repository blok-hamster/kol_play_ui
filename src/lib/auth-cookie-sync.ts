/**
 * Auth Cookie Synchronization Utility
 * 
 * Ensures the auth cookie is properly set when localStorage contains a valid token.
 * This fixes the issue where users are asked to sign up again after page reload in production.
 */

export class AuthCookieSync {
  private static readonly COOKIE_NAME = 'isAuth';
  private static readonly TOKEN_KEY = 'authToken';
  
  /**
   * Synchronize auth cookie with localStorage token
   * Should be called early in the app lifecycle
   */
  static syncAuthCookie(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);
      const hasAuthCookie = this.hasAuthCookie();
      
      if (token && !hasAuthCookie) {
        void 0 && ('🔄 AuthCookieSync - Token found but cookie missing, setting cookie');
        this.setAuthCookie();
      } else if (!token && hasAuthCookie) {
        void 0 && ('🔄 AuthCookieSync - Cookie found but token missing, clearing cookie');
        this.clearAuthCookie();
      }
    } catch (error) {
      void 0 && ('⚠️ AuthCookieSync - Error during sync:', error);
    }
  }
  
  /**
   * Set auth cookie (public method for API client)
   */
  static setAuthCookie(): void {
    this.setAuthCookieInternal();
  }
  
  /**
   * Clear auth cookie (public method for API client)
   */
  static clearAuthCookie(): void {
    this.clearAuthCookieInternal();
  }
  
  /**
   * Check if auth cookie exists
   */
  private static hasAuthCookie(): boolean {
    if (typeof document === 'undefined') return false;
    
    return document.cookie
      .split(';')
      .some(cookie => cookie.trim().startsWith(`${this.COOKIE_NAME}=1`));
  }
  
  /**
   * Set auth cookie (internal implementation)
   */
  private static setAuthCookieInternal(): void {
    if (typeof document === 'undefined') return;
    
    try {
      const isSecure = window.location.protocol === 'https:';
      const maxAge = 60 * 60 * 24 * 30; // 30 days
      
      let cookieString = `${this.COOKIE_NAME}=1; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
      
      if (isSecure) {
        cookieString += '; Secure';
      }
      
      document.cookie = cookieString;
      void 0 && ('🔑 AuthCookieSync - Auth cookie set:', cookieString);
    } catch (error) {
      void 0 && ('⚠️ AuthCookieSync - Failed to set auth cookie:', error);
    }
  }
  
  /**
   * Clear auth cookie (internal implementation)
   */
  private static clearAuthCookieInternal(): void {
    if (typeof document === 'undefined') return;
    
    try {
      document.cookie = `${this.COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
      void 0 && ('🔑 AuthCookieSync - Auth cookie cleared');
    } catch (error) {
      void 0 && ('⚠️ AuthCookieSync - Failed to clear auth cookie:', error);
    }
  }
}