'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  UserSubscription,
  KOLTrade,
  Transaction,
  OverallPnL,
  TransactionStats,
  TradingSettings,
} from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';
import { TradingService } from '@/services/trading.service';
import type { UpdateUserSubscriptionRequest } from '@/services/trading.service';

interface TradingState {
  // KOL Subscriptions
  subscriptions: UserSubscription[];
  isLoadingSubscriptions: boolean;
  hasLoadedSubscriptions: boolean; // Add flag to track if subscriptions have been loaded

  // Live trades feed
  liveTradesFeed: KOLTrade[];
  isLoadingLiveTradesFeed: boolean;

  // Recent transactions
  recentTransactions: Transaction[];
  isLoadingTransactions: boolean;

  // Portfolio stats
  portfolioStats: OverallPnL | null;
  tradeStats: TransactionStats | null;
  isLoadingStats: boolean;

  // Trading settings
  tradingSettings: TradingSettings;

  // Error states
  error: string | null;

  // Actions
  setError: (error: string | null) => void;

  // Subscription actions
  setSubscriptions: (subscriptions: UserSubscription[]) => void;
  addSubscription: (subscription: UserSubscription) => void;
  removeSubscription: (kolWallet: string) => void;
  updateSubscription: (
    kolWallet: string,
    updates: Partial<UserSubscription>
  ) => void;
  setLoadingSubscriptions: (loading: boolean) => void;
  setHasLoadedSubscriptions: (loaded: boolean) => void;
  initializeSubscriptions: () => Promise<void>; // Add initialization function
  refreshSubscriptions: () => Promise<void>; // Add refresh function
  updateSubscriptionSettings: (
    kolWallet: string,
    updates: Partial<UserSubscription>
  ) => Promise<void>; // Add update subscription settings function

  // Live trades actions
  setLiveTradesFeed: (trades: KOLTrade[]) => void;
  addLiveTrade: (trade: KOLTrade) => void;
  setLoadingLiveTradesFeed: (loading: boolean) => void;
  clearLiveTradesFeed: () => void;

  // Transaction actions
  setRecentTransactions: (transactions: Transaction[]) => void;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  setLoadingTransactions: (loading: boolean) => void;

  // Stats actions
  setPortfolioStats: (stats: OverallPnL) => void;
  setTradeStats: (stats: TransactionStats) => void;
  setLoadingStats: (loading: boolean) => void;

  // Settings actions
  setTradingSettings: (settings: TradingSettings) => void;
  updateTradingSettings: (updates: Partial<TradingSettings>) => void;

  // Clear all data
  clearTradingData: () => void;
}

