import { create } from 'zustand';
import { TradingService } from '@/services/trading.service';
import { cacheManager } from '@/lib/cache-manager';
import type { KOLWallet } from '@/types';

// KOL cache TTL - 24 hours for full data, 7 days for metadata only
const KOL_DATA_TTL = 24 * 60 * 60 * 1000; // 24 hours
const KOL_METADATA_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Helper functions for Twitter avatar extraction (same as in kol-list.tsx)
function extractTwitterUsername(profileUrl?: string): string | null {
  if (!profileUrl) return null;
  try {
    const url = new URL(profileUrl);
    const hostname = url.hostname.toLowerCase();
    const isTwitter = hostname === 'twitter.com' || hostname === 'www.twitter.com';
    const isX = hostname === 'x.com' || hostname === 'www.x.com';
    if (!isTwitter && !isX) return null;
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) return null;
    const username = pathParts[0];
    if (!username) return null;
    return username.replace(/\.json$/i, '');
  } catch {
    return null;
  }
}

function getTwitterAvatarUrl(twitterUrl?: string, fallbackSeed?: string): string | undefined {
  const username = extractTwitterUsername(twitterUrl);
  if (!username) return undefined;
  const base = `https://unavatar.io/twitter/${encodeURIComponent(username)}`;
  if (fallbackSeed && fallbackSeed.trim().length > 0) {
    const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackSeed)}`;
    return `${base}?fallback=${encodeURIComponent(fallback)}`;
  }
  return base;
}

function findTwitterUrlFromText(text?: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+/i);
  return match ? match[0] : undefined;
}

function findTwitterUrlFromKOL(kol: KOLWallet): string | undefined {
  return kol.socialLinks?.twitter || findTwitterUrlFromText(kol.description);
}

interface KOLState {
  kolByWallet: Record<string, KOLWallet>;
  isLoadingByWallet: Record<string, boolean>;
  isLoadingAll: boolean;
  hasLoadedAll: boolean;
  setKOL: (kol: KOLWallet) => void;
  setKOLs: (kols: KOLWallet[]) => void;
  getKOL: (walletAddress: string) => KOLWallet | undefined;
  ensureKOL: (walletAddress: string) => Promise<KOLWallet | undefined>;
  loadAllKOLs: () => Promise<void>;
  ensureKOLs: (walletAddresses: string[]) => Promise<(KOLWallet | undefined)[]>;
  loadFromCache: () => void;
  getKOLMetadata: (walletAddress: string) => { name?: string; avatar?: string; socialLinks?: any } | undefined;
}

export const useKOLStore = create<KOLState>((set, get) => ({
  kolByWallet: {},
  isLoadingByWallet: {},
  isLoadingAll: false,
  hasLoadedAll: false,

  setKOL: (kol: KOLWallet) => {
    const enhanced = get().enhanceKOLWithTwitterAvatar(kol);
    set(state => ({
      kolByWallet: {
        ...state.kolByWallet,
        [enhanced.walletAddress.toLowerCase()]: enhanced,
      },
    }));
    
    // Cache the full KOL data and metadata separately
    cacheManager.setKOLData(enhanced.walletAddress, enhanced, KOL_DATA_TTL);
    cacheManager.setKOLMetadata(enhanced.walletAddress, {
      name: enhanced.name,
      avatar: enhanced.avatar,
      socialLinks: enhanced.socialLinks,
    }, KOL_METADATA_TTL);
  },

  setKOLs: (kols: KOLWallet[]) => {
    const enhanced = kols.map(kol => get().enhanceKOLWithTwitterAvatar(kol));
    
    set(state => {
      const updated: Record<string, KOLWallet> = { ...state.kolByWallet };
      for (const kol of enhanced) {
        if (!kol?.walletAddress) continue;
        updated[kol.walletAddress.toLowerCase()] = kol;
      }
      return { kolByWallet: updated, hasLoadedAll: true };
    });
    
    // Batch cache the KOL data and metadata
    const kolDataMap: Record<string, KOLWallet> = {};
    const metadataMap: Record<string, any> = {};
    
    enhanced.forEach(kol => {
      if (kol.walletAddress) {
        kolDataMap[kol.walletAddress] = kol;
        metadataMap[kol.walletAddress] = {
          name: kol.name,
          avatar: kol.avatar,
          socialLinks: kol.socialLinks,
        };
      }
    });
    
    cacheManager.setKOLDataBatch(kolDataMap, KOL_DATA_TTL);
    // Cache metadata separately with longer TTL
    Object.entries(metadataMap).forEach(([walletAddress, metadata]) => {
      cacheManager.setKOLMetadata(walletAddress, metadata, KOL_METADATA_TTL);
    });
  },

  getKOL: (walletAddress: string) => {
    if (!walletAddress) return undefined;
    
    // First check in-memory store
    const memoryKOL = get().kolByWallet[walletAddress.toLowerCase()];
    if (memoryKOL) return memoryKOL;
    
    // Then check cache
    const cachedKOL = cacheManager.getKOLData(walletAddress);
    if (cachedKOL) {
      // Restore to memory for faster access
      set(state => ({
        kolByWallet: {
          ...state.kolByWallet,
          [walletAddress.toLowerCase()]: cachedKOL,
        },
      }));
      return cachedKOL;
    }
    
    return undefined;
  },

  getKOLMetadata: (walletAddress: string) => {
    if (!walletAddress) return undefined;
    
    // First check if we have full KOL data
    const fullKOL = get().getKOL(walletAddress);
    if (fullKOL) {
      return {
        name: fullKOL.name,
        avatar: fullKOL.avatar,
        socialLinks: fullKOL.socialLinks,
      };
    }
    
    // Then check metadata cache (longer TTL)
    return cacheManager.getKOLMetadata(walletAddress);
  },

  loadFromCache: () => {
    const cachedKOLs = cacheManager.getAllKOLData();
    if (Object.keys(cachedKOLs).length > 0) {
      set(state => ({
        kolByWallet: { ...state.kolByWallet, ...cachedKOLs },
        hasLoadedAll: Object.keys(cachedKOLs).length > 10, // Assume we have most KOLs if we have 10+
      }));
    }
  },

  // Helper method to enhance KOL with Twitter avatar
  enhanceKOLWithTwitterAvatar: (kol: KOLWallet): KOLWallet => {
    const twitterUrl = findTwitterUrlFromKOL(kol);
    const twitterAvatar = getTwitterAvatarUrl(
      twitterUrl,
      kol.name || kol.walletAddress || 'KOL'
    );
    
    // Prioritize Twitter avatar over store avatar (same as kol-list.tsx)
    const preferredAvatar = twitterAvatar ?? kol.avatar;
    
    return {
      ...kol,
      avatar: preferredAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(kol.name || kol.walletAddress || 'KOL')}`,
    };
  },

  loadAllKOLs: async () => {
    const state = get();
    if (state.isLoadingAll || state.hasLoadedAll) {
      return; // Already loading or loaded
    }

    // First try to load from cache
    get().loadFromCache();
    
    // If we have cached data, we might not need to fetch from API
    const cachedState = get();
    if (cachedState.hasLoadedAll) {
      return;
    }

    set({ isLoadingAll: true });
    try {
      // Call the endpoint without any query parameters to get all featured KOLs
      const response = await TradingService.getKOLWallets();
      if (response.data && response.data.length > 0) {
        get().setKOLs(response.data);
      }
    } catch (error) {
      console.error('Failed to load all KOLs:', error);
    } finally {
      set({ isLoadingAll: false });
    }
  },

  ensureKOL: async (walletAddress: string) => {
    if (!walletAddress) return undefined;
    const lower = walletAddress.toLowerCase();
    
    // First check if we already have this KOL
    const existing = get().kolByWallet[lower];
    if (existing) return existing;

    // If we haven't loaded all KOLs yet, load them all first
    const state = get();
    if (!state.hasLoadedAll && !state.isLoadingAll) {
      await get().loadAllKOLs();
      // Check again after loading all KOLs
      const afterLoad = get().kolByWallet[lower];
      if (afterLoad) return afterLoad;
    }

    // If we still don't have the KOL after loading all, it might not be a featured KOL
    // In this case, we return undefined instead of making individual API calls
    return undefined;
  },

  ensureKOLs: async (walletAddresses: string[]) => {
    if (!walletAddresses.length) return [];

    // Check if we need to load all KOLs first
    const state = get();
    if (!state.hasLoadedAll && !state.isLoadingAll) {
      await get().loadAllKOLs();
    }

    // Return the KOLs (some might be undefined if they're not featured KOLs)
    return walletAddresses.map(address => get().getKOL(address));
  },
}));

// Initialize cache loading when the store is created
if (typeof window !== 'undefined') {
  // Load cached data immediately when the store is created
  const store = useKOLStore.getState();
  store.loadFromCache();
} 