'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import Header from './header';
import { SolanaService } from '@/services/solana.service';
import { ExternalLink, Twitter, Send, MessageCircle, Github } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, className }) => {
  const { theme } = useTheme();
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [priorityFee, setPriorityFee] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [price, fee] = await Promise.all([
          SolanaService.getSolPrice(),
          SolanaService.getPriorityFeeMicroLamportsPerCU().catch(() => 0),
        ]);
        if (!mounted) return;
        setSolPrice(price || 0);
        setPriorityFee(typeof fee === 'number' ? fee : 0);
      } catch {
        // ignore
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <div
      className={cn(
        'min-h-screen bg-background text-foreground transition-colors duration-200 relative',
        theme,
        className
      )}
    >
      {/* Grid Background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(156, 163, 175, 0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(156, 163, 175, 0.6) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* App Content */}
      <div className="relative z-10">
        {/* Skip to main content for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
        >
          Skip to main content
        </a>

        <div className="flex flex-col min-h-screen">
          {/* Header with Navigation */}
          <Header />

          {/* Main content */}
          <main
            id="main-content"
            className="flex-1 focus:outline-none pt-24 lg:pt-36 lg:pb-16"
          >
            <div className="h-full">{children}</div>
          </main>
        </div>
      </div>
      {/* Desktop Footer (fixed) */}
      <footer className="hidden lg:block fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-black/80 text-white">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between text-sm">
          {/* Socials */}
          <div className="flex items-center gap-5">
            <a href="https://x.com" target="_blank" rel="noreferrer" className="text-white/80 hover:text-white inline-flex items-center gap-2">
              <Twitter className="h-4 w-4" aria-hidden="true" />
              <span>X</span>
            </a>
            <a href="https://t.me" target="_blank" rel="noreferrer" className="text-white/80 hover:text-white inline-flex items-center gap-2">
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Telegram</span>
            </a>
            <a href="https://discord.com" target="_blank" rel="noreferrer" className="text-white/80 hover:text-white inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              <span>Discord</span>
            </a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="text-white/80 hover:text-white inline-flex items-center gap-2">
              <Github className="h-4 w-4" aria-hidden="true" />
              <span>GitHub</span>
            </a>
          </div>
          {/* Metrics */}
          <div className="flex items-center gap-4 text-white/80">
            <div className="inline-flex items-center gap-2">
              <img src="/6.png" alt="Player (KPL)" className="h-4 w-4 rounded" />
              <span>Player (KPL): TBA</span>
            </div>
            <div className="inline-flex items-center gap-2">
              {/* Solana icon */}
              <svg width="16" height="16" viewBox="0 0 256 256" className="h-4 w-4" aria-hidden="true">
                <defs>
                  <linearGradient id="solana-g" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#14f195"/>
                    <stop offset="100%" stopColor="#9945ff"/>
                  </linearGradient>
                </defs>
                <path fill="url(#solana-g)" d="M64 52c3-3 7-4 11-4h155c5 0 7 6 3 9l-43 43c-3 3-7 4-11 4H24c-5 0-7-6-3-9L64 52zM64 152c3-3 7-4 11-4h155c5 0 7 6 3 9l-43 43c-3 3-7 4-11 4H24c-5 0-7-6-3-9l43-43zM200 96c-3 3-7 4-11 4H34c-5 0-7-6-3-9l43-43c3-3 7-4 11-4h155c5 0 7 6 3 9l-43 43z"/>
              </svg>
              <span>SOL: {solPrice !== null ? `$${solPrice.toFixed(2)}` : '—'}</span>
            </div>
            <div>
              Fee: {priorityFee !== null ? `${priorityFee.toLocaleString()} µ-lamports/CU` : '—'}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
