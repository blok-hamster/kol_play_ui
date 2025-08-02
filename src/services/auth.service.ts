import apiClient from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/constants';
import {
  AuthResponse,
  SignUpRequest,
  SignInRequest,
  VerifyOTPRequest,
  ApiResponse,
  User,
} from '@/types';

export class AuthService {
  /**
   * Sign up with email and password
   */
  static async signUp(data: SignUpRequest): Promise<
    ApiResponse<{
      userId: string;
      email: string;
      verificationRequired: boolean;
    }>
  > {
    try {
      const response = await apiClient.post<{
        userId: string;
        email: string;
        verificationRequired: boolean;
      }>(API_ENDPOINTS.AUTH.SIGNUP, data);
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * VCS signup (special route)
   */
  static async signUpVCS(
    data: SignUpRequest
  ): Promise<ApiResponse<{ userId: string; email: string }>> {
    try {
      const response = await apiClient.post<{ userId: string; email: string }>(
        API_ENDPOINTS.AUTH.SIGNUP_VCS,
        data
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Sign in with email and password
   */
  static async signIn(data: SignInRequest): Promise<AuthResponse> {
    try {
      console.log('🔐 AuthService.signIn - Request data:', data);

      // Make the API call using raw method for direct response format: { token, user }
      const responseData = await apiClient.postRaw<{
        token: string;
        user: User;
        isNewUser?: boolean;
      }>(API_ENDPOINTS.AUTH.SIGNIN, data);

      console.log('🔐 AuthService.signIn - Response data:', responseData);

      // Check if response has the expected format
      if (!responseData || typeof responseData !== 'object') {
        console.error(
          '🔐 Unexpected response format - not an object:',
          responseData
        );
        throw new Error('Invalid response format from server');
      }

      if (!responseData.token) {
        console.error(
          '🔐 Unexpected response format - no token property:',
          responseData
        );
        throw new Error('No authentication token received');
      }

      if (!responseData.user) {
        console.error(
          '🔐 Unexpected response format - no user property:',
          responseData
        );
        throw new Error('No user data received');
      }

      const { token, user, isNewUser } = responseData;

      console.log('🔐 AuthService.signIn - extracted token:', token);
      console.log('🔐 AuthService.signIn - extracted user:', user);

      // Log account details if present
      if (user.accountDetails) {
        console.log(
          '🔐 AuthService.signIn - user wallet address:',
          user.accountDetails.address
        );
        console.log(
          '🔐 AuthService.signIn - user SOL balance:',
          user.accountDetails.balance
        );
        console.log(
          '🔐 AuthService.signIn - user tokens count:',
          user.accountDetails.tokens.length
        );
      }

      // Store token in API client
      apiClient.setToken(token);
      console.log('🔐 Token stored in apiClient');

      // Return in the expected AuthResponse format
      return {
        message: 'Sign in successful',
        data: {
          user,
          token,
          ...(isNewUser !== undefined && { isNewUser }),
        },
      };
    } catch (error: any) {
      console.error('🔐 AuthService.signIn - Error:', error);
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Verify OTP for email verification
   */
  static async verifyOTP(data: VerifyOTPRequest): Promise<AuthResponse> {
    try {
      console.log('🔐 AuthService.verifyOTP - Request data:', data);

      // Make the API call using raw method for direct response format: { token, user }
      const responseData = await apiClient.postRaw<{
        token: string;
        user: User;
        isNewUser?: boolean;
      }>(API_ENDPOINTS.AUTH.VERIFY_OTP, data);

      console.log('🔐 AuthService.verifyOTP - Response data:', responseData);

      // Check if response has the expected format
      if (!responseData || typeof responseData !== 'object') {
        console.error(
          '🔐 Unexpected response format - not an object:',
          responseData
        );
        throw new Error('Invalid response format from server');
      }

      if (!responseData.token) {
        console.error(
          '🔐 Unexpected response format - no token property:',
          responseData
        );
        throw new Error('No authentication token received');
      }

      if (!responseData.user) {
        console.error(
          '🔐 Unexpected response format - no user property:',
          responseData
        );
        throw new Error('No user data received');
      }

      const { token, user, isNewUser } = responseData;

      console.log('🔐 AuthService.verifyOTP - extracted token:', token);
      console.log('🔐 AuthService.verifyOTP - extracted user:', user);

      // Log account details if present
      if (user.accountDetails) {
        console.log(
          '🔐 AuthService.verifyOTP - user wallet address:',
          user.accountDetails.address
        );
        console.log(
          '🔐 AuthService.verifyOTP - user SOL balance:',
          user.accountDetails.balance
        );
        console.log(
          '🔐 AuthService.verifyOTP - user tokens count:',
          user.accountDetails.tokens.length
        );
      }

      // Store token in API client
      apiClient.setToken(token);
      console.log('🔐 Token stored in apiClient');

      // Return in the expected AuthResponse format
      return {
        message: 'OTP verification successful',
        data: {
          user,
          token,
          ...(isNewUser !== undefined && { isNewUser }),
        },
      };
    } catch (error: any) {
      console.error('🔐 AuthService.verifyOTP - Error:', error);
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Resend OTP verification code
   */
  static async resendOTP(email: string): Promise<ApiResponse<null>> {
    try {
      const response = await apiClient.post<null>(
        API_ENDPOINTS.AUTH.RESEND_OTP,
        { email }
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Request password reset
   */
  static async forgotPassword(email: string): Promise<ApiResponse<null>> {
    try {
      const response = await apiClient.post<null>(
        API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
        { email }
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Reset password with token
   */
  static async resetPassword(
    token: string,
    newPassword: string
  ): Promise<ApiResponse<null>> {
    try {
      const response = await apiClient.post<null>(
        API_ENDPOINTS.AUTH.RESET_PASSWORD,
        {
          token,
          newPassword,
        }
      );
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Sign out user
   */
  static async signOut(): Promise<ApiResponse<null>> {
    try {
      const response = await apiClient.post<null>(API_ENDPOINTS.AUTH.SIGNOUT);

      // Clear token from API client
      apiClient.clearToken();

      return response;
    } catch (error: any) {
      // Even if API call fails, clear token locally
      apiClient.clearToken();
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Link Telegram account
   */
  static async linkTelegram(
    telegramId: string,
    telegramUsername: string
  ): Promise<ApiResponse<{ telegramId: string; telegramUsername: string }>> {
    try {
      const response = await apiClient.post<{
        telegramId: string;
        telegramUsername: string;
      }>(API_ENDPOINTS.AUTH.LINK_TELEGRAM, {
        telegramId,
        telegramUsername,
      });
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Check if user is currently authenticated
   */
  static isAuthenticated(): boolean {
    return !!apiClient.getToken();
  }

  /**
   * Get current token
   */
  static getToken(): string | null {
    return apiClient.getToken();
  }

  /**
   * Clear authentication data
   */
  static clearAuth(): void {
    apiClient.clearToken();
  }

  /**
   * Get current user info from stored token
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const response = await apiClient.get<{ user: User }>('/auth/me');
      return response.data.user;
    } catch (error: any) {
      console.error('🔐 Failed to get current user:', error);
      // Clear invalid token
      apiClient.clearToken();
      return null;
    }
  }
}

export default AuthService;
