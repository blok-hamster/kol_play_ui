import { TokenMetadata } from '@/types';

export interface ExtendedTokenMetadata extends TokenMetadata {
  mint: string;
  priceChange24h?: number;
  liquidity?: number;
  marketCap?: number;
  pairAddress?: string;
}

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  info?: {
    imageUrl?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
}

interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[];
}

export class TokenMetadataService {
  private static readonly DEXSCREENER_BASE_URL = 'https://api.dexscreener.com/latest/dex/tokens';
  private static readonly GECKOTERMINAL_BASE_URL = 'https://api.geckoterminal.com/api/v2/networks/solana/tokens';

  /**
   * Fetch metadata for a single token
   * @param mint Token mint address
   * @returns Token metadata or null if not found
   */
  static async getTokenMetadata(mint: string): Promise<ExtendedTokenMetadata | null> {
    if (!mint) return null;

    try {
      // 1. Try DexScreener first
      const dexData = await this.fetchFromDexScreener(mint);
      if (dexData) return dexData;
      
      console.warn(`DexScreener failed for ${mint}, trying GeckoTerminal fallback...`);
      
      // 2. Fallback to GeckoTerminal
      return await this.fetchFromGeckoTerminal(mint);
    } catch (error) {
      console.error('Error fetching token metadata from all sources:', error);
      return null;
    }
  }

  private static async fetchFromDexScreener(mint: string): Promise<ExtendedTokenMetadata | null> {
    try {
      const response = await fetch(`${this.DEXSCREENER_BASE_URL}/${mint}`);
      if (!response.ok) {
        throw new Error(`DexScreener fetch failed: ${response.statusText}`);
      }

      const data: DexScreenerResponse = await response.json();
      
      if (!data.pairs || data.pairs.length === 0) {
        return null;
      }

      // Filter for Solana pairs if possible, or just take the most liquid pair
      // DexScreener usually returns sorted by liquidity/relevance, but we can double check
      const pairs = data.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
      const bestPair = pairs[0];

      return this.mapDexScreenerToMetadata(bestPair, mint);
    } catch (error) {
      console.warn('DexScreener error:', error);
      return null;
    }
  }

  private static async fetchFromGeckoTerminal(mint: string): Promise<ExtendedTokenMetadata | null> {
    try {
      const response = await fetch(`${this.GECKOTERMINAL_BASE_URL}/${mint}`);
      if (!response.ok) {
        throw new Error(`GeckoTerminal fetch failed: ${response.statusText}`);
      }

      const data = await response.json();
      const tokenAttributes = data.data?.attributes;

      if (!tokenAttributes) return null;
      
      return {
        mint: mint,
        name: tokenAttributes.name,
        symbol: tokenAttributes.symbol,
        ...(tokenAttributes.image_url ? { image: tokenAttributes.image_url } : {}),
        decimals: tokenAttributes.decimals || 6,
        priceUsd: parseFloat(tokenAttributes.price_usd || '0'),
        priceChange24h: 0,
        liquidityUsd: 0,
        liquidity: 0,
        marketCapUsd: parseFloat(tokenAttributes.fdv_usd || tokenAttributes.market_cap_usd || '0'),
        marketCap: parseFloat(tokenAttributes.fdv_usd || tokenAttributes.market_cap_usd || '0'),
        lastUpdated: Date.now(),
        verified: true
      };
    } catch (error) {
      console.warn('GeckoTerminal error:', error);
      return null;
    }
  }

  /**
   * Fetch metadata for multiple tokens
   * @param mints Array of token mint addresses
   * @returns Map of mint address to token metadata
   */
  static async getMultipleTokenMetadata(mints: string[]): Promise<Map<string, ExtendedTokenMetadata>> {
    const results = new Map<string, ExtendedTokenMetadata>();
    const uniqueMints = Array.from(new Set(mints.filter(m => m)));

    if (uniqueMints.length === 0) return results;

    // DexScreener supports up to 30 addresses per call
    const BATCH_SIZE = 30;
    const batches = [];

    for (let i = 0; i < uniqueMints.length; i += BATCH_SIZE) {
      batches.push(uniqueMints.slice(i, i + BATCH_SIZE));
    }

    try {
      await Promise.all(batches.map(async (batch) => {
        const batchUrl = `${this.DEXSCREENER_BASE_URL}/${batch.join(',')}`;
        const response = await fetch(batchUrl);
        
        if (!response.ok) {
          console.warn(`Failed to fetch batch metadata: ${response.statusText}`);
          return;
        }

        const data: DexScreenerResponse = await response.json();
        
        if (data.pairs) {
          // Explicitly match requested mints against pairs to avoid case-mismatch issues
          // or base/quote confusion (though usually base is what we want)
          batch.forEach(requestedMint => {
            const matchingPairs = data.pairs.filter(p => 
              p.baseToken.address.toLowerCase() === requestedMint.toLowerCase()
            );

            if (matchingPairs.length > 0) {
              const bestPair = matchingPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
              results.set(requestedMint, this.mapDexScreenerToMetadata(bestPair, requestedMint));
            }
          });
        }
      }));
    } catch (error) {
      console.error('Error fetching multiple token metadata:', error);
    }
    
    // Fill in missing tokens with GeckoTerminal fallback concurrently
    const missingMints = uniqueMints.filter(mint => !results.has(mint));
    if (missingMints.length > 0) {
       // Reduce concurrency to avoid rate limits (30 calls/min free tier)
       const CONCURRENCY_LIMIT = 2; 
       for (let i=0; i < missingMints.length; i+= CONCURRENCY_LIMIT) {
           const chunk = missingMints.slice(i, i+CONCURRENCY_LIMIT);
           await Promise.all(chunk.map(async (mint) => {
               const fallbackData = await this.fetchFromGeckoTerminal(mint);
               if (fallbackData) {
                   results.set(mint, fallbackData);
               }
           }));
           // Small delay to respect rate limits roughly
           if (i + CONCURRENCY_LIMIT < missingMints.length) {
             await new Promise(resolve => setTimeout(resolve, 1000));
           }
       }
    }

    return results;
  }

  private static mapDexScreenerToMetadata(pair: DexScreenerPair, mint: string): ExtendedTokenMetadata {
    return {
      mint: mint, // Ensure we return the requested mint
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      ...(pair.info?.imageUrl ? { image: pair.info.imageUrl } : {}),
      decimals: 6, // DexScreener doesn't always provide decimals in this view, defaulting to 6 is risky but common for display
      priceUsd: parseFloat(pair.priceUsd),
      priceChange24h: pair.priceChange?.h24 || 0,
      liquidityUsd: pair.liquidity?.usd || 0,
      liquidity: pair.liquidity?.usd || 0,
      marketCapUsd: pair.marketCap || pair.fdv || 0,
      marketCap: pair.marketCap || pair.fdv || 0,
      pairAddress: pair.pairAddress,
      lastUpdated: Date.now(),
      verified: true // Assuming listed on DexScreener implies some level of existence
    };
  }
}
