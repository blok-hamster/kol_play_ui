'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCallback } from 'react';
import {
  Token,
  TokenDetails,
  SearchTokenResult,
  SearchFilters,
  TokenFilters,
  SearchTokensRequest,
  UnifiedSearchResult,
  UnifiedSearchRequest,
  AddressSearchResult,
} from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';
import { TokenService } from '@/services/token.service';

interface TokenState {
  // Search functionality
  searchResults: SearchTokenResult[];
  searchQuery: string;
  searchFilters: SearchFilters;
  isSearching: boolean;

  // Unified search functionality
  unifiedSearchResults: UnifiedSearchResult[];
  isUnifiedSearching: boolean;

  // Token categories
  trendingTokens: SearchTokenResult[];
  highVolumeTokens: SearchTokenResult[];
  latestTokens: SearchTokenResult[];
  isLoadingTrending: boolean;
  isLoadingVolume: boolean;
  isLoadingLatest: boolean;

  // Selected token details
  selectedToken: TokenDetails | null;
  isLoadingTokenDetails: boolean;

  // Token cache for detail pages
  tokenCache: Map<string, SearchTokenResult>;

  // Watchlist
  watchlist: Token[];

  // Filters and pagination
  tokenFilters: TokenFilters;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;

  // Error states
  error: string | null;

  // Actions
  setError: (error: string | null) => void;

  // Search actions
  setSearchResults: (results: SearchTokenResult[]) => void;
  setSearchQuery: (query: string) => void;
  setSearchFilters: (filters: SearchFilters) => void;
  setSearching: (searching: boolean) => void;
  clearSearchResults: () => void;

  // Unified search actions
  setUnifiedSearchResults: (results: UnifiedSearchResult[]) => void;
  setUnifiedSearching: (searching: boolean) => void;
  clearUnifiedSearchResults: () => void;

  // Token category actions
  setTrendingTokens: (tokens: SearchTokenResult[]) => void;
  setHighVolumeTokens: (tokens: SearchTokenResult[]) => void;
  setLatestTokens: (tokens: SearchTokenResult[]) => void;
  setLoadingTrending: (loading: boolean) => void;
  setLoadingVolume: (loading: boolean) => void;
  setLoadingLatest: (loading: boolean) => void;

  // Token detail actions
  setSelectedToken: (token: TokenDetails | null) => void;
  setLoadingTokenDetails: (loading: boolean) => void;

  // Token cache actions
  cacheToken: (token: SearchTokenResult) => void;
  cacheTokens: (tokens: SearchTokenResult[]) => void;
  getTokenByMint: (mint: string) => SearchTokenResult | null;
  clearTokenCache: () => void;

  // Watchlist actions
  setWatchlist: (watchlist: Token[]) => void;
  addToWatchlist: (token: Token) => void;
  removeFromWatchlist: (mint: string) => void;
  toggleWatchlist: (token: Token) => void;

  // Filter and pagination actions
  setTokenFilters: (filters: TokenFilters) => void;
  updateTokenFilters: (updates: Partial<TokenFilters>) => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  setHasMore: (hasMore: boolean) => void;

  // Clear actions
  clearTokenData: () => void;
}

