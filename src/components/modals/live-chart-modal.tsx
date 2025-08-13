"use client";

import React from 'react';
import { Modal } from '@/components/ui/modal';

export interface LiveChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Solana token mint address
  mint?: string;
  // If you already know the pair/pool address for DexScreener, pass it directly
  pairAddress?: string;
  // Optional title (e.g., token symbol)
  title?: string;
  // Modal size
  size?: 'sm' | 'md' | 'lg' | 'xl';
  // Chart height in pixels
  height?: number;
}

const LiveChartModal: React.FC<LiveChartModalProps> = ({
  isOpen,
  onClose,
  mint,
  pairAddress,
  title,
  size = 'xl',
  height = 460,
}) => {
  const [dexPair, setDexPair] = React.useState<string | null>(pairAddress || null);
  const [themeMode, setThemeMode] = React.useState<'dark' | 'light'>('dark');

  // Determine theme for embedded widget
  React.useEffect(() => {
    try {
      const isDark = document.documentElement.classList.contains('dark');
      setThemeMode(isDark ? 'dark' : 'light');
    } catch {}
  }, [isOpen]);

  // Resolve DexScreener pair address if only mint is provided
  React.useEffect(() => {
    let cancelled = false;

    const resolvePair = async () => {
      if (pairAddress) {
        setDexPair(pairAddress);
        return;
      }
      if (!mint) return;

      try {
        const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`);
        if (!res.ok) return;
        const pairs: any[] = await res.json();
        if (Array.isArray(pairs) && pairs.length > 0) {
          const best = pairs
            .filter(p => p?.pairAddress)
            .sort((a, b) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0];
          if (!cancelled && best?.pairAddress) setDexPair(best.pairAddress);
        }
      } catch {}
    };

    resolvePair();
    return () => {
      cancelled = true;
    };
  }, [mint, pairAddress]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || 'Live Chart'}
      size={size}
      className="overflow-hidden"
    >
      <div className="w-full overflow-hidden" style={{ minHeight: height }}>
        {dexPair ? (
          <iframe
            title="DexScreener Chart"
            src={`https://dexscreener.com/solana/${dexPair}?embed=1&theme=${themeMode}&chart=1&layout=chart&trades=0&info=0`}
            className="w-full border-0 block"
            style={{ height }}
            allow="clipboard-write; encrypted-media"
          />
        ) : (
          <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
            Loading chart...
          </div>
        )}
      </div>
    </Modal>
  );
};

export default LiveChartModal; 