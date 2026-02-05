'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  getRealTimeUpdateService,
  UpdateSubscription,
  BatchingConfig,
} from '@/services/realtime-update.service';
import { useTradingStore, useTokenStore, useUserStore } from '@/stores';
import { KOLTrade, SearchTokenResult, OverallPnL } from '@/types';

export interface RealTimeSubscription {
  trades?:
    | boolean
    | {
        condition?: (trade: KOLTrade) => boolean;
        throttle?: number;
        onTrade?: (trade: KOLTrade) => void;
      };
  prices?:
    | boolean
    | {
        mints?: string[];
        significantChangesOnly?: boolean;
        throttle?: number;
      };
  balance?:
    | boolean
    | {
        throttle?: number;
      };
  portfolio?:
    | boolean
    | {
        throttle?: number;
      };
  tokens?:
    | boolean
    | {
        categories?: string[];
        throttle?: number;
      };
}

export interface UseRealTimeUpdatesOptions {
  subscriptions: RealTimeSubscription;
  config?: Partial<BatchingConfig>;
  enabled?: boolean;
}

export const useRealTimeUpdates = (options: UseRealTimeUpdatesOptions) => {
  const { subscriptions, config, enabled = true } = options;

  // Store references - using selectors to prevent unnecessary re-renders
  const addLiveTrade = useTradingStore(s => s.addLiveTrade);
  const setPortfolioStats = useTradingStore(s => s.setPortfolioStats);
  
  const watchlist = useTokenStore(s => s.watchlist);
  const setTrendingTokens = useTokenStore(s => s.setTrendingTokens);
  const setHighVolumeTokens = useTokenStore(s => s.setHighVolumeTokens);
  const setLatestTokens = useTokenStore(s => s.setLatestTokens);
  
  // Service reference
  const serviceRef = useRef(getRealTimeUpdateService(config));
  const subscriptionIdsRef = useRef<string[]>([]);

  // Cleanup function
  const cleanup = useCallback(() => {
    const service = serviceRef.current;
    subscriptionIdsRef.current.forEach(id => {
      service.unsubscribe(id);
    });
    subscriptionIdsRef.current = [];
  }, []);

  // Trade update handler
  const handleTradeUpdates = useCallback(
    (data: KOLTrade | KOLTrade[]) => {
      const trades = Array.isArray(data) ? data : [data];

      trades.forEach(trade => {
        addLiveTrade(trade);
        
        // Call local callback if provided
        const tradeConfig = typeof subscriptions.trades === 'object' ? subscriptions.trades : {};
        if (tradeConfig.onTrade) {
          tradeConfig.onTrade(trade);
        }
      });
    },
    [addLiveTrade, subscriptions.trades]
  );

  // Price update handler
  const handlePriceUpdates = useCallback(
    (data: any) => {
      const updates = Array.isArray(data) ? data : [data];

      // Updates would typically go to a price store or cache
      // For now, we can update token store if it's for watched tokens
      updates.forEach(
        (update: { mint: string; price: number; change24h: number }) => {
          // Update could trigger token store updates for watchlist items
          const isWatched = watchlist.some(token => token.mint === update.mint);

          if (isWatched) {
            // Could trigger a notification or update
            void 0 && ('Price update for watched token:', update);
          }
        }
      );
    },
    [watchlist]
  );

  // Balance update handler
  const handleBalanceUpdates = useCallback(
    (data: { balance: number; timestamp: number }) => {
      // This would typically update the user's balance in the user store
      // For now, we'll log it as the user store doesn't have a direct balance update method
      void 0 && ('Balance update received:', data);
    },
    []
  );

  // Portfolio update handler
  const handlePortfolioUpdates = useCallback(
    (data: OverallPnL) => {
      setPortfolioStats(data);
    },
    [setPortfolioStats]
  );

  // Token update handler
  const handleTokenUpdates = useCallback(
    (data: any) => {
      const updates = Array.isArray(data) ? data : [data];

      updates.forEach(
        (update: { tokens: SearchTokenResult[]; category: string }) => {
          switch (update.category) {
            case 'trending':
              setTrendingTokens(update.tokens);
              break;
            case 'volume':
              setHighVolumeTokens(update.tokens);
              break;
            case 'latest':
              setLatestTokens(update.tokens);
              break;
            default:
              void 0 && ('Unknown token category update:', update.category);
          }
        }
      );
    },
    [setTrendingTokens, setHighVolumeTokens, setLatestTokens]
  );

  // Setup subscriptions
  const setupSubscriptions = useCallback(() => {
    if (!enabled) return;

    const service = serviceRef.current;
    const newSubscriptionIds: string[] = [];

    // Trade subscriptions
    if (subscriptions.trades) {
      const tradeConfig =
        typeof subscriptions.trades === 'object' ? subscriptions.trades : {};

      const tradeSubId = service.subscribe({
        type: 'TRADE',
        callback: handleTradeUpdates,
        condition: tradeConfig.condition,
        throttle: tradeConfig.throttle || 100, // Default 100ms throttle
      });

      newSubscriptionIds.push(tradeSubId);
    }

    // Price subscriptions
    if (subscriptions.prices) {
      const priceConfig =
        typeof subscriptions.prices === 'object' ? subscriptions.prices : {};

      const priceCondition = priceConfig.mints
        ? (data: any) => priceConfig.mints!.includes(data.mint)
        : priceConfig.significantChangesOnly
          ? (data: any) => Math.abs(data.change24h) > 5
          : undefined;

      const priceSubId = service.subscribe({
        type: 'PRICE',
        callback: handlePriceUpdates,
        condition: priceCondition,
        throttle: priceConfig.throttle || 500, // Default 500ms throttle for prices
      });

      newSubscriptionIds.push(priceSubId);
    }

    // Balance subscriptions
    if (subscriptions.balance) {
      const balanceConfig =
        typeof subscriptions.balance === 'object' ? subscriptions.balance : {};

      const balanceSubId = service.subscribe({
        type: 'BALANCE',
        callback: handleBalanceUpdates,
        throttle: balanceConfig.throttle || 1000, // Default 1s throttle for balance
      });

      newSubscriptionIds.push(balanceSubId);
    }

    // Portfolio subscriptions
    if (subscriptions.portfolio) {
      const portfolioConfig =
        typeof subscriptions.portfolio === 'object'
          ? subscriptions.portfolio
          : {};

      const portfolioSubId = service.subscribe({
        type: 'PORTFOLIO',
        callback: handlePortfolioUpdates,
        throttle: portfolioConfig.throttle || 2000, // Default 2s throttle for portfolio
      });

      newSubscriptionIds.push(portfolioSubId);
    }

    // Token subscriptions
    if (subscriptions.tokens) {
      const tokenConfig =
        typeof subscriptions.tokens === 'object' ? subscriptions.tokens : {};

      const tokenCondition = tokenConfig.categories
        ? (data: any) => tokenConfig.categories!.includes(data.category)
        : undefined;

      const tokenSubId = service.subscribe({
        type: 'TOKEN',
        callback: handleTokenUpdates,
        condition: tokenCondition,
        throttle: tokenConfig.throttle || 1000, // Default 1s throttle for tokens
      });

      newSubscriptionIds.push(tokenSubId);
    }

    subscriptionIdsRef.current = newSubscriptionIds;
  }, [
    enabled,
    subscriptions,
    handleTradeUpdates,
    handlePriceUpdates,
    handleBalanceUpdates,
    handlePortfolioUpdates,
    handleTokenUpdates,
  ]);

  // Effect to setup and cleanup subscriptions
  useEffect(() => {
    cleanup();
    setupSubscriptions();

    return cleanup;
  }, [cleanup, setupSubscriptions]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    service: serviceRef.current,
    subscriptionCount: subscriptionIdsRef.current.length,
    isEnabled: enabled,
  };
};

