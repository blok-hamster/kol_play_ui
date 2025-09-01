// Theme constants
export const THEME_CONFIG = {
  STORAGE_KEY: 'kol-play-theme',
  MODES: {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system',
  } as const,
} as const;

// API endpoints
export const API_ENDPOINTS = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',

  // Authentication
  AUTH: {
    SIGNIN: '/api/auth/signin',
    SIGNUP: '/api/auth/signup',
    SIGNOUT: '/api/auth/signout',
    VERIFY_OTP: '/api/auth/verify-otp',
    RESEND_OTP: '/api/auth/resend-otp',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
    CHANGE_PASSWORD: '/api/auth/change-password',
    LINK_TELEGRAM_USER: '/api/auth/link-telegram-user',
    UNLINK_TELEGRAM_USER: '/api/auth/unlink-telegram-user',
    GET_PROFILE: '/api/auth/get-profile',
    UPDATE_PROFILE: '/api/auth/update-profile',
    GET_SECURITY_SETTINGS: '/api/auth/get-security-settings',
    GET_OAUTH_PROVIDERS: '/api/auth/get-oauth-providers',
    CONNECT_OAUTH_PROVIDER: '/api/auth/connect-oauth-provider',
    DISCONNECT_OAUTH_PROVIDER: '/api/auth/disconnect-oauth-provider',
    TOGGLE_TWO_FACTOR: '/api/auth/toggle-two-factor',
    TERMINATE_SESSION: '/api/auth/terminate-session',
    SIGNUP_VCS: '/api/auth/signup-vcs',
  },

  // Wallet Authentication (SIWS - Sign in with Solana)
  WALLET: {
    CHALLENGE: '/api/wallet/challenge',
    SIGNUP: '/api/wallet/signup',
    SIGNIN: '/api/wallet/verify',
    LINK: '/api/wallet/link',
    UNLINK: '/api/wallet/unlink',
    INFO: '/api/wallet/info',
  },

  // OAuth
  OAUTH: {
    GOOGLE_URL: '/api/oauth/google/url',
    GOOGLE_CALLBACK: '/api/oauth/google/callback',
    VERIFY_TOKEN: '/api/oauth/verify-token',
    SIGNIN: '/api/oauth/auth/oauth/signin',
    GOOGLE: '/api/oauth/google',
    FACEBOOK: '/api/oauth/facebook',
  },

  // Features
  FEATURES: {
    // Solana Agent
    GET_SOLANA_AGENT_DETAILS: '/api/features/get-solana-agent-details',
    SETUP_COPY_TRADER: '/api/features/setup-copy-trader',

    // User Account
    GET_USER_ACCOUNT_DETAILS: '/api/features/get-user-account-details',

    // Settings
    GET_TRADING_SETTINGS: '/api/features/get-trading-settings',
    UPDATE_TRADING_SETTINGS: '/api/features/update-trading-settings',

    // KOL Management
    ADD_KOL_TO_WEBHOOK: '/api/features/add-kol-to-webhook',
    REMOVE_KOL_FROM_WEBHOOK: '/api/features/remove-kol-from-webhook',
    GET_KOL_WALLETS: '/api/features/get-kol-wallets',
    GET_RECENT_KOL_TRADES: '/api/features/get-recent-kol-trades',
    GET_TRADE_HISTORY: '/api/features/get-trade-history',
    GET_ADDRESS_TRANSACTIONS: '/api/features/get-address-transactions',
    SUBSCRIBE_TO_KOL: '/api/features/subscribe-to-kol',
    UNSUBSCRIBE_FROM_KOL: '/api/features/unsubscribe-from-kol',
    GET_USER_SUBSCRIPTIONS: '/api/features/get-user-subscriptions',
    UPDATE_USER_SUBSCRIPTION: '/api/features/update-user-subscription',

    // PnL and Statistics
    GET_USER_PNL: '/api/features/get-user-pnl',
    GET_TOKEN_PNL: '/api/features/get-token-pnl',
    GET_USER_TRADE_STATS: '/api/features/get-user-trade-stats',
    GET_USER_TRANSACTION_DETAILS: '/api/features/get-user-transaction-details',
    GET_USER_TRANSACTIONS: '/api/features/get-user-transactions',
    GET_USER_TRANSACTION_BY_MINT: '/api/features/get-user-transaction-by-mint',

    // Trading
    PERFORM_SWAP: '/api/features/perform-swap',
    TRANSFER_SOL: '/api/features/transfer-sol',
    TRANSFER_TOKEN: '/api/features/transfer-token',
    PREDICT_TRADE: '/api/features/predict-trade',

    // Token Discovery
    SEARCH_TOKENS: '/api/features/search-tokens',
    GET_TOKEN: '/api/features/get-token',
    GET_MULTIPLE_TOKENS: '/api/features/multiple-tokens',
    GET_TRENDING_TOKENS: '/api/features/get-trending-tokens',
    GET_TOKENS_BY_VOLUME: '/api/features/get-tokens-by-volume',
    GET_LATEST_TOKENS: '/api/features/get-latest-tokens',
  },

  // Notifications
  NOTIFICATIONS: {
    GET_NOTIFICATIONS: '/api/notifications',
    GET_STATS: '/api/notifications/stats',
    MARK_READ: '/api/notifications/:id/read',
    MARK_ALL_READ: '/api/notifications/read-all',
  },
} as const;

