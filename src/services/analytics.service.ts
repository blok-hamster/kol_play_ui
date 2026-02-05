import { authenticatedRequest } from '@/lib/request-manager';
import WebSocketService, { getWebSocketService } from './websocket.service';
import { useUserStore } from '@/stores/use-user-store';
import apiClient from '@/lib/api';
import { ApiResponse } from '@/types';

export interface SentimentAnalysisResult {
  score: number;
  positiveWords: string[];
  negativeWords: string[];
  sampleTweets: string[];
  summary?: string;
  mindmap_aura?: string;
}

export interface WalletStats {
  totalPnL: number;
  winRate: number;
  totalVolume: number;
  totalTrades: number;
  avgTradeSize: number;
}

export class AnalyticsService {
  private static agentSocket: WebSocketService | null = null;

  private static getAgentSocket(): WebSocketService {
    if (!this.agentSocket) {
      // Create a dedicated socket connection to the RPC Server (Port 3001)
      // defaulting to localhost:3001 if env var is missing
      const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3001';
      console.log(`[AnalyticsService] Initializing Agent Socket at ${agentUrl}`);
      
      this.agentSocket = new WebSocketService({
        url: agentUrl,
        path: '/socket.io', // Standard socket.io path
        reconnectInterval: 2000
      });
      
      // Proactively connect on initialization to avoid double-click issue
      // Only attempt if user is authenticated
      const hasToken = apiClient.getToken();
      if (!hasToken) {
        console.log('[AnalyticsService] ℹ️ No auth token found. Socket will connect after login.');
      } else {
        console.log('[AnalyticsService] Pre-warming agent socket connection...');
        try {
          if (this.agentSocket && typeof this.agentSocket.connect === 'function') {
            const connectPromise = this.agentSocket.connect();
            if (connectPromise && typeof connectPromise.then === 'function') {
              connectPromise.then(() => {
                console.log('[AnalyticsService] ✅ Agent socket pre-warmed and ready');
              }).catch(err => {
                // Gracefully handle auth errors (user not logged in)
                if (err?.message?.includes('authentication token')) {
                  console.log('[AnalyticsService] ℹ️ Socket requires authentication. Features will be available after login.');
                } else {
                  console.warn('[AnalyticsService] ⚠️ Pre-warm connection failed, will retry on demand:', err?.message || err);
                }
              });
            } else {
              console.warn('[AnalyticsService] ⚠️ connect() did not return a Promise, skipping pre-warm');
            }
          }
        } catch (err) {
          console.warn('[AnalyticsService] ⚠️ Error during socket pre-warm:', err);
        }
      }
    }
    return this.agentSocket;
  }

