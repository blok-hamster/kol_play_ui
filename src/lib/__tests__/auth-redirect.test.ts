/**
 * Tests for AuthRedirectManager
 */

import { AuthRedirectManager } from '../auth-redirect';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock console.log to avoid test output noise
jest.spyOn(console, 'log').mockImplementation(() => {});

describe('AuthRedirectManager', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('localStorage management', () => {
    it('should store and retrieve preserved URL', () => {
      const testUrl = '/dashboard?tab=overview#section1';
      localStorageMock.setItem('redirectUrl', testUrl);
      
      const preservedUrl = AuthRedirectManager.getPreservedUrl();
      expect(preservedUrl).toBe(testUrl);
    });

    it('should clear preserved URL', () => {
      const testUrl = '/dashboard?tab=overview#section1';
      localStorageMock.setItem('redirectUrl', testUrl);
      expect(AuthRedirectManager.getPreservedUrl()).toBe(testUrl);
      
      AuthRedirectManager.clearPreservedUrl();
      expect(AuthRedirectManager.getPreservedUrl()).toBeNull();
    });

    it('should return null when no URL is preserved', () => {
      const preservedUrl = AuthRedirectManager.getPreservedUrl();
      expect(preservedUrl).toBeNull();
    });
  });

  describe('redirect prevention', () => {
    it('should detect when redirect is not in progress', () => {
      expect(AuthRedirectManager.isRedirecting()).toBe(false);
    });

    it('should detect when redirect is in progress', () => {
      AuthRedirectManager.setRedirectFlag();
      expect(AuthRedirectManager.isRedirecting()).toBe(true);
    });

    it('should detect when redirect timeout has expired', () => {
      // Manually set an old timestamp
      const oldState = {
        isRedirecting: true,
        timestamp: Date.now() - 10000 // 10 seconds ago
      };
      localStorageMock.setItem('authRedirectState', JSON.stringify(oldState));
      
      expect(AuthRedirectManager.isRedirecting()).toBe(false);
    });

    it('should clear redirect flag', () => {
      AuthRedirectManager.setRedirectFlag();
      expect(AuthRedirectManager.isRedirecting()).toBe(true);
      
      AuthRedirectManager.clearRedirectFlag();
      expect(AuthRedirectManager.isRedirecting()).toBe(false);
    });
  });

  describe('redirect prevention logic', () => {
    it('should prevent redirect when already redirecting', () => {
      AuthRedirectManager.setRedirectFlag();
      
      // Mock window.location to track if redirect was attempted
      const mockLocation = { href: '' };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });
      
      AuthRedirectManager.redirectToSignin(true);
      
      // Should not have changed href since redirect was prevented
      expect(mockLocation.href).toBe('');
    });

    it('should allow redirect when not already redirecting', () => {
      // Mock window.location to track redirect
      const mockLocation = { 
        href: '',
        pathname: '/dashboard'
      };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });
      
      AuthRedirectManager.redirectToSignin(false);
      
      expect(mockLocation.href).toBe('/login');
      expect(AuthRedirectManager.isRedirecting()).toBe(true);
    });
  });

  describe('handleSuccessfulAuth', () => {
    it('should clear redirect flag and redirect to preserved URL', () => {
      // Set up initial state
      AuthRedirectManager.setRedirectFlag();
      const testUrl = '/dashboard?tab=overview';
      localStorageMock.setItem('redirectUrl', testUrl);
      
      expect(AuthRedirectManager.isRedirecting()).toBe(true);
      expect(AuthRedirectManager.getPreservedUrl()).toBe(testUrl);
      
      // Mock window.location to track redirect
      const mockLocation = { href: '' };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });
      
      // Handle successful auth
      AuthRedirectManager.handleSuccessfulAuth();
      
      expect(AuthRedirectManager.isRedirecting()).toBe(false);
      expect(AuthRedirectManager.getPreservedUrl()).toBeNull();
      expect(mockLocation.href).toBe(testUrl);
    });

    it('should only clear redirect flag when no preserved URL', () => {
      AuthRedirectManager.setRedirectFlag();
      
      expect(AuthRedirectManager.isRedirecting()).toBe(true);
      
      // Mock window.location to track redirect
      const mockLocation = { href: '' };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });
      
      AuthRedirectManager.handleSuccessfulAuth();
      
      expect(AuthRedirectManager.isRedirecting()).toBe(false);
      expect(mockLocation.href).toBe(''); // No redirect occurred
    });
  });

  describe('clearAll', () => {
    it('should clear all redirect-related data', () => {
      AuthRedirectManager.setRedirectFlag();
      const testUrl = '/dashboard';
      localStorageMock.setItem('redirectUrl', testUrl);
      
      expect(AuthRedirectManager.isRedirecting()).toBe(true);
      expect(AuthRedirectManager.getPreservedUrl()).toBe(testUrl);
      
      AuthRedirectManager.clearAll();
      
      expect(AuthRedirectManager.isRedirecting()).toBe(false);
      expect(AuthRedirectManager.getPreservedUrl()).toBeNull();
    });
  });
});