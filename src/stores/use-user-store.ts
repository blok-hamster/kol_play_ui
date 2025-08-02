'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, WalletInfo } from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';
import AuthService from '@/services/auth.service';
import WalletService from '@/services/wallet.service';

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

      // Authentication actions
      signIn: async (email, password) => {
        try {
          set({ isLoading: true, error: null });

          const response = await AuthService.signIn({ email, password });

          set({
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
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

          await AuthService.signOut();

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

      // Initialize store on app startup
      initialize: async () => {
        try {
          set({ isLoading: true });

          // Check if user is authenticated
          const isAuth = AuthService.isAuthenticated();
          if (isAuth) {
            // In a real app, you'd fetch current user info from API
            set({ isAuthenticated: true });
          }

          // Try to auto-connect wallet
          const walletInfo = await WalletService.autoConnect();
          if (walletInfo) {
            set({
              walletInfo,
              isWalletConnected: true,
            });
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