  /**
   * Trigger Sentiment Analysis via WebSocket
   * Returns a promise that resolves when the agent returns data
   */
  static analyzeSentiment(token: string): Promise<SentimentAnalysisResult> {
    return new Promise((resolve, reject) => {
      const wsService = this.getAgentSocket();
      
      console.log(`[AnalyticsService] Requesting analysis for ${token}...`);

      const ensureConnection = async () => {
          if (!wsService.getStatus().isConnected) {
              console.log("[AnalyticsService] Agent Socket not connected. Attempting connection...");
              // Add a 15s timeout for the connection phase
              const connectPromise = wsService.connect();
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Agent Socket connection timed out")), 15000)
              );
              await Promise.race([connectPromise, timeoutPromise]);
              console.log("[AnalyticsService] Agent Socket connection SUCCESS");
          }
      };

      ensureConnection().then(() => {
          console.log("[AnalyticsService] ✅ Connection ensured. Preparing to send agent:start...");
          const threadId = `sentiment-${token}-${Date.now()}`;
          console.log(`[AnalyticsService] 🎯 Generated threadId: ${threadId}`);
          const currentUserId = useUserStore.getState().user?.id;
          console.log(`[AnalyticsService] 👤 Current userId: ${currentUserId}`);
          let completed = false;
          
          const cleanup = () => {
             wsService.off(['onAgentComplete', 'onAgentHistoryResponse', 'onAgentError']);
          };

          const handler = {
              onAgentComplete: (payload: any) => {
                if (payload.threadId === threadId) {
                  console.log("[AnalyticsService] Sentiment analysis completed:", payload);
                  completed = true;
                  
                  // Request the final history to get the result
                  wsService.send('agent:history', { threadId });
                }
              },
              onAgentHistoryResponse: (payload: any) => {
                if (payload.threadId === threadId && completed) {
                  console.log("[AnalyticsService] Received history response:", payload);
                  cleanup(); // NOW we cleanup
                  
                  // Extract the final assistant message
                  const messages = payload.messages || [];
                  const lastAssistantMsg = messages.reverse().find((m: any) => {
                    const role = m.role || (m.type === 'ai' ? 'assistant' : 'user');
                    return role === 'assistant';
                  });
                  
                  if (lastAssistantMsg) {
                    const content = lastAssistantMsg.content || lastAssistantMsg.text || '';
                    
                    try {
                      // Extract JSON if it's wrapped in markdown code blocks
                      const jsonMatch = content.match(/\{[\s\S]*\}/);
                      const jsonStr = jsonMatch ? jsonMatch[0] : content;
                      const parsed = JSON.parse(jsonStr);
                      
                      resolve({
                        score: typeof parsed.score === 'number' ? parsed.score : 50,
                        positiveWords: parsed.positiveWords || [],
                        negativeWords: parsed.negativeWords || [],
                        sampleTweets: parsed.sampleTweets || [],
                        summary: parsed.summary || content,
                        mindmap_aura: parsed.mindmap_aura
                      });
                    } catch (e) {
                      console.warn("[AnalyticsService] Failed to parse structured JSON, falling back to raw content:", e);
                      resolve({
                        score: 0.5,
                        positiveWords: [],
                        negativeWords: [],
                        sampleTweets: [],
                        summary: content
                      });
                    }
                  } else {
                    reject(new Error("No assistant response found"));
                  }
                }
              },
              onAgentError: (payload: any) => {
                console.error("[AnalyticsService] Agent Error:", payload);
                if (payload.threadId === threadId) {
                    cleanup();
                    reject(new Error(payload.error));
                }
              }
          };

          wsService.on(handler);

          // Use the standard agent:start event with sentiment_swarm type
          console.log(`[AnalyticsService] Emitting agent:start for ${token} (thread: ${threadId})`);
          const sent = wsService.send('agent:start', {
            agentType: 'sentiment_swarm',
            threadId,
            input: {
              messages: [{
                id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                role: 'user',
                content: `Analyze market sentiment for token: ${token}`
              }]
            },
            userId: currentUserId
          });
          
          if (!sent) {
              cleanup();
              reject(new Error("Failed to send WebSocket message (Socket might be disconnected)"));
              return;
          }
      }).catch(err => {
          console.error("Agent Socket Connection Failed:", err);
          reject(err);
      });

      setTimeout(() => {
        reject(new Error("Sentiment analysis timed out"));
      }, 60000); 
    });
  }

  /**
   * Get ML Prediction for a token
   * Returns prediction probability
   */
  static async getPrediction(tokenSymbol: string): Promise<{ probability: number } | null> {
    try {
      const cleanToken = tokenSymbol.replace('$', '');

      // Endpoint: POST /api/features/predict-trade
      // Body: { mints: [cleanToken] }
      // Response: { success: true, data: PredictionResult[] }
      
      const response = await authenticatedRequest<ApiResponse<any[]>>(
        () => apiClient.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/features/predict-trade`,
          { mints: [cleanToken] }
        )
      );

      if (response && response.success && response.data && response.data.length > 0) {
        const result = response.data[0];
        // Result has { probability, label, etc }
        return {
           probability: result.probability || 0
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get prediction:', error);
      return null;
    }
  }
}
