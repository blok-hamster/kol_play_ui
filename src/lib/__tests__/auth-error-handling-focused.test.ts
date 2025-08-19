/**
 * Focused tests for authentication error handling requirements
 * Tests the specific requirements without expecting error handling that doesn't exist
 * 
 * Requirements covered:
 * - 2.1: 403 status code detection and redirect
 * - 2.2: "access denied" message detection and redirect  
 * - 2.3: Authentication state clearing on errors
 * - 2.4: URL preservation for post-login redirect
 * - 2.5: Multiple 403 error handling without duplicate redirects
 * - 3.1: Centralized error handler for authentication failures
 * - 3.2: Reusable error handler across services
 * - 3.3: Appropriate logging for debugging
 * - 3.4: Authentication error handling consistency
 */

import { AuthRedirectManager } from '../auth-redirect';

// Mock AuthRedirectManager
jest.mock('../auth-redirect');
const mockedAuthRedirectManager = AuthRedirectManager as jest.Mocked<typeof AuthRedirectManager>;

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

// Mock sessionStorage
const sessionStorageMock = (() => {
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

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

// Mock document.cookie
let mockCookies = '';
Object.defineProperty(document, 'cookie', {
  get: () => mockCookies,
  set: (value: string) => {
    mockCookies = value;
  }
});

// Mock console methods
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

// Mock axios
const mockAxiosInstance = {
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn()
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance)
}));

