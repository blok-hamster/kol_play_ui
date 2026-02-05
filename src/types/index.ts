// Authentication Types
export interface AccountDetails {
  address: string;
  balance: number;
  tokens: {
    mint: string;
    name: string;
    symbol: string;
    image?: string;
    balance: number;
    value: number;
  }[];
  // USD value fields
  solValueUsd?: number; // SOL balance in USD
  totalValueUsd?: number; // Total portfolio value in USD
  // Optional error flags for when account details couldn't be fetched
  _hasError?: boolean;
  _errorMessage?: string;
  // Sometimes backend sends error property instead of proper structure
  error?: string;
}

export interface User {
  id: string;
  email?: string; // Optional for wallet-only authentication
  firstName?: string; // Optional for wallet-only authentication
  lastName?: string; // Optional for wallet-only authentication
  displayName?: string; // Display name for user profile
  avatar?: string; // Avatar URL for user profile
  verified?: boolean;
  telegramId?: string;
  telegramUsername?: string;
  walletAddress?: string; // For wallet authentication - encoded address from backend
  accountDetails?: AccountDetails;
  createdAt?: string; // Creation timestamp
  updatedAt?: string; // Last update timestamp
}

export interface AuthResponse {
  message: string;
  data: {
    user: User;
    token: string;
    isNewUser?: boolean;
  };
}

export interface OAuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  isNewUser?: boolean;
  error?: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  inviteCode?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface VerifyOTPRequest {
  email: string;
  otp: string;
}

