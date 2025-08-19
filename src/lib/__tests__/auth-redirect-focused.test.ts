/**
 * Focused tests for AuthRedirectManager functionality
 * Tests URL preservation and redirect prevention logic
 * 
 * Requirements covered:
 * - 2.4: URL preservation for post-login redirect
 * - 2.5: Multiple 403 error handling without duplicate redirects
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

// Mock console methods
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('AuthRedirectManager Focused Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('URL Preservation (Requirement 2.4)', () => {
    it('should preserve and retrieve URLs correctly', () => {
      const testUrl = '/dashboard?tab=overview#section1';
      localStorageMock.setItem('redirectUrl', testUrl);
      
      expect(AuthRedirectManager.getPreservedUrl()).toBe(testUrl);
    });

    it('should clear preserved URLs', () => {
      const testUrl = '/dashboard';
      localStorageMock.setItem('redirectUrl', testUrl);
      
      AuthRedirectManager.clearPreservedUrl();
      expect(AuthRedirectManager.getPreservedUrl()).toBeNull();
    });

    it('should preserve complex URLs with query parameters and fragments', () => {
      const complexUrls = [
        '/dashboard?tab=overview&filter=active#section1',
        '/tokens/search?query=bitcoin&sort=volume&page=2',
        '/portfolio/stats?timeframe=7d&currency=USD#performance'
      ];

      for (const url of complexUrls) {
        localStorageMock.clear();
        
        Object.defineProperty(window, 'location', {
          value: {
            pathname: url.split('?')[0].split('#')[0],
            search: url.includes('?') ? '?' + url.split('?')[1].split('#')[0] : '',
            hash: url.includes('#') ? '#' + url.split('#')[1] : ''
          },
          writable: true
        });

        AuthRedirectManager.preserveCurrentUrl();
        expect(AuthRedirectManager.getPreservedUrl()).toBe(url);
      }
    });

    it('should not preserve excluded paths', () => {
      const excludedPaths = ['/login', '/signup', '/auth/callback', '/oauth/redirect'];

      for (const path of excludedPaths) {
        localStorageMock.clear();
        
        Object.defineProperty(window, 'location', {
          value: {
            pathname: path,
            search: '',
            hash: ''
          },
          writable: true
        });

        AuthRedirectManager.preserveCurrentUrl();
        expect(AuthRedirectManager.getPreservedUrl()).toBeNull();
      }
    });
  });

  describe('Redirect Prevention (Requirement 2.5)', () => {
    it('should detect when redirect is not in progress', () => {
      expect(AuthRedirectManager.isRedirecting()).toBe(false);
    });

    it('should detect when redirect is in progress', () => {
      AuthRedirectManager.setRedirectFlag();
      expect(AuthRedirectManager.isRedirecting()).toBe(true);
    });

    it('should detect when redirect timeout has expired', () => {
      const oldState = {
        isRedirecting: true,
        timestamp: Date.now() - 10000 // 10 seconds ago (timeout is 5000ms)
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

    it('should prevent redirect when already redirecting', () => {
      AuthRedirectManager.setRedirectFlag();
      
      const mockLocation = { href: '', pathname: '/dashboard' };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });
      
      AuthRedirectManager.redirectToSignin(true);
      
      // Should not have changed href since redirect was prevented
      expect(mockLocation.href).toBe('');
    });

    it('should allow redirect when not already redirecting', () => {
      const mockLocation = { href: '', pathname: '/dashboard' };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });
      
      AuthRedirectManager.redirectToSignin(false);
      
      expect(mockLocation.href).toBe('/login');
      expect(AuthRedirectManager.isRedirecting()).toBe(true);
    });

    it('should handle redirect timing boundaries correctly', () => {
      // Test redirect state just before timeout
      const justBeforeTimeout = Date.now() - 4999; // Just under 5 seconds
      const activeState = {
        isRedirecting: true,
        timestamp: justBeforeTimeout
      };
      localStorageMock.setItem('authRedirectState', JSON.stringify(activeState));

      expect(AuthRedirectManager.isRedirecting()).toBe(true);

      // Test redirect state at timeout boundary
      const boundaryTimestamp = Date.now() - 5000; // Exactly 5 seconds ago
      const boundaryState = {
        isRedirecting: true,
        timestamp: boundaryTimestamp
      };
      localStorageMock.setItem('authRedirectState', JSON.stringify(boundaryState));

      expect(AuthRedirectManager.isRedirecting()).toBe(false);
    });
  });

  describe('Successful Authentication Handling', () => {
    it('should handle successful auth with preserved URL', () => {
      AuthRedirectManager.setRedirectFlag();
      const testUrl = '/dashboard?tab=overview';
      localStorageMock.setItem('redirectUrl', testUrl);

      const mockLocation = { href: '' };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });

      AuthRedirectManager.handleSuccessfulAuth();

      expect(AuthRedirectManager.isRedirecting()).toBe(false);
      expect(AuthRedirectManager.getPreservedUrl()).toBeNull();
      expect(mockLocation.href).toBe(testUrl);
    });

    it('should handle successful auth without preserved URL', () => {
      AuthRedirectManager.setRedirectFlag();

      const mockLocation = { href: '' };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });

      AuthRedirectManager.handleSuccessfulAuth();

      expect(AuthRedirectManager.isRedirecting()).toBe(false);
      expect(mockLocation.href).toBe(''); // No redirect
    });
  });

  describe('Complete State Management', () => {
    it('should clear all redirect-related data', () => {
      AuthRedirectManager.setRedirectFlag();
      localStorageMock.setItem('redirectUrl', '/test-url');
      
      expect(AuthRedirectManager.isRedirecting()).toBe(true);
      expect(AuthRedirectManager.getPreservedUrl()).toBe('/test-url');

      AuthRedirectManager.clearAll();

      expect(AuthRedirectManager.isRedirecting()).toBe(false);
      expect(AuthRedirectManager.getPreservedUrl()).toBeNull();
    });
  });

  describe('Server-Side Rendering Compatibility', () => {
    it('should handle undefined window gracefully', () => {
      const originalWindow = global.window;
      
      // Simulate server-side environment
      delete (global as any).window;

      // All methods should handle undefined window gracefully
      expect(AuthRedirectManager.isRedirecting()).toBe(false);
      expect(AuthRedirectManager.getPreservedUrl()).toBeNull();
      
      expect(() => AuthRedirectManager.setRedirectFlag()).not.toThrow();
      expect(() => AuthRedirectManager.clearRedirectFlag()).not.toThrow();
      expect(() => AuthRedirectManager.preserveCurrentUrl()).not.toThrow();
      expect(() => AuthRedirectManager.clearPreservedUrl()).not.toThrow();
      expect(() => AuthRedirectManager.redirectToSignin()).not.toThrow();
      expect(() => AuthRedirectManager.handleSuccessfulAuth()).not.toThrow();
      expect(() => AuthRedirectManager.clearAll()).not.toThrow();

      // Restore window
      global.window = originalWindow;
    });
  });

  describe('URL Validation and Edge Cases', () => {
    it('should handle URLs with special characters', () => {
      const specialCharUrls = [
        '/search?q=bitcoin%20price&sort=desc',
        '/user/profile?name=John%20Doe&email=john%40example.com',
        '/tokens?filter=name%3D%22Bitcoin%22'
      ];

      for (const url of specialCharUrls) {
        localStorageMock.clear();
        
        Object.defineProperty(window, 'location', {
          value: {
            pathname: url.split('?')[0],
            search: url.includes('?') ? '?' + url.split('?')[1] : '',
            hash: ''
          },
          writable: true
        });

        AuthRedirectManager.preserveCurrentUrl();
        expect(AuthRedirectManager.getPreservedUrl()).toBe(url);
      }
    });

    it('should handle extremely long URLs', () => {
      const longUrl = '/dashboard' + '?param=' + 'a'.repeat(1000) + '#section';
      
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/dashboard',
          search: '?param=' + 'a'.repeat(1000),
          hash: '#section'
        },
        writable: true
      });

      AuthRedirectManager.preserveCurrentUrl();
      expect(AuthRedirectManager.getPreservedUrl()).toBe(longUrl);
    });

    it('should handle malformed redirect state gracefully', () => {
      const malformedStates = [
        'invalid json',
        'null'
      ];

      for (const state of malformedStates) {
        localStorageMock.clear();
        localStorageMock.setItem('authRedirectState', state);
        
        // Should handle gracefully and return false
        expect(AuthRedirectManager.isRedirecting()).toBe(false);
      }
    });

    it('should handle incomplete redirect state objects', () => {
      // Test missing timestamp - should return falsy (undefined)
      localStorageMock.setItem('authRedirectState', '{"isRedirecting": true}');
      expect(AuthRedirectManager.isRedirecting()).toBeFalsy();
      
      // Test missing isRedirecting - should return falsy (undefined)
      localStorageMock.setItem('authRedirectState', '{"timestamp": 123}');
      expect(AuthRedirectManager.isRedirecting()).toBeFalsy();
      
      // Test invalid types - should return falsy
      localStorageMock.setItem('authRedirectState', '{"isRedirecting": "not-boolean", "timestamp": "not-number"}');
      expect(AuthRedirectManager.isRedirecting()).toBeFalsy();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent redirect flag operations', () => {
      // Simulate concurrent setRedirectFlag calls
      AuthRedirectManager.setRedirectFlag();
      AuthRedirectManager.setRedirectFlag();
      
      expect(AuthRedirectManager.isRedirecting()).toBe(true);

      // Simulate concurrent clearRedirectFlag calls
      AuthRedirectManager.clearRedirectFlag();
      AuthRedirectManager.clearRedirectFlag();
      
      expect(AuthRedirectManager.isRedirecting()).toBe(false);
    });

    it('should handle concurrent URL preservation operations', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/dashboard',
          search: '?tab=overview',
          hash: '#section1'
        },
        writable: true
      });

      // Simulate concurrent preserve operations
      AuthRedirectManager.preserveCurrentUrl();
      AuthRedirectManager.preserveCurrentUrl();
      
      expect(AuthRedirectManager.getPreservedUrl()).toBe('/dashboard?tab=overview#section1');

      // Simulate concurrent clear operations
      AuthRedirectManager.clearPreservedUrl();
      AuthRedirectManager.clearPreservedUrl();
      
      expect(AuthRedirectManager.getPreservedUrl()).toBeNull();
    });
  });
});