/**
 * Authentication Debug Utility
 * 
 * Provides debugging information for authentication state issues
 */

export class AuthDebug {
  /**
   * Log current authentication state for debugging
   */
  static logAuthState(): void {
    if (typeof window === 'undefined') {
      console.log('🔍 AuthDebug - Running on server side');
      return;
    }

    const token = localStorage.getItem('authToken');
    const hasAuthCookie = document.cookie
      .split(';')
      .some(cookie => cookie.trim().startsWith('isAuth=1'));
    
    const userDataRaw = localStorage.getItem('userData');
    let userData = null;
    try {
      userData = userDataRaw ? JSON.parse(userDataRaw) : null;
    } catch (error) {
      // Ignore parsing errors
    }

    console.log('🔍 AuthDebug - Current authentication state:', {
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 50) + '...' : null,
      hasAuthCookie,
      hasUserData: !!userData,
      userDataPreview: userData ? {
        hasUser: !!userData.state?.user,
        isAuthenticated: userData.state?.isAuthenticated,
        userId: userData.state?.user?.id
      } : null,
      allCookies: document.cookie,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      origin: window.location.origin
    });
  }

  /**
   * Check if authentication state is consistent
   */
  static checkAuthConsistency(): boolean {
    if (typeof window === 'undefined') return true;

    const token = localStorage.getItem('authToken');
    const hasAuthCookie = document.cookie
      .split(';')
      .some(cookie => cookie.trim().startsWith('isAuth=1'));
    
    const isConsistent = (!!token) === hasAuthCookie;
    
    if (!isConsistent) {
      console.warn('⚠️ AuthDebug - Authentication state inconsistency detected:', {
        hasToken: !!token,
        hasAuthCookie,
        recommendation: token ? 'Cookie should be set' : 'Cookie should be cleared'
      });
    }

    return isConsistent;
  }

  /**
   * Force sync authentication state (for debugging)
   */
  static forceSyncAuth(): void {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('authToken');
    
    if (token) {
      // Set cookie
      const isSecure = window.location.protocol === 'https:';
      const maxAge = 60 * 60 * 24 * 30; // 30 days
      let cookieString = `isAuth=1; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
      
      if (isSecure) {
        cookieString += '; Secure';
      }
      
      document.cookie = cookieString;
      console.log('🔧 AuthDebug - Forced auth cookie sync (set)');
    } else {
      // Clear cookie
      document.cookie = 'isAuth=; Path=/; Max-Age=0; SameSite=Lax';
      console.log('🔧 AuthDebug - Forced auth cookie sync (clear)');
    }
  }
}

// Make it available globally for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).AuthDebug = AuthDebug;
}