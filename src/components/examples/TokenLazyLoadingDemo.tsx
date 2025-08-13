'use client';

import React, { useState } from 'react';
import { useTokenLazyLoading } from '@/hooks/use-token-lazy-loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export function TokenLazyLoadingDemo() {
  const [inputAddresses, setInputAddresses] = useState('');
  const [addressesToLoad, setAddressesToLoad] = useState<string[]>([]);

  const {
    tokens,
    loading,
    error,
    progress,
    loadTokens,
    getToken,
    clearCache,
    cancel
  } = useTokenLazyLoading({
    batchSize: 20,
    maxConcurrentBatches: 3,
    cacheEnabled: true,
    onProgress: (loaded, total, currentBatch, totalBatches) => {
      console.log(`Progress: ${loaded}/${total} tokens loaded (Batch ${currentBatch}/${totalBatches})`);
    },
    onError: (error) => {
      console.error('Token loading error:', error);
    }
  });

  const handleLoadTokens = () => {
    const addresses = inputAddresses
      .split('\n')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);
    
    if (addresses.length === 0) return;
    
    setAddressesToLoad(addresses);
    loadTokens(addresses);
  };

  const handleLoadSampleTokens = () => {
    // Sample Solana token addresses
    const sampleAddresses = [
      'So11111111111111111111111111111111111111112', // Wrapped SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
      '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ETH
      'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM', // USDCet
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // JitoSOL
      'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', // bSOL
    ];

    setInputAddresses(sampleAddresses.join('\n'));
    setAddressesToLoad(sampleAddresses);
    loadTokens(sampleAddresses);
  };

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Token Lazy Loading Demo</CardTitle>
          <CardDescription>
            Demonstrate batch loading of token details with progress tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Token Addresses (one per line):
            </label>
            <textarea
              value={inputAddresses}
              onChange={(e) => setInputAddresses(e.target.value)}
              placeholder="Enter token mint addresses, one per line..."
              className="w-full h-32 p-3 border rounded-md resize-none"
              disabled={loading}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={handleLoadTokens}
              disabled={loading || !inputAddresses.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load Tokens'
              )}
            </Button>

            <Button 
              variant="outline" 
              onClick={handleLoadSampleTokens}
              disabled={loading}
            >
              Load Sample Tokens
            </Button>

            <Button 
              variant="outline" 
              onClick={cancel}
              disabled={!loading}
            >
              Cancel
            </Button>

            <Button 
              variant="outline" 
              onClick={clearCache}
              disabled={loading}
            >
              Clear Cache
            </Button>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Loading tokens...</span>
                <span>{progress.percentage}%</span>
              </div>
              <Progress value={progress.percentage} className="w-full" />
              <div className="text-xs text-muted-foreground">
                Batch {progress.currentBatch} of {progress.totalBatches} • 
                {progress.loaded} of {progress.total} tokens loaded
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {!loading && tokens.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-green-700">
                Successfully loaded {tokens.size} tokens
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {tokens.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Loaded Tokens ({tokens.size})</CardTitle>
            <CardDescription>
              Token details fetched with lazy loading
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from(tokens.values()).map((token) => (
                <Card key={token.mint || token.token?.mint} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {token.token?.image && (
                        <img 
                          src={token.token.image} 
                          alt={token.token.name}
                          className="w-8 h-8 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div>
                        <h3 className="font-semibold text-sm">
                          {token.token?.name || 'Unknown Token'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {token.token?.symbol || 'N/A'}
                        </p>
                      </div>
                    </div>
                    
                    {token.risk?.jupiterVerified && (
                      <Badge variant="secondary" className="text-xs">
                        Verified
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span>Holders:</span>
                      <span>{token.holders?.toLocaleString() || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transactions:</span>
                      <span>{token.txns?.toLocaleString() || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Risk Score:</span>
                      <span className={`${
                        (token.risk?.score || 0) > 50 ? 'text-red-500' : 'text-green-500'
                      }`}>
                        {token.risk?.score || 0}/100
                      </span>
                    </div>
                    {token.pools && token.pools.length > 0 && (
                      <div className="flex justify-between">
                        <span>Pools:</span>
                        <span>{token.pools.length}</span>
                      </div>
                    )}
                  </div>

                  {(token.token?.website || token.token?.twitter) && (
                    <div className="flex gap-2 mt-3">
                      {token.token?.website && (
                        <a
                          href={token.token.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {token.token?.twitter && (
                        <a
                          href={token.token.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 