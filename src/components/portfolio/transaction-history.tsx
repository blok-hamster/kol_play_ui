'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  History,
  Filter,
  Download,
  Search,
  Calendar,
  ArrowUpDown,
  Eye,
  ExternalLink,
  RefreshCw,
  Loader,
} from 'lucide-react';
import {
  PortfolioService,
  GetTransactionsRequest,
} from '@/services/portfolio.service';
import { useNotifications } from '@/stores/use-ui-store';
import {
  formatCurrency,
  formatNumber,
  formatRelativeTime,
  copyToClipboard,
} from '@/lib/utils';
import type { Transaction, TransactionDetails } from '@/types';

interface TransactionHistoryProps {
  limit?: number;
  showFilters?: boolean;
  showPagination?: boolean;
}

interface FilterState {
  search: string;
  dateRange: 'all' | '7d' | '30d' | '90d';
  action: 'all' | 'buy' | 'sell';
  token: string;
  sortBy: 'date' | 'amount' | 'token';
  sortOrder: 'asc' | 'desc';
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  limit,
  showFilters = true,
  showPagination = true,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    dateRange: 'all',
    action: 'all',
    token: '',
    sortBy: 'date',
    sortOrder: 'desc',
  });

  const { showNotification } = useNotifications();

  const fetchTransactions = async (page: number = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      // Build request parameters
      const request: GetTransactionsRequest = {
        page,
        limit: limit || 20,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      };

      // Add filters
      if (filters.action !== 'all') {
        request.action = filters.action as 'buy' | 'sell';
      }

      if (filters.token) {
        request.mint = filters.token;
      }

      // Add date range
      if (filters.dateRange !== 'all') {
        const now = new Date();
        const days =
          {
            '7d': 7,
            '30d': 30,
            '90d': 90,
          }[filters.dateRange] || 0;

        request.startDate = new Date(
          now.getTime() - days * 24 * 60 * 60 * 1000
        ).toISOString();
        request.endDate = now.toISOString();
      }

      const response = await PortfolioService.getUserTransactions(request);
      
      // Sort transactions by timestamp/createdAt in descending order (newest first)
      const sortedTransactions = response.data.sort((a, b) => {
        const dateA = a.timestamp || new Date(a.createdAt || 0).getTime();
        const dateB = b.timestamp || new Date(b.createdAt || 0).getTime();
        return dateB - dateA; // Descending order (newest first)
      });
      
      setTransactions(sortedTransactions);

      // Calculate total pages (assuming response includes pagination info)
      const itemsPerPage = limit || 20;
      setTotalPages(Math.ceil((response.data.length || 0) / itemsPerPage));
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err);
      setError(err.message || 'Failed to load transactions');
      showNotification('Error', 'Failed to load transaction history', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactionDetails = async (transactionId: string) => {
    try {
      setIsLoadingDetails(true);
      const response =
        await PortfolioService.getUserTransactionDetails(transactionId);
      setSelectedTransaction(response.data);
    } catch (err: any) {
      console.error('Failed to fetch transaction details:', err);
      showNotification('Error', 'Failed to load transaction details', 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchTransactions(currentPage);
  }, [filters, currentPage]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSort = (sortBy: 'date' | 'amount' | 'token') => {
    const newOrder =
      filters.sortBy === sortBy && filters.sortOrder === 'desc'
        ? 'asc'
        : 'desc';
    setFilters(prev => ({ ...prev, sortBy, sortOrder: newOrder }));
  };

  const handleExport = async () => {
    try {
      const response = await PortfolioService.exportTransactionHistory({
        format: 'csv',
        dateRange: filters.dateRange,
        action: filters.action,
      });
      showNotification(
        'Export Started',
        'Your transaction history is being prepared for download'
      );
    } catch (err: any) {
      showNotification(
        'Export Failed',
        err.message || 'Failed to export transactions',
        'error'
      );
    }
  };

  const handleCopyTransactionId = async (txId: string) => {
    try {
      await copyToClipboard(txId);
      showNotification('Copied', 'Transaction ID copied to clipboard');
    } catch (err) {
      showNotification(
        'Failed to copy',
        'Could not copy to clipboard',
        'error'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-center space-x-3">
          <History className="h-6 w-6 text-primary" />
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            Transaction History
          </h2>
        </div>
        <div className="flex justify-end space-x-2 sm:space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchTransactions(currentPage)}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex-shrink-0"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          {showFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex-shrink-0"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex-shrink-0"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && showFiltersPanel && (
        <div className="bg-background border border-border rounded-xl p-4 sm:p-6 space-y-4 shadow-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Search
              </label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Token, amount, or TX ID..."
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  value={filters.search}
                  onChange={e => handleFilterChange('search', e.target.value)}
                />
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Date Range
              </label>
              <select
                className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                value={filters.dateRange}
                onChange={e => handleFilterChange('dateRange', e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>

            {/* Action */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Action
              </label>
              <select
                className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                value={filters.action}
                onChange={e => handleFilterChange('action', e.target.value)}
              >
                <option value="all">All Actions</option>
                <option value="buy">Buy Only</option>
                <option value="sell">Sell Only</option>
              </select>
            </div>

            {/* Token */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Token
              </label>
              <input
                type="text"
                placeholder="Token symbol or mint..."
                className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                value={filters.token}
                onChange={e => handleFilterChange('token', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Transactions List */}
      <div className="bg-background border border-border rounded-xl p-4 sm:p-6 shadow-lg">
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse bg-muted/30 border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-full"></div>
                      <div>
                        <div className="h-4 bg-muted rounded w-24 mb-1"></div>
                        <div className="h-3 bg-muted rounded w-32"></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="h-4 bg-muted rounded w-20 mb-1"></div>
                      <div className="h-3 bg-muted rounded w-16"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : transactions.length > 0 ? (
            <div className="space-y-4">
              {transactions.map(transaction => (
                <div
                  key={transaction.id}
                  className="bg-muted/30 border border-border rounded-xl p-3 sm:p-4 hover:border-muted-foreground transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-start sm:items-center justify-between mb-3">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {/* Token Icon */}
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0 border-2 border-muted">
                        <span className="text-primary-foreground font-bold text-sm">
                          {transaction.mint?.slice(0, 1) || '?'}
                        </span>
                      </div>

                      {/* Transaction Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-1">
                          <h3 className="font-bold text-foreground text-base sm:text-lg">
                            {transaction.action === 'buy' ? 'Buy' : 'Sell'} Token
                          </h3>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 sm:mt-0 w-fit ${
                              transaction.action === 'buy'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                            }`}
                          >
                            {transaction.action === 'buy' ? 'Buy' : 'Sell'}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 text-sm text-muted-foreground space-y-1 sm:space-y-0">
                          <span>
                            {transaction.timestamp
                              ? formatRelativeTime(
                                  new Date(transaction.timestamp)
                                )
                              : transaction.createdAt
                              ? formatRelativeTime(
                                  new Date(transaction.createdAt)
                                )
                              : 'Recently'}
                          </span>
                          <span className="hidden sm:inline">
                            {transaction.timestamp
                              ? new Date(transaction.timestamp).toLocaleDateString()
                              : transaction.createdAt
                              ? new Date(transaction.createdAt).toLocaleDateString()
                              : 'Unknown date'}
                          </span>
                          <span className="font-mono text-xs">
                            {transaction.transactionHash
                              ? `${transaction.transactionHash.slice(0, 8)}...`
                              : 'No TX'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right section - Amounts */}
                    <div className="text-right ml-2">
                      <div className="text-base sm:text-lg font-bold text-foreground">
                        {formatNumber(transaction.amountOut || 0, 2)} Token
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatNumber(transaction.amountIn || 0, 4)} SOL
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm space-y-2 sm:space-y-0">
                    {/* Left stats */}
                    <div className="flex flex-wrap items-center gap-2 sm:space-x-4 sm:gap-0">
                      <div className="flex items-center space-x-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            transaction.action === 'buy'
                              ? 'bg-green-500'
                              : 'bg-red-500'
                          }`}
                        ></span>
                        <span className="text-muted-foreground">
                          {transaction.action === 'buy'
                            ? 'Buy Order'
                            : 'Sell Order'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 px-2 py-1 bg-muted rounded text-xs">
                        <span className="text-blue-400">💰</span>
                        <span className="text-muted-foreground">
                          {formatCurrency((transaction.amountIn || 0) * 200)}
                        </span>
                      </div>
                      {transaction.fees && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-muted rounded text-xs">
                          <span className="text-orange-400">⚡</span>
                          <span className="text-muted-foreground">
                            {formatNumber(transaction.fees, 6)} SOL
                          </span>
                        </div>
                      )}
                      {transaction.executionPrice && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-muted rounded text-xs">
                          <span className="text-purple-400">📊</span>
                          <span className="text-muted-foreground">
                            {formatNumber(transaction.executionPrice, 8)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right stats - Actions */}
                    <div className="flex items-center justify-between sm:justify-end space-x-2">
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            if (transaction.id) {
                              fetchTransactionDetails(transaction.id);
                            }
                          }}
                          disabled={isLoadingDetails}
                          className="p-1 h-auto hover:bg-muted rounded-lg"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {transaction.transactionHash && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={e => {
                              e.stopPropagation();
                              window.open(`https://solscan.io/tx/${transaction.transactionHash}`, '_blank');
                            }}
                            className="p-1 h-auto hover:bg-muted rounded-lg"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.status === 'success' ? (
                          <span className="text-green-600">✓ Success</span>
                        ) : (
                          <span className="text-red-600">✗ Failed</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">
                No transactions found
              </p>
              <p className="text-sm text-muted-foreground">
                {filters.search ||
                filters.action !== 'all' ||
                filters.dateRange !== 'all' ||
                filters.token
                  ? 'Try adjusting your filters'
                  : 'Start trading to see your transaction history'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center justify-center sm:justify-end space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages || isLoading}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-xl p-4 sm:p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg sm:text-xl font-semibold text-foreground">
                Transaction Details
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTransaction(null)}
                className="hover:bg-muted rounded-lg"
              >
                ×
              </Button>
            </div>

            <div className="space-y-6">
              <div className="bg-muted/30 border border-border rounded-xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Transaction ID
                    </label>
                    <p className="text-sm font-mono text-foreground mt-1 break-all">
                      {selectedTransaction.signature}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Status
                    </label>
                    <p className="text-sm text-foreground mt-1">
                      {selectedTransaction.status || 'Completed'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Add more transaction details here */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
