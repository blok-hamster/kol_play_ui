'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/app-layout';
import SubscriptionCard from '@/components/trading/subscription-card';
import SubscriptionStats from '@/components/trading/subscription-stats';
import { useSubscriptionManager } from '@/hooks/use-subscription-manager';
import { useNotifications } from '@/stores/use-ui-store';
import { UserSubscription } from '@/types';
import {
  Users,
  TrendingUp,
  DollarSign,
  Activity,
  Search,
  Filter,
  Settings,
  Plus,
  Loader2,
  RefreshCw,
  LayoutGrid,
  List as ListIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import RequireAuth from '@/components/auth/require-auth';

interface SubscriptionFilters {
  status: 'all' | 'active' | 'paused';
  type: 'all' | 'trade' | 'watch';
  sortBy: 'dateAdded' | 'performance' | 'name';
  sortOrder: 'asc' | 'desc';
}

const SubscriptionsPage: React.FC = () => {
  const {
    subscriptions,
    isLoading: isLoadingSubscriptions,
    hasLoaded,
    refresh,
  } = useSubscriptionManager();
  
  const { showSuccess } = useNotifications();

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SubscriptionFilters>({
    status: 'all',
    type: 'all',
    sortBy: 'dateAdded',
    sortOrder: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Handle manual refresh
  const handleRefresh = async () => {
    await refresh();
  };

  // Filter and sort subscriptions
  const filteredSubscriptions = React.useMemo(() => {
    let filtered = subscriptions.filter(sub => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesWallet = sub.kolWallet?.toLowerCase().includes(query);
        return matchesWallet;
      }

      return true;
    });

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(sub => {
        if (filters.status === 'active') return sub.isActive;
        if (filters.status === 'paused') return !sub.isActive;
        return true;
      });
    }

    // Type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(sub => sub.type === filters.type);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'dateAdded':
          comparison =
            new Date(a.createdAt || 0).getTime() -
            new Date(b.createdAt || 0).getTime();
          break;
        case 'name':
          comparison = (a.kolWallet || '').localeCompare(b.kolWallet || '');
          break;
        case 'performance':
          // This would need performance data from another source
          comparison = 0;
          break;
        default:
          comparison = 0;
      }

      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [subscriptions, searchQuery, filters]);

  // Calculate summary stats
  const stats = React.useMemo(() => {
    const activeCount = subscriptions.filter(sub => sub.isActive).length;
    const tradeCount = subscriptions.filter(sub => sub.type === 'trade').length;
    const watchCount = subscriptions.filter(sub => sub.type === 'watch').length;

    return {
      total: subscriptions.length,
      active: activeCount,
      paused: subscriptions.length - activeCount,
      trading: tradeCount,
      watching: watchCount,
    };
  }, [subscriptions]);

  return (
    <RequireAuth title="Sign In Required" message="Please sign in to manage your subscriptions.">
      <AppLayout>
      <div className="p-6 space-y-8">
        
        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoadingSubscriptions}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingSubscriptions ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Link href="/kols">
            <Button className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Add Subscription</span>
            </Button>
          </Link>
        </div>

        {/* Stats Overview */}
        <SubscriptionStats stats={stats} />

        {/* Search and Filters */}
        <div className="bg-background rounded-lg border border-border p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-semibold text-foreground">
              Active Subscriptions ({filteredSubscriptions.length})
            </h2>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by wallet address..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent w-full sm:w-64"
                />
              </div>

              {/* Secondary Controls */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Filter Toggle */}
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-2"
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                </Button>

                {/* View Mode Toggle */}
                <div className="flex items-center border border-border rounded-lg overflow-hidden w-full sm:w-auto">
                  <button
                    type="button"
                    aria-label="Grid view"
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-2 h-9 text-sm flex items-center gap-2 w-1/2 sm:w-auto justify-center ${viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="hidden sm:inline">Grid</span>
                  </button>
                  <button
                    type="button"
                    aria-label="List view"
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 h-9 text-sm flex items-center gap-2 border-l border-border w-1/2 sm:w-auto justify-center ${viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <ListIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">List</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-muted/30 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      status: e.target.value as any,
                    }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Type
                </label>
                <select
                  value={filters.type}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      type: e.target.value as any,
                    }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="trade">Copy Trading</option>
                  <option value="watch">Watch Only</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      sortBy: e.target.value as any,
                    }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="dateAdded">Date Added</option>
                  <option value="name">Name</option>
                  <option value="performance">Performance</option>
                </select>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Order
                </label>
                <select
                  value={filters.sortOrder}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      sortOrder: e.target.value as any,
                    }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
            </div>
          )}

          {/* Subscriptions List */}
          {isLoadingSubscriptions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">
                Loading subscriptions...
              </span>
            </div>
          ) : filteredSubscriptions.length === 0 ? (
            <div className="text-center py-12">
              {subscriptions.length === 0 ? (
                <div>
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    No Subscriptions Yet
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Start copy trading by subscribing to top-performing KOLs and
                    traders
                  </p>
                  <Link href="/kols">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Browse KOLs
                    </Button>
                  </Link>
                </div>
              ) : (
                <div>
                  <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    No subscriptions match your current filters
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setFilters({
                        status: 'all',
                        type: 'all',
                        sortBy: 'dateAdded',
                        sortOrder: 'desc',
                      });
                    }}
                    className="mt-4"
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
              {filteredSubscriptions.map(subscription => (
                <SubscriptionCard
                  key={subscription.id || subscription.kolWallet}
                  subscription={subscription}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-muted/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/kols" className="block">
              <div className="bg-background border border-border rounded-lg p-4 hover:border-muted-foreground transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Browse KOLs</h4>
                    <p className="text-sm text-muted-foreground">
                      Find new traders to follow
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/kol-trades-demo" className="block">
              <div className="bg-background border border-border rounded-lg p-4 hover:border-muted-foreground transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-500/10 text-red-500 rounded-lg">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Live Trades</h4>
                    <p className="text-sm text-muted-foreground">
                      Real-time KOL trades & network maps
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/portfolio" className="block">
              <div className="bg-background border border-border rounded-lg p-4 hover:border-muted-foreground transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">
                      View Portfolio
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Check your performance
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/settings" className="block">
              <div className="bg-background border border-border rounded-lg p-4 hover:border-muted-foreground transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-500/10 text-orange-500 rounded-lg">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Settings</h4>
                    <p className="text-sm text-muted-foreground">
                      Configure trading preferences
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
      </AppLayout>
    </RequireAuth>
  );
};

export default SubscriptionsPage;
