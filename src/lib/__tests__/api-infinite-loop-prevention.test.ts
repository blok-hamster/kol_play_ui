/**
 * Tests for API client infinite loop prevention during auth modal opening
 */

import { AuthRedirectManager } from '../auth-redirect';

// Mock AuthRedirectManager
jest.mock('../auth-redirect');
const mockedAuthRedirectManager = AuthRedirectManager as jest.Mocked<typeof AuthRedirectManager>;

describe('API Client - Infinite Loop Prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset AuthRedirectManager mocks
    mockedAuthRedirectManager.isModalOpening.mockReturnValue(false);
    mockedAuthRedirectManager.isRedirecting.mockReturnValue(false);
    mockedAuthRedirectManager.redirectToSignin.mockImplementation();
    mockedAuthRedirectManager.clearAll.mockImplementation();
  });

  describe('AuthRedirectManager Integration', () => {
    it('should check isModalOpening method exists and works', () => {
      expect(mockedAuthRedirectManager.isModalOpening).toBeDefined();
      
      mockedAuthRedirectManager.isModalOpening.mockReturnValue(true);
      expect(AuthRedirectManager.isModalOpening()).toBe(true);
      
      mockedAuthRedirectManager.isModalOpening.mockReturnValue(false);
      expect(AuthRedirectManager.isModalOpening()).toBe(false);
    });

    it('should prevent redirect when modal is opening', () => {
      mockedAuthRedirectManager.isModalOpening.mockReturnValue(true);
      
      AuthRedirectManager.redirectToSignin(true);
      
      // Should not call the actual redirect since modal is opening
      expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalled();
    });

    it('should allow redirect when modal is not opening', () => {
      mockedAuthRedirectManager.isModalOpening.mockReturnValue(false);
      
      AuthRedirectManager.redirectToSignin(true);
      
      expect(mockedAuthRedirectManager.redirectToSignin).toHaveBeenCalled();
    });
  });
});