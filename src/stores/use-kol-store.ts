import { create } from 'zustand';
import { TradingService } from '@/services/trading.service';
import type { KOLWallet } from '@/types';

interface KOLState {
  kolByWallet: Record<string, KOLWallet>;
  isLoadingByWallet: Record<string, boolean>;
  setKOL: (kol: KOLWallet) => void;
  setKOLs: (kols: KOLWallet[]) => void;
  getKOL: (walletAddress: string) => KOLWallet | undefined;
  ensureKOL: (walletAddress: string) => Promise<KOLWallet | undefined>;
}

export const useKOLStore = create<KOLState>((set, get) => ({
  kolByWallet: {},
  isLoadingByWallet: {},

  setKOL: (kol: KOLWallet) =>
    set(state => ({
      kolByWallet: {
        ...state.kolByWallet,
        [kol.walletAddress.toLowerCase()]: kol,
      },
    })),

  setKOLs: (kols: KOLWallet[]) =>
    set(state => {
      const updated: Record<string, KOLWallet> = { ...state.kolByWallet };
      for (const kol of kols) {
        if (!kol?.walletAddress) continue;
        updated[kol.walletAddress.toLowerCase()] = kol;
      }
      return { kolByWallet: updated };
    }),

  getKOL: (walletAddress: string) => {
    if (!walletAddress) return undefined;
    return get().kolByWallet[walletAddress.toLowerCase()];
  },

  ensureKOL: async (walletAddress: string) => {
    if (!walletAddress) return undefined;
    const lower = walletAddress.toLowerCase();
    const existing = get().kolByWallet[lower];
    if (existing) return existing;

    const isLoading = get().isLoadingByWallet[lower];
    if (isLoading) {
      // Simple wait loop to avoid duplicate requests
      await new Promise(resolve => setTimeout(resolve, 100));
      return get().kolByWallet[lower];
    }

    set(state => ({ isLoadingByWallet: { ...state.isLoadingByWallet, [lower]: true } }));
    try {
      const response = await TradingService.getKOLWallets({ query: walletAddress, limit: 1 } as any);
      const kol = response.data?.[0];
      if (kol && kol.walletAddress) {
        set(state => ({
          kolByWallet: { ...state.kolByWallet, [kol.walletAddress.toLowerCase()]: kol },
        }));
        return kol;
      }
      return undefined;
    } catch (err) {
      return undefined;
    } finally {
      set(state => {
        const next = { ...state.isLoadingByWallet };
        delete next[lower];
        return { isLoadingByWallet: next };
      });
    }
  },
})); 