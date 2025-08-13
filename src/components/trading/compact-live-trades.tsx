'use client';

import React, { useMemo, useState } from 'react';
import { Activity, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKOLTradeSocket } from '@/hooks/use-kol-trade-socket';
import { Button } from '@/components/ui/button';

interface CompactLiveTradesProps {
  limit?: number;
  className?: string;
  defaultExpanded?: boolean;
}

export const CompactLiveTrades: React.FC<CompactLiveTradesProps> = ({ limit = 30, className = '', defaultExpanded = true }) => {
  const { isConnected, recentTrades } = useKOLTradeSocket();
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  const trades = useMemo(() => {
    return recentTrades.slice(0, limit);
  }, [recentTrades, limit]);

  const displayedTrades = useMemo(() => {
    const collapsedCount = 5;
    return trades.slice(0, isExpanded ? limit : Math.min(collapsedCount, limit));
  }, [trades, isExpanded, limit]);

  return (
    <div className={cn('mt-4 p-3 bg-muted/20 rounded-lg border', className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
            <Activity className="w-4 h-4" />
            <span>Recent Live Trades</span>
          </h4>
          <div className={cn('flex items-center space-x-1 text-xs', isConnected ? 'text-green-600' : 'text-red-600')}>
            <div className={cn('w-2 h-2 rounded-full', isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500')} />
            <span>{isConnected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsExpanded(prev => !prev)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>

      {displayedTrades.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">No recent trades</div>
      ) : (
        <div className="space-y-1">
          {displayedTrades.map((trade, idx) => {
            const isBuy = (trade.tradeData?.tradeType ?? 'sell') === 'buy';
            const prediction: any = trade.prediction || (trade.tradeData as any)?.prediction;
            const hasPrediction = Boolean(prediction);
            const tokenImg = trade.tradeData?.image;
            const tokenName = trade.tradeData?.name?.trim();
            const tokenSymbol = trade.tradeData?.symbol?.trim();
            const tokenMint = trade.tradeData?.mint;

            return (
              <div key={`${trade.id}-${idx}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <div className={cn('w-1.5 h-1.5 rounded-full', isBuy ? 'bg-green-500' : 'bg-red-500')} />
                    {(tokenSymbol || tokenName || tokenImg || tokenMint) && (
                      <div className="flex items-center space-x-1">
                        {tokenImg && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={tokenImg} alt={tokenSymbol || tokenName || 'Token'} className="w-3.5 h-3.5 rounded" />
                        )}
                        <span className="font-medium">
                          {tokenName && tokenSymbol
                            ? `${tokenName} (${tokenSymbol})`
                            : tokenName || tokenSymbol || (tokenMint ? `${tokenMint.slice(0,4)}...${tokenMint.slice(-4)}` : 'Token')}
                        </span>
                      </div>
                    )}
                    <span className="text-muted-foreground">{(trade.tradeData?.tradeType ?? 'sell').toUpperCase()}</span>
                    <span className="font-medium">
                      {(() => {
                        if (isBuy) {
                          // For buy: show SOL spent
                          return `${trade.tradeData?.amountOut?.toFixed(2) || '0.00'} SOL`;
                        } else {
                          // For sell: show SOL received
                          return `${trade.tradeData?.amountIn?.toFixed(2) || '0.00'} SOL`;
                        }
                      })()}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {trade.timestamp
                      ? new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Now'}
                  </span>
                </div>

                {/* ML Prediction for each trade - mirror KOL card behavior */}
                {(() => {
                  const shouldShowPrediction = hasPrediction && isBuy;
                  return shouldShowPrediction ? (
                    <div className="flex items-center justify-between text-xs bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded">
                      <div className="flex items-center space-x-1">
                        <Brain className="w-3 h-3 text-purple-500" />
                        <span className="text-purple-700 dark:text-purple-300 font-medium">
                          {prediction.classLabel} (Buy)
                        </span>
                      </div>
                      <span className="font-medium text-purple-600 dark:text-purple-400">
                        {(prediction.probability * 100).toFixed(0)}%
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs bg-muted/10 px-2 py-1 rounded">
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-muted/40 rounded animate-pulse" />
                        <div className="w-16 h-3 bg-muted/40 rounded animate-pulse" />
                      </div>
                      <div className="w-8 h-3 bg-muted/40 rounded animate-pulse" />
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}; 