// Specialized hooks for common use cases

/**
 * Hook for components that need live trade updates
 */
export const useLiveTradesUpdates = (options?: {
  kolWallets?: string[];
  throttle?: number;
}) => {
  return useRealTimeUpdates({
    subscriptions: {
      trades: {
        condition: options?.kolWallets
          ? (trade: KOLTrade) => options.kolWallets!.includes(trade.kolWallet)
          : undefined,
        throttle: options?.throttle,
      },
    },
  });
};

/**
 * Hook for components that need price updates for specific tokens
 */
export const usePriceUpdates = (
  mints: string[],
  options?: {
    significantOnly?: boolean;
    throttle?: number;
  }
) => {
  return useRealTimeUpdates({
    subscriptions: {
      prices: {
        mints,
        significantChangesOnly: options?.significantOnly,
        throttle: options?.throttle,
      },
    },
  });
};

/**
 * Hook for portfolio-related components
 */
export const usePortfolioUpdates = (options?: {
  includeBalance?: boolean;
  throttle?: number;
}) => {
  return useRealTimeUpdates({
    subscriptions: {
      portfolio: {
        throttle: options?.throttle,
      },
      ...(options?.includeBalance && {
        balance: {
          throttle: options?.throttle,
        },
      }),
    },
  });
};

/**
 * Hook for token discovery components
 */
export const useTokenDiscoveryUpdates = (
  categories?: string[],
  options?: {
    throttle?: number;
  }
) => {
  return useRealTimeUpdates({
    subscriptions: {
      tokens: {
        categories,
        throttle: options?.throttle,
      },
    },
  });
};
