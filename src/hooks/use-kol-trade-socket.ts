'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUserStore } from '@/stores/use-user-store';
import { useNotifications } from '@/stores/use-ui-store';
import { PredictionResult } from '@/types';

export interface KOLTrade {
  id: string;
  kolWallet: string;
  signature: string;
  timestamp: Date;
  tradeData: {
    tokenIn: string;
    tokenOut: string;
    amountIn: number;
    amountOut: number;
    tradeType: 'buy' | 'sell';
    mint?: string;
    dexProgram: string; // Changed from 'source' to 'dexProgram'
    fee?: number;
    name?: string | undefined;
    symbol?: string | undefined;
    image?: string | undefined;
    metadataUri?: string | undefined;
  };
  affectedUsers: string[];
  processed: boolean;
  prediction?: PredictionResult;
  mindmapContribution?: {
    tokenConnections: string[];
    kolInfluenceScore: number;
    relatedTrades: string[];
  };
}

export interface MindmapUpdate {
  tokenMint: string;
  kolConnections: {
    [kolWallet: string]: {
      kolWallet: string;
      tradeCount: number;
      totalVolume: number;
      lastTradeTime: Date;
      influenceScore: number;
      tradeTypes: string[];
    };
  };
  relatedTokens: string[];
  networkMetrics: {
    centrality: number;
    clustering: number;
    totalTrades: number;
  };
  lastUpdate: Date;
}

interface UseKOLTradeSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  recentTrades: KOLTrade[];
  allMindmapData: { [tokenMint: string]: MindmapUpdate };
  trendingTokens: string[];
  isLoadingInitialData: boolean;
  stats: {
    totalTrades: number;
    uniqueKOLs: number;
    uniqueTokens: number;
    totalVolume: number;
  };
}

