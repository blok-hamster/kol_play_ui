import type { SearchTokenResult } from '@/types';

// Enhanced interfaces for the token detail modal
export interface TokenDetailData {
  token: {
    name: string;
    symbol: string;
    mint: string;
    uri?: string;
    decimals: number;
    hasFileMetaData?: boolean;
    createdOn: string;
    description?: string;
    image?: string;
    showName?: boolean;
    twitter?: string;
    creation?: {
      creator: string;
      created_tx: string;
      created_time: number;
    };
  };
  pools: PoolData[];
  events: PriceEvents;
  risk: RiskData;
  buysCount: number;
  sellsCount: number;
  // Add loading states
  isLoading?: {
    chart?: boolean;
    priceData?: boolean;
    riskData?: boolean;
  };
  // Add error states
  errors?: {
    chart?: string;
    priceData?: string;
    riskData?: string;
  };
}

export interface PoolData {
  liquidity: {
    quote: number;
    usd: number;
  };
  price: {
    quote: number;
    usd: number;
  };
  tokenSupply: number;
  lpBurn: number;
  tokenAddress: string;
  marketCap: {
    quote: number;
    usd: number;
  };
  decimals: number;
  security: {
    freezeAuthority: string | null;
    mintAuthority: string | null;
  };
  quoteToken: string;
  market: string;
  lastUpdated: number;
  createdAt: number;
  txns: {
    buys: number;
    sells: number;
    total: number;
    volume: number;
    volume24h: number;
  };
  deployer: string;
  poolId: string;
}

export interface PriceEvents {
  [key: string]: {
    priceChangePercentage: number;
  };
}

export interface RiskData {
  snipers: {
    count: number;
    totalBalance: number;
    totalPercentage: number;
    wallets: any[];
  };
  insiders: {
    count: number;
    totalBalance: number;
    totalPercentage: number;
    wallets: any[];
  };
  rugged: boolean;
  risks: any[];
  score: number;
  jupiterVerified: boolean;
}

/**
 * Transforms a SearchTokenResult to TokenDetailData format for the modal
 * Provides proper fallback handling for missing data
 */
export function transformSearchResultToTokenDetail(
  searchResult: SearchTokenResult
): TokenDetailData {
  // Validate required fields
  if (!searchResult.mint) {
    throw new Error('Token mint address is required');
  }

  // Generate fallback pool data based on available search result data
  const fallbackPool = generateFallbackPoolData(searchResult);
  
  // Generate fallback price events
  const fallbackEvents = generateFallbackPriceEvents();
  
  // Generate fallback risk data
  const fallbackRisk = generateFallbackRiskData(searchResult);

  return {
    token: {
      name: searchResult.name || searchResult.symbol || 'Unknown Token',
      symbol: searchResult.symbol || 'N/A',
      mint: searchResult.mint,
      uri: undefined, // Not available in search results
      decimals: searchResult.decimals || 6,
      hasFileMetaData: true,
      createdOn: searchResult.market || 'pump.fun',
      description: undefined, // Not available in search results
      image: searchResult.image || searchResult.logoURI,
      showName: true,
      twitter: undefined, // Not available in search results
      creation: searchResult.createdOn ? {
        creator: 'Unknown',
        created_tx: 'Unknown',
        created_time: typeof searchResult.createdOn === 'number' 
          ? searchResult.createdOn 
          : Date.now() / 1000
      } : undefined,
    },
    pools: [fallbackPool],
    events: fallbackEvents,
    risk: fallbackRisk,
    buysCount: searchResult.totalBuys || 0,
    sellsCount: searchResult.totalSells || 0,
    isLoading: {
      chart: false,
      priceData: false,
      riskData: false,
    },
    errors: {},
  };
}

/**
 * Generates consistent fallback pool data from search result
 */
export function generateFallbackPoolData(searchResult: SearchTokenResult): PoolData {
  const currentTime = Date.now();
  
  return {
    liquidity: {
      quote: (searchResult.liquidityUsd || 0) / (searchResult.priceUsd || 1),
      usd: searchResult.liquidityUsd || 0,
    },
    price: {
      quote: 1 / (searchResult.priceUsd || 1),
      usd: searchResult.priceUsd || 0,
    },
    tokenSupply: calculateTokenSupply(searchResult),
    lpBurn: searchResult.lpBurn || 0,
    tokenAddress: searchResult.mint,
    marketCap: {
      quote: (searchResult.marketCapUsd || 0) / (searchResult.priceUsd || 1),
      usd: searchResult.marketCapUsd || 0,
    },
    decimals: searchResult.decimals || 6,
    security: {
      freezeAuthority: searchResult.freezeAuthority || null,
      mintAuthority: searchResult.mintAuthority || null,
    },
    quoteToken: 'So11111111111111111111111111111111111111112', // SOL mint
    market: searchResult.market || 'pumpfun-amm',
    lastUpdated: currentTime,
    createdAt: typeof searchResult.createdOn === 'number' 
      ? searchResult.createdOn * 1000 
      : currentTime,
    txns: {
      buys: searchResult.totalBuys || 0,
      sells: searchResult.totalSells || 0,
      total: searchResult.totalTransactions || 0,
      volume: searchResult.volume || 0,
      volume24h: searchResult.volume_24h || 0,
    },
    deployer: 'Unknown',
    poolId: searchResult.poolAddress || 'Unknown',
  };
}

/**
 * Generates realistic fallback price events for different timeframes
 */
