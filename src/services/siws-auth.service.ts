import apiClient from '@/lib/api';
import { API_ENDPOINTS, WALLET_CONFIG } from '@/lib/constants';
import {
  SolanaSignInInput,
  SolanaSignInOutput,
} from '@solana/wallet-standard-features';
import { ApiResponse } from '@/types';

export interface CreateChallengeRequest {
  domain?: string;
  statement?: string;
  uri?: string;
  resources?: string[];
}

export interface CreateChallengeResponse {
  challenge: SolanaSignInInput;
}

export interface WalletSignUpRequest {
  input: SolanaSignInInput;
  output: SolanaSignInOutput;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface WalletAuthResponse {
  success: boolean;
  user: {
    id: string;
    email?: string;
    walletAddress: string;
    accountDetails?: any;
  };
  token: string;
}

// Mock mode flag - set to true for testing without backend
const MOCK_MODE = false; // Real backend mode enabled
// To enable mock mode for testing: const MOCK_MODE = true;

export class SiwsAuthService {
  /**
   * Create SIWS challenge
   */
  static async createChallenge(
    request: CreateChallengeRequest = {}
  ): Promise<CreateChallengeResponse> {
    if (MOCK_MODE) {
      // Create SIWS input according to the official specification
      // The wallet will construct the actual message from these parameters
      const mockChallenge: SolanaSignInInput = {
        domain: request.domain || 'localhost:3000',
        statement:
          request.statement ||
          'Clicking Sign or Approve only means you have proved this wallet is owned by you. This request will not trigger any blockchain transaction or cost any gas fee.',
        uri: request.uri || 'http://localhost:3000',
        version: '1',
        chainId: 'mainnet',
        nonce: Math.random().toString(36).substring(2, 15),
        issuedAt: new Date().toISOString(),
      };

      // Only add optional fields if they exist
      if (request.resources && request.resources.length > 0) {
        mockChallenge.resources = request.resources;
      }

      console.log(
        '🔐 SIWS Challenge Input (Phantom will construct the message):'
      );
      console.log(JSON.stringify(mockChallenge, null, 2));
      return { challenge: mockChallenge };
    }

    try {
      console.log(
        '🌐 Making backend API call to:',
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}${API_ENDPOINTS.WALLET.CHALLENGE}`
      );
      console.log('🌐 Request payload:', {
        domain: request.domain || WALLET_CONFIG.DOMAIN,
        statement: request.statement || WALLET_CONFIG.STATEMENT,
        uri:
          request.uri ||
          (typeof window !== 'undefined' ? window.location.origin : ''),
        resources: request.resources || [],
      });

      // Use the raw post method since the backend doesn't follow ApiResponse format
      const response = await apiClient.postRaw<any>(
        API_ENDPOINTS.WALLET.CHALLENGE,
        {
          domain: request.domain || WALLET_CONFIG.DOMAIN,
          statement: request.statement || WALLET_CONFIG.STATEMENT,
          uri:
            request.uri ||
            (typeof window !== 'undefined' ? window.location.origin : ''),
          resources: request.resources || [],
        }
      );

      console.log('🌐 Backend response:', response);

      // Handle the actual backend response format
      if (!response || typeof response !== 'object') {
        throw new Error(
          `Invalid response format: expected object with 'challenge' property, got ${typeof response}`
        );
      }

      if (!response.challenge) {
        throw new Error(
          `Missing 'challenge' property in response. Received: ${JSON.stringify(response)}`
        );
      }

      // Ensure chainId format is compatible with Phantom wallet
      if (response.challenge.chainId === 'solana:mainnet') {
        response.challenge.chainId = 'mainnet';
      }

      console.log('🌐 Processed challenge:', response.challenge);

      return { challenge: response.challenge };
    } catch (error: any) {
      console.error('🌐 Backend API Error:', error);
      console.error('🌐 Error response:', error.response?.data);
      console.error('🌐 Error status:', error.response?.status);
      console.error('🌐 Error message:', error.message);

      // Provide helpful error messages based on the error type
      if (error.response?.status === 404) {
        throw new Error(
          `Backend endpoint not found: ${API_ENDPOINTS.WALLET.CHALLENGE}. Please implement the SIWS challenge endpoint on your backend.`
        );
      } else if (error.response?.status === 500) {
        throw new Error(
          `Backend server error: ${error.response?.data?.message || error.message}. Check your backend logs.`
        );
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error(
          `Cannot connect to backend server at ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}. Make sure your backend is running.`
        );
      } else if (
        error.message.includes('Invalid response format') ||
        error.message.includes('Missing')
      ) {
        throw new Error(error.message);
      } else {
        throw new Error(`Backend API error: ${apiClient.handleError(error)}`);
      }
    }
  }

  /**
   * Sign up with wallet
   */
  static async walletSignUp(
    request: WalletSignUpRequest
  ): Promise<WalletAuthResponse> {
    if (MOCK_MODE) {
      // Mock implementation for testing
      const mockResponse: WalletAuthResponse = {
        success: true,
        user: {
          id: 'mock-user-' + Math.random().toString(36).substring(2, 15),
          email: request.email || undefined,
          walletAddress: Array.from(request.output.account.publicKey)
            .map(b => b.toString(16).padStart(2, '0'))
            .join(''),
          accountDetails: {
            firstName: request.firstName,
            lastName: request.lastName,
            createdAt: new Date().toISOString(),
            // Add wallet-specific account details
            address: Array.from(request.output.account.publicKey)
              .map(b => b.toString(16).padStart(2, '0'))
              .join(''),
            balance: 2.5, // Mock SOL balance
            tokens: [
              {
                symbol: 'USDC',
                name: 'USD Coin',
                balance: 100.0,
                value: 100.0,
              },
              {
                symbol: 'RAY',
                name: 'Raydium',
                balance: 50.0,
                value: 75.0,
              },
            ],
          },
        },
        token: 'mock-jwt-token-' + Math.random().toString(36).substring(2, 15),
      };

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return mockResponse;
    }

    try {
      console.log('🌐 Making wallet signup request to backend');

      const response = await apiClient.postRaw<any>(
        API_ENDPOINTS.WALLET.SIGNUP,
        {
          input: request.input,
          output: {
            account: {
              ...request.output.account,
              publicKey: Array.from(request.output.account.publicKey),
            },
            signature: Array.from(request.output.signature),
            signedMessage: Array.from(request.output.signedMessage),
            signatureType: request.output.signatureType,
          },
          firstName: request.firstName,
          lastName: request.lastName,
          email: request.email,
        }
      );

      console.log('🌐 Signup response:', response);

      // Handle backend response format
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid signup response format');
      }

      if (!response.success) {
        throw new Error(response.message || 'Signup failed');
      }

      return {
        success: response.success,
        user: response.user,
        token: response.token,
      };
    } catch (error: any) {
      console.error('🌐 Signup error:', error);
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Sign in with wallet
   */
  static async walletSignIn(
    input: SolanaSignInInput,
    output: SolanaSignInOutput
  ): Promise<WalletAuthResponse> {
    if (MOCK_MODE) {
      // Mock implementation for testing
      const mockResponse: WalletAuthResponse = {
        success: true,
        user: {
          id: 'mock-user-signin-' + Math.random().toString(36).substring(2, 15),
          walletAddress: Array.from(output.account.publicKey)
            .map(b => b.toString(16).padStart(2, '0'))
            .join(''),
          accountDetails: {
            lastSignIn: new Date().toISOString(),
            // Add wallet-specific account details
            address: Array.from(output.account.publicKey)
              .map(b => b.toString(16).padStart(2, '0'))
              .join(''),
            balance: 1.8, // Mock SOL balance
            tokens: [
              {
                symbol: 'USDC',
                name: 'USD Coin',
                balance: 250.0,
                value: 250.0,
              },
              {
                symbol: 'BONK',
                name: 'Bonk',
                balance: 1000000.0,
                value: 45.0,
              },
            ],
          },
        },
        token:
          'mock-jwt-token-signin-' +
          Math.random().toString(36).substring(2, 15),
      };

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return mockResponse;
    }

    try {
      console.log('🌐 Making wallet signin request to backend');

      const response = await apiClient.postRaw<any>(
        API_ENDPOINTS.WALLET.SIGNIN,
        {
          input,
          output: {
            account: {
              ...output.account,
              publicKey: Array.from(output.account.publicKey),
            },
            signature: Array.from(output.signature),
            signedMessage: Array.from(output.signedMessage),
            signatureType: output.signatureType,
          },
        }
      );

      console.log('🌐 Signin response:', response);

      // Handle backend response format
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid signin response format');
      }

      if (!response.success) {
        throw new Error(response.message || 'Signin failed');
      }

      return {
        success: response.success,
        user: response.user,
        token: response.token,
      };
    } catch (error: any) {
      console.error('🌐 Signin error:', error);
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Link wallet to existing account
   */
  static async linkWallet(
    input: SolanaSignInInput,
    output: SolanaSignInOutput
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
      }>(API_ENDPOINTS.WALLET.LINK, {
        input,
        output: {
          account: {
            ...output.account,
            publicKey: Array.from(output.account.publicKey),
          },
          signature: Array.from(output.signature),
          signedMessage: Array.from(output.signedMessage),
          signatureType: output.signatureType,
        },
      });
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Get wallet info
   */
  static async getWalletInfo(): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.WALLET.INFO);
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Unlink wallet
   */
  static async unlinkWallet(): Promise<
    ApiResponse<{ success: boolean; message: string }>
  > {
    try {
      const response = await apiClient.delete<{
        success: boolean;
        message: string;
      }>(API_ENDPOINTS.WALLET.UNLINK);
      return response;
    } catch (error: any) {
      throw new Error(apiClient.handleError(error));
    }
  }

  /**
   * Store authentication token
   */
  static storeToken(token: string): void {
    console.log(
      '💾 Storing authentication token:',
      token.substring(0, 50) + '...'
    );

    if (typeof window !== 'undefined') {
      // Store in localStorage
      localStorage.setItem('authToken', token);
      console.log('💾 Token stored in localStorage');

      // CRITICAL: Update the API client with the new token
      apiClient.setToken(token);
      console.log('💾 Token set in API client');

      // Verify token is stored
      const storedToken = localStorage.getItem('authToken');
      console.log(
        '💾 Verification - stored token:',
        storedToken?.substring(0, 50) + '...'
      );
      console.log(
        '💾 Verification - api client has token:',
        !!apiClient.getToken()
      );
    }
  }

  /**
   * Get stored authentication token
   */
  static getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    return null;
  }

  /**
   * Clear authentication token
   */
  static clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
