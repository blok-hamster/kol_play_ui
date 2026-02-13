'use client';

import React, { useState, useEffect } from 'react';
import { TradingService } from '@/services/trading.service';
import { KOLLeaderboardItem } from '@/types';
import { Trophy, TrendingUp, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useKOLStore } from '@/stores/use-kol-store';
import { formatWalletAddress } from '@/lib/utils'; // Assumes formatWalletAddress exists or will be added

export default function FeaturedKols() {
    const [leaderboard, setLeaderboard] = useState<KOLLeaderboardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { getKOLMetadata, ensureKOLs } = useKOLStore();

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                setLoading(true);
                const { requestManager } = await import('@/lib/request-manager');
                if (requestManager.shouldBlockRequest()) return;

                const { authenticatedRequest } = await import('@/lib/request-manager');
                const response = await authenticatedRequest(
                    () => TradingService.getLeaderboard(5),
                    { priority: 'high' }
                );

                if (Array.isArray(response.data)) {
                    setLeaderboard(response.data);
                    // Ensure metadata is loaded for these KOLs
                    const addresses = response.data.map(item => item.address);
                    await ensureKOLs(addresses);
                } else {
                    console.warn('Leaderboard data is not an array:', response.data);
                    setLeaderboard([]);
                }
            } catch (error: any) {
                // Suppress console error for network/offline issues
                const isNetworkError =
                    error.message?.includes('Network Error') ||
                    error.message?.includes('Unable to connect') ||
                    error.code === 'ERR_NETWORK' ||
                    error.code === 'ECONNREFUSED';

                if (!isNetworkError) {
                    console.error('Failed to fetch leaderboard:', error);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [ensureKOLs]);

    if (loading) {
        return (
            <div className="w-full mb-8">
                <div className="flex items-center space-x-2 mb-4">
                    <div className="w-6 h-6 bg-muted rounded-full animate-pulse" />
                    <div className="h-6 w-48 bg-muted rounded animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-40 bg-muted/20 animate-pulse rounded-xl border border-border/50" />
                    ))}
                </div>
            </div>
        );
    }

    if (leaderboard.length === 0) return null;

    return (
        <div className="w-full mb-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-yellow-500/10 rounded-lg">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                            Top Performers
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Highest PnL this week
                        </p>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
                <div className="flex sm:grid flex-nowrap sm:grid-cols-2 lg:grid-cols-5 gap-4 min-w-[max-content] sm:min-w-0">
                    {leaderboard.map((item, index) => {
                        const metadata = getKOLMetadata(item.address);
                        const displayName = metadata?.name || formatWalletAddress(item.address);
                        const avatarUrl = metadata?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${item.address}`;
                        const isPositive = item.stats.totalPnL >= 0;

                        return (
                            <div
                                key={item.address}
                                onClick={() => router.push(`/kols/${item.address}`)}
                                className="group relative bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-300 rounded-xl p-3 sm:p-4 cursor-pointer hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 overflow-hidden w-[220px] sm:w-auto shrink-0"
                            >
                                {/* Rank Badge */}
                                <div className={`absolute top-0 right-0 p-1.5 sm:p-2 rounded-bl-xl text-[9px] sm:text-[10px] font-bold tracking-wider px-2 sm:px-3 py-1
                                    ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg shadow-yellow-500/20' :
                                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white' :
                                            index === 2 ? 'bg-gradient-to-br from-amber-600 to-orange-700 text-white' :
                                                'bg-muted/50 text-muted-foreground'
                                    }`}>
                                    #{index + 1}
                                </div>

                                <div className="flex flex-col h-full justify-between gap-3 sm:gap-4">
                                    {/* Header with Avatar */}
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <div className="relative">
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted overflow-hidden border border-border group-hover:border-primary/50 transition-colors">
                                                <img
                                                    src={avatarUrl}
                                                    alt={displayName}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${item.address}`;
                                                    }}
                                                />
                                            </div>
                                            {index < 3 && (
                                                <div className="absolute -bottom-1 -right-1 bg-background rounded-full border border-border p-0.5">
                                                    <Trophy className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${index === 0 ? 'text-yellow-500' :
                                                        index === 1 ? 'text-gray-400' :
                                                            'text-amber-600'
                                                        }`} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-xs sm:text-sm truncate group-hover:text-primary transition-colors">
                                                {displayName}
                                            </h3>
                                            {metadata?.socialLinks?.twitter && (
                                                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate hover:text-blue-400 transition-colors">
                                                    {metadata.socialLinks.twitter.replace('https://twitter.com/', '@').replace('https://x.com/', '@')}
                                                </p>
                                            )}
                                            {!metadata?.socialLinks?.twitter && (
                                                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate font-mono opacity-70">
                                                    {formatWalletAddress(item.address)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Main Stats */}
                                    <div>
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-base sm:text-lg font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                                {isPositive ? '+' : ''}{item.stats.totalPnL.toFixed(2)}
                                            </span>
                                            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">SOL</span>
                                        </div>
                                        <div className="h-0.5 sm:h-1 w-full bg-muted/50 rounded-full mt-1.5 sm:mt-2 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'} opacity-50`}
                                                style={{ width: `${Math.min(Math.abs(item.stats.winRate * 100), 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Grid Stats */}
                                    <div className="grid grid-cols-2 gap-2 pt-2 sm:pt-3 border-t border-border/50">
                                        <div className="space-y-0.5">
                                            <p className="text-[9px] sm:text-[10px] text-muted-foreground flex items-center gap-1">
                                                <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Win Rate
                                            </p>
                                            <p className="text-xs sm:text-sm font-semibold">{(item.stats.winRate * 100).toFixed(1)}%</p>
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-[9px] sm:text-[10px] text-muted-foreground flex items-center gap-1">
                                                <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Volume
                                            </p>
                                            <p className="text-xs sm:text-sm font-semibold">{formatNumber(item.stats.totalVolume, 1)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function formatNumber(num: number, limit: number): React.ReactNode {
    if (num >= 1000) {
        return (num / 1000).toFixed(limit) + 'k';
    }
    return num.toFixed(limit);
}
