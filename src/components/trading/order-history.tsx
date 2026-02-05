'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/shadcn-tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn, formatCurrency, formatPercentage } from '@/lib/utils';
import { Activity, Filter, Settings, Loader2, Clock, Trash2 } from 'lucide-react';
import PortfolioService from '@/services/portfolio.service';
import AuthService from '@/services/auth.service';
import { Transaction, TradeHistoryEntry } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { useTradingStore } from '@/stores/use-trading-store';
import { useEnhancedWebSocket } from '@/hooks/use-enhanced-websocket';

interface OrderHistoryProps {
    className?: string;
    mint?: string;
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ className, mint }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [openTrades, setOpenTrades] = useState<TradeHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('trades');
    const { isPaperTrading } = useTradingStore();

    const token = AuthService.getToken();
    const { connect, disconnect } = useEnhancedWebSocket({
        auth: {
            token: token || undefined
        }
    });

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'trades') {
                let res;
                if (mint) {
                    res = await PortfolioService.getUserTransactionsByMint({ mint, limit: 20 });
                } else {
                    res = await PortfolioService.getUserTransactions({ limit: 20 });
                }
                if (res.data) setTransactions(res.data);
            } else {
                // Fetch open trades (positions or orders) filtered by mint
                const res = await PortfolioService.getOpenTrades(isPaperTrading, mint);
                if (res.data) setOpenTrades(res.data);
            }
        } catch (e) {
            console.error("Failed to fetch history", e);
        } finally {
            setIsLoading(false);
        }
    };

    // WebSocket connection
    useEffect(() => {
        connect().catch(err => console.warn('WebSocket connection failed in OrderHistory:', err));
        return () => disconnect();
    }, [connect, disconnect]);

    // Real-time Event Handling
    useEffect(() => {
        const handleUserEvent = (e: Event) => {
            const customEvent = e as CustomEvent;
            const event = customEvent.detail;
            if (!event || !event.type) return;

            if (event.type === 'POSITION_UPDATE') {
                const { tradeId, pnl, pnlPercent, currentPrice } = event.data;
                setOpenTrades(prev => prev.map(t => {
                    if (t.id === tradeId || t.originalTradeId === tradeId) {
                        return {
                            ...t,
                            currentPrice,
                            unrealizedPnL: pnl,
                            unrealizedPnLPercentage: pnlPercent,
                        };
                    }
                    return t;
                }));
            } else if (event.type === 'TRADE_OPENED' || event.type === 'ORDER_PLACED') {
                const { trade } = event.data;
                // Only add if it matches current mint filtering
                if (mint && trade.tokenMint !== mint) return;

                setOpenTrades(prev => {
                    if (prev.some(t => t.id === trade.id)) return prev;
                    return [{ ...trade, openedAt: new Date(trade.openedAt) }, ...prev];
                });
            } else if (event.type === 'POSITION_CLOSED' || event.type === 'ORDER_CANCELLED') {
                const { tradeId } = event.data;
                setOpenTrades(prev => prev.filter(t => t.id !== tradeId && t.originalTradeId !== tradeId));
                // Refresh transactions if we are on trades tab
                if (activeTab === 'trades') fetchHistory();
            }
        };

        window.addEventListener('kolplay_user_event', handleUserEvent);
        return () => window.removeEventListener('kolplay_user_event', handleUserEvent);
    }, [mint, activeTab]);

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 30000); // Slower polling since we have websockets
        return () => clearInterval(interval);
    }, [mint, activeTab, isPaperTrading]);

    const positions = useMemo(() => openTrades.filter(t => t.tradeType !== 'buy'), [openTrades]);
    const orders = useMemo(() => openTrades.filter(t => t.tradeType === 'buy'), [openTrades]);

    return (
        <div className={cn("bg-card/30 border border-border rounded-2xl overflow-hidden flex flex-col", className)}>
            <Tabs defaultValue="trades" value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col h-full">
                <div className="flex items-center justify-between px-4 pt-4 border-b border-border/50 pb-0 bg-muted/10">
                    <TabsList className="bg-transparent border-none p-0 h-auto space-x-6 justify-start">
                        {[
                            { label: 'Trades', value: 'trades', count: transactions.length },
                            { label: 'Positions', value: 'positions', count: positions.length },
                            { label: 'Orders', value: 'orders', count: orders.length }
                        ].map((tab) => (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className="bg-transparent border-none rounded-none px-0 py-2 text-[11px] font-bold uppercase tracking-wider data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all shadow-none"
                            >
                                {tab.label} {tab.count > 0 && <span className="ml-1 opacity-50">({tab.count})</span>}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <div className="flex items-center space-x-2 pb-2">
                        <div className="flex items-center space-x-2 bg-green-500/10 px-2 py-1 rounded-full">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-green-500 uppercase tracking-tighter">Live Feed</span>
                        </div>
                        <Settings className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
                    </div>
                </div>

                <div className="bg-muted/5 px-4 py-2 border-b border-border/30 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-green-500 uppercase flex items-center gap-1.5">
                            <Activity className="w-3 h-3" />
                            Feed is live
                        </span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <Filter className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <TabsContent value="trades" className="mt-0 outline-none">
                        {renderTrades(transactions, isLoading)}
                    </TabsContent>

                    <TabsContent value="positions" className="mt-0 outline-none">
                        {renderPositions(positions, isLoading)}
                    </TabsContent>

                    <TabsContent value="orders" className="mt-0 outline-none">
                        {renderOrders(orders, isLoading)}
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
};

const renderTrades = (transactions: Transaction[], isLoading: boolean) => {
    if (isLoading && transactions.length === 0) return <LoadingSpinner />;

    return (
        <Table>
            <TableHeader className="bg-muted/10 border-b border-border/30 sticky top-0 bg-background/95 backdrop-blur z-10">
                <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Age</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Action</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter text-right">Price</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter text-right">Amount Out</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter text-right">Amount In</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter text-right">Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {transactions.length > 0 ? transactions.map((tx) => (
                    <TableRow key={tx.id || Math.random()} className="border-border/30 hover:bg-muted/10">
                        <TableCell className="py-2 text-[11px] font-medium text-muted-foreground">
                            {tx.timestamp ? formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true }) : 'Just now'}
                        </TableCell>
                        <TableCell className="py-2">
                            <span className={cn(
                                "text-[11px] font-black uppercase tracking-widest",
                                tx.action === 'buy' ? "text-green-500" : tx.action === 'sell' ? "text-red-500" : "text-muted-foreground"
                            )}>
                                {tx.action}
                            </span>
                        </TableCell>
                        <TableCell className="py-2 text-[11px] font-bold text-right text-foreground">
                            ${Number(tx.executionPrice || 0).toFixed(6)}
                        </TableCell>
                        <TableCell className="py-2 text-[11px] font-bold text-right text-foreground">
                            {Number(tx.amountOut || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 text-[11px] font-bold text-right text-foreground">
                            {Number(tx.amountIn || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                            <span className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] font-black uppercase",
                                tx.status === 'confirmed' || tx.status === 'success' ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
                            )}>
                                {tx.status}
                            </span>
                        </TableCell>
                    </TableRow>
                )) : (
                    <EmptyState message="No transactions found" />
                )}
            </TableBody>
        </Table>
    );
};

const renderPositions = (positions: TradeHistoryEntry[], isLoading: boolean) => {
    if (isLoading && positions.length === 0) return <LoadingSpinner />;

    return (
        <Table>
            <TableHeader className="bg-muted/10 border-b border-border/30 sticky top-0 bg-background/95 backdrop-blur z-10">
                <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Hold Time</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Size</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter text-right">Entry</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter text-right">Current</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter text-right">P&L</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter text-right">Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {positions.length > 0 ? positions.map((trade) => {
                    const pnl = trade.unrealizedPnL || 0;
                    const pnlPercent = trade.unrealizedPnLPercentage || 0;
                    const isPositive = pnl >= 0;

                    return (
                        <TableRow key={trade.id} className="border-border/30 hover:bg-muted/10">
                            <TableCell className="py-2 text-[11px] font-medium text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDistanceToNow(new Date(trade.openedAt))}
                                </span>
                            </TableCell>
                            <TableCell className="py-2 text-[11px] font-bold">
                                {Number(trade.entryAmount).toFixed(2)} tokens
                            </TableCell>
                            <TableCell className="py-2 text-[11px] font-bold text-right">
                                ${Number(trade.entryPrice).toFixed(6)}
                            </TableCell>
                            <TableCell className="py-2 text-[11px] font-bold text-right">
                                ${Number(trade.currentPrice || trade.entryPrice).toFixed(6)}
                            </TableCell>
                            <TableCell className="py-2 text-right">
                                <div className={cn(
                                    "text-[11px] font-black",
                                    isPositive ? "text-green-500" : "text-red-500"
                                )}>
                                    {isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
                                </div>
                            </TableCell>
                            <TableCell className="py-2 text-right">
                                <button className="text-[9px] font-black uppercase px-2 py-1 bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-colors">
                                    Sell
                                </button>
                            </TableCell>
                        </TableRow>
                    );
                }) : (
                    <EmptyState message="No active positions" />
                )}
            </TableBody>
        </Table>
    );
};

const renderOrders = (orders: TradeHistoryEntry[], isLoading: boolean) => {
    if (isLoading && orders.length === 0) return <LoadingSpinner />;

    return (
        <Table>
            <TableHeader className="bg-muted/10 border-b border-border/30 sticky top-0 bg-background/95 backdrop-blur z-10">
                <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Placed</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Type</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter text-right">Limit Price</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter text-right">Amount</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter text-right">Current</TableHead>
                    <TableHead className="h-9 text-[10px] font-black uppercase text-muted-foreground tracking-tighter text-right">Manage</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {orders.length > 0 ? orders.map((order) => (
                    <TableRow key={order.id} className="border-border/30 hover:bg-muted/10">
                        <TableCell className="py-2 text-[11px] font-medium text-muted-foreground">
                            {formatDistanceToNow(new Date(order.openedAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="py-2">
                            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded">
                                Limit Buy
                            </span>
                        </TableCell>
                        <TableCell className="py-2 text-[11px] font-bold text-right text-foreground">
                            ${Number(order.limitPrice || 0).toFixed(6)}
                        </TableCell>
                        <TableCell className="py-2 text-[11px] font-bold text-right">
                            {formatCurrency(order.entryValue)}
                        </TableCell>
                        <TableCell className="py-2 text-[11px] font-bold text-right text-muted-foreground">
                            ${Number(order.currentPrice || 0).toFixed(6)}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                            <button className="text-muted-foreground hover:text-red-500 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </TableCell>
                    </TableRow>
                )) : (
                    <EmptyState message="No pending orders" />
                )}
            </TableBody>
        </Table>
    );
};

const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/50" />
    </div>
);

const EmptyState = ({ message }: { message: string }) => (
    <TableRow>
        <TableCell colSpan={6} className="h-32 text-center">
            <div className="flex flex-col items-center justify-center opacity-40">
                <Activity className="w-8 h-8 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">{message}</p>
            </div>
        </TableCell>
    </TableRow>
);
