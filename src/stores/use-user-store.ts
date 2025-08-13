'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, WalletInfo } from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';
import AuthService from '@/services/auth.service';
import { SiwsAuthService } from '@/services/siws-auth.service';
import WalletService from '@/services/wallet.service';
import { SettingsService } from '@/services/settings.service';

interface UserState {
  // Authentication state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Wallet state (for auth only, not trading)
  walletInfo: WalletInfo | null;
  isWalletConnected: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Profile actions
  updateUserProfile: (updates: Partial<User>) => void;
  loadUserProfile: () => Promise<void>;

  // Authentication actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  verifyOTP: (email: string, otp: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuth: () => void;

  // Wallet actions
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  updateWalletInfo: (walletInfo: WalletInfo | null) => void;
  refreshAccountDetails: () => Promise<void>;

  // Initialization
  initialize: () => Promise<void>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      walletInfo: null,
      isWalletConnected: false,

      // Basic setters
      setUser: user => set({ user, isAuthenticated: !!user }),
      setLoading: isLoading => set({ isLoading }),
      setError: error => set({ error }),

      // Profile actions
      updateUserProfile: updates => {
        set(state => ({ user: state.user ? { ...state.user, ...updates } : null }));
      },

      loadUserProfile: async () => {
        const currentUser = get().user;
        if (!currentUser) return;

        try {
          const response = await SettingsService.getUserSettings();
          if (response.data?.accountConfig) {
            const { displayName, avatar } = response.data.accountConfig;
            get().updateUserProfile({ displayName, avatar });
          }
        } catch (error) {
          console.error('Failed to load user profile:', error);
          // Don't throw error, just log it as profile loading is not critical
        }
      },

