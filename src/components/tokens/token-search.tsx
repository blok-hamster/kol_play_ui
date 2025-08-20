'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Search, ExternalLink, User, Coins, Loader2 } from 'lucide-react';
import { cn, formatWalletAddress } from '@/lib/utils';
import { useTokenSearch } from '@/stores/use-token-store';
import { useNotifications } from '@/stores/use-ui-store';
import { executeInstantBuy, checkTradeConfig } from '@/lib/trade-utils';
import { 
  transformSearchResultToTokenDetail, 
  validateSearchResult,
  type TokenDetailData 
} from '@/lib/token-data-utils';
import TokenDetailModal from './token-detail-modal';
import SimpleTestModal from './simple-test-modal';
import TokenModalErrorBoundary from '../error-boundaries/token-modal-error-boundary';
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

  // Simplified modal states
  const [modals, setModals] = useState({
    token: { isOpen: false, data: null as TokenDetailData | null },
    kol: { isOpen: false, address: null as string | null, data: null as any },
    tradeConfig: { isOpen: false, pendingToken: null as SearchTokenResult | null }
  });



  // Instant buy loading state
  const [buyingTokens, setBuyingTokens] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Modal opening helper functions
  const openTokenModal = useCallback((token: SearchTokenResult) => {
    try {
      // Validate the search result before transformation
      const validation = validateSearchResult(token);
      
      if (!validation.isValid) {
        showError(
          'Invalid Token Data',
          `Cannot open token details: ${validation.missingFields.join(', ')} missing`
        );
        return false;
      }

      // Transform search result to modal format
      const tokenDetailData = transformSearchResultToTokenDetail(token);
      
      // Update modal state
      setModals(prev => ({
        ...prev,
        token: { isOpen: true, data: tokenDetailData }
      }));
      
      return true;
    } catch (error) {
      showError(
        'Modal Error',
        error instanceof Error ? error.message : 'Failed to open token details'
      );
      return false;
    }
  }, [showError]);

  const openKOLModal = useCallback((address: AddressSearchResult) => {
    try {
      if (!address.address) {
        throw new Error('Address is required');
      }

      // Create KOL data object
      const kolData = {
        id: address.address,
        walletAddress: address.address,
        name: address.displayName,
        description: address.description,
        totalTrades: address.totalTransactions || 0,
        winRate: 0, // Will be calculated by the modal
        totalPnL: 0, // Will be calculated by the modal
        subscriberCount: 0,
        isActive: address.verified || true,
        avatar: undefined,
      };

      setModals(prev => ({
        ...prev,
        kol: { isOpen: true, address: address.address, data: kolData }
      }));
      
      return true;
    } catch (error) {
      showError(
        'Modal Error',
        error instanceof Error ? error.message : 'Failed to open KOL details'
      );
      return false;
    }
  }, [showError]);

  const openTradeConfigPrompt = useCallback((token: SearchTokenResult) => {
    setModals(prev => ({
      ...prev,
      tradeConfig: { isOpen: true, pendingToken: token }
    }));
  }, []);

  const closeModal = useCallback((modalType: 'token' | 'kol' | 'tradeConfig') => {
    setModals(prev => ({
      ...prev,
      [modalType]: modalType === 'token' 
        ? { isOpen: false, data: null }
        : modalType === 'kol'
        ? { isOpen: false, address: null, data: null }
        : { isOpen: false, pendingToken: null }
    }));
  }, []);

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
            handleResultSelect(unifiedResults[selectedIndex], e as any);
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
    (result: UnifiedSearchResult, event?: React.MouseEvent) => {
      try {
        // Prevent any potential event conflicts
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }

        if (result.type === 'token') {
          const token = result.data as SearchTokenResult;
          
          if (onTokenSelect) {
            // External handler provided - use it
            onTokenSelect(token);
            setIsOpen(false);
            setLocalQuery(token.symbol || token.name || '');
          } else {
            // No external handler - open modal
            const success = openTokenModal(token);
            if (success) {
              setIsOpen(false);
              setLocalQuery(token.symbol || token.name || '');
            } else {
              console.error('Failed to open token modal');
            }
          }
        } else if (result.type === 'address') {
          const address = result.data as AddressSearchResult;

          if (onAddressSelect) {
            // External handler provided - use it
            onAddressSelect(address);
            setIsOpen(false);
            setLocalQuery(formatWalletAddress(address.address));
          } else {
            // No external handler - handle based on address type
            if (address.isKOL) {
              const success = openKOLModal(address);
              if (success) {
                setIsOpen(false);
                setLocalQuery(
                  address.displayName || formatWalletAddress(address.address)
                );
              }
            } else {
              // Default behavior: open address in explorer
              try {
                window.open(
                  `https://solscan.io/account/${address.address}`,
                  '_blank',
                  'noopener,noreferrer'
                );
              } catch (error) {
                // Fallback if window.open fails
              }
              setIsOpen(false);
              setLocalQuery(formatWalletAddress(address.address));
            }
          }
        }
      } catch (error) {
        showError(
          'Selection Error',
          error instanceof Error ? error.message : 'Failed to handle selection'
        );
      }
    },
    [onTokenSelect, onAddressSelect, openTokenModal, openKOLModal, showError]
  );

  // Handle instant buy
  const handleInstantBuy = useCallback(
    async (token: SearchTokenResult, e: React.MouseEvent) => {
      // Prevent event propagation to parent click handlers
      e.preventDefault();
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
          openTradeConfigPrompt(token);
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
            // Transaction completed successfully
          }
        } else {
          showError(
            'Buy Order Failed',
            result.error || 'Failed to execute buy order'
          );
        }
      } catch (error: any) {
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
    [buyingTokens, showError, showSuccess, openTradeConfigPrompt]
  );

  // Handle trade config prompt close
  const handleTradeConfigPromptClose = useCallback(() => {
    closeModal('tradeConfig');
  }, [closeModal]);

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
            role="button"
            tabIndex={0}
            className={cn(
              'flex items-center justify-between p-3 cursor-pointer transition-colors',
              isSelected
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleResultSelect(result, e);
            }}
            onTouchEnd={(e) => {
              // Handle touch devices - prevent double firing with onClick
              if (e.cancelable) {
                e.preventDefault();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                handleResultSelect(result, e as any);
              }
            }}
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
            role="button"
            tabIndex={0}
            className={cn(
              'flex items-center justify-between p-3 cursor-pointer transition-colors',
              isSelected
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleResultSelect(result, e);
            }}
            onTouchEnd={(e) => {
              // Handle touch devices - prevent double firing with onClick
              if (e.cancelable) {
                e.preventDefault();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                handleResultSelect(result, e as any);
              }
            }}
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
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
      {modals.token.data && !onTokenSelect && (
        <TokenModalErrorBoundary
          onClose={() => closeModal('token')}
          fallbackTitle="Token Details Error"
        >
          <TokenDetailModal
            isOpen={modals.token.isOpen}
            onClose={() => closeModal('token')}
            tokenData={modals.token.data}
          />
        </TokenModalErrorBoundary>
      )}

      {/* KOL Trades Modal */}
      {modals.kol.address && !onAddressSelect && (
        <KOLTradesModal
          isOpen={modals.kol.isOpen}
          onClose={() => closeModal('kol')}
          walletAddress={modals.kol.address}
          kol={modals.kol.data}
        />
      )}

      {/* Trade Config Prompt */}
      <TradeConfigPrompt
        isOpen={modals.tradeConfig.isOpen}
        onClose={handleTradeConfigPromptClose}
        tokenSymbol={modals.tradeConfig.pendingToken?.symbol || modals.tradeConfig.pendingToken?.name}
      />
    </>
  );
};

export default TokenSearch;
