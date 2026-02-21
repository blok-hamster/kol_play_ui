'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useKOLTradeSocket } from '@/hooks/use-kol-trade-socket';
import type { KOLTrade, MindmapUpdate } from '@/hooks/use-kol-trade-socket';

interface KOLTradeSocketContextType {
  socket: any;
  isConnected: boolean;
  recentTrades: KOLTrade[];
  allMindmapData: { [tokenMint: string]: MindmapUpdate };
  trendingTokens: string[];
  isLoadingInitialData: boolean;
  loadingPhase: string;
  connectionState: any;
  stats: {
    totalTrades: number;
    uniqueKOLs: number;
    uniqueTokens: number;
    totalVolume: number;
  };
}

const KOLTradeSocketContext = createContext<KOLTradeSocketContextType | null>(null);

interface KOLTradeSocketProviderProps {
  children: ReactNode;
}

export const KOLTradeSocketProvider: React.FC<KOLTradeSocketProviderProps> = ({ children }) => {
  // Only use the hook once at the provider level
  // The hook already memoizes its return value internally via ref caching
  const socketData = useKOLTradeSocket();

  return (
    <KOLTradeSocketContext.Provider value={socketData}>
      {children}
    </KOLTradeSocketContext.Provider>
  );
};

export const useKOLTradeSocketContext = (): KOLTradeSocketContextType => {
  const context = useContext(KOLTradeSocketContext);
  if (!context) {
    throw new Error('useKOLTradeSocketContext must be used within a KOLTradeSocketProvider');
  }
  return context;
};