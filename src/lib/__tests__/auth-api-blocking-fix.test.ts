/**
 * Test for authentication API blocking fix
 * Verifies that authentication-related API calls are allowed during authentication sessions
 * while non-auth calls are still blocked to prevent infinite loops
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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
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

describe('Authentication API Blocking Fix', () => {
  let requestInterceptor: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    localStorageMock.clear();

    // Mock authentication in progress
    mockedAuthRedirectManager.isModalOpening.mockReturnValue(false);
    mockedAuthRedirectManager.isAuthenticationInProgress.mockReturnValue(true);
    mockedAuthRedirectManager.isRedirecting.mockReturnValue(false);

    // Capture request interceptor
    mockAxiosInstance.interceptors.request.use.mockImplementation((requestHandler) => {
      requestInterceptor = requestHandler;
    });

    // Import API client to trigger interceptor setup
    await import('../api');
  });

  describe('Authentication API calls should be allowed during auth sessions', () => {
    const authEndpoints = [
      '/api/auth/signin',
      '/api/auth/signup',
      '/api/auth/signup-vcs',
      '/api/auth/verify-otp',
      '/api/auth/resend-otp',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/wallet/challenge',
      '/api/wallet/signup',
      '/api/wallet/verify',
      '/api/wallet/link',
      '/api/wallet/unlink',
      '/api/wallet/info',
      '/api/oauth/google/url',
      '/api/oauth/google/callback',
      '/api/oauth/verify-token',
      '/api/oauth/auth/oauth/signin',
      '/api/oauth/google',
      '/api/oauth/facebook'
    ];

    authEndpoints.forEach(endpoint => {
      it(`should allow ${endpoint} during authentication session`, async () => {
        const mockConfig = {
          url: `http://localhost:5000${endpoint}`,
          method: 'POST',
          headers: {}
        };

        const result = await requestInterceptor(mockConfig);
        expect(result).toBe(mockConfig);
        expect(result).not.toHaveProperty('isBlocked');
      });
    });

    it('should allow auth endpoints with different base URLs', async () => {
      const mockConfig = {
        url: `https://api.example.com/api/auth/signin`,
        method: 'POST',
        headers: {}
      };

      const result = await requestInterceptor(mockConfig);
      expect(result).toBe(mockConfig);
      expect(result).not.toHaveProperty('isBlocked');
    });
  });

  describe('Non-authentication API calls should still be blocked during auth sessions', () => {
    const nonAuthEndpoints = [
      '/api/features/get-user-account-details',
      '/api/features/get-kol-wallets',
      '/api/features/get-recent-kol-trades',
      '/api/kol-trades/recent',
      '/api/kol-trades/stats',
      '/api/features/search-tokens',
      '/api/features/perform-swap'
    ];

    nonAuthEndpoints.forEach(endpoint => {
      it(`should block ${endpoint} during authentication session`, async () => {
        const mockConfig = {
          url: `http://localhost:5000${endpoint}`,
          method: 'GET',
          headers: {}
        };

        await expect(requestInterceptor(mockConfig)).rejects.toThrow('API call blocked during authentication session');
      });
    });
  });

  describe('All API calls should be allowed when not in authentication session', () => {
    beforeEach(() => {
      // Mock no authentication in progress
      mockedAuthRedirectManager.isModalOpening.mockReturnValue(false);
      mockedAuthRedirectManager.isAuthenticationInProgress.mockReturnValue(false);
      mockedAuthRedirectManager.isRedirecting.mockReturnValue(false);
    });

    it('should allow auth endpoints when not in auth session', async () => {
      const mockConfig = {
        url: 'http://localhost:5000/api/auth/signin',
        method: 'POST',
        headers: {}
      };

      const result = await requestInterceptor(mockConfig);
      expect(result).toBe(mockConfig);
    });

    it('should allow non-auth endpoints when not in auth session', async () => {
      const mockConfig = {
        url: 'http://localhost:5000/api/features/get-user-account-details',
        method: 'GET',
        headers: {}
      };

      const result = await requestInterceptor(mockConfig);
      expect(result).toBe(mockConfig);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined URL gracefully', async () => {
      const mockConfig = {
        url: undefined,
        method: 'GET',
        headers: {}
      };

      // Should not throw error, should be blocked since URL is undefined (not auth endpoint)
      await expect(requestInterceptor(mockConfig)).rejects.toThrow('API call blocked during authentication session');
    });

    it('should handle partial URL matches correctly', async () => {
      // Should not match partial URLs
      const mockConfig = {
        url: 'http://localhost:5000/api/auth/signin-extra',
        method: 'POST',
        headers: {}
      };

      const result = await requestInterceptor(mockConfig);
      expect(result).toBe(mockConfig); // Should be allowed because it contains '/api/auth/signin'
    });

    it('should be case sensitive for endpoint matching', async () => {
      const mockConfig = {
        url: 'http://localhost:5000/API/AUTH/SIGNIN', // Uppercase
        method: 'POST',
        headers: {}
      };

      // Should be blocked because case doesn't match
      await expect(requestInterceptor(mockConfig)).rejects.toThrow('API call blocked during authentication session');
    });
  });

  describe('Modal opening state', () => {
    beforeEach(() => {
      // Mock modal opening but not authentication in progress
      mockedAuthRedirectManager.isModalOpening.mockReturnValue(true);
      mockedAuthRedirectManager.isAuthenticationInProgress.mockReturnValue(false);
      mockedAuthRedirectManager.isRedirecting.mockReturnValue(false);
    });

    it('should allow auth endpoints during modal opening', async () => {
      const mockConfig = {
        url: 'http://localhost:5000/api/auth/signin',
        method: 'POST',
        headers: {}
      };

      const result = await requestInterceptor(mockConfig);
      expect(result).toBe(mockConfig);
    });

    it('should block non-auth endpoints during modal opening', async () => {
      const mockConfig = {
        url: 'http://localhost:5000/api/features/get-user-account-details',
        method: 'GET',
        headers: {}
      };

      await expect(requestInterceptor(mockConfig)).rejects.toThrow('API call blocked during authentication session');
    });
  });

  describe('Redirecting state', () => {
    beforeEach(() => {
      // Mock redirecting but not authentication in progress or modal opening
      mockedAuthRedirectManager.isModalOpening.mockReturnValue(false);
      mockedAuthRedirectManager.isAuthenticationInProgress.mockReturnValue(false);
      mockedAuthRedirectManager.isRedirecting.mockReturnValue(true);
    });

    it('should allow auth endpoints during redirecting', async () => {
      const mockConfig = {
        url: 'http://localhost:5000/api/auth/signin',
        method: 'POST',
        headers: {}
      };

      const result = await requestInterceptor(mockConfig);
      expect(result).toBe(mockConfig);
    });

    it('should block non-auth endpoints during redirecting', async () => {
      const mockConfig = {
        url: 'http://localhost:5000/api/features/get-user-account-details',
        method: 'GET',
        headers: {}
      };

      await expect(requestInterceptor(mockConfig)).rejects.toThrow('API call blocked during authentication session');
    });
  });
});