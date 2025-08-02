// Auth services
export * from './auth.service';
export * from './siws-auth.service';
export * from './oauth.service';
export { default as WalletService } from './wallet.service';

// Core Feature Services
export { default as FeaturesService } from './features.service';
export { default as TradingService } from './trading.service';
export { default as TokenService } from './token.service';
export { default as PortfolioService } from './portfolio.service';
export { default as SwapService } from './swap.service';

// Real-time Services
export {
  default as WebSocketService,
  getWebSocketService,
  initializeWebSocket,
} from './websocket.service';
export {
  default as RealTimeUpdateService,
  getRealTimeUpdateService,
} from './realtime-update.service';

// Export service types for convenience
export type {
  SetupCopyTraderResponse,
  SolanaAgentDetails,
} from './features.service';
export type {
  KOLWallet,
  SubscribeToKOLRequest,
  RecentKOLTradesRequest,
} from './trading.service';
export type {
  SearchTokensRequest,
  GetTrendingTokensRequest,
  GetTokensByVolumeRequest,
  GetLatestTokensRequest,
} from './token.service';
export type {
  GetTransactionsRequest,
  GetTransactionByMintRequest,
} from './portfolio.service';
export type {
  PerformSwapRequest,
  SwapQuoteRequest,
  SwapQuoteResponse,
  SwapResult,
} from './swap.service';
export type {
  WebSocketConfig,
  QueueMessage,
  WebSocketEventHandlers,
} from './websocket.service';
export type {
  UpdateBatch,
  UpdateSubscription,
  BatchingConfig,
} from './realtime-update.service';