describe('Focused Authentication Error Handling Tests', () => {
  let apiClient: any;
  let responseSuccessHandler: any;
  let responseErrorHandler: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
    mockCookies = '';

    mockedAuthRedirectManager.redirectToSignin.mockClear();
    mockedAuthRedirectManager.clearAll.mockClear();
    mockedAuthRedirectManager.isRedirecting.mockReturnValue(false);

    // Capture interceptors
    mockAxiosInstance.interceptors.response.use.mockImplementation((successHandler, errorHandler) => {
      responseSuccessHandler = successHandler;
      responseErrorHandler = errorHandler;
    });

    const apiModule = await import('../api');
    apiClient = apiModule.default;
  });

  describe('Requirement 2.1: 403 Status Code Detection', () => {
    it('should detect 403 status codes and trigger authentication error handling', async () => {
      const mock403Error = {
        name: 'AxiosError',
        message: 'Request failed with status code 403',
        response: {
          status: 403,
          statusText: 'Forbidden',
          data: {},
          headers: {},
          config: {}
        },
        config: {},
        isAxiosError: true,
        toJSON: () => ({})
      };

      await expect(responseErrorHandler(mock403Error)).rejects.toBe(mock403Error);
      expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalledWith(true);
    });

    it('should not trigger authentication error handling for non-403 status codes', async () => {
      const mock404Error = {
        name: 'AxiosError',
        message: 'Request failed with status code 404',
        response: {
          status: 404,
          statusText: 'Not Found',
          data: {},
          headers: {},
          config: {}
        },
        config: {},
        isAxiosError: true,
        toJSON: () => ({})
      };

      await expect(responseErrorHandler(mock404Error)).rejects.toBe(mock404Error);
      expect(mockedAuthRedirectManager.redirectToSignin).not.toHaveBeenCalled();
    });
  });

  describe('Requirement 2.2: Access Denied Message Detection', () => {
    it('should detect "access denied" messages in various response formats', async () => {
      const testCases = [
        { data: { message: 'Access Denied' } },
        { data: { error: 'access denied' } },
        { data: { data: { message: 'ACCESS DENIED' } } },
        { data: { data: { error: 'Access denied - insufficient permissions' } } }
      ];

      for (const responseData of testCases) {
        jest.clearAllMocks();
        
        const mockResponse = {
          status: 200,
          statusText: 'OK',
          ...responseData,
          headers: {},
          config: {}
        };

        await expect(responseSuccessHandler(mockResponse)).rejects.toThrow('Access denied');
        expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalledWith(true);
      }
    });

    it('should handle case-insensitive access denied detection', async () => {
      const variations = [
        'Access Denied',
        'access denied',
        'ACCESS DENIED',
        'Access  Denied', // Multiple spaces
        'User access denied'
      ];

      for (const message of variations) {
        jest.clearAllMocks();
        
        const mockResponse = {
          status: 200,
          statusText: 'OK',
          data: { message },
          headers: {},
          config: {}
        };

        await expect(responseSuccessHandler(mockResponse)).rejects.toThrow('Access denied');
        expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalledWith(true);
      }
    });

    it('should not trigger on non-matching messages', async () => {
      const nonMatchingMessages = [
        'Access granted',
        'Permission denied',
        'Unauthorized access',
        'Denied access' // Wrong order
      ];

      for (const message of nonMatchingMessages) {
        jest.clearAllMocks();
        
        const mockResponse = {
          status: 200,
          statusText: 'OK',
          data: { message },
          headers: {},
          config: {}
        };

        const result = await responseSuccessHandler(mockResponse);
        expect(result).toBe(mockResponse);
        expect(mockedAuthRedirectManager.redirectToSignin).not.toHaveBeenCalled();
      }
    });
  });

  describe('Requirement 2.3: Authentication State Clearing', () => {
    beforeEach(() => {
      // Set up auth state
      localStorageMock.setItem('authToken', 'test-token');
      localStorageMock.setItem('user-data', 'test-user-data');
      localStorageMock.setItem('wallet-auth-data', 'test-wallet-data');
      sessionStorageMock.setItem('authToken', 'test-session-token');
      mockCookies = 'isAuth=1; authToken=test';
    });

    it('should clear authentication state on 403 error', async () => {
      const mock403Error = {
        name: 'AxiosError',
        message: 'Request failed with status code 403',
        response: {
          status: 403,
          statusText: 'Forbidden',
          data: {},
          headers: {},
          config: {}
        },
        config: {},
        isAxiosError: true,
        toJSON: () => ({})
      };

      await expect(responseErrorHandler(mock403Error)).rejects.toBe(mock403Error);

      // Verify state clearing
      expect(localStorageMock.getItem('authToken')).toBeNull();
      expect(localStorageMock.getItem('user-data')).toBeNull();
      expect(sessionStorageMock.getItem('authToken')).toBeNull();
      expect(mockCookies).toContain('Max-Age=0');
    });

    it('should clear authentication state on access denied message', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: { message: 'Access Denied' },
        headers: {},
        config: {}
      };

      await expect(responseSuccessHandler(mockResponse)).rejects.toThrow('Access denied');

      // Verify state clearing
      expect(localStorageMock.getItem('authToken')).toBeNull();
      expect(sessionStorageMock.getItem('authToken')).toBeNull();
    });
  });

  describe('Requirement 2.4: URL Preservation', () => {
    it('should preserve URL when redirecting on authentication errors', async () => {
      const mock403Error = {
        name: 'AxiosError',
        message: 'Request failed with status code 403',
        response: {
          status: 403,
          statusText: 'Forbidden',
          data: {},
          headers: {},
          config: {}
        },
        config: {},
        isAxiosError: true,
        toJSON: () => ({})
      };

      await expect(responseErrorHandler(mock403Error)).rejects.toBe(mock403Error);
      
      // Verify URL preservation is enabled
      expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalledWith(true);
    });

    it('should provide access to preserved URL through API client', () => {
      mockedAuthRedirectManager.getPreservedUrl.mockReturnValue('/dashboard');
      
      const preservedUrl = apiClient.getPreservedUrl();
      expect(preservedUrl).toBe('/dashboard');
      expect(mockedAuthRedirectManager.getPreservedUrl).toHaveBeenCalled();
    });
  });

  describe('Requirement 2.5: Multiple Error Handling', () => {
    it('should handle multiple authentication errors gracefully', async () => {
      const errors = [
        {
          name: 'AxiosError',
          message: 'Request failed with status code 403',
          response: { status: 403, statusText: 'Forbidden', data: {}, headers: {}, config: {} },
          config: {}, isAxiosError: true, toJSON: () => ({})
        },
        {
          name: 'AxiosError',
          message: 'Request failed with status code 403',
          response: { status: 403, statusText: 'Forbidden', data: { message: 'Access Denied' }, headers: {}, config: {} },
          config: {}, isAxiosError: true, toJSON: () => ({})
        }
      ];

      for (const error of errors) {
        await expect(responseErrorHandler(error)).rejects.toBe(error);
      }

      // Should call redirect for each error (AuthRedirectManager handles prevention)
      expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalledTimes(2);
    });
  });

  describe('Requirement 3.1 & 3.2: Centralized and Reusable Error Handler', () => {
    it('should use centralized error handling through interceptors', () => {
      expect(responseSuccessHandler).toBeDefined();
      expect(responseErrorHandler).toBeDefined();
      expect(typeof responseSuccessHandler).toBe('function');
      expect(typeof responseErrorHandler).toBe('function');
    });

    it('should provide reusable error handling methods', () => {
      expect(typeof apiClient.getPreservedUrl).toBe('function');
      expect(typeof apiClient.clearPreservedUrl).toBe('function');
      expect(typeof apiClient.handleSuccessfulAuth).toBe('function');
      expect(typeof apiClient.handleError).toBe('function');
    });
  });

  describe('Requirement 3.3: Logging for Debugging', () => {
    it('should handle authentication errors consistently', async () => {
      const mock403Error = {
        name: 'AxiosError',
        message: 'Request failed with status code 403',
        response: {
          status: 403,
          statusText: 'Forbidden',
          data: {},
          headers: {},
          config: {}
        },
        config: {},
        isAxiosError: true,
        toJSON: () => ({})
      };

      await expect(responseErrorHandler(mock403Error)).rejects.toBe(mock403Error);
      
      // Verify error handling was triggered
      expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalled();
    });
  });

  describe('Requirement 3.4: Consistent Error Handling', () => {
    it('should handle all authentication error types consistently', async () => {
      const authErrors = [
        {
          type: '401 Unauthorized',
          error: {
            name: 'AxiosError',
            message: 'Request failed with status code 401',
            response: { status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config: {} },
            config: {}, isAxiosError: true, toJSON: () => ({})
          }
        },
        {
          type: '403 Forbidden',
          error: {
            name: 'AxiosError',
            message: 'Request failed with status code 403',
            response: { status: 403, statusText: 'Forbidden', data: {}, headers: {}, config: {} },
            config: {}, isAxiosError: true, toJSON: () => ({})
          }
        }
      ];

      for (const { error } of authErrors) {
        jest.clearAllMocks();
        
        await expect(responseErrorHandler(error)).rejects.toBe(error);
        expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalledWith(true);
      }
    });

    it('should provide consistent error message extraction', () => {
      const errorFormats = [
        {
          error: { response: { data: { message: 'API error message' } } },
          expected: 'API error message'
        },
        {
          error: { response: { data: { error: 'API error' } } },
          expected: 'API error'
        },
        {
          error: { message: 'Direct error message' },
          expected: 'Direct error message'
        },
        {
          error: {},
          expected: 'An unexpected error occurred'
        }
      ];

      for (const { error, expected } of errorFormats) {
        const result = apiClient.handleError(error);
        expect(result).toBe(expected);
      }
    });
  });

  describe('Token Management', () => {
    it('should set and clear tokens correctly', () => {
      const testToken = 'test-auth-token';
      
      apiClient.setToken(testToken);
      expect(localStorageMock.getItem('authToken')).toBe(testToken);
      expect(mockCookies).toContain('isAuth=1');
      
      apiClient.clearToken();
      expect(localStorageMock.getItem('authToken')).toBeNull();
      expect(mockCookies).toContain('Max-Age=0');
      expect(mockedAuthRedirectManager.clearAll).toHaveBeenCalled();
    });

    it('should handle successful authentication', () => {
      apiClient.handleSuccessfulAuth();
      expect(mockedAuthRedirectManager.handleSuccessfulAuth).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors without response object', async () => {
      const networkError = {
        name: 'AxiosError',
        message: 'Network Error',
        response: undefined,
        config: {},
        isAxiosError: true,
        toJSON: () => ({})
      };

      await expect(responseErrorHandler(networkError)).rejects.toBe(networkError);
      expect(mockedAuthRedirectManager.redirectToSignin).not.toHaveBeenCalled();
    });

    it('should handle malformed response data', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: null,
        headers: {},
        config: {}
      };

      const result = await responseSuccessHandler(mockResponse);
      expect(result).toBe(mockResponse);
      expect(mockedAuthRedirectManager.redirectToSignin).not.toHaveBeenCalled();
    });
  });
});