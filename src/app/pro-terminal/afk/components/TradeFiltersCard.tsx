'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useTradingStore } from '@/stores/use-trading-store';
import {
    Activity,
    DollarSign,
    Box,
    ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function TradeFiltersCard() {
    const { tradingSettings, updateTradingSettings, saveTradingSettings } = useTradingStore();

    // Safety destructuring
    const {
        enableMarketCapFilter = false,
        minMarketCap = 50000,
        maxMarketCap = 10000000,
        enableLiquidityFilter = false,
        minLiquidity = 10000
    } = tradingSettings || {};

    const handleToggle = async (key: string, val: boolean) => {
        updateTradingSettings({ [key]: val });
        await saveTradingSettings();
    };

    const handleUpdateNum = async (key: string, val: string) => {
        const num = parseFloat(val);
        if (isNaN(num)) return;
        updateTradingSettings({ [key]: num });
    };

    const handleSave = async () => {
        try {
            await saveTradingSettings();
        } catch (error) {
            console.error('Failed to save filters:', error);
        }
    };

    return (
        <Card className="relative p-6 bg-card/40 border-border/50 backdrop-blur-md shadow-2xl shadow-black/40 rounded-2xl overflow-hidden transition-all duration-300">
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />

            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg group">
                        <Activity className="w-5 h-5 text-primary group-hover:animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground italic uppercase tracking-tight">Execution Filters</h2>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">Fine-tune which trades get executed</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Market Cap Filter */}
                <div className="space-y-4 p-5 bg-muted/10 rounded-2xl border border-border/20 group hover:border-primary/20 transition-all">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Box className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-bold uppercase tracking-tight">Market Cap Filter</span>
                        </div>
                        <Switch
                            checked={enableMarketCapFilter}
                            onCheckedChange={(val) => handleToggle('enableMarketCapFilter', val)}
                            className="data-[state=checked]:bg-primary"
                        />
                    </div>
                    <div className={cn("grid grid-cols-2 gap-4 transition-all duration-300", !enableMarketCapFilter && "opacity-40 pointer-events-none grayscale")}>
                        <div className="space-y-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">Min ($)</span>
                            <Input
                                type="number"
                                value={minMarketCap}
                                onChange={(e) => handleUpdateNum('minMarketCap', e.target.value)}
                                onBlur={handleSave}
                                className="h-10 text-xs font-bold !bg-zinc-950 border-border/20 rounded-xl focus:ring-primary/20 !text-white"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">Max ($)</span>
                            <Input
                                type="number"
                                value={maxMarketCap}
                                onChange={(e) => handleUpdateNum('maxMarketCap', e.target.value)}
                                onBlur={handleSave}
                                className="h-10 text-xs font-bold !bg-zinc-950 border-border/20 rounded-xl focus:ring-primary/20 !text-white"
                            />
                        </div>
                    </div>
                </div>

                {/* Liquidity Filter */}
                <div className="space-y-4 p-5 bg-muted/10 rounded-2xl border border-border/20 group hover:border-primary/20 transition-all">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <DollarSign className="w-4 h-4 text-green-500" />
                            <span className="text-xs font-bold uppercase tracking-tight">Liquidity Filter</span>
                        </div>
                        <Switch
                            checked={enableLiquidityFilter}
                            onCheckedChange={(val) => handleToggle('enableLiquidityFilter', val)}
                            className="data-[state=checked]:bg-primary"
                        />
                    </div>
                    <div className={cn("space-y-1.5 transition-all duration-300", !enableLiquidityFilter && "opacity-40 pointer-events-none grayscale")}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">Min Liquidity ($)</span>
                        <div className="flex items-center gap-3">
                            <Input
                                type="number"
                                value={minLiquidity}
                                onChange={(e) => handleUpdateNum('minLiquidity', e.target.value)}
                                onBlur={handleSave}
                                className="h-10 text-xs font-bold !bg-zinc-950 border-border/20 rounded-xl focus:ring-primary/20 !text-white"
                            />
                            <Badge variant="secondary" className="h-10 px-3 bg-muted/20 border-border/20 text-[10px] font-black uppercase">Strict</Badge>
                        </div>
                    </div>
                </div>

                {/* Warning Footer */}
                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl flex items-start gap-3">
                    <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-500/80 mb-1">Global Blacklist Active</p>
                        <p className="text-[9px] text-muted-foreground uppercase font-bold leading-tight">
                            Tokens in your global blacklist (located in main settings) are always excluded from AFK execution.
                        </p>
                    </div>
                </div>
            </div>
        </Card>
    );
}
