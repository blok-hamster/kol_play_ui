// WebSocket Hooks
export { useWebSocket, useWebSocketStatus } from './use-websocket';
export type { UseWebSocketOptions, WebSocketStatus } from './use-websocket';

// Real-time Update Hooks
export {
  useRealTimeUpdates,
  useLiveTradesUpdates,
  usePriceUpdates,
  usePortfolioUpdates,
  useTokenDiscoveryUpdates,
} from './use-realtime-updates';
export type {
  RealTimeSubscription,
  UseRealTimeUpdatesOptions,
} from './use-realtime-updates';

// KOL Trade Hooks
export { useKOLTradeSocket } from './use-kol-trade-socket';
export type { KOLTrade, MindmapUpdate } from './use-kol-trade-socket';
