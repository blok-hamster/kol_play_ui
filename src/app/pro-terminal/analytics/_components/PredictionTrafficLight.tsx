import React from 'react';

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
            <div className="flex gap-4 p-4 justify-center animate-pulse opacity-50">
                <div className="w-12 h-12 rounded-full bg-muted"></div>
                <div className="w-12 h-12 rounded-full bg-muted"></div>
                <div className="w-12 h-12 rounded-full bg-muted"></div>
            </div>
        );
    }

    const activeLabel = prediction?.label || "NEUTRAL";

    // Opacity classes
    const redActive = activeLabel === "BAD" ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)] scale-110" : "bg-red-900/30 opacity-30";
    const yellowActive = activeLabel === "NEUTRAL" ? "bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.6)] scale-110" : "bg-yellow-900/30 opacity-30";
    const greenActive = activeLabel === "GOOD" ? "bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)] scale-110" : "bg-green-900/30 opacity-30";

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="flex gap-6 p-4 bg-background/50 rounded-2xl border border-border shadow-inner">
                {/* Red Light */}
                <div className={`w-12 h-12 rounded-full transition-all duration-500 border border-border ${redActive}`}></div>

                {/* Yellow Light */}
                <div className={`w-12 h-12 rounded-full transition-all duration-500 border border-border ${yellowActive}`}></div>

                {/* Green Light */}
                <div className={`w-12 h-12 rounded-full transition-all duration-500 border border-border ${greenActive}`}></div>
            </div>

            {prediction && (
                <div className="text-center mt-2">
                    <div className={`text-2xl font-black italic uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r 
                        ${activeLabel === 'GOOD' ? 'from-green-400 to-green-600' :
                            activeLabel === 'BAD' ? 'from-red-400 to-red-600' :
                                'from-yellow-400 to-yellow-600'}`}>
                        {activeLabel}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-bold opacity-60">
                        Confidence: <span className="text-foreground">{Math.round(prediction.confidence)}%</span>
                    </div>
                </div>
            )}
        </div>
    );
}
