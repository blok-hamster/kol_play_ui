'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/app-layout';
import { TokenService } from '@/services';
import { useTokenSearch, useLoading, useNotifications } from '@/stores';
import {
  SearchTokenResult,
  SearchTokensRequest,
  TokenSearchFilters,
} from '@/types';
import { formatNumber } from '@/lib/utils';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TokenSearchPage() {
  const searchParams = useSearchParams();
  const { setSearchResults } = useTokenSearch();
  const { isLoading, setLoading } = useLoading();
  const { showError } = useNotifications();

  // Local state - use SearchTokenResult[] for proper typing
  const [searchResults, setLocalSearchResults] = useState<SearchTokenResult[]>(
    []
  );
  const [filters, setFilters] = useState<TokenSearchFilters>({
    page: 1,
    limit: 20,
    query: searchParams.get('q') || '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Search tokens
  const searchTokens = useCallback(
    async (searchFilters: TokenSearchFilters) => {
      try {
        setLoading('tokenSearch', true);

        // Convert TokenSearchFilters to SearchTokensRequest
        const searchRequest: SearchTokensRequest = {
          query: searchFilters.query || '',
          page: searchFilters.page || 1,
          limit: searchFilters.limit || 20,
          ...(searchFilters.sortBy && { sortBy: searchFilters.sortBy }),
          ...(searchFilters.sortOrder && {
            sortOrder: searchFilters.sortOrder,
          }),
        };

        const response = await TokenService.searchTokens(searchRequest);

        if (searchFilters.page === 1) {
          setLocalSearchResults(response.data);
          setSearchResults(response.data); // Also update global store
        } else {
          setLocalSearchResults((prev: SearchTokenResult[]) => [
            ...prev,
            ...response.data,
          ]);
        }

        setHasMore(response.data.length === (searchFilters.limit || 20));
      } catch (error: any) {
        showError('Search Failed', error.message || 'Failed to search tokens');
      } finally {
        setLoading('tokenSearch', false);
      }
    },
    [setSearchResults, setLoading, showError]
  );

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<TokenSearchFilters>) => {
      const updatedFilters = { ...filters, ...newFilters };
      // Remove undefined values to avoid exactOptionalPropertyTypes issues
      Object.keys(updatedFilters).forEach(key => {
        if (updatedFilters[key as keyof TokenSearchFilters] === undefined) {
          delete updatedFilters[key as keyof TokenSearchFilters];
        }
      });
      setFilters(updatedFilters);
    },
    [filters]
  );

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (!isLoading('tokenSearch') && hasMore && filters.page) {
      const nextPage = filters.page + 1;
      handleFilterChange({ page: nextPage });
    }
  }, [filters.page, hasMore, isLoading, handleFilterChange]);

  // Handle token selection
  const handleTokenSelect = useCallback((_token: SearchTokenResult) => {
    // Navigation logic would go here
  }, []);

  // Handle quick buy
  const handleQuickBuy = useCallback((_token: SearchTokenResult) => {
    // Quick buy logic would go here
  }, []);

  // Initial search on page load
  useEffect(() => {
    if (filters.query) {
      searchTokens({ ...filters, query: filters.query });
    }
  }, [filters.query, searchTokens]);

  // Filter and sort tokens locally
  const filteredTokens = useMemo(() => {
    let filtered = searchResults;

    // Apply local filters
    if (filters.minPrice !== undefined) {
      filtered = filtered.filter(
        token => (token.price || token.priceUsd || 0) >= filters.minPrice!
      );
    }

    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter(
        token => (token.price || token.priceUsd || 0) <= filters.maxPrice!
      );
    }

    if (filters.minMarketCap !== undefined) {
      filtered = filtered.filter(
        token =>
          (token.marketCap || token.marketCapUsd || 0) >= filters.minMarketCap!
      );
    }

    if (filters.maxMarketCap !== undefined) {
      filtered = filtered.filter(
        token =>
          (token.marketCap || token.marketCapUsd || 0) <= filters.maxMarketCap!
      );
    }

    if (filters.verified !== undefined) {
      filtered = filtered.filter(
        token => Boolean(token.verified) === filters.verified
      );
    }

    return filtered;
  }, [searchResults, filters]);

  return (
    <AppLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-foreground">Token Search</h1>

            <Button
              onClick={() => {
                /* router.back() */
              }}
              variant="outline"
              className="flex items-center"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </Button>
          </div>

          {/* Search Input */}
          <div className="mb-6">
            {/* TokenSearch component was removed as per the new_code */}
          </div>

          {/* Results Summary */}
          {filters.query && (
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">
                {isLoading('tokenSearch')
                  ? 'Searching...'
                  : `${filteredTokens.length} results for "${filters.query}"`}
              </p>

              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-background rounded-lg border border-border p-6 mb-8">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Filter Results
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={e =>
                    handleFilterChange({ sortBy: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                >
                  <option value="marketCap">Market Cap</option>
                  <option value="price">Price</option>
                  <option value="volume">Volume</option>
                  <option value="liquidity">Liquidity</option>
                  <option value="name">Name</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Min Price ($)
                </label>
                <input
                  type="number"
                  placeholder="Min price"
                  value={filters.minPrice || ''}
                  onChange={e => {
                    const value = e.target.value;
                    const newFilters: Partial<TokenSearchFilters> = {};
                    if (value) {
                      newFilters.minPrice = parseFloat(value);
                    }
                    handleFilterChange(newFilters);
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Max Price ($)
                </label>
                <input
                  type="number"
                  placeholder="Max price"
                  value={filters.maxPrice || ''}
                  onChange={e => {
                    const value = e.target.value;
                    const newFilters: Partial<TokenSearchFilters> = {};
                    if (value) {
                      newFilters.maxPrice = parseFloat(value);
                    }
                    handleFilterChange(newFilters);
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Min Market Cap ($)
                </label>
                <input
                  type="number"
                  placeholder="Min market cap"
                  value={filters.minMarketCap || ''}
                  onChange={e => {
                    const value = e.target.value;
                    const newFilters: Partial<TokenSearchFilters> = {};
                    if (value) {
                      newFilters.minMarketCap = parseFloat(value);
                    }
                    handleFilterChange(newFilters);
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>

              <div className="flex items-center justify-end mt-4">
                <Button
                  onClick={() =>
                    setFilters({
                      page: 1,
                      limit: 20,
                      query: filters.query || '',
                      sortBy: 'marketCap',
                      sortOrder: 'desc',
                    })
                  }
                  variant="outline"
                  size="sm"
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Search Results */}
        {filters.query && (
          <div className="space-y-6">
            {/* Loading State */}
            {isLoading('tokenSearch') && filteredTokens.length === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-background rounded-lg border border-border p-6 animate-pulse"
                  >
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 bg-muted rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded mb-2"></div>
                        <div className="h-3 bg-muted rounded w-2/3"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded"></div>
                      <div className="h-3 bg-muted rounded w-3/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Token Results Grid */}
            {filteredTokens.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTokens.map(token => (
                  <div
                    key={token.mint}
                    className="bg-background rounded-lg border border-border hover:border-muted-foreground transition-all duration-200 p-6 cursor-pointer group"
                    onClick={() => handleTokenSelect(token)}
                  >
                    {/* Token Header */}
                    <div className="flex items-center space-x-4">
                      {/* Token Logo */}
                      {token.logoURI || token.image ? (
                        <img
                          src={token.logoURI || token.image}
                          alt={token.symbol || token.name}
                          className="w-12 h-12 rounded-full flex-shrink-0"
                          onError={e => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold">
                            {(token.symbol || token.name || '?')
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Token Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-foreground">
                            {token.symbol || token.name || 'Unknown'}
                          </h3>
                          {token.verified && (
                            <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                              Verified
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground truncate">
                          {token.name && token.symbol !== token.name
                            ? token.name
                            : `${token.mint.slice(0, 8)}...${token.mint.slice(-4)}`}
                        </p>
                      </div>

                      {/* Token Stats */}
                      <div className="flex space-x-6">
                        {(token.price || token.priceUsd) && (
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              Price
                            </p>
                            <p className="font-medium text-foreground">
                              $
                              {formatNumber(token.price || token.priceUsd || 0)}
                            </p>
                          </div>
                        )}

                        {(token.marketCap || token.marketCapUsd) && (
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              Market Cap
                            </p>
                            <p className="font-medium text-foreground">
                              {formatNumber(
                                token.marketCap || token.marketCapUsd || 0
                              )}
                            </p>
                          </div>
                        )}

                        {(token.liquidity || token.liquidityUsd) && (
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              Liquidity
                            </p>
                            <p className="font-medium text-foreground">
                              {formatNumber(
                                token.liquidity || token.liquidityUsd || 0
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3 mt-6 pt-4 border-t border-border">
                      <Button
                        onClick={e => {
                          e.stopPropagation();
                          handleTokenSelect(token);
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        View Details
                      </Button>

                      <Button
                        onClick={e => {
                          e.stopPropagation();
                          handleQuickBuy(token);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Buy
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center">
                <Button
                  onClick={handleLoadMore}
                  disabled={isLoading('tokenSearch')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  {isLoading('tokenSearch') && (
                    <svg
                      className="animate-spin h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  <span>
                    {isLoading('tokenSearch')
                      ? 'Loading...'
                      : 'Load More Results'}
                  </span>
                </Button>
              </div>
            )}

            {/* Empty State */}
            {filteredTokens.length === 0 &&
              !isLoading('tokenSearch') &&
              filters.query && (
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-foreground">
                    No tokens found
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No tokens match your search criteria. Try adjusting your
                    filters or search terms.
                  </p>
                </div>
              )}
          </div>
        )}

        {/* No Query State */}
        {!filters.query && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-foreground">
              Search for tokens
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the search bar above to find tokens by name, symbol, or
              contract address.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
