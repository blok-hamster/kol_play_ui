'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/app-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Activity, Target, ShieldCheck, TrendingUp, Sparkles, Bot, LineChart } from 'lucide-react';
import { AnalyticsService } from '@/services/analytics.service';
import { useAnalyticsQuery } from '@/hooks/use-analytics-query';

// Components
import { SentimentGauge } from '@/app/pro-terminal/analytics/_components/SentimentGauge';
import { PredictionTrafficLight } from '@/app/pro-terminal/analytics/_components/PredictionTrafficLight';
import { RugCheckCard } from '@/app/pro-terminal/analytics/_components/RugCheckCard';
import { RecentAnalysisList } from '@/app/pro-terminal/analytics/_components/RecentAnalysisList';
import UnifiedKolMindmap from '@/components/trading/unified-kol-mindmap';
import TopTraders from '@/components/trading/top-traders';
import { useTradingStore } from '@/stores/use-trading-store';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { KOLTradeSocketProvider, useKOLTradeSocketContext } from '@/contexts/kol-trade-socket-context';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

// Dynamically import the chart to avoid SSR "window is not defined" or similar export issues with lightweight-charts
const LightweightTradingChart = dynamic(
    () => import('@/components/trading/lightweight-trading-chart').then(mod => mod.LightweightTradingChart),
    { ssr: false }
);

/** Thin wrapper that reads socket context and passes mindmap data as props */
function MindmapWithData() {
    const { allMindmapData, trendingTokens } = useKOLTradeSocketContext();
    return (
        <UnifiedKolMindmap
            tokensData={allMindmapData}
            trendingTokens={trendingTokens}
        />
    );
}

