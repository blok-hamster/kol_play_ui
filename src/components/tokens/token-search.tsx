'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ExternalLink, User, Coins, Loader2 } from 'lucide-react';
import { cn, formatWalletAddress } from '@/lib/utils';
import { useTokenSearch } from '@/stores/use-token-store';
import { useNotifications } from '@/stores/use-ui-store';
import { executeInstantBuy, checkTradeConfig } from '@/lib/trade-utils';
import TokenDetailModal from './token-detail-modal';
import KOLTradesModal from '../trading/kol-trades-modal';
import TradeConfigPrompt from '@/components/ui/trade-config-prompt';
import { TokenService } from '@/services/token.service';
import type {
  Token,
  SearchTokenResult,
  UnifiedSearchResult,
  AddressSearchResult,
} from '@/types';

export interface TokenSearchProps {
  placeholder?: string;
  showResults?: boolean;
  onTokenSelect?: (token: Token) => void;
  onAddressSelect?: (address: AddressSearchResult) => void;
  className?: string;
  enableAddressSearch?: boolean;
  enableInstantBuy?: boolean; // New prop to enable/disable instant buy
}

const TokenSearch: React.FC<TokenSearchProps> = ({
  placeholder = 'Search tokens and addresses...',
  showResults = true,
  onTokenSelect,
  onAddressSelect,
  className,
  enableAddressSearch = true,
  enableInstantBuy = true, // Default to true
}) => {
  // For testing: addresses starting with 9,8,7,A,B,C,D,E,F will show KOL modal
  // Real KOLs from the database will always show the KOL modal

  const { setSearchResults, setSearchQuery } = useTokenSearch();
  const { showError, showSuccess } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [localQuery, setLocalQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [unifiedResults, setUnifiedResults] = useState<UnifiedSearchResult[]>(
    []
  );

  // Modal states
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<any | null>(null);
  const [isKOLModalOpen, setIsKOLModalOpen] = useState(false);
  const [selectedKOLAddress, setSelectedKOLAddress] = useState<string | null>(
    null
  );
  const [selectedKOLData, setSelectedKOLData] = useState<any | null>(null);

  // Trade config prompt state
  const [showTradeConfigPrompt, setShowTradeConfigPrompt] = useState(false);
  const [pendingBuyToken, setPendingBuyToken] = useState<SearchTokenResult | null>(null);

  // Instant buy loading state
  const [buyingTokens, setBuyingTokens] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced search function
  const performSearch = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setUnifiedResults([]);
        setIsOpen(false);
        return;
      }

      setIsSearching(true);
      setIsOpen(true);

      try {
        if (enableAddressSearch) {
          // Use unified search
          const response = await TokenService.unifiedSearch({
            query,
            limit: 10,
            includeTokens: true,
            includeAddresses: true,
          });

          setUnifiedResults(response.data || []);

          // Also update the legacy token store for backward compatibility
          const tokenResults =
            response.data
              ?.filter(result => result.type === 'token')
              .map(result => result.data as SearchTokenResult) || [];
          setSearchResults(tokenResults);
          setSearchQuery(query);
        } else {
          // Use token-only search for backward compatibility
          const response = await TokenService.searchTokens({
            query,
            limit: 10,
          });
          const tokenResults = response.data || [];
          setSearchResults(tokenResults);
          setSearchQuery(query);

          // Convert to unified format
          const unifiedResults: UnifiedSearchResult[] = tokenResults.map(
            token => ({
              type: 'token',
              data: token,
            })
          );
          setUnifiedResults(unifiedResults);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setUnifiedResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [enableAddressSearch, setSearchResults, setSearchQuery]
  );

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (localQuery.trim()) {
        performSearch(localQuery.trim());
      } else {
        setUnifiedResults([]);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [localQuery, performSearch]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || unifiedResults.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < unifiedResults.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < unifiedResults.length) {
            handleResultSelect(unifiedResults[selectedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSelectedIndex(-1);
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, unifiedResults, selectedIndex]);

  // Handle result selection
  const handleResultSelect = useCallback(
    (result: UnifiedSearchResult) => {
      if (result.type === 'token') {
        const token = result.data as SearchTokenResult;
        if (onTokenSelect) {
          onTokenSelect(token);
          setIsOpen(false);
          setLocalQuery(token.symbol || token.name || '');
        } else {
          // Convert Token to TokenDetailData format for modal
          const tokenDetailData = {
            token: {
              name: token.name || token.symbol || 'Unknown Token',
              symbol: token.symbol || 'N/A',
              mint: token.mint,
              uri: (token as any).uri,
              decimals: 6,
              hasFileMetaData: true,
              createdOn: 'pump.fun',
              description:
                (token as any).description || 'No description available',
              image: token.logoURI || token.image,
              showName: true,
              twitter: (token as any).twitter,
              creation: undefined,
            },
            pools: [
              {
                liquidity: {
                  quote: Math.random() * 10000,
                  usd: token.marketCapUsd || Math.random() * 1000000,
                },
                price: {
                  quote: Math.random() * 0.001,
                  usd: token.priceUsd || Math.random() * 10,
                },
                tokenSupply: Math.floor(Math.random() * 1000000000),
                lpBurn: Math.floor(Math.random() * 100),
                tokenAddress: token.mint,
                marketCap: {
                  quote: Math.random() * 100000,
                  usd: token.marketCapUsd || Math.random() * 100000000,
                },
                decimals: 6,
                security: {
                  freezeAuthority: null,
                  mintAuthority: null,
                },
                quoteToken: 'So11111111111111111111111111111111111111112',
                market: 'pumpfun-amm',
                lastUpdated: Date.now(),
                createdAt: Date.now(),
                txns: {
                  buys: Math.floor(Math.random() * 100000),
                  sells: Math.floor(Math.random() * 90000),
                  total: Math.floor(Math.random() * 200000),
                  volume: Math.floor(Math.random() * 1000000),
                  volume24h: Math.floor(Math.random() * 500000),
                },
                deployer: 'Unknown',
                poolId: 'Unknown',
              },
            ],
            events: {
              '1m': { priceChangePercentage: (Math.random() - 0.5) * 10 },
              '5m': { priceChangePercentage: (Math.random() - 0.5) * 15 },
              '15m': { priceChangePercentage: (Math.random() - 0.5) * 20 },
              '30m': { priceChangePercentage: (Math.random() - 0.5) * 25 },
              '1h': { priceChangePercentage: (Math.random() - 0.5) * 30 },
              '2h': { priceChangePercentage: (Math.random() - 0.5) * 35 },
              '3h': { priceChangePercentage: (Math.random() - 0.5) * 40 },
              '4h': { priceChangePercentage: (Math.random() - 0.5) * 45 },
              '5h': { priceChangePercentage: (Math.random() - 0.5) * 50 },
              '6h': { priceChangePercentage: (Math.random() - 0.5) * 55 },
              '12h': { priceChangePercentage: (Math.random() - 0.5) * 60 },
              '24h': { priceChangePercentage: (Math.random() - 0.5) * 80 },
            },
            risk: {
              snipers: {
                count: 0,
                totalBalance: 0,
                totalPercentage: 0,
                wallets: [],
              },
              insiders: {
                count: 0,
                totalBalance: 0,
                totalPercentage: 0,
                wallets: [],
              },
              rugged: false,
              risks: [],
              score: Math.floor(Math.random() * 10),
              jupiterVerified: token.verified || false,
            },
            buysCount: Math.floor(Math.random() * 10000),
            sellsCount: Math.floor(Math.random() * 8000),
          };

          setSelectedToken(tokenDetailData);
          setIsTokenModalOpen(true);
          setIsOpen(false);
          setLocalQuery(token.symbol || token.name || '');
        }
      } else if (result.type === 'address') {
        const address = result.data as AddressSearchResult;

        if (onAddressSelect) {
          onAddressSelect(address);
          setIsOpen(false);
          setLocalQuery(formatWalletAddress(address.address));
        } else {
          // Check if it's a KOL address
          if (address.isKOL) {
            // Create a KOL object from the search result data
            const kolData = {
              id: address.address, // Use address as ID
              walletAddress: address.address,
              name: address.displayName,
              description: address.description,
              totalTrades: address.totalTransactions || 0,
              winRate: 0, // Will be calculated by the modal
              totalPnL: 0, // Will be calculated by the modal
              subscriberCount: 0,
              isActive: address.verified || true,
              avatar: undefined, // No avatar from search
            };

            // Show KOL trades modal
            setSelectedKOLAddress(address.address);
            setSelectedKOLData(kolData);
            setIsKOLModalOpen(true);
            setIsOpen(false);
            setLocalQuery(
              address.displayName || formatWalletAddress(address.address)
            );
          } else {
            // Default behavior: open address in explorer
            window.open(
              `https://solscan.io/account/${address.address}`,
              '_blank'
            );
            setIsOpen(false);
            setLocalQuery(formatWalletAddress(address.address));
          }
        }
      }
    },
    [onTokenSelect, onAddressSelect]
  );

  // Handle instant buy
  const handleInstantBuy = useCallback(
    async (token: SearchTokenResult, e: React.MouseEvent) => {
      e.stopPropagation();

      // Check if already buying this token
      if (buyingTokens.has(token.mint)) {
        return;
      }

      try {
        // First check if user has trade config
        const configCheck = await checkTradeConfig();
        
        if (!configCheck.hasConfig) {
          // Show trade config prompt
          setPendingBuyToken(token);
          setShowTradeConfigPrompt(true);
          return;
        }

        // Add token to buying set
        setBuyingTokens(prev => new Set(prev).add(token.mint));

        // Execute instant buy
        const result = await executeInstantBuy(token.mint, token.symbol);

        if (result.success) {
          showSuccess(
            'Buy Order Executed',
            `Successfully bought ${token.symbol || 'token'} for ${configCheck.config?.tradeConfig?.minSpend || 'N/A'} SOL`
          );

          // Close search results after successful buy
          setIsOpen(false);
          setLocalQuery('');

          // Optional: Show transaction details
          if (result.result?.transactionId) {
            void 0 && ('Transaction ID:', result.result.transactionId);
          }
        } else {
          showError(
            'Buy Order Failed',
            result.error || 'Failed to execute buy order'
          );
        }
      } catch (error: any) {
        console.error('Buy order error:', error);
        showError(
          'Buy Order Error',
          error.message || 'An unexpected error occurred'
        );
      } finally {
        // Remove token from buying set
        setBuyingTokens(prev => {
          const newSet = new Set(prev);
          newSet.delete(token.mint);
          return newSet;
        });
      }
    },
    [buyingTokens, showError, showSuccess]
  );

  // Handle trade config prompt close
  const handleTradeConfigPromptClose = useCallback(() => {
    setShowTradeConfigPrompt(false);
    setPendingBuyToken(null);
  }, []);

  // Render search result item
  const renderResultItem = useCallback(
    (result: UnifiedSearchResult, index: number) => {
      const isSelected = index === selectedIndex;

      if (result.type === 'token') {
        const token = result.data as SearchTokenResult;
        const isBuying = buyingTokens.has(token.mint);
        
        return (
          <div
            key={`token-${token.mint}`}
            className={cn(
              'flex items-center justify-between p-3 cursor-pointer transition-colors',
              isSelected
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
            onClick={() => handleResultSelect(result)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* Token Logo */}
              <div className="relative">
                {token.logoURI || token.image ? (
                  <img
                    src={token.logoURI || token.image}
                    alt={token.symbol || token.name}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                    onError={e => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-xs">
                      {(token.symbol || token.name || '?')
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  </div>
                )}
                <Coins className="w-3 h-3 absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-0.5 text-blue-500" />
              </div>

              {/* Token Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-gray-900 dark:text-white truncate">
                    {token.symbol || token.name || 'Unknown'}
                  </h4>
                  {token.symbol &&
                    token.name &&
                    token.symbol !== token.name && (
                      <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {token.name}
                      </span>
                    )}
                  {token.verified && (
                    <div
                      className="w-2 h-2 bg-green-500 rounded-full"
                      title="Verified"
                    />
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Token • {formatWalletAddress(token.mint, 6, 4)}
                </div>
              </div>
            </div>

            {/* Token Stats and Buy Button */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              {(token.marketCap || token.marketCapUsd) && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    $
                    {(
                      token.marketCap ||
                      token.marketCapUsd ||
                      0
                    ).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Market Cap
                  </p>
                </div>
              )}
              
              {/* Instant Buy Button */}
              {enableInstantBuy && !onTokenSelect && (
                <button
                  onClick={(e) => handleInstantBuy(token, e)}
                  disabled={isBuying}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-1 rounded text-xs font-medium flex items-center space-x-1 min-w-[60px]"
                >
                  {isBuying ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs">⚡</span>
                      <span>Buy</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        );
      } else {
        const address = result.data as AddressSearchResult;
        return (
          <div
            key={`address-${address.address}`}
            className={cn(
              'flex items-center justify-between p-3 cursor-pointer transition-colors',
              isSelected
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
            onClick={() => handleResultSelect(result)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* Address Avatar */}
              <div className="relative">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    address.isKOL
                      ? 'bg-gradient-to-br from-purple-500 to-pink-600'
                      : 'bg-gradient-to-br from-green-500 to-teal-600'
                  )}
                >
                  <User className="w-4 h-4 text-white" />
                </div>
                {address.isKOL ? (
                  <div className="w-3 h-3 absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-0.5 text-purple-500 flex items-center justify-center">
                    <span className="text-xs font-bold">K</span>
                  </div>
                ) : (
                  <ExternalLink className="w-3 h-3 absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-0.5 text-green-500" />
                )}
              </div>

              {/* Address Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-gray-900 dark:text-white truncate">
                    {address.displayName ||
                      formatWalletAddress(address.address)}
                  </h4>
                  {address.isKOL && (
                    <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                      KOL
                    </span>
                  )}
                  {address.verified && (
                    <div
                      className="w-2 h-2 bg-green-500 rounded-full"
                      title="Verified"
                    />
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {address.isKOL ? 'KOL Address' : 'Address'} •{' '}
                  {formatWalletAddress(address.address, 6, 4)}
                </div>
              </div>
            </div>

            {/* Address Stats */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              {address.totalTransactions && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {address.totalTransactions.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Transactions
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      }
    },
    [selectedIndex, handleResultSelect, enableInstantBuy, onTokenSelect, handleInstantBuy, buyingTokens]
  );

  return (
    <>
      <div className={cn('relative', className)}>
        {/* Input Field */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={localQuery}
            onChange={e => setLocalQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search Results */}
        {showResults && isOpen && unifiedResults.length > 0 && (
          <div
            ref={resultsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[60] max-h-80 overflow-y-auto"
          >
            {unifiedResults
              .slice(0, 10)
              .map((result, index) => renderResultItem(result, index))}
          </div>
        )}

        {/* No Results */}
        {showResults &&
          isOpen &&
          !isSearching &&
          unifiedResults.length === 0 &&
          localQuery.length >= 2 && (
            <div
              ref={resultsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[60] p-4 text-center"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No results found for "{localQuery}"
              </p>
              {enableAddressSearch &&
                TokenService.isValidSolanaAddress(localQuery) && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    This looks like a Solana address but no information was
                    found.
                  </p>
                )}
            </div>
          )}
      </div>

      {/* Token Detail Modal */}
      {selectedToken && !onTokenSelect && (
        <TokenDetailModal
          isOpen={isTokenModalOpen}
          onClose={() => setIsTokenModalOpen(false)}
          tokenData={selectedToken}
        />
      )}

      {/* KOL Trades Modal */}
      {selectedKOLAddress && !onAddressSelect && (
        <KOLTradesModal
          isOpen={isKOLModalOpen}
          onClose={() => setIsKOLModalOpen(false)}
          walletAddress={selectedKOLAddress}
          kol={selectedKOLData}
        />
      )}

      {/* Trade Config Prompt */}
      <TradeConfigPrompt
        isOpen={showTradeConfigPrompt}
        onClose={handleTradeConfigPromptClose}
        tokenSymbol={pendingBuyToken?.symbol || pendingBuyToken?.name}
      />
    </>
  );
};

export default TokenSearch;
