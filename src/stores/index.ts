// Store exports
export { useUIStore } from './use-ui-store';
export { useUserStore } from './use-user-store';
export { useTradingStore } from './use-trading-store';
export { useTokenStore } from './use-token-store'; // This is a named export, not default
export { useNotificationStore } from './use-notification-store';
export { useKOLTradeStore } from './use-kol-trade-store';
export { useKOLStore } from './use-kol-store';

// Helper Hooks for UI Store
export { useNotifications, useModal, useLoading } from './use-ui-store';

// Helper Hooks for Notification Store
export {
  useNotifications as useBackendNotifications,
  useNotificationStats,
} from './use-notification-store';

// Helper Hooks for Trading Store
export {
  useSubscriptions,
  useLiveTradesFeed,
  usePortfolioStats,
} from './use-trading-store';

// Helper Hooks for Token Store
export {
  useTokenSearch,
  useTokenCategories,
  useWatchlist,
  useTokenDetails,
} from './use-token-store';

// Store types for convenience (optional - can be removed if not used)
export type { UserState } from './use-user-store';
export type { UIState } from './use-ui-store';
export type { TradingState } from './use-trading-store';
export type { TokenState } from './use-token-store';