export default function AnalyticsDashboardPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const addressParam = searchParams.get('address');

    // UI State
    const [tokenInput, setTokenInput] = useState('');
    const [showSubscribedOnly, setShowSubscribedOnly] = useState(false);
    const { subscriptions } = useTradingStore();

    // Custom Hook logic
    const {
        activeToken,
        analyze,
        sentiment,
        loadingSentiment,
        sentimentError,
        prediction,
        loadingPrediction,
        predictionError
    } = useAnalyticsQuery();

    // Pre-fill from URL
    useEffect(() => {
        if (addressParam) {
            setTokenInput(addressParam);
            // Auto analyze when param exists
            const timerId = setTimeout(() => {
                analyze(addressParam);
            }, 500);
            return () => clearTimeout(timerId);
        }
    }, [addressParam, analyze]);

    // Pre-initialize the agent socket
    useEffect(() => {
        console.log('[Analytics] Pre-initializing Agent socket...');
        AnalyticsService['getAgentSocket']();
    }, []);

    const handleSearch = () => {
        if (!tokenInput) return;
        analyze(tokenInput);
    };

    return (
        <KOLTradeSocketProvider>
            <AppLayout>
                <div className="max-w-[1800px] mx-auto p-2 mt-4 h-[calc(100vh-6rem)] lg:h-[calc(100vh-7rem)] flex flex-col font-sans overflow-hidden">

                    {/* Command Center Header */}
                    <div className="flex flex-col lg:flex-row gap-4 mb-4 shrink-0 px-2">
                        {/* Token Search Bar */}
                        <div className="flex items-center gap-2 bg-card/40 p-2 rounded-xl border border-white/5 backdrop-blur-md flex-1 max-w-2xl shadow-lg">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="ENTER SOLANA TOKEN ADDRESS"
                                    className="h-10 pl-9 bg-black/40 border-white/10 font-mono text-xs uppercase placeholder:normal-case focus:border-primary/50 transition-all text-white placeholder:text-muted-foreground/50"
                                    value={tokenInput}
                                    onChange={(e) => setTokenInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                            </div>
                            <Button
                                size="sm"
                                onClick={handleSearch}
                                className="h-10 px-6 text-xs font-bold uppercase tracking-wider bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20"
                            >
                                Scan Token
                            </Button>
                        </div>

                        {/* Compact Vitals Badge */}
                        <div className="flex gap-2 items-center lg:ml-auto">
                            {activeToken && (
                                <div className="hidden lg:flex flex-col items-end mr-4">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Active Token</span>
                                    <span className="text-xs font-mono text-primary/80 bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{activeToken.substring(0, 6)}...{activeToken.substring(activeToken.length - 4)}</span>
                                </div>
                            )}
                            <Button
                                size="sm"
                                onClick={() => router.push(`/pro-terminal/trade?mint=${activeToken}`)}
                                disabled={!activeToken || activeToken.length < 32}
                                className="h-10 text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed hidden lg:flex"
                            >
                                <TrendingUp className="w-4 h-4 mr-2" /> Trade Terminal
                            </Button>
                        </div>
                    </div>

                    {/* Main Workspace (Single Page Grid Dashboard) */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-6">
                        <div className="flex flex-col gap-4 max-w-[1800px] mx-auto">

                            {/* ROW 1: Quick Vitals (Prediction, Swarm Gauge, Security) */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                {/* ML Prediction */}
                                <div className="lg:col-span-4 border border-border/60 rounded-xl bg-card/20 backdrop-blur-xl overflow-hidden shadow-lg flex flex-col h-[260px]">
                                    <div className="py-3 px-4 border-b border-border/50 bg-muted/20 shrink-0">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-purple-400" /> Market Prediction
                                        </h3>
                                    </div>
                                    <div className="p-4 flex-1 flex items-center justify-center overflow-y-auto">
                                        <PredictionTrafficLight prediction={prediction} loading={loadingPrediction} />
                                        {/* {predictionError && !prediction && (
                                            <div className="text-red-400 text-[10px] mt-2 bg-red-500/5 border border-red-500/10 p-2 rounded uppercase tracking-tighter font-bold">
                                                {predictionError}
                                            </div>
                                        )} */}
                                    </div>
                                </div>

                                {/* Swarm Sentiment */}
                                <div className="lg:col-span-4 border border-border/60 rounded-xl bg-card/20 backdrop-blur-xl overflow-hidden shadow-lg flex flex-col h-[260px]">
                                    <div className="py-3 px-4 border-b border-border/50 bg-muted/20 flex justify-between items-center shrink-0">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <Bot className="w-4 h-4 text-pink-400" /> Sentiment Swarm
                                        </h3>
                                    </div>
                                    <div className="p-4 flex-1 relative overflow-y-auto custom-scrollbar flex flex-col items-center">
                                        <div className={cn(
                                            "absolute inset-0 bg-gradient-to-t from-pink-500/5 to-transparent transition-opacity duration-1000 pointer-events-none",
                                            sentiment ? "opacity-100" : "opacity-0"
                                        )} />
                                        {sentimentError ? (
                                            <div className="flex-1 flex items-center justify-center p-4">
                                                <div className="text-red-400 text-xs text-center border border-red-500/20 bg-red-500/5 p-4 rounded-xl">{sentimentError}</div>
                                            </div>
                                        ) : (!sentiment && !loadingSentiment) ? (
                                            <div className="opacity-50 flex flex-col items-center">
                                                <Bot className="w-8 h-8 text-muted-foreground mb-2" />
                                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Awaiting intelligence sweep</span>
                                            </div>
                                        ) : (
                                            <div className="w-full max-w-sm mt-2">
                                                <SentimentGauge
                                                    score={sentiment?.score || 50}
                                                    loading={loadingSentiment}
                                                    positiveWords={sentiment?.positiveWords || []}
                                                    negativeWords={sentiment?.negativeWords || []}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Security Audit */}
                                <div className="lg:col-span-4 border border-border/60 rounded-xl bg-card/20 backdrop-blur-xl overflow-hidden shadow-lg flex flex-col h-[260px]">
                                    <div className="py-3 px-4 border-b border-border/50 bg-muted/20 shrink-0">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-orange-400" /> Security Audit
                                        </h3>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                        {activeToken ? (
                                            <RugCheckCard tokenAddress={activeToken} />
                                        ) : (
                                            <div className="flex h-full items-center justify-center opacity-50">
                                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select a token</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ROW 2: Deep Dive (Mindmap & Narrative) */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                {/* Network Mindmap & Chart (Tabbed) */}
                                <div className="lg:col-span-8 border border-border/60 rounded-xl bg-black/40 backdrop-blur-xl overflow-hidden relative shadow-lg h-[420px] flex flex-col">
                                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20 pointer-events-none" />

                                    <Tabs defaultValue="mindmap" className="flex-1 flex flex-col min-h-0 relative z-10 w-full">
                                        <div className="flex items-center justify-between p-2 pl-4 border-b border-border/50 bg-black/60 backdrop-blur-md">
                                            <TabsList className="bg-white/5 border border-white/10 h-9">
                                                <TabsTrigger value="mindmap" className="text-[10px] uppercase font-bold tracking-wider py-1 px-3 gap-1.5 border border-transparent data-[state=active]:border-white/10 text-white data-[state=active]:bg-black/40">
                                                    <Activity className="w-3.5 h-3.5 text-blue-400" /> Network Mindmap
                                                </TabsTrigger>
                                                <TabsTrigger value="chart" disabled={!activeToken} className="text-[10px] uppercase font-bold tracking-wider py-1 px-3 gap-1.5 border border-transparent data-[state=active]:border-white/10 text-white data-[state=active]:bg-black/40 xl:min-w-32">
                                                    <LineChart className="w-3.5 h-3.5 text-primary" /> Token Chart
                                                </TabsTrigger>
                                            </TabsList>

                                            <div className="flex gap-1 items-center bg-black/60 px-2 py-1.5 rounded border border-white/5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                <span className="text-[9px] uppercase tracking-wider text-green-500 font-mono">LIVE SOCKET</span>
                                            </div>
                                        </div>

                                        <TabsContent value="mindmap" className="flex-1 min-h-0 m-0 border-none p-0 outline-none data-[state=active]:flex flex-col relative bg-transparent">
                                            <div className="flex-1 w-full h-full">
                                                <MindmapWithData />
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="chart" className="flex-1 min-h-0 m-0 border-none p-0 outline-none data-[state=active]:flex flex-col relative bg-black/40 bg-opacity-90">
                                            <div className="flex-1 w-full h-full p-2">
                                                {activeToken ? (
                                                    <LightweightTradingChart mint={activeToken} />
                                                ) : (
                                                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm opacity-50">
                                                        <LineChart className="w-12 h-12 mb-4 mx-auto opacity-20" />
                                                        Search a token to view chart
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </div>

                                {/* Narrative Architect Synthesis */}
                                <div className="lg:col-span-4 border border-border/60 rounded-xl bg-card/20 backdrop-blur-xl overflow-hidden shadow-lg h-[420px] flex flex-col">
                                    <div className="py-3 px-4 border-b border-border/50 bg-muted/20 shrink-0">
                                        <h4 className="text-xs font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-primary" /> Narrative Synthesis
                                        </h4>
                                    </div>
                                    <div className="p-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                                        <div className="bg-black/40 rounded-xl border border-white/5 p-4 flex-1 flex flex-col">
                                            {loadingSentiment ? (
                                                <div className="space-y-3 animate-pulse">
                                                    <div className="h-4 bg-white/5 rounded w-3/4"></div>
                                                    <div className="h-4 bg-white/5 rounded w-5/6"></div>
                                                    <div className="h-4 bg-white/5 rounded w-1/2"></div>
                                                </div>
                                            ) : sentiment?.summary ? (
                                                <div className="space-y-4">
                                                    <div className="text-sm text-foreground/80 leading-relaxed font-sans [&>p]:mb-2 [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mb-2 [&>h2]:text-base [&>h2]:font-bold [&>h2]:mb-2 [&>h3]:text-sm [&>h3]:font-bold [&>h3]:mb-1 [&>ul]:list-disc [&>ul]:ml-4 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:ml-4 [&>ol]:mb-2 [&>li]:mb-1 [&_strong]:text-foreground [&_strong]:font-bold [&_em]:italic">
                                                        <ReactMarkdown>{sentiment.summary}</ReactMarkdown>
                                                    </div>
                                                    {sentiment.sampleTweets && sentiment.sampleTweets.length > 0 && (
                                                        <div className="mt-6">
                                                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2 border-b border-white/10 pb-1">Sample Engagement Data</div>
                                                            <ul className="space-y-2">
                                                                {sentiment.sampleTweets.map((tw, idx) => (
                                                                    <li key={idx} className="text-xs text-muted-foreground bg-white/5 p-2 rounded line-clamp-3">
                                                                        {tw}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="h-full flex items-center justify-center opacity-40">
                                                    <span className="text-xs italic flex flex-col items-center gap-2">
                                                        <Bot className="w-6 h-6 text-muted-foreground" />
                                                        Awaiting Swarm Summary
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ROW 3: Data & History (Tabbed) */}
                            <div className="border border-border/60 rounded-xl bg-card/20 backdrop-blur-xl overflow-hidden shadow-lg h-[450px] flex flex-col">
                                <Tabs defaultValue="wallets" className="flex-1 flex flex-col min-h-0">
                                    <div className="py-2 px-4 border-b border-border/50 bg-muted/20 shrink-0 flex items-center justify-between">
                                        <TabsList className="bg-black/40 border border-white/5 h-9">
                                            <TabsTrigger value="wallets" className="text-[10px] uppercase font-bold tracking-wider py-1 px-3 gap-1.5 border border-transparent data-[state=active]:border-white/10">
                                                <Target className="w-3 h-3" /> Smart Wallets
                                            </TabsTrigger>
                                            <TabsTrigger value="history" className="text-[10px] uppercase font-bold tracking-wider py-1 px-3 gap-1.5 border border-transparent data-[state=active]:border-white/10">
                                                <Sparkles className="w-3 h-3" /> Saved Scans
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <TabsContent value="wallets" className="flex-1 min-h-0 m-0 border-none p-0 outline-none data-[state=active]:flex flex-col">
                                        <div className="py-2 px-4 border-b border-border/50 flex items-center justify-between shrink-0 bg-black/20">
                                            <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-widest">Copy Trading Explorer</span>
                                            <div className="flex items-center space-x-2">
                                                <Label htmlFor="subscribed-mode-tab" className="text-[9px] font-bold uppercase tracking-wider cursor-pointer text-muted-foreground">Show Subscribed Only</Label>
                                                <Switch
                                                    id="subscribed-mode-tab"
                                                    checked={showSubscribedOnly}
                                                    onCheckedChange={setShowSubscribedOnly}
                                                    className="scale-75 data-[state=checked]:bg-primary"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto">
                                            <TopTraders
                                                limit={50}
                                                className="h-full border-none shadow-none bg-transparent"
                                                filterWallets={showSubscribedOnly ? (subscriptions?.length > 0 ? subscriptions.map(s => s.kolWallet) : []) : null}
                                            />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="history" className="flex-1 min-h-0 m-0 border-none p-0 outline-none data-[state=active]:flex flex-col">
                                        <div className="flex-1 overflow-y-auto p-2">
                                            <RecentAnalysisList className="border-none bg-transparent shadow-none" />
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>

                        </div>
                    </div>
                </div>
            </AppLayout>
        </KOLTradeSocketProvider>
    );
}
