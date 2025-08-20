/**
 * Tests for infinite reload issue fix in auth redirect modal opening
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

describe('AuthRedirectManager - Infinite Loop Prevention', () => {
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

  describe('Modal Opening Prevention', () => {
    it('should prevent multiple modal opens when already opening', () => {
      // First call should succeed
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);
      expect(mockModalOpener).toHaveBeenCalledWith('auth', { defaultTab: 'signin' });

      // Second call should be blocked
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should check isModalOpening flag correctly', () => {
      expect(AuthRedirectManager.isModalOpening()).toBe(false);
      
      AuthRedirectManager.redirectToSignin(true);
      expect(AuthRedirectManager.isModalOpening()).toBe(true);
      
      AuthRedirectManager.clearModalOpeningFlag();
      expect(AuthRedirectManager.isModalOpening()).toBe(false);
    });

    it('should auto-clear modal opening flag after timeout', (done) => {
      AuthRedirectManager.redirectToSignin(true);
      expect(AuthRedirectManager.isModalOpening()).toBe(true);

      // Wait for timeout (2000ms + buffer)
      setTimeout(() => {
        expect(AuthRedirectManager.isModalOpening()).toBe(false);
        done();
      }, 2100);
    });

    it('should clear modal opening flag on successful auth', () => {
      AuthRedirectManager.redirectToSignin(true);
      expect(AuthRedirectManager.isModalOpening()).toBe(true);

      AuthRedirectManager.handleSuccessfulAuth();
      expect(AuthRedirectManager.isModalOpening()).toBe(false);
    });

    it('should clear modal opening flag when clearing all', () => {
      AuthRedirectManager.redirectToSignin(true);
      expect(AuthRedirectManager.isModalOpening()).toBe(true);

      AuthRedirectManager.clearAll();
      expect(AuthRedirectManager.isModalOpening()).toBe(false);
    });
  });

  describe('Fallback Handling', () => {
    it('should handle modal opener errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockModalOpener.mockImplementation(() => {
        throw new Error('Modal opener failed');
      });

      AuthRedirectManager.redirectToSignin(true);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Error opening modal:',
        expect.any(Error)
      );
      expect(AuthRedirectManager.isModalOpening()).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should handle missing modal opener gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      AuthRedirectManager.setModalOpener(null as any);

      AuthRedirectManager.redirectToSignin(true);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Modal opener not set, falling back to page redirect'
      );
      expect(AuthRedirectManager.isModalOpening()).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe('Redirect Prevention', () => {
    it('should prevent redirect when already redirecting', () => {
      // Mock redirect state as active
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        isRedirecting: true,
        timestamp: Date.now()
      }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      AuthRedirectManager.redirectToSignin(true);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Redirect already in progress, skipping'
      );
      expect(mockModalOpener).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should prevent redirect when modal is opening', () => {
      // First call sets modal opening flag
      AuthRedirectManager.redirectToSignin(true);
      expect(mockModalOpener).toHaveBeenCalledTimes(1);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Second call should be prevented
      AuthRedirectManager.redirectToSignin(true);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Modal opening already in progress, preventing infinite loop'
      );
      expect(mockModalOpener).toHaveBeenCalledTimes(1); // Still only called once

      consoleSpy.mockRestore();
    });
  });

  describe('Integration with Redirect State', () => {
    it('should work with existing redirect prevention logic', () => {
      // Set up redirect state
      AuthRedirectManager.redirectToSignin(true);
      
      // Mock localStorage to return redirect state
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

      // Try to redirect again - should be prevented by redirect flag
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      AuthRedirectManager.redirectToSignin(true);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 AuthRedirect - Redirect already in progress, skipping'
      );

      consoleSpy.mockRestore();
    });

    it('should clear both flags on successful auth', () => {
      AuthRedirectManager.redirectToSignin(true);
      
      // Mock localStorage to return redirect state initially
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

      // Mock localStorage to return null after clearing (simulating removeItem)
      localStorageMock.getItem.mockImplementation(() => null);

      AuthRedirectManager.handleSuccessfulAuth();
      expect(AuthRedirectManager.isRedirecting()).toBe(false);
      expect(AuthRedirectManager.isModalOpening()).toBe(false);
    });
  });
});