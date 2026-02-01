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
import { Globe, Zap, Shield } from 'lucide-react';

export const NetworkModeSelector: React.FC = () => {
    const router = useRouter();
    const pathname = usePathname();
    const [network, setNetwork] = React.useState('solana');
    const [mode, setMode] = React.useState('lite');

    // Sync mode with URL
    React.useEffect(() => {
        if (pathname === '/pro-coming-soon') {
            setMode('pro');
        } else {
            setMode('lite');
        }
    }, [pathname]);

    const handleModeChange = (val: string) => {
        console.log(`[ModeSelector] Clicked: ${val}`);

        // Immediate state update for visual feedback
        setMode(val);

        if (val === 'pro') {
            console.log('[ModeSelector] Navigating to Pro Coming Soon...');
            router.push('/pro-coming-soon');
        } else {
            console.log('[ModeSelector] Navigating to Lite Mode...');
            router.push('/agent');
        }
    };

    return (
        <div className="flex items-center space-x-3 bg-muted/50 p-1 rounded-xl backdrop-blur-md border border-border/50 shadow-sm">
            {/* Network Selector */}
            <div className="flex items-center">
                <Select value={network} onValueChange={setNetwork}>
                    <SelectTrigger className="h-8 w-[140px] bg-transparent border-none shadow-none hover:bg-muted/80 transition-colors focus:ring-0">
                        <div className="flex items-center space-x-2">
                            <Globe className="h-3.5 w-3.5 text-primary" />
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

            <div className="h-4 w-px bg-border/50" />

            {/* Mode Selector */}
            <div className="flex items-center">
                <Select value={mode} onValueChange={handleModeChange}>
                    <SelectTrigger className="h-8 w-[120px] bg-transparent border-none shadow-none hover:bg-muted/80 transition-colors focus:ring-0">
                        <div className="flex items-center space-x-2">
                            {mode === 'lite' ? (
                                <Shield className="h-3.5 w-3.5 text-blue-400" />
                            ) : (
                                <Zap className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400/20" />
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
        </div>
    );
};
