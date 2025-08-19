/**
 * Comprehensive error handling tests for API client
 * Tests 403 status code detection, access denied message detection,
 * URL preservation, redirect prevention, and authentication state clearing
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

// Mock console methods to avoid test output noise
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

// Mock axios with proper interceptor handling
const mockAxiosInstance = {
  interceptors: {
    request: {
      use: jest.fn()
    },
    response: {
      use: jest.fn()
    }
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

describe('API Client Error Handling', () => {
  let apiClient: any;
  let responseSuccessHandler: any;
  let responseErrorHandler: any;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
    mockCookies = '';

    // Reset AuthRedirectManager mocks
    mockedAuthRedirectManager.redirectToSignin.mockClear();
    mockedAuthRedirectManager.clearAll.mockClear();

    // Capture the interceptors when they're set up
    mockAxiosInstance.interceptors.response.use.mockImplementation((successHandler, errorHandler) => {
      responseSuccessHandler = successHandler;
      responseErrorHandler = errorHandler;
    });

    // Import the API client to trigger interceptor setup
    const apiModule = await import('../api');
    apiClient = apiModule.default;
  });

  describe('Access Denied Message Detection', () => {
    it('should detect "access denied" in response.data.message (case-insensitive)', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: { message: 'Access Denied' },
        headers: {},
        config: {}
      };

      await expect(responseSuccessHandler(mockResponse)).rejects.toThrow('Access denied');
      expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalledWith(true);
    });

    it('should detect "access denied" in response.data.error', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: { error: 'access denied' },
        headers: {},
        config: {}
      };

      await expect(responseSuccessHandler(mockResponse)).rejects.toThrow('Access denied');
      expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalledWith(true);
    });

    it('should detect "access denied" in nested response.data.data.message', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: { 
          data: { message: 'ACCESS DENIED' }
        },
        headers: {},
        config: {}
      };

      await expect(responseSuccessHandler(mockResponse)).rejects.toThrow('Access denied');
      expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalledWith(true);
    });

    it('should detect "access denied" in nested response.data.data.error', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: { 
          data: { error: 'Access Denied - insufficient permissions' }
        },
        headers: {},
        config: {}
      };

      await expect(responseSuccessHandler(mockResponse)).rejects.toThrow('Access denied');
      expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalledWith(true);
    });

    it('should handle variations of "access denied" message', async () => {
      const variations = [
        'Access Denied',
        'access denied',
        'ACCESS DENIED',
        'Access  Denied', // Multiple spaces
        'access    denied',
        'User access denied',
        'Access denied - insufficient permissions'
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

    it('should not trigger on similar but different messages', async () => {
      const nonMatchingMessages = [
        'Access granted',
        'Denied access', // Wrong order
        'Access to resource denied', // Different pattern
        'Permission denied', // Different word
        'Unauthorized access'
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
        expect(result).toBe(mockResponse); // Should pass through unchanged
        expect(mockedAuthRedirectManager.redirectToSignin).not.toHaveBeenCalled();
      }
    });

    it('should handle non-string message values gracefully', async () => {
      const nonStringValues = [
        { message: 123 },
        { message: null },
        { message: undefined },
        { message: {} },
        { message: [] }
      ];

      for (const data of nonStringValues) {
        jest.clearAllMocks();
        
        const mockResponse = {
          status: 200,
          statusText: 'OK',
          data,
          headers: {},
          config: {}
        };

        const result = await responseSuccessHandler(mockResponse);
        expect(result).toBe(mockResponse); // Should pass through unchanged
        expect(mockedAuthRedirectManager.redirectToSignin).not.toHaveBeenCalled();
      }
    });
  });

  describe('403 Status Code Detection', () => {
    it('should detect 403 status code and trigger authentication error handling', async () => {
      const mock403Error = {
        name: 'AxiosError',
        message: 'Request failed with status code 403',
        response: {
          status: 403,
          statusText: 'Forbidden',
          data: { message: 'Forbidden access' },
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

    it('should handle 403 errors without response data', async () => {
      const mock403Error = {
        name: 'AxiosError',
        message: 'Request failed with status code 403',
        response: {
          status: 403,
          statusText: 'Forbidden',
          data: null,
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

    it('should handle 403 errors with access denied messages', async () => {
      const mock403Error = {
        name: 'AxiosError',
        message: 'Request failed with status code 403',
        response: {
          status: 403,
          statusText: 'Forbidden',
          data: { message: 'Access Denied' },
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

    it('should not trigger auth error handling for non-403 status codes', async () => {
      const mock404Error = {
        name: 'AxiosError',
        message: 'Request failed with status code 404',
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { message: 'Resource not found' },
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

  describe('401 Status Code Handling', () => {
    it('should handle 401 errors with URL preservation', async () => {
      const mock401Error = {
        name: 'AxiosError',
        message: 'Request failed with status code 401',
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
          config: {}
        },
        config: {},
        isAxiosError: true,
        toJSON: () => ({})
      };

      await expect(responseErrorHandler(mock401Error)).rejects.toBe(mock401Error);
      expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalledWith(true);
    });
  });

  describe('Authentication State Clearing', () => {
    beforeEach(() => {
      // Set up some auth state to be cleared
      localStorageMock.setItem('authToken', 'test-token');
      localStorageMock.setItem('user-data', 'test-user-data');
      localStorageMock.setItem('wallet-auth-data', 'test-wallet-data');
      localStorageMock.setItem('auth-cache', 'test-auth-cache');
      localStorageMock.setItem('user-profile-cache', 'test-profile-cache');
      
      sessionStorageMock.setItem('authToken', 'test-session-token');
      sessionStorageMock.setItem('user-session', 'test-user-session');
      
      mockCookies = 'isAuth=1; authToken=test; refreshToken=test; sessionId=test';
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

      // Verify localStorage items are cleared
      expect(localStorageMock.getItem('authToken')).toBeNull();
      expect(localStorageMock.getItem('user-data')).toBeNull();
      expect(localStorageMock.getItem('wallet-auth-data')).toBeNull();
      expect(localStorageMock.getItem('auth-cache')).toBeNull();
      expect(localStorageMock.getItem('user-profile-cache')).toBeNull();
      
      // Verify sessionStorage items are cleared
      expect(sessionStorageMock.getItem('authToken')).toBeNull();
      expect(sessionStorageMock.getItem('user-session')).toBeNull();
      
      // Verify cookies are cleared (check that cookie clearing was attempted)
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

      // Verify authentication state is cleared
      expect(localStorageMock.getItem('authToken')).toBeNull();
      expect(sessionStorageMock.getItem('authToken')).toBeNull();
    });
  });

  describe('API Client Public Methods', () => {
    it('should provide access to preserved URL', () => {
      mockedAuthRedirectManager.getPreservedUrl.mockReturnValue('/dashboard');
      
      const preservedUrl = apiClient.getPreservedUrl();
      expect(preservedUrl).toBe('/dashboard');
      expect(mockedAuthRedirectManager.getPreservedUrl).toHaveBeenCalled();
    });

    it('should clear preserved URL', () => {
      apiClient.clearPreservedUrl();
      expect(mockedAuthRedirectManager.clearPreservedUrl).toHaveBeenCalled();
    });

    it('should handle successful authentication', () => {
      apiClient.handleSuccessfulAuth();
      expect(mockedAuthRedirectManager.handleSuccessfulAuth).toHaveBeenCalled();
    });

    it('should set and get tokens correctly', () => {
      const testToken = 'test-auth-token';
      
      apiClient.setToken(testToken);
      expect(localStorageMock.getItem('authToken')).toBe(testToken);
      expect(mockCookies).toContain('isAuth=1');
      
      const retrievedToken = apiClient.getToken();
      expect(retrievedToken).toBe(testToken);
    });

    it('should clear tokens correctly', () => {
      const testToken = 'test-auth-token';
      apiClient.setToken(testToken);
      
      apiClient.clearToken();
      expect(localStorageMock.getItem('authToken')).toBeNull();
      expect(mockCookies).toContain('Max-Age=0');
      expect(mockedAuthRedirectManager.clearAll).toHaveBeenCalled();
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle errors without response object', async () => {
      const mockError = {
        name: 'AxiosError',
        message: 'Network Error',
        response: undefined,
        config: {},
        isAxiosError: true,
        toJSON: () => ({})
      };

      await expect(responseErrorHandler(mockError)).rejects.toBe(mockError);
      // Should not trigger auth error handling for network errors
      expect(mockedAuthRedirectManager.redirectToSignin).not.toHaveBeenCalled();
    });

    it('should handle malformed response data gracefully', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: 'invalid json string',
        headers: {},
        config: {}
      };

      const result = await responseSuccessHandler(mockResponse);
      expect(result).toBe(mockResponse);
      expect(mockedAuthRedirectManager.redirectToSignin).not.toHaveBeenCalled();
    });

    it('should handle null/undefined response data', async () => {
      const testCases = [null, undefined];

      for (const data of testCases) {
        jest.clearAllMocks();
        
        const mockResponse = {
          status: 200,
          statusText: 'OK',
          data,
          headers: {},
          config: {}
        };

        const result = await responseSuccessHandler(mockResponse);
        expect(result).toBe(mockResponse);
        expect(mockedAuthRedirectManager.redirectToSignin).not.toHaveBeenCalled();
      }
    });

    it('should handle localStorage errors gracefully during clearing', async () => {
      // Mock localStorage to throw errors
      const originalRemoveItem = localStorageMock.removeItem;
      localStorageMock.removeItem = jest.fn().mockImplementation(() => {
        throw new Error('localStorage error');
      });

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

      // Should not throw error even if localStorage fails
      await expect(responseErrorHandler(mock403Error)).rejects.toBe(mock403Error);

      // Restore original method
      localStorageMock.removeItem = originalRemoveItem;
    });
  });

  describe('Error Message Utility', () => {
    it('should extract error messages from various error formats', () => {
      const testCases = [
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
          error: { someOtherProperty: 'value' },
          expected: 'An unexpected error occurred'
        }
      ];

      testCases.forEach(testCase => {
        const result = apiClient.handleError(testCase.error);
        expect(result).toBe(testCase.expected);
      });
    });
  });
});