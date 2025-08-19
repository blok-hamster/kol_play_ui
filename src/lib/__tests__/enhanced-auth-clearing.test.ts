/**
 * Tests for enhanced authentication state clearing
 * Verifies that authentication failures properly clear all auth-related data
 */

import apiClient from '../api';

// Mock localStorage and sessionStorage
const mockLocalStorage = {
  data: {} as Record<string, string>,
  getItem: jest.fn((key: string) => mockLocalStorage.data[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.data[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockLocalStorage.data[key];
  }),
  clear: jest.fn(() => {
    mockLocalStorage.data = {};
  }),
};

const mockSessionStorage = {
  data: {} as Record<string, string>,
  getItem: jest.fn((key: string) => mockSessionStorage.data[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockSessionStorage.data[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockSessionStorage.data[key];
  }),
  clear: jest.fn(() => {
    mockSessionStorage.data = {};
  }),
};

// Mock document.cookie
const mockCookies: string[] = [];
Object.defineProperty(document, 'cookie', {
  get: () => mockCookies.join('; '),
  set: (value: string) => {
    if (value.includes('Max-Age=0')) {
      // Remove cookie
      const cookieName = value.split('=')[0];
      const index = mockCookies.findIndex(cookie => cookie.startsWith(cookieName));
      if (index !== -1) {
        mockCookies.splice(index, 1);
      }
    } else {
      // Add cookie
      mockCookies.push(value);
    }
  },
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost',
    href: '',
    pathname: '/test',
    search: '',
    hash: '',
  },
  writable: true,
});

describe('Enhanced Authentication State Clearing', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockLocalStorage.data = {};
    mockSessionStorage.data = {};
    mockCookies.length = 0;
    
    // Setup global mocks
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    
    Object.defineProperty(global, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
    });
  });

  describe('API Client Enhanced Token Clearing', () => {
    it('should clear token and additional auth cookies for authentication failures', () => {
      // Setup initial state
      mockLocalStorage.data['authToken'] = 'test-token';
      mockCookies.push('isAuth=1');
      mockCookies.push('authToken=test-token');
      mockCookies.push('refreshToken=refresh-token');

      // Call enhanced token clearing
      apiClient.clearTokenForAuthFailure();

      // Verify localStorage clearing
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');

      // Verify cookies are cleared (document.cookie setter is called)
      expect(mockCookies.length).toBe(0);
    });

    it('should clear comprehensive authentication state', () => {
      // Setup initial state with various auth-related data
      mockLocalStorage.data['authToken'] = 'test-token';
      mockLocalStorage.data['user-data'] = '{"user": "test"}';
      mockLocalStorage.data['wallet-auth-data'] = '{"wallet": "test"}';
      mockSessionStorage.data['authToken'] = 'session-token';
      mockSessionStorage.data['user-session'] = '{"session": "test"}';

      // Access private method through reflection for testing
      const clearAuthState = (apiClient as any).clearAuthenticationState.bind(apiClient);
      clearAuthState();

      // Verify localStorage keys are removed
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user-data');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('wallet-auth-data');

      // Verify sessionStorage keys are removed
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user-session');
    });
  });

  describe('Enhanced Clearing Methods', () => {
    it('should have clearTokenForAuthFailure method available', () => {
      expect(typeof apiClient.clearTokenForAuthFailure).toBe('function');
    });

    it('should clear token and additional auth cookies for authentication failures', () => {
      // Setup initial state
      mockLocalStorage.data['authToken'] = 'test-token';
      mockCookies.push('isAuth=1');
      mockCookies.push('authToken=test-token');
      mockCookies.push('refreshToken=refresh-token');

      // Call enhanced token clearing
      apiClient.clearTokenForAuthFailure();

      // Verify localStorage clearing
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');

      // Verify cookies are cleared (document.cookie setter is called)
      expect(mockCookies.length).toBe(0);
    });
  });

  describe('Integration with 403 Error Handling', () => {
    it('should handle 403 errors with comprehensive state clearing', async () => {
      // Setup initial authenticated state
      mockLocalStorage.data['authToken'] = 'test-token';
      mockLocalStorage.data['user-data'] = '{"user": "test"}';

      // Mock axios to return 403 error
      const mockAxiosError = {
        response: {
          status: 403,
          data: { message: 'Forbidden' }
        }
      };

      // Spy on the private method
      const clearAuthStateSpy = jest.spyOn(apiClient as any, 'clearAuthenticationState');

      // Simulate 403 error handling
      try {
        // This would normally be triggered by the response interceptor
        (apiClient as any).handleAuthenticationError();
      } catch (error) {
        // Expected to redirect, which might throw in test environment
      }

      // Verify comprehensive clearing was called
      expect(clearAuthStateSpy).toHaveBeenCalled();
    });

    it('should handle access denied messages with comprehensive state clearing', async () => {
      // Setup initial authenticated state
      mockLocalStorage.data['authToken'] = 'test-token';

      // Mock response with access denied message
      const mockResponse = {
        data: {
          message: 'Access denied - insufficient permissions'
        }
      };

      // Test access denied detection
      const isAccessDenied = (apiClient as any).isAccessDeniedResponse(mockResponse.data);
      expect(isAccessDenied).toBe(true);

      // Spy on the private method
      const clearAuthStateSpy = jest.spyOn(apiClient as any, 'clearAuthenticationState');

      // Simulate access denied handling
      try {
        (apiClient as any).handleAuthenticationError();
      } catch (error) {
        // Expected to redirect, which might throw in test environment
      }

      // Verify comprehensive clearing was called
      expect(clearAuthStateSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling Robustness', () => {
    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw errors
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw when clearing fails
      expect(() => {
        apiClient.clearTokenForAuthFailure();
      }).not.toThrow();
    });

    it('should handle sessionStorage errors gracefully', () => {
      // Mock sessionStorage to throw errors
      mockSessionStorage.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw when clearing fails
      expect(() => {
        const clearAuthState = (apiClient as any).clearAuthenticationState.bind(apiClient);
        clearAuthState();
      }).not.toThrow();
    });
  });
});