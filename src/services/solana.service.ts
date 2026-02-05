import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  ParsedAccountData,
} from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { TokenListProvider } from "@solana/spl-token-registry";
import {
  SolanaWalletBalance,
  SolanaTokenInfo,
  SolanaTokenMetadata,
  SolanaConnectionConfig,
} from '@/types';
import { TokenMetadataService } from './token-metadata.service';

// Token metadata cache to avoid repeated API calls
const tokenMetadataCache = new Map<string, SolanaTokenMetadata>();

// Jupiter token list cache to avoid refetching the entire list
let jupiterTokenListCache: Map<string, any> | null = null;
let jupiterTokenListCacheTime = 0;
const JUPITER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Price data cache to avoid repeated API calls
const priceCache = new Map<string, { price: number; timestamp: number }>();
const PRICE_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Cache for trending tokens
const trendingTokensCache = {
  data: [] as any[],
  timestamp: 0,
  duration: 5 * 60 * 1000 // 5 minutes
};

// Cache for high volume tokens
const highVolumeTokensCache = {
  data: [] as any[],
  timestamp: 0,
  duration: 5 * 60 * 1000 // 5 minutes
};

// Cache for new tokens
const newTokensCache = {
  data: [] as any[],
  timestamp: 0,
  duration: 1 * 60 * 1000 // 1 minute
};

interface JupiterToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  tags: string[];
  daily_volume?: number;
}

interface GeckoPool {
  id: string;
  type: string;
  attributes: {
    address: string;
    name: string;
    pool_created_at: string;
    base_token_price_usd: string;
    quote_token_price_usd: string;
    reserve_in_usd: string;
    volume_usd: {
      h24: string;
    };
    price_change_percentage: {
      h1: string;
      h24: string;
    };
  };
  relationships: {
    base_token: {
      data: {
        id: string; // network_address
      };
    };
    quote_token: {
      data: {
        id: string;
      };
    };
  };
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
  info: {
    imageUrl: string;
    websites: { label: string; url: string }[];
    socials: { type: string; url: string }[];
  };
}


/**
 * Fetch Jupiter token list with caching
 * @returns Promise<Map<string, any>> - Map of token addresses to token data
 */
async function fetchJupiterTokenList(): Promise<Map<string, any>> {
  const now = Date.now();
  
  // Return cached version if still valid
  if (jupiterTokenListCache && (now - jupiterTokenListCacheTime) < JUPITER_CACHE_DURATION) {
    return jupiterTokenListCache;
  }

  // Try verified tokens first for better metadata quality, then expand to all tokens
  const endpoints = [
    { url: 'https://tokens.jup.ag/tokens?tags=verified,community', description: 'verified & community' },
    { url: 'https://tokens.jup.ag/tokens', description: 'all tokens' }
  ];

  for (const endpoint of endpoints) {
    try {
      void 0 && (`🔄 Fetching Jupiter token list (${endpoint.description})...`);
      const response = await fetch(endpoint.url);
      
      if (!response.ok) {
        console.warn(`Jupiter API ${endpoint.description} returned ${response.status}: ${response.statusText}`);
        continue; // Try next endpoint
      }
      
      const tokenList = await response.json();
      
      if (!Array.isArray(tokenList)) {
        console.warn(`Jupiter API ${endpoint.description} returned unexpected format:`, typeof tokenList);
        continue; // Try next endpoint
      }
      
      // Create a map of mint addresses to token info, filtering for tokens with names/symbols
      const jupiterTokenMap = new Map();
      let tokensWithMetadata = 0;
      let totalTokens = 0;
      
      for (const token of tokenList) {
        totalTokens++;
        
        // Only include tokens that have at least a symbol or name
        if (token.address && (token.symbol || token.name)) {
          jupiterTokenMap.set(token.address, {
            name: token.name || token.symbol, // Fallback to symbol if no name
            symbol: token.symbol || token.name, // Fallback to name if no symbol
            logoURI: token.logoURI,
            decimals: token.decimals || 0
          });
          tokensWithMetadata++;
        }
      }

      // Only use this result if we got a reasonable number of tokens with metadata
      if (tokensWithMetadata > 100) { // Sanity check
        // Update cache
        jupiterTokenListCache = jupiterTokenMap;
        jupiterTokenListCacheTime = now;
        
        void 0 && (`✅ Cached ${tokensWithMetadata} tokens with metadata from ${totalTokens} total (${endpoint.description})`);
        return jupiterTokenMap;
      } else {
        console.warn(`Only found ${tokensWithMetadata} tokens with metadata from ${endpoint.description}, trying next endpoint...`);
      }
    } catch (error) {
      console.warn(`Failed to fetch Jupiter token list (${endpoint.description}):`, error);
      continue; // Try next endpoint
    }
  }
  
  console.warn('All Jupiter token list endpoints failed, returning empty map');
  return new Map();
}

/**
 * Fetch token prices from Jupiter Price API V2
 * Note: This API now requires authentication and may return 401
 * @param mintAddresses - Array of mint addresses to get prices for
 * @returns Promise<Map<string, number>> - Map of mint address to USD price
 */
