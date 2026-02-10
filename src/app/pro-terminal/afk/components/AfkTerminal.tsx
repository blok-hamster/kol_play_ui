'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Terminal as TerminalIcon,
    Activity,
    History as HistoryIcon,
    RefreshCw,
    Zap
} from 'lucide-react';
import { SolanaService } from '@/services/solana.service';
import { PortfolioService } from '@/services/portfolio.service';
import { useTradingStore } from '@/stores/use-trading-store';
import { useTokenLazyLoading } from '@/hooks/use-token-lazy-loading';
import { useEnhancedWebSocket } from '@/hooks/use-enhanced-websocket';
import AuthService from '@/services/auth.service';
import { cn, safeFormatAmount, formatCurrency, formatPercentage } from '@/lib/utils';
import type { TradeHistoryEntry } from '@/types';

export function AfkTerminal() {
    const { tradingSettings } = useTradingStore();
    const isPaperTrading = tradingSettings?.paperTrading ?? false;

    const [openTrades, setOpenTrades] = useState<TradeHistoryEntry[]>([]);
    const [closedTrades, setClosedTrades] = useState<TradeHistoryEntry[]>([]);
    const [solPrice, setSolPrice] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [terminalLogs, setTerminalLogs] = useState<{ msg: string, type: 'info' | 'success' | 'warning' | 'error' | 'exec' }[]>([]);
    const [, setActiveTab] = useState('open');

    const terminalEndRef = useRef<HTMLDivElement>(null);
    const token = AuthService.getToken();

    const { connect, disconnect } = useEnhancedWebSocket({
        auth: token ? { token } : {}
    });

    const { loadTokens, getToken } = useTokenLazyLoading({
        batchSize: 10,
        cacheEnabled: true
    });

    const addLog = (msg: string, type: 'info' | 'success' | 'warning' | 'error' | 'exec' = 'info') => {
        const timestamp = new Date().toLocaleTimeString([], { hour12: false });
        setTerminalLogs(prev => [...prev.slice(-49), { msg: `[${timestamp}] ${msg}`, type }]);
    };

    const fetchTrades = async () => {
        try {
            setIsLoading(true);
            addLog(`Initializing AFK Terminal (Paper Mode: ${isPaperTrading})...`, 'info');

            // Parallel fetch for open and closed trades
            const [openRes, closedRes] = await Promise.all([
                PortfolioService.getOpenTrades(isPaperTrading),
                PortfolioService.getUserTrades('closed', isPaperTrading)
            ]);

            // Filter for AFK trades specifically
            const afkOpen = (openRes.data || []).filter(t => t.tags?.includes('afk'));
            const afkClosed = (closedRes.data || []).filter(t => t.tags?.includes('afk'));

            setOpenTrades(afkOpen);
            setClosedTrades(afkClosed);

            const allMints = [...afkOpen, ...afkClosed].map(t => t.tokenMint);
            if (allMints.length > 0) loadTokens(allMints);

            addLog(`Loaded ${afkOpen.length} active positions and ${afkClosed.length} historical executions.`, 'success');
        } catch (error) {
            addLog(`Failed to synchronize trade data: ${error}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTrades();
        const fetchSolPrice = async () => {
            try {
                const price = await SolanaService.getSolPrice();
                setSolPrice(price);
            } catch (e) {
                console.error('Failed to fetch SOL price:', e);
            }
        };
        fetchSolPrice();

        connect().catch(() => addLog('WebSocket uplink failed. Retrying...', 'warning'));

        return () => disconnect();
    }, [isPaperTrading]);

    useEffect(() => {
        const handleUserEvent = (e: Event) => {
            const event = (e as CustomEvent).detail;
            if (!event || !event.type) return;

            // Only process events related to AFK trades (some events might not have tags directly, 
            // but we can correlate via existing lists or specific event data)

            if (event.type === 'TRADE_OPENED') {
                const { trade } = event.data;
                if (trade.tags?.includes('afk')) {
                    setOpenTrades(prev => [trade, ...prev]);
                    addLog(`EXECUTION: Buy Order Confirmed [${trade.tokenMint.slice(0, 8)}...]`, 'exec');
                    loadTokens([trade.tokenMint]);
                }
            } else if (event.type === 'POSITION_UPDATE') {
                const { tradeId, pnl, pnlPercent, currentPrice } = event.data;
                setOpenTrades(prev => prev.map(t => {
                    if (t.id === tradeId || t.originalTradeId === tradeId) {
                        return {
                            ...t,
                            currentPrice,
                            unrealizedPnL: pnl,
                            unrealizedPnLPercentage: pnlPercent
                        };
                    }
                    return t;
                }));
            } else if (event.type === 'POSITION_CLOSED') {
                const { tradeId, trade } = event.data;
                setOpenTrades(prev => prev.filter(t => t.id !== tradeId && t.originalTradeId !== tradeId));
                if (trade && trade.tags?.includes('afk')) {
                    setClosedTrades(prev => [trade, ...prev]);
                    addLog(`SETTLEMENT: Position Closed [${trade.tokenMint.slice(0, 8)}...] | PnL: ${trade.realizedPnLPercentage}%`, 'success');
                } else {
                    // Refresh if tag info is missing in event
                    fetchTrades();
                }
            }
        };

        window.addEventListener('kolplay_user_event', handleUserEvent);
        return () => window.removeEventListener('kolplay_user_event', handleUserEvent);
    }, [isPaperTrading]);

    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [terminalLogs]);

    return (
        <Card className="flex flex-col h-[500px] bg-zinc-950 border-zinc-800 shadow-2xl rounded-xl overflow-hidden font-mono relative">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                <div className="flex items-center gap-4">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/40" />
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/40" />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 tracking-widest uppercase">
                        <TerminalIcon className="w-3 h-3" />
                        <span>afk-execution-engine.sh</span>
                        <span className="text-zinc-700">|</span>
                        <span className={isPaperTrading ? "text-purple-500" : "text-primary italic"}>
                            {isPaperTrading ? "SIMULATION" : "KINETIC_MODE"}
                        </span>
                    </div>
                </div>
                <button
                    onClick={fetchTrades}
                    className="p-1 hover:bg-white/5 rounded transition-colors"
                >
                    <RefreshCw className={cn("w-3 h-3 text-zinc-500", isLoading && "animate-spin")} />
                </button>
            </div>

            <div className="flex flex-1 min-h-0">
                {/* Side Logs */}
                <div className="w-1/3 border-r border-zinc-900 bg-black/40 p-3 hidden lg:flex flex-col">
                    <div className="text-[10px] font-black text-zinc-600 uppercase mb-3 flex items-center gap-2">
                        <Zap className="w-3 h-3" />
                        Kernel Logs
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-none">
                        {terminalLogs.map((log, i) => (
                            <div key={i} className={cn(
                                "text-[10px] leading-relaxed break-all",
                                log.type === 'info' && "text-zinc-500",
                                log.type === 'success' && "text-green-500",
                                log.type === 'warning' && "text-yellow-500",
                                log.type === 'error' && "text-red-500 font-bold",
                                log.type === 'exec' && "text-cyan-400 italic"
                            )}>
                                <span className="opacity-50 tracking-tighter mr-1">$</span>
                                {log.msg}
                            </div>
                        ))}
                        <div ref={terminalEndRef} />
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0">
                    <Tabs defaultValue="open" className="flex-1 flex flex-col" onValueChange={setActiveTab}>
                        <div className="px-4 py-2 border-b border-zinc-900 flex justify-between items-center bg-black/20">
                            <TabsList className="bg-transparent h-auto p-0 gap-4">
                                <TabsTrigger
                                    value="open"
                                    className="p-0 h-auto bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-cyan-400 text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:text-zinc-300 transition-colors border-none shadow-none"
                                >
                                    [ ACTIVE_POSITIONS ]
                                </TabsTrigger>
                                <TabsTrigger
                                    value="closed"
                                    className="p-0 h-auto bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-cyan-400 text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:text-zinc-300 transition-colors border-none shadow-none"
                                >
                                    [ EXECUTION_HISTORY ]
                                </TabsTrigger>
                            </TabsList>
                            <div className="flex items-center gap-4 text-[9px] font-bold text-zinc-600">
                                <span>SYNC: {isLoading ? 'SYNCING...' : 'LIVE'}</span>
                                <div className={cn("w-1.5 h-1.5 rounded-full", isLoading ? "bg-zinc-700" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]")} />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                            <TabsContent value="open" className="m-0 focus-visible:outline-none">
                                {openTrades.length === 0 ? (
                                    <div className="h-40 flex flex-col items-center justify-center text-zinc-700 opacity-50 space-y-2">
                                        <Activity className="w-8 h-8" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Idle - Monitoring Signals</span>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {openTrades.map(trade => (
                                            <TradeEntry key={trade.id} trade={trade} getToken={getToken} isHistory={false} solPrice={solPrice} />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="closed" className="m-0 focus-visible:outline-none">
                                {closedTrades.length === 0 ? (
                                    <div className="h-40 flex flex-col items-center justify-center text-zinc-700 opacity-50 space-y-2">
                                        <HistoryIcon className="w-8 h-8" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">No Archived Data</span>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {closedTrades.map(trade => (
                                            <TradeEntry key={trade.id} trade={trade} getToken={getToken} isHistory={true} solPrice={solPrice} />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </div>
        </Card>
    );
}

function TradeEntry({ trade, getToken, isHistory, solPrice }: { trade: TradeHistoryEntry, getToken: (mint: string) => any, isHistory: boolean, solPrice: number }) {
    const info = getToken(trade.tokenMint);
    const symbol = info?.token?.symbol || `${trade.tokenMint.slice(0, 4)}...${trade.tokenMint.slice(-4)}`;

    const pnlPercent = isHistory ? trade.realizedPnLPercentage : trade.unrealizedPnLPercentage;
    const solPnL = isHistory ? trade.realizedPnL : trade.unrealizedPnL;
    const isPositive = (pnlPercent ?? 0) >= 0;

    return (
        <div className="group border border-zinc-800/50 bg-black/20 hover:bg-black/40 hover:border-cyan-900/40 rounded-lg p-3 transition-all duration-300">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0">
                        {info?.token?.image ? (
                            <img src={info.token.image} alt={symbol} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-700">
                                {symbol[0]}
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-black text-zinc-200 group-hover:text-cyan-400 transition-colors uppercase">{symbol}</span>
                            <span className="text-[9px] font-bold text-zinc-600 tracking-tighter">@{trade.tokenMint.slice(0, 6)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-bold">
                            <span className="text-zinc-500 uppercase">Entry:</span>
                            <span className="text-zinc-300 font-mono italic">${trade.entryPrice.toFixed(8)}</span>
                            <span className="text-zinc-700 mx-0.5">»</span>
                            <span className="text-zinc-300 font-mono">${(trade.currentPrice || trade.exitPrice || 0).toFixed(8)}</span>
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    <div className={cn(
                        "text-xs font-black font-mono leading-none",
                        isPositive ? "text-green-500" : "text-red-500"
                    )}>
                        {isPositive ? '+' : ''}{pnlPercent?.toFixed(2)}%
                    </div>
                    <div className={cn(
                        "text-[10px] font-bold font-mono mt-1",
                        isPositive ? "text-green-500/80" : "text-red-500/80"
                    )}>
                        {solPnL ? formatCurrency(solPnL * solPrice) : '--'}
                    </div>
                    <div className="text-[9px] font-bold text-zinc-600 uppercase mt-1 tracking-tighter">
                        {isHistory ? `EXIT: ${trade.sellReason || 'UNKNOWN'}` : `${safeFormatAmount(trade.entryValue, 4)} SOL`}
                    </div>
                </div>
            </div>

            <div className="mt-3 pt-2 border-t border-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <Activity className="w-2.5 h-2.5 text-zinc-700" />
                        <span className="text-[8px] font-bold text-zinc-600 uppercase">MCap:</span>
                        <span className="text-[8px] font-bold text-zinc-400 font-mono">${info?.token?.marketCapUsd ? (info.token.marketCapUsd / 1e6).toFixed(1) + 'M' : '---'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <HistoryIcon className="w-2.5 h-2.5 text-zinc-700" />
                        <span className="text-[8px] font-bold text-zinc-600 uppercase">Duration:</span>
                        <span className="text-[8px] font-bold text-zinc-400 font-mono">
                            {calculateDuration(trade.openedAt, trade.closedAt || trade.updatedAt)}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 px-2 bg-zinc-900 border border-zinc-800 rounded text-[8px] font-black text-zinc-500 hover:text-cyan-400 hover:border-cyan-900 hover:bg-cyan-950/20 transition-all uppercase">
                        Explorer.log
                    </button>
                </div>
            </div>
        </div>
    );
}

function calculateDuration(start: string | Date, end: string | Date) {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diff = Math.floor((e - s) / 1000);
    const m = Math.floor(diff / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m ${diff % 60}s`;
}
