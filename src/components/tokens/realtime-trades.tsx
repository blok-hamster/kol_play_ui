'use client';

import React, { useEffect, useState } from 'react';
import { usePumpPortalStream, type PumpPortalTrade } from '@/hooks';
import { TrendingDown, TrendingUp, Activity, Users } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

interface RealTimeTradesProps {
    tokenMint: string;
    tokenSymbol?: string;
    className?: string;
    maxTrades?: number;
}

interface TradeDisplay extends PumpPortalTrade {
    id: string;
    relativeTime: string;
}

export const RealTimeTrades: React.FC<RealTimeTradesProps> = ({
    tokenMint,
    tokenSymbol = 'Token',
    className = '',
    maxTrades = 50,
}) => {
    const [trades, setTrades] = useState<TradeDisplay[]>([]);
    const [stats, setStats] = useState({
        totalBuys: 0,
        totalSells: 0,
        buyVolume: 0,
        sellVolume: 0,
    });

    const pumpPortal = usePumpPortalStream({
        autoConnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
    });

    // Subscribe to token trades
    useEffect(() => {
        if (!pumpPortal.isConnected || !tokenMint) {
            return;
        }

        console.log(`📊 Subscribing to trades for ${tokenSymbol} (${tokenMint})`);

        const unsubscribe = pumpPortal.subscribeTokenTrades(tokenMint, (trade) => {
            const tradeDisplay: TradeDisplay = {
                ...trade,
                id: `${trade.signature}-${trade.timestamp}`,
                relativeTime: 'Just now',
            };

            setTrades((prev) => {
                const updated = [tradeDisplay, ...prev];
                return updated.slice(0, maxTrades);
            });

            // Update stats
            setStats((prev) => ({
                totalBuys: prev.totalBuys + (trade.is_buy ? 1 : 0),
                totalSells: prev.totalSells + (trade.is_buy ? 0 : 1),
                buyVolume: prev.buyVolume + (trade.is_buy ? trade.sol_amount : 0),
                sellVolume: prev.sellVolume + (trade.is_buy ? 0 : trade.sol_amount),
            }));
        });

        return () => {
            console.log(`🔕 Unsubscribing from trades for ${tokenSymbol}`);
            unsubscribe();
        };
    }, [pumpPortal.isConnected, tokenMint, tokenSymbol, pumpPortal, maxTrades]);

    // Update relative times
    useEffect(() => {
        const interval = setInterval(() => {
            setTrades((prev) =>
                prev.map((trade) => ({
                    ...trade,
                    relativeTime: getRelativeTime(trade.timestamp),
                }))
            );
        }, 10000); // Update every 10 seconds

        return () => clearInterval(interval);
    }, []);

    const getRelativeTime = (timestamp: number): string => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 5) return 'Just now';
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    return (
        <div className={cn('space-y-4', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Live Trades - {tokenSymbol}</h3>
                </div>
                {pumpPortal.isConnected && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs font-medium text-red-500">LIVE</span>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-green-500 mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-medium">BUYS</span>
                    </div>
                    <div className="text-lg font-bold text-green-500">{stats.totalBuys}</div>
                    <div className="text-xs text-green-400">
                        {formatNumber(stats.buyVolume, 2)} SOL
                    </div>
                </div>

                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-red-500 mb-1">
                        <TrendingDown className="w-4 h-4" />
                        <span className="text-xs font-medium">SELLS</span>
                    </div>
                    <div className="text-lg font-bold text-red-500">{stats.totalSells}</div>
                    <div className="text-xs text-red-400">
                        {formatNumber(stats.sellVolume, 2)} SOL
                    </div>
                </div>
            </div>

            {/* Trade Feed */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
                {!pumpPortal.isConnected ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Connecting to live feed...</p>
                    </div>
                ) : trades.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Waiting for trades...</p>
                    </div>
                ) : (
                    trades.map((trade) => (
                        <div
                            key={trade.id}
                            className={cn(
                                'p-3 rounded-lg border transition-all',
                                trade.is_buy
                                    ? 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10'
                                    : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {trade.is_buy ? (
                                        <TrendingUp className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <TrendingDown className="w-4 h-4 text-red-500" />
                                    )}
                                    <span
                                        className={cn(
                                            'font-semibold text-sm',
                                            trade.is_buy ? 'text-green-500' : 'text-red-500'
                                        )}
                                    >
                                        {trade.is_buy ? 'BUY' : 'SELL'}
                                    </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {trade.relativeTime}
                                </span>
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-muted-foreground">SOL:</span>
                                    <span className="ml-1 font-mono font-medium">
                                        {formatNumber(trade.sol_amount, 4)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tokens:</span>
                                    <span className="ml-1 font-mono font-medium">
                                        {formatNumber(trade.token_amount, 2)}
                                    </span>
                                </div>
                            </div>

                            {trade.user && (
                                <div className="mt-1 text-xs text-muted-foreground font-mono">
                                    {trade.user.slice(0, 4)}...{trade.user.slice(-4)}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default RealTimeTrades;