// KOL Trading Types
export interface KOLWallet {
  id: string;
  walletAddress: string;
  name?: string;
  description?: string;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  subscriberCount: number;
  isActive: boolean;
  avatar?: string; // Optional avatar/profile image
  socialLinks?: {
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PredictionResult {
  /** Task type this prediction applies to */
  taskType: string;
  
  // Classification-specific fields
  /** Predicted class index - classification only */
  classIndex?: number;
  /** Predicted class label - classification only */
  classLabel?: string;
  /** Prediction probability/confidence - classification only */
  probability?: number;
  /** All class probabilities (for multi-class) - classification only */
  probabilities?: number[];
  
  // Regression-specific fields
  /** Predicted numeric value - regression only */
  value?: number;
  /** Prediction confidence interval - regression only */
  confidenceInterval?: [number, number];
}

export interface SocketKOLTrade {
  id: string;
  kolWallet: string;
  signature: string;
  timestamp: Date | string;
  tradeData: {
    tokenIn: string;
    tokenOut: string;
    amountIn: number;
    amountOut: number;
    tradeType: 'buy' | 'sell';
    mint?: string;
    dexProgram: string;
    fee?: number;
    name?: string;
    symbol?: string;
    image?: string;
    metadataUri?: string;
    prediction?: PredictionResult;
  };
  affectedUsers?: string[];
  processed?: boolean;
  prediction?: PredictionResult;
  isFeatured?: boolean;
  label?: string;
  mindmapContribution?: number;
}

export type KOLTradeUnion = SocketKOLTrade | KOLTrade;
 

export interface KOLTrade {
  id: string;
  kolWallet: string;
  kolName?: string; // Optional KOL name for display
  signature: string;
  timestamp: Date;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  tradeType: 'buy' | 'sell';
  mint?: string;
  // New optional token metadata fields
  name?: string;
  symbol?: string;
  image?: string;
  metadataUri?: string;
  dexProgram: string;
  slotNumber?: number;
  blockTime?: number;
  fee?: number;
  prediction?: PredictionResult;
  mindmapContribution?: number;
  label?: string;
}

export interface KOLStats {
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  totalVolume: number;
  avgTradeSize: number;
  lastActive: Date;
}

export interface KOLLeaderboardItem {
  address: string;
  stats: KOLStats;
  rank: number;
}

export interface KOLHistoryResponse {
  trades: KOLTrade[];
  stats: KOLStats;
  timeframe: string;
}

export interface UserSubscription {
  id?: string;
  userId: string;
  kolWallet: string;
  isActive: boolean;
  copyPercentage?: number; // 0-100%
  minAmount?: number;
  maxAmount?: number;
  label?: string;
  source?: string;
  maxAmountPerDay?: number;
  privateKey: string; // Encrypted
  walletAddress?: string;
  createdAt?: Date;
  type: 'trade' | 'watch';
  updatedAt?: Date;
  settings?: SubscriptionSettings;
  watchConfig?: WatchConfig;
}

export interface SubscriptionSettings {
  enableSlippageProtection?: boolean;
  maxSlippagePercent?: number;
  enableDexWhitelist?: boolean;
  allowedDexes?: string[];
  enableTokenBlacklist?: boolean;
  blacklistedTokens?: string[];
  enableTimeRestrictions?: boolean;
  tradingHours?: {
    start: string;
    end: string;
    timezone: string;
  };
}

// Trading and Portfolio Types
export interface WatchConfig {
  takeProfitPercentage: number;
  stopLossPercentage: number;
  enableTrailingStop: boolean;
  trailingPercentage: number;
  maxHoldTimeMinutes: number;
}

export interface TradingSettings {
  slippage?: number;
  minSpend?: number;
  maxSpend?: number;
  useWatchConfig?: boolean;
  paperTrading?: boolean;
  watchConfig?: WatchConfig;
}

export interface SwapData {
  tradeType: 'buy' | 'sell';
  amount: number;
  mint: string;
  slippage?: number;
  priority?: 'low' | 'medium' | 'high';
  limitPrice?: number;
  watchConfig?: {
    takeProfitPercentage?: number;
    stopLossPercentage?: number;
    enableTrailingStop?: boolean;
    trailingPercentage?: number;
    maxHoldTimeMinutes?: number;
  };
}

export interface Transaction {
  id: string;
  agentId: string;
  mint: string;
  action: string;
  amountIn: number;
  amountOut: number;
  executionPrice: number;
  status: string;
  transactionHash?: string;
  timestamp?: number;
  fees?: number;
  notes?: string;
}

export interface TransactionDetails {
  trx: Transaction;
  totalValueSOL: number;
  tokenAmount: number;
  pricePerToken: number;
}

// PnL and Statistics Types
export interface OverallPnL {
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalSOLSpent: number;
  totalSOLReceived: number;
  netSOLFlow: number;
}

export interface TokenPnL {
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  totalTokensBought: number;
  totalTokensSold: number;
  currentHoldings: number;
  averageBuyPrice: number;
  investedAmount: number;
  receivedAmount: number;
  investedInCurrentHoldings: number;
}

export interface TransactionStats {
  totalTrades: number;
  totalBuyTrades: number;
  totalSellTrades: number;
  totalSOLTraded: number;
  totalSOLSpent: number;
  totalSOLReceived: number;
  uniqueTokensTraded: number;
  averageTradeSize: number;
  totalFeesPaid: number;
  firstTradeDate: Date | null;
  lastTradeDate: Date | null;
  tradingPeriodDays: number;
  winRate: number;
  pnlStats: OverallPnL;
}

// Token Types
export interface Token {
  name: string;
  symbol: string;
  mint: string;
  uri?: string;
  decimals: number;
  description?: string;
  image?: string;
  logoURI?: string; // Alternative image URL
  hasFileMetaData?: boolean;
  createdOn?: number | string; // Unix timestamp or creation platform URL
  showName?: boolean;
  twitter?: string;
  telegram?: string;
  website?: string;
  strictSocials?: Record<string, any>;

  // Price and market data (optional for compatibility)
  price?: number;
  priceUsd?: number;
  marketCap?: number;
  marketCapUsd?: number;
  liquidity?: number;
  liquidityUsd?: number;

  // Additional market data
  holders?: number;
  verified?: boolean;
  jupiter?: boolean;
}

/** Pair liquidity details */
export interface Liquidity {
  quote: number;
  usd: number;
}

/** Price information */
export interface Price {
  quote: number;
  usd: number;
}

/** Market capitalization details */
export interface MarketCap {
  quote: number;
  usd: number;
}

/** Transaction counts */
export interface Txns {
  buys: number;
  sells: number;
  total?: number;
  volume?: number;
}

/** Security authorities */
export interface Security {
  freezeAuthority: string | null;
  mintAuthority: string | null;
}

/** Pool entry for a token */
export interface Pool {
  poolId: string;
  liquidity: Liquidity;
  price: Price;
  tokenSupply: number;
  lpBurn: number;
  tokenAddress: string;
  marketCap: MarketCap;
  market: string;
  quoteToken?: string;
  decimals: number;
  security: Security;
  lastUpdated: number;
  deployer?: string;
  txns: Txns;
  curve?: string;
  curvePercentage?: number;
  createdAt?: number;
}

/** Price change event over intervals */
export interface PriceChange {
  priceChangePercentage: number;
}

/** Collection of price change events keyed by timeframe */
export type Events = Record<string, PriceChange>;

/** Risk assessment item */
export interface RiskItem {
  name: string;
  description: string;
  level: string;
  score: number;
}

/** Risk assessment for a token */
export interface Risk {
  rugged: boolean;
  risks: RiskItem[];
  score: number;
  jupiterVerified?: boolean;
}

/** Detailed token response from multiple-tokens endpoint */
export interface GetTokenResponse {
  mint?: string;
  token: Token;
  pools: Pool[];
  events: Events;
  risk: Risk;
  buys: number;
  sells: number;
  txns: number;
  holders: number;
}

// Legacy alias for backward compatibility
export type TokenDetails = GetTokenResponse;

export interface SearchTokenResult {
  name: string;
  symbol: string;
  mint: string;
  decimals: number;
  image: string;
  logoURI?: string; // Alternative image URL for compatibility
  holders: number;
  jupiter: boolean;
  verified: boolean;
  liquidityUsd: number;
  marketCapUsd: number;
  priceUsd: number;
  // Add compatibility properties
  price?: number;
  marketCap?: number;
  priceChange24h?: number;
  volume24h?: number;
  liquidity?: number;
  lpBurn: number;
  market: string;
  freezeAuthority: string | null;
  mintAuthority: string | null;
  poolAddress: string;
  totalBuys: number;
  totalSells: number;
  totalTransactions: number;
  volume_5m: number;
  volume: number;
  volume_15m: number;
  volume_30m: number;
  volume_1h: number;
  volume_6h: number;
  volume_12h: number;
  volume_24h: number;

  // For latest tokens support
  createdOn?: number; // Unix timestamp
}

// API Response Types
export interface ApiResponse<T = any> {
  success?: boolean;
  message: string;
  data: T;
  error?: string;
}

// UI State Types
export interface ThemeConfig {
  mode: 'light' | 'dark' | 'system';
}

export interface NotificationConfig {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

// Backend Notification System Types
export interface NotificationItem {
  id: string;
  type: 'trade_alert' | 'price_alert' | 'system' | 'portfolio' | 'security' | 'client_notification';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  data?: any; // Additional context data
  isRead?: boolean; // Optional since API returns 'read' instead
  read?: boolean; // API returns this property
  createdAt?: string; // Optional since API might use timestamp
  timestamp?: string; // API uses this property
  readAt?: string;
  telegramSent?: boolean; // Optional since API might use sentToTelegram
  sentToTelegram?: boolean; // API uses this property
  userId: string;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface NotificationMetadata {
  totalUnread: number;
  oldestUnread?: string;
  newestNotification?: string;
}

export interface PriorityStats {
  low: number;
  medium: number;
  high: number;
  urgent: number;
}

export interface TypeStats {
  trade_alert: number;
  price_alert: number;
  system: number;
  portfolio: number;
  security: number;
  client_notification: number;
}

export interface RecentNotificationSummary {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  isRead: boolean;
}

// API Response interfaces
export interface GetNotificationsResponse extends ApiResponse {
  success: true;
  data: {
    notifications: NotificationItem[];
    pagination: PaginationInfo;
    metadata: NotificationMetadata;
  };
}

export interface GetNotificationStatsResponse extends ApiResponse {
  success: true;
  data: {
    totalCount: number;
    unreadCount: number;
    telegramSentCount: number;
    priorityStats: PriorityStats;
    typeStats: TypeStats;
    mostRecent: RecentNotificationSummary | null;
  };
}

export interface MarkNotificationReadResponse extends ApiResponse {
  success: true;
  message: 'Notification marked as read';
}

export interface MarkAllNotificationsReadResponse extends ApiResponse {
  success: true;
  message: string;
}

export interface GetNotificationsQuery {
  limit?: number; // 1-100, default: 50
  offset?: number; // default: 0
  unreadOnly?: boolean; // default: false
}

// Wallet Types
export interface WalletInfo {
  address: string;
  balance: number;
  isConnected: boolean;
}

// Solana Types
export interface SolanaTokenInfo {
  mintAddress: string;
  balance: number;
  decimals: number;
  uiAmount: number;
  name?: string | undefined;
  symbol?: string | undefined;
  logoURI?: string | undefined;
  valueUsd?: number; // USD value of the token holding
}

export interface SolanaWalletBalance {
  address: string;
  solBalance: number; // SOL balance in SOL units
  tokens: SolanaTokenInfo[];
  totalTokens: number;
}

export interface SolanaTokenMetadata {
  name?: string | undefined;
  symbol?: string | undefined;
  logoURI?: string | undefined;
  decimals: number;
}

export interface SolanaConnectionConfig {
  rpcUrl?: string;
  commitment?: 'processed' | 'confirmed' | 'finalized' | undefined;
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface TradeAlert {
  kolWallet: string;
  trade: KOLTrade;
}

// Mindmap Types
export interface MindmapUpdate {
  tokenMint: string;
  kolConnections: {
    [kolWallet: string]: {
      kolWallet: string;
      tradeCount: number;
      totalVolume: number;
      lastTradeTime: Date;
      influenceScore: number;
      tradeTypes: string[];
    };
  };
  relatedTokens: string[];
  networkMetrics: {
    centrality: number;
    clustering: number;
    totalTrades: number;
  };
  lastUpdate: Date;
}

// Enhanced Mindmap Types for unified enhancement
export interface EnhancedMindmapUpdate extends MindmapUpdate {
  // Enhanced metadata
  tokenMetadata?: TokenMetadata;
  kolMetadata: { [kolWallet: string]: KOLMetadata };
  
  // Filtering flags
  isFeaturedToken: boolean;
  hasSubscribedKOLs: boolean;
}

export interface TokenMetadata {
  name?: string;
  symbol?: string;
  image?: string;
  fallbackImage?: string;
  lastUpdated: number;
  // Additional metadata from token store
  decimals?: number;
  holders?: number;
  verified?: boolean;
  jupiter?: boolean;
  liquidityUsd?: number;
  marketCapUsd?: number;
  priceUsd?: number;
}

export interface KOLMetadata {
  name?: string;
  avatar?: string;
  socialLinks?: SocialLinks;
  fallbackAvatar?: string;
  lastUpdated: number;
  // Additional KOL metadata
  displayName?: string;
  description?: string;
  totalTrades?: number;
  winRate?: number;
  totalPnL?: number;
  subscriberCount?: number;
  isActive?: boolean;
}

export interface SocialLinks {
  twitter?: string;
  telegram?: string;
  discord?: string;
  website?: string;
}

export interface FilteredNetworkData {
  nodes: EnhancedUnifiedNode[];
  links: EnhancedUnifiedLink[];
  metadata: NetworkMetadata;
}

export interface NetworkMetadata {
  totalTokens: number;
  totalKOLs: number;
  featuredKOLs: number;
  subscribedKOLs: number;
  filteredTokens: number;
  filteredKOLs: number;
  lastUpdate: Date;
}

export interface EnhancedUnifiedNode {
  id: string;
  type: 'token' | 'kol';
  label: string;
  name?: string; // Display name for tokens/KOLs
  image?: string; // Image URL for tokens/KOLs
  value: number; // For sizing
  connections: number; // Number of connections
  totalVolume?: number;
  tradeCount?: number;
  influenceScore?: number;
  isTrending?: boolean;
  tokenMint?: string; // For KOL nodes, which token they're connected to
  relatedTokens?: string[]; // For KOL nodes, all tokens they trade
  
  // Enhanced metadata
  metadata?: TokenMetadata | KOLMetadata;
  displayName: string;
  displayImage?: string;
  
  // D3 simulation properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

export interface EnhancedUnifiedLink {
  source: string | EnhancedUnifiedNode;
  target: string | EnhancedUnifiedNode;
  value: number; // Link strength
  tradeCount: number;
  volume: number;
  
  // Enhanced metadata
  lastTradeTime?: Date;
  tradeTypes?: string[];
  averageTradeSize?: number;
}

// Enhanced Mindmap Types for unified enhancement
// ... existing types ...

export interface UnifiedNode extends EnhancedUnifiedNode {
  // Add simplified D3 node properties to fix typing
  // EnhancedUnifiedNode already covers most, but we ensure explicit compatibility here
  symbol?: string;
  decimals?: number;
  metadataUri?: string;
  website?: string;
  twitter?: string;
  displayName: string;
}

export interface UnifiedLink {
  source: string | EnhancedUnifiedNode;
  target: string | EnhancedUnifiedNode;
  value: number;
  tradeCount: number;
  volume: number;
  strength?: number;
  frequency?: number;
  lastActivity?: Date;
}

// Cache management types
export interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  lastCleanup: Date;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

// Store integration types
export interface TokenStoreIntegration {
  getTokenFromStore(mint: string): SearchTokenResult | null;
  cacheTokenInStore(token: SearchTokenResult): void;
  enrichTokenWithStoreData(tokenData: any): TokenMetadata;
}

export interface KOLStoreIntegration {
  getKOLFromStore(walletAddress: string): KOLWallet | null;
  cacheKOLInStore(kol: KOLWallet): void;
  enrichKOLWithStoreData(kolData: any): KOLMetadata;
}

// Top Trader Types
export interface TopTrader {
  wallet: string;
  summary: {
    realized: number;
    unrealized: number;
    total: number;
    totalInvested: number;
    totalWins: number;
    totalLosses: number;
    averageBuyAmount: number;
    winPercentage: number;
    lossPercentage: number;
    neutralPercentage: number;
  };
}

// Search and Filter Types
export interface SearchFilters {
  query?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  showAllPools?: boolean;
}

export interface SearchTokensRequest {
  query: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  showAllPools?: boolean;
}

// Address search types
export interface AddressSearchResult {
  address: string;
  isKOL?: boolean;
  displayName?: string;
  totalTransactions?: number;
  solBalance?: number;
  tokenCount?: number;
  lastActivity?: number;
  verified?: boolean;
  description?: string;
}

export interface SearchAddressRequest {
  address: string;
}

// Unified search types
export type UnifiedSearchResult =
  | { type: 'token'; data: SearchTokenResult }
  | { type: 'address'; data: AddressSearchResult };

export interface UnifiedSearchRequest {
  query: string;
  page?: number;
  limit?: number;
  includeTokens?: boolean;
  includeAddresses?: boolean;
}

export interface TokenFilters extends SearchFilters {
  timeframe?: string;
  minLiquidity?: number;
  maxLiquidity?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  verified?: boolean;
}

export interface TokenSearchFilters {
  query?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  minPrice?: number;
  maxPrice?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  verified?: boolean;
}

export interface TradeFilters {
  kolWallet?: string;
  tradeType?: 'buy' | 'sell' | 'all';
  minAmount?: number;
  maxAmount?: number;
  timeRange?: '1h' | '4h' | '24h' | '7d' | '30d' | 'all';
  tokenFilter?: string;
  sortBy?: 'timestamp' | 'amount' | 'kolName';
  sortOrder?: 'asc' | 'desc';
}

// Trade History Types
export interface TradeHistoryEntry {
  id: string;
  agentId: string;
  tokenMint: string;
  status: 'open' | 'closed' | 'failed';
  openedAt: Date | string;
  closedAt?: Date | string;
  entryPrice: number;
  entryAmount: number;
  entryValue: number;
  buyTransactionId?: string;
  exitPrice?: number;
  exitAmount?: number;
  exitValue?: number;
  sellTransactionId?: string;
  sellReason?: string;
  // On-Chain High Fidelity Data
  onChainEntryPrice?: number;
  onChainEntryValue?: number;
  onChainExitPrice?: number;
  onChainExitValue?: number;
  exactNetworkFee?: number;
  reconciledStatus?: 'pending' | 'verified' | 'failed_reconciliation';
  isSimulation?: boolean;
  
  realizedPnL?: number;
  realizedPnLPercentage?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercentage?: number;
  highestPrice?: number;
  lowestPrice?: number;
  currentPrice?: number;
  currentValue?: number;
  lastPriceUpdate?: Date | string;
  sellConditions: {
    takeProfitPercentage?: number;
    stopLossPercentage?: number;
    trailingStopPercentage?: number;
    maxHoldTimeMinutes?: number;
  };
  ledgerId?: string;
  originalTradeId?: string;
  watchJobId?: string;
  tags?: string[];
  notes?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface TradeStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercentage?: number;
  averagePnL: number;
  averagePnLPercentage?: number;
  averageWinAmount?: number;
  averageLossAmount?: number;
  largestWin: number;
  largestLoss: number;
  averageHoldTime: number; // in minutes
}

export interface TradeHistoryStatsResponse {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  agents: number;
  tokens: number;
}

export interface QueryTradesRequest {
  tokenMint?: string;
  status?: 'open' | 'closed' | 'failed';
  startDate?: string;
  endDate?: string;
  minPnL?: number;
  maxPnL?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
}
