/**
 * Integration test for auth modal infinite loop prevention
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

describe('Auth Modal Infinite Loop Prevention - Integration', () => {
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

  describe('Complete Flow Prevention', () => {
    it('should prevent infinite loop when multiple 403 errors occur rapidly', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Simulate first 403 error - should open modal
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);
      expect(AuthRedirectManager.isModalOpening()).toBe(true);

      // Simulate second 403 error while modal is opening - should be blocked
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1); // Still only called once
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Modal opening already in progress, preventing infinite loop'
      );

      // Simulate third 403 error - should still be blocked
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1); // Still only called once

      consoleSpy.mockRestore();
    });

    it('should allow modal opening again after successful auth', () => {
      // First modal opening
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);
      expect(AuthRedirectManager.isModalOpening()).toBe(true);

      // Simulate successful authentication
      AuthRedirectManager.handleSuccessfulAuth();
      expect(AuthRedirectManager.isModalOpening()).toBe(false);

      // Should allow new modal opening after successful auth
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(2);
    });

    it('should allow modal opening again after timeout', (done) => {
      // First modal opening
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);
      expect(AuthRedirectManager.isModalOpening()).toBe(true);

      // Wait for timeout (2000ms + buffer)
      setTimeout(() => {
        expect(AuthRedirectManager.isModalOpening()).toBe(false);
        
        // Should allow new modal opening after timeout
        AuthRedirectManager.redirectToSignin(true);
        expect(mockModalOpener).toHaveBeenCalledTimes(2);
        done();
      }, 2100);
    });

    it('should handle modal opener errors gracefully without infinite loops', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Make modal opener throw error
      mockModalOpener.mockImplementation(() => {
        throw new Error('Modal opener failed');
      });

      // Should handle error and clear modal opening flag
      AuthRedirectManager.redirectToSignin(true);
      expect(AuthRedirectManager.isModalOpening()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Error opening modal:',
        expect.any(Error)
      );

      // Should allow retry after error
      mockModalOpener.mockImplementation(() => {}); // Fix the modal opener
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });

  describe('URL Preservation During Loop Prevention', () => {
    it('should preserve URL even when modal opening is blocked', () => {
      // Mock localStorage to return the preserved URL
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'redirectUrl') {
          return '/dashboard';
        }
        return null;
      });

      // First call should preserve URL and open modal
      AuthRedirectManager.redirectToSignin(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'redirectUrl',
        '/dashboard'
      );

      // Second call should be blocked but not interfere with preserved URL
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      AuthRedirectManager.redirectToSignin(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Modal opening already in progress, preventing infinite loop'
      );

      // URL should still be preserved from first call
      expect(AuthRedirectManager.getPreservedUrl()).toBe('/dashboard');

      consoleSpy.mockRestore();
    });
  });

  describe('Redirect State Integration', () => {
    it('should work with existing redirect prevention logic', () => {
      // Set up redirect state to simulate already redirecting
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'authRedirectState') {
          return JSON.stringify({
            isRedirecting: true,
            timestamp: Date.now()
          });
        }
        return null;
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Should be prevented by redirect flag, not modal opening flag
      AuthRedirectManager.redirectToSignin(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Redirect already in progress, skipping'
      );
      expect(mockModalOpener).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup on Success', () => {
    it('should clear all flags when authentication succeeds', () => {
      // Set up both flags
      AuthRedirectManager.redirectToSignin(true);
      
      // Mock localStorage to simulate redirect state
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'authRedirectState') {
          return JSON.stringify({
            isRedirecting: true,
            timestamp: Date.now()
          });
        }
        return null;
      });

      expect(AuthRedirectManager.isRedirecting()).toBe(true);
      expect(AuthRedirectManager.isModalOpening()).toBe(true);

      // Mock localStorage to return null after clearing
      localStorageMock.getItem.mockImplementation(() => null);

      // Handle successful auth should clear both flags
      AuthRedirectManager.handleSuccessfulAuth();
      expect(AuthRedirectManager.isRedirecting()).toBe(false);
      expect(AuthRedirectManager.isModalOpening()).toBe(false);
    });
  });
});