export const useTradingStore = create<TradingState>()(
  persist(
    (set, get) => ({
      // Initial state
      subscriptions: [],
      isLoadingSubscriptions: false,
      hasLoadedSubscriptions: false,
      liveTradesFeed: [],
      isLoadingLiveTradesFeed: false,
      recentTransactions: [],
      isLoadingTransactions: false,
      portfolioStats: null,
      tradeStats: null,
      isLoadingStats: false,
      tradingSettings: {
        slippage: 0.5,
        minSpend: 0.01,
        maxSpend: 1.0,
        useWatchConfig: false,
      },
      error: null,

      // Basic setters
      setError: error => set({ error }),

      // Subscription actions
      setSubscriptions: subscriptions => set({ subscriptions }),

      addSubscription: subscription => {
        const current = get().subscriptions;
        
        // If an array is passed, it's likely the full authoritative list from the backend
        if (Array.isArray(subscription)) {
          const validSubscriptions = subscription
            .filter(sub => sub && sub.kolWallet)
            .map(sub => ({
              ...sub,
              createdAt: sub.createdAt ? new Date(sub.createdAt) : new Date(),
              updatedAt: sub.updatedAt ? new Date(sub.updatedAt) : new Date(),
            }));
          set({ subscriptions: validSubscriptions });
          return;
        }

        const existing = current.find(
          s => s.kolWallet === subscription.kolWallet
        );

        if (!existing) {
          set({ 
            subscriptions: [...current, {
              ...subscription,
              createdAt: subscription.createdAt ? new Date(subscription.createdAt) : new Date(),
              updatedAt: subscription.updatedAt ? new Date(subscription.updatedAt) : new Date(),
            }] 
          });
        }
      },

      removeSubscription: kolWallet => {
        const current = get().subscriptions;
        set({
          subscriptions: current.filter(sub => sub.kolWallet !== kolWallet),
        });
      },

      updateSubscription: (kolWallet, updates) => {
        const current = get().subscriptions;
        set({
          subscriptions: current.map(sub =>
            sub.kolWallet === kolWallet ? { ...sub, ...updates } : sub
          ),
        });
      },

      setLoadingSubscriptions: isLoadingSubscriptions =>
        set({ isLoadingSubscriptions }),

      setHasLoadedSubscriptions: hasLoadedSubscriptions =>
        set({ hasLoadedSubscriptions }),

      initializeSubscriptions: async () => {
        const state = get();
        if (state.hasLoadedSubscriptions || state.isLoadingSubscriptions) {
          return; // Prevent duplicate calls
        }
        
        set({ isLoadingSubscriptions: true });
        try {
          void 0 && ('Initializing subscriptions from store...');
          const response = await TradingService.getUserSubscriptions();
          void 0 && ('Store API Response:', response);

          if (response.data) {
            // Filter out subscriptions without kolWallet and transform dates
            const validSubscriptions = response.data
              .filter(sub => sub.kolWallet) // Only include subscriptions with kolWallet
              .map(sub => ({
                ...sub,
                createdAt: sub.createdAt ? new Date(sub.createdAt) : new Date(),
                updatedAt: sub.updatedAt ? new Date(sub.updatedAt) : new Date(),
              }));

            set({ 
              subscriptions: validSubscriptions,
              hasLoadedSubscriptions: true,
              error: null
            });
            void 0 && ('Store: Successfully loaded subscriptions:', validSubscriptions);
          } else {
            throw new Error(response.message || 'Failed to fetch subscriptions');
          }
        } catch (error: any) {
          console.error('Store: Error fetching subscriptions:', error);

          // Check if it's a network/API error (endpoint not implemented yet)
          if (
            error.message?.includes('404') ||
            error.message?.includes('Not Found')
          ) {
            console.warn(
              'Store: Subscriptions API endpoint not yet implemented, using mock data for development'
            );

            // Use mock data for development until API is ready
            const mockData = [
              {
                id: '1',
                userId: 'user123',
                kolWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
                isActive: true,
                copyPercentage: 50,
                maxAmount: 1.0,
                minAmount: 0.1,
                privateKey: 'encrypted_key_1',
                createdAt: new Date('2024-01-15'),
                type: 'trade' as const,
                updatedAt: new Date('2024-01-15'),
              },
              {
                id: '2',
                userId: 'user123',
                kolWallet: 'DRiP2Pn2K6fuMLKQmt5rZWxa91wSmeSgmRW5Q6UWQ5CW',
                isActive: false,
                privateKey: 'encrypted_key_2',
                createdAt: new Date('2024-01-10'),
                type: 'watch' as const,
                updatedAt: new Date('2024-01-10'),
              },
              {
                id: '3',
                userId: 'user123',
                kolWallet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                isActive: true,
                copyPercentage: 25,
                maxAmount: 0.5,
                minAmount: 0.05,
                privateKey: 'encrypted_key_3',
                createdAt: new Date('2024-01-20'),
                type: 'trade' as const,
                updatedAt: new Date('2024-01-20'),
              },
            ];

            set({ 
              subscriptions: mockData,
              hasLoadedSubscriptions: true,
              error: null
            });
          } else {
            // Other types of errors
            set({ 
              error: error.message || 'Failed to load subscriptions',
              subscriptions: [],
              hasLoadedSubscriptions: true // Mark as loaded even on error to prevent retries
            });
          }
        } finally {
          set({ isLoadingSubscriptions: false });
        }
      },

      refreshSubscriptions: async () => {
        set({ 
          hasLoadedSubscriptions: false,
          isLoadingSubscriptions: true 
        });
        
        try {
          void 0 && ('Refreshing subscriptions from store...');
          const response = await TradingService.getUserSubscriptions();
          void 0 && ('Store Refresh API Response:', response);

          if (response.data) {
            // Filter out subscriptions without kolWallet and transform dates
            const validSubscriptions = response.data
              .filter(sub => sub.kolWallet) // Only include subscriptions with kolWallet
              .map(sub => ({
                ...sub,
                createdAt: sub.createdAt ? new Date(sub.createdAt) : new Date(),
                updatedAt: sub.updatedAt ? new Date(sub.updatedAt) : new Date(),
              }));

            set({ 
              subscriptions: validSubscriptions,
              hasLoadedSubscriptions: true,
              error: null
            });
            void 0 && ('Store: Successfully refreshed subscriptions:', validSubscriptions);
          } else {
            throw new Error(response.message || 'Failed to refresh subscriptions');
          }
        } catch (error: any) {
          console.error('Store: Error refreshing subscriptions:', error);
          set({ 
            error: error.message || 'Failed to refresh subscriptions',
            hasLoadedSubscriptions: true // Mark as loaded even on error to prevent retries
          });
        } finally {
          set({ isLoadingSubscriptions: false });
        }
      },

      updateSubscriptionSettings: async (kolWallet, updates) => {
        const current = get().subscriptions;
        const subscription = current.find(sub => sub.kolWallet === kolWallet);
        
        if (!subscription) {
          throw new Error('Subscription not found');
        }

        try {
          void 0 && ('Updating subscription settings for:', kolWallet);
          
          // Prepare the update request
          const updateRequest: UpdateUserSubscriptionRequest = {
            kolWallet,
            minAmount: updates.minAmount,
            maxAmount: updates.maxAmount,
            tokenBuyCount: (updates as any).tokenBuyCount,
            isActive: updates.isActive,
            type: updates.type,
            settings: updates.settings,
            watchConfig: updates.watchConfig,
          };

          const response = await TradingService.updateUserSubscription(updateRequest);
          void 0 && ('Store Update Subscription API Response:', response);

          if (response.data) {
            // Robustly handle if response.data is an array (which some backend methods do)
            const updatedData = Array.isArray(response.data) 
              ? response.data.find(s => s.kolWallet === kolWallet) || response.data[0]
              : response.data;

            if (!updatedData) {
               throw new Error('Updated subscription data not found in response');
            }

            // Update the subscription in the store with the response data
            const updatedSubscriptions = current.map(sub =>
              sub.kolWallet === kolWallet 
                ? { ...sub, ...updatedData, updatedAt: new Date() }
                : sub
            );
            set({ subscriptions: updatedSubscriptions, error: null });
            void 0 && ('Store: Successfully updated subscription settings for:', kolWallet);
          } else {
            throw new Error(response.message || 'Failed to update subscription settings');
          }
        } catch (error: any) {
          console.error('Store: Error updating subscription settings:', error);
          set({ error: error.message || 'Failed to update subscription settings' });
          throw error;
        }
      },

      // Live trades actions
      setLiveTradesFeed: liveTradesFeed => set({ liveTradesFeed }),

      addLiveTrade: trade => {
        const current = get().liveTradesFeed;
        // Add new trade at the beginning (most recent first)
        const updated = [trade, ...current].slice(0, 100); // Keep only 100 most recent
        set({ liveTradesFeed: updated });
      },

      setLoadingLiveTradesFeed: isLoadingLiveTradesFeed =>
        set({ isLoadingLiveTradesFeed }),

      clearLiveTradesFeed: () => set({ liveTradesFeed: [] }),

      // Transaction actions
      setRecentTransactions: recentTransactions => set({ recentTransactions }),

      addTransaction: transaction => {
        const current = get().recentTransactions;
        const updated = [transaction, ...current];
        set({ recentTransactions: updated });
      },

      updateTransaction: (id, updates) => {
        const current = get().recentTransactions;
        set({
          recentTransactions: current.map(txn =>
            txn.id === id ? { ...txn, ...updates } : txn
          ),
        });
      },

      setLoadingTransactions: isLoadingTransactions =>
        set({ isLoadingTransactions }),

      // Stats actions
      setPortfolioStats: portfolioStats => set({ portfolioStats }),
      setTradeStats: tradeStats => set({ tradeStats }),
      setLoadingStats: isLoadingStats => set({ isLoadingStats }),

      // Settings actions
      setTradingSettings: tradingSettings => set({ tradingSettings }),

      updateTradingSettings: updates => {
        const current = get().tradingSettings;
        set({ tradingSettings: { ...current, ...updates } });
      },

      // Clear all data
      clearTradingData: () =>
        set({
          subscriptions: [],
          liveTradesFeed: [],
          recentTransactions: [],
          portfolioStats: null,
          tradeStats: null,
          error: null,
        }),
    }),
    {
      name: STORAGE_KEYS.TRADING_SETTINGS,
      partialize: state => ({
        // Only persist settings and subscriptions, not live data
        tradingSettings: state.tradingSettings,
        subscriptions: state.subscriptions,
      }),
    }
  )
);