// Application configuration
export const APP_CONFIG = {
  NAME: 'KOL Play',
  DESCRIPTION: 'Solana Copy Trading Platform',
  VERSION: '1.0.0',

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Search
  SEARCH_DEBOUNCE_MS: 300,
  MIN_SEARCH_LENGTH: 2,

  // WebSocket
  WS_RECONNECT_INTERVAL: 5000,
  WS_MAX_RECONNECT_ATTEMPTS: 5,

  // Notifications
  DEFAULT_NOTIFICATION_DURATION: 5000,

  // Trading
  DEFAULT_SLIPPAGE: 0.5,
  MIN_SLIPPAGE: 0.1,
  MAX_SLIPPAGE: 10,

  // Format
  WALLET_ADDRESS_DISPLAY_LENGTH: 8,
  CURRENCY_DECIMALS: 2,
  TOKEN_DECIMALS: 6,
} as const;

// Wallet configuration
export const WALLET_CONFIG = {
  RPC_ENDPOINT: 'https://api.mainnet-beta.solana.com',
  COMMITMENT: 'confirmed',
  // SIWS Configuration
  DOMAIN: (() => {
    const envDomain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!envDomain) return 'localhost:3000';
    
    // If domain includes protocol, extract hostname only
    if (envDomain.includes('://')) {
      try {
        const url = new URL(envDomain.startsWith('http') ? envDomain : `https://${envDomain}`);
        return url.hostname;
      } catch {
        return envDomain.replace(/^https?:\/\//, '');
      }
    }
    return envDomain;
  })(),
  STATEMENT:
    'Sign in to verify your wallet ownership. This request will not trigger any blockchain transaction or cost any gas fees.',
  NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta',
} as const;

// Social links
export const SOCIAL_LINKS = {
  TWITTER: 'https://twitter.com',
  TELEGRAM: 'https://telegram.org',
  DISCORD: 'https://discord.com',
  GITHUB: 'https://github.com',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Please log in to continue.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'Something went wrong. Please try again later.',
  WALLET_NOT_CONNECTED: 'Please connect your wallet first.',
  INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Successfully logged in!',
  SIGNUP_SUCCESS: 'Account created successfully!',
  LOGOUT_SUCCESS: 'Successfully logged out!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
  SUBSCRIPTION_SUCCESS: 'Successfully subscribed to KOL!',
  UNSUBSCRIPTION_SUCCESS: 'Successfully unsubscribed from KOL!',
  TRADE_SUCCESS: 'Trade executed successfully!',
  COPY_SUCCESS: 'Copied to clipboard!',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'userData',
  THEME: 'kol-play-theme',
  ONBOARDING_COMPLETED: 'onboardingCompleted',
  TRADING_SETTINGS: 'tradingSettings',
  TOKEN_DATA: 'tokenData',
  SWAP_SETTINGS: 'swapSettings',
} as const;

// Mindmap filtering constants
export const MINDMAP_FILTER_CONFIG = {
  // Solana base token mint address to exclude from mindmap visualization
  SOLANA_BASE_TOKEN_MINT: 'So11111111111111111111111111111111111111112',
  
  // Minimum thresholds for meaningful connections
  MIN_TRADE_COUNT: 1,
  MIN_VOLUME_THRESHOLD: 0.001, // Minimum SOL volume to consider
  MIN_INFLUENCE_SCORE: 0,
  
  // Cache configuration for metadata
  METADATA_CACHE_TTL: 5 * 60 * 1000, // 5 minutes in milliseconds
  METADATA_CACHE_MAX_SIZE: 1000, // Maximum number of cached items
  FALLBACK_CACHE_TTL: 2 * 60 * 1000, // 2 minutes for fallback data
  
  // Performance optimization thresholds
  MAX_NODES_MOBILE: 50,
  MAX_NODES_DESKTOP: 200,
  MAX_LINKS_MOBILE: 100,
  MAX_LINKS_DESKTOP: 500,
} as const;
