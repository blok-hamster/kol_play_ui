'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Eye,
  Copy,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from 'lucide-react';
import {
  TradingService,
  ParsedSwap,
  GetAddressTransactionsRequest,
} from '@/services/trading.service';
import { useNotifications, useLoading } from '@/stores/use-ui-store';
import { formatCurrency, formatNumber, copyToClipboard } from '@/lib/utils';
import SubscriptionControls from './subscription-controls';
import type { KOLWallet, TopTrader } from '@/types';

interface KOLTradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  kol?: KOLWallet | null;
  trader?: TopTrader;
  walletAddress: string;
}

interface TradeStats {
  totalTrades: number;
  totalVolume: number;
  winRate: number;
  totalPnL: number;
  avgTradeSize: number;
  buyTrades: number;
  sellTrades: number;
}

const KOLTradesModal: React.FC<KOLTradesModalProps> = ({
  isOpen,
  onClose,
  kol,
  trader,
  walletAddress,
}) => {
  const [trades, setTrades] = useState<ParsedSwap[]>([]);
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  const [pagination, setPagination] = useState<{
    before?: string;
    after?: string;
    hasMore: boolean;
  }>({ hasMore: false });

  const { showSuccess, showError } = useNotifications();
  const { isLoading, setLoading } = useLoading();

  // Calculate stats from trades
  const stats: TradeStats = useMemo(() => {
    if (!trades.length) {
      return {
        totalTrades: 0,
        totalVolume: 0,
        winRate: 0,
        totalPnL: 0,
        avgTradeSize: 0,
        buyTrades: 0,
        sellTrades: 0,
      };
    }

    const buyTrades = trades.filter(t => t.side === 'buy').length;
    const sellTrades = trades.filter(t => t.side === 'sell').length;
    const totalVolume = trades.reduce((sum, t) => sum + t.solAmount, 0);
    const avgTradeSize = totalVolume / trades.length;

    // Simple PnL calculation (this would be more complex in real scenarios)
    const totalPnL = trades.reduce((sum, t) => {
      return sum + (t.side === 'sell' ? t.solAmount : -t.solAmount);
    }, 0);

    const winRate =
      sellTrades > 0 ? (sellTrades / (buyTrades + sellTrades)) * 100 : 0;

    return {
      totalTrades: trades.length,
      totalVolume,
      winRate,
      totalPnL,
      avgTradeSize,
      buyTrades,
      sellTrades,
    };
  }, [trades]);

  // Fetch trades based on timeframe
  const fetchTrades = async (timeframeParam: string = timeframe) => {
    try {
      setLoading('kolTrades', true);

      const now = new Date();
      const startTime = new Date();

      switch (timeframeParam) {
        case '24h':
          startTime.setHours(now.getHours() - 24);
          break;
        case '7d':
          startTime.setDate(now.getDate() - 7);
          break;
        case '30d':
          startTime.setDate(now.getDate() - 30);
          break;
      }

      const request: GetAddressTransactionsRequest = {
        address: walletAddress,
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
      };

      const response = await TradingService.getAddressTransactions(request);
      setTrades(response.data.transactions || []);
      setPagination(response.data.pagination || { hasMore: false });
    } catch (error: any) {
      showError('Load Error', error.message || 'Failed to load trades');
      console.error('Failed to fetch trades:', error);
    } finally {
      setLoading('kolTrades', false);
    }
  };

  // Load trades when modal opens or timeframe changes
  useEffect(() => {
    if (isOpen && walletAddress) {
      fetchTrades();
    }
  }, [isOpen, walletAddress, timeframe]);

  const handleTimeframeChange = (newTimeframe: '24h' | '7d' | '30d') => {
    setTimeframe(newTimeframe);
  };

  const handleCopyAddress = () => {
    copyToClipboard(walletAddress);
    showSuccess('Copied!', 'Wallet address copied to clipboard');
  };

  const handleViewOnExplorer = () => {
    window.open(`https://solscan.io/account/${walletAddress}`, '_blank');
  };

  const getTradeIcon = (side: 'buy' | 'sell') => {
    return side === 'buy' ? (
      <ArrowUpRight className="w-4 h-4 text-green-500" />
    ) : (
      <ArrowDownRight className="w-4 h-4 text-red-500" />
    );
  };

  const getTradeColor = (side: 'buy' | 'sell') => {
    return side === 'buy'
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
  };

  const title =
    kol?.name ||
    (trader
      ? `Trader #${walletAddress.slice(0, 8)}`
      : `KOL ${walletAddress.slice(0, 8)}`);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={`Trading history and stats for ${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}`}
      size="xl"
    >
      <div className="space-y-6 h-full flex flex-col">
        {/* Header Info */}
        <div className="pb-4 border-b border-border space-y-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {kol?.avatar ? (
                <img
                  src={kol.avatar}
                  alt={kol.name || 'KOL Avatar'}
                  className="w-12 h-12 rounded-full border-2 border-muted"
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center border-2 border-muted">
                  <span className="text-primary-foreground font-bold text-sm">
                    {title.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h3 className="font-bold text-foreground text-lg">{title}</h3>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span className="font-mono">
                    {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
                  </span>
                  <button
                    onClick={handleCopyAddress}
                    className="hover:text-foreground transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleViewOnExplorer}
                    className="hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Subscribe Button - show for both KOLs and traders */}
            {walletAddress && (
              <SubscriptionControls
                kolWallet={walletAddress}
                kolName={
                  kol?.name ||
                  (trader
                    ? `Trader ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                    : `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`)
                }
                size="sm"
                variant="button"
                showSettings={true}
                className="px-4 py-2 rounded-lg font-medium"
              />
            )}
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">
              Trading Activity
            </h4>
            <div className="flex items-center space-x-1 bg-muted rounded-lg p-1">
              {(['24h', '7d', '30d'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => handleTimeframeChange(tf)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    timeframe === tf
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto space-y-6 min-h-0">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">
                  Total Trades
                </span>
              </div>
              <span className="text-xl font-bold text-foreground">
                {stats.totalTrades}
              </span>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">
                  Total Volume
                </span>
              </div>
              <div>
                <span className="text-xl font-bold text-foreground">
                  {formatNumber(stats.totalVolume, 3)}
                </span>
                <span className="text-sm text-muted-foreground ml-1">SOL</span>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Win Rate</span>
              </div>
              <span className="text-xl font-bold text-foreground">
                {formatNumber(stats.winRate, 1)}%
              </span>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingDown className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Avg Trade</span>
              </div>
              <div>
                <span className="text-xl font-bold text-foreground">
                  {formatNumber(stats.avgTradeSize, 3)}
                </span>
                <span className="text-sm text-muted-foreground ml-1">SOL</span>
              </div>
            </div>
          </div>

          {/* Additional Stats Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">Net PnL</span>
              </div>
              <div>
                <span
                  className={`text-xl font-bold ${stats.totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {stats.totalPnL >= 0 ? '+' : ''}
                  {formatNumber(stats.totalPnL, 3)}
                </span>
                <span className="text-sm text-muted-foreground ml-1">SOL</span>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">
                  Trade Split
                </span>
              </div>
              <div className="text-sm">
                <div className="flex justify-between">
                  <span className="text-green-600 dark:text-green-400">
                    {stats.buyTrades} Buys
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    {stats.sellTrades} Sells
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Trades List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-foreground">
                Recent Trades
              </h4>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <ArrowUpRight className="w-3 h-3 text-green-500" />
                  <span>{stats.buyTrades} Buys</span>
                </div>
                <div className="flex items-center space-x-1">
                  <ArrowDownRight className="w-3 h-3 text-red-500" />
                  <span>{stats.sellTrades} Sells</span>
                </div>
              </div>
            </div>

            {isLoading('kolTrades') ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-muted/20 rounded-lg p-4 animate-pulse"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-muted rounded-full" />
                        <div className="space-y-1">
                          <div className="w-20 h-4 bg-muted rounded" />
                          <div className="w-32 h-3 bg-muted rounded" />
                        </div>
                      </div>
                      <div className="w-24 h-4 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : trades.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No trades found for the selected timeframe</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {trades.map((trade, index) => (
                  <div
                    key={`${trade.tokenMint}-${index}`}
                    className="bg-muted/20 rounded-lg p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                          {getTradeIcon(trade.side)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-foreground">
                              {trade.name || 'Unknown Token'}
                            </span>
                            <span
                              className={`text-sm font-medium ${getTradeColor(trade.side)}`}
                            >
                              {trade.side.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatNumber(trade.tokenAmount)} tokens •{' '}
                            {new Date(
                              trade.transactionTimestamp
                            ).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-foreground">
                          {formatNumber(trade.solAmount, 4)} SOL
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(
                            trade.transactionTimestamp
                          ).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Load More Button */}
          {pagination.hasMore && (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => {
                  // TODO: Implement pagination
                  console.log('Load more trades');
                }}
                disabled={isLoading('kolTrades')}
              >
                Load More Trades
              </Button>
            </div>
          )}
        </div>{' '}
        {/* End scrollable content area */}
      </div>
    </Modal>
  );
};

export default KOLTradesModal;
