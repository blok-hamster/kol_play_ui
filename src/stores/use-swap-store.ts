'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Token,
  TradingSettings,
  WatchConfig,
  SwapQuoteResponse,
  SwapResult,
  PerformSwapRequest,
  SwapData,
} from '@/types';
import { SwapService } from '@/services';
import { STORAGE_KEYS } from '@/lib/constants';

interface SwapState {
  // Selected tokens
  fromToken: Token | null; // Always SOL
  toToken: Token | null;

  // Amounts
  fromAmount: string;
  toAmount: string;

  // Quote data
  currentQuote: SwapQuoteResponse | null;
  isLoadingQuote: boolean;
  quoteError: string | null;

  // Transaction state
  isSwapping: boolean;
  lastSwapResult: SwapResult | null;
  swapError: string | null;

  // Settings
  slippage: number;
  priority: 'low' | 'medium' | 'high';
  tradingSettings: TradingSettings;

  // Watch config
  useWatchConfig: boolean;
  watchConfig: WatchConfig;

  // UI state
  showSettings: boolean;
  showWatchConfig: boolean;
  showConfirmDialog: boolean;

  // Actions
  setFromToken: (token: Token | null) => void;
  setToToken: (token: Token | null) => void;
  setFromAmount: (amount: string) => void;
  setToAmount: (amount: string) => void;

  // Quote actions
  getQuote: () => Promise<void>;
  clearQuote: () => void;

  // Swap actions
  performSwap: () => Promise<void>;
  clearSwapResult: () => void;

  // Settings actions
  updateSlippage: (slippage: number) => void;
  updatePriority: (priority: 'low' | 'medium' | 'high') => void;
  updateTradingSettings: (settings: Partial<TradingSettings>) => void;
  updateWatchConfig: (config: Partial<WatchConfig>) => void;
  toggleWatchConfig: () => void;

  // UI actions
  toggleSettings: () => void;
  toggleWatchConfigModal: () => void;
  toggleConfirmDialog: () => void;

  // Utility actions
  swapTokens: () => void;
  reset: () => void;
}

const defaultWatchConfig: WatchConfig = {
  takeProfitPercentage: 50,
  stopLossPercentage: 20,
  enableTrailingStop: false,
  trailingPercentage: 10,
  maxHoldTimeMinutes: 1440, // 24 hours
};

const defaultTradingSettings: TradingSettings = {
  slippage: 0.5,
  minSpend: 0.01,
  maxSpend: 1.0,
  useWatchConfig: false,
  watchConfig: defaultWatchConfig,
};

// Default SOL token
const SOL_TOKEN: Token = {
  name: 'Solana',
  symbol: 'SOL',
  mint: 'So11111111111111111111111111111111111111112',
  decimals: 9,
  image: '/images/sol-logo.png',
  verified: true,
  jupiter: true,
};

export const useSwapStore = create<SwapState>()(
  persist(
    (set, get) => ({
      // Initial state
      fromToken: SOL_TOKEN,
      toToken: null,
      fromAmount: '',
      toAmount: '',

      currentQuote: null,
      isLoadingQuote: false,
      quoteError: null,

      isSwapping: false,
      lastSwapResult: null,
      swapError: null,

      slippage: 0.5,
      priority: 'medium',
      tradingSettings: defaultTradingSettings,

      useWatchConfig: false,
      watchConfig: defaultWatchConfig,

      showSettings: false,
      showWatchConfig: false,
      showConfirmDialog: false,

      // Token actions
      setFromToken: token => set({ fromToken: token }),
      setToToken: token => {
        set({ toToken: token });
        // Clear amounts and quote when token changes
        if (token) {
          get().getQuote();
        } else {
          set({ toAmount: '', currentQuote: null });
        }
      },

      setFromAmount: amount => {
        set({ fromAmount: amount });
        if (amount && get().toToken) {
          // Debounce quote updates
          setTimeout(() => {
            if (get().fromAmount === amount) {
              get().getQuote();
            }
          }, 500);
        } else {
          set({ toAmount: '', currentQuote: null });
        }
      },

      setToAmount: amount => set({ toAmount: amount }),

      // Quote actions
      getQuote: async () => {
        const { fromAmount, toToken } = get();

        if (!fromAmount || !toToken || parseFloat(fromAmount) <= 0) {
          set({ currentQuote: null, toAmount: '' });
          return;
        }

        set({ isLoadingQuote: true, quoteError: null });

        try {
          const response = await SwapService.getSwapQuote({
            tradeType: 'buy',
            amount: parseFloat(fromAmount),
            mint: toToken.mint,
            slippage: get().slippage,
          });

          if (response.data) {
            set({
              currentQuote: response.data,
              toAmount: response.data.outputAmount.toString(),
              isLoadingQuote: false,
            });
          }
        } catch (error) {
          set({
            quoteError:
              error instanceof Error ? error.message : 'Failed to get quote',
            isLoadingQuote: false,
            currentQuote: null,
            toAmount: '',
          });
        }
      },

      clearQuote: () =>
        set({
          currentQuote: null,
          toAmount: '',
          quoteError: null,
        }),

      // Swap actions
      performSwap: async () => {
        const { fromAmount, toToken, useWatchConfig, watchConfig } = get();

        if (!fromAmount || !toToken) {
          set({ swapError: 'Please select token and amount' });
          return;
        }

        set({ isSwapping: true, swapError: null });

        try {
          const request: SwapData = {
            tradeType: 'buy',
            amount: parseFloat(fromAmount),
            mint: toToken.mint,
            ...(useWatchConfig && { watchConfig }),
          };

          const response = await SwapService.performSwap(request);

          if (response.data) {
            set({
              lastSwapResult: response.data,
              isSwapping: false,
              showConfirmDialog: false,
              // Reset form
              fromAmount: '',
              toAmount: '',
              currentQuote: null,
            });
          }
        } catch (error) {
          set({
            swapError: error instanceof Error ? error.message : 'Swap failed',
            isSwapping: false,
          });
        }
      },

      clearSwapResult: () => set({ lastSwapResult: null, swapError: null }),

      // Settings actions
      updateSlippage: slippage => {
        set({ slippage });
        if (get().fromAmount && get().toToken) {
          get().getQuote();
        }
      },

      updatePriority: priority => set({ priority }),

      updateTradingSettings: settings =>
        set({
          tradingSettings: { ...get().tradingSettings, ...settings },
        }),

      updateWatchConfig: config =>
        set({
          watchConfig: { ...get().watchConfig, ...config },
        }),

      toggleWatchConfig: () => set({ useWatchConfig: !get().useWatchConfig }),

      // UI actions
      toggleSettings: () => set({ showSettings: !get().showSettings }),
      toggleWatchConfigModal: () =>
        set({ showWatchConfig: !get().showWatchConfig }),
      toggleConfirmDialog: () =>
        set({ showConfirmDialog: !get().showConfirmDialog }),

      // Utility actions
      swapTokens: () => {
        const { fromToken, toToken, fromAmount, toAmount } = get();
        // For now, we only support SOL -> Token swaps, so this would reverse to Token -> SOL
        if (toToken) {
          set({
            fromToken: toToken,
            toToken: SOL_TOKEN,
            fromAmount: toAmount,
            toAmount: fromAmount,
            currentQuote: null,
          });
          get().getQuote();
        }
      },

      reset: () =>
        set({
          fromToken: SOL_TOKEN,
          toToken: null,
          fromAmount: '',
          toAmount: '',
          currentQuote: null,
          quoteError: null,
          swapError: null,
          lastSwapResult: null,
          showSettings: false,
          showWatchConfig: false,
          showConfirmDialog: false,
        }),
    }),
    {
      name: STORAGE_KEYS.SWAP_SETTINGS,
      partialize: state => ({
        slippage: state.slippage,
        priority: state.priority,
        tradingSettings: state.tradingSettings,
        useWatchConfig: state.useWatchConfig,
        watchConfig: state.watchConfig,
      }),
    }
  )
);

export default useSwapStore;
