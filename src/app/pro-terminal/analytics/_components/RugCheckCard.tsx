import React, { useEffect, useState } from 'react';
import { RugCheckService, RugCheckResult, RugCheckSecurityData } from '@/services/rug-check.service';
import { ShieldCheck, ShieldAlert, AlertTriangle, Loader2, ExternalLink, Users, Lock, Droplet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

interface RugCheckCardProps {
    tokenAddress: string;
}

export function RugCheckCard({ tokenAddress }: RugCheckCardProps) {
    const [result, setResult] = useState<RugCheckResult | null>(null);
    const [fullData, setFullData] = useState<RugCheckSecurityData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    const check = async () => {
        if (!tokenAddress) return;
        setLoading(true);
        setError(null);
        try {
            // Get both the simplified result and full data
            const [resultData, fullResponse] = await Promise.all([
                RugCheckService.checkToken(tokenAddress),
                RugCheckService.getTokenSecurity(tokenAddress)
            ]);
            setResult(resultData);
            setFullData(fullResponse.data);
        } catch (err: any) {
            setError(err.message || "Failed to check token");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tokenAddress) check();
    }, [tokenAddress]);

    if (!tokenAddress) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
                <ShieldCheck className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-sm">Enter a token address to scan</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center p-6">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-red-500 p-6 text-center">
                <AlertTriangle className="w-8 h-8 mb-2" />
                <p className="text-sm">{error}</p>
                <Button variant="ghost" size="sm" onClick={check} className="mt-2">Retry</Button>
            </div>
        );
    }

    if (!result) return null;

    const isRisky = result.risks.length > 0;
    const scoreColor = result.score > 80 ? "text-green-500" : result.score > 50 ? "text-yellow-500" : "text-red-500";

    return (
        <>
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isRisky ? <ShieldAlert className="text-red-500" /> : <ShieldCheck className="text-green-500" />}
                        <span className="font-bold text-lg">{isRisky ? "Risks Detected" : "Safe"}</span>
                    </div>
                    <div className={`text-2xl font-bold ${scoreColor}`}>
                        {result.score.toFixed(2)}/100
                    </div>
                </div>

                {isRisky ? (
                    <div className="space-y-2">
                        {result.risks.slice(0, 3).map((risk, i) => (
                            <div key={i} className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-2 rounded flex items-center gap-2">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                {risk.name}: {risk.description}
                            </div>
                        ))}
                        {result.risks.length > 3 && (
                            <p className="text-xs text-muted-foreground text-center">
                                +{result.risks.length - 3} more risks
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="p-4 bg-green-500/10 rounded border border-green-500/20 text-green-500 text-sm text-center">
                        No critical risks found.
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-4">
                    <div>Liquidity: <span className="text-foreground">{result.liquidity ? `$${result.liquidity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</span></div>
                    <div>Mint Auth: <span className={result.mintAuthority ? "text-red-500" : "text-green-500"}>{result.mintAuthority ? "Enabled" : "Disabled"}</span></div>
                    <div>Freeze Auth: <span className={result.freezeAuthority ? "text-red-500" : "text-green-500"}>{result.freezeAuthority ? "Enabled" : "Disabled"}</span></div>
                </div>

                <Button
                    onClick={() => setShowDetailModal(true)}
                    className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold"
                    variant="outline"
                >
                    View Full Report <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
            </div>

            {/* Detailed Report Modal */}
            <Modal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                title="Security Report"
                size="lg"
            >
                {fullData && (
                    <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {/* Score Overview */}
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4" /> Security Score
                                </h3>
                                <div className={cn("text-3xl font-bold", scoreColor)}>
                                    {result.score.toFixed(2)}/100
                                </div>
                            </div>
                            <div className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold uppercase text-center",
                                fullData.status === 'good' ? "bg-green-500/10 text-green-500" :
                                    fullData.status === 'warning' ? "bg-yellow-500/10 text-yellow-500" :
                                        "bg-red-500/10 text-red-500"
                            )}>
                                {fullData.status}
                            </div>
                        </div>

                        {/* Distribution Metrics */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                                <Users className="w-4 h-4" /> Token Distribution
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <MetricCard label="Top 10 Holders" value={`${fullData.distribution.top10HoldersPercentage.toFixed(2)}%`} status={fullData.distribution.top10HoldersPercentage > 50 ? 'danger' : 'good'} />
                                <MetricCard label="Dev Holding" value={`${fullData.distribution.devHoldingPercentage.toFixed(2)}%`} status={fullData.distribution.devHoldingPercentage > 10 ? 'warning' : 'good'} />
                                <MetricCard label="Insiders" value={`${fullData.distribution.insidersPercentage.toFixed(2)}%`} status={fullData.distribution.insidersPercentage > 20 ? 'warning' : 'good'} />
                                <MetricCard label="Bundles" value={`${fullData.distribution.bundlesPercentage.toFixed(2)}%`} status={fullData.distribution.bundlesPercentage > 5 ? 'danger' : 'good'} />
                            </div>
                        </div>

                        {/* Authorities */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                                <Lock className="w-4 h-4" /> Authorities
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <MetricCard label="Mint Authority" value={fullData.authorities.mintAuthDisabled ? "Disabled" : "Enabled"} status={fullData.authorities.mintAuthDisabled ? 'good' : 'danger'} />
                                <MetricCard label="Freeze Authority" value={fullData.authorities.freezeAuthDisabled ? "Disabled" : "Enabled"} status={fullData.authorities.freezeAuthDisabled ? 'good' : 'danger'} />
                            </div>
                        </div>

                        {/* Markets */}
                        {fullData.markets.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                                    <Droplet className="w-4 h-4" /> Liquidity Markets
                                </h3>
                                <div className="space-y-2">
                                    {fullData.markets.map((market, i) => (
                                        <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border/50">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-muted-foreground uppercase">{market.marketType.replace(/_/g, ' ')}</span>
                                                <span className="text-sm font-bold text-foreground">${market.liquidityUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded text-[10px] font-bold",
                                                    market.isLocked ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                                )}>
                                                    {market.isLocked ? "Locked" : "Unlocked"}
                                                </span>
                                                <span className="text-muted-foreground">LP Burned: {market.lpBurnedPercentage.toFixed(2)}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Risks */}
                        {fullData.risks.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-widest text-red-500 mb-3 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> Detected Risks
                                </h3>
                                <div className="space-y-2">
                                    {fullData.risks.map((risk, i) => (
                                        <div key={i} className={cn(
                                            "p-3 rounded-lg border text-xs",
                                            risk.level === 'high' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                                                risk.level === 'medium' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500" :
                                                    "bg-blue-500/10 border-blue-500/20 text-blue-500"
                                        )}>
                                            <div className="font-bold mb-1">{risk.name}</div>
                                            <div className="opacity-80">{risk.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </>
    );
}

// Helper component for metrics
const MetricCard: React.FC<{ label: string; value: string; status?: 'good' | 'warning' | 'danger' }> = ({ label, value, status }) => (
    <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
        <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{label}</div>
        <div className={cn(
            "text-sm font-bold",
            status === 'good' ? "text-green-500" :
                status === 'warning' ? "text-yellow-500" :
                    status === 'danger' ? "text-red-500" :
                        "text-foreground"
        )}>
            {value}
        </div>
    </div>
);
