'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Loader2 } from 'lucide-react';
import { Token, SearchTokenResult } from '@/types';
import { useTokenSearch } from '@/stores/use-token-store';
import { formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TokenSelectorProps {
  selectedToken: Token | null;
  onTokenSelect: (token: Token | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const TokenSelector: React.FC<TokenSelectorProps> = ({
  selectedToken,
  onTokenSelect,
  placeholder = 'Select Token',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<'left' | 'right'>('left');
  
  const { searchTokens, searchResults, isLoading, clearSearchResults } =
    useTokenSearch();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate dropdown position based on available space
  const calculateDropdownPosition = () => {
    if (!dropdownRef.current) return;
    
    const rect = dropdownRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const dropdownWidth = 600; // md:w-[600px] from the dropdown
    
    // Check if there's enough space on the right side
    const spaceOnRight = viewportWidth - rect.right;
    
    // If there's not enough space on the right for the dropdown width,
    // align it to the right edge of the trigger (right-0)
    // Otherwise, align it to the left edge of the trigger (left-0)
    if (spaceOnRight < dropdownWidth) {
      setDropdownPosition('right');
    } else {
      setDropdownPosition('left');
    }
  };

  // Handle search with debouncing
  useEffect(() => {
    if (searchQuery.trim()) {
      const timer = setTimeout(() => {
        searchTokens({
          query: searchQuery,
          limit: 100,
        });
      }, 300);
      return () => clearTimeout(timer);
    } else {
      clearSearchResults();
    }
  }, [searchQuery]); // Only depend on searchQuery to prevent infinite loops

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll on mobile when dropdown is open
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  // Focus search input when dropdown opens and calculate position
  useEffect(() => {
    if (isOpen) {
      if (inputRef.current) {
        inputRef.current.focus();
      }
      // Calculate position after the dropdown is rendered
      setTimeout(calculateDropdownPosition, 0);
    }
  }, [isOpen]);

  // Recalculate position on window resize
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        calculateDropdownPosition();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  const handleTokenSelect = (searchResult: SearchTokenResult) => {
    // Convert SearchTokenResult to Token format
    const token: Token = {
      name: searchResult.name,
      symbol: searchResult.symbol,
      mint: searchResult.mint,
      decimals: searchResult.decimals,
      image: searchResult.image,
      logoURI: searchResult.logoURI,
      price: searchResult.price || searchResult.priceUsd,
      priceUsd: searchResult.priceUsd,
      marketCap: searchResult.marketCap || searchResult.marketCapUsd,
      marketCapUsd: searchResult.marketCapUsd,
      liquidity: searchResult.liquidity || searchResult.liquidityUsd,
      liquidityUsd: searchResult.liquidityUsd,
      holders: searchResult.holders,
      verified: searchResult.verified,
      jupiter: searchResult.jupiter,
    };

    onTokenSelect(token);
    setIsOpen(false);
    setSearchQuery('');
    clearSearchResults();
  };

  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTokenSelect(null);
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchQuery('');
        clearSearchResults();
      }
    }
  };

  const renderTokenItem = (token: SearchTokenResult) => (
    <button
      key={token.mint}
      onClick={() => handleTokenSelect(token)}
      className="w-full bg-background border border-border rounded-xl p-4 hover:border-muted-foreground transition-all duration-200 cursor-pointer group"
    >
      {/* Main content row */}
      <div className="flex items-center justify-between mb-3">
        {/* Left section - Token info */}
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {/* Token Logo */}
          {token.image ? (
            <img
              src={token.image}
              alt={token.symbol}
              className="w-12 h-12 rounded-full flex-shrink-0 border-2 border-muted"
              onError={e => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0 border-2 border-muted">
              <span className="text-primary-foreground font-bold text-sm">
                {token.symbol?.charAt(0) || '?'}
              </span>
            </div>
          )}

          {/* Token Name & Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-bold text-foreground text-lg truncate">
                {token.symbol}
              </h3>
              {token.verified && (
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-2.5 h-2.5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3 text-sm text-muted-foreground">
              <span>{token.name}</span>
              <span className="font-mono">
                {token.mint
                  ? `${token.mint.slice(0, 4)}...${token.mint.slice(-4)}`
                  : 'Unknown'}
              </span>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>{formatNumber(token.holders || 0)} holders</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right section - Price */}
        <div className="text-right">
          <div className="text-lg font-bold text-foreground">
            $
            {formatNumber(
              token.priceUsd || 0,
              token.priceUsd && token.priceUsd < 0.01 ? 6 : 4
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-sm">
        {/* Left stats */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-muted-foreground">
              MC ${formatNumber(token.marketCapUsd || 0, 0, true)}
            </span>
          </div>
          {token.jupiter && (
            <div className="flex items-center space-x-1 px-2 py-1 bg-muted rounded text-xs">
              <span className="text-yellow-400">⚡</span>
              <span className="text-muted-foreground">Jupiter</span>
            </div>
          )}
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            <span className="text-muted-foreground">
              V ${formatNumber(token.volume_24h || 0, 0, true)}
            </span>
          </div>
        </div>

        {/* Right stats */}
        <div className="flex items-center space-x-2 text-muted-foreground">
          <div className="text-xs">
            Rank #{Math.floor(Math.random() * 1000) + 1}
          </div>
        </div>
      </div>
    </button>
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <Button
        variant="outline"
        onClick={handleToggle}
        disabled={disabled}
        className="w-full h-14 md:h-16 bg-background hover:bg-muted/50 border border-border rounded-xl transition-colors text-left p-4 flex items-center justify-between"
      >
        <div className="flex items-center justify-between w-full">
          {selectedToken ? (
            <>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Selected Token Icon */}
                <div className="relative flex-shrink-0">
                  {selectedToken.image ? (
                    <img
                      src={selectedToken.image}
                      alt={selectedToken.symbol}
                      className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-border"
                      onError={e => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center border border-border">
                      <span className="text-primary-foreground font-bold text-sm md:text-base">
                        {selectedToken.symbol?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Selected Token Info */}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-bold text-base md:text-lg truncate text-foreground">
                    {selectedToken.symbol}
                  </span>
                  <span className="text-sm md:text-base text-muted-foreground truncate">
                    {selectedToken.name}
                  </span>
                </div>

                {/* Clear Button */}
                <button
                  onClick={handleClearSelection}
                  className="ml-2 p-2 hover:bg-muted/60 rounded-lg transition-colors flex-shrink-0"
                  type="button"
                >
                  <X className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-start flex-1">
              <span className="text-foreground font-medium text-base md:text-lg">
                Select Token
              </span>
            </div>
          )}

          <ChevronDown
            className={`h-5 w-5 md:h-6 md:w-6 text-muted-foreground transition-transform flex-shrink-0 ml-2 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </Button>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className={`fixed inset-x-4 top-20 md:absolute md:top-full md:mt-2 md:w-[600px] md:max-w-[90vw] bg-background border border-border rounded-xl shadow-2xl z-[60] min-h-[500px] max-h-[70vh] overflow-hidden md:min-h-[600px] ${dropdownPosition === 'left' ? 'md:left-0' : 'md:right-0'}`}>
          {/* Mobile Close Button */}
          <div className="md:hidden absolute top-4 right-4 z-10">
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 bg-background/80 backdrop-blur-sm hover:bg-muted/60 rounded-lg transition-colors border border-border"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search Header */}
          <div className="p-4 md:p-6 border-b border-border">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search tokens: name, symbol, or address..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-12 pr-12 h-12 md:h-14 text-base md:text-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-primary rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-muted/60 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ maxHeight: 'calc(70vh - 120px)' }}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 md:py-20 gap-4">
                <Loader2 className="h-8 w-8 md:h-10 md:w-10 animate-spin text-primary" />
                <span className="text-base md:text-lg text-muted-foreground">
                  Searching tokens...
                </span>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="p-3 md:p-4 space-y-3">
                <div className="text-sm md:text-base text-muted-foreground mb-4 px-1">
                  Found {searchResults.length} token
                  {searchResults.length !== 1 ? 's' : ''}
                </div>
                {searchResults.map(renderTokenItem)}
              </div>
            ) : searchQuery ? (
              <div className="flex flex-col items-center justify-center py-16 md:py-20 gap-4 text-muted-foreground px-6">
                <div className="text-4xl md:text-5xl">🔍</div>
                <div className="text-center">
                  <div className="font-semibold text-lg md:text-xl mb-2 text-foreground">
                    No tokens found
                  </div>
                  <div className="text-sm md:text-base max-w-md">
                    No results for "{searchQuery}". Try searching by token name,
                    symbol, or contract address.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 md:py-20 gap-4 text-muted-foreground px-6">
                <div className="text-4xl md:text-5xl">🪙</div>
                <div className="text-center">
                  <div className="font-semibold text-lg md:text-xl mb-3 text-foreground">
                    Search for tokens
                  </div>
                  <div className="text-sm md:text-base space-y-2 max-w-md">
                    <div>Type token name, symbol, or address above</div>
                    <div className="text-xs md:text-sm text-muted-foreground/80">
                      Examples: "BONK", "Solana", or paste any contract address
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenSelector;
