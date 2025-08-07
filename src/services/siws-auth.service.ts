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
    walletAddress: string; // This is the encoded wallet address from backend
    accountDetails: {
      address: string; // This is the readable Solana address
      balance: number;
      tokens: {
        mint: string;
        name: string;
        symbol: string;
        image?: string;
        balance: number;
        value: number;
      }[];
      // Optional error flags for when account details couldn't be fetched
      _hasError?: boolean;
      _errorMessage?: string;
    };
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
      // Get the current origin for URI
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      
      // Extract domain (hostname only) from URI or use configured domain
      let domain = request.domain || WALLET_CONFIG.DOMAIN;
      let uri = request.uri || currentOrigin;

      // Ensure domain is hostname only (remove protocol if present)
      if (domain.includes('://')) {
        try {
          const domainUrl = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
          domain = domainUrl.hostname;
        } catch (e) {
          // Fallback: remove protocol manually if URL parsing fails
          domain = domain.replace(/^https?:\/\//, '');
        }
      }

      // Ensure URI has protocol
      if (uri && !uri.startsWith('http')) {
        uri = `https://${uri}`;
      }

      console.log(
        '🌐 Making backend API call to:',
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}${API_ENDPOINTS.WALLET.CHALLENGE}`
      );

      console.log('🌐 Request payload:', {
        domain,
        statement: request.statement || WALLET_CONFIG.STATEMENT,
        uri,
        resources: request.resources || [],
      });

      // Use the raw post method since the backend doesn't follow ApiResponse format
      const response = await apiClient.postRaw<any>(
        API_ENDPOINTS.WALLET.CHALLENGE,
        {
          domain,
          statement: request.statement || WALLET_CONFIG.STATEMENT,
          uri,
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

      // Validate the challenge object has required SIWS fields
      const challenge = response.challenge;
      const requiredFields = ['domain', 'statement', 'uri', 'version', 'chainId', 'nonce', 'issuedAt'];
      const missingFields = requiredFields.filter(field => !challenge[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Backend returned challenge missing required SIWS fields: ${missingFields.join(', ')}`);
      }

      // Additional validation: ensure domain in response doesn't have protocol
      if (challenge.domain && challenge.domain.includes('://')) {
        console.warn('⚠️ Backend returned domain with protocol, fixing...');
        try {
          const domainUrl = new URL(challenge.domain.startsWith('http') ? challenge.domain : `https://${challenge.domain}`);
          challenge.domain = domainUrl.hostname;
        } catch (e) {
          challenge.domain = challenge.domain.replace(/^https?:\/\//, '');
        }
      }

      console.log('✅ Final SIWS challenge:', JSON.stringify(challenge, null, 2));
      
      return { challenge };
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

      // Validate the response using the utility method
      this.validateWalletAuthResponse(response);

      // Handle account details - allow sign-up even if account details have errors
      let finalAccountDetails = response.user.accountDetails;
      
      if (response.user.accountDetails?._hasError) {
        console.log('⚠️ Account details has error, user can still sign up. Will need to refresh manually.');
        // Provide a minimal account details structure with error flag
        finalAccountDetails = {
          address: '', // Will be populated when user refreshes
          balance: 0,
          tokens: [],
          _hasError: true,
          _errorMessage: response.user.accountDetails.error || 'Account details unavailable'
        };
      } else if (!response.user.accountDetails || typeof response.user.accountDetails !== 'object') {
        console.log('⚠️ No account details provided, user can still sign up. Will need to refresh manually.');
        // Provide a minimal account details structure
        finalAccountDetails = {
          address: '',
          balance: 0,
          tokens: [],
          _hasError: true,
          _errorMessage: 'Account details not provided'
        };
      }

      return {
        success: response.success,
        user: {
          id: response.user.id,
          email: response.user.email || request.email || undefined,
          walletAddress: response.user.walletAddress,
          accountDetails: finalAccountDetails
        },
        token: response.token,
      } as WalletAuthResponse;
    } catch (error: any) {
      console.error('🌐 Signup error:', error);
      
      // Enhanced error handling with specific error types
      if (error.name === 'NetworkError' || error.code === 'ECONNREFUSED') {
        throw new Error('Unable to connect to server. Please check your internet connection and try again.');
      }
      
      if (error.response?.status === 400) {
        throw new Error('Invalid signup data. Please check your information and try again.');
      }
      
      if (error.response?.status === 409) {
        throw new Error('Wallet already registered. Please sign in instead.');
      }
      
      if (error.response?.status >= 500) {
        throw new Error('Server error. Please try again later.');
      }

      // Use the original error message if it's already a string
      const errorMessage = typeof error === 'string' ? error : error.message || 'Signup failed';
      throw new Error(errorMessage);
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

      // Validate the response using the utility method
      this.validateWalletAuthResponse(response);

      // Handle account details - allow sign-in even if account details have errors
      let finalAccountDetails = response.user.accountDetails;
      
      if (response.user.accountDetails?._hasError) {
        console.log('⚠️ Account details has error, user can still sign in. Will need to refresh manually.');
        // Provide a minimal account details structure with error flag
        finalAccountDetails = {
          address: '', // Will be populated when user refreshes
          balance: 0,
          tokens: [],
          _hasError: true,
          _errorMessage: response.user.accountDetails.error || 'Account details unavailable'
        };
      } else if (!response.user.accountDetails || typeof response.user.accountDetails !== 'object') {
        console.log('⚠️ No account details provided, user can still sign in. Will need to refresh manually.');
        // Provide a minimal account details structure
        finalAccountDetails = {
          address: '',
          balance: 0,
          tokens: [],
          _hasError: true,
          _errorMessage: 'Account details not provided'
        };
      }

      return {
        success: response.success,
        user: {
          id: response.user.id,
          email: response.user.email || undefined,
          walletAddress: response.user.walletAddress,
          accountDetails: finalAccountDetails
        },
        token: response.token,
      } as WalletAuthResponse;
    } catch (error: any) {
      console.error('🌐 Signin error:', error);
      
      // Enhanced error handling with specific error types
      if (error.name === 'NetworkError' || error.code === 'ECONNREFUSED') {
        throw new Error('Unable to connect to server. Please check your internet connection and try again.');
      }
      
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please verify your wallet signature and try again.');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Wallet not registered. Please sign up first.');
      }
      
      if (error.response?.status >= 500) {
        throw new Error('Server error. Please try again later.');
      }

      // Use the original error message if it's already a string
      const errorMessage = typeof error === 'string' ? error : error.message || 'Authentication failed';
      throw new Error(errorMessage);
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
  static storeToken(token: string) {
    console.log('💾 [SiwsAuthService.storeToken] Starting token storage process');
    console.log('💾 [SiwsAuthService.storeToken] Token preview:', token.substring(0, 50) + '...');
    
    if (typeof window !== 'undefined') {
      // Store in localStorage using the same key as API client
      localStorage.setItem('authToken', token);
      console.log('💾 [SiwsAuthService.storeToken] Token stored in localStorage with key "authToken"');

      // CRITICAL: Update the API client with the new token
      apiClient.setToken(token);
      console.log('💾 [SiwsAuthService.storeToken] Token set in API client');

      // Verify token is stored and set properly
      const storedToken = localStorage.getItem('authToken');
      const apiClientToken = apiClient.getToken();
      console.log('💾 [SiwsAuthService.storeToken] Verification - localStorage token:', storedToken?.substring(0, 50) + '...');
      console.log('💾 [SiwsAuthService.storeToken] Verification - API client token:', apiClientToken?.substring(0, 50) + '...');
      console.log('💾 [SiwsAuthService.storeToken] Verification - tokens match:', storedToken === apiClientToken);
      console.log('💾 [SiwsAuthService.storeToken] Token storage process completed successfully');
    } else {
      console.warn('💾 [SiwsAuthService.storeToken] Window not available, token not stored');
    }
  }

  /**
   * Get stored authentication token
   */
  static getStoredToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    return null;
  }

  /**
   * Initialize authentication - call this on app startup
   */
  static initializeAuth(): void {
    const storedToken = this.getStoredToken();
    if (storedToken) {
      console.log('🔄 Initializing API client with stored token');
      apiClient.setToken(storedToken);
    }
  }

  /**
   * Remove stored authentication token
   */
  static removeToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      // Also clear from API client
      apiClient.clearToken();
      console.log('🗑️ Token removed from both localStorage and API client');
    }
  }

  /**
   * Fetch user account details from features endpoint
   */
  static async fetchUserAccountDetails(): Promise<{
    address: string;
    balance: number;
    tokens: {
      mint: string;
      name: string;
      symbol: string;
      image?: string;
      balance: number;
      value: number;
    }[];
  } | null> {
    try {
      console.log('🔄 Fetching user account details from features endpoint...');
      
      const response = await apiClient.get<any>(API_ENDPOINTS.FEATURES.GET_USER_ACCOUNT_DETAILS);
      
      console.log('🌐 Raw account details response:', response);
      
      // Handle different possible response formats
      let accountData = null;
      
      if (response?.data?.data) {
        // Standard API response format: { data: { data: accountDetails } }
        accountData = response.data.data;
      } else if (response?.data) {
        // Direct data format: { data: accountDetails }
        accountData = response.data;
      } else {
        console.warn('⚠️ Unexpected response format from account details endpoint');
        return null;
      }

      if (!accountData) {
        console.warn('⚠️ No account details returned from features endpoint');
        return null;
      }

      // Check if the response contains an error
      if (accountData.error) {
        console.error('❌ Account details endpoint returned error:', accountData.error);
        throw new Error(`Failed to fetch account details: ${accountData.error}`);
      }

      // Validate required fields
      if (!accountData.address && !accountData.walletAddress) {
        throw new Error('Account details missing required address field');
      }

      console.log('✅ Account details fetched successfully:', accountData);
      
      // Return the account details in the exact expected format
      return {
        address: accountData.address || accountData.walletAddress || '',
        balance: typeof accountData.balance === 'number' ? accountData.balance : 0,
        tokens: Array.isArray(accountData.tokens) ? accountData.tokens.map(token => ({
          mint: token.mint || '',
          name: token.name || 'Unknown Token',
          symbol: token.symbol || 'UNKNOWN',
          image: token.image,
          balance: typeof token.balance === 'number' ? token.balance : 0,
          value: typeof token.value === 'number' ? token.value : 0,
        })) : []
      };
    } catch (error: any) {
      console.error('❌ Failed to fetch user account details:', error);
      
      // Log more details about the error
      if (error.response) {
        console.error('❌ Response status:', error.response.status);
        console.error('❌ Response data:', error.response.data);
      }
      
      // Re-throw the error instead of returning null so caller knows it failed
      throw error;
    }
  }

  /**
   * Validate wallet authentication response structure
   */
  static validateWalletAuthResponse(response: any): void {
    console.log('🔍 Validating wallet auth response:', response);
    
    if (!response) {
      throw new Error('Response is null or undefined');
    }
    
    if (typeof response !== 'object') {
      throw new Error('Response is not an object');
    }
    
    if (!response.success) {
      throw new Error(`Authentication failed: ${response.message || response.error || 'Unknown error'}`);
    }
    
    if (!response.user) {
      throw new Error('Missing user data in response');
    }
    
    if (!response.user.id) {
      throw new Error('Missing user ID in response');
    }
    
    if (!response.user.walletAddress && !response.user.accountDetails?.address) {
      throw new Error('Missing wallet address information in response');
    }
    
    if (!response.token) {
      throw new Error('Missing authentication token in response');
    }
    
    // Check if account details contains an error
    if (response.user.accountDetails && typeof response.user.accountDetails.error === 'string') {
      console.warn('⚠️ Account details contains error:', response.user.accountDetails.error);
      // Mark it for fallback fetching
      response.user.accountDetails._hasError = true;
    }
    
    // Validate and normalize account details structure if present and no error
    if (response.user.accountDetails && !response.user.accountDetails._hasError) {
      if (!response.user.accountDetails.address) {
        console.warn('⚠️ Missing account details address');
      }
      if (typeof response.user.accountDetails.balance !== 'number') {
        console.warn('⚠️ Invalid account details balance format, normalizing to 0');
        response.user.accountDetails.balance = 0;
      }
      if (!Array.isArray(response.user.accountDetails.tokens)) {
        console.warn('⚠️ Invalid account details tokens format, normalizing to empty array');
        response.user.accountDetails.tokens = [];
      }
    }
    
    // Log the validated response structure
    console.log('✅ Response validation passed');
    console.log('📋 User ID:', response.user.id);
    console.log('📋 Wallet Address:', response.user.walletAddress);
    console.log('📋 Account Details:', response.user.accountDetails);
    console.log('📋 Token length:', response.token?.length);
  }

  /**
   * Refresh account details for authenticated user
   * This can be called anytime to update the user's account information
   */
  static async refreshAccountDetails(): Promise<{
    address: string;
    balance: number;
    tokens: {
      mint: string;
      name: string;
      symbol: string;
      image?: string;
      balance: number;
      value: number;
    }[];
  }> {
    console.log('🔄 [SiwsAuthService.refreshAccountDetails] Starting account details refresh');
    
    if (!this.isAuthenticated()) {
      console.error('❌ [SiwsAuthService.refreshAccountDetails] User not authenticated');
      throw new Error('User must be authenticated to refresh account details');
    }
    
    console.log('✅ [SiwsAuthService.refreshAccountDetails] User is authenticated, proceeding with API call');
    const currentToken = apiClient.getToken();
    console.log('🔑 [SiwsAuthService.refreshAccountDetails] Current API client token:', currentToken?.substring(0, 50) + '...');
    
    try {
      const result = await this.fetchUserAccountDetails();
      console.log('✅ [SiwsAuthService.refreshAccountDetails] Account details refreshed successfully');
      return result;
    } catch (error: any) {
      console.error('❌ [SiwsAuthService.refreshAccountDetails] Failed to refresh account details:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    const storedToken = this.getStoredToken();
    if (storedToken) {
      apiClient.setToken(storedToken);
    }
    return !!storedToken;
  }
}
