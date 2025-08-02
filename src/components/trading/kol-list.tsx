'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import { TradingService } from '@/services/trading.service';
import { useSubscriptions, useLoading, useNotifications } from '@/stores';
import { useLiveTradesUpdates } from '@/hooks';
import { APP_CONFIG } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingUp,
  Users,
  Star,
  Copy,
  ExternalLink,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Search,
  SortAsc,
  SortDesc,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import KOLTradesModal from './kol-trades-modal';
import type { SearchFilters, KOLTrade, KOLWallet } from '@/types';

interface KOLListProps {
  className?: string;
  limit?: number;
  showHeader?: boolean;
  compactMode?: boolean;
}

interface KOLListFilters extends SearchFilters {
  sortBy?: 'subscriberCount' | 'totalTrades' | 'totalPnL' | 'winRate';
}

// Add interface for KOL with recent trades
interface KOLWithTrades extends KOLWallet {
  recentTrades?: KOLTrade[];
  tradesLoading?: boolean;
  socialLinks?: {
    twitter?: string;
    telegram?: string;
  };
}

export default function KOLList({
  className = '',
  limit,
  showHeader = true,
  compactMode = false,
}: KOLListProps) {
  const router = useRouter();
  const { isSubscribedToKOL } = useSubscriptions();
  const { isLoading, setLoading } = useLoading();
  const { showError } = useNotifications();

  // State
  const [kolWallets, setKolWallets] = useState<KOLWithTrades[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<KOLListFilters>({
    page: 1,
    limit: limit || APP_CONFIG.DEFAULT_PAGE_SIZE,
    sortBy: 'subscriberCount',
    sortOrder: 'desc',
  });
  const [hasMore, setHasMore] = useState(false);

  // Modal state - store the selected KOL object
  const [selectedKOL, setSelectedKOL] = useState<KOLWithTrades | null>(null);
  const [isKOLTradesModalOpen, setIsKOLTradesModalOpen] = useState(false);

  // Track if we've already loaded initial data
  const hasLoadedInitialData = useRef(false);
  const isCurrentlyFetching = useRef(false);

  // Fetch data on mount and filter changes
  useEffect(() => {
    // Prevent multiple simultaneous calls
    if (isCurrentlyFetching.current || isLoading('kolList')) {
      return;
    }

    const fetchKOLWallets = async () => {
      isCurrentlyFetching.current = true;

      try {
        setLoading('kolList', true);

        // Build search filters with proper optional property handling
        const searchFilters: Partial<SearchFilters> = {};
        if (filters.page) searchFilters.page = filters.page;
        if (filters.limit) searchFilters.limit = filters.limit;
        if (searchQuery) searchFilters.query = searchQuery;
        if (filters.sortBy) searchFilters.sortBy = filters.sortBy;
        if (filters.sortOrder) searchFilters.sortOrder = filters.sortOrder;

        const response = await TradingService.getKOLWallets(
          searchFilters as SearchFilters
        );

        let newKOLs: KOLWithTrades[];
        if (filters.page === 1) {
          newKOLs = response.data.map(kol => ({
            ...kol,
            recentTrades: [],
            tradesLoading: false,
          }));
          setKolWallets(newKOLs);
        } else {
          newKOLs = response.data.map(kol => ({
            ...kol,
            recentTrades: [],
            tradesLoading: false,
          }));
          setKolWallets(prev => [...prev, ...newKOLs]);
        }

        setHasMore(response.data.length === filters.limit);
        hasLoadedInitialData.current = true;
      } catch (error: any) {
        showError('Load Error', error.message || 'Failed to load KOL wallets');
        console.error('Failed to fetch KOL wallets:', error);
      } finally {
        setLoading('kolList', false);
        isCurrentlyFetching.current = false;
      }
    };

    fetchKOLWallets();
  }, [filters.page, filters.sortBy, filters.sortOrder, searchQuery]);

  // Real-time updates for live trades
  useLiveTradesUpdates({
    throttle: 1000,
  });

  // Handle KOL click
  const handleKOLClick = useCallback((kol: KOLWithTrades) => {
    setSelectedKOL(kol);
    setIsKOLTradesModalOpen(true);
  }, []);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setFilters(prev => ({ ...prev, page: 1 }));
  }, []);

  // Handle sort
  const handleSort = useCallback((sortBy: KOLListFilters['sortBy']) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder:
        prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));
  }, []);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (!isLoading('kolList') && hasMore) {
      setFilters(prev => ({ ...prev, page: prev.page + 1 }));
    }
  }, [isLoading, hasMore]);

  // Render KOL card
  const renderKOLCard = useCallback(
    (kol: KOLWithTrades) => {
      const isSubscribed = isSubscribedToKOL(kol.walletAddress || '');

      return (
        <div
          key={kol.walletAddress || `kol-${Math.random()}`}
          className="bg-background border border-border rounded-xl p-4 hover:border-muted-foreground transition-all duration-200 cursor-pointer group"
          onClick={() => kol.walletAddress && handleKOLClick(kol)}
        >
          {/* Main content row */}
          <div className="flex items-center justify-between mb-3">
            {/* Left section - KOL info */}
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* KOL Avatar */}
              {kol.avatar ? (
                <img
                  src={kol.avatar}
                  alt={kol.name || 'KOL Avatar'}
                  className="w-12 h-12 rounded-full flex-shrink-0 border-2 border-muted"
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0 border-2 border-muted">
                  <span className="text-primary-foreground font-bold text-sm">
                    {(
                      kol.name ||
                      (kol.walletAddress ? kol.walletAddress.slice(0, 2) : 'KO')
                    ).toUpperCase()}
                  </span>
                </div>
              )}

              {/* KOL Name & Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-bold text-foreground text-lg truncate">
                    {kol.name ||
                      (kol.walletAddress
                        ? `${kol.walletAddress.slice(0, 6)}...${kol.walletAddress.slice(-4)}`
                        : 'Unknown KOL')}
                  </h3>
                  {isSubscribed && (
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
                  <span>
                    {(kol.subscriberCount || 0).toLocaleString()} followers
                  </span>
                  <span className="font-mono">
                    {kol.walletAddress
                      ? `${kol.walletAddress.slice(0, 4)}...${kol.walletAddress.slice(-4)}`
                      : 'Unknown'}
                  </span>
                  <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span>{kol.totalTrades?.toLocaleString() || 0} trades</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right section - Click indicator */}
            <div className="flex items-center space-x-2">
              <div className="text-sm text-muted-foreground flex items-center space-x-1">
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">View Details</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between text-sm">
            {/* Left stats */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    (kol.winRate || 0) >= 60
                      ? 'bg-green-500'
                      : (kol.winRate || 0) >= 40
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                ></span>
                <span className="text-muted-foreground">
                  {kol.winRate?.toFixed(1) || '0.0'}% win rate
                </span>
              </div>
              <div className="flex items-center space-x-1 px-2 py-1 bg-muted rounded text-xs">
                <span className="text-blue-400">📈</span>
                <span className="text-muted-foreground">Active</span>
              </div>
              <div className="flex items-center space-x-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    (kol.totalPnL || 0) >= 0 ? 'bg-green-500' : 'bg-red-500'
                  }`}
                ></span>
                <span
                  className={`${
                    (kol.totalPnL || 0) >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {kol.totalPnL !== undefined
                    ? `${kol.totalPnL >= 0 ? '+' : ''}${kol.totalPnL.toFixed(2)} SOL`
                    : '0.00 SOL'}
                </span>
              </div>
            </div>

            {/* Right stats - Social links */}
            <div className="flex items-center space-x-2 text-muted-foreground">
              {kol.socialLinks?.twitter && (
                <a
                  href={kol.socialLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-4 h-4 text-blue-500 hover:text-blue-600 transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                  </svg>
                </a>
              )}
              {kol.socialLinks?.telegram && (
                <a
                  href={kol.socialLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-4 h-4 text-blue-500 hover:text-blue-600 transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.062 7.81c.455 2.546-1.217 8.423-1.74 11.176-.221 1.164-.652 1.554-1.07 1.594-.91.084-1.601-.602-2.483-1.18l-3.86-2.723c-1.685-1.226-2.973-2.006-2.41-3.178.564-1.177 2.114-.552 3.328.184 1.214.736 2.703 1.729 3.828 2.462l1.36.881c.456.309.87.594 1.302.871.432.277.79.425 1.223.425.65 0 1.27-.272 1.708-.747.328-.355.529-.804.567-1.283.11-1.39-.234-2.79-.234-2.79s.004-1.177-.004-1.762c-.007-.57-.045-1.107-.104-1.56-.13-1.009-.462-1.647-.913-2.048-.45-.4-1.05-.621-1.796-.621-.746 0-1.346.221-1.796.621-.237.21-.419.476-.544.78z" />
                  </svg>
                </a>
              )}
              <div className="text-xs">
                Rank #{Math.floor(Math.random() * 100) + 1}
              </div>
            </div>
          </div>
        </div>
      );
    },
    [isSubscribedToKOL, handleKOLClick, compactMode]
  );

  // Render loading state
  if (isLoading('kolList') && kolWallets.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        {showHeader && (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">KOL Wallets</h2>
          </div>
        )}
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">
            Loading KOL wallets...
          </span>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!isLoading('kolList') && kolWallets.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        {showHeader && (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">KOL Wallets</h2>
          </div>
        )}
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No KOL wallets found matching your criteria.
          </p>
          <button
            onClick={() => {
              // Reset filters and reload
              setSearchQuery('');
              setFilters(prev => ({ ...prev, page: 1 }));
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Reset Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            KOL Wallets
          </h2>

          {/* Controls */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search KOLs..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="
                  pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  placeholder-gray-500 dark:placeholder-gray-400
                  w-64
                "
              />
            </div>

            {/* Sort */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleSort('subscriberCount')}
                className={`
                  flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors
                  ${
                    filters.sortBy === 'subscriberCount'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                <span className="text-sm font-medium">Subscribers</span>
                {filters.sortBy === 'subscriberCount' &&
                  (filters.sortOrder === 'desc' ? (
                    <SortDesc className="w-4 h-4" />
                  ) : (
                    <SortAsc className="w-4 h-4" />
                  ))}
              </button>

              <button
                onClick={() => handleSort('totalPnL')}
                className={`
                  flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors
                  ${
                    filters.sortBy === 'totalPnL'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                <span className="text-sm font-medium">PnL</span>
                {filters.sortBy === 'totalPnL' &&
                  (filters.sortOrder === 'desc' ? (
                    <SortDesc className="w-4 h-4" />
                  ) : (
                    <SortAsc className="w-4 h-4" />
                  ))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KOL Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {kolWallets.map(renderKOLCard)}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-6">
          <button
            onClick={handleLoadMore}
            disabled={isLoading('kolList')}
            className="flex items-center space-x-2 px-6 py-3 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {isLoading('kolList') && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            <span>{isLoading('kolList') ? 'Loading...' : 'Load More'}</span>
          </button>
        </div>
      )}

      {/* KOL Trades Modal */}
      {selectedKOL && (
        <KOLTradesModal
          kol={selectedKOL}
          walletAddress={selectedKOL.walletAddress}
          isOpen={isKOLTradesModalOpen}
          onClose={() => setIsKOLTradesModalOpen(false)}
        />
      )}
    </div>
  );
}
