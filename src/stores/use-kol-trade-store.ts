'use client';

import { create } from 'zustand';
import { KOLTrade, MindmapUpdate } from '@/hooks/use-kol-trade-socket';

interface KOLTradeFilters {
  tradeType: 'all' | 'buy' | 'sell';
  selectedKOL: string | undefined;
  selectedToken: string;
  minAmount: string | undefined;
}

interface KOLTradeStats {
  totalTrades: number;
  uniqueKOLs: number;
  uniqueTokens: number;
  totalVolume: number;
}

interface KOLTradeState {
  // Data
  trades: KOLTrade[];
  mindmapData: { [tokenMint: string]: MindmapUpdate };
  trendingTokens: string[];
  stats: KOLTradeStats;
  
  // UI State
  filters: KOLTradeFilters;
  selectedTrade: KOLTrade | null;
  selectedMindmapToken: string;
  viewMode: 'grid' | 'single';
  
  // Actions
  setTrades: (trades: KOLTrade[]) => void;
  addTrade: (trade: KOLTrade) => void;
  updateMindmapData: (tokenMint: string, data: MindmapUpdate) => void;
  setTrendingTokens: (tokens: string[]) => void;
  setStats: (stats: KOLTradeStats) => void;
  setFilters: (filters: Partial<KOLTradeFilters>) => void;
  setSelectedTrade: (trade: KOLTrade | null) => void;
  setSelectedMindmapToken: (token: string) => void;
  setViewMode: (mode: 'grid' | 'single') => void;
  clearFilters: () => void;
}

const initialFilters: KOLTradeFilters = {
  tradeType: 'all',
  selectedKOL: undefined,
  selectedToken: '',
  minAmount: undefined
};

const initialStats: KOLTradeStats = {
  totalTrades: 0,
  uniqueKOLs: 0,
  uniqueTokens: 0,
  totalVolume: 0
};

export const useKOLTradeStore = create<KOLTradeState>((set, get) => ({
  // Initial state
  trades: [],
  mindmapData: {},
  trendingTokens: [],
  stats: initialStats,
  filters: initialFilters,
  selectedTrade: null,
  selectedMindmapToken: '',
  viewMode: 'grid',

  // Actions
  setTrades: (trades) => set({ trades }),
  
  addTrade: (trade) => set((state) => ({
    trades: [trade, ...state.trades.slice(0, 99)] // Keep last 100 trades
  })),
  
  updateMindmapData: (tokenMint, data) => set((state) => ({
    mindmapData: {
      ...state.mindmapData,
      [tokenMint]: data
    }
  })),
  
  setTrendingTokens: (tokens) => set({ trendingTokens: tokens }),
  
  setStats: (stats) => set({ stats }),
  
  setFilters: (newFilters) => set((state) => ({
    filters: { ...state.filters, ...newFilters }
  })),
  
  setSelectedTrade: (trade) => set({ selectedTrade: trade }),
  
  setSelectedMindmapToken: (token) => set({ selectedMindmapToken: token }),
  
  setViewMode: (mode) => set({ viewMode: mode }),
  
  clearFilters: () => set({ filters: initialFilters })
})); 