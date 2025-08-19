'use client';

import React from 'react';
import { useKOLTradeSocketContext } from '@/contexts/kol-trade-socket-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const SocketDebug: React.FC = () => {
  const {
    recentTrades,
    allMindmapData,
    trendingTokens,
    stats,
    isConnected,
    isLoadingInitialData,
    connectionState,
  } = useKOLTradeSocketContext();

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm">🔍 WebSocket Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-semibold">Connection Status:</div>
            <div className={`${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isConnected ? '✅ Connected' : '❌ Disconnected'}
            </div>
          </div>
          
          <div>
            <div className="font-semibold">Loading:</div>
            <div>{isLoadingInitialData ? '⏳ Loading...' : '✅ Loaded'}</div>
          </div>
          
          <div>
            <div className="font-semibold">Trades Count:</div>
            <div>{recentTrades.length} trades</div>
          </div>
          
          <div>
            <div className="font-semibold">Mindmap Tokens:</div>
            <div>{Object.keys(allMindmapData).length} tokens</div>
          </div>
          
          <div>
            <div className="font-semibold">Trending Tokens:</div>
            <div>{trendingTokens.length} tokens</div>
          </div>
          
          <div>
            <div className="font-semibold">Total Trades (Stats):</div>
            <div>{stats.totalTrades}</div>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="font-semibold">Recent Trades (Last 3):</div>
          <div className="space-y-1">
            {recentTrades.slice(0, 3).map((trade, index) => (
              <div key={trade.id} className="text-xs bg-muted/20 p-2 rounded">
                {index + 1}. {trade.kolWallet} - {trade.tradeData?.tradeType} - {new Date(trade.timestamp).toLocaleTimeString()}
              </div>
            ))}
            {recentTrades.length === 0 && (
              <div className="text-muted-foreground">No trades available</div>
            )}
          </div>
        </div>
        
        <div className="mt-4">
          <div className="font-semibold">Mindmap Tokens:</div>
          <div className="text-xs text-muted-foreground">
            {Object.keys(allMindmapData).join(', ') || 'No mindmap data'}
          </div>
        </div>
        
        <div className="mt-4">
          <div className="font-semibold">Connection Health:</div>
          <div className="text-xs">
            Health: {connectionState?.connectionHealth || 'unknown'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};