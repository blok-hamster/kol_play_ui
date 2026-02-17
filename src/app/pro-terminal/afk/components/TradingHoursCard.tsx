'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useTradingStore } from '@/stores/use-trading-store';
import {
    Clock,
    Globe,
    Calendar,
    Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function TradingHoursCard({ mode = 'copy' }: { mode?: 'copy' | 'agent' }) {
    const { tradingSettings, updateTradingSettings, saveTradingSettings } = useTradingStore();

    const currentSettings = mode === 'agent' ? tradingSettings?.agentSettings : tradingSettings;

    const {
        enableTimeRestrictions = false,
        tradingHours = {
            start: '00:00',
            end: '23:59',
            timezone: 'UTC'
        }
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

    const handleToggleRestrictions = async (checked: boolean) => {
        handleUpdate({ enableTimeRestrictions: checked });
        await saveTradingSettings();
    };

    const handleUpdateStartTime = (val: string) => {
        handleUpdate({
            tradingHours: { ...tradingHours, start: val }
        });
    };

    const handleUpdateEndTime = (val: string) => {
        handleUpdate({
            tradingHours: { ...tradingHours, end: val }
        });
    };

    const handleUpdateTimezone = (val: string) => {
        handleUpdate({
            tradingHours: { ...tradingHours, timezone: val }
        });
    };

    const handleSave = async () => {
        try {
            await saveTradingSettings();
        } catch (error) {
            console.error('Failed to save trading hours:', error);
        }
    };

    return (
        <Card className="relative p-6 bg-card/40 border-border/50 backdrop-blur-md shadow-2xl shadow-black/40 rounded-2xl overflow-hidden transition-all duration-300">
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50" />

            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-lg transition-all duration-500 shadow-lg",
                        enableTimeRestrictions ? "bg-cyan-500/20 shadow-cyan-500/10" : "bg-muted/10 shadow-black/20"
                    )}>
                        <Clock className={cn(
                            "w-5 h-5 transition-colors duration-500",
                            enableTimeRestrictions ? "text-cyan-500" : "text-muted-foreground"
                        )} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground italic uppercase tracking-tight">Trading Window</h2>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">Restrict execution to specific hours</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest transition-colors",
                        enableTimeRestrictions ? "text-cyan-500" : "text-muted-foreground"
                    )}>
                        {enableTimeRestrictions ? 'Window Active' : '24/7 Enabled'}
                    </span>
                    <Switch
                        checked={enableTimeRestrictions}
                        onCheckedChange={handleToggleRestrictions}
                        className="data-[state=checked]:bg-cyan-500 transition-all shadow-lg"
                    />
                </div>
            </div>

            <div className={cn(
                "grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-500",
                !enableTimeRestrictions && "opacity-40 grayscale pointer-events-none"
            )}>
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        <Timer className="w-3 h-3" />
                        Start Time
                    </label>
                    <Input
                        type="time"
                        value={tradingHours.start}
                        onChange={(e) => handleUpdateStartTime(e.target.value)}
                        onBlur={handleSave}
                        className="w-full h-12 px-4 font-bold !bg-zinc-950 border-border/20 focus:ring-cyan-500/20 rounded-xl !text-white"
                    />
                </div>

                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        <Calendar className="w-3 h-3" />
                        End Time
                    </label>
                    <Input
                        type="time"
                        value={tradingHours.end}
                        onChange={(e) => handleUpdateEndTime(e.target.value)}
                        onBlur={handleSave}
                        className="w-full h-12 px-4 font-bold !bg-zinc-950 border-border/20 focus:ring-cyan-500/20 rounded-xl !text-white"
                    />
                </div>

                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        <Globe className="w-3 h-3" />
                        Timezone
                    </label>
                    <Input
                        type="text"
                        placeholder="UTC, EST, etc"
                        value={tradingHours.timezone}
                        onChange={(e) => handleUpdateTimezone(e.target.value)}
                        onBlur={handleSave}
                        className="w-full h-12 px-4 font-bold !bg-zinc-950 border-border/20 focus:ring-cyan-500/20 rounded-xl !text-white"
                    />
                </div>
            </div>

            {enableTimeRestrictions && (
                <div className="mt-6 p-3 bg-cyan-500/5 rounded-xl border border-cyan-500/10 flex items-start gap-3">
                    <div className="p-1.5 bg-cyan-500/10 rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-cyan-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Active Schedule</p>
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-tight">
                            Trades will only execute between {tradingHours.start} and {tradingHours.end} {tradingHours.timezone}
                        </p>
                    </div>
                </div>
            )}
        </Card>
    );
}
