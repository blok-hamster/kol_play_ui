'use client';

import React, { Suspense, useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { LightweightTradingChart } from '@/components/trading/lightweight-trading-chart';
import { TradeExecutionForm } from '@/components/trading/trade-execution-form';
import { RugCheckSecurity } from '@/components/trading/rugcheck-security';
import { OrderHistory } from '@/components/trading/order-history';
import { useSearchParams, useRouter } from 'next/navigation';
import { TokenService } from '@/services/token.service';
import { SearchTokenResult } from '@/types';
import { cn } from '@/lib/utils';

import { Loader2, ExternalLink, Search, TrendingUp, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// import { usePumpPortalStream } from '@/hooks/use-pumpportal-stream'; // Unused in main component, logic moved to Chart

// --- Active Trading View (When mint is selected) ---
function ActiveTradeSession({ mint }: { mint: string }) {
    const [token, setToken] = React.useState<SearchTokenResult | null>(null);

    // Live price updates
    const [livePrice, setLivePrice] = React.useState<number | null>(null);
    const [isHeaderCollapsed, setIsHeaderCollapsed] = React.useState(true);

    React.useEffect(() => {
        const fetchToken = async () => {
            if (!mint) return;
            setLoading(true);
            try {
                const res = await TokenService.getToken(mint);
                setToken(res.data as any);
                // Use quote price (SOL) as default
                if ((res.data as any)?.pools?.[0]?.price?.quote) {
                    setLivePrice((res.data as any).pools[0].price.quote);
                }
            } catch (e) {
                console.error('Failed to fetch token metadata', e);
            } finally {
                setLoading(false);
            }
        };
        fetchToken();
    }, [mint]);

    // Note: WebSocket updates are now handled by LightweightTradingChart via onPriceUpdate
    // to ensure the chart and header are always in sync.

    const displayPrice = livePrice || (token as any)?.pools?.[0]?.price?.quote || 0;

    return (
        <div className="max-w-[1800px] mx-auto px-4 py-4 space-y-4">
            {/* Token Header Info */}
            <div className="bg-card/40 border border-border rounded-2xl p-4 lg:p-5 flex flex-col gap-4 backdrop-blur-md shadow-2xl shadow-black/20">
                {token ? (
                    <>
                        <div className="flex items-center justify-between w-full">
                            {(() => {
                                const t = token as any;
                                return (
                                    <div className="flex items-center space-x-4">
                                        <div className="relative">
                                            {t.token?.image ? (
                                                <img src={t.token.image} alt={t.token.symbol} className="w-10 h-10 lg:w-12 lg:h-12 rounded-full border-2 border-primary/50 shadow-lg" />
                                            ) : (
                                                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-muted rounded-full flex items-center justify-center font-black text-[10px] lg:text-xs border-2 border-border">
                                                    {t.token?.symbol?.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="absolute -bottom-1 -right-1 w-3 h-3 lg:w-4 lg:h-4 bg-green-500 rounded-full border-2 border-card animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h1 className="text-lg lg:text-2xl font-black text-foreground tracking-tighter uppercase italic">{t.token?.symbol} <span className="text-muted-foreground opacity-50 not-italic">/ SOL</span></h1>
                                                <div className="px-1.5 py-0.5 bg-primary/10 border border-primary/20 rounded text-[8px] lg:text-[9px] font-black text-primary uppercase tracking-widest">PRO FEED</div>
                                            </div>
                                            <div className="text-[9px] lg:text-[10px] text-muted-foreground font-mono font-bold tracking-tight opacity-70 max-w-[150px] lg:max-w-[200px] truncate">{t.token?.name}</div>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="flex items-center gap-3">
                                <div className="text-right lg:hidden">
                                    <div className="text-sm font-black text-foreground">
                                        {displayPrice ? displayPrice.toFixed(9) : '0.00'}
                                    </div>
                                    <div className="text-[8px] text-green-500 font-bold uppercase">SOL</div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="lg:hidden h-8 w-8 p-0"
                                    onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                                >
                                    {isHeaderCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>

                        {(!isHeaderCollapsed || (typeof window !== 'undefined' && window.innerWidth >= 1024)) && (
                            <div className={cn("flex flex-wrap items-center gap-6 lg:gap-8 pt-4 lg:pt-0 border-t border-border/30 lg:border-0", isHeaderCollapsed && "hidden lg:flex")}>
                                {(() => {
                                    const t = token as any;
                                    return (
                                        <>
                                            <div className="h-12 w-px bg-border/50 hidden lg:block" />
                                            <div className="flex-1 flex flex-wrap items-center gap-6 lg:gap-8">
                                                <div className="space-y-1 hidden lg:block">
                                                    <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">Live Price</div>
                                                    <div className="text-xl font-black text-foreground leading-none flex items-baseline gap-1">
                                                        {displayPrice ? displayPrice.toFixed(9) : '0.00'}
                                                        <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">SOL</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <div className="text-[9px] lg:text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">24h Vol</div>
                                                    <div className="text-xs lg:text-sm font-bold text-foreground leading-none">
                                                        {t.pools?.[0]?.txns?.volume ? `$${(t.pools[0].txns.volume / 1000).toFixed(1)}K` : 'N/A'}
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <div className="text-[9px] lg:text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">Liquidity</div>
                                                    <div className="text-xs lg:text-sm font-bold text-foreground leading-none">
                                                        {t.pools?.[0]?.liquidity?.usd ? `$${(t.pools[0].liquidity.usd / 1000).toFixed(1)}K` : 'N/A'}
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <div className="text-[9px] lg:text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">MKT Cap</div>
                                                    <div className="text-xs lg:text-sm font-bold text-foreground leading-none">
                                                        {t.pools?.[0]?.marketCap?.usd ? `$${(t.pools[0].marketCap.usd / 1000).toFixed(1)}K` : 'N/A'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 ml-auto">
                                                <a href={`https://dexscreener.com/solana/${mint}`} target="_blank" rel="noopener noreferrer">
                                                    <Button variant="outline" size="sm" className="h-8 text-[9px] lg:text-[10px] font-black uppercase tracking-widest px-3 border-2">
                                                        <ExternalLink className="w-3 h-3 mr-1" />
                                                        DexScreener
                                                    </Button>
                                                </a>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex items-center space-x-3 py-1">
                        <div className="w-10 h-10 rounded-full bg-muted/50 animate-pulse" />
                        <div className="space-y-2">
                            <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
                            <div className="h-3 w-48 bg-muted/30 rounded animate-pulse" />
                        </div>
                    </div>
                )}
            </div>

            {/* Main Trading Layout */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-4">
                <div className="lg:col-span-9 flex flex-col space-y-4">
                    <div className="bg-background rounded-2xl overflow-hidden min-h-[550px]">
                        <LightweightTradingChart
                            mint={mint}
                            symbol={(token as any)?.token?.symbol}
                            onPriceUpdate={setLivePrice}
                        />
                    </div>
                    <div className="h-[500px] overflow-hidden">
                        <OrderHistory className="h-full" mint={mint} />
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-4">
                    <TradeExecutionForm
                        mint={mint}
                        symbol={(token as any)?.token?.symbol}
                        className="h-auto"
                        currentPrice={displayPrice}
                    />
                    <RugCheckSecurity mint={mint} />
                </div>
            </div>

            {/* Mobile Trading Layout: Tabs */}
            <div className="lg:hidden">
                <Tabs defaultValue="chart" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-muted/30 p-1 rounded-xl h-auto border border-border/50">
                        <TabsTrigger value="chart" className="py-2 text-[10px] font-bold uppercase tracking-wider">
                            Chart
                        </TabsTrigger>
                        <TabsTrigger value="trade" className="py-2 text-[10px] font-bold uppercase tracking-wider">
                            Trade
                        </TabsTrigger>
                        <TabsTrigger value="history" className="py-2 text-[10px] font-bold uppercase tracking-wider">
                            History
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="chart" className="mt-4 space-y-4 ring-0 focus-visible:ring-0">
                        <div className="bg-background rounded-2xl overflow-hidden h-[450px] border border-border/50 shadow-lg">
                            <LightweightTradingChart
                                mint={mint}
                                symbol={(token as any)?.token?.symbol}
                                onPriceUpdate={setLivePrice}
                            />
                        </div>
                        <RugCheckSecurity mint={mint} />
                    </TabsContent>

                    <TabsContent value="trade" className="mt-4 ring-0 focus-visible:ring-0">
                        <TradeExecutionForm
                            mint={mint}
                            symbol={(token as any)?.token?.symbol}
                            className="h-auto"
                            currentPrice={displayPrice}
                        />
                    </TabsContent>

                    <TabsContent value="history" className="mt-4 ring-0 focus-visible:ring-0">
                        <div className="h-[500px] overflow-hidden border border-border/50 rounded-2xl shadow-lg">
                            <OrderHistory className="h-full" mint={mint} />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

// --- Selection View (When no mint is selected) ---
function TradeSelectionMode() {
    const router = useRouter();
    const [addressInput, setAddressInput] = useState('');

    const handleDeFiSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (addressInput.trim()) {
            router.push(`/pro-terminal/trade?mint=${addressInput.trim()}`);
        }
    };

    const PREDICTION_MARKETS = [
        { id: 'btc-dec-100k', title: 'Will BTC hit $100k by Dec 31?', volume: '$4.2M', chance: '32%' },
        { id: 'sol-flippening', title: 'Will SOL flip ETH in market cap?', volume: '$1.8M', chance: '12%' },
        { id: 'fed-cut-nov', title: 'Fed to cut rates in November?', volume: '$890k', chance: '85%' },
    ];

    return (
        <div className="flex items-center justify-center min-h-[80vh] p-4">
            <Card className="w-full max-w-2xl bg-card/50 backdrop-blur-xl border-border shadow-2xl">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-black uppercase tracking-tighter italic">Trading Terminal</CardTitle>
                    <CardDescription className="text-sm font-medium uppercase tracking-widest opacity-60">
                        Select a market target to begin execution
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <Tabs defaultValue="defi" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-8 h-auto p-1 bg-muted/50 rounded-xl border border-border/50">
                            <TabsTrigger value="defi" className="py-3 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                                <TrendingUp className="w-4 h-4 mr-2" />
                                DeFi
                            </TabsTrigger>
                            <TabsTrigger value="prediction" className="py-3 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                                <Trophy className="w-4 h-4 mr-2" />
                                Prediction (Beta)
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="defi" className="space-y-6">
                            <form onSubmit={handleDeFiSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Token Address / Mint</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Enter Solana token address..."
                                            className="pl-10 h-12 bg-background border-border text-foreground focus-visible:ring-primary/20 font-mono text-sm"
                                            value={addressInput}
                                            onChange={(e) => setAddressInput(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <Button type="submit" size="lg" className="w-full font-black uppercase tracking-widest" disabled={!addressInput.trim()}>
                                    Launch Terminal
                                </Button>
                            </form>

                            <div className="mt-8 pt-6 border-t border-border/50">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-4">Quick Select</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    <Button variant="outline" size="sm" className="text-xs" onClick={() => router.push('/pro-terminal/trade?mint=So11111111111111111111111111111111111111112')}>
                                        SOL
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-xs" onClick={() => router.push('/pro-terminal/trade?mint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')}>
                                        USDC
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-xs" onClick={() => router.push('/pro-terminal/trade?mint=JUPyiwrYJFskUPiHa7hkeR8VUtkq41wVZnTjihQgTU2')}>
                                        JUP
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="prediction" className="space-y-4">
                            <div className="grid gap-3">
                                {PREDICTION_MARKETS.map((market) => (
                                    <div
                                        key={market.id}
                                        className="relative group flex items-center justify-between p-4 rounded-xl bg-background/40 border border-border/50 opacity-60 grayscale cursor-not-allowed"
                                    >
                                        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 text-[9px] font-bold uppercase rounded border border-yellow-500/40 z-10">
                                            BETA
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-sm font-bold text-foreground">{market.title}</div>
                                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                                                <span>Vol: {market.volume}</span>
                                                <span className="w-1 h-1 bg-border rounded-full" />
                                                <span className="text-green-500">Chance: {market.chance}</span>
                                            </div>
                                        </div>
                                        <div className="p-2 rounded-lg bg-muted/20 text-muted-foreground">
                                            <ExternalLink className="w-4 h-4" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

function ProTradeContent() {
    const searchParams = useSearchParams();
    const mint = searchParams?.get('mint');

    if (!mint) {
        return <TradeSelectionMode />;
    }

    return <ActiveTradeSession mint={mint} />;
}

export default function ProTradingPage() {
    return (
        <AppLayout>
            <Suspense fallback={
                <div className="flex items-center justify-center min-h-[50vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            }>
                <ProTradeContent />
            </Suspense>
        </AppLayout>
    );
}
