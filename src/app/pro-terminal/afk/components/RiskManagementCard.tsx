'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useTradingStore } from '@/stores/use-trading-store';
import {
    TrendingUp,
    TrendingDown,
    Timer,
    Zap,
    ShieldCheck,
    Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function RiskManagementCard() {
    const { tradingSettings, updateTradingSettings, saveTradingSettings } = useTradingStore();

    const {
        useWatchConfig = false,
        watchConfig = {
            takeProfitPercentage: 50,
            stopLossPercentage: 20,
            enableTrailingStop: false,
            trailingPercentage: 5,
            maxHoldTimeMinutes: 60
        }
    } = tradingSettings || {};

    const handleToggleMaster = async (val: boolean) => {
        updateTradingSettings({ useWatchConfig: val });
        await saveTradingSettings();
    };

    const handleUpdateWatchConfig = async (updates: Partial<typeof watchConfig>) => {
        updateTradingSettings({
            watchConfig: { ...watchConfig, ...updates }
        });
    };

    const handleSave = async () => {
        try {
            await saveTradingSettings();
        } catch (error) {
            console.error('Failed to save risk settings:', error);
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
                        useWatchConfig ? "bg-primary/20 shadow-primary/10" : "bg-muted/10 shadow-black/20"
                    )}>
                        <ShieldCheck className={cn(
                            "w-5 h-5 transition-colors duration-500",
                            useWatchConfig ? "text-primary" : "text-muted-foreground"
                        )} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground italic uppercase tracking-tight">Exit Strategy</h2>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">Risk management & profit protection</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest transition-colors",
                        useWatchConfig ? "text-primary" : "text-muted-foreground"
                    )}>
                        {useWatchConfig ? 'Active' : 'Disabled'}
                    </span>
                    <Switch
                        checked={useWatchConfig}
                        onCheckedChange={handleToggleMaster}
                        className="data-[state=checked]:bg-primary transition-all shadow-lg"
                    />
                </div>
            </div>

            <div className={cn("space-y-6 transition-all duration-300", !useWatchConfig && "opacity-40 pointer-events-none grayscale")}>
                {/* Take Profit & Stop Loss */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3 p-4 bg-muted/10 rounded-2xl border border-border/20 group hover:border-green-500/30 transition-all">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Take Profit</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Input
                                type="number"
                                value={watchConfig.takeProfitPercentage}
                                onChange={(e) => handleUpdateWatchConfig({ takeProfitPercentage: parseFloat(e.target.value) })}
                                onBlur={handleSave}
                                className="h-10 text-sm font-bold !bg-zinc-950 border-border/20 rounded-xl focus:ring-primary/20 !text-white"
                            />
                            <span className="text-xs font-bold text-muted-foreground">%</span>
                        </div>
                    </div>

                    <div className="space-y-3 p-4 bg-muted/10 rounded-2xl border border-border/20 group hover:border-red-500/30 transition-all">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Stop Loss</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Input
                                type="number"
                                value={watchConfig.stopLossPercentage}
                                onChange={(e) => handleUpdateWatchConfig({ stopLossPercentage: parseFloat(e.target.value) })}
                                onBlur={handleSave}
                                className="h-10 text-sm font-bold !bg-zinc-950 border-border/20 rounded-xl focus:ring-primary/20 !text-white"
                            />
                            <span className="text-xs font-bold text-muted-foreground">%</span>
                        </div>
                    </div>
                </div>

                {/* Trailing Stop */}
                <div className="p-4 bg-muted/10 rounded-2xl border border-border/20 group hover:border-blue-500/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Trailing Stop</span>
                        </div>
                        <Switch
                            checked={watchConfig.enableTrailingStop}
                            onCheckedChange={(val) => {
                                handleUpdateWatchConfig({ enableTrailingStop: val });
                                handleSave();
                            }}
                            className="scale-75 data-[state=checked]:bg-blue-500"
                        />
                    </div>
                    <div className={cn("flex items-center gap-3 transition-opacity", !watchConfig.enableTrailingStop && "opacity-40 grayscale pointer-events-none")}>
                        <Input
                            type="number"
                            value={watchConfig.trailingPercentage}
                            onChange={(e) => handleUpdateWatchConfig({ trailingPercentage: parseFloat(e.target.value) })}
                            onBlur={handleSave}
                            className="h-10 text-sm font-bold !bg-zinc-950 border-border/20 rounded-xl focus:ring-primary/20 !text-white"
                        />
                        <span className="text-xs font-bold text-muted-foreground">% distance</span>
                    </div>
                </div>

                {/* Max Hold Time */}
                <div className="p-4 bg-muted/10 rounded-2xl border border-border/20 group hover:border-yellow-500/30 transition-all">
                    <div className="flex items-center gap-2 mb-3">
                        <Timer className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Max Hold Duration</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Input
                            type="number"
                            value={watchConfig.maxHoldTimeMinutes}
                            onChange={(e) => handleUpdateWatchConfig({ maxHoldTimeMinutes: parseInt(e.target.value) })}
                            onBlur={handleSave}
                            className="h-10 text-sm font-bold !bg-zinc-950 border-border/20 rounded-xl focus:ring-primary/20 !text-white"
                        />
                        <span className="text-xs font-bold text-muted-foreground">minutes</span>
                    </div>
                </div>

                {/* Protection Badge */}
                <div className="pt-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
                        <Lock className="w-3 h-3 text-primary" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary/80">Liquidity-Responsive Execution Protected</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}
