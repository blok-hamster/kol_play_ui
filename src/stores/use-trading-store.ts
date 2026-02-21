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
import { TradingSettings as ITradingSettings } from '@/types';

const DEFAULT_AGENT_SETTINGS: ITradingSettings = {
  slippage: 0.5,
  minSpend: 0.01,
  maxSpend: 1.0,
  useWatchConfig: true,
  watchConfig: {
    takeProfitPercentage: 50,
    stopLossPercentage: 15,
    enableTrailingStop: false,
    trailingPercentage: 10,
    maxHoldTimeMinutes: 1440,
  },
  enableMarketCapFilter: true,
  minMarketCap: 10000,
  maxMarketCap: 50000000,
  enableLiquidityFilter: true,
  minLiquidity: 50000,
  tokenBlacklist: [],
  dexWhitelist: ['Raydium', 'Jupiter', 'Orca', 'Pump.fun'],
  useTurboPriority: false,
  paperTrading: false,
  maxConcurrentTrades: 3,
  minKOLConvergence: 1,
  convergenceWindowMinutes: 60,
  afkEnabled: false,
  afkBuyAmount: 0.1,
  runFrequency: 60,
  workflowTemplate: 'FULL_AUTONOMY',
  enableTimeRestrictions: false,
  tradingHours: {
    start: '00:00',
    end: '23:59',
    timezone: 'UTC',
  },
};

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
  isPaperTrading: boolean;

  // Error states
  error: string | null;

  // Actions
  setPaperTrading: (enabled: boolean) => void;
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
  ) => Promise<void>;
  bulkUpdateSubscriptionSettings: (
    updates: UpdateUserSubscriptionRequest[]
  ) => Promise<void>;

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
  saveTradingSettings: () => Promise<void>;
  fetchTradingSettings: () => Promise<void>;

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
        useWatchConfig: true,
        watchConfig: {
          takeProfitPercentage: 50,
          stopLossPercentage: 15,
          enableTrailingStop: false,
          trailingPercentage: 10,
          maxHoldTimeMinutes: 1440, // 24 hours
        },
        enableMarketCapFilter: true,
        minMarketCap: 10000,
        maxMarketCap: 50000000,
        enableLiquidityFilter: true,
        minLiquidity: 50000,
        tokenBlacklist: [],
        dexWhitelist: ['Raydium', 'Jupiter', 'Orca', 'Pump.fun'],
        useTurboPriority: false,
        paperTrading: false,
        maxConcurrentTrades: 3,
        minKOLConvergence: 1,
        convergenceWindowMinutes: 60,
        afkEnabled: false,
        afkBuyAmount: 0.1,
        runFrequency: 60,
        enableTimeRestrictions: false,
        tradingHours: {
          start: '00:00',
          end: '23:59',
          timezone: 'UTC',
        },
        agentSettings: DEFAULT_AGENT_SETTINGS,
      },
      isPaperTrading: false, // Default to Real execution, user can toggle
      error: null,

      // Basic setters
      setPaperTrading: enabled => {
        const currentSettings = get().tradingSettings;
        set({ 
          isPaperTrading: enabled,
          tradingSettings: { ...currentSettings, paperTrading: enabled }
        });
      },
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
          const response = await TradingService.getUserSubscriptions();

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
            // Successfully loaded subscriptions
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
          const response = await TradingService.getUserSubscriptions();

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
            // Successfully refreshed subscriptions
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
          // Prepare the update request
          const updateRequest: UpdateUserSubscriptionRequest = {
            kolWallet,
            minAmount: updates.minAmount,
            maxAmount: updates.maxAmount,
            tokenBuyCount: (updates as any).tokenBuyCount,
            isActive: updates.isActive,
            type: updates.type,
            settings: updates.settings as any,
            watchConfig: updates.watchConfig as any,
          };

          const response = await TradingService.updateUserSubscription(updateRequest);

          if (response.data) {
            // Robustly handle if response.data is an array (which some backend methods do)
            const updatedData = Array.isArray(response.data) 
              ? response.data.find((s: any) => s.kolWallet === kolWallet) || response.data[0]
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
            // Successfully updated subscription settings
          } else {
            throw new Error(response.message || 'Failed to update subscription settings');
          }
        } catch (error: any) {
          console.error('Store: Error updating subscription settings:', error);
          set({ error: error.message || 'Failed to update subscription settings' });
          throw error;
        }
      },

      bulkUpdateSubscriptionSettings: async (updates) => {
        set({ isLoadingSubscriptions: true });
        try {
          const response = await TradingService.bulkUpdateSubscriptions(updates);
          if (response.data) {
            const current = get().subscriptions;
            const updatedSubs = response.data;
            
            const newSubscriptions = current.map(sub => {
              const update = updatedSubs.find(u => u.kolWallet === sub.kolWallet);
              return update ? { ...sub, ...update, updatedAt: new Date() } : sub;
            });

            set({ subscriptions: newSubscriptions, error: null });
          } else {
            throw new Error(response.message || 'Failed to bulk update subscriptions');
          }
        } catch (error: any) {
          console.error('Store: Error bulk updating subscriptions:', error);
          set({ error: error.message || 'Failed to bulk update subscriptions' });
          throw error;
        } finally {
          set({ isLoadingSubscriptions: false });
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

      updateTradingSettings: (updates: Partial<TradingSettings>) => {
        const current = get().tradingSettings;
        set({ tradingSettings: { ...current, ...updates } });
      },

      saveTradingSettings: async () => {
        const settings = get().tradingSettings;
        set({ isLoadingStats: true }); // Use loading stats as overlay
        try {
          const response = await TradingService.updateTradingSettings(settings);
          if (response.success) {
            set({ error: null });
            // Successfully saved trading settings
          } else {
            throw new Error(response.message || 'Failed to save settings');
          }
        } catch (error: any) {
          console.error('Store: Error saving trading settings:', error);
          set({ error: error.message || 'Failed to save settings' });
          throw error;
        } finally {
          set({ isLoadingStats: false });
        }
      },
      
      fetchTradingSettings: async () => {
        set({ isLoadingStats: true });
        try {
          const response = await TradingService.getTradingSettings();
          if (response.data) {
            // Map structured backend settings back to flat store settings
            const backendSettings: any = response.data;
            const tradeConfig = backendSettings.tradeConfig || {};
            const watchConfig = backendSettings.watchConfig || {};
            
            const mergedSettings: TradingSettings = {
              ...get().tradingSettings,
              slippage: tradeConfig.slippage ?? 0.5,
              minSpend: tradeConfig.minSpend ?? 0.01,
              maxSpend: tradeConfig.maxSpend ?? 1.0,
              useWatchConfig: tradeConfig.useWatchConfig ?? true,
              paperTrading: tradeConfig.paperTrading ?? false,
              useTurboPriority: tradeConfig.useTurboPriority ?? false,
              enableMarketCapFilter: tradeConfig.enableMarketCapFilter ?? true,
              minMarketCap: tradeConfig.minMarketCap ?? 10000,
              maxMarketCap: tradeConfig.maxMarketCap ?? 50000000,
              enableLiquidityFilter: tradeConfig.enableLiquidityFilter ?? true,
              minLiquidity: tradeConfig.minLiquidity ?? 50000,
              tokenBlacklist: tradeConfig.tokenBlacklist ?? [],
              dexWhitelist: tradeConfig.dexWhitelist ?? ['Raydium', 'Jupiter', 'Orca', 'Pump.fun'],
              maxConcurrentTrades: tradeConfig.maxConcurrentTrades ?? 3,
              watchConfig: {
                takeProfitPercentage: watchConfig.takeProfitPercentage ?? 50,
                stopLossPercentage: watchConfig.stopLossPercentage ?? 15,
                enableTrailingStop: watchConfig.enableTrailingStop ?? false,
                trailingPercentage: watchConfig.trailingPercentage ?? 10,
                maxHoldTimeMinutes: watchConfig.maxHoldTimeMinutes ?? 1440,
              },
              minKOLConvergence: tradeConfig.minKOLConvergence ?? 1,
              convergenceWindowMinutes: tradeConfig.convergenceWindowMinutes ?? 60,
              afkEnabled: tradeConfig.afkEnabled ?? false,
              afkBuyAmount: tradeConfig.afkBuyAmount ?? 0.1,
              runFrequency: tradeConfig.runFrequency ?? 60,
              enableTimeRestrictions: tradeConfig.enableTimeRestrictions ?? false,
              tradingHours: tradeConfig.tradingHours ?? {
                start: '00:00',
                end: '23:59',
                timezone: 'UTC',
              },
              agentSettings: backendSettings.agentConfig ? {
                slippage: backendSettings.agentConfig.slippage ?? 0.5,
                minSpend: backendSettings.agentConfig.minSpend ?? 0.01,
                maxSpend: backendSettings.agentConfig.maxSpend ?? 1.0,
                useWatchConfig: backendSettings.agentConfig.useWatchConfig ?? true,
                paperTrading: backendSettings.agentConfig.paperTrading ?? false,
                useTurboPriority: backendSettings.agentConfig.useTurboPriority ?? false,
                enableMarketCapFilter: backendSettings.agentConfig.enableMarketCapFilter ?? true,
                minMarketCap: backendSettings.agentConfig.minMarketCap ?? 10000,
                maxMarketCap: backendSettings.agentConfig.maxMarketCap ?? 50000000,
                enableLiquidityFilter: backendSettings.agentConfig.enableLiquidityFilter ?? true,
                minLiquidity: backendSettings.agentConfig.minLiquidity ?? 50000,
                tokenBlacklist: backendSettings.agentConfig.tokenBlacklist ?? [],
                dexWhitelist: backendSettings.agentConfig.dexWhitelist ?? ['Raydium', 'Jupiter', 'Orca', 'Pump.fun'],
                maxConcurrentTrades: backendSettings.agentConfig.maxConcurrentTrades ?? 3,
                minKOLConvergence: backendSettings.agentConfig.minKOLConvergence ?? 1,
                convergenceWindowMinutes: backendSettings.agentConfig.convergenceWindowMinutes ?? 60,
                afkEnabled: backendSettings.agentConfig.afkEnabled ?? false,
                afkBuyAmount: backendSettings.agentConfig.afkBuyAmount ?? 0.1,
                runFrequency: backendSettings.agentConfig.runFrequency ?? 60,
                enableTimeRestrictions: backendSettings.agentConfig.enableTimeRestrictions ?? false,
                tradingHours: backendSettings.agentConfig.tradingHours ?? {
                  start: '00:00',
                  end: '23:59',
                  timezone: 'UTC',
                },
                watchConfig: backendSettings.agentConfig.watchConfig ?? {
                  takeProfitPercentage: backendSettings.agentConfig.takeProfitPercentage ?? 50,
                  stopLossPercentage: backendSettings.agentConfig.stopLossPercentage ?? 15,
                  enableTrailingStop: backendSettings.agentConfig.enableTrailingStop ?? false,
                  trailingPercentage: backendSettings.agentConfig.trailingPercentage ?? 10,
                  maxHoldTimeMinutes: backendSettings.agentConfig.maxHoldTimeMinutes ?? 1440,
                },
              } : (get().tradingSettings.agentSettings || DEFAULT_AGENT_SETTINGS),
            };
            
            set({ 
              tradingSettings: mergedSettings,
              isPaperTrading: mergedSettings.paperTrading || false,
              error: null 
            });
          }
        } catch (error: any) {
          console.error('Store: Error fetching trading settings:', error);
        } finally {
          set({ isLoadingStats: false });
        }
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
        // Only persist settings, subscriptions, and paper trading mode
        tradingSettings: state.tradingSettings,
        subscriptions: state.subscriptions,
        isPaperTrading: state.isPaperTrading,
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
    bulkUpdateSubscriptionSettings,
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
    bulkUpdateSubscriptionSettings,
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
