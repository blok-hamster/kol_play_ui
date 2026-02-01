import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Globe, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrowserFrameProps {
    frame: { data: string; url: string } | null;
    action: { type: string; message: string; url: string } | null;
    error?: string | null;
    className?: string;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({ frame, action, error, className }) => {
    if (!action && !frame && !error) return null;

    return (
        <Card className={cn("overflow-hidden border-border bg-card/50 backdrop-blur-sm flex flex-col", className)}>
            <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between border-b border-border/30 bg-muted/5 shrink-0">
                <div className="flex items-center gap-2 overflow-hidden">
                    <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                    <CardTitle className="text-[10px] font-mono truncate text-muted-foreground">
                        {frame?.url || action?.url || 'Browsing Sandbox...'}
                    </CardTitle>
                </div>
                {action?.type !== 'completed' && !error && (
                    <Loader2 className="h-3 w-3 animate-spin text-primary/60" />
                )}
            </CardHeader>
            <CardContent className="p-0 relative bg-black flex-1 flex items-center justify-center overflow-hidden">
                {frame ? (
                    <img
                        src={frame.data}
                        alt="Browser Stream"
                        className="w-full h-full object-contain animate-in fade-in duration-500"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                        <span className="text-[10px] uppercase tracking-widest font-bold opacity-50">Synchronizing...</span>
                    </div>
                )}

                {/* Status Overlay */}
                <div className="absolute bottom-3 left-3 right-3 py-1.5 px-3 rounded-lg bg-black/80 backdrop-blur-md border border-white/5 flex items-center gap-2.5 shadow-2xl">
                    {error ? (
                        <>
                            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                            <span className="text-[10px] text-destructive font-mono truncate">{error}</span>
                        </>
                    ) : (
                        <>
                            <div className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                action?.type === 'completed' ? "bg-[#14f195] shadow-[0_0_8px_#14f195]" : "bg-primary animate-pulse shadow-[0_0_8px_#9945ff]"
                            )} />
                            <span className="text-[10px] text-white/70 font-mono truncate tracking-tight">
                                {action?.message || 'Awaiting command...'}
                            </span>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
