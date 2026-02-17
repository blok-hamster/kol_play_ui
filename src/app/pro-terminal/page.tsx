'use client';

import React, { useEffect, useState, useRef } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { TokenService } from '@/services/token.service';
import { SolanaService } from '@/services/solana.service';
import { SearchTokenResult } from '@/types';
import LiveTradesFeed from '@/components/trading/live-trades-feed';
import { Zap, TrendingUp, Clock, ArrowRight, BarChart3, Activity, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { usePumpPortalStream } from '@/hooks/use-pumpportal-stream';
import { executeInstantBuy, checkTradeConfig } from '@/lib/trade-utils';
import TradeConfigPrompt from '@/components/ui/trade-config-prompt';
import { useNotifications } from '@/stores/use-ui-store';

const TokenCard: React.FC<{ token: SearchTokenResult }> = ({ token }) => {
    const [imgError, setImgError] = useState(false);
    const [isBuying, setIsBuying] = useState(false);
    const [showTradeConfigPrompt, setShowTradeConfigPrompt] = useState(false);
    const { showSuccess, showError } = useNotifications();
    const imageUrl = !imgError ? (token.image || (token as any).logoURI) : null;

    const handleInstantBuy = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isBuying) return;

        try {
            const configCheck = await checkTradeConfig();
            if (!configCheck.hasConfig) {
                setShowTradeConfigPrompt(true);
                return;
            }

            setIsBuying(true);
            const result = await executeInstantBuy(token.mint, token.symbol);

            if (result.success) {
                showSuccess(
                    'Buy Order Executed',
                    `Successfully bought ${token.symbol} for ${configCheck.config?.tradeConfig?.minSpend || 'N/A'} SOL`
                );
            } else {
                showError('Buy Error', result.error || 'Failed to execute buy order');
            }
        } catch (error: any) {
            showError('Buy Error', error.message || 'An unexpected error occurred');
        } finally {
            setIsBuying(false);
        }
    };

    const handleAnalyze = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = `/pro-terminal/analytics?address=${token.mint}`;
    };

    const handleTerminal = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = `/pro-terminal/trade?mint=${token.mint}`;
    };

    return (
        <div className="bg-card hover:bg-muted/50 border border-border p-3 rounded-xl transition-all group group-hover:border-primary/50 cursor-pointer" onClick={handleTerminal}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={token.symbol}
                            className="w-8 h-8 rounded-full object-cover"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center font-bold text-xs">
                            {token.symbol?.slice(0, 2).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <div className="font-bold text-sm text-foreground truncate max-w-[100px]">{token.symbol}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[80px]">{token.name}</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold text-foreground">
                        {token.price ? formatCurrency(token.price) : 'N/A'}
                    </div>
                    {token.priceChange24h !== undefined && (
                        <div className={`text-[10px] font-medium ${token.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-2 mt-3">
                <Button
                    size="sm"
                    onClick={handleInstantBuy}
                    disabled={isBuying}
                    className="w-full h-8 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-[10px]"
                >
                    {isBuying ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                        <Zap className="h-3 w-3 mr-1" />
                    )}
                    {isBuying ? 'Buying...' : 'Instant Buy'}
                </Button>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAnalyze}
                        className="flex-1 h-7 text-[9px] font-black uppercase tracking-widest"
                    >
                        <BarChart3 className="h-3 w-3 mr-1" /> Analyze
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTerminal}
                        className="flex-1 h-7 text-[9px] font-black uppercase tracking-widest"
                    >
                        <Activity className="h-3 w-3 mr-1" /> Terminal
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2">
                <span>Vol: {token.volume24h ? formatCurrency(token.volume24h) : 'N/A'}</span>
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
            </div>

            {showTradeConfigPrompt && (
                <TradeConfigPrompt
                    isOpen={showTradeConfigPrompt}
                    onClose={() => setShowTradeConfigPrompt(false)}
                    tokenSymbol={token.symbol}
                />
            )}
        </div>
    );
};

const TokenSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    tokens: SearchTokenResult[];
    isLoading: boolean;
    isLive?: boolean;
}> = ({ title, icon, tokens, isLoading, isLive }) => (
    <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center space-x-2">
                {icon}
                <div className="flex items-center gap-2">
                    <h2 className="font-bold text-foreground uppercase tracking-tight">{title}</h2>
                    {isLive && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Live</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
                [...Array(5)].map((_, i) => (
                    <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
                ))
            ) : tokens.length > 0 ? (
                tokens.map(token => <TokenCard key={token.mint} token={token} />)
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-40 py-10">
                    <Clock className="w-12 h-12 mb-4" />
                    <p className="text-sm font-bold uppercase">No tokens found</p>
                </div>
            )}
        </div>
    </div>
);

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export default function ProLandingPage() {
    const [trendingTokens, setTrendingTokens] = useState<SearchTokenResult[]>([]);
    const [newTokens, setNewTokens] = useState<SearchTokenResult[]>([]);
    const [isTrendingLoading, setIsTrendingLoading] = useState(true);
    const [isNewLoading, setIsNewLoading] = useState(true);

    const { subscribeNewTokens, isConnected } = usePumpPortalStream({ autoConnect: true });

    useEffect(() => {
        const fetchTokens = async () => {
            try {
                const trendingData = await SolanaService.getTrendingTokens();
                setTrendingTokens(trendingData.slice(0, 20)); // Increased limit for scrolling
            } catch (e) {
                console.error('Failed to fetch trending tokens', e);
            } finally {
                setIsTrendingLoading(false);
            }

            try {
                const newData = await SolanaService.getNewTokens();
                setNewTokens(newData.slice(0, 20)); // Increased limit for scrolling
            } catch (e) {
                console.error('Failed to fetch new tokens', e);
            } finally {
                setIsNewLoading(false);
            }
        };

        fetchTokens();

        // Poll trending tokens every 30 seconds for fresh DexScreener data
        const trendingInterval = setInterval(async () => {
            try {
                const trendingData = await SolanaService.getTrendingTokens();
                setTrendingTokens(trendingData.slice(0, 20));
            } catch (e) {
                console.error('Failed to refresh trending tokens', e);
            }
        }, 30_000);

        return () => clearInterval(trendingInterval);
    }, []);

    // Real-time token streaming
    useEffect(() => {
        if (isConnected) {
            const unsubscribe = subscribeNewTokens((token) => {
                const transformed: SearchTokenResult = {
                    mint: token.mint,
                    symbol: token.symbol,
                    name: token.name,
                    image: token.image,
                    price: 0,
                    priceChange24h: 0,
                    volume24h: 0,
                    decimals: 9,
                    holders: 0,
                    jupiter: false,
                    verified: false,
                    liquidityUsd: 0,
                    marketCapUsd: 0,
                    priceUsd: 0,
                    lpBurn: 0,
                    market: 'pump'
                };
                setNewTokens(prev => {
                    if (prev.find(t => t.mint === transformed.mint)) return prev;
                    return [transformed, ...prev].slice(0, 50); // Keep more for scrolling
                });
            });
            return unsubscribe;
        }
    }, [isConnected, subscribeNewTokens]);

    return (
        <AppLayout>
            <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">
                <div className="flex flex-col gap-4 border-b border-border pb-6">
                    {/* <div>
                        <h1 className="text-3xl font-black text-foreground tracking-tighter flex items-center gap-2 italic uppercase">
                            <Zap className="text-yellow-500 fill-yellow-500/20 w-8 h-8" />
                            DISCOVER
                        </h1>
                        <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest opacity-60">Live KOL signals and smart money movements</p>
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                        <Link href="/pro-terminal/analytics">
                            <Button variant="outline" className="font-bold uppercase tracking-wider gap-2 border-primary/20 hover:bg-primary/10 hover:text-primary">
                                <TrendingUp className="w-4 h-4" />
                                Pro Analytics
                            </Button>
                        </Link>
                    </div> */}

                    <Tabs defaultValue="discover" className="w-full">
                        <TabsList className="bg-muted/50 p-1 border border-border/50 rounded-xl h-auto">
                            <TabsTrigger
                                value="discover"
                                className="px-4 sm:px-6 py-1.5 sm:py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs font-bold uppercase tracking-widest"
                            >
                                Discover
                            </TabsTrigger>
                            <TabsTrigger
                                value="prediction"
                                disabled
                                className="px-4 sm:px-6 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest gap-2 opacity-50 cursor-not-allowed"
                            >
                                Prediction
                                <Badge variant="outline" className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0 h-3.5 sm:h-4 border-primary/20 text-primary bg-primary/5">Beta</Badge>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="discover" className="mt-6">
                            {/* Desktop View: 3-column grid */}
                            <div className="hidden lg:grid lg:grid-cols-12 gap-6">
                                {/* Live KOL Trades section */}
                                <div className="lg:col-span-4 space-y-3">
                                    <div className="bg-card/30 border border-border rounded-2xl overflow-hidden h-[700px] shadow-2xl shadow-black/20 backdrop-blur-sm">
                                        <div className="flex items-center justify-between p-4 border-b border-border bg-card/50">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                                <h2 className="font-bold text-foreground uppercase tracking-tight">KOL ACTIVITY</h2>
                                            </div>
                                            <span className="text-[10px] font-black text-muted-foreground uppercase opacity-50 tracking-widest">Real-time</span>
                                        </div>
                                        <LiveTradesFeed
                                            showHeader={false}
                                            limit={50}
                                            compactMode={true}
                                            globalFeed={true}
                                            className="h-full"
                                        />
                                    </div>
                                </div>

                                {/* Trending Tokens section */}
                                <div className="lg:col-span-4 space-y-3">
                                    <div className="bg-card/30 border border-border rounded-2xl overflow-hidden h-[700px] shadow-2xl shadow-black/20 backdrop-blur-sm">
                                        <TokenSection
                                            title="TRENDING"
                                            icon={<TrendingUp className="text-primary w-5 h-5" />}
                                            tokens={trendingTokens}
                                            isLoading={isTrendingLoading}
                                        />
                                    </div>
                                </div>

                                {/* New Tokens section */}
                                <div className="lg:col-span-4 space-y-3">
                                    <div className="bg-card/30 border border-border rounded-2xl overflow-hidden h-[700px] shadow-2xl shadow-black/20 backdrop-blur-sm">
                                        <TokenSection
                                            title="NEW TOKENS"
                                            icon={<Clock className="text-blue-500 w-5 h-5" />}
                                            tokens={newTokens}
                                            isLoading={isNewLoading}
                                            isLive={isConnected}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Mobile View: Tabs */}
                            <div className="lg:hidden space-y-4">
                                <Tabs defaultValue="kol-activity" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3 bg-muted/30 p-1 rounded-xl h-auto border border-border/50">
                                        <TabsTrigger value="kol-activity" className="py-1.5 text-[9px] font-bold uppercase tracking-tighter">
                                            KOLs
                                        </TabsTrigger>
                                        <TabsTrigger value="trending" className="py-1.5 text-[9px] font-bold uppercase tracking-tighter">
                                            Trending
                                        </TabsTrigger>
                                        <TabsTrigger value="new-tokens" className="py-1.5 text-[9px] font-bold uppercase tracking-tighter">
                                            New
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="kol-activity" className="mt-4 ring-0 focus-visible:ring-0">
                                        <div className="bg-card/30 border border-border rounded-2xl overflow-hidden h-[600px] shadow-xl backdrop-blur-sm">
                                            <div className="flex items-center justify-between p-3 border-b border-border bg-card/50">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                                    <h2 className="font-bold text-xs text-foreground uppercase tracking-tight">KOL ACTIVITY</h2>
                                                </div>
                                            </div>
                                            <LiveTradesFeed
                                                showHeader={false}
                                                limit={30}
                                                compactMode={true}
                                                globalFeed={true}
                                                className="h-full"
                                            />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="trending" className="mt-4 ring-0 focus-visible:ring-0">
                                        <div className="bg-card/30 border border-border rounded-2xl overflow-hidden h-[600px] shadow-xl backdrop-blur-sm">
                                            <TokenSection
                                                title="TRENDING"
                                                icon={<TrendingUp className="text-primary w-4 h-4" />}
                                                tokens={trendingTokens}
                                                isLoading={isTrendingLoading}
                                            />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="new-tokens" className="mt-4 ring-0 focus-visible:ring-0">
                                        <div className="bg-card/30 border border-border rounded-2xl overflow-hidden h-[600px] shadow-xl backdrop-blur-sm">
                                            <TokenSection
                                                title="NEW TOKENS"
                                                icon={<Clock className="text-blue-500 w-4 h-4" />}
                                                tokens={newTokens}
                                                isLoading={isNewLoading}
                                                isLive={isConnected}
                                            />
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </AppLayout>
    );
}
