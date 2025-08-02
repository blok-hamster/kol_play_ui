'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { Token } from '@/types';
import { formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PriceChartProps {
  token: Token | null;
  className?: string;
}

interface PriceData {
  timestamp: number;
  price: number;
  volume: number;
}

const PriceChart: React.FC<PriceChartProps> = ({ token, className = '' }) => {
  const [timeframe, setTimeframe] = useState<'1h' | '4h' | '24h' | '7d'>('24h');
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mock price data generation
  useEffect(() => {
    if (!token) {
      setPriceData([]);
      return;
    }

    setIsLoading(true);

    // Simulate API call delay
    setTimeout(() => {
      const generateMockData = () => {
        const now = Date.now();
        const intervals =
          timeframe === '1h'
            ? 60
            : timeframe === '4h'
              ? 15
              : timeframe === '24h'
                ? 24
                : 7;
        const intervalMs =
          timeframe === '1h'
            ? 60000
            : timeframe === '4h'
              ? 900000
              : timeframe === '24h'
                ? 3600000
                : 86400000;

        const basePrice = token.priceUsd || 1;
        const data: PriceData[] = [];

        for (let i = intervals; i >= 0; i--) {
          const timestamp = now - i * intervalMs;
          const volatility = 0.05; // 5% volatility
          const change = (Math.random() - 0.5) * volatility;
          const price = basePrice * (1 + change * (Math.random() * 2));
          const volume = Math.random() * 100000;

          data.push({
            timestamp,
            price: Math.max(0.000001, price),
            volume,
          });
        }

        return data;
      };

      setPriceData(generateMockData());
      setIsLoading(false);
    }, 300);
  }, [token, timeframe]);

  if (!token) {
    return (
      <div className={`bg-muted/50 rounded-lg p-4 ${className}`}>
        <div className="text-center text-muted-foreground">
          Select a token to view price chart
        </div>
      </div>
    );
  }

  const currentPrice =
    priceData[priceData.length - 1]?.price || token.priceUsd || 0;
  const firstPrice = priceData[0]?.price || currentPrice;
  const priceChange = currentPrice - firstPrice;
  const priceChangePercent =
    firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;
  const isPositive = priceChange >= 0;

  const maxPrice = Math.max(...priceData.map(d => d.price));
  const minPrice = Math.min(...priceData.map(d => d.price));
  const priceRange = maxPrice - minPrice;

  const getTimeframeLabel = (tf: string) => {
    switch (tf) {
      case '1h':
        return '1 Hour';
      case '4h':
        return '4 Hours';
      case '24h':
        return '24 Hours';
      case '7d':
        return '7 Days';
      default:
        return '24 Hours';
    }
  };

  return (
    <div className={`bg-muted/50 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="font-semibold text-foreground">
              {token.symbol}
            </span>
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold text-foreground">
              ${formatNumber(currentPrice, 6)}
            </span>
            <span
              className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}
            >
              {isPositive ? '+' : ''}
              {formatNumber(priceChangePercent, 2)}%
            </span>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex space-x-1">
          {(['1h', '4h', '24h', '7d'] as const).map(tf => (
            <Button
              key={tf}
              variant={timeframe === tf ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTimeframe(tf)}
              className="text-xs px-2 py-1 h-auto"
            >
              {tf}
            </Button>
          ))}
        </div>
      </div>

      {/* Chart Area */}
      <div className="relative h-32 mb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : priceData.length > 0 ? (
          <svg width="100%" height="100%" className="overflow-visible">
            {/* Price Line */}
            <polyline
              fill="none"
              stroke={isPositive ? '#10b981' : '#ef4444'}
              strokeWidth="2"
              points={priceData
                .map((point, index) => {
                  const x = (index / (priceData.length - 1)) * 100;
                  const y =
                    priceRange > 0
                      ? (1 - (point.price - minPrice) / priceRange) * 100
                      : 50;
                  return `${x},${y}`;
                })
                .join(' ')}
            />

            {/* Gradient Fill */}
            <defs>
              <linearGradient
                id="priceGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor={isPositive ? '#10b981' : '#ef4444'}
                  stopOpacity="0.3"
                />
                <stop
                  offset="100%"
                  stopColor={isPositive ? '#10b981' : '#ef4444'}
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            <polygon
              fill="url(#priceGradient)"
              points={priceData
                .map((point, index) => {
                  const x = (index / (priceData.length - 1)) * 100;
                  const y =
                    priceRange > 0
                      ? (1 - (point.price - minPrice) / priceRange) * 100
                      : 50;
                  return `${x},${y}`;
                })
                .concat(['100,100', '0,100'])
                .join(' ')}
            />
          </svg>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No price data available
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">High</div>
          <div className="font-medium text-foreground">
            ${formatNumber(maxPrice, 6)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Low</div>
          <div className="font-medium text-foreground">
            ${formatNumber(minPrice, 6)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Volume</div>
          <div className="font-medium text-foreground">
            $
            {formatNumber(
              priceData.reduce((sum, d) => sum + d.volume, 0),
              0,
              true
            )}
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="flex items-center justify-center space-x-1 mt-3 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>Updated {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default PriceChart;
