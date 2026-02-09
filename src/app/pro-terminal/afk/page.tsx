'use client';

import React from 'react';
import AppLayout from '@/components/layout/app-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    Gamepad2,
    Bot,
    Activity,
    Zap,
    TrendingUp
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { GlobalSettingsCard } from './components/GlobalSettingsCard';
import { KolClusterCard } from './components/KolClusterCard';
import { TradeFiltersCard } from './components/TradeFiltersCard';
import { RiskManagementCard } from './components/RiskManagementCard';
import { AfkTerminal } from './components/AfkTerminal';

// Component Placeholders (Will be implemented in Phase 4)
const CopyTradingTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
            <AfkTerminal />
            <KolClusterCard />
        </div>

        <div className="lg:col-span-4 space-y-6">
            <GlobalSettingsCard />
            <RiskManagementCard />
            <TradeFiltersCard />
        </div>
    </div>
);

const AgenticTradingTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
            <Card className="p-6 bg-card/50 border-border/50 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Bot className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground italic uppercase">Autonomous Agent Manager</h2>
                            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider opacity-60">Deploy and monitor autonomous trading agents</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="border-blue-500/20 text-blue-500 bg-blue-500/5 uppercase tracking-widest px-3">Beta</Badge>
                </div>

                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border/50 rounded-2xl bg-muted/20">
                    <Bot className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                    <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground opacity-40">No Autonomous Agents Active</p>
                    <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold uppercase tracking-widest text-xs hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">
                        Spawn New Agent
                    </button>
                </div>
            </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
            <Card className="p-6 bg-card/50 border-border/50 backdrop-blur-sm">
                <h3 className="font-bold text-foreground uppercase tracking-tight mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    Autonomous Log
                </h3>
                <div className="space-y-4 opacity-30">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-3">
                            <div className="w-1 bg-blue-500/50 rounded-full" />
                            <div className="space-y-1">
                                <div className="h-3 w-20 bg-muted rounded" />
                                <div className="h-3 w-40 bg-muted rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    </div>
);

export default function AFKPage() {
    return (
        <AppLayout>
            <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">
                {/* <div className="flex flex-col gap-2 border-b border-border pb-6">
                    <h1 className="text-3xl font-black text-foreground tracking-tighter flex items-center gap-2 italic uppercase">
                        <Gamepad2 className="text-primary fill-primary/20 w-8 h-8" />
                        AFK MODE
                    </h1>
                    <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest opacity-60">
                        Automated Trading & Agentic Execution
                    </p>
                </div> */}

                <Tabs defaultValue="copy-trading" className="w-full">
                    <TabsList className="bg-muted/50 p-1 border border-border/50 rounded-xl h-auto mb-6">
                        <TabsTrigger
                            value="copy-trading"
                            className="px-8 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs font-bold uppercase tracking-widest flex items-center gap-2"
                        >
                            <TrendingUp className="w-3.5 h-3.5" />
                            Copy Trading
                        </TabsTrigger>
                        <TabsTrigger
                            value="agentic"
                            className="px-8 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs font-bold uppercase tracking-widest flex items-center gap-2"
                        >
                            <Bot className="w-3.5 h-3.5" />
                            Agentic Trading
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="copy-trading" className="focus-visible:outline-none">
                        <CopyTradingTab />
                    </TabsContent>

                    <TabsContent value="agentic" className="focus-visible:outline-none">
                        <AgenticTradingTab />
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
