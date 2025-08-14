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
    SIGNIN: '/auth/signin',
    SIGNUP: '/auth/signup',
    SIGNOUT: '/auth/signout',
    VERIFY_OTP: '/auth/verify-otp',
    RESEND_OTP: '/auth/resend-otp',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password',
    LINK_TELEGRAM_USER: '/auth/link-telegram-user',
    UNLINK_TELEGRAM_USER: '/auth/unlink-telegram-user',
    GET_PROFILE: '/auth/get-profile',
    UPDATE_PROFILE: '/auth/update-profile',
    GET_SECURITY_SETTINGS: '/auth/get-security-settings',
    GET_OAUTH_PROVIDERS: '/auth/get-oauth-providers',
    CONNECT_OAUTH_PROVIDER: '/auth/connect-oauth-provider',
    DISCONNECT_OAUTH_PROVIDER: '/auth/disconnect-oauth-provider',
    TOGGLE_TWO_FACTOR: '/auth/toggle-two-factor',
    TERMINATE_SESSION: '/auth/terminate-session',
    SIGNUP_VCS: '/auth/signup-vcs',
  },

  // Wallet Authentication (SIWS - Sign in with Solana)
  WALLET: {
    CHALLENGE: '/wallet/challenge',
    SIGNUP: '/wallet/signup',
    SIGNIN: '/wallet/verify',
    LINK: '/wallet/link',
    UNLINK: '/wallet/unlink',
    INFO: '/wallet/info',
  },

  // OAuth
  OAUTH: {
    GOOGLE_URL: '/oauth/google/url',
    GOOGLE_CALLBACK: '/oauth/google/callback',
    VERIFY_TOKEN: '/oauth/verify-token',
    SIGNIN: '/oauth/auth/oauth/signin',
    GOOGLE: '/oauth/google',
    FACEBOOK: '/oauth/facebook',
  },

  // Features
  FEATURES: {
    // Solana Agent
    GET_SOLANA_AGENT_DETAILS: '/features/get-solana-agent-details',
    SETUP_COPY_TRADER: '/features/setup-copy-trader',

    // User Account
    GET_USER_ACCOUNT_DETAILS: '/features/get-user-account-details',

    // Settings
    GET_TRADING_SETTINGS: '/features/get-trading-settings',
    UPDATE_TRADING_SETTINGS: '/features/update-trading-settings',

    // KOL Management
    ADD_KOL_TO_WEBHOOK: '/features/add-kol-to-webhook',
    REMOVE_KOL_FROM_WEBHOOK: '/features/remove-kol-from-webhook',
    GET_KOL_WALLETS: '/features/get-kol-wallets',
    GET_RECENT_KOL_TRADES: '/features/get-recent-kol-trades',
    GET_TRADE_HISTORY: '/features/get-trade-history',
    GET_ADDRESS_TRANSACTIONS: '/features/get-address-transactions',
    SUBSCRIBE_TO_KOL: '/features/subscribe-to-kol',
    UNSUBSCRIBE_FROM_KOL: '/features/unsubscribe-from-kol',
    GET_USER_SUBSCRIPTIONS: '/features/get-user-subscriptions',
    UPDATE_USER_SUBSCRIPTION: '/features/update-user-subscription',

    // PnL and Statistics
    GET_USER_PNL: '/features/get-user-pnl',
    GET_TOKEN_PNL: '/features/get-token-pnl',
    GET_USER_TRADE_STATS: '/features/get-user-trade-stats',
    GET_USER_TRANSACTION_DETAILS: '/features/get-user-transaction-details',
    GET_USER_TRANSACTIONS: '/features/get-user-transactions',
    GET_USER_TRANSACTION_BY_MINT: '/features/get-user-transaction-by-mint',

    // Trading
    PERFORM_SWAP: '/features/perform-swap',
    PREDICT_TRADE: '/features/predict-trade',

    // Token Discovery
    SEARCH_TOKENS: '/features/search-tokens',
    GET_TOKEN: '/features/get-token',
    GET_MULTIPLE_TOKENS: '/features/multiple-tokens',
    GET_TRENDING_TOKENS: '/features/get-trending-tokens',
    GET_TOKENS_BY_VOLUME: '/features/get-tokens-by-volume',
    GET_LATEST_TOKENS: '/features/get-latest-tokens',
  },

  // Notifications
  NOTIFICATIONS: {
    GET_NOTIFICATIONS: '/notifications',
    GET_STATS: '/notifications/stats',
    MARK_READ: '/notifications/:id/read',
    MARK_ALL_READ: '/notifications/read-all',
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
