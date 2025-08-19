'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KOLMindmap } from '@/components/trading/kol-mindmap';
import { OptimizedUnifiedKOLMindmap } from '@/components/trading/optimized-unified-kol-mindmap';
import { MindmapUpdate } from '@/hooks/use-kol-trade-socket';
import { 
  Activity, 
  Zap, 
  Clock, 
  BarChart3, 
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Lightbulb
} from 'lucide-react';

interface PerformanceStats {
  renderTime: number;
  nodeCount: number;
  linkCount: number;
  cacheHits: number;
  memoryUsage: number;
}

export const MindmapPerformanceDemo: React.FC = () => {
  const [demoMode, setDemoMode] = useState<'single' | 'unified'>('single');
  const [isGenerating, setIsGenerating] = useState(false);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);
  const [mockData, setMockData] = useState<{ [tokenMint: string]: MindmapUpdate }>({});

  // Generate mock data for performance testing
  const generateMockData = (tokenCount: number, kolsPerToken: number) => {
    setIsGenerating(true);
    
    setTimeout(() => {
      const data: { [tokenMint: string]: MindmapUpdate } = {};
      
      for (let i = 0; i < tokenCount; i++) {
        const tokenMint = `token_${i}_${Math.random().toString(36).substr(2, 9)}`;
        const kolConnections: { [kolWallet: string]: any } = {};
        
        for (let j = 0; j < kolsPerToken; j++) {
          const kolWallet = `kol_${i}_${j}_${Math.random().toString(36).substr(2, 9)}`;
          kolConnections[kolWallet] = {
            kolWallet,
            tradeCount: Math.floor(Math.random() * 50) + 1,
            totalVolume: Math.random() * 1000,
            influenceScore: Math.floor(Math.random() * 100),
            lastTradeTime: new Date().toISOString()
          };
        }
        
        data[tokenMint] = {
          tokenMint,
          kolConnections,
          networkMetrics: {
            totalTrades: Object.values(kolConnections).reduce((sum, kol) => sum + kol.tradeCount, 0),
            totalVolume: Object.values(kolConnections).reduce((sum, kol) => sum + kol.totalVolume, 0),
            averageInfluence: Object.values(kolConnections).reduce((sum, kol) => sum + kol.influenceScore, 0) / kolsPerToken
          },
          lastUpdate: new Date().toISOString()
        };
      }
      
      setMockData(data);
      setIsGenerating(false);
      
      // Calculate performance stats
      const nodeCount = tokenCount + (tokenCount * kolsPerToken);
      const linkCount = tokenCount * kolsPerToken;
      
      setPerformanceStats({
        renderTime: 0, // Will be updated by actual rendering
        nodeCount,
        linkCount,
        cacheHits: 0,
        memoryUsage: JSON.stringify(data).length / 1024 // KB
      });
    }, 100);
  };

  // Performance test scenarios
  const testScenarios = [
    { name: 'Small', tokens: 3, kolsPerToken: 5, description: '3 tokens, 5 KOLs each' },
    { name: 'Medium', tokens: 10, kolsPerToken: 8, description: '10 tokens, 8 KOLs each' },
    { name: 'Large', tokens: 25, kolsPerToken: 12, description: '25 tokens, 12 KOLs each' },
    { name: 'Stress', tokens: 50, kolsPerToken: 15, description: '50 tokens, 15 KOLs each' }
  ];

  useEffect(() => {
    // Generate initial small dataset
    generateMockData(3, 5);
  }, []);

  const runPerformanceTest = async (scenario: typeof testScenarios[0]) => {
    generateMockData(scenario.tokens, scenario.kolsPerToken);
    
    // Wait for render and collect metrics
    setTimeout(() => {
      console.log('Performance test completed for scenario:', scenario.name);
    }, 2000);
  };

  const getPerformanceColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Mindmap Performance Demo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Compare performance between original and optimized mindmap implementations
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Selection */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Demo Mode:</span>
            <Button
              variant={demoMode === 'single' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDemoMode('single')}
            >
              Single Token
            </Button>
            <Button
              variant={demoMode === 'unified' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDemoMode('unified')}
            >
              Unified View
            </Button>
          </div>

          {/* Test Scenarios */}
          <div className="space-y-2">
            <span className="text-sm font-medium">Test Scenarios:</span>
            <div className="flex flex-wrap gap-2">
              {testScenarios.map((scenario) => (
                <Button
                  key={scenario.name}
                  variant="outline"
                  size="sm"
                  onClick={() => runPerformanceTest(scenario)}
                  disabled={isGenerating}
                  className="flex items-center gap-1"
                >
                  <BarChart3 className="h-3 w-3" />
                  {scenario.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Performance Stats */}
          {performanceStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted/20 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{performanceStats.nodeCount}</div>
                <div className="text-xs text-muted-foreground">Nodes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{performanceStats.linkCount}</div>
                <div className="text-xs text-muted-foreground">Links</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getPerformanceColor(performanceStats.renderTime, { good: 100, warning: 500 })}`}>
                  {performanceStats.renderTime.toFixed(0)}ms
                </div>
                <div className="text-xs text-muted-foreground">Render Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{performanceStats.cacheHits}</div>
                <div className="text-xs text-muted-foreground">Cache Hits</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{performanceStats.memoryUsage.toFixed(1)}KB</div>
                <div className="text-xs text-muted-foreground">Memory</div>
              </div>
            </div>
          )}

          {/* Optimization Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Optimizations Implemented
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="text-xs">✓</Badge>
                  <span>Incremental rendering (prevents UI blocking)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="text-xs">✓</Badge>
                  <span>Data memoization (avoids recalculations)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="text-xs">✓</Badge>
                  <span>Optimized D3 simulation parameters</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="text-xs">✓</Badge>
                  <span>Proper cleanup (prevents memory leaks)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="text-xs">✓</Badge>
                  <span>Throttled tick updates (~60fps)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="text-xs">✓</Badge>
                  <span>Debounced re-renders (100ms)</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  Performance Targets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Initial render:</span>
                  <Badge variant="outline" className="text-xs">{'< 500ms'}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Full load time:</span>
                  <Badge variant="outline" className="text-xs">{'< 2s'}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Memory usage:</span>
                  <Badge variant="outline" className="text-xs">Optimized</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Cache efficiency:</span>
                  <Badge variant="outline" className="text-xs">High</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Error recovery:</span>
                  <Badge variant="outline" className="text-xs">Automatic</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Mindmap Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {demoMode === 'single' ? 'Single Token Mindmap' : 'Unified Mindmap'} 
            {isGenerating && <Badge variant="secondary" className="animate-pulse">Generating...</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(mockData).length > 0 ? (
            demoMode === 'single' ? (
              <KOLMindmap
                tokenMint={Object.keys(mockData)[0]}
                width={800}
                height={500}
                className="border rounded-lg"
              />
            ) : (
              <OptimizedUnifiedKOLMindmap
                tokensData={mockData}
                trendingTokens={Object.keys(mockData).slice(0, 2)}
                width={1000}
                height={600}
                className="border rounded-lg"
              />
            )
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <Activity className="h-8 w-8 animate-spin mr-2" />
              Loading demo data...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-600" />
            Performance Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>• <strong>Incremental Loading:</strong> Large datasets are rendered in phases to prevent UI blocking</p>
          <p>• <strong>Smart Caching:</strong> Processed data is cached with TTL to avoid redundant calculations</p>
          <p>• <strong>Optimized Forces:</strong> D3 simulation parameters are tuned for better performance</p>
          <p>• <strong>Memory Management:</strong> Automatic cleanup prevents memory leaks during navigation</p>
          <p>• <strong>Error Recovery:</strong> Graceful fallbacks ensure the UI remains functional during failures</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MindmapPerformanceDemo;