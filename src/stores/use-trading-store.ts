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

interface TradingState {
  // KOL Subscriptions
  subscriptions: UserSubscription[];
  isLoadingSubscriptions: boolean;

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
        const existing = current.find(
          s => s.kolWallet === subscription.kolWallet
        );

        if (!existing) {
          set({ subscriptions: [...current, subscription] });
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
    setSubscriptions,
    addSubscription,
    removeSubscription,
    updateSubscription,
    setLoadingSubscriptions,
  } = useTradingStore();

  return {
    subscriptions,
    isLoadingSubscriptions,
    setSubscriptions,
    addSubscription,
    removeSubscription,
    updateSubscription,
    setLoadingSubscriptions,
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
