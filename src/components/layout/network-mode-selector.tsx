'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Globe, Zap, Shield } from 'lucide-react';
import { useTradingStore } from '@/stores/use-trading-store';
import { useUserStore } from '@/stores/use-user-store';
import { SettingsService } from '@/services/settings.service';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/use-ui-store';

interface NetworkModeSelectorProps {
    className?: string;
}

export const NetworkModeSelector: React.FC<NetworkModeSelectorProps> = ({ className }) => {
    const router = useRouter();
    const pathname = usePathname();
    const [network, setNetwork] = React.useState('solana');
    const { isPaperTrading, setPaperTrading } = useTradingStore();
    const { isProMode, setProMode, isModeSwitching, setModeSwitching } = useUIStore();

    // Sync mode with URL - Disabled during active transitions to prevent state loops
    React.useEffect(() => {
        if (isModeSwitching) return;

        if (pathname.startsWith('/pro-terminal')) {
            if (!isProMode) setProMode(true);
        } else if (pathname === '/agent' || pathname === '/') {
            if (isProMode) setProMode(false);
        }
    }, [pathname, isProMode, setProMode, isModeSwitching]);

    const handleModeChange = (val: string) => {
        console.log(`[ModeSelector] Clicked: ${val}`);

        const targetMode = val === 'pro';
        const targetPath = targetMode ? '/pro-terminal' : '/kol-trades';

        // Start high-fidelity loading with target mode context
        setModeSwitching(true, targetMode ? 'pro' : 'lite');

        // Brief delay to show transition animation before navigation
        setTimeout(() => {
            setProMode(targetMode);
            router.push(targetPath);

            // Allow components to mount before hiding loading
            setTimeout(() => {
                setModeSwitching(false);
            }, 1800);
        }, 400);
    };

    return (
        <div className={cn(
            "flex items-center space-x-2 sm:space-x-3 bg-muted/50 p-1 rounded-xl backdrop-blur-md border border-border/50 shadow-sm",
            className
        )}>
            {/* Network Selector */}
            <div className="flex items-center">
                <Select value={network} onValueChange={setNetwork}>
                    <SelectTrigger className="h-8 w-[100px] sm:w-[140px] bg-transparent border-none shadow-none hover:bg-muted/80 transition-colors focus:ring-0 px-2 sm:px-3">
                        <div className="flex items-center space-x-2">
                            <Globe className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            <SelectValue placeholder="Network" />
                        </div>
                    </SelectTrigger>
                    <SelectContent className="bg-background/95 backdrop-blur-xl border-border shadow-2xl min-w-[160px]">
                        <SelectItem value="solana" className="cursor-pointer">
                            <div className="flex items-center space-x-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                <span className="font-semibold">Solana</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="bsc" disabled className="opacity-50 grayscale cursor-not-allowed">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center space-x-2">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                    <span>BSC</span>
                                </div>
                                <Badge variant="outline" className="text-[10px] py-0 h-4 ml-2 border-muted-foreground/30 text-muted-foreground uppercase font-bold tracking-tighter">beta</Badge>
                            </div>
                        </SelectItem>
                        <SelectItem value="base" disabled className="opacity-50 grayscale cursor-not-allowed">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center space-x-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span>Base</span>
                                </div>
                                <Badge variant="outline" className="text-[10px] py-0 h-4 ml-2 border-muted-foreground/30 text-muted-foreground uppercase font-bold tracking-tighter">beta</Badge>
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="h-4 w-px bg-border/50 flex-shrink-0" />

            {/* Mode Selector */}
            <div className="flex items-center">
                <Select value={isProMode ? 'pro' : 'lite'} onValueChange={handleModeChange}>
                    <SelectTrigger className="h-8 w-[85px] sm:w-[120px] bg-transparent border-none shadow-none hover:bg-muted/80 transition-colors focus:ring-0 px-2 sm:px-3">
                        <div className="flex items-center space-x-2">
                            {!isProMode ? (
                                <Shield className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                            ) : (
                                <Zap className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400/20 flex-shrink-0" />
                            )}
                            <SelectValue placeholder="Mode" />
                        </div>
                    </SelectTrigger>
                    <SelectContent className="bg-background/95 backdrop-blur-xl border-border shadow-2xl min-w-[140px]">
                        <SelectItem value="lite" className="cursor-pointer">
                            <div className="flex items-center space-x-2">
                                <Shield className="h-3.5 w-3.5 text-blue-400" />
                                <span className="font-semibold">Lite</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="pro" className="cursor-pointer group">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center space-x-2">
                                    <Zap className="h-3.5 w-3.5 text-yellow-500 group-hover:animate-pulse" />
                                    <span className="font-semibold bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent">Pro</span>
                                </div>
                                <Badge variant="secondary" className="text-[10px] py-0 h-4 ml-2 bg-yellow-500/10 text-yellow-600 border-none uppercase font-bold">New</Badge>
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="h-4 w-px bg-border/50 flex-shrink-0" />


            {/* Paper Trading Toggle */}
            <div className="flex items-center space-x-2 px-1 flex-shrink-0">
                <Switch
                    checked={isPaperTrading}
                    onCheckedChange={(checked) => {
                        setPaperTrading(checked);
                        // Sync with backend if authenticated
                        if (useUserStore.getState().isAuthenticated) {
                            SettingsService.updateUserSettings({
                                tradeConfig: { paperTrading: checked }
                            }).catch(err => console.error('Failed to sync paper trading mode:', err));
                        }
                    }}
                    className="data-[state=checked]:bg-blue-500 scale-90 sm:scale-100"
                />
                <span className={cn(
                    "text-[10px] sm:text-xs font-semibold transition-colors whitespace-nowrap",
                    isPaperTrading ? "text-blue-500" : "text-muted-foreground"
                )}>
                    {isPaperTrading ? 'Paper' : 'Real'}
                </span>
            </div>
        </div>
    );
};
