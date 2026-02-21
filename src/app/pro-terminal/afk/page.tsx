'use client';

import React from 'react';
import AppLayout from '@/components/layout/app-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Bot,
    Activity,
    TrendingUp,
    Settings,
    GitBranch,
    Clock,
    Shield,
    Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlobalSettingsCard } from './components/GlobalSettingsCard';
import { KolClusterCard } from './components/KolClusterCard';
import { TradeFiltersCard } from './components/TradeFiltersCard';
import { StrategyConfigCard } from './components/StrategyConfigCard';
import { RiskManagementCard } from './components/RiskManagementCard';
import { AfkTerminal } from './components/AfkTerminal';

import { TradingHoursCard } from './components/TradingHoursCard';
import { AgentTerminal } from './components/AgentTerminal';

// Reusable configuration tabs component
const ConfigTabs = ({ mode = 'copy' }: { mode?: 'copy' | 'agent' }) => (
    <Tabs defaultValue="global" className="w-full">
        <TabsList className={cn(
            "grid w-full bg-muted/20 p-1 rounded-xl h-auto border border-border/40 mb-6",
            mode === 'agent' ? "grid-cols-5" : "grid-cols-4"
        )}>
            <TabsTrigger value="global" className="py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest gap-1 sm:gap-2 px-1 sm:px-2">
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden 2xl:inline">Global</span>
            </TabsTrigger>
            {mode === 'agent' && (
                <TabsTrigger value="strategy" className="py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest gap-1 sm:gap-2 px-1 sm:px-2">
                    <GitBranch className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden 2xl:inline">Strategy</span>
                </TabsTrigger>
            )}
            <TabsTrigger value="hours" className="py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest gap-1 sm:gap-2 px-1 sm:px-2">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden 2xl:inline">Hours</span>
            </TabsTrigger>
            <TabsTrigger value="risk" className="py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest gap-1 sm:gap-2 px-1 sm:px-2">
                <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden 2xl:inline">Risk</span>
            </TabsTrigger>
            <TabsTrigger value="filters" className="py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest gap-1 sm:gap-2 px-1 sm:px-2">
                <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden 2xl:inline">Filters</span>
            </TabsTrigger>
        </TabsList>
        <div className="relative w-full h-full min-h-[500px]">
            <TabsContent value="global" className="focus-visible:outline-none ring-0 mt-0"><GlobalSettingsCard mode={mode} /></TabsContent>
            {mode === 'agent' && (
                <TabsContent value="strategy" className="focus-visible:outline-none ring-0 mt-0"><StrategyConfigCard mode={mode} /></TabsContent>
            )}
            <TabsContent value="hours" className="focus-visible:outline-none ring-0 mt-0"><TradingHoursCard mode={mode} /></TabsContent>
            <TabsContent value="risk" className="focus-visible:outline-none ring-0 mt-0"><RiskManagementCard mode={mode} /></TabsContent>
            <TabsContent value="filters" className="focus-visible:outline-none ring-0 mt-0"><TradeFiltersCard mode={mode} /></TabsContent>
        </div>
    </Tabs>
);

const CopyTradingTab = () => (
    <>
        {/* Desktop View */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
                <AfkTerminal />
                <KolClusterCard />
            </div>

            <div className="lg:col-span-4 space-y-6 h-full">
                <ConfigTabs mode="copy" />
            </div>
        </div>

        {/* Mobile View: Inner Tabs */}
        <div className="lg:hidden -mx-2">
            <Tabs defaultValue="terminal" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/30 p-1 rounded-xl h-auto border border-border/50 mb-6">
                    <TabsTrigger value="terminal" className="py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest gap-2 px-2">
                        <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Terminal
                    </TabsTrigger>
                    <TabsTrigger value="config" className="py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest gap-2 px-2">
                        <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Config
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="terminal" className="space-y-6 focus-visible:outline-none ring-0">
                    <AfkTerminal />
                    <KolClusterCard />
                </TabsContent>

                <TabsContent value="config" className="space-y-6 focus-visible:outline-none ring-0">
                    <ConfigTabs mode="copy" />
                </TabsContent>
            </Tabs>
        </div>
    </>
);

const AgenticTradingTab = () => (
    <div className="space-y-6">
        {/* Desktop View */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
                <AgentTerminal />
            </div>
            <div className="lg:col-span-4 space-y-6 h-full">
                <ConfigTabs mode="agent" />
            </div>
        </div>

        {/* Mobile View: Inner Tabs */}
        <div className="lg:hidden -mx-2">
            <Tabs defaultValue="terminal" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/30 p-1 rounded-xl h-auto border border-border/50 mb-6">
                    <TabsTrigger value="terminal" className="py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest gap-2 px-2">
                        <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Terminal
                    </TabsTrigger>
                    <TabsTrigger value="config" className="py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest gap-2 px-2">
                        <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Config
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="terminal" className="space-y-6 focus-visible:outline-none ring-0">
                    <AgentTerminal />
                </TabsContent>

                <TabsContent value="config" className="space-y-6 focus-visible:outline-none ring-0">
                    <ConfigTabs mode="agent" />
                </TabsContent>
            </Tabs>
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
                            className="px-4 sm:px-8 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs font-bold uppercase tracking-widest flex items-center gap-2"
                        >
                            <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            Copy Trade
                        </TabsTrigger>
                        <TabsTrigger
                            value="agentic"
                            className="px-4 sm:px-8 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs font-bold uppercase tracking-widest flex items-center gap-2"
                        >
                            <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            Agentic
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
