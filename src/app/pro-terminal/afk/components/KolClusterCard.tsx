'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { useSubscriptions, useTradingStore } from '@/stores/use-trading-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
    Layers,
    User,
    Settings2,
    Zap,
    Clock,
    ChevronDown,
    ChevronUp,
    ShieldCheck,
    AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserSubscription } from '@/types';

export function KolClusterCard() {
    const { subscriptions, updateSubscriptionSettings, bulkUpdateSubscriptionSettings } = useSubscriptions();
    const { tradingSettings, updateTradingSettings, saveTradingSettings } = useTradingStore();
    const [expandedKols, setExpandedKols] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    const globalThreshold = tradingSettings?.minKOLConvergence ?? 1;
    const globalWindow = tradingSettings?.convergenceWindowMinutes ?? 60;

    const handleUpdateGlobalThreshold = (val: string) => {
        const num = parseInt(val);
        if (isNaN(num)) return;
        updateTradingSettings({ minKOLConvergence: num });
    };

    const handleUpdateGlobalWindow = (val: string) => {
        const num = parseInt(val);
        if (isNaN(num)) return;
        updateTradingSettings({ convergenceWindowMinutes: num });
    };

    const toggleExpand = (kolWallet: string) => {
        const newSet = new Set(expandedKols);
        if (newSet.has(kolWallet)) newSet.delete(kolWallet);
        else newSet.add(kolWallet);
        setExpandedKols(newSet);
    };

    const handleUpdateKolSettings = async (kolWallet: string, updates: Partial<UserSubscription>) => {
        try {
            await updateSubscriptionSettings(kolWallet, updates as any);
        } catch (error) {
            console.error('Failed to update KOL settings:', error);
        }
    };

    const handleBulkSave = async () => {
        setIsSaving(true);
        try {
            const updates = subscriptions.map(sub => ({
                kolWallet: sub.kolWallet,
                minAmount: sub.minAmount,
                maxAmount: sub.maxAmount,
                isActive: sub.isActive,
                type: sub.type,
                settings: sub.settings,
                watchConfig: sub.watchConfig
            }));
            await bulkUpdateSubscriptionSettings(updates as any);
        } catch (error) {
            console.error('Bulk update failed:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="relative p-6 bg-card/40 border-border/50 backdrop-blur-md overflow-hidden shadow-2xl shadow-black/40 rounded-2xl">
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <Layers className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg md:text-xl font-bold text-foreground italic uppercase tracking-tight leading-tight">KOL Cluster Dashboard</h2>
                        <p className="text-[9px] md:text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">Manage your copy trading clusters</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:gap-4 bg-muted/20 p-2 rounded-xl border border-border/30">
                    <div className="flex items-center gap-2 px-2 md:px-3">
                        <Settings2 className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Thresh</span>
                        <Input
                            type="number"
                            value={globalThreshold}
                            onChange={(e) => handleUpdateGlobalThreshold(e.target.value)}
                            onBlur={() => saveTradingSettings()}
                            className="w-10 md:w-12 h-7 md:h-8 text-[10px] font-bold p-1 text-center !bg-zinc-950 border-border/20 focus:ring-primary/30 !text-white"
                        />
                    </div>
                    <div className="w-px h-5 md:h-6 bg-border/30" />
                    <div className="flex items-center gap-2 px-2 md:px-3">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Wind</span>
                        <Input
                            type="number"
                            value={globalWindow}
                            onChange={(e) => handleUpdateGlobalWindow(e.target.value)}
                            onBlur={() => saveTradingSettings()}
                            className="w-12 md:w-16 h-7 md:h-8 text-[10px] font-bold p-1 text-center !bg-zinc-950 border-border/20 focus:ring-primary/30 !text-white"
                        />
                    </div>
                </div>
            </div>

            <p className="text-[10px] text-muted-foreground/60 font-medium mb-6 uppercase tracking-wider bg-primary/5 p-3 rounded-xl border border-primary/10">
                <span className="text-primary font-black">Note:</span> The Threshold applies globally to all KOLs unless <span className="text-foreground font-bold">"Instant Execution"</span> is enabled for a specific KOL below.
            </p>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {subscriptions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border/30 rounded-2xl bg-muted/10">
                        <Layers className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground opacity-40">No Subscriptions Found</p>
                        <p className="text-[10px] text-muted-foreground mt-2 text-center uppercase tracking-wider">Subscribe to KOLs first to manage them in AFK Mode</p>
                    </div>
                ) : (
                    subscriptions.map((sub) => (
                        <div
                            key={sub.kolWallet}
                            className={cn(
                                "group border rounded-2xl transition-all duration-300",
                                sub.isActive ? "bg-muted/10 border-border/30 shadow-sm" : "bg-muted/5 border-border/10 opacity-60"
                            )}
                        >
                            {/* KOL Header */}
                            <div className="p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                    <div className="relative shrink-0">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center border border-border/30 overflow-hidden shadow-inner">
                                            <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                        </div>
                                        {sub.isActive && (
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border border-background flex items-center justify-center">
                                                <Zap className="w-1.5 h-1.5 text-white fill-current" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                            <h3 className="font-bold text-xs sm:text-sm truncate uppercase tracking-tight text-foreground leading-none">{sub.label || 'KOL'}</h3>
                                            <div className="flex items-center gap-1 bg-zinc-950/50 p-0.5 rounded-md border border-border/20 w-fit">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUpdateKolSettings(sub.kolWallet, { type: 'trade' });
                                                    }}
                                                    className={cn(
                                                        "text-[8px] px-1 py-0.5 rounded transition-all font-black uppercase tracking-tighter",
                                                        sub.type === 'trade' ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                                                    )}
                                                >
                                                    T
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUpdateKolSettings(sub.kolWallet, { type: 'watch' });
                                                    }}
                                                    className={cn(
                                                        "text-[8px] px-1 py-0.5 rounded transition-all font-black uppercase tracking-tighter",
                                                        sub.type === 'watch' ? "bg-blue-500 text-white" : "text-muted-foreground"
                                                    )}
                                                >
                                                    W
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[9px] text-muted-foreground font-bold truncate font-mono opacity-60">
                                            {sub.kolWallet.slice(0, 4)}...{sub.kolWallet.slice(-4)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                    <Switch
                                        checked={sub.isActive}
                                        onCheckedChange={(checked) => handleUpdateKolSettings(sub.kolWallet, { isActive: checked })}
                                        className="scale-75 sm:scale-100 data-[state=checked]:bg-primary"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-muted/50 rounded-lg transition-colors"
                                        onClick={() => toggleExpand(sub.kolWallet)}
                                    >
                                        {expandedKols.has(sub.kolWallet) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </Button>
                                </div>
                            </div>

                            {/* Expanded Settings */}
                            {expandedKols.has(sub.kolWallet) && (
                                <div className="px-4 pb-4 pt-1 border-t border-border/10 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Trade Config</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <span className="text-[8px] font-bold text-muted-foreground/50 uppercase">Min SOL</span>
                                                <Input
                                                    type="number"
                                                    value={sub.minAmount}
                                                    onChange={(e) => handleUpdateKolSettings(sub.kolWallet, { minAmount: parseFloat(e.target.value) })}
                                                    className="h-8 text-[10px] font-bold !bg-zinc-950 border-border/20 focus:ring-primary/20 !text-white"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[8px] font-bold text-muted-foreground/50 uppercase">Max SOL</span>
                                                <Input
                                                    type="number"
                                                    value={sub.maxAmount}
                                                    onChange={(e) => handleUpdateKolSettings(sub.kolWallet, { maxAmount: parseFloat(e.target.value) })}
                                                    className="h-8 text-[10px] font-bold !bg-zinc-950 border-border/20 focus:ring-primary/20 !text-white"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Instant Execution</label>
                                            <Switch
                                                checked={sub.settings?.minKOLConvergence === 1}
                                                onCheckedChange={(checked) => handleUpdateKolSettings(sub.kolWallet, {
                                                    settings: { ...sub.settings, minKOLConvergence: checked ? 1 : undefined }
                                                })}
                                                className="scale-75 origin-right data-[state=checked]:bg-primary"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                sub.settings?.minKOLConvergence === 1 ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
                                            )} />
                                            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tight">
                                                {sub.settings?.minKOLConvergence === 1 ? 'Bypassing Cluster' : 'Obeying Cluster Rules'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-end gap-2">
                                        <div className="flex items-center justify-between p-2 bg-muted/10 rounded-xl border border-border/10 transition-colors hover:bg-muted/20">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="w-3 h-3 text-green-500" />
                                                <span className="text-[9px] font-bold uppercase tracking-wider">Slippage Protection</span>
                                            </div>
                                            <Switch
                                                checked={!!sub.settings?.enableSlippageProtection}
                                                className="scale-75 origin-right data-[state=checked]:bg-green-500"
                                                onCheckedChange={(checked) => handleUpdateKolSettings(sub.kolWallet, {
                                                    settings: { ...sub.settings, enableSlippageProtection: checked }
                                                })}
                                            />
                                        </div>
                                        <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase tracking-widest w-full border-border/30 hover:bg-primary/5 hover:text-primary transition-all">
                                            More Settings
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="mt-8 pt-6 border-t border-border/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <p className="text-[9px] font-black uppercase tracking-wider text-orange-500/70 leading-tight">
                        Warning: High convergence window (60m+) may increase false signals.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="text-[10px] font-bold uppercase tracking-widest border-border/30 h-10 px-6 hover:bg-muted/30">
                        Discard Changes
                    </Button>
                    <Button
                        onClick={handleBulkSave}
                        disabled={isSaving}
                        className="text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground h-10 px-8 shadow-xl shadow-primary/10 hover:shadow-primary/20 hover:-translate-y-0.5 transition-all active:scale-95"
                    >
                        {isSaving ? 'Saving...' : 'Apply Cluster Settings'}
                    </Button>
                </div>
            </div>
        </Card >
    );
}
