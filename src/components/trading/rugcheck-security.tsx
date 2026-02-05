'use client';

import React, { useState, useEffect } from 'react';
import { RugCheckService, RugCheckSecurityData } from '@/services/rug-check.service';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, Shield, Copy, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/stores/use-ui-store';

interface RugCheckSecurityProps {
    mint: string;
    className?: string;
}

const SecurityMetric: React.FC<{
    label: string;
    value: string | number;
    icon: React.ReactNode;
    status?: 'good' | 'warning' | 'danger';
}> = ({ label, value, icon, status }) => (
    <div className="bg-muted/30 border border-border rounded-xl p-3 flex flex-col items-center justify-center text-center space-y-1">
        <div className={cn(
            "p-1.5 rounded-full mb-1",
            status === 'good' ? "bg-green-500/10 text-green-500" :
                status === 'warning' ? "bg-yellow-500/10 text-yellow-500" :
                    status === 'danger' ? "bg-red-500/10 text-red-500" :
                        "bg-muted text-muted-foreground"
        )}>
            {icon}
        </div>
        <div className={cn(
            "text-sm font-bold",
            status === 'good' ? "text-green-500" :
                status === 'warning' ? "text-yellow-500" :
                    status === 'danger' ? "text-red-500" :
                        "text-foreground"
        )}>
            {value}
        </div>
        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
            {label}
        </div>
    </div>
);

export const RugCheckSecurity: React.FC<RugCheckSecurityProps> = ({ mint, className }) => {
    const [data, setData] = useState<RugCheckSecurityData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotifications();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await RugCheckService.getTokenSecurity(mint);
                setData(res.data);
            } catch (e) {
                console.error('Failed to fetch RugCheck data:', e);
                setData(null);
            } finally {
                setIsLoading(false);
            }
        };

        if (mint) fetchData();
    }, [mint]);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        showNotification('Copied', `${label} copied to clipboard`, 'success');
    };

    if (isLoading) {
        return (
            <Card className={cn("bg-card/50 border-border", className)}>
                <CardContent className="p-6">
                    <div className="grid grid-cols-3 gap-3">
                        {[...Array(9)].map((_, i) => (
                            <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!data) return null;

    return (
        <Card className={cn("bg-card/50 border-border overflow-hidden", className)}>
            <CardHeader className="p-4 border-b border-border bg-muted/20">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        TOKEN DATA & SECURITY
                    </CardTitle>
                    <div className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        data.status === 'good' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                    )}>
                        {data.status}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                {/* Security Grid */}
                <div className="grid grid-cols-3 gap-3">
                    <SecurityMetric
                        label="Top 10 H."
                        value={`${data.distribution.top10HoldersPercentage.toFixed(2)}%`}
                        icon={<Users className="w-3.5 h-3.5" />}
                        status={data.distribution.top10HoldersPercentage > 50 ? 'danger' : 'good'}
                    />
                    <SecurityMetric
                        label="Dev holding"
                        value={`${data.distribution.devHoldingPercentage.toFixed(2)}%`}
                        icon={<Shield className="w-3.5 h-3.5" />}
                        status={data.distribution.devHoldingPercentage > 10 ? 'warning' : 'good'}
                    />
                    <SecurityMetric
                        label="Snipers"
                        value={data.distribution.snipersCount}
                        icon={<Users className="w-3.5 h-3.5" />}
                        status={data.distribution.snipersCount > 5 ? 'danger' : 'good'}
                    />
                    <SecurityMetric
                        label="Insiders H."
                        value={`${data.distribution.insidersPercentage.toFixed(2)}%`}
                        icon={<Users className="w-3.5 h-3.5" />}
                        status={data.distribution.insidersPercentage > 20 ? 'warning' : 'good'}
                    />
                    <SecurityMetric
                        label="Bundles H."
                        value={`${data.distribution.bundlesPercentage.toFixed(2)}%`}
                        icon={<Shield className="w-3.5 h-3.5" />}
                        status={data.distribution.bundlesPercentage > 5 ? 'danger' : 'good'}
                    />
                    <SecurityMetric
                        label="Fresh buys"
                        value={data.distribution.freshBuysCount}
                        icon={<Users className="w-3.5 h-3.5" />}
                        status="good"
                    />
                    <SecurityMetric
                        label="Fresh holding"
                        value={`${data.distribution.freshHoldingsPercentage.toFixed(2)}%`}
                        icon={<Users className="w-3.5 h-3.5" />}
                        status="good"
                    />
                    <SecurityMetric
                        label="Mint Auth."
                        value={data.authorities.mintAuthDisabled ? "No" : "Yes"}
                        icon={<Shield className="w-3.5 h-3.5" />}
                        status={data.authorities.mintAuthDisabled ? 'good' : 'danger'}
                    />
                    <SecurityMetric
                        label="Freeze Auth."
                        value={data.authorities.freezeAuthDisabled ? "No" : "Yes"}
                        icon={<Shield className="w-3.5 h-3.5" />}
                        status={data.authorities.freezeAuthDisabled ? 'good' : 'danger'}
                    />
                </div>

                {/* Address Fields */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg border border-border group">
                        <div className="flex items-center space-x-2 truncate">
                            <span className="text-[10px] font-bold text-muted-foreground w-6">CA:</span>
                            <span className="text-[11px] font-mono truncate">{data.mint}</span>
                        </div>
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => copyToClipboard(data.mint, 'CA')}
                                className="p-1 hover:bg-muted rounded"
                            >
                                <Copy className="w-3 h-3 text-muted-foreground" />
                            </button>
                            <button className="p-1 hover:bg-muted rounded text-muted-foreground">
                                <Search className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
