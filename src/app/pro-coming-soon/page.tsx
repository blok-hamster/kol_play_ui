'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Zap, BarChart3, Globe, Lock, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProComingSoonPage() {
    return (
        <div className="min-h-screen bg-[#171616] text-white flex flex-col items-center justify-center relative overflow-hidden p-6 font-semibold">
            {/* Grid Background (Matches AppLayout) */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.2]"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(156, 163, 175, 0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(156, 163, 175, 0.6) 1px, transparent 1px)
          `,
                    backgroundSize: '40px 40px',
                }}
            />

            {/* Background Decorative Element */}
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[60%] h-[40%] bg-accent-gradient opacity-[0.05] rounded-full blur-[120px]" />

            <div className="max-w-4xl w-full z-10 text-center space-y-10">
                {/* Header Section */}
                <div className="flex flex-col items-center space-y-8 animate-fade-in">
                    {/* Logo Replacement - Larger Size */}
                    <div className="relative w-80 md:w-[500px] h-32 md:h-44 transition-transform hover:scale-105 duration-500">
                        <Image
                            src="/4.png"
                            alt="KOL Play Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-accent-gradient text-white text-xs md:text-sm font-bold uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(20,241,149,0.3)]">
                            <Zap className="h-4 w-4 fill-current" />
                            <span>Pro Mode Coming Soon</span>
                        </div>
                        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
                            The ultimate terminal for high-frequency copy trading, Prediction Markets and advanced on-chain analysis.
                        </p>
                    </div>
                </div>

                {/* Features Preview Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-in">
                    {[
                        {
                            icon: Zap,
                            title: "Ultra-Fast Execution",
                            desc: "Zero-latency transaction routing through private RPC nodes.",
                            color: "text-[#14F195]"
                        },
                        {
                            icon: BarChart3,
                            title: "Advanced Analytics",
                            desc: "Deep dive into wallet PnL, win rates, and holding patterns.",
                            color: "text-[#9945FF]"
                        },
                        {
                            icon: Globe,
                            title: "Multi-Chain Hub",
                            desc: "Native support for Solana, BSC, Base, and Ethereum.",
                            color: "text-blue-400"
                        }
                    ].map((feature, i) => (
                        <div
                            key={i}
                            className="group p-8 rounded-[2rem] bg-card/40 border border-border/50 backdrop-blur-sm hover:bg-card/60 transition-all duration-300 transform hover:-translate-y-1"
                        >
                            <feature.icon className={cn("h-10 w-10 mb-4 transition-transform group-hover:scale-110", feature.color)} />
                            <h3 className="text-xl font-bold mb-3 tracking-tight">{feature.title}</h3>
                            <p className="text-[15px] text-muted-foreground leading-relaxed font-medium">{feature.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Call to Action */}
                <div className="pt-6 flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 animate-fade-in">
                    <Link href="/agent">
                        <Button variant="outline" size="lg" className="rounded-xl px-10 h-14 text-base border-border bg-background/50 hover:bg-muted transition-all group font-bold">
                            <ArrowLeft className="mr-3 h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                            Return to Lite
                        </Button>
                    </Link>
                    <Button disabled size="lg" className="rounded-xl px-12 h-14 text-base bg-accent-gradient text-white border-none shadow-[0_0_30px_rgba(153,69,255,0.3)] opacity-80 cursor-not-allowed font-bold">
                        <Lock className="mr-3 h-5 w-5" />
                        Join Waitlist
                    </Button>
                </div>

                {/* Footer Meta */}
                <div className="pt-8 text-muted-foreground/30 text-[13px] font-mono uppercase tracking-[0.4em]">
                    Phase 2 Deployment // Q2 2026
                </div>
            </div>

            {/* Decorative Lines */}
            <div className="absolute top-0 left-[20%] w-px h-full bg-gradient-to-b from-transparent via-border/10 to-transparent" />
            <div className="absolute top-0 right-[20%] w-px h-full bg-gradient-to-b from-transparent via-border/10 to-transparent" />
        </div>
    );
}
