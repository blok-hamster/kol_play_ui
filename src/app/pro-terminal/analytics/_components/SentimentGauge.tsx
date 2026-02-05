import React from 'react';

interface SentimentGaugeProps {
    score: number;
    loading?: boolean;
    positiveWords?: string[];
    negativeWords?: string[];
}

export function SentimentGauge({ score, loading, positiveWords = [], negativeWords = [] }: SentimentGaugeProps) {
    // Score is 0-100.
    // 0-30: Bearish (Red)
    // 30-70: Neutral (Yellow)
    // 70-100: Bullish (Green)

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full p-4 space-y-4 animate-pulse">
                <div className="w-full aspect-[2/1] bg-muted/20 rounded-t-full border-b-0"></div>
                <div className="h-4 w-1/2 bg-muted/20 rounded"></div>
            </div>
        );
    }

    let colorClass = "text-yellow-500";
    let strokeColor = "#eab308"; // yellow-500
    let label = "Neutral";

    if (score >= 70) {
        colorClass = "text-green-500";
        strokeColor = "#22c55e"; // green-500
        label = "Bullish";
    } else if (score <= 30) {
        colorClass = "text-red-500";
        strokeColor = "#ef4444"; // red-500
        label = "Bearish";
    }

    // SVG Geometry for a 180 degree semi-circle
    const radius = 80;
    const strokeWidth = 12;
    const center = 100; // SVG viewBox 200x100
    // Arc path: M 20 100 A 80 80 0 0 1 180 100
    // Needle rotation: -90 (0) to 90 (100)
    const rotation = (score / 100) * 180 - 90;

    return (
        <div className="flex flex-col items-center justify-between h-full w-full py-2">

            {/* Gauge SVG */}
            <div className="relative w-full max-w-[200px] aspect-[2/1]">
                <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
                    {/* Background Arc */}
                    <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke="currentColor"
                        className="text-muted/20"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />

                    {/* Active Arc (Colored) - Simple version: just overlay same path with color */}
                    {/* For true progress bar behavior we'd use strokeDasharray, but for a gauge usually the needle points to the value */}

                    {/* Needle Group */}
                    <g transform={`translate(100, 100) rotate(${rotation})`}>
                        {/* Needle Body */}
                        <path d="M -2 0 L 0 -75 L 2 0 Z" fill="currentColor" className="text-foreground" />
                        {/* Needle Center Pin */}
                        <circle cx="0" cy="0" r="6" fill="currentColor" className="text-foreground" />
                        <circle cx="0" cy="0" r="3" fill="#000" />
                    </g>

                    {/* Ticks (Optional) */}
                    <text x="20" y="120" fontSize="10" fill="currentColor" className="text-muted-foreground opacity-50" textAnchor="middle">0</text>
                    <text x="100" y="90" fontSize="10" fill="currentColor" className="text-muted-foreground opacity-50" textAnchor="middle">50</text>
                    <text x="180" y="120" fontSize="10" fill="currentColor" className="text-muted-foreground opacity-50" textAnchor="middle">100</text>
                </svg>

                {/* Score Overlay (Bottom Center) */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-center">
                    <div className={`text-3xl font-black tracking-tighter ${colorClass}`}>{score}</div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{label}</div>
                </div>
            </div>

            {/* Word Cloud / Insights */}
            <div className="grid grid-cols-2 gap-2 w-full text-[10px] mt-2 px-2">
                <div className="p-1.5 bg-green-500/5 rounded border border-green-500/10 backdrop-blur-sm">
                    <span className="font-bold text-green-500 block mb-0.5 uppercase tracking-wide">Bullish Signals</span>
                    <div className="flex flex-wrap gap-1">
                        {positiveWords.length > 0 ? positiveWords.slice(0, 3).map(w => (
                            <span key={w} className="bg-green-500/10 text-green-500 px-1 rounded">{w}</span>
                        )) : <span className="text-muted-foreground opacity-50 italic">None</span>}
                    </div>
                </div>
                <div className="p-1.5 bg-red-500/5 rounded border border-red-500/10 backdrop-blur-sm">
                    <span className="font-bold text-red-500 block mb-0.5 uppercase tracking-wide">Bearish Signals</span>
                    <div className="flex flex-wrap gap-1">
                        {negativeWords.length > 0 ? negativeWords.slice(0, 3).map(w => (
                            <span key={w} className="bg-red-500/10 text-red-500 px-1 rounded">{w}</span>
                        )) : <span className="text-muted-foreground opacity-50 italic">None</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}
