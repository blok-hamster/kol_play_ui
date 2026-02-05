'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Shield, Loader2 } from 'lucide-react';
import { useUIStore } from '@/stores/use-ui-store';
import { cn } from '@/lib/utils';

export const ModeSwitchLoading: React.FC = () => {
    const { isModeSwitching, isProMode, switchingTargetMode } = useUIStore();
    const effectiveIsPro = switchingTargetMode ? switchingTargetMode === 'pro' : isProMode;

    return (
        <AnimatePresence>
            {isModeSwitching && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl"
                >
                    {/* Background Ambient Glow */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className={cn(
                            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 animate-pulse",
                            effectiveIsPro ? "bg-yellow-500/30" : "bg-blue-500/30"
                        )} />
                    </div>

                    {/* Animated Grid Lines - Repurposed from app's design language */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center space-y-8">
                        {/* Icon Container with Floating Animation */}
                        <motion.div
                            animate={{
                                y: [0, -10, 0],
                                scale: [1, 1.05, 1]
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="relative"
                        >
                            <div className={cn(
                                "w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl relative overflow-hidden",
                                effectiveIsPro
                                    ? "bg-gradient-to-br from-yellow-400 to-amber-600 shadow-yellow-500/20"
                                    : "bg-gradient-to-br from-blue-400 to-indigo-600 shadow-blue-500/20"
                            )}>
                                {/* Inner Gloss Effect */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

                                {effectiveIsPro ? (
                                    <Zap className="w-12 h-12 text-white fill-white/20" />
                                ) : (
                                    <Shield className="w-12 h-12 text-white fill-white/20" />
                                )}
                            </div>

                            {/* Orbiting Ring */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                className="absolute -inset-4 border border-dashed border-border/50 rounded-full"
                            />
                        </motion.div>

                        {/* Text and Progress */}
                        <div className="text-center space-y-4">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-foreground">
                                    Switching to <span className={cn(
                                        "bg-clip-text text-transparent",
                                        effectiveIsPro ? "bg-gradient-to-r from-yellow-400 to-amber-600" : "bg-gradient-to-r from-blue-400 to-indigo-600"
                                    )}>
                                        {effectiveIsPro ? 'PRO MODE' : 'LITE MODE'}
                                    </span>
                                </h3>
                                <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest mt-2">
                                    Initializing Trading Terminal...
                                </p>
                            </motion.div>

                            <div className="flex items-center justify-center space-x-3 pt-4">
                                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                <div className="h-1.5 w-48 bg-muted rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: "0%" }}
                                        animate={{ width: "100%" }}
                                        transition={{ duration: 1.8, ease: "easeOut" }}
                                        className={cn(
                                            "h-full rounded-full",
                                            effectiveIsPro ? "bg-accent-gradient" : "bg-blue-500"
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Tagline */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        className="absolute bottom-12 flex items-center space-x-2 grayscale opacity-40"
                    >
                        <img src="/6.png" className="h-5 w-auto" alt="Logo" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Kol Play Ecosystem</span>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