async function fetchJupiterPrices(mintAddresses: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  
  if (mintAddresses.length === 0) {
    return priceMap;
  }

  try {
    // Jupiter Price API V2 - supports batch requests but requires auth
    const mints = mintAddresses.join(',');
    const response = await fetch(`https://api.jup.ag/price/v2?ids=${mints}`);
    
    if (!response.ok) {
      // 401 means authentication required - skip silently
      if (response.status === 401) {
        // console.log('Jupiter Price API requires authentication, skipping price fetch');
        return priceMap;
      }
      console.warn(`Jupiter Price API returned ${response.status}: ${response.statusText}`);
      return priceMap;
    }
    
    const data = await response.json();
    
    if (data?.data) {
      for (const [mint, priceInfo] of Object.entries(data.data)) {
        if (typeof priceInfo === 'object' && priceInfo !== null && 'price' in priceInfo) {
          const price = (priceInfo as any).price;
          if (typeof price === 'number' && price > 0) {
            priceMap.set(mint, price);
          }
        }
      }
    }
    
    console.log(`✅ Fetched ${priceMap.size} prices from Jupiter API`);
    return priceMap;
  } catch (error) {
    console.warn('Failed to fetch prices from Jupiter API:', error);
    return priceMap;
  }
}

/**
 * Fetch SOL price from CoinGecko Public API
 * @returns Promise<number> - SOL price in USD
 */
async function fetchSolPriceFromCoinGecko(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    
    if (!response.ok) {
      console.warn(`CoinGecko API returned ${response.status}: ${response.statusText}`);
      return 0;
    }
    
    const data = await response.json();
    
    if (data?.solana?.usd && typeof data.solana.usd === 'number') {
      void 0 && (`✅ Fetched SOL price from CoinGecko: $${data.solana.usd}`);
      return data.solana.usd;
    }
    
    return 0;
  } catch (error) {
    console.warn('Failed to fetch SOL price from CoinGecko:', error);
    return 0;
  }
}

/**
 * Fetch token prices from CoinGecko using contract addresses
 * @param mintAddresses - Array of mint addresses
 * @returns Promise<Map<string, number>> - Map of mint address to USD price
 */
