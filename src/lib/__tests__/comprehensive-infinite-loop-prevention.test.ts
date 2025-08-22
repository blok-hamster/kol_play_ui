/**
 * Comprehensive test for infinite loop prevention in auth system
 */

import { AuthRedirectManager } from '../auth-redirect';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock window.location
const mockLocation = {
  pathname: '/dashboard',
  search: '',
  hash: '',
  href: '',
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('Comprehensive Infinite Loop Prevention', () => {
  let mockModalOpener: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Reset static state
    AuthRedirectManager.clearAll();
    
    // Create fresh mock modal opener
    mockModalOpener = jest.fn();
    AuthRedirectManager.setModalOpener(mockModalOpener);
  });

  afterEach(() => {
    // Clean up any timeouts
    AuthRedirectManager.clearAll();
  });

  describe('Multi-Layer Protection System', () => {
    it('should prevent cascading auth errors with all protection layers', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // First auth error - should open modal and set all flags
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);
      expect(AuthRedirectManager.isRedirecting()).toBe(true);
      expect(AuthRedirectManager.isModalOpening()).toBe(true);
      expect(AuthRedirectManager.isAuthenticationInProgress()).toBe(true);

      // Second auth error - should be blocked by redirect flag
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Redirect already in progress, skipping'
      );

      // Clear redirect flag but keep others
      AuthRedirectManager.clearRedirectFlag();

      // Third auth error - should be blocked by modal opening flag
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Modal opening already in progress, preventing infinite loop'
      );

      // Clear modal opening flag but keep authentication in progress
      AuthRedirectManager.clearModalOpeningFlag();

      // Fourth auth error - should be blocked by authentication in progress flag
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Authentication session already in progress, preventing cascade'
      );

      consoleSpy.mockRestore();
    });

    it('should throttle rapid auth errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // First auth error
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);

      // Clear all flags to test throttling specifically
      AuthRedirectManager.clearAll();

      // Immediate second auth error - should be throttled
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Auth error throttled, too frequent attempts'
      );

      consoleSpy.mockRestore();
    });

    it('should allow auth after timeout periods', (done) => {
      // First auth error
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);
      expect(AuthRedirectManager.isAuthenticationInProgress()).toBe(true);

      // Wait for authentication timeout (30 seconds + buffer)
      setTimeout(() => {
        expect(AuthRedirectManager.isAuthenticationInProgress()).toBe(false);
        
        // Should allow new auth attempt after timeout
        AuthRedirectManager.redirectToSignin(true);
        expect(mockModalOpener).toHaveBeenCalledTimes(2);
        done();
      }, 30100);
    }, 35000);
  });

  describe('Comprehensive Flag Management', () => {
    it('should clear all flags on successful authentication', () => {
      // Set up all flags
      AuthRedirectManager.redirectToSignin(true);
      expect(AuthRedirectManager.isRedirecting()).toBe(true);
      expect(AuthRedirectManager.isModalOpening()).toBe(true);
      expect(AuthRedirectManager.isAuthenticationInProgress()).toBe(true);

      // Handle successful auth should clear all flags
      AuthRedirectManager.handleSuccessfulAuth();
      expect(AuthRedirectManager.isRedirecting()).toBe(false);
      expect(AuthRedirectManager.isModalOpening()).toBe(false);
      expect(AuthRedirectManager.isAuthenticationInProgress()).toBe(false);
    });

    it('should clear all flags when clearing all', () => {
      // Set up all flags
      AuthRedirectManager.redirectToSignin(true);
      expect(AuthRedirectManager.isRedirecting()).toBe(true);
      expect(AuthRedirectManager.isModalOpening()).toBe(true);
      expect(AuthRedirectManager.isAuthenticationInProgress()).toBe(true);

      // Clear all should clear all flags
      AuthRedirectManager.clearAll();
      expect(AuthRedirectManager.isRedirecting()).toBe(false);
      expect(AuthRedirectManager.isModalOpening()).toBe(false);
      expect(AuthRedirectManager.isAuthenticationInProgress()).toBe(false);
    });

    it('should handle modal opener errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Make modal opener throw error
      mockModalOpener.mockImplementation(() => {
        throw new Error('Modal opener failed');
      });

      // Should handle error and clear flags
      AuthRedirectManager.redirectToSignin(true);
      expect(AuthRedirectManager.isModalOpening()).toBe(false);
      expect(AuthRedirectManager.isAuthenticationInProgress()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Error opening modal:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Background Request Simulation', () => {
    it('should prevent infinite loops from rapid background 403 errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Simulate rapid background requests triggering 403 errors
      for (let i = 0; i < 10; i++) {
        AuthRedirectManager.redirectToSignin(true);
      }

      // Should only open modal once
      expect(mockModalOpener).toHaveBeenCalledTimes(1);
      
      // Should have logged prevention messages
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Redirect already in progress, skipping'
      );

      consoleSpy.mockRestore();
    });

    it('should handle websocket and polling auth errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Simulate websocket auth error
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);

      // Simulate polling auth error while websocket auth is in progress
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);

      // Simulate API call auth error while others are in progress
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);

      // Should have prevented multiple modal opens
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Redirect already in progress, skipping'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Recovery Scenarios', () => {
    it('should recover from stuck authentication state', (done) => {
      // Simulate authentication getting stuck
      AuthRedirectManager.redirectToSignin(true);
      expect(AuthRedirectManager.isAuthenticationInProgress()).toBe(true);

      // Wait for automatic timeout recovery
      setTimeout(() => {
        expect(AuthRedirectManager.isAuthenticationInProgress()).toBe(false);
        
        // Should allow new authentication attempt
        AuthRedirectManager.redirectToSignin(true);
        expect(mockModalOpener).toHaveBeenCalledTimes(2);
        done();
      }, 30100);
    }, 35000);

    it('should handle manual flag clearing', () => {
      // Set up authentication in progress
      AuthRedirectManager.redirectToSignin(true);
      expect(AuthRedirectManager.isAuthenticationInProgress()).toBe(true);

      // Manual flag clearing should work
      AuthRedirectManager.clearAuthenticationInProgressFlag();
      expect(AuthRedirectManager.isAuthenticationInProgress()).toBe(false);

      // Should allow new authentication attempt
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(2);
    });
  });
});