export const useKOLTradeSocket = (): UseKOLTradeSocketReturn => {
  void 0 && ('🚀 useKOLTradeSocket hook initialized');
  
  const { user } = useUserStore();
  const { showError } = useNotifications();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [recentTrades, setRecentTrades] = useState<KOLTrade[]>([]);
  const [allMindmapData, setAllMindmapData] = useState<{ [tokenMint: string]: MindmapUpdate }>({});
  const [trendingTokens, setTrendingTokens] = useState<string[]>([]);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [stats, setStats] = useState({
    totalTrades: 0,
    uniqueKOLs: 0,
    uniqueTokens: 0,
    totalVolume: 0
  });

  void 0 && ('🔍 Hook state:', {
    recentTradesCount: recentTrades.length,
    isConnected,
    isLoadingInitialData,
    hasUser: !!user
  });

  // Use ref to store current mindmap data to avoid dependency issues
  const mindmapDataRef = useRef<{ [tokenMint: string]: MindmapUpdate }>({});
  
  // Simple cache for token metadata by uri or mint
  const tokenMetadataCacheRef = useRef<Map<string, { name?: string; symbol?: string; image?: string }>>(new Map());

  // Helper to enrich a trade with token metadata if image is missing
  const ensureTokenMetadata = useCallback(async (trade: KOLTrade): Promise<KOLTrade> => {
    try {
      const { tradeData } = trade;
      if (!tradeData) return trade;

      // If image already present, nothing to do
      if (tradeData.image && tradeData.image.length > 0) return trade;

      const cacheKey = tradeData.metadataUri || tradeData.mint || '';
      if (!cacheKey) return trade;

      const cached = tokenMetadataCacheRef.current.get(cacheKey);
      if (cached) {
        return {
          ...trade,
          tradeData: {
            ...tradeData,
            name: tradeData.name || cached.name,
            symbol: tradeData.symbol || cached.symbol,
            image: tradeData.image || cached.image,
          },
        };
      }

      if (tradeData.metadataUri) {
        const resp = await fetch(tradeData.metadataUri).catch(() => null);
        if (resp && resp.ok) {
          const meta = await resp.json().catch(() => null);
          if (meta && (meta.image || meta.name || meta.symbol)) {
            const rawImage: string | undefined = typeof meta.image === 'string' ? meta.image : undefined;
            const normalizedImage = rawImage && rawImage.startsWith('ipfs://')
              ? `https://ipfs.io/ipfs/${rawImage.replace('ipfs://', '')}`
              : rawImage;
            const enriched = {
              name: typeof meta.name === 'string' ? meta.name : undefined,
              symbol: typeof meta.symbol === 'string' ? meta.symbol : undefined,
              image: normalizedImage,
            } as { name?: string; symbol?: string; image?: string };
            tokenMetadataCacheRef.current.set(cacheKey, enriched);
            return {
              ...trade,
              tradeData: {
                ...tradeData,
                name: tradeData.name || enriched.name,
                symbol: tradeData.symbol || enriched.symbol,
                image: enriched.image || tradeData.image,
              },
            };
          }
        }
      }
    } catch {}
    return trade;
  }, []);
  
  // Update ref when state changes
  useEffect(() => {
    mindmapDataRef.current = allMindmapData;
  }, [allMindmapData]);

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates after unmount
    
    const initializeKOLTradeSocket = async () => {
      try {
        // Get auth token from localStorage
        const authToken = localStorage.getItem('authToken');
        
        void 0 && ('🚀 KOL Trade Socket initializing...');
        void 0 && ('Environment check:', {
          apiUrl: process.env.NEXT_PUBLIC_API_URL,
          hasUser: !!user,
          hasAuthToken: !!authToken
        });

        // Load initial data
        void 0 && ('🔄 Loading initial KOL trade data...');
        void 0 && ('API URL:', process.env.NEXT_PUBLIC_API_URL);
        void 0 && ('Auth token:', authToken ? 'Present' : 'Missing');
        
        // Create headers - make auth optional for now
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        // Load initial trades, stats, and trending tokens in parallel
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        
        void 0 && ('Making API calls to:', apiUrl);
        
        const [tradesResponse, statsResponse, trendingResponse] = await Promise.all([
          fetch(`${apiUrl}/kol-trades/recent?limit=100`, { headers }).catch(err => {
            console.error('Trades API error:', err);
            return null;
          }),
          fetch(`${apiUrl}/kol-trades/stats`, { headers }).catch(err => {
            console.error('Stats API error:', err);
            return null;
          }),
          fetch(`${apiUrl}/kol-trades/trending-tokens?limit=20`, { headers }).catch(err => {
            console.error('Trending tokens API error:', err);
            return null;
          })
        ]);

        if (!isMounted) return; // Exit if component unmounted

        // Handle trades response
        if (tradesResponse && tradesResponse.ok) {
          try {
            const tradesData = await tradesResponse.json();
            void 0 && ('✅ Trades response:', tradesData);
            if (tradesData.success && tradesData.data?.trades) {
              // Debug: Check if any initial trades have predictions
              const tradesWithPredictions = tradesData.data.trades.filter((t: any) => t.prediction);
              void 0 && (`🧠 Initial trades with predictions: ${tradesWithPredictions.length}/${tradesData.data.trades.length}`);
              
              // Log a sample trade to see structure
              if (tradesData.data.trades.length > 0) {
                void 0 && ('🔍 Sample initial trade structure:', {
                  id: tradesData.data.trades[0].id,
                  kolWallet: tradesData.data.trades[0].kolWallet,
                  prediction: tradesData.data.trades[0].prediction,
                  hasPrediction: !!tradesData.data.trades[0].prediction,
                  fullTrade: tradesData.data.trades[0]
                });
              }
              
              // Enrich trades with token metadata when needed
              const enrichedTrades = await Promise.all(
                tradesData.data.trades.map((t: KOLTrade) => ensureTokenMetadata(t))
              );

              setRecentTrades(enrichedTrades);
              void 0 && (`📊 Loaded ${enrichedTrades.length} trades (enriched)`);
            } else {
              console.warn('⚠️ Trades response missing data:', tradesData);
            }
          } catch (parseError) {
            console.error('❌ Failed to parse trades response:', parseError);
          }
        } else if (tradesResponse) {
          console.error('❌ Trades API failed:', tradesResponse.status, tradesResponse.statusText);
          const errorText = await tradesResponse.text();
          console.error('Error response:', errorText);
        } else {
          console.error('❌ Trades API request failed completely');
        }

        // Handle stats response
        if (statsResponse && statsResponse.ok) {
          try {
            const statsData = await statsResponse.json();
            void 0 && ('✅ Stats response:', statsData);
            if (statsData.success && statsData.data?.tradingStats) {
              setStats(statsData.data.tradingStats);
              void 0 && ('📈 Loaded stats:', statsData.data.tradingStats);
            } else {
              console.warn('⚠️ Stats response missing data:', statsData);
            }
          } catch (parseError) {
            console.error('❌ Failed to parse stats response:', parseError);
          }
        } else if (statsResponse) {
          console.error('❌ Stats API failed:', statsResponse.status, statsResponse.statusText);
        }

        // Handle trending tokens response
        let trendingData: any = null;
        if (trendingResponse && trendingResponse.ok) {
          try {
            trendingData = await trendingResponse.json();
            void 0 && ('✅ Trending tokens response:', trendingData);
            if (trendingData.success && trendingData.data?.trendingTokens) {
              const tokens = trendingData.data.trendingTokens.map((t: any) => t.tokenMint || t);
              setTrendingTokens(tokens);
              void 0 && (`🔥 Loaded ${tokens.length} trending tokens:`, tokens);
            } else {
              console.warn('⚠️ Trending tokens response missing data:', trendingData);
            }
          } catch (parseError) {
            console.error('❌ Failed to parse trending tokens response:', parseError);
          }
        } else if (trendingResponse) {
          console.error('❌ Trending tokens API failed:', trendingResponse.status, trendingResponse.statusText);
        }

        // Load ALL available tokens with KOL activity, not just trending ones
        void 0 && ('🗺️ Loading mindmap data for available tokens...');
        try {
          let tokensToLoad: string[] = [];
          
          // First, try to get trending tokens as our primary source
          if (trendingData?.success && trendingData.data?.trendingTokens) {
            tokensToLoad = trendingData.data.trendingTokens.map((t: any) => t.tokenMint || t).slice(0, 20);
            void 0 && (`📊 Using ${tokensToLoad.length} trending tokens for mindmap data`);
          }
          
          // Try to get additional tokens with activity (this endpoint may not exist yet)
          try {
            const allTokensResponse = await fetch(`${apiUrl}/kol-trades/tokens-with-activity`, { headers });
            if (allTokensResponse && allTokensResponse.ok) {
              const allTokensData = await allTokensResponse.json();
              void 0 && ('✅ Additional tokens with activity response:', allTokensData);
              
              if (allTokensData.success && allTokensData.data?.tokens) {
                const additionalTokens = allTokensData.data.tokens.map((t: any) => t.tokenMint || t);
                // Merge with trending tokens, avoiding duplicates
                const existingTokens = new Set(tokensToLoad);
                const newTokens = additionalTokens.filter((token: string) => !existingTokens.has(token));
                tokensToLoad = [...tokensToLoad, ...newTokens].slice(0, 50); // Limit total to 50
                void 0 && (`📊 Found ${newTokens.length} additional tokens with KOL activity, total: ${tokensToLoad.length}`);
              }
            }
          } catch (error) {
            void 0 && ('ℹ️ Additional tokens endpoint not available, using trending tokens only');
          }
          
          if (tokensToLoad.length > 0) {
            // Load mindmap data for all tokens
            const mindmapPromises = tokensToLoad.map(async (tokenMint: string) => {
              try {
                void 0 && (`🗺️ Loading mindmap for token: ${tokenMint}`);
                const mindmapResponse = await fetch(`${apiUrl}/kol-trades/mindmap/${tokenMint}`, { headers });
                if (mindmapResponse.ok) {
                  const mindmapData = await mindmapResponse.json();
                  void 0 && (`✅ Mindmap data for ${tokenMint}:`, mindmapData);
                  if (mindmapData.success && mindmapData.data?.mindmap) {
                    return { tokenMint, data: mindmapData.data.mindmap };
                  }
                } else {
                  console.warn(`⚠️ Mindmap API failed for ${tokenMint}:`, mindmapResponse.status);
                }
              } catch (error) {
                console.warn(`❌ Failed to load mindmap for ${tokenMint}:`, error);
              }
              return null;
            });

            const mindmapResults = await Promise.all(mindmapPromises);
            const initialMindmapData: { [tokenMint: string]: MindmapUpdate } = {};
            
            mindmapResults.forEach(result => {
              if (result) {
                initialMindmapData[result.tokenMint] = result.data;
                void 0 && (`📊 Added mindmap for ${result.tokenMint}`);
              }
            });
            
            if (isMounted) {
              setAllMindmapData(initialMindmapData);
              void 0 && (`🗺️ Total mindmap data loaded: ${Object.keys(initialMindmapData).length} tokens`);
            }
          } else {
            console.warn('⚠️ No tokens available for mindmap data loading');
          }
        } catch (error) {
          console.error('❌ Failed to load mindmap data:', error);
        }

        if (isMounted) {
          setIsLoadingInitialData(false);
          void 0 && ('✅ Initial data loading completed');
        }

        // Only connect WebSocket if we have an auth token
        if (!authToken) {
          console.warn('⚠️ No auth token found, skipping WebSocket connection');
          return;
        }

        void 0 && ('🔌 Connecting to WebSocket:', apiUrl);
        
        const newSocket = io(apiUrl, {
          auth: { token: authToken },
          transports: ['websocket'],
          timeout: 10000
        });

        newSocket.on('connect', () => {
          void 0 && ('✅ Connected to KOL Trade WebSocket');
          if (isMounted) {
            setIsConnected(true);
          }
          
          // Automatically subscribe to all trades on connection
          newSocket.emit('subscribe_kol_trades');
          void 0 && ('🔄 Auto-subscribed to all KOL trades');
          
          // Subscribe to get all tokens with KOL activity updates
          newSocket.emit('subscribe_all_token_activity');
          void 0 && ('🔄 Auto-subscribed to all token activity updates');
          
          // Re-subscribe to mindmap updates for existing tokens
          const existingTokens = Object.keys(mindmapDataRef.current);
          if (existingTokens.length > 0) {
            existingTokens.forEach(tokenMint => {
              newSocket.emit('subscribe_mindmap', { tokenMint });
            });
            void 0 && (`🔄 Re-subscribed to mindmap updates for ${existingTokens.length} existing tokens`);
          }
          
          // Send heartbeat to keep connection alive
          const heartbeat = setInterval(() => {
            if (newSocket.connected) {
              newSocket.emit('heartbeat');
            } else {
              clearInterval(heartbeat);
            }
          }, 30000); // Every 30 seconds
          
          // Periodic refresh to ensure comprehensive data coverage
          const dataRefresh = setInterval(() => {
            if (newSocket.connected) {
              // Request fresh data periodically to ensure we don't miss anything
              newSocket.emit('request_all_active_tokens');
              newSocket.emit('request_recent_trades', { limit: 100 });
              void 0 && ('🔄 Periodic refresh: requested all active tokens and recent trades');
            } else {
              clearInterval(dataRefresh);
            }
          }, 120000); // Every 2 minutes
          
          // Store interval references for cleanup
          (newSocket as any)._intervals = { heartbeat, dataRefresh };
        });

        newSocket.on('disconnect', (reason) => {
          void 0 && ('❌ Disconnected from KOL Trade WebSocket:', reason);
          if (isMounted) {
            setIsConnected(false);
          }
          
          // Attempt to reconnect after a delay
          if (reason === 'io server disconnect') {
            // Server initiated disconnect, try to reconnect
            setTimeout(() => {
              if (isMounted) {
                void 0 && ('🔄 Attempting to reconnect...');
                newSocket.connect();
              }
            }, 5000);
          }
        });

        newSocket.on('connect_error', (error) => {
          console.error('❌ WebSocket connection error:', error);
          if (isMounted) {
            setIsConnected(false);
            showError('Connection Error', 'Failed to connect to live trade feed');
          }
        });

        // Real-time trade updates (ALL TRADES)
        newSocket.on('kol_trade_update', async (data: any) => {
          // Extract the actual trade data from the nested structure
          const trade: KOLTrade = data.trade || data;
          
          void 0 && ('📈 New KOL trade received:', {
            id: trade.id,
            kolWallet: trade.kolWallet,
            tokenIn: trade.tradeData?.tokenIn,
            tokenOut: trade.tradeData?.tokenOut,
            tradeType: trade.tradeData?.tradeType,
            amountIn: trade.tradeData?.amountIn,
            dexProgram: trade.tradeData?.dexProgram, // Add dexProgram logging
            timestamp: trade.timestamp,
            prediction: trade.prediction, // Add prediction logging
            hasPrediction: !!trade.prediction,
            rawData: data
          });

          // Detailed prediction debugging
          if (trade.prediction) {
            void 0 && ('🧠 WebSocket - ML Prediction received:', {
              classLabel: trade.prediction.classLabel,
              probability: trade.prediction.probability,
              probabilityPercentage: (trade.prediction.probability * 100).toFixed(1) + '%',
              taskType: trade.prediction.taskType,
              classIndex: trade.prediction.classIndex,
              allProbabilities: trade.prediction.probabilities
            });
          } else {
            void 0 && ('❌ WebSocket - No ML prediction in trade data');
            void 0 && ('🔍 WebSocket - Full raw data structure:', JSON.stringify(data, null, 2));
          }
          
          if (isMounted) {
            // Enrich trade with token metadata if necessary
            const enrichedTrade = await ensureTokenMetadata(trade);
            // Ensure the trade has a proper timestamp and unique ID
            const processedTrade: KOLTrade = {
              ...enrichedTrade,
              timestamp: enrichedTrade.timestamp ? new Date(enrichedTrade.timestamp) : new Date(),
              id: enrichedTrade.id || `${enrichedTrade.kolWallet}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            };
            
            void 0 && ('📈 Processed trade for state update:', {
              id: processedTrade.id,
              kolWallet: processedTrade.kolWallet,
              prediction: processedTrade.prediction,
              hasPrediction: !!processedTrade.prediction
            });
            
            setRecentTrades(prev => {
              // Check for duplicates
              if (prev.some(t => t.id === processedTrade.id)) {
                void 0 && ('🔄 Skipping duplicate trade:', processedTrade.id);
                return prev;
              }
              
              // Add new trade and keep last 100
              const updated = [processedTrade, ...prev.slice(0, 99)];
              void 0 && (`📊 Updated trades array: ${updated.length} total trades`);
              
              // Debug: Check if any trades have predictions
              const tradesWithPredictions = updated.filter(t => t.prediction);
              void 0 && (`🧠 Trades with predictions in state: ${tradesWithPredictions.length}/${updated.length}`);
              
              return updated;
            });
            
            // Update stats after a brief delay to ensure the trade is in state
            setTimeout(() => {
              setRecentTrades(current => {
                const uniqueKOLs = new Set(current.map(t => t.kolWallet));
                const uniqueTokens = new Set(current.flatMap(t => [
                  t.tradeData?.tokenIn, 
                  t.tradeData?.tokenOut, 
                  t.tradeData?.mint
                ].filter(Boolean)));
                
                setStats({
                  totalTrades: current.length,
                  uniqueKOLs: uniqueKOLs.size,
                  uniqueTokens: uniqueTokens.size,
                  totalVolume: current.reduce((sum, t) => sum + (t.tradeData?.amountIn || 0), 0)
                });
                
                return current;
              });
            }, 10);
          }
        });

        newSocket.on('personal_kol_trade_alert', (data: any) => {
          (async () => {
            const trade: KOLTrade = data.trade || data;
            void 0 && ('🔔 Personal KOL trade alert:', trade);
            if (!isMounted) return;
            const enrichedTrade = await ensureTokenMetadata(trade);
            const processedTrade: KOLTrade = {
              ...enrichedTrade,
              timestamp: enrichedTrade.timestamp ? new Date(enrichedTrade.timestamp) : new Date(),
              id:
                enrichedTrade.id ||
                `${enrichedTrade.kolWallet}-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`,
            };
            setRecentTrades(prev => {
              if (prev.some(t => t.id === processedTrade.id)) return prev;
              return [processedTrade, ...prev.slice(0, 99)];
            });
          })();
        });

        // Real-time mindmap updates
        newSocket.on('mindmap_update', (update: MindmapUpdate) => {
          void 0 && ('🗺️ Mindmap update received for token:', update.tokenMint);
          void 0 && ('📊 Mindmap data:', {
            tokenMint: update.tokenMint,
            kolCount: Object.keys(update.kolConnections || {}).length,
            totalTrades: update.networkMetrics?.totalTrades || 0,
            lastUpdate: update.lastUpdate
          });
          
          if (isMounted) {
            setAllMindmapData(prev => {
              const updated = {
                ...prev,
                [update.tokenMint]: update
              };
              void 0 && (`🗺️ Updated mindmap data: ${Object.keys(updated).length} tokens available`);
              return updated;
            });
          }
        });

        // Listen for new trending tokens
        newSocket.on('trending_tokens_update', (tokens: string[]) => {
          void 0 && ('📊 Trending tokens updated:', tokens);
          if (isMounted) {
            setTrendingTokens(tokens);
            
            // Auto-subscribe to mindmap updates for new trending tokens
            tokens.forEach(tokenMint => {
              if (!mindmapDataRef.current[tokenMint]) {
                void 0 && (`🔄 Auto-subscribing to mindmap for new trending token: ${tokenMint}`);
                newSocket.emit('subscribe_mindmap', { tokenMint });
              }
            });
          }
        });

        // Listen for all token activity updates (comprehensive)
        newSocket.on('all_token_activity_update', (data: { tokens: string[], totalKOLs: number, totalTrades: number }) => {
          void 0 && ('📊 All token activity updated:', data);
          if (isMounted && data.tokens) {
            // Auto-subscribe to mindmap updates for all active tokens
            data.tokens.forEach(tokenMint => {
              if (!mindmapDataRef.current[tokenMint]) {
                void 0 && (`🔄 Auto-subscribing to mindmap for active token: ${tokenMint}`);
                newSocket.emit('subscribe_mindmap', { tokenMint });
              }
            });
            
            // Update stats with comprehensive data
            setStats(prevStats => ({
              ...prevStats,
              uniqueTokens: data.tokens.length,
              uniqueKOLs: data.totalKOLs,
              totalTrades: data.totalTrades
            }));
          }
        });

        // Real-time stats updates
        newSocket.on('stats_update', (newStats: any) => {
          void 0 && ('📊 Stats update received:', newStats);
          if (isMounted) {
            setStats(newStats);
          }
        });

        // Handle periodic refresh responses
        newSocket.on('all_active_tokens_response', (data: { tokens: string[] }) => {
          void 0 && ('📊 All active tokens response:', data);
          if (isMounted && data.tokens) {
            // Subscribe to mindmap updates for any new tokens we discover
            data.tokens.forEach(tokenMint => {
              if (!mindmapDataRef.current[tokenMint]) {
                void 0 && (`🔄 Discovered new active token, subscribing to mindmap: ${tokenMint}`);
                newSocket.emit('subscribe_mindmap', { tokenMint });
              }
            });
          }
        });

        newSocket.on('recent_trades_response', (data: { trades: KOLTrade[] }) => {
          void 0 && ('📊 Recent trades response:', data);
          if (isMounted && data.trades) {
            // Merge with existing trades, avoiding duplicates
            setRecentTrades(prev => {
              const existingIds = new Set(prev.map(t => t.id));
              const newTrades = data.trades.filter(t => !existingIds.has(t.id));
              const merged = [...newTrades, ...prev].slice(0, 100); // Keep last 100
              
              if (newTrades.length > 0) {
                void 0 && (`📈 Merged ${newTrades.length} new trades from refresh`);
              }
              
              return merged;
            });
          }
        });

        if (isMounted) {
          setSocket(newSocket);
        }

      } catch (error) {
        console.error('❌ Failed to initialize KOL trade socket:', error);
        if (isMounted) {
          showError('Failed to load KOL trade data', 'Please check your network connection and try refreshing the page');
          setIsLoadingInitialData(false);
        }
      }
    };

    initializeKOLTradeSocket();

    return () => {
      isMounted = false; // Prevent state updates after unmount
      void 0 && ('🔌 Disconnecting WebSocket...');
      if (socket) {
        socket.disconnect();
        // Clean up intervals if they exist
        if ((socket as any)._intervals) {
          clearInterval((socket as any)._intervals.heartbeat);
          clearInterval((socket as any)._intervals.dataRefresh);
        }
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Auto-subscribe to mindmap updates for trending tokens
  useEffect(() => {
    if (socket && isConnected && trendingTokens.length > 0) {
      trendingTokens.forEach(tokenMint => {
        socket.emit('subscribe_mindmap', { tokenMint });
      });
      void 0 && (`🗺️ Auto-subscribed to mindmap updates for ${trendingTokens.length} trending tokens`);
    }
  }, [socket, isConnected, trendingTokens]);

  return {
    socket,
    isConnected,
    recentTrades,
    allMindmapData,
    trendingTokens,
    isLoadingInitialData,
    stats
  };
}; 