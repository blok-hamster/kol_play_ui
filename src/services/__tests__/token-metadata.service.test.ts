import { TokenMetadataService } from '../token-metadata.service';

// Mock global fetch
global.fetch = jest.fn();

describe('TokenMetadataService', () => {
  const mockMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'; // BONK
  const mockPairData = {
    pairs: [
      {
        chainId: 'solana',
        dexId: 'raydium',
        url: 'https://dexscreener.com/solana/pair-address',
        pairAddress: 'pair-address',
        baseToken: {
          address: mockMint,
          name: 'Bonk',
          symbol: 'Bonk'
        },
        quoteToken: {
          address: 'So11111111111111111111111111111111111111112',
          name: 'Wrapped SOL',
          symbol: 'SOL'
        },
        priceNative: '0.0000001',
        priceUsd: '0.00001',
        txns: {
          m5: { buys: 10, sells: 5 },
          h1: { buys: 100, sells: 50 },
          h6: { buys: 500, sells: 250 },
          h24: { buys: 1000, sells: 500 }
        },
        volume: {
          h24: 1000000,
          h6: 500000,
          h1: 100000,
          m5: 10000
        },
        priceChange: {
          m5: 1,
          h1: 2,
          h6: 5,
          h24: 10
        },
        liquidity: {
          usd: 5000000,
          base: 100000000,
          quote: 50000
        },
        fdv: 1000000000,
        marketCap: 1000000000,
        pairCreatedAt: 1672531200000,
        info: {
          imageUrl: 'https://example.com/bonk.png',
          websites: [{ label: 'Website', url: 'https://bonkcoin.com' }],
          socials: [{ type: 'twitter', url: 'https://twitter.com/bonk_inu' }]
        }
      }
    ]
  };

  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  describe('getTokenMetadata', () => {
    it('should fetch and return mapped token metadata', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockPairData
      });

      const result = await TokenMetadataService.getTokenMetadata(mockMint);

      expect(global.fetch).toHaveBeenCalledWith(`https://api.dexscreener.com/latest/dex/tokens/${mockMint}`);
      expect(result).not.toBeNull();
      expect(result?.mint).toBe(mockMint);
      expect(result?.name).toBe('Bonk');
      expect(result?.symbol).toBe('Bonk');
      expect(result?.priceUsd).toBe(0.00001);
      expect(result?.liquidityUsd).toBe(5000000);
      expect(result?.image).toBe('https://example.com/bonk.png');
    });

    it('should return null if api call fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      });

      const result = await TokenMetadataService.getTokenMetadata(mockMint);

      expect(result).toBeNull();
    });

    it('should return null if no pairs found', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ pairs: [] })
      });

      const result = await TokenMetadataService.getTokenMetadata(mockMint);

      expect(result).toBeNull();
    });

    it('should fallback to GeckoTerminal if DexScreener fails', async () => {
      // First call (DexScreener) fails
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, statusText: 'Error' })
        // Second call (GeckoTerminal) succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              attributes: {
                name: 'GeckoToken',
                symbol: 'GT',
                image_url: 'http://gecko.com/img.png',
                decimals: 9,
                price_usd: '1.23',
                fdv_usd: '1000000'
              }
            }
          })
        });

      const result = await TokenMetadataService.getTokenMetadata(mockMint);

      expect(global.fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('api.dexscreener.com'));
      expect(global.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('api.geckoterminal.com'));
      expect(result?.name).toBe('GeckoToken');
      expect(result?.image).toBe('http://gecko.com/img.png');
      expect(result?.priceUsd).toBe(1.23);
    });
  });

  describe('getMultipleTokenMetadata', () => {
    it('should fetch and return map of token metadata', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockPairData
      });

      const mints = [mockMint];
      const result = await TokenMetadataService.getMultipleTokenMetadata(mints);

      expect(global.fetch).toHaveBeenCalledWith(`https://api.dexscreener.com/latest/dex/tokens/${mockMint}`);
      expect(result.size).toBe(1);
      expect(result.get(mockMint)).toBeDefined();
      expect(result.get(mockMint)?.name).toBe('Bonk');
    });
    
    it('should handle batching correctly', async () => {
        // Mock a list of mints slightly larger than batch size
        const mints = Array.from({ length: 35 }, (_, i) => `mint-${i}`);
        
        // Mock implementation to return successful pairs for all requested mints
        // This prevents the code from falling back to GeckoTerminal (which is slow)
        (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
            if (url.includes('dexscreener')) {
                // Extract mints from URL end
                const requestedMints = url.split('/').pop()?.split(',') || [];
                return {
                    ok: true,
                    json: async () => ({
                        pairs: requestedMints.map(mint => ({
                            baseToken: { address: mint, name: 'Mock', symbol: 'MCK' },
                            liquidity: { usd: 1000 },
                            priceUsd: '1.0',
                            info: { imageUrl: 'mock-img' }
                        }))
                    })
                };
            }
            return { ok: false };
        });
        
        const result = await TokenMetadataService.getMultipleTokenMetadata(mints);
        
        // 35 items / 30 batch size = 2 DexScreener calls
        // Since all are found, 0 GeckoTerminal calls
        const dexscreenerCalls = (global.fetch as jest.Mock).mock.calls.filter(call => 
            call[0].includes('dexscreener')
        );
        
        expect(dexscreenerCalls.length).toBe(2);
        expect(result.size).toBe(35);
        expect(result.get('mint-0')?.name).toBe('Mock');
    });
  });
});
