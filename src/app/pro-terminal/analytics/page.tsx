'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/app-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, TrendingUp, ShieldCheck, Activity, User, Target } from 'lucide-react';
import { AnalyticsService, SentimentAnalysisResult } from '@/services/analytics.service';
// Components
import { SentimentGauge } from './_components/SentimentGauge';
import { PredictionTrafficLight } from './_components/PredictionTrafficLight';
import { RugCheckCard } from './_components/RugCheckCard';
import { RecentAnalysisList } from './_components/RecentAnalysisList';
import UnifiedKolMindmap from '@/components/trading/unified-kol-mindmap';
import TopTraders from '@/components/trading/top-traders';
import { useTradingStore } from '@/stores/use-trading-store';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils'; // Assuming global util

export default function AnalyticsDashboardPage() {
    const router = useRouter();
    const [tokenInput, setTokenInput] = useState('');
    const [activeToken, setActiveToken] = useState(''); // Used to trigger cards

    // States suitable for card props
    const [sentiment, setSentiment] = useState<SentimentAnalysisResult | null>(null);
    const [loadingSentiment, setLoadingSentiment] = useState(false);
    const [sentimentError, setSentimentError] = useState<string | null>(null);
    const [prediction, setPrediction] = useState<{ label: "GOOD" | "BAD" | "NEUTRAL", confidence: number } | null>(null);

    // Filter for Leaderboard
    const [showSubscribedOnly, setShowSubscribedOnly] = useState(false);
    const { subscriptions } = useTradingStore();

    // Pre-initialize the agent socket to avoid double-click issue
    useEffect(() => {
        console.log('[Analytics] Pre-initializing AnalyticsService agent socket...');
        AnalyticsService['getAgentSocket']();
    }, []);

    const handleAnalyze = async () => {
        if (!tokenInput) return;

        // Validate Solana address format (base58, typically 32-44 characters)
        if (tokenInput.length < 32 || tokenInput.length > 44) {
            setSentimentError("Please enter a valid Solana token address (32-44 characters), not a symbol.");
            return;
        }

        // Check if it's a valid base58 string
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
        if (!base58Regex.test(tokenInput)) {
            setSentimentError("Invalid Solana address format. Please enter a valid base58 address.");
            return;
        }

        setActiveToken(tokenInput); // Preserve original case for Solana addresses

        // Reset States
        setSentiment(null);
        setPrediction(null);
        setSentimentError(null);
        setLoadingSentiment(true);

        try {
            // Parallel execution: Sentiment (Agent/WS) + ML (HTTP)
            // Use the address directly for sentiment analysis
            const [sentimentResult, predictionResult] = await Promise.allSettled([
                AnalyticsService.analyzeSentiment(tokenInput),
                AnalyticsService.getPrediction(tokenInput)
            ]);

            // Handle Sentiment
            if (sentimentResult.status === 'fulfilled') {
                console.log('[Analytics] ✅ Sentiment Analysis Result:', sentimentResult.value);
                console.log('[Analytics] 📊 Sentiment Score for Gauge:', sentimentResult.value.score);
                console.log('[Analytics] 📝 Full Sentiment JSON:', JSON.stringify(sentimentResult.value, null, 2));
                setSentiment(sentimentResult.value);
            } else {
                console.error("Sentiment failed", sentimentResult.reason);
                setSentimentError(sentimentResult.reason.message || "Analysis failed");
            }

            // Handle Prediction
            if (predictionResult.status === 'fulfilled' && predictionResult.value) {
                const { probability: prob, label: serverLabel } = predictionResult.value;
                let label: "GOOD" | "BAD" | "NEUTRAL" = "NEUTRAL";
                let confidence = prob * 100;

                // Priority 1: Use server provided label if it exists
                if (serverLabel) {
                    const normalized = serverLabel.toUpperCase();
                    if (normalized === 'GOOD') {
                        label = 'GOOD';
                    } else if (normalized === 'BAD') {
                        label = 'BAD';
                    } else {
                        label = 'NEUTRAL';
                    }
                } else {
                    // Priority 2: Fallback to existing probability logic
                    if (prob >= 0.6) {
                        label = "GOOD";
                    } else if (prob <= 0.4) {
                        label = "BAD";
                        confidence = (1 - prob) * 100;
                    } else {
                        label = "NEUTRAL";
                        confidence = (1 - Math.abs(prob - 0.5) * 2) * 100;
                    }
                }

                setPrediction({ label, confidence });
            }

        } catch (err: any) {
            console.error("Analysis pipeline failed", err);
            setSentimentError(err.message || "Pipeline failed");
        } finally {
            setLoadingSentiment(false);
        }
    };

    return (
        <AppLayout>
            {/* Main Container: Fixed height (viewport - header - footer - top margin), no window scroll 
                Mobile: 100vh - 5rem (header) - 1rem (margin) = 6rem
                Desktop: 100vh - 6rem (header) - 3rem (footer) - 1rem (margin) = ~10rem
            */}
            <div className="max-w-[1800px] mx-auto p-2 mt-4 h-[calc(100vh-6rem)] lg:h-[calc(100vh-10rem)] flex flex-col font-sans overflow-hidden">

                {/* 3-Column Grid: Stretches to fill available height, columns must have min-h-0 to allow children to scroll */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">

                    {/* Left Column: Smart Wallets (Data Feed Style) */}
                    <div className="lg:col-span-3 flex flex-col h-full min-h-0">
                        <div className="flex-1 flex flex-col border border-border/60 rounded-xl bg-card/20 backdrop-blur-xl overflow-hidden shadow-2xl relative group">
                            {/* Decorative scanline */}
                            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />

                            <div className="py-2 px-3 border-b border-border/50 flex items-center justify-between shrink-0 bg-muted/20">
                                <div className="flex items-center gap-2">
                                    <Target className="w-4 h-4 text-primary animate-pulse" />
                                    <span className="font-bold text-xs text-foreground uppercase tracking-wider">Smart Wallets</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor="subscribed-mode" className="text-[9px] font-bold uppercase tracking-wider cursor-pointer text-muted-foreground hover:text-primary transition-colors">Subscribed</Label>
                                    <Switch
                                        id="subscribed-mode"
                                        checked={showSubscribedOnly}
                                        onCheckedChange={setShowSubscribedOnly}
                                        className="scale-75"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                                <TopTraders
                                    limit={50}
                                    className="h-full"
                                    filterWallets={showSubscribedOnly ? (subscriptions?.length > 0 ? subscriptions.map(s => s.kolWallet) : []) : null}
                                    compactMode
                                />
                                {/* Overlay gradient for fade effect at bottom */}
                                <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Center Column: Interactive Intelligence (Mindmap + Details) */}
                    <div className="lg:col-span-6 flex flex-col gap-3 h-full min-h-0">
                        {/* Upper: Mindmap - Takes 60% of vertical space */}
                        <div className="flex-[6] flex flex-col border border-border/60 rounded-xl bg-black/40 backdrop-blur-xl overflow-hidden shadow-2xl relative min-h-0">
                            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20 pointer-events-none" />

                            {/* Integrated Toolbar/Header */}
                            <div className="py-2 px-3 border-b border-white/10 shrink-0 flex items-center justify-between z-10 bg-black/40 backdrop-blur-md">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 hidden lg:flex">
                                    <Activity className="w-3 h-3 text-blue-400" />
                                    Network Discovery
                                </h3>

                                {/* Integrated Search Input */}
                                <div className="flex items-center gap-2 flex-1 max-w-xs mx-auto lg:mx-4">
                                    <div className="relative w-full group">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            placeholder="ENTER SOLANA TOKEN ADDRESS"
                                            className="h-7 pl-8 bg-black/40 border-white/10 font-mono text-[10px] uppercase placeholder:normal-case focus:border-primary/50 transition-all text-white placeholder:text-muted-foreground/70"
                                            value={tokenInput}
                                            onChange={(e) => setTokenInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                                        />
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleAnalyze}
                                        className="h-7 text-[10px] font-bold uppercase tracking-wider bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 hover:border-primary/50"
                                    >
                                        Analyze
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => router.push(`/pro-terminal/trade?mint=${tokenInput}`)}
                                        disabled={!tokenInput || tokenInput.length < 32}
                                        className="h-7 text-[10px] font-bold uppercase tracking-wider bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Terminal
                                    </Button>
                                </div>

                                <div className="flex gap-1 hidden lg:flex">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[9px] uppercase tracking-wider text-green-500 font-mono">LIVE</span>
                                </div>
                            </div>

                            <div className="flex-1 relative overflow-hidden z-0">
                                <UnifiedKolMindmap />
                            </div>
                        </div>

                        {/* Lower: Prediction & Security - Takes 40% of vertical space */}
                        <div className="flex-[4] grid grid-cols-2 gap-3 min-h-0">
                            {/* Contract Security */}
                            <div className="border border-border/60 rounded-xl bg-card/20 backdrop-blur-xl overflow-hidden shadow-lg flex flex-col min-h-0">
                                <div className="py-2 px-3 border-b border-border/50 bg-muted/20 shrink-0">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <ShieldCheck className="w-3 h-3 text-orange-400" /> Security
                                    </h3>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <RugCheckCard tokenAddress={activeToken} />
                                </div>
                            </div>

                            {/* ML Prediction */}
                            <div className="border border-border/60 rounded-xl bg-card/20 backdrop-blur-xl overflow-hidden shadow-lg flex flex-col min-h-0">
                                <div className="py-2 px-3 border-b border-border/50 bg-muted/20 flex justify-between items-center shrink-0">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <TrendingUp className="w-3 h-3 text-purple-400" /> Prediction
                                    </h3>
                                    {activeToken && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">{activeToken}</span>}
                                </div>
                                <div className="p-2 flex-1 flex flex-col items-center justify-center min-h-0 overflow-y-auto">
                                    <PredictionTrafficLight prediction={prediction} loading={loadingSentiment} />
                                    {!activeToken && <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-2 opacity-50">Select Token</div>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: AI Analyst Chat & Sentiment */}
                    <div className="lg:col-span-3 flex flex-col gap-3 h-full min-h-0">
                        {/* Sentinel Chat - Takes 65% height */}
                        <div className="flex-[6.5] min-h-0">
                            <RecentAnalysisList
                                className="h-full border-border/60 bg-card/20 rounded-xl"
                            />
                        </div>

                        {/* Sentiment Gauge - Takes 35% height */}
                        <div className="flex-[3.5] min-h-0 border border-border/60 rounded-xl bg-card/20 backdrop-blur-xl overflow-hidden shadow-lg flex flex-col">
                            <div className="py-2 px-3 border-b border-border/50 bg-muted/20 shrink-0">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <User className="w-3 h-3 text-pink-400" /> Social Sentiment
                                </h3>
                            </div>
                            <div className="p-2 flex-1 relative overflow-hidden flex flex-col min-h-0">
                                {/* Ambient Glow */}
                                <div className={cn(
                                    "absolute inset-0 bg-gradient-to-t from-pink-500/5 to-transparent transition-opacity duration-1000",
                                    sentiment ? "opacity-100" : "opacity-0"
                                )} />

                                {sentimentError ? (
                                    <div className="flex-1 flex items-center justify-center p-4">
                                        <div className="text-red-400 text-xs text-center border border-red-500/20 bg-red-500/5 p-2 rounded">{sentimentError}</div>
                                    </div>
                                ) : (
                                    <SentimentGauge
                                        score={sentiment?.score || 50}
                                        loading={loadingSentiment}
                                        positiveWords={sentiment?.positiveWords || []}
                                        negativeWords={sentiment?.negativeWords || []}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </AppLayout>
    );
}