      // Authentication actions
      signIn: async (email, password) => {
        try {
          set({ isLoading: true, error: null });

          const response = await AuthService.signIn({ email, password });

          // Set initial user state (even if account details have errors)
          set({
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // If account details have errors, try to fetch them now that token is stored
          if (response.data.user.accountDetails?._hasError) {
            console.log('🔄 Account details have error, attempting to fetch after token storage...');
            try {
              const freshAccountDetails = await SiwsAuthService.refreshAccountDetails();
              // Update user with fresh account details
              const currentUser = get().user;
              if (currentUser) {
                set({
                  user: {
                    ...currentUser,
                    accountDetails: freshAccountDetails
                  }
                });
              }
              console.log('✅ Successfully fetched account details after login');
            } catch (fetchError: any) {
              console.warn('⚠️ Could not fetch account details after login:', fetchError.message);
              // User is still logged in, they can use refresh button later
              // Note: We don't show notifications here since this is in the store
              // The UI components will handle showing appropriate messages
            }
          }
        } catch (error: any) {
          set({
            error: error.message,
            isLoading: false,
            isAuthenticated: false,
            user: null,
          });
          throw error;
        }
      },

      signUp: async data => {
        try {
          set({ isLoading: true, error: null });

          await AuthService.signUp(data);

          set({ isLoading: false, error: null });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      verifyOTP: async (email, otp) => {
        try {
          set({ isLoading: true, error: null });

          const response = await AuthService.verifyOTP({ email, otp });

          set({
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      signOut: async () => {
        try {
          set({ isLoading: true });

          // Clear email authentication
          await AuthService.signOut();
          
          // Clear wallet authentication
          SiwsAuthService.removeToken();

          // Also disconnect wallet
          if (get().isWalletConnected) {
            await WalletService.disconnect();
          }

          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            walletInfo: null,
            isWalletConnected: false,
          });
        } catch (error: any) {
          // Even if API call fails, clear state
          SiwsAuthService.removeToken(); // Make sure wallet auth is cleared
          
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            walletInfo: null,
            isWalletConnected: false,
          });
          throw error;
        }
      },

      clearAuth: () => {
        AuthService.clearAuth();
        SiwsAuthService.removeToken(); // Also clear wallet auth
        set({
          user: null,
          isAuthenticated: false,
          error: null,
          walletInfo: null,
          isWalletConnected: false,
        });
      },

      // Wallet actions
      connectWallet: async () => {
        try {
          set({ isLoading: true, error: null });

          const walletInfo = await WalletService.connect();

          set({
            walletInfo,
            isWalletConnected: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          set({
            error: error.message,
            isLoading: false,
            walletInfo: null,
            isWalletConnected: false,
          });
          throw error;
        }
      },

      disconnectWallet: async () => {
        try {
          await WalletService.disconnect();

          set({
            walletInfo: null,
            isWalletConnected: false,
            error: null,
          });
        } catch (error: any) {
          // Even if disconnect fails, clear state
          set({
            walletInfo: null,
            isWalletConnected: false,
          });
        }
      },

      updateWalletInfo: walletInfo => {
        set({
          walletInfo,
          isWalletConnected: !!walletInfo?.isConnected,
        });
      },

      refreshAccountDetails: async () => {
        try {
          set({ isLoading: true, error: null });

          // Check if user is wallet authenticated and has a user object
          const currentUser = get().user;
          const isWalletAuth = SiwsAuthService.isAuthenticated();
          
          if (!isWalletAuth || !currentUser) {
            throw new Error('User must be authenticated with wallet to refresh account details');
          }

          // Fetch fresh account details - this now throws errors instead of returning null
          const accountDetails = await SiwsAuthService.refreshAccountDetails();
          
          // Update the user object with fresh account details
          set({
            user: {
              ...currentUser,
              accountDetails
            },
            isLoading: false,
            error: null
          });
          console.log('✅ Account details refreshed successfully');
        } catch (error: any) {
          console.error('❌ Failed to refresh account details:', error);
          set({
            error: error.message,
            isLoading: false,
          });
          throw error;
        }
      },

      // Initialize store on app startup
      initialize: async () => {
        try {
          set({ isLoading: true });

          // Initialize wallet auth service (sets token in API client if present)
          SiwsAuthService.initializeAuth();

          // Check if user is authenticated via email or wallet
          const isEmailAuth = AuthService.isAuthenticated();
          const isWalletAuth = SiwsAuthService.isAuthenticated();
          
          if (isEmailAuth || isWalletAuth) {
            console.log('🔄 User authenticated via:', isEmailAuth ? 'email' : 'wallet');
            set({ isAuthenticated: true });
            
            // If wallet authenticated, ensure we have a user profile
            if (isWalletAuth && !isEmailAuth) {
              try {
                const storedUser = get().user; // Check if we have persisted user data
                
                if (!storedUser) {
                  console.log('🔄 No stored user found, creating minimal wallet user profile...');
                  // Create a minimal user object for wallet authentication
                  const minimalUser: User = {
                    id: `wallet_user_${Date.now()}`,
                    email: '',
                    firstName: 'Wallet',
                    lastName: 'User',
                    walletAddress: '', // Will be populated when account details are loaded
                    accountDetails: null, // Will be loaded separately
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  set({ user: minimalUser });
                  console.log('✅ Created minimal wallet user profile:', minimalUser);
                } else {
                  // We have persisted user data, just ensure it's set
                  console.log('✅ Using persisted wallet user profile:', storedUser);
                }
                
                // Try to fetch account details for wallet users to get the wallet address
                try {
                  console.log('🔄 Fetching account details for wallet user...');
                  const accountDetails = await SiwsAuthService.refreshAccountDetails();
                  const currentUser = get().user;
                  if (currentUser) {
                    const updatedUser = {
                      ...currentUser,
                      accountDetails,
                      // Update wallet address from account details if not set
                      walletAddress: currentUser.walletAddress || accountDetails.address
                    };
                    set({ user: updatedUser });
                    console.log('✅ Loaded account details and updated wallet user:', updatedUser);
                  }
                } catch (accountError) {
                  console.warn('⚠️ Could not load account details during initialization:', accountError);
                  // User is still authenticated, they can use refresh button later
                  // Ensure we still have a user object even if account details fail
                  const currentUser = get().user;
                  if (!currentUser) {
                    const fallbackUser: User = {
                      id: `wallet_user_fallback_${Date.now()}`,
                      email: '',
                      firstName: 'Wallet',
                      lastName: 'User',
                      walletAddress: '',
                      accountDetails: null,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    set({ user: fallbackUser });
                    console.log('✅ Created fallback wallet user profile:', fallbackUser);
                  }
                }
              } catch (profileError) {
                console.warn('⚠️ Could not create wallet user profile:', profileError);
              }
            }
          }

          // Try to auto-connect wallet
          const walletInfo = await WalletService.autoConnect();
          if (walletInfo) {
            set({
              walletInfo,
              isWalletConnected: true,
            });
          }

          // Load user profile data if authenticated
          if (isEmailAuth || isWalletAuth) {
            try {
              await get().loadUserProfile();
            } catch (error) {
              console.warn('⚠️ Could not load user profile during initialization:', error);
            }
          }

          set({ isLoading: false });
        } catch (error) {
          console.error('Failed to initialize user store:', error);
          set({ isLoading: false });
        }
      },
    }),
    {
      name: STORAGE_KEYS.USER_DATA,
      partialize: state => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Don't persist wallet info for security
      }),
    }
  )
);

export default useUserStore;
