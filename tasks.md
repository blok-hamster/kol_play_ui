# Implementation Plan

- [x] 1. Project Setup and Core Infrastructure
  - [x] Initialize Next.js 14 project with TypeScript and configure build system
  - [x] Set up Tailwind CSS with custom design system supporting light/dark themes
  - [x] Configure theme colors: Dark (#171616, #f5f5f5), Light (#ffffff, #1a1a1a, #f8f9fa), Accent gradient (#eaff8d to #14f195)
  - [x] Configure ESLint, Prettier, and TypeScript strict mode
  - [x] Set up folder structure (app/, components/, hooks/, lib/, services/, stores/, types/, utils/)
  - [x] Create core utilities, types, constants, and API client configuration
  - [x] Set up theme management system with useTheme hook
  - _Requirements: 10.1, 10.5_ ✅ **COMPLETED**

- [x] 2. Authentication System Implementation
  - [x] 2.1 Create authentication service layer and API client
    - [x] Implement Axios client with JWT interceptors for API communication
    - [x] Create authentication service integrating `/auth/signup`, `/auth/signin`, `/auth/verify-otp`, `/auth/resend-otp`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/signout`
    - [x] Add OAuth service methods for `/oauth/google/url`, `/oauth/google/callback`, `/oauth/verify-token`
    - [x] Implement error handling for whitelist restrictions (EMAIL_NOT_WHITELISTED) and API failures
    - [x] Create WalletService for Phantom wallet integration (auth-only)
    - [x] Create UserStore with Zustand for authentication and wallet state management
    - [x] Create UIStore for modal states, notifications, and loading indicators
    - _Requirements: 1.2, 1.3, 1.8_ ✅ **COMPLETED**

  - [x] 2.2 Build authentication UI components
    - [x] Create AuthModal component with tabs for different auth methods
    - [x] Implement SignUpForm with email/password validation and OTP verification
    - [x] Build SignInForm with email/password and "Forgot Password" flow
    - [x] Add Google OAuth integration with redirect handling
    - [x] Create reusable UI components (Button, Input, Modal, Tabs)
    - [x] Implement proper form validation and error handling
    - [x] Add Phantom wallet connection UI with installation detection
    - [x] Create responsive design with proper accessibility
    - _Requirements: 1.1, 1.4, 1.7_ ✅ **COMPLETED**

  - [x] 2.3 Implement Phantom wallet integration for authentication
    - [x] Set up Solana Wallet Adapter with Phantom wallet support for auth only
    - [x] Create WalletConnector component for authentication flow (not trading)
    - [x] Add wallet authentication flow using connected wallet address for login
    - [x] Implement wallet disconnect functionality and auth state management
    - [x] Create WalletAdapterProvider with proper Solana RPC configuration
    - [x] Build useWalletAuth hook for unified wallet authentication state
    - [x] Integrate CustomWalletButton with AuthModal for seamless UX
    - [x] Add clear messaging that trading uses backend-generated wallets
    - Note: Trading uses backend-generated wallet, not connected wallet
    - _Requirements: 1.6, 2.4_ ✅ **COMPLETED**

  - [x] 2.4 Implement post-signup onboarding flow
    - [x] Create OnboardingTour component with interactive application walkthrough
    - [x] Call `/features/setup-copy-trader` endpoint automatically after successful signup/verification
    - [x] Display loading state with progress indicators while wallet and AI assistant are being created
    - [x] Build guided tour highlighting key features: KOL trading, token discovery, swap interface, portfolio, AI chat
    - [x] Add skip tour option and tour completion tracking
    - [x] Create FeaturesService for setup-copy-trader and other feature endpoints
    - [x] Build useOnboarding hook for automatic onboarding trigger
    - [x] Integrate onboarding flow with authentication success
    - [x] Redirect to dashboard after tour completion or skip
    - _Requirements: 1.1, 1.8_ ✅ **COMPLETED**
  
  ✅ **PHASE 2 COMPLETED**

- [x] 3. Core Layout and Navigation
  - [x] 3.1 Build main application layout with theme support
    - [x] Create AppLayout component with header, sidebar, and main content area
    - [x] Implement responsive design with mobile-friendly navigation
    - [x] Add light/dark theme support with theme provider and context
    - [x] Create theme toggle component with system preference detection
    - [x] Implement theme persistence in localStorage with proper SSR handling
    - [x] Build ThemeProvider with proper hydration and SSR support
    - [x] Create ThemeScript to prevent flash of wrong theme on initial load
    - [x] Update useTheme hook to use new ThemeProvider context
    - [x] Add accessibility features (skip links, ARIA labels, keyboard navigation)
    - [x] Implement collapsible sidebar with mobile overlay support
    - [x] Create demo page to showcase layout and theme functionality
    - _Requirements: 10.1, 10.2_ ✅ **COMPLETED**

  - [x] 3.2 Create header with wallet integration and theme toggle
    - [x] Build Header component with global search, wallet dropdown, user menu, and theme toggle
    - [x] Implement GlobalSearch component with debounced search, keyboard navigation, and mock results
    - [x] Create WalletDropdown showing backend-generated wallet SOL balance, top tokens, and wallet address
    - [x] Build UserMenu component with profile info, settings access, and logout functionality
    - [x] Add theme toggle button with light/dark/system options and proper accessibility
    - [x] Implement real-time balance updates display for trading wallet (not connected Phantom wallet)
    - [x] Display Phantom connection status for auth purposes only with clear separation
    - [x] Add balance visibility toggle and refresh functionality in wallet dropdown
    - [x] Integrate all header components with existing authentication and theme systems
    - [x] Create responsive design with mobile-optimized search and navigation
    - [x] Update AppLayout to use new Header component instead of placeholder
    - [x] Create modal and notification wrapper components for global state management
    - [x] Update root layout with proper providers (ThemeProvider, WalletAdapterProvider, NotificationProvider)
    - [x] Build comprehensive homepage with hero section, features showcase, and CTAs
    - _Requirements: 2.1, 2.3, 10.1_ ✅ **COMPLETED**

  - [x] 3.3 Implement sidebar navigation
    - [x] Create Sidebar component with navigation to Dashboard, KOLs, Tokens, Swap, Portfolio, Settings
    - [x] Add active state indicators and collapsible mobile design
    - [x] Implement navigation state management
    - _Requirements: 10.2_ ✅ **COMPLETED**

✅ **PHASE 3 COMPLETED**

- [x] 4. State Management and Data Layer
  - [x] 4.1 Set up Zustand stores for application state
    - [x] Create UserStore for authentication and wallet state ✅ (already existed)
    - [x] Implement TradingStore for subscriptions, trades, and portfolio data
    - [x] Build UIStore for modal states, notifications, and loading indicators ✅ (already existed)
    - [x] Add TokenStore for search results, trending tokens, and watchlist
    - [x] Create store index file for easy importing and helper hooks
    - _Requirements: 1.3, 2.2, 3.3, 4.3_ ✅ **COMPLETED**

  - [x] 4.2 Create API service layer
    - [x] Implement TradingService with methods for `/features/get-kol-wallets`, `/features/get-recent-kol-trades`, `/features/subscribe-to-kol`, `/features/unsubscribe-from-kol`
    - [x] Create TokenService integrating `/features/search-tokens`, `/features/get-token`, `/features/get-trending-tokens`, `/features/get-tokens-by-volume`, `/features/get-latest-tokens`
    - [x] Build PortfolioService for `/features/get-user-pnl`, `/features/get-token-pnl`, `/features/get-user-trade-stats`, `/features/get-user-transactions`, `/features/get-user-transaction-by-mint`
    - [x] Add SwapService for `/features/perform-swap` and swap-related operations
    - [x] Enhance FeaturesService with additional utility methods and better integration
    - [x] Create proper TypeScript interfaces matching API response models from apidocs.md
    - [x] Create services index file for easy importing
    - _Requirements: 1.2, 3.4, 4.7, 6.3_ ✅ **COMPLETED**
  
  ✅ **PHASE 4 COMPLETED**

- [x] 5. Real-time Data Integration
  - [x] 5.1 Implement WebSocket connection for RabbitMQ queues
    - [x] Create WebSocket service to consume trade updates and notifications from RabbitMQ queues
    - [x] Handle 1-hour TTL message expiration and queue management
    - [x] Implement automatic reconnection with exponential backoff
    - [x] Add heartbeat mechanism and connection status monitoring
    - [x] Create React hook for WebSocket integration with stores
    - _Requirements: 9.1, 9.2_ ✅ **COMPLETED**

  - [x] 5.2 Build real-time update system
    - [x] Create notification system for trade alerts and price updates
    - [x] Implement update batching to prevent UI thrashing
    - [x] Add selective component updates based on data changes
    - [x] Build real-time update service with intelligent prioritization
    - [x] Create specialized React hooks for different update types (trades, prices, portfolio, tokens)
    - [x] Integrate batching system with WebSocket service for optimal performance
    - _Requirements: 9.1, 9.4_ ✅ **COMPLETED**
  
  ✅ **PHASE 5 COMPLETED**

- [x] 6. KOL Trading Interface
  - [x] 6.1 Create KOL list and detail pages
    - [x] Build KOLList component fetching data from `/features/get-kol-wallets`
    - [x] Implement KOLDetail page with profile info and trade history from `/features/get-recent-kol-trades`
    - [x] Add search and filtering functionality for KOL discovery
    - [x] Create responsive grid layout with performance metrics display
    - [x] Integrate subscription status indicators and real-time updates
    - [x] Add comprehensive trade history with filtering and analytics tabs
    - _Requirements: 3.1, 3.3_ ✅ **COMPLETED**

  - [x] 6.2 Implement KOL subscription system
    - [x] Create subscription controls with minAmount and subType configuration
    - [x] Build subscribe/unsubscribe functionality calling `/features/subscribe-to-kol` and `/features/unsubscribe-from-kol`
    - [x] Add subscription status indicators and management interface
    - [x] Create comprehensive settings modal with trade/watch modes, amount controls, and advanced options
    - [x] Implement multiple UI variants (button, card, inline) for flexible integration
    - [x] Add slippage protection and time restriction settings
    - [x] Integrate subscription controls into KOL detail page
    - _Requirements: 3.4, 3.5_ ✅ **COMPLETED**

  - [x] 6.3 Build live trades feed
    - [x] Create LiveTradesFeed component with real-time WebSocket updates
    - [x] Implement instant buy/sell buttons for quick trade execution
    - [x] Add filtering and sorting options for trade feed
    - [x] Integrate with existing real-time update system and WebSocket service
    - [x] Create comprehensive filtering system (KOL, trade type, time range, amount, token)
    - [x] Add quick trade functionality with subscription-based settings
    - [x] Implement live feed with automatic updates and real-time status indicators
    - [x] Add proper loading states, empty states, and error handling
    - _Requirements: 3.6, 3.7_ ✅ **COMPLETED**

  - [x] 6.4 Implement KOL trade mind share component
    - [x] Create MindShareWidget component for sharing KOL trades on social platforms
    - [x] Build shareable trade cards with KOL info, token details, trade amounts, and timestamp
    - [x] Add social sharing buttons for Twitter, Telegram, and Discord with pre-formatted messages
    - [x] Implement copy-to-clipboard functionality for trade details and wallet addresses
    - [x] Create custom share templates highlighting successful trades and performance metrics
    - [x] Add privacy controls allowing users to share anonymously or with attribution
    - [x] Integrate with KOL detail pages and live trades feed for easy sharing access
    - [x] Add comprehensive sharing modal with live preview and settings
    - [x] Implement multiple UI variants (button, card, inline) for flexible integration
    - _Requirements: 3.7, 9.3_ ✅ **COMPLETED**

✅ **PHASE 6 COMPLETED**

- [x] 7. Token Discovery and Search
  - [x] 7.1 Implement global token search
    - [x] Create TokenSearch component with debounced API calls to `/features/search-tokens`
    - [x] Build autocomplete functionality with keyboard navigation
    - [x] Add search result display with token info and quick buy buttons
    - [x] Integrate with existing token search store and loading states
    - [x] Create comprehensive search results page with filtering and pagination
    - [x] Add multiple UI variants (full, compact, modal) for flexible integration
    - [x] Implement real-time search with 300ms debouncing and proper error handling
    - [x] Replace header GlobalSearch with new TokenSearch component
    - _Requirements: 4.1, 4.2_ ✅ **COMPLETED**

  - [x] 7.2 Build token category pages
    - [x] Create unified token discovery interface with inline category switching
    - [x] Implement GMGN-style compact token list layout with 1-5 column responsive grid
    - [x] Build TokenList component supporting trending, volume, and latest categories
    - [x] Add comprehensive filtering, sorting, and pagination for all token lists
    - [x] Integrate category selection within main tokens page (no separate navigation)
    - _Requirements: 4.3, 4.4, 4.5_ ✅ **COMPLETED**

  - [x] 7.3 Create token detail pages
    - [x] Build TokenDetail component using cached token data instead of API calls
    - [x] Create dynamic route `/tokens/[mint]` that retrieves tokens from TokenStore cache
    - [x] Display comprehensive token info, social links, holder count, liquidity, and risk indicators
    - [x] Add token address copy functionality and quick buy button
    - [x] Implement automatic token caching in TokenList component for detail page access
    - [x] Add external links to Solscan, DexScreener, and Jupiter
    - [x] Show creation platform (e.g., "pump.fun") and relative time for latest tokens
    - [x] Add creation platform display in both compact and full token list layouts
    - _Requirements: 4.6, 4.7_ ✅ **COMPLETED**

- [x] 8. Swap and Trading Interface
  - [x] 8.1 Build main swap interface
    - [x] Create SwapInterface with SOL ↔ Token swap support only (no token-to-token swaps)
    - [x] Integrate `/features/search-tokens` for token selection with autocomplete
    - [x] Implement "From" (SOL) and "To" (Token) inputs with amount validation
    - [x] Add exchange rate calculation and estimated output display
    - [x] Add slippage tolerance and transaction priority controls
    - _Requirements: 5.1, 5.2, 5.3_ ✅ **COMPLETED**

  - [x] 8.2 Implement advanced trading features
    - [x] Create WatchConfigForm for take-profit and stop-loss settings
    - [x] Build trade confirmation dialog with transaction details and SOL/Token amounts
    - [x] Implement swap execution calling `/features/perform-swap` with tradeType ("buy" or "sell"), amount, and mint
    - [x] Add transaction status tracking and success/failure handling
    - _Requirements: 5.4, 5.5, 5.6_ ✅ **COMPLETED**

  - [x] 8.3 Add price chart integration
    - [x] Integrate lightweight chart library or TradingView widgets
    - [x] Display real-time price data for selected token pairs
    - [x] Add chart controls and timeframe selection
    - _Requirements: 5.7_ ✅ **COMPLETED**

✅ **PHASE 8 COMPLETED**

✅ **PHASE 9 COMPLETED**

✅ **PHASE 10 COMPLETED**

- [x] 10. Settings and Configuration
  - [x] 10.1 Create trading settings interface
    - ✅ Build trade settings form for slippage, min/max amounts, and watchConfig defaults
    - ✅ Implement settings persistence calling `/features/update-trading-settings`
    - ✅ Add KOL subscription configuration with copy percentage and restrictions
    - ✅ Added comprehensive trading settings with auto-trading defaults, whitelist management
    - _Requirements: 7.1, 7.2_

  - [x] 10.2 Build account and security settings
    - ✅ Create profile editing interface for name, email, and social handles  
    - ✅ Implement Telegram account linking using `/auth/link-telegram-user` with telegramId and telegramUsername
    - ✅ Add password change functionality using `/auth/reset-password` flow
    - ✅ Build OAuth provider management for Google and Facebook integrations
    - ✅ Added 2FA setup, session management, security notifications, and comprehensive account management
    - _Requirements: 7.3, 7.4, 7.5_

- [ ] 11. AI Chat Assistant
  - [ ] 11.1 Implement chat interface
    - Create collapsible AIChat component with slide-out panel design
    - Build chat message display with user and assistant message bubbles
    - Implement responsive design with mobile overlay functionality
    - _Requirements: 8.1, 8.5_

  - [ ] 11.2 Add AI assistant functionality
    - Integrate chat API for natural language queries about portfolio and trading
    - Implement command interpretation for trading actions
    - Add chat history persistence and scroll management
    - _Requirements: 8.2, 8.3, 8.6_

- [ ] 12. Notification and Alert System
  - [ ] 12.1 Build notification infrastructure
    - Create toast notification system for user feedback
    - Implement real-time alert processing from RabbitMQ notification queue
    - Add Telegram integration for external notifications
    - _Requirements: 9.2, 9.3_

  - [ ] 12.2 Add loading and error states
    - Implement loading spinners and skeleton screens for all data fetching
    - Create user-friendly error messages with retry functionality
    - Add graceful error handling for API failures and network issues
    - _Requirements: 9.4, 9.5_

- [ ] 13. Testing Implementation
  - [ ] 13.1 Set up testing infrastructure
    - Configure Jest and React Testing Library for unit testing
    - Set up Playwright for end-to-end testing
    - Create mock services for API calls and wallet connections
    - _Requirements: All requirements (testing coverage)_

  - [ ] 13.2 Write comprehensive tests
    - Create unit tests for all utility functions and custom hooks
    - Implement component tests for critical trading and authentication flows
    - Build E2E tests for complete user journeys (signup, trading, portfolio)
    - _Requirements: All requirements (testing coverage)_

- [ ] 14. Performance Optimization and Deployment
  - [ ] 14.1 Implement performance optimizations
    - Add code splitting for route-based and component-based lazy loading
    - Implement virtual scrolling for large transaction and token lists
    - Optimize WebSocket connection management and update batching
    - _Requirements: 9.1, 10.1_

  - [ ] 14.2 Configure deployment and monitoring
    - Set up build configuration with environment-specific settings
    - Configure error tracking with Sentry and performance monitoring
    - Implement analytics for user behavior tracking
    - Add security headers and CSP configuration
    - _Requirements: 10.5, 10.6_