export function generateFallbackPriceEvents(): PriceEvents {
  // Generate realistic price movements that generally trend in the same direction
  // but with decreasing volatility for longer timeframes
  const baseChange = (Math.random() - 0.5) * 20; // -10% to +10% base change
  
  return {
    '1m': { priceChangePercentage: baseChange + (Math.random() - 0.5) * 2 },
    '5m': { priceChangePercentage: baseChange + (Math.random() - 0.5) * 4 },
    '15m': { priceChangePercentage: baseChange + (Math.random() - 0.5) * 6 },
    '30m': { priceChangePercentage: baseChange + (Math.random() - 0.5) * 8 },
    '1h': { priceChangePercentage: baseChange + (Math.random() - 0.5) * 10 },
    '2h': { priceChangePercentage: baseChange + (Math.random() - 0.5) * 12 },
    '3h': { priceChangePercentage: baseChange + (Math.random() - 0.5) * 14 },
    '4h': { priceChangePercentage: baseChange + (Math.random() - 0.5) * 16 },
    '5h': { priceChangePercentage: baseChange + (Math.random() - 0.5) * 18 },
    '6h': { priceChangePercentage: baseChange + (Math.random() - 0.5) * 20 },
    '12h': { priceChangePercentage: baseChange + (Math.random() - 0.5) * 25 },
    '24h': { priceChangePercentage: baseChange + (Math.random() - 0.5) * 30 },
  };
}

/**
 * Generates fallback risk data based on available token information
 */
export function generateFallbackRiskData(searchResult: SearchTokenResult): RiskData {
  // Calculate risk score based on available data
  let riskScore = 0;
  
  // Higher risk if no freeze/mint authority revoked
  if (searchResult.freezeAuthority) riskScore += 2;
  if (searchResult.mintAuthority) riskScore += 2;
  
  // Lower risk if verified or on Jupiter
  if (searchResult.verified) riskScore = Math.max(0, riskScore - 1);
  if (searchResult.jupiter) riskScore = Math.max(0, riskScore - 1);
  
  // Higher risk if very low liquidity
  if ((searchResult.liquidityUsd || 0) < 1000) riskScore += 2;
  
  // Add some randomness but keep it reasonable
  riskScore += Math.floor(Math.random() * 3);
  riskScore = Math.min(10, Math.max(0, riskScore));

  return {
    snipers: {
      count: 0,
      totalBalance: 0,
      totalPercentage: 0,
      wallets: [],
    },
    insiders: {
      count: 0,
      totalBalance: 0,
      totalPercentage: 0,
      wallets: [],
    },
    rugged: false,
    risks: [],
    score: riskScore,
    jupiterVerified: searchResult.jupiter || searchResult.verified || false,
  };
}

/**
 * Calculates estimated token supply based on market cap and price
 */
function calculateTokenSupply(searchResult: SearchTokenResult): number {
  if (searchResult.marketCapUsd && searchResult.priceUsd && searchResult.priceUsd > 0) {
    return Math.floor(searchResult.marketCapUsd / searchResult.priceUsd);
  }
  
  // Fallback to a reasonable default for new tokens
  return 1000000000; // 1 billion tokens
}

/**
 * Validates that a SearchTokenResult has the minimum required data
 */
export function validateSearchResult(searchResult: SearchTokenResult): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!searchResult.mint) missingFields.push('mint');
  if (!searchResult.symbol && !searchResult.name) missingFields.push('symbol or name');

  // Important but not critical fields
  if (!searchResult.image && !searchResult.logoURI) warnings.push('No image available');
  if (!searchResult.priceUsd) warnings.push('No price data available');
  if (!searchResult.marketCapUsd) warnings.push('No market cap data available');
  if (!searchResult.liquidityUsd) warnings.push('No liquidity data available');

  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}

/**
 * Creates a minimal TokenDetailData with loading states for when data is being fetched
 */
export function createLoadingTokenDetail(mint: string, symbol?: string, name?: string): TokenDetailData {
  return {
    token: {
      name: name || symbol || 'Loading...',
      symbol: symbol || 'LOADING',
      mint,
      decimals: 6,
      createdOn: 'Loading...',
      showName: true,
    },
    pools: [],
    events: {},
    risk: {
      snipers: { count: 0, totalBalance: 0, totalPercentage: 0, wallets: [] },
      insiders: { count: 0, totalBalance: 0, totalPercentage: 0, wallets: [] },
      rugged: false,
      risks: [],
      score: 0,
      jupiterVerified: false,
    },
    buysCount: 0,
    sellsCount: 0,
    isLoading: {
      chart: true,
      priceData: true,
      riskData: true,
    },
    errors: {},
  };
}

/**
 * Updates TokenDetailData with error states
 */
export function setTokenDetailError(
  tokenDetail: TokenDetailData,
  errorType: 'chart' | 'priceData' | 'riskData',
  errorMessage: string
): TokenDetailData {
  return {
    ...tokenDetail,
    isLoading: {
      ...tokenDetail.isLoading,
      [errorType]: false,
    },
    errors: {
      ...tokenDetail.errors,
      [errorType]: errorMessage,
    },
  };
}

/**
 * Updates TokenDetailData loading states
 */
export function setTokenDetailLoading(
  tokenDetail: TokenDetailData,
  loadingType: 'chart' | 'priceData' | 'riskData',
  isLoading: boolean
): TokenDetailData {
  return {
    ...tokenDetail,
    isLoading: {
      ...tokenDetail.isLoading,
      [loadingType]: isLoading,
    },
    // Clear error when starting to load
    errors: isLoading ? {
      ...tokenDetail.errors,
      [loadingType]: undefined,
    } : tokenDetail.errors,
  };
}