async function fetchCoinGeckoPrices(mintAddresses: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  
  if (mintAddresses.length === 0) {
    return priceMap;
  }

  try {
    // CoinGecko supports batch requests for contract addresses
    const contracts = mintAddresses.join(',');
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${contracts}&vs_currencies=usd`);
    
    if (!response.ok) {
      console.warn(`CoinGecko token price API returned ${response.status}: ${response.statusText}`);
      return priceMap;
    }
    
    const data = await response.json();
    
    for (const [mint, priceInfo] of Object.entries(data)) {
      if (typeof priceInfo === 'object' && priceInfo !== null && 'usd' in priceInfo) {
        const price = (priceInfo as any).usd;
        if (typeof price === 'number' && price > 0) {
          priceMap.set(mint, price);
        }
      }
    }
    
    void 0 && (`✅ Fetched ${priceMap.size} token prices from CoinGecko`);
    return priceMap;
  } catch (error) {
    console.warn('Failed to fetch token prices from CoinGecko:', error);
    return priceMap;
  }
}

/**
 * Solana service for interacting with the Solana blockchain
 * Provides methods to get wallet balances and token information
 */
export class SolanaService {
  private static connection: Connection;
  private static defaultRpcUrl = process.env.NEXT_RPC_URL || 'https://solana-mainnet.g.alchemy.com/v2/XtQLzQGpbTeGh_UhaGg6c';
  
  // Well-known SPL Token Program ID
  private static readonly TOKEN_PROGRAM_ID = new PublicKey(
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
  );

  /**
   * Initialize the Solana connection
   */
  static initialize(config?: SolanaConnectionConfig): void {
    const rpcUrl = config?.rpcUrl || this.defaultRpcUrl;
    const commitment = config?.commitment || 'confirmed';
    
    this.connection = new Connection(rpcUrl, commitment);
  }

  /**
   * Get connection instance, initializing if needed
   */
  private static getConnection(): Connection {
    if (!this.connection) {
      this.initialize();
    }
    return this.connection;
  }



  /**
   * Fetch token metadata using comprehensive token info lookup (batch)
   * @param mintAddresses - Array of mint addresses
   * @returns Promise<Map<string, SolanaTokenMetadata>> - Map of mint address to metadata
   */
  static async fetchTokenMetadataBatch(mintAddresses: string[]): Promise<Map<string, SolanaTokenMetadata>> {
    const metadataMap = new Map<string, SolanaTokenMetadata>();
    
    // Check cache first
    const uncachedMints: string[] = [];
    for (const mint of mintAddresses) {
      if (tokenMetadataCache.has(mint)) {
        metadataMap.set(mint, tokenMetadataCache.get(mint)!);
      } else {
        uncachedMints.push(mint);
      }
    }

    if (uncachedMints.length === 0) {
      return metadataMap;
    }

    try {
      // Use TokenMetadataService for robust fetching (DexScreener + GeckoTerminal fallback)
      const metadataResults = await TokenMetadataService.getMultipleTokenMetadata(uncachedMints);
      
      // Process results from TokenMetadataService
      for (const mint of uncachedMints) {
        const extendedMetadata = metadataResults.get(mint);
        
        let metadata: SolanaTokenMetadata;
        
        if (extendedMetadata) {
          metadata = {
            name: extendedMetadata.name,
            symbol: extendedMetadata.symbol,
            logoURI: extendedMetadata.image,
            decimals: extendedMetadata.decimals
          };
        } else {
          // If TokenMetadataService failed to find it, it might not be indexed yet.
          // Fallback to basic mint info from RPC (decimals only)
           try {
            const connection = this.getConnection();
            const mintInfo = await getMint(connection, new PublicKey(mint));
            metadata = {
              name: undefined,
              symbol: undefined,
              logoURI: undefined,
              decimals: mintInfo.decimals
            };
          } catch {
             metadata = {
              name: undefined,
              symbol: undefined,
              logoURI: undefined,
              decimals: 0
            };
          }
        }
        
        tokenMetadataCache.set(mint, metadata);
        metadataMap.set(mint, metadata);
      }
    } catch (error) {
       console.warn('Failed to fetch token metadata via TokenMetadataService:', error);
       // Error handling generally covered by TokenMetadataService, but if global fail, fallback to empty/decimals
       // ... (Implementation detail: could iterate uncachedMints and try RPC one last time or just return empty)
    }

    return metadataMap;
  }

  /**
   * Get SOL balance for a wallet address
   * @param address - Wallet address as string
   * @returns Promise<number> - Balance in SOL units
   */
  static async getSolBalance(address: string): Promise<number> {
    try {
      const connection = this.getConnection();
      const publicKey = new PublicKey(address);
      
      const balance = await connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error fetching SOL balance:', error);
      throw new Error(`Failed to fetch SOL balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all SPL tokens held by a wallet address
   * @param address - Wallet address as string
   * @param includeMetadata - Whether to fetch token metadata (default: true)
   * @returns Promise<SolanaTokenInfo[]> - Array of token information
   */
  static async getTokens(address: string, includeMetadata: boolean = true): Promise<SolanaTokenInfo[]> {
    try {
      const connection = this.getConnection();
      const publicKey = new PublicKey(address);

      // Get all token accounts owned by the wallet in one request
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        {
          programId: this.TOKEN_PROGRAM_ID,
        }
      );

      // Filter out zero balance accounts and prepare mint addresses
      const validTokenAccounts = tokenAccounts.value.filter(tokenAccount => {
        const accountData = tokenAccount.account.data as ParsedAccountData;
        const parsedInfo = accountData.parsed.info;
        return parsedInfo.tokenAmount.uiAmount > 0;
      });

      if (validTokenAccounts.length === 0) {
        return [];
      }

      // Extract mint addresses
      const mintAddresses = validTokenAccounts.map(tokenAccount => {
        const accountData = tokenAccount.account.data as ParsedAccountData;
        return accountData.parsed.info.mint;
      });

      // Fetch metadata for all tokens in batch
      let metadataMap = new Map<string, SolanaTokenMetadata>();
      if (includeMetadata) {
        metadataMap = await this.fetchTokenMetadataBatch(mintAddresses);
      }

      // Build the final token list with all information
      const tokens: SolanaTokenInfo[] = validTokenAccounts.map((tokenAccount) => {
        const accountData = tokenAccount.account.data as ParsedAccountData;
        const parsedInfo = accountData.parsed.info;
        const metadata = metadataMap.get(parsedInfo.mint);

        return {
          mintAddress: parsedInfo.mint,
          balance: parseFloat(parsedInfo.tokenAmount.amount),
          decimals: parsedInfo.tokenAmount.decimals,
          uiAmount: parsedInfo.tokenAmount.uiAmount,
          name: metadata?.name,
          symbol: metadata?.symbol,
          logoURI: metadata?.logoURI,
        };
      });

      return tokens;
    } catch (error) {
      console.error('Error fetching tokens:', error);
      throw new Error(`Failed to fetch tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all SPL tokens held by a wallet address with optional metadata
   * @param address - Wallet address as string
   * @param options - Options for fetching additional data
   * @returns Promise<SolanaTokenInfo[]> - Array of token information
   */
  static async getTokensWithMetadata(
    address: string, 
    options: { includeMetadata?: boolean; metadataSource?: 'solana-token-list' } = {}
  ): Promise<SolanaTokenInfo[]> {
    try {
      // First get basic token information efficiently
      const tokens = await this.getTokens(address);
      
      // If metadata is not requested, return basic info
      if (!options.includeMetadata) {
        return tokens;
      }

      // If metadata is requested, we could integrate with external token registries
      // For now, we'll return the basic tokens without making additional requests
      // This can be extended in the future to integrate with:
      // - Solana Token List (https://github.com/solana-labs/token-list)
      // - Jupiter Token API
      // - Metaplex Metadata Program
      
      void 0 && ('Metadata fetching not yet implemented. Returning basic token info.');
      return tokens;
    } catch (error) {
      console.error('Error fetching tokens with metadata:', error);
      throw new Error(`Failed to fetch tokens with metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get complete wallet balance including SOL and all SPL tokens
   * @param address - Wallet address as string
   * @returns Promise<SolanaWalletBalance> - Complete wallet balance information
   */
  static async getWalletBalance(address: string): Promise<SolanaWalletBalance> {
    try {
      const [solBalance, tokens] = await Promise.all([
        this.getSolBalance(address),
        this.getTokens(address),
      ]);

      return {
        address,
        solBalance,
        tokens,
        totalTokens: tokens.length,
      };
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      throw new Error(`Failed to fetch wallet balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get balance for a specific SPL token
   * @param walletAddress - Wallet address as string
   * @param mintAddress - Token mint address as string
   * @returns Promise<SolanaTokenInfo | null> - Token information or null if not found
   */
  static async getSpecificTokenBalance(
    walletAddress: string,
    mintAddress: string
  ): Promise<SolanaTokenInfo | null> {
    try {
      const connection = this.getConnection();
      const walletPublicKey = new PublicKey(walletAddress);
      const mintPublicKey = new PublicKey(mintAddress);

      // Get token accounts for the specific mint
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        {
          mint: mintPublicKey,
        }
      );

      if (tokenAccounts.value.length === 0) {
        return null; // No token account found
      }

      // Use the first token account (there should typically be only one)
      const tokenAccount = tokenAccounts.value[0];
      const accountData = tokenAccount.account.data as ParsedAccountData;
      const parsedInfo = accountData.parsed.info;

      return {
        mintAddress,
        balance: parseFloat(parsedInfo.tokenAmount.amount),
        decimals: parsedInfo.tokenAmount.decimals,
        uiAmount: parsedInfo.tokenAmount.uiAmount,
        name: undefined,
        symbol: undefined,
        logoURI: undefined,
      };
    } catch (error) {
      console.error('Error fetching specific token balance:', error);
      throw new Error(`Failed to fetch token balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get token metadata from the mint account
   * @param mintAddress - Token mint address as string
   * @returns Promise<SolanaTokenMetadata> - Token metadata
   */
  static async getTokenMetadata(mintAddress: string): Promise<SolanaTokenMetadata> {
    try {
      const connection = this.getConnection();
      const mintPublicKey = new PublicKey(mintAddress);

      // Get mint account info
      const mintInfo = await getMint(connection, mintPublicKey);

      // For now, we can only get decimals from the mint account
      // Name, symbol, and logoURI would typically come from metadata programs
      // or external token lists, which is more complex to implement
      return {
        decimals: mintInfo.decimals,
        name: undefined,
        symbol: undefined,
        logoURI: undefined,
      };
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      throw new Error(`Failed to fetch token metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate if a string is a valid Solana address
   * @param address - Address string to validate
   * @returns boolean - True if valid, false otherwise
   */
  static isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set custom RPC endpoint
   * @param rpcUrl - Custom RPC URL
   * @param commitment - Transaction commitment level
   */
  static setRpcEndpoint(rpcUrl: string, commitment?: 'processed' | 'confirmed' | 'finalized'): void {
    this.initialize({ rpcUrl, commitment: commitment || 'confirmed' });
  }

  /**
   * Get current RPC endpoint URL
   * @returns string - Current RPC URL
   */
  static getRpcEndpoint(): string {
    return this.getConnection().rpcEndpoint;
  }

  /**
   * Test connection to the RPC endpoint
   * @returns Promise<boolean> - True if connection is successful
   */
  static async testConnection(): Promise<boolean> {
    try {
      const connection = this.getConnection();
      await connection.getLatestBlockhash();
      return true;
    } catch (error) {
      console.error('RPC connection test failed:', error);
      return false;
    }
  }

  /**
   * Get USD price for SOL
   * @returns Promise<number> - SOL price in USD
   */
  static async getSolPrice(): Promise<number> {
    const cacheKey = 'SOL';
    const now = Date.now();
    
    // Check cache first
    if (priceCache.has(cacheKey)) {
      const cached = priceCache.get(cacheKey)!;
      if ((now - cached.timestamp) < PRICE_CACHE_DURATION) {
        return cached.price;
      }
    }

    try {
      // Try CoinGecko first for SOL price (more reliable for major tokens)
      let price = await fetchSolPriceFromCoinGecko();
      
      // Fallback to Jupiter if CoinGecko fails
      if (price === 0) {
        void 0 && ('🔄 Falling back to Jupiter for SOL price...');
        const solMint = 'So11111111111111111111111111111111111111112'; // Wrapped SOL mint
        const jupiterPrices = await fetchJupiterPrices([solMint]);
        price = jupiterPrices.get(solMint) || 0;
      }
      
      // Cache the result
      if (price > 0) {
        priceCache.set(cacheKey, { price, timestamp: now });
        void 0 && (`✅ SOL price cached: $${price}`);
      }
      
      return price;
    } catch (error) {
      console.error('Failed to fetch SOL price:', error);
      return 0;
    }
  }

  /**
   * Get USD prices for multiple tokens
   * @param mintAddresses - Array of mint addresses
   * @returns Promise<Map<string, number>> - Map of mint address to USD price
   */
  static async getTokenPrices(mintAddresses: string[]): Promise<Map<string, number>> {
    if (mintAddresses.length === 0) {
      return new Map();
    }

    const now = Date.now();
    const priceMap = new Map<string, number>();
    const uncachedMints: string[] = [];

    // Check cache first
    for (const mint of mintAddresses) {
      if (priceCache.has(mint)) {
        const cached = priceCache.get(mint)!;
        if ((now - cached.timestamp) < PRICE_CACHE_DURATION) {
          priceMap.set(mint, cached.price);
        } else {
          uncachedMints.push(mint);
        }
      } else {
        uncachedMints.push(mint);
      }
    }

    if (uncachedMints.length === 0) {
      return priceMap;
    }

    try {
      // 1. Try TokenMetadataService (DexScreener/GeckoTerminal) first
      // This is often the most up-to-date for memes and new tokens
      const metadataMap = await TokenMetadataService.getMultipleTokenMetadata(uncachedMints);
      
      metadataMap.forEach((metadata, mint) => {
        if (metadata.priceUsd > 0) {
           priceMap.set(mint, metadata.priceUsd);
        }
      });
      
      // Find tokens that we still don't have prices for
      const remainingMints = uncachedMints.filter(mint => !priceMap.has(mint));
      
      if (remainingMints.length > 0) {
        // 2. Try Jupiter for remaining tokens
        const jupiterPrices = await fetchJupiterPrices(remainingMints);
        
        jupiterPrices.forEach((price, mint) => {
            priceMap.set(mint, price);
        });
        
        // Find tokens that Jupiter couldn't price
        const finalRemainingMints = remainingMints.filter(mint => !priceMap.has(mint));
        
        // 3. Try CoinGecko for anything left
        if (finalRemainingMints.length > 0) {
           const coinGeckoPrices = await fetchCoinGeckoPrices(finalRemainingMints);
           coinGeckoPrices.forEach((price, mint) => {
                priceMap.set(mint, price);
           });
        }
      }


      
      // Cache all new results
      for (const mint of uncachedMints) {
        const price = priceMap.get(mint);
        if (price !== undefined) {
             priceCache.set(mint, { price, timestamp: now });
        }
      }

      void 0 && (`✅ Fetched prices for ${priceMap.size}/${uncachedMints.length} tokens`);
      
      return priceMap;
    } catch (error) {
      console.error('Failed to fetch token prices:', error);
      return priceMap;
    }
  }

  /**
   * Convert SOL amount to USD value
   * @param solAmount - Amount of SOL
   * @returns Promise<number> - USD value
   */
  static async convertSolToUsd(solAmount: number): Promise<number> {
    if (solAmount <= 0) return 0;
    
    const solPrice = await this.getSolPrice();
    return solAmount * solPrice;
  }

  /**
   * Convert token amount to USD value
   * @param mintAddress - Token mint address
   * @param tokenAmount - Amount of tokens (in UI units, not raw units)
   * @returns Promise<number> - USD value
   */
  static async convertTokenToUsd(mintAddress: string, tokenAmount: number): Promise<number> {
    if (tokenAmount <= 0) return 0;
    
    const prices = await this.getTokenPrices([mintAddress]);
    const tokenPrice = prices.get(mintAddress) || 0;
    
    return tokenAmount * tokenPrice;
  }

  /**
   * Convert multiple token amounts to USD values
   * @param tokens - Array of {mintAddress, amount} objects
   * @returns Promise<Map<string, number>> - Map of mint address to USD value
   */
  static async convertTokensToUsd(tokens: { mintAddress: string; amount: number }[]): Promise<Map<string, number>> {
    const valueMap = new Map<string, number>();
    
    if (tokens.length === 0) {
      return valueMap;
    }

    // Get all unique mint addresses
    const mintAddresses = Array.from(new Set(tokens.map(t => t.mintAddress)));
    const prices = await this.getTokenPrices(mintAddresses);

    // Calculate USD values
    for (const token of tokens) {
      const price = prices.get(token.mintAddress) || 0;
      const value = token.amount * price;
      valueMap.set(token.mintAddress, value);
    }

    return valueMap;
  }

  /**
   * Get current network prioritization fee estimate (median) in micro-lamports per compute unit
   * Uses getRecentPrioritizationFees RPC and returns a simple median for stability
   */
  static async getPriorityFeeMicroLamportsPerCU(): Promise<number> {
    try {
      const connection = this.getConnection();
      // Returns array of { slot, priorityFeeEstimate } in micro-lamports per CU
      // Typing as any to support multiple RPC versions
      // @ts-expect-error
      const fees: Array<{ slot: number; priorityFeeEstimate: number }> = await (connection as any).getRecentPrioritizationFees();
      if (!Array.isArray(fees) || fees.length === 0) {
        return 0;
      }
      const values = fees
        .map((f: any) => Number(f?.priorityFeeEstimate))
        .filter(v => Number.isFinite(v) && v >= 0)
        .sort((a, b) => a - b);
      if (values.length === 0) return 0;
      const mid = Math.floor(values.length / 2);
      return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
    } catch (error) {
      console.warn('Failed to fetch prioritization fees:', error);
      return 0;
    }
  }

  /**
   * Get complete wallet balance with USD values
   * @param address - Wallet address as string
   * @returns Promise<SolanaWalletBalance & { totalValueUsd: number }> - Complete wallet balance with USD values
   */
  static async getWalletBalanceWithUsd(address: string): Promise<SolanaWalletBalance & { 
    totalValueUsd: number;
    solValueUsd: number;
  }> {
    try {
      // Get basic wallet data
      const walletBalance = await this.getWalletBalance(address);
      
      // Get SOL price and calculate SOL value in USD
      const [solValueUsd, tokenValues] = await Promise.all([
        this.convertSolToUsd(walletBalance.solBalance),
        this.convertTokensToUsd(
          walletBalance.tokens.map(token => ({
            mintAddress: token.mintAddress,
            amount: token.uiAmount || 0
          }))
        )
      ]);

      // Update tokens with USD values
      const tokensWithUsd = walletBalance.tokens.map(token => ({
        ...token,
        valueUsd: tokenValues.get(token.mintAddress) || 0
      }));

      // Calculate total USD value
      const totalTokenValueUsd = Array.from(tokenValues.values()).reduce((sum, value) => sum + value, 0);
      const totalValueUsd = solValueUsd + totalTokenValueUsd;

      return {
        ...walletBalance,
        tokens: tokensWithUsd,
        solValueUsd,
        totalValueUsd
      };
    } catch (error) {
      console.error('Error fetching wallet balance with USD values:', error);
      throw new Error(`Failed to fetch wallet balance with USD values: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get complete wallet balance with USD values and enriched token details
   * @param address - Wallet address as string
   * @param enrichTokens - Whether to fetch detailed token information
   * @returns Promise<SolanaWalletBalance & { totalValueUsd: number }> - Complete wallet balance with USD values and optional enriched token data
   */
  static async getWalletBalanceWithEnrichedTokens(
    address: string,
    enrichTokens: boolean = false
  ): Promise<SolanaWalletBalance & { 
    totalValueUsd: number;
    solValueUsd: number;
    enrichedTokens?: boolean;
  }> {
    try {
      // Get basic wallet data with USD values
      const walletData = await this.getWalletBalanceWithUsd(address);

      if (!enrichTokens || walletData.tokens.length === 0) {
        return {
          ...walletData,
          enrichedTokens: false
        };
      }

      // Import TokenService dynamically to avoid circular dependencies
      const { TokenService } = await import('@/services/token.service');
      
      // Extract mint addresses from tokens
      const mintAddresses = walletData.tokens.map(token => token.mintAddress);
      
      try {
        // Fetch detailed token information
        void 0 && (`🔄 Enriching ${mintAddresses.length} tokens with detailed information...`);
        const tokenDetailsResponse = await TokenService.getMultipleTokens(mintAddresses, {
          batchSize: 20,
          maxConcurrentBatches: 2
        });

        // Create a map of mint address to detailed token info
        const tokenDetailsMap = new Map();
        tokenDetailsResponse.data.forEach(tokenDetail => {
          const mintAddress = tokenDetail.mint || tokenDetail.token?.mint;
          if (mintAddress) {
            tokenDetailsMap.set(mintAddress, tokenDetail);
          }
        });

        // Enrich tokens with detailed information
        const enrichedTokens = walletData.tokens.map(token => {
          const details = tokenDetailsMap.get(token.mintAddress);
          if (details) {
            return {
              ...token,
              // Override with more detailed information if available
              name: details.token.name || token.name,
              symbol: details.token.symbol || token.symbol,
              logoURI: details.token.image || details.token.logoURI || token.logoURI,
              // Add additional enriched data
              enrichedData: {
                pools: details.pools || [],
                events: details.events || {},
                risk: details.risk || { rugged: false, risks: [], score: 0 },
                buys: details.buys || 0,
                sells: details.sells || 0,
                txns: details.txns || 0,
                holders: details.holders || 0,
                description: details.token.description,
                website: details.token.website,
                twitter: details.token.twitter,
                telegram: details.token.telegram
              }
            };
          }
          return token;
        });

        void 0 && (`✅ Successfully enriched ${enrichedTokens.length} tokens with detailed information`);

        return {
          ...walletData,
          tokens: enrichedTokens,
          enrichedTokens: true
        };

      } catch (enrichError) {
        console.warn('Failed to enrich tokens with detailed information:', enrichError);
        // Return basic data if enrichment fails
        return {
          ...walletData,
          enrichedTokens: false
        };
      }

    } catch (error) {
      console.error('Error fetching wallet balance with enriched tokens:', error);
      throw new Error(`Failed to fetch wallet balance with enriched tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get trending tokens using existing Jupiter token list cache
   * Falls back to Solana Token Registry
   */
  static async getTrendingTokens(): Promise<any[]> {
    try {
      const now = Date.now();
      if (trendingTokensCache.data.length > 0 && (now - trendingTokensCache.timestamp) < trendingTokensCache.duration) {
        return trendingTokensCache.data;
      }

      console.log('🔄 Fetching trending tokens...');
      
      // Try to use the existing Jupiter token list function
      try {
        const jupiterMap = await fetchJupiterTokenList();
        if (jupiterMap && jupiterMap.size > 0) {
          // Convert map to array and take first 100
          const tokens = Array.from(jupiterMap.entries())
            .slice(0, 100)
            .map(([address, token]) => ({
              name: token.name,
              symbol: token.symbol,
              mint: address,
              decimals: token.decimals,
              image: token.logoURI,
              logoURI: token.logoURI,
              tags: ['verified'],
              priceUsd: 0,
              risk: { jupiterVerified: true }
            }));

          if (tokens.length > 0) {
            trendingTokensCache.data = tokens;
            trendingTokensCache.timestamp = now;
            console.log(`✅ Fetched ${tokens.length} tokens from Jupiter cache`);
            return tokens;
          }
        }
      } catch (jupiterError) {
        console.warn('Jupiter token list failed, trying SPL Token Registry:', jupiterError);
      }

      // Fallback to SPL Token Registry
      try {
        const tokenListContainer = await new TokenListProvider().resolve();
        const tokenList = tokenListContainer
          .filterByClusterSlug('mainnet-beta')
          .getList();

        const tokens = tokenList
          .filter(t => t.address && t.symbol && t.name)
          .slice(0, 100)
          .map(token => ({
            name: token.name,
            symbol: token.symbol,
            mint: token.address,
            decimals: token.decimals,
            image: token.logoURI || '',
            logoURI: token.logoURI || '',
            tags: token.tags || [],
            priceUsd: 0,
            risk: { tokenRegistry: true }
          }));

        trendingTokensCache.data = tokens;
        trendingTokensCache.timestamp = now;
        console.log(`✅ Fetched ${tokens.length} tokens from SPL Token Registry`);
        return tokens;
      } catch (registryError) {
        console.error('SPL Token Registry failed:', registryError);
        return [];
      }
    } catch (error) {
      console.error('Failed to get trending tokens:', error);
      return [];
    }
  }

  /**
   * Get high volume tokens/pools from GeckoTerminal
   * Limited to ~30 req/min
   */
  static async getHighVolumeTokens(): Promise<any[]> {
    try {
      const now = Date.now();
      if (highVolumeTokensCache.data.length > 0 && (now - highVolumeTokensCache.timestamp) < highVolumeTokensCache.duration) {
        return highVolumeTokensCache.data;
      }

      void 0 && ('🔄 Fetching high volume pools from GeckoTerminal...');
      // Fetch trending pools on Solana
      const response = await fetch('https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?include=base_token,quote_token');
      
      if (!response.ok) {
        console.warn(`GeckoTerminal API returned ${response.status}`);
        return [];
      }

      const data = await response.json();
      const pools: GeckoPool[] = data.data;

      // Transform to standardized format
      const transformed = pools.map(pool => {
        const attr = pool.attributes;
        // Try to find the mint address from relationships if possible, 
        // otherwise we might need to rely on the pool address or extended data
        // For GeckoTerminal, relationships.base_token.data.id contains the token address usually
        const mint = pool.relationships?.base_token?.data?.id; // This is usually "network_tokenaddress"

        return {
          name: attr.name,
          symbol: attr.name.split('/')[0]?.trim() || 'Unknown',
          mint: mint?.replace('solana_', '') || '', // Remove network prefix if present
          decimals: 6, // Default
          priceUsd: parseFloat(attr.base_token_price_usd || '0'),
          liquidityUsd: parseFloat(attr.reserve_in_usd || '0'),
          marketCapUsd: 0, // Not always available directly in this endpoint
          volume_24h: parseFloat(attr.volume_usd?.h24 || '0'),
          poolAddress: attr.address,
          createdOn: attr.pool_created_at,
          events: {
            priceChange: {
              h1: parseFloat(attr.price_change_percentage?.h1 || '0'),
              h24: parseFloat(attr.price_change_percentage?.h24 || '0'),
            }
          }
        };
      }).filter(t => t.mint); // Filter out any where we couldn't parse mint

      // Update cache
      highVolumeTokensCache.data = transformed;
      highVolumeTokensCache.timestamp = now;

      return transformed;
    } catch (error) {
      console.error('Failed to get high volume tokens:', error);
      return [];
    }
  }


  /**
   * Get new tokens from PumpPortal and GeckoTerminal
   * PumpPortal tracks Pump.fun launches in real-time
   */
  static async getNewTokens(): Promise<any[]> {
    try {
      const now = Date.now();
      if (newTokensCache.data.length > 0 && (now - newTokensCache.timestamp) < newTokensCache.duration) {
        return newTokensCache.data;
      }

      console.log('🔄 Fetching new tokens from PumpPortal...');
      
      // Try PumpPortal API first (best for new Pump.fun tokens)
      try {
        const response = await fetch('https://pumpportal.fun/api/data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'getNewTokens',
            limit: 100
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (Array.isArray(data) && data.length > 0) {
            const transformed = data.map((token: any) => ({
              name: token.name || token.symbol,
              symbol: token.symbol,
              mint: token.mint || token.address,
              image: token.image || token.uri,
              decimals: token.decimals || 6,
              priceUsd: parseFloat(token.priceUsd || token.price || '0'),
              liquidityUsd: parseFloat(token.liquidityUsd || '0'),
              marketCapUsd: parseFloat(token.marketCap || token.fdv || '0'),
              createdOn: token.created_timestamp || token.timestamp || Date.now(),
              isPumpFun: true,
              tags: ['pump.fun', 'new']
            }));

            newTokensCache.data = transformed;
            newTokensCache.timestamp = now;
            console.log(`✅ Fetched ${transformed.length} new tokens from PumpPortal`);
            return transformed;
          }
        }
      } catch (pumpError) {
        console.warn('PumpPortal API failed, trying GeckoTerminal:', pumpError);
      }

      // Fallback to GeckoTerminal new pools
      try {
        const response = await fetch('https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=1');
        
        if (response.ok) {
          const data = await response.json();
          const pools = data.data || [];

          if (pools.length > 0) {
            const transformed = pools.slice(0, 100).map((pool: any) => {
              const attr = pool.attributes;
              const mint = pool.relationships?.base_token?.data?.id?.replace('solana_', '');

              return {
                name: attr.name,
                symbol: attr.name.split('/')[0]?.trim() || 'Unknown',
                mint: mint || '',
                decimals: 6,
                priceUsd: parseFloat(attr.base_token_price_usd || '0'),
                liquidityUsd: parseFloat(attr.reserve_in_usd || '0'),
                marketCapUsd: 0,
                volume_24h: parseFloat(attr.volume_usd?.h24 || '0'),
                poolAddress: attr.address,
                createdOn: attr.pool_created_at,
                events: {
                  priceChange: {
                    h1: parseFloat(attr.price_change_percentage?.h1 || '0'),
                    h24: parseFloat(attr.price_change_percentage?.h24 || '0'),
                  }
                },
                tags: ['new-pool']
              };
            }).filter((t: any) => t.mint);

            newTokensCache.data = transformed;
            newTokensCache.timestamp = now;
            console.log(`✅ Fetched ${transformed.length} new tokens from GeckoTerminal`);
            return transformed;
          }
        }
      } catch (geckoError) {
        console.warn('GeckoTerminal new pools failed:', geckoError);
      }

      console.warn('All new token APIs failed, returning empty list');
      return [];
    } catch (error) {
      console.error('Failed to get new tokens:', error);
      return [];
    }
  }
}



export default SolanaService; 


const extractHttpsUrl = (s: string): string | null => {
  const match = s.match(/https?:\/\/[^\s'",)\]}]+/);
  return match ? match[0] : null;
};

// 1. Solana RPC endpoint (gRPC or HTTP)
const RPC_URL = process.env.NEXT_RPC_URL! || 'https://solana-mainnet.g.alchemy.com/v2/XtQLzQGpbTeGh_UhaGg6c';

// If you need fetch in Node < 18 uncomment this:
// import fetch from "node-fetch";

type LookupResult = {
  source: "token-registry" | "metaplex-on-chain" | "mint-account" | "token-metadata-service" | "unknown";
  name?: string;
  symbol?: string;
  logoURI?: string;
  uri?: string; // metadata URI if present
  decimals?: number;
  supply?: string;
  raw?: any;
};

const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

/**
 * Try Token Registry -> on-chain Metaplex metadata -> mint account
 */
export async function getTokenInfo(
  mintAddress: string,
  rpcUrl = RPC_URL
): Promise<LookupResult> {
  const connection = new Connection(rpcUrl, "confirmed");
  const mintPub = new PublicKey(mintAddress);
  const mintBase58 = mintPub.toBase58();

  // 0) Try TokenMetadataService (best for live market data and images)
  try {
    const metadata = await TokenMetadataService.getTokenMetadata(mintAddress);
    if (metadata) {
       return {
         source: "token-metadata-service",
         name: metadata.name,
         symbol: metadata.symbol,
         logoURI: metadata.image || "",
         decimals: metadata.decimals,
         uri: "", // external service doesn't give metadata JSON URI usually
         raw: metadata
       };
    }
  } catch (err) {
     console.warn("TokenMetadataService lookup failed:", err);
  }

  // 1) Token Registry (fast, includes logos, symbols, common names)
  try {
    const tokenListContainer = await new TokenListProvider().resolve();
    const tokenList = tokenListContainer
      .filterByClusterSlug("mainnet-beta")
      .getList();

    const token = tokenList.find((t:any) => t.address === mintBase58);
    if (token) {
      return {
        source: "token-registry",
        name: token.name,
        symbol: token.symbol,
        logoURI: extractHttpsUrl(token.logoURI!) || "",
        uri: extractHttpsUrl((token as any).extensions?.coingeckoId!) || "",
        raw: token,
      };
    }
  } catch (err) {
    // registry failed — continue to next step
    console.warn("Token registry lookup failed:", (err as Error).message);
  }

  // 2) Try on-chain Metaplex Metadata account (many fungible tokens use it)
  try {
    const [metadataPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        mintPub.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );

    const acctInfo = await connection.getAccountInfo(metadataPDA);
    if (acctInfo && acctInfo.data) {
      const parsed = decodeMetaplexMetadataSimple(acctInfo.data);
      // parsed: { name, symbol, uri }
      return {
        source: "metaplex-on-chain",
        name: parsed.name,
        symbol: parsed.symbol,
        uri: extractHttpsUrl(parsed.uri) || "",
        raw: parsed,
      };
    }
  } catch (err) {
    console.warn("On-chain Metaplex metadata lookup failed:", (err as Error).message);
  }

  // 3) Fallback: read mint account (no name, but decimals/supply)
  try {
    const parsed = await connection.getParsedAccountInfo(mintPub);
    if (parsed.value && parsed.value.data) {
      // structure of parsed value from getParsedAccountInfo:
      // parsed.value.data.parsed.info.decimals / supply
      // But be defensive in typing:
      const maybe = (parsed.value.data as any).parsed ?? (parsed.value.data as any);
      const info = maybe?.info ?? maybe;
      const decimals = info?.decimals ?? undefined;
      const supply = info?.supply ?? undefined;
      return {
        source: "mint-account",
        decimals,
        supply,
        raw: parsed.value,
      };
    }
  } catch (err) {
    console.warn("Mint account lookup failed:", (err as Error).message);
  }

  // Nothing found
  return { source: "unknown" };
}

/**
 * Lightweight parser for Metaplex metadata account using the common fixed-length layout.
 * NOTE: This simple parser assumes the legacy fixed-length fields:
 *   name: 32 bytes, symbol: 10 bytes, uri: 200 bytes
 * This works for most tokens that use the v1 metadata layout.
 *
 * If you need full support for newer metadata structures, use
 * @metaplex-foundation/mpl-token-metadata's deserializer.
 */
function decodeMetaplexMetadataSimple(data: Buffer | Uint8Array) {
  const buf = Buffer.from(data);
  // Skips: key (1) + updateAuthority (32) + mint (32) = 65 bytes
  let offset = 1 + 32 + 32;
  const NAME_LEN = 32;
  const SYMBOL_LEN = 10;
  const URI_LEN = 200;

  const name = buf
    .slice(offset, offset + NAME_LEN)
    .toString("utf8")
    .replace(/\0/g, "")
    .trim();
  offset += NAME_LEN;

  const symbol = buf
    .slice(offset, offset + SYMBOL_LEN)
    .toString("utf8")
    .replace(/\0/g, "")
    .trim();
  offset += SYMBOL_LEN;

  const uri = buf
    .slice(offset, offset + URI_LEN)
    .toString("utf8")
    .replace(/\0/g, "")
    .trim();

  return { name, symbol, uri };
}