export const useTokenStore = create<TokenState>()(
  persist(
    (set, get) => ({
      // Initial state
      searchResults: [],
      searchQuery: '',
      searchFilters: {
        page: 1,
        limit: 20,
        sortBy: 'marketCapUsd',
        sortOrder: 'desc',
      },
      isSearching: false,

      unifiedSearchResults: [],
      isUnifiedSearching: false,

      trendingTokens: [],
      highVolumeTokens: [],
      latestTokens: [],
      isLoadingTrending: false,
      isLoadingVolume: false,
      isLoadingLatest: false,

      selectedToken: null,
      isLoadingTokenDetails: false,

      tokenCache: new Map(),

      watchlist: [],

      tokenFilters: {
        page: 1,
        limit: 20,
        sortBy: 'marketCapUsd',
        sortOrder: 'desc',
        timeframe: '24h',
        verified: false,
      },
      currentPage: 1,
      totalPages: 1,
      hasMore: false,

      error: null,

      // Basic setters
      setError: error => set({ error }),

      // Search actions
      setSearchResults: searchResults => set({ searchResults }),
      setSearchQuery: searchQuery => set({ searchQuery }),
      setSearchFilters: searchFilters => set({ searchFilters }),
      setSearching: isSearching => set({ isSearching }),
      clearSearchResults: () => set({ searchResults: [], searchQuery: '' }),

      // Unified search actions
      setUnifiedSearchResults: unifiedSearchResults =>
        set({ unifiedSearchResults }),
      setUnifiedSearching: isUnifiedSearching => set({ isUnifiedSearching }),
      clearUnifiedSearchResults: () => set({ unifiedSearchResults: [] }),

      // Token category actions
      setTrendingTokens: tokens => {
        set({ trendingTokens: tokens });
        // Automatically cache tokens for detail pages
        const currentCache = get().tokenCache;
        tokens.forEach(token => currentCache.set(token.mint, token));
        set({ tokenCache: currentCache });
      },
      setHighVolumeTokens: tokens => {
        set({ highVolumeTokens: tokens });
        // Automatically cache tokens for detail pages
        const currentCache = get().tokenCache;
        tokens.forEach(token => currentCache.set(token.mint, token));
        set({ tokenCache: currentCache });
      },
      setLatestTokens: tokens => {
        set({ latestTokens: tokens });
        // Automatically cache tokens for detail pages
        const currentCache = get().tokenCache;
        tokens.forEach(token => currentCache.set(token.mint, token));
        set({ tokenCache: currentCache });
      },
      setLoadingTrending: isLoadingTrending => set({ isLoadingTrending }),
      setLoadingVolume: isLoadingVolume => set({ isLoadingVolume }),
      setLoadingLatest: isLoadingLatest => set({ isLoadingLatest }),

      // Token detail actions
      setSelectedToken: selectedToken => set({ selectedToken }),
      setLoadingTokenDetails: isLoadingTokenDetails =>
        set({ isLoadingTokenDetails }),

      // Token cache actions
      cacheToken: token => {
        set({ tokenCache: get().tokenCache.set(token.mint, token) });
      },
      cacheTokens: tokens => {
        tokens.forEach(token =>
          set({ tokenCache: get().tokenCache.set(token.mint, token) })
        );
      },
      getTokenByMint: mint => get().tokenCache.get(mint) || null,
      clearTokenCache: () => set({ tokenCache: new Map() }),

      // Watchlist actions
      setWatchlist: watchlist => set({ watchlist }),

      addToWatchlist: token => {
        const current = get().watchlist;
        const exists = current.find(t => t.mint === token.mint);

        if (!exists) {
          set({ watchlist: [...current, token] });
        }
      },

      removeFromWatchlist: mint => {
        const current = get().watchlist;
        set({ watchlist: current.filter(t => t.mint !== mint) });
      },

      toggleWatchlist: token => {
        const current = get().watchlist;
        const exists = current.find(t => t.mint === token.mint);

        if (exists) {
          set({ watchlist: current.filter(t => t.mint !== token.mint) });
        } else {
          set({ watchlist: [...current, token] });
        }
      },

      // Filter and pagination actions
      setTokenFilters: tokenFilters => set({ tokenFilters }),

      updateTokenFilters: updates => {
        const current = get().tokenFilters;
        set({ tokenFilters: { ...current, ...updates } });
      },

      setCurrentPage: currentPage => set({ currentPage }),
      setTotalPages: totalPages => set({ totalPages }),
      setHasMore: hasMore => set({ hasMore }),

      // Clear actions
      clearTokenData: () =>
        set({
          searchResults: [],
          searchQuery: '',
          unifiedSearchResults: [],
          trendingTokens: [],
          highVolumeTokens: [],
          latestTokens: [],
          selectedToken: null,
          currentPage: 1,
          totalPages: 1,
          hasMore: false,
          error: null,
        }),
    }),
    {
      name: STORAGE_KEYS.TOKEN_DATA || 'token-data',
      partialize: state => ({
        // Persist watchlist and search preferences
        watchlist: state.watchlist,
        tokenFilters: state.tokenFilters,
        searchFilters: state.searchFilters,
      }),
    }
  )
);

