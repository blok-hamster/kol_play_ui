'use client';

import React, { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useTradingStore } from '@/stores/use-trading-store';
import {
    Zap,
    ShieldCheck,
    Wallet,
    Power
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function GlobalSettingsCard({ mode = 'copy' }: { mode?: 'copy' | 'agent' }) {
    const { tradingSettings, updateTradingSettings, saveTradingSettings, fetchTradingSettings } = useTradingStore();

    // Fetch settings on mount
    useEffect(() => {
        fetchTradingSettings();
    }, [fetchTradingSettings]);

    // Check if tradingSettings exists before destructuring
    const currentSettings = mode === 'agent' ? tradingSettings?.agentSettings : tradingSettings;

    const {
        afkEnabled = false,
        paperTrading = true,
        maxConcurrentTrades = 3,
        slippage = 1.0,
        afkBuyAmount = 0.1
    } = currentSettings || {};

    const handleUpdate = (updates: any) => {
        if (mode === 'agent') {
            updateTradingSettings({
                agentSettings: { ...tradingSettings.agentSettings, ...updates }
            } as any);
        } else {
            updateTradingSettings(updates);
        }
    };

    const handleToggleAfk = async (checked: boolean) => {
        handleUpdate({ afkEnabled: checked });
        await saveTradingSettings();
    };

    const handleTogglePaper = async (checked: boolean) => {
        handleUpdate({ paperTrading: checked });
        await saveTradingSettings();
    };

    const handleUpdateMaxConcurrent = async (val: string) => {
        const num = parseInt(val);
        if (isNaN(num)) return;
        handleUpdate({ maxConcurrentTrades: num });
    };

    const handleUpdateSlippage = async (val: string) => {
        const num = parseFloat(val);
        if (isNaN(num)) return;
        handleUpdate({ slippage: num });
    };

    const handleUpdateBuyAmount = async (val: string) => {
        const num = parseFloat(val);
        if (isNaN(num)) return;
        handleUpdate({ afkBuyAmount: num });
    };

    const handleSaveGlobal = async () => {
        try {
            await saveTradingSettings();
        } catch (error) {
            console.error('Failed to save global settings:', error);
        }
    };

    return (
        <Card className="relative p-6 bg-card/40 border-border/50 backdrop-blur-md shadow-2xl shadow-black/40 rounded-2xl overflow-hidden transition-all duration-300">
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />

            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-lg transition-all duration-500 shadow-lg",
                        afkEnabled ? "bg-primary/20 shadow-primary/10" : "bg-muted/10 shadow-black/20"
                    )}>
                        <Power className={cn(
                            "w-5 h-5 transition-colors duration-500",
                            afkEnabled ? "text-primary" : "text-muted-foreground"
                        )} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground italic uppercase tracking-tight">Master AFK Control</h2>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">Global execution toggle for all clusters</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest transition-colors",
                        afkEnabled ? "text-primary" : "text-muted-foreground"
                    )}>
                        {afkEnabled ? 'System Armed' : 'System Disarmed'}
                    </span>
                    <Switch
                        checked={afkEnabled}
                        onCheckedChange={handleToggleAfk}
                        className="data-[state=checked]:bg-primary transition-all shadow-lg"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between p-4 bg-muted/10 rounded-2xl border border-border/20 hover:bg-muted/20 transition-all group gap-3">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "p-2 rounded-lg transition-all group-hover:bg-purple-500/20",
                                paperTrading ? "bg-purple-500/10" : "bg-muted/10"
                            )}>
                                <ShieldCheck className={cn(
                                    "w-4 h-4 transition-colors",
                                    paperTrading ? "text-purple-500" : "text-muted-foreground"
                                )} />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-tight">Simulation Mode</p>
                                <p className="text-[10px] text-muted-foreground uppercase opacity-60 font-medium">Use Paper Wallet</p>
                            </div>
                        </div>
                        <Switch
                            checked={paperTrading}
                            onCheckedChange={handleTogglePaper}
                            className="data-[state=checked]:bg-purple-500 transition-all shadow-lg"
                        />
                    </div>

                    <div className="flex flex-wrap items-center justify-between p-4 bg-muted/10 rounded-2xl border border-border/20 hover:bg-muted/20 transition-all group gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
                                <Zap className="w-4 h-4 text-yellow-500" />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-tight">Max Concurrent Trades</p>
                                <p className="text-[10px] text-muted-foreground uppercase opacity-60 font-medium">Limit risk exposure</p>
                            </div>
                        </div>
                        <Input
                            type="number"
                            value={maxConcurrentTrades}
                            onChange={(e) => handleUpdateMaxConcurrent(e.target.value)}
                            onBlur={handleSaveGlobal}
                            className="w-16 h-10 text-center font-bold !bg-zinc-950 border-border/20 focus:ring-primary/20 rounded-xl !text-white"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between p-4 bg-muted/10 rounded-2xl border border-border/20 hover:bg-muted/20 transition-all group gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                                <ShieldCheck className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-tight">Default Max Slippage</p>
                                <p className="text-[10px] text-muted-foreground uppercase opacity-60 font-medium">Fallback protection</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={slippage}
                                onChange={(e) => handleUpdateSlippage(e.target.value)}
                                onBlur={handleSaveGlobal}
                                className="w-16 h-10 text-center font-bold !bg-zinc-950 border-border/20 focus:ring-primary/20 rounded-xl !text-white"
                            />
                            <span className="text-xs font-bold text-muted-foreground">%</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between p-4 bg-muted/10 rounded-2xl border border-border/20 hover:bg-muted/20 transition-all group gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                                <Wallet className="w-4 h-4 text-green-500" />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-tight">AFK Buy Amount</p>
                                <p className="text-[10px] text-muted-foreground uppercase opacity-60 font-medium">Standard entry per KOL</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                step="0.1"
                                value={afkBuyAmount}
                                onChange={(e) => handleUpdateBuyAmount(e.target.value)}
                                onBlur={handleSaveGlobal}
                                className="w-16 h-10 text-center font-bold !bg-zinc-950 border-border/20 focus:ring-primary/20 rounded-xl !text-white"
                            />
                            <span className="text-xs font-bold text-muted-foreground">SOL</span>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