// Helper hooks for common trading operations
export const useSubscriptions = () => {
  const {
    subscriptions,
    isLoadingSubscriptions,
    hasLoadedSubscriptions,
    setSubscriptions,
    addSubscription,
    removeSubscription,
    updateSubscription,
    setLoadingSubscriptions,
    setHasLoadedSubscriptions,
    initializeSubscriptions,
    refreshSubscriptions,
    updateSubscriptionSettings,
  } = useTradingStore();

  return {
    subscriptions,
    isLoadingSubscriptions,
    hasLoadedSubscriptions,
    setSubscriptions,
    addSubscription,
    removeSubscription,
    updateSubscription,
    setLoadingSubscriptions,
    setHasLoadedSubscriptions,
    initializeSubscriptions,
    refreshSubscriptions,
    updateSubscriptionSettings,
    // Convenience methods
    isSubscribedToKOL: (kolWallet: string) =>
      subscriptions.some(sub => sub.kolWallet === kolWallet && sub.isActive),
    getSubscription: (kolWallet: string) =>
      subscriptions.find(sub => sub.kolWallet === kolWallet),
  };
};

export const useLiveTradesFeed = () => {
  const {
    liveTradesFeed,
    isLoadingLiveTradesFeed,
    setLiveTradesFeed,
    addLiveTrade,
    setLoadingLiveTradesFeed,
    clearLiveTradesFeed,
  } = useTradingStore();

  return {
    liveTradesFeed,
    isLoadingLiveTradesFeed,
    setLiveTradesFeed,
    addLiveTrade,
    setLoadingLiveTradesFeed,
    clearLiveTradesFeed,
  };
};

export const usePortfolioStats = () => {
  const {
    portfolioStats,
    tradeStats,
    isLoadingStats,
    setPortfolioStats,
    setTradeStats,
    setLoadingStats,
  } = useTradingStore();

  return {
    portfolioStats,
    tradeStats,
    isLoadingStats,
    setPortfolioStats,
    setTradeStats,
    setLoadingStats,
  };
};

export default useTradingStore;
