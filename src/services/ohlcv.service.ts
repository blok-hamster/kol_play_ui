
export interface OHLCVData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

export class OHLCVService {
    private static GECKO_BASE_URL = 'https://api.geckoterminal.com/api/v2';
    private static PUMP_FRONTEND_API = 'https://frontend-api-v3.pump.fun';
    private static PUMP_SWAP_API = 'https://swap-api.pump.fun/v2';
    
    private static solPriceCache: { price: number, timestamp: number } | null = null;

    /**
     * Determine precision and minMove based on data
     */
    static getPrecision(data: OHLCVData[]) {
        if (data.length === 0) return { precision: 2, minMove: 0.01 };
        const avgPrice = data.reduce((sum, d) => sum + d.close, 0) / data.length;
        if (avgPrice < 0.00001) return { precision: 10, minMove: 0.0000000001 };
        if (avgPrice < 0.0001) return { precision: 8, minMove: 0.00000001 };
        if (avgPrice < 0.001) return { precision: 6, minMove: 0.000001 };
        if (avgPrice < 1) return { precision: 4, minMove: 0.0001 };
        return { precision: 2, minMove: 0.01 };
    }

    /**
     * Update a list of candles with a new trade
     */
    static updateCandles(prev: OHLCVData[], trade: any, timeframeMs: number): OHLCVData[] {
        // Calculate trade price
        let tradePrice = trade.price;
        if (!tradePrice || isNaN(tradePrice)) {
            if (trade.tradeType === 'buy') {
                tradePrice = trade.amountIn / trade.amountOut;
            } else {
                tradePrice = trade.amountOut / trade.amountIn;
            }
        }

        if (isNaN(tradePrice) || tradePrice <= 0) return prev;

        const tradeTime = new Date(trade.timestamp).getTime();
        const candleStartTime = Math.floor(tradeTime / timeframeMs) * timeframeMs;

        // If history is empty, initialize with the first trade
        if (prev.length === 0) {
            return [{
                time: candleStartTime / 1000,
                open: tradePrice,
                high: tradePrice,
                low: tradePrice,
                close: tradePrice,
                volume: trade.volume || 0
            }];
        }

        const lastCandle = prev[prev.length - 1];

        // Robust handling for older trades or jitter
        if (candleStartTime / 1000 < lastCandle.time) {
            // This trade belongs to a past candle, we usually ignore or update if it's very close
            // For now, let's just ignore to prevent "red spikes" backwards
            return prev;
        }

        if (candleStartTime / 1000 === lastCandle.time) {
            // Update current candle
            const updatedCandle = {
                ...lastCandle,
                close: tradePrice,
                high: Math.max(lastCandle.high, tradePrice),
                low: Math.min(lastCandle.low, tradePrice),
            };
            const newHistory = [...prev];
            newHistory[newHistory.length - 1] = updatedCandle;
            return newHistory;
        } else {
            // New candle
            const newCandle = {
                time: candleStartTime / 1000,
                open: tradePrice,
                high: tradePrice,
                low: tradePrice,
                close: tradePrice,
            };
            return [...prev, newCandle];
        }
    }

    /**
     * Fetch metadata for a pump.fun token
     */
    static async getPumpMetadata(mint: string): Promise<any | null> {
        try {
            const response = await fetch(`${this.PUMP_FRONTEND_API}/coins-v2/${mint}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching pump metadata:', error);
            return null;
        }
    }

    /**
     * Fetch SOL price from pump.fun
     */
    static async getSolPrice(): Promise<number> {
        // Cache SOL price for 30 seconds to prevent over-fetching
        if (this.solPriceCache && Date.now() - this.solPriceCache.timestamp < 30000) {
            return this.solPriceCache.price;
        }

        try {
            const response = await fetch(`${this.PUMP_FRONTEND_API}/sol-price`);
            if (!response.ok) return this.solPriceCache?.price || 200; 
            const data = await response.json();
            const price = parseFloat(data.solPrice) || 200;
            
            this.solPriceCache = { price, timestamp: Date.now() };
            return price;
        } catch (error) {
            return this.solPriceCache?.price || 200;
        }
    }

    /**
     * Fetch historical OHLCV data for a token mint
     */
    static async getOHLCV(mint: string, timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '15m', limit: number = 100, beforeTimestamp?: number): Promise<OHLCVData[]> {
        // Special case for Pump.fun tokens (before migration)
        if (mint.endsWith('pump')) {
            try {
                const metadata = await this.getPumpMetadata(mint);
                if (metadata && !metadata.raydium_pool) { // Still on bonding curve
                    const intervalMap: Record<string, string> = {
                        '1m': '1m', '5m': '5m', '15m': '15m',
                        '1h': '1h', '4h': '4h', '1d': '24h'
                    };
                    const interval = intervalMap[timeframe] || '15m';
                    const createdTs = metadata.created_timestamp;

                    const url = `${this.PUMP_SWAP_API}/coins/${mint}/candles?createdTs=${createdTs}&interval=${interval}&limit=${limit}`;
                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.json();
                        // Pump native API returns candles in USD equivalents (market-cap derived)
                        // No SOL conversion needed.
                        return data.map((item: any) => ({
                            time: item.timestamp, // Assuming seconds from Pump candles API, if MS need / 1000
                            open: parseFloat(item.open),
                            high: parseFloat(item.high),
                            low: parseFloat(item.low),
                            close: parseFloat(item.close),
                            volume: parseFloat(item.volume)
                        })).sort((a: any, b: any) => a.time - b.time);
                    }
                }
            } catch (err) {
                console.warn('Failed to fetch pump-specific candles, falling back to DexScreener', err);
            }
        }

        try {
            // 1. Find the pool address first (GeckoTerminal needs pool, not mint)
            // We can use DexScreener to find the primary pool
            const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
            if (!dexResponse.ok) return [];
            
            const dexData = await dexResponse.json();
            
            if (!dexData.pairs || dexData.pairs.length === 0) {
                return [];
            }

            // Get the pool with the highest liquidity
            const primaryPool = dexData.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
            const poolAddress = primaryPool.pairAddress;

            // 2. Fetch OHLCV from GeckoTerminal
            const resolutionMap: Record<string, string> = {
                '1m': 'minute', '5m': 'minute', '15m': 'minute',
                '1h': 'hour', '4h': 'hour',
                '1d': 'day'
            };

            const aggregateMap: Record<string, string> = {
                '1m': '1', '5m': '5', '15m': '15',
                '1h': '1', '4h': '4',
                '1d': '1'
            };

            let url = `${this.GECKO_BASE_URL}/networks/solana/pools/${poolAddress}/ohlcv/${resolutionMap[timeframe]}?aggregate=${aggregateMap[timeframe]}&limit=${Math.min(limit, 1000)}&currency=usd`;
            
            if (beforeTimestamp) {
                url += `&before_timestamp=${beforeTimestamp}`;
            }

            const geckoResponse = await fetch(url);
            if (!geckoResponse.ok) return [];

            const geckoData = await geckoResponse.json();

            if (!geckoData.data || !geckoData.data.attributes || !geckoData.data.attributes.ohlcv_list) {
                return [];
            }

            // 3. Transform to TV format
            const ohlcvList = geckoData.data.attributes.ohlcv_list;
            
            return ohlcvList.map((item: any[]) => ({
                time: item[0], // TV expects seconds
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            })).sort((a: any, b: any) => a.time - b.time);

        } catch (error) {
            console.error('Error fetching OHLCV data:', error);
            return [];
        }
    }

    /**
     * Fetch the latest price for a token from the best available source
     */
    static async getLatestPrice(mint: string): Promise<{ price: number, timestamp: number } | null> {
        // 1. Try DexScreener first (best for migrated tokens)
        try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
            if (response.ok) {
                const data = await response.json();
                if (data.pairs && data.pairs.length > 0) {
                    const primaryPool = data.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
                    return {
                        price: parseFloat(primaryPool.priceUsd),
                        timestamp: Date.now()
                    };
                }
            }
        } catch (e) {}

        // 2. Try Pump.fun directly (best for tokens on bonding curve)
        if (mint.endsWith('pump')) {
            try {
                const metadata = await this.getPumpMetadata(mint);
                if (metadata && metadata.usd_market_cap) {
                    // Approximate price calculation from Market Cap / Total Supply (1B for pump)
                    const price = metadata.usd_market_cap / 1000000000;
                    return {
                        price,
                        timestamp: Date.now()
                    };
                }
            } catch (e) {}
        }

        return null;
    }
}
