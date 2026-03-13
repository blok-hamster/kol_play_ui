import React from 'react';
import { Cpu, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming global util

interface PredictionTrafficLightProps {
    prediction: {
        label: "GOOD" | "BAD" | "NEUTRAL";
        confidence: number;
    } | null;
    loading?: boolean;
}

export function PredictionTrafficLight({ prediction, loading }: PredictionTrafficLightProps) {
    if (loading) {
        return (
            <div className="flex flex-col gap-2 p-4 w-full max-w-sm mx-auto justify-center animate-pulse opacity-50">
                <div className="flex justify-between items-center mb-1">
                    <div className="h-3 w-20 bg-muted rounded"></div>
                    <div className="h-3 w-12 bg-muted rounded"></div>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden"></div>
                <div className="flex justify-between items-center mt-1">
                    <div className="h-2 w-16 bg-muted rounded"></div>
                    <div className="h-2 w-16 bg-muted rounded"></div>
                </div>
            </div>
        );
    }

    const activeLabel = prediction?.label || "NEUTRAL";
    const confidence = prediction ? Math.round(prediction.confidence) : 0;

    // Determine colors based on label
    let colorClass = "text-yellow-500";
    let bgClass = "bg-yellow-500";
    let glowClass = "shadow-[0_0_15px_rgba(234,179,8,0.4)]";
    let gradientClass = "from-yellow-500/20 to-transparent";

    if (activeLabel === "GOOD") {
        colorClass = "text-green-500";
        bgClass = "bg-green-500";
        glowClass = "shadow-[0_0_15px_rgba(34,197,94,0.4)]";
        gradientClass = "from-green-500/20 to-transparent";
    } else if (activeLabel === "BAD") {
        colorClass = "text-red-500";
        bgClass = "bg-red-500";
        glowClass = "shadow-[0_0_15px_rgba(239,68,68,0.4)]";
        gradientClass = "from-red-500/20 to-transparent";
    }

    return (
        <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto relative p-4 bg-black/20 rounded-xl border border-white/5">
            {/* Ambient Background Glow */}
            <div className={cn("absolute inset-0 bg-gradient-to-b opacity-50 rounded-xl pointer-events-none transition-all duration-700", gradientClass)} />

            {/* Header: AI Model Tag */}
            <div className="flex justify-between w-full items-center z-10">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 border border-white/10">
                    <Cpu className="w-3 h-3 text-purple-400" />
                    <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground mr-1">Model:</span>
                    <span className="text-[9px] uppercase tracking-widest font-black text-white">XGBoost v2</span>
                </div>
            </div>

            {prediction ? (
                <div className="w-full flex flex-col gap-2 z-10 mt-2">
                    {/* Prediction Result & Confidence Value */}
                    <div className="flex justify-between items-end mb-1">
                        <div>
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold opacity-70 block mb-0.5">Prediction</span>
                            <div className={cn("text-2xl font-black italic uppercase tracking-wider", colorClass, glowClass.replace('shadow-', 'drop-shadow-'))}>
                                {activeLabel}
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold opacity-70 block mb-0.5">Confidence</span>
                            <div className="text-lg font-mono font-bold text-foreground">
                                {confidence}%
                            </div>
                        </div>
                    </div>

                    {/* Minimal Progress Bar */}
                    <div className="relative h-2 w-full bg-black/60 rounded-full overflow-hidden border border-white/10 mt-1">
                        <div
                            className={cn("absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out", bgClass, glowClass)}
                            style={{ width: `${confidence}%` }}
                        />
                    </div>
                </div>
            ) : (
                <div className="w-full flex flex-col items-center justify-center py-6 z-10 opacity-50">
                    <Sparkles className="w-6 h-6 text-muted-foreground mb-2" />
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Awaiting Token</div>
                </div>
            )}
        </div>
    );
}