// Helper hooks for token operations
export const useTokenSearch = () => {
  const {
    searchResults,
    searchQuery,
    searchFilters,
    isSearching,
    setSearchResults,
    setSearchQuery,
    setSearchFilters,
    setSearching,
    clearSearchResults,
    setError,
    cacheTokens,
  } = useTokenStore();

  const searchTokens = useCallback(
    async (request: SearchTokensRequest) => {
      try {
        setSearching(true);
        setError(null);

        const response = await TokenService.searchTokens(request);

        // Check if we have data (the API returns { message, data } format)
        if (response.data && Array.isArray(response.data)) {
          setSearchResults(response.data);
          setSearchQuery(request.query);
          // Cache the search results for detail pages
          cacheTokens(response.data);
        } else {
          throw new Error(response.message || 'No search results returned');
        }
      } catch (error) {
        console.error('Token search failed:', error);
        setError(
          error instanceof Error ? error.message : 'Failed to search tokens'
        );
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [setSearching, setError, setSearchResults, setSearchQuery, cacheTokens]
  );

  return {
    searchResults,
    searchQuery,
    searchFilters,
    isSearching,
    isLoading: isSearching, // Alias for compatibility
    setSearchResults,
    setSearchQuery,
    setSearchFilters,
    setSearching,
    clearSearchResults,
    searchTokens, // The missing function that actually calls the API
    // Convenience methods
    hasSearchResults: searchResults.length > 0,
    isSearchQueryEmpty: searchQuery.trim() === '',
  };
};

export const useUnifiedSearch = () => {
  const {
    unifiedSearchResults,
    isUnifiedSearching,
    setUnifiedSearchResults,
    setUnifiedSearching,
    clearUnifiedSearchResults,
    setError,
    cacheTokens,
  } = useTokenStore();

  const unifiedSearch = useCallback(
    async (request: UnifiedSearchRequest) => {
      try {
        setUnifiedSearching(true);
        setError(null);

        const response = await TokenService.unifiedSearch(request);

        // Check if we have data
        if (response.data && Array.isArray(response.data)) {
          setUnifiedSearchResults(response.data);

          // Cache any token results for detail pages
          const tokenResults = response.data
            .filter(result => result.type === 'token')
            .map(result => result.data as SearchTokenResult);
          if (tokenResults.length > 0) {
            cacheTokens(tokenResults);
          }
        } else {
          throw new Error(response.message || 'No search results returned');
        }
      } catch (error) {
        console.error('Unified search failed:', error);
        setError(error instanceof Error ? error.message : 'Failed to search');
        setUnifiedSearchResults([]);
      } finally {
        setUnifiedSearching(false);
      }
    },
    [setUnifiedSearching, setError, setUnifiedSearchResults, cacheTokens]
  );

  return {
    unifiedSearchResults,
    isUnifiedSearching,
    isLoading: isUnifiedSearching, // Alias for compatibility
    setUnifiedSearchResults,
    setUnifiedSearching,
    clearUnifiedSearchResults,
    unifiedSearch,
    // Convenience methods
    hasResults: unifiedSearchResults.length > 0,
    tokenResults: unifiedSearchResults.filter(r => r.type === 'token'),
    addressResults: unifiedSearchResults.filter(r => r.type === 'address'),
  };
};

export const useTokenCategories = () => {
  const {
    trendingTokens,
    highVolumeTokens,
    latestTokens,
    isLoadingTrending,
    isLoadingVolume,
    isLoadingLatest,
    setTrendingTokens,
    setHighVolumeTokens,
    setLatestTokens,
    setLoadingTrending,
    setLoadingVolume,
    setLoadingLatest,
  } = useTokenStore();

  return {
    trendingTokens,
    highVolumeTokens,
    latestTokens,
    isLoadingTrending,
    isLoadingVolume,
    isLoadingLatest,
    setTrendingTokens,
    setHighVolumeTokens,
    setLatestTokens,
    setLoadingTrending,
    setLoadingVolume,
    setLoadingLatest,
  };
};

export const useWatchlist = () => {
  const {
    watchlist,
    setWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
  } = useTokenStore();

  return {
    watchlist,
    setWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    // Convenience methods
    isInWatchlist: (mint: string) =>
      watchlist.some(token => token.mint === mint),
    watchlistCount: watchlist.length,
  };
};

export const useTokenDetails = () => {
  const {
    selectedToken,
    isLoadingTokenDetails,
    setSelectedToken,
    setLoadingTokenDetails,
  } = useTokenStore();

  return {
    selectedToken,
    isLoadingTokenDetails,
    setSelectedToken,
    setLoadingTokenDetails,
  };
};
