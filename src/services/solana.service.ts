import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  ParsedAccountData,
} from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import {
  SolanaWalletBalance,
  SolanaTokenInfo,
  SolanaTokenMetadata,
  SolanaConnectionConfig,
} from '@/types';

// Token metadata cache to avoid repeated API calls
const tokenMetadataCache = new Map<string, SolanaTokenMetadata>();

// Jupiter token list cache to avoid refetching the entire list
let jupiterTokenListCache: Map<string, any> | null = null;
let jupiterTokenListCacheTime = 0;
const JUPITER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Price data cache to avoid repeated API calls
const priceCache = new Map<string, { price: number; timestamp: number }>();
const PRICE_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

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
 * Fetch token prices from Jupiter Price API V3
 * @param mintAddresses - Array of mint addresses to get prices for
 * @returns Promise<Map<string, number>> - Map of mint address to USD price
 */
async function fetchJupiterPrices(mintAddresses: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  
  if (mintAddresses.length === 0) {
    return priceMap;
  }

  try {
    // Jupiter Price API V3 - supports batch requests
    const mints = mintAddresses.join(',');
    const response = await fetch(`https://api.jup.ag/price/v2?ids=${mints}`);
    
    if (!response.ok) {
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
    
    void 0 && (`✅ Fetched ${priceMap.size} prices from Jupiter API`);
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
  private static defaultRpcUrl = 'https://solana-mainnet.g.alchemy.com/v2/XtQLzQGpbTeGh_UhaGg6c';
  
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
   * Fetch token metadata from Jupiter Token List API (batch)
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
      // Get Jupiter token list (cached)
      const jupiterTokenMap = await fetchJupiterTokenList();

      // Separate tokens found in Jupiter vs those needing mint account data
      const tokensNotInJupiter: string[] = [];
      
      // Process uncached mints
      for (const mint of uncachedMints) {
        if (jupiterTokenMap.has(mint)) {
          const jupiterToken = jupiterTokenMap.get(mint);
          const metadata: SolanaTokenMetadata = {
            name: jupiterToken.name,
            symbol: jupiterToken.symbol,
            logoURI: jupiterToken.logoURI,
            decimals: jupiterToken.decimals
          };
          // Cache and add to result
          tokenMetadataCache.set(mint, metadata);
          metadataMap.set(mint, metadata);
        } else {
          tokensNotInJupiter.push(mint);
        }
      }

      // Batch fetch mint account data for tokens not in Jupiter (if any)
      if (tokensNotInJupiter.length > 0) {
        const connection = this.getConnection();
        
        // Batch fetch all mint accounts in parallel
        const mintInfoPromises = tokensNotInJupiter.map(async (mint) => {
          try {
            const mintInfo = await getMint(connection, new PublicKey(mint));
            return {
              mint,
              metadata: {
                name: undefined,
                symbol: undefined,
                logoURI: undefined,
                decimals: mintInfo.decimals
              } as SolanaTokenMetadata
            };
          } catch (error) {
            console.warn(`Failed to fetch mint info for ${mint}:`, error);
            return {
              mint,
              metadata: {
                name: undefined,
                symbol: undefined,
                logoURI: undefined,
                decimals: 0
              } as SolanaTokenMetadata
            };
          }
        });

        // Execute all mint requests in parallel
        const mintResults = await Promise.all(mintInfoPromises);
        
        // Cache and add results
        for (const { mint, metadata } of mintResults) {
          tokenMetadataCache.set(mint, metadata);
          metadataMap.set(mint, metadata);
        }
      }

    } catch (error) {
      console.warn('Failed to fetch token metadata:', error);
      
      // Fallback: batch fetch all mint accounts for uncached mints
      const connection = this.getConnection();
      const mintPromises = uncachedMints.map(async (mint) => {
        try {
          const mintInfo = await getMint(connection, new PublicKey(mint));
          return {
            mint,
            metadata: {
              name: undefined,
              symbol: undefined,
              logoURI: undefined,
              decimals: mintInfo.decimals
            } as SolanaTokenMetadata
          };
        } catch {
          return {
            mint,
            metadata: {
              name: undefined,
              symbol: undefined,
              logoURI: undefined,
              decimals: 0
            } as SolanaTokenMetadata
          };
        }
      });

      const results = await Promise.all(mintPromises);
      for (const { mint, metadata } of results) {
        tokenMetadataCache.set(mint, metadata);
        metadataMap.set(mint, metadata);
      }
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
      // Try Jupiter first (better for Solana ecosystem tokens)
      const jupiterPrices = await fetchJupiterPrices(uncachedMints);
      
      // Find tokens that Jupiter couldn't price
      const remainingMints = uncachedMints.filter(mint => !jupiterPrices.has(mint));
      
      // Try CoinGecko for remaining tokens
      let coinGeckoPrices = new Map<string, number>();
      if (remainingMints.length > 0) {
        void 0 && (`🔄 Falling back to CoinGecko for ${remainingMints.length} tokens...`);
        coinGeckoPrices = await fetchCoinGeckoPrices(remainingMints);
      }

      // Combine results and cache
      const allPrices = new Map([...Array.from(jupiterPrices), ...Array.from(coinGeckoPrices)]);
      
      for (const [mint, price] of Array.from(allPrices)) {
        priceMap.set(mint, price);
        priceCache.set(mint, { price, timestamp: now });
      }

      void 0 && (`✅ Fetched prices for ${allPrices.size}/${uncachedMints.length} tokens`);
      
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
      // @ts-ignore
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
}

export default SolanaService; 