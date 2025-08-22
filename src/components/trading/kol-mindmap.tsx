'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useKOLTradeSocket } from '@/hooks/use-kol-trade-socket';
import { useResponsiveOptimizedMindmap } from '@/hooks/use-responsive-optimized-mindmap';
import { UnifiedNode } from '@/lib/mindmap-renderer';
import { useSubscriptions } from '@/stores/use-trading-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertCircle,
  Activity,
  Smartphone,
  Tablet,
  Monitor,
  Users,
  UserCheck,
} from 'lucide-react';

// Interfaces moved to mindmap-renderer.ts for consistency

interface KOLMindmapProps {
  tokenMint: string;
  width?: number;
  height?: number;
  compact?: boolean;
  className?: string;
}

export const KOLMindmap: React.FC<KOLMindmapProps> = ({
  tokenMint,
  width = 800,
  height = 600,
  compact = false,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { allMindmapData, isConnected } = useKOLTradeSocket();
  const { isSubscribedToKOL, subscriptions } = useSubscriptions();
  const [selectedNode, setSelectedNode] = useState<UnifiedNode | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showUpdateAlert, setShowUpdateAlert] = useState(false);
  const [previousDataHash, setPreviousDataHash] = useState<string>('');
  const [showSubscribedOnly, setShowSubscribedOnly] = useState(false);

  const data = allMindmapData[tokenMint];

  // Prepare data for responsive renderer with subscription filtering
  const tokensData = useMemo(() => {
    if (!data) return {};

    // If showing subscribed only, filter KOL connections
    if (showSubscribedOnly) {
      const filteredKolConnections: typeof data.kolConnections = {};
      
      // Only include KOLs that the user is subscribed to
      Object.entries(data.kolConnections || {}).forEach(([kolWallet, kolData]) => {
        if (isSubscribedToKOL(kolWallet)) {
          filteredKolConnections[kolWallet] = kolData;
        }
      });

      // If no subscribed KOLs found, return empty data
      if (Object.keys(filteredKolConnections).length === 0) {
        return {};
      }

      // Return filtered data
      return {
        [tokenMint]: {
          ...data,
          kolConnections: filteredKolConnections,
          networkMetrics: {
            ...data.networkMetrics,
            totalTrades: Object.values(filteredKolConnections).reduce(
              (sum, kol) => sum + kol.tradeCount, 0
            ),
          },
        },
      };
    }

    return { [tokenMint]: data };
  }, [data, tokenMint, showSubscribedOnly, isSubscribedToKOL]);

  // Use responsive optimized mindmap hook
  const {
    svgRef,
    isRendering,
    renderError,
    deviceInfo,
    responsiveConfig,
    performanceMetrics,
    controls,
  } = useResponsiveOptimizedMindmap({
    containerRef,
    tokensData,
    trendingTokens: [], // Single token view doesn't need trending
    onNodeClick: node => {
      setSelectedNode(node);
    },
    onNodeHover:
      deviceInfo.isTouch && deviceInfo.isMobile
        ? undefined
        : () => {
            // Only enable hover on non-touch devices or larger touch devices
          },
    baseConfig: {
      // Override responsive defaults if compact mode is requested
      dimensions: compact
        ? {
            width: Math.min(responsiveConfig?.dimensions.width || width, 600),
            height: Math.min(
              responsiveConfig?.dimensions.height || height,
              400
            ),
          }
        : undefined,
      nodeRadius: compact
        ? {
            token: { base: 12, max: 30 },
            kol: { base: 8, max: 20 },
          }
        : undefined,
      linkDistance: compact ? 50 : undefined,
    },
  });

  // Detect mindmap updates for visual feedback
  React.useEffect(() => {
    if (data) {
      const currentDataHash = JSON.stringify({
        kolCount: Object.keys(data.kolConnections || {}).length,
        totalTrades: data.networkMetrics?.totalTrades || 0,
        lastUpdate: data.lastUpdate,
      });

      if (previousDataHash && previousDataHash !== currentDataHash) {
        setShowUpdateAlert(true);
        const timer = setTimeout(() => setShowUpdateAlert(false), 3000);
        return () => clearTimeout(timer);
      }

      setPreviousDataHash(currentDataHash);

      // Update last update time
      if (data.lastUpdate) {
        setLastUpdate(new Date(data.lastUpdate));
      }
    }
  }, [data, previousDataHash]);

  // Get device-specific icon
  const getDeviceIcon = () => {
    if (deviceInfo.isMobile) return Smartphone;
    if (deviceInfo.isTablet) return Tablet;
    return Monitor;
  };

  const DeviceIcon = getDeviceIcon();

  // Zoom controls are now handled by the responsive renderer
  const {
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    resetZoom: handleResetZoom,
  } = controls;

  // Check if we have any data to show
  const hasData = Object.keys(tokensData).length > 0;
  const subscribedKOLCount = data ? Object.keys(data.kolConnections || {}).filter(kolWallet => isSubscribedToKOL(kolWallet)).length : 0;

  if (!data) {
    return (
      <Card className={cn('w-full', className)} ref={containerRef}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Network className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">
            No network data
          </p>
          <p className="text-muted-foreground">
            Network data for this token is not available yet
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasData && showSubscribedOnly) {
    return (
      <Card className={cn('w-full', className)} ref={containerRef}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-accent-gradient rounded-lg">
                <Network className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Token Network Map</CardTitle>
                <div className="flex items-center space-x-2 mt-1">
                  <Button
                    variant={showSubscribedOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowSubscribedOnly(!showSubscribedOnly)}
                    className="h-6 px-2 text-xs"
                  >
                    <UserCheck className="h-3 w-3 mr-1" />
                    Subscribed ({subscribedKOLCount})
                  </Button>
                  <Button
                    variant={!showSubscribedOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowSubscribedOnly(!showSubscribedOnly)}
                    className="h-6 px-2 text-xs"
                  >
                    <Users className="h-3 w-3 mr-1" />
                    All KOLs
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">
            No subscribed KOLs
          </p>
          <p className="text-muted-foreground text-center">
            You haven't subscribed to any KOLs trading this token yet.
            <br />
            Switch to "All KOLs" to see the full network.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)} ref={containerRef}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent-gradient rounded-lg">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <CardTitle className="text-xl">Token Network Map</CardTitle>
                {!compact && (
                  <div className="flex items-center space-x-1 px-2 py-1 bg-muted/20 rounded-md">
                    <DeviceIcon className="h-3 w-3" />
                    <span className="text-xs text-muted-foreground">
                      {deviceInfo.isMobile
                        ? 'Mobile'
                        : deviceInfo.isTablet
                          ? 'Tablet'
                          : 'Desktop'}
                      {deviceInfo.isLowPowered && ' (Low Power)'}
                    </span>
                  </div>
                )}
              </div>
              {/* KOL Filter Toggle */}
              {!compact && (
                <div className="flex items-center space-x-2 mt-2">
                  <Button
                    variant={showSubscribedOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowSubscribedOnly(true)}
                    className="h-6 px-2 text-xs"
                  >
                    <UserCheck className="h-3 w-3 mr-1" />
                    Subscribed ({subscribedKOLCount})
                  </Button>
                  <Button
                    variant={!showSubscribedOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowSubscribedOnly(false)}
                    className="h-6 px-2 text-xs"
                  >
                    <Users className="h-3 w-3 mr-1" />
                    All KOLs ({Object.keys(data.kolConnections || {}).length})
                  </Button>
                </div>
              )}
              {!compact && (
                <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                  <span>🔗 {Object.keys(tokensData[tokenMint]?.kolConnections || {}).length} KOLs {showSubscribedOnly ? '(subscribed)' : ''}</span>
                  <span>📊 {tokensData[tokenMint]?.networkMetrics?.totalTrades || 0} trades</span>
                  <span>
                    📱 {responsiveConfig.dimensions.width}×
                    {responsiveConfig.dimensions.height}
                  </span>
                  {lastUpdate && (
                    <span>
                      🕒 Updated{' '}
                      {formatDistanceToNow(lastUpdate, { addSuffix: true })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div
              className={cn(
                'flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium',
                isConnected
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              )}
            >
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                )}
              />
              <span>{isConnected ? 'Live' : 'Offline'}</span>
            </div>

            {showUpdateAlert && (
              <div className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span>Updated!</span>
              </div>
            )}
          </div>
        </div>

        {!compact && responsiveConfig.interactions.enableZoom && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size={deviceInfo.isMobile ? 'sm' : 'sm'}
              onClick={handleZoomIn}
              disabled={isRendering}
            >
              <ZoomIn className="h-4 w-4" />
              {!deviceInfo.isMobile && (
                <span className="ml-1 hidden sm:inline">Zoom In</span>
              )}
            </Button>
            <Button
              variant="outline"
              size={deviceInfo.isMobile ? 'sm' : 'sm'}
              onClick={handleZoomOut}
              disabled={isRendering}
            >
              <ZoomOut className="h-4 w-4" />
              {!deviceInfo.isMobile && (
                <span className="ml-1 hidden sm:inline">Zoom Out</span>
              )}
            </Button>
            <Button
              variant="outline"
              size={deviceInfo.isMobile ? 'sm' : 'sm'}
              onClick={handleResetZoom}
              disabled={isRendering}
            >
              <RotateCcw className="h-4 w-4" />
              {!deviceInfo.isMobile && (
                <span className="ml-1 hidden sm:inline">Reset</span>
              )}
            </Button>
            {process.env.NODE_ENV === 'development' && (
              <Button
                variant="outline"
                size="sm"
                onClick={controls.forceRerender}
                disabled={isRendering}
              >
                <Activity className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <div className="relative">
          {/* Render Error Display */}
          {renderError && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <div className="flex flex-col items-center space-y-2 p-4 bg-card border border-border rounded-lg shadow-lg">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm font-medium">Rendering Error</p>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  {renderError}
                </p>
                <Button size="sm" onClick={controls.forceRerender}>
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isRendering && (
            <div className="absolute top-2 left-2 flex items-center space-x-2 px-2 py-1 bg-card/90 border border-border rounded-md shadow-sm z-10">
              <Activity className="h-3 w-3 animate-spin" />
              <span className="text-xs text-muted-foreground">
                Rendering...
              </span>
            </div>
          )}

          {/* Performance Metrics (Development Only) */}
          {process.env.NODE_ENV === 'development' && !compact && (
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-card/90 border border-border rounded-md shadow-sm text-xs text-muted-foreground">
              <div>Renders: {performanceMetrics.renderCount}</div>
              <div>Cache: {performanceMetrics.cacheSize}</div>
              <div>Nodes: {performanceMetrics.nodeLimit}</div>
              <div>Memory: N/A</div>
              <div>Avg Render: N/A</div>
              <div>
                Touch: {performanceMetrics.touchActive ? 'Active' : 'Inactive'}
              </div>
              <div>
                Animations: {performanceMetrics.animationEnabled ? 'On' : 'Off'}
              </div>
            </div>
          )}

          <svg
            ref={svgRef}
            width={responsiveConfig.dimensions.width}
            height={responsiveConfig.dimensions.height}
            className={cn(
              'border border-border rounded-b-lg bg-muted/10 w-full h-full',
              deviceInfo.isTouch && 'touch-pan-y touch-pinch-zoom',
              deviceInfo.isMobile && 'cursor-pointer',
              !deviceInfo.isMobile && 'cursor-grab active:cursor-grabbing'
            )}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              touchAction: deviceInfo.isTouch ? 'manipulation' : 'auto',
            }}
          />

          {selectedNode && !compact && (
            <div
              className={cn(
                'absolute p-4 bg-card border border-border rounded-lg shadow-lg',
                deviceInfo.isMobile
                  ? 'bottom-4 left-4 right-4 w-auto'
                  : 'top-4 right-4 w-64'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Selected Node</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedNode(null)}
                >
                  ×
                </Button>
              </div>
              <div
                className={cn(
                  'space-y-2 text-sm',
                  deviceInfo.isMobile && 'grid grid-cols-2 gap-2 space-y-0'
                )}
              >
                <div>
                  <span className="text-muted-foreground">ID:</span>
                  <span className="ml-2 font-mono">
                    {selectedNode.id.slice(0, 12)}...
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <span className="ml-2 capitalize">{selectedNode.type}</span>
                </div>
                {selectedNode.type === 'kol' && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Trades:</span>
                      <span className="ml-2 font-semibold">
                        {selectedNode.tradeCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Volume:</span>
                      <span className="ml-2 font-semibold">
                        {selectedNode.totalVolume?.toFixed(4)} SOL
                      </span>
                    </div>
                    <div className={deviceInfo.isMobile ? 'col-span-2' : ''}>
                      <span className="text-muted-foreground">Influence:</span>
                      <span className="ml-2 font-semibold">
                        {selectedNode.influenceScore?.toFixed(0)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Touch Interaction Hints for Mobile */}
          {deviceInfo.isTouch && deviceInfo.isMobile && !compact && (
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-card/90 border border-border rounded-md shadow-sm text-xs text-muted-foreground">
              <div className="flex items-center space-x-2">
                <span>👆 Tap nodes</span>
                {responsiveConfig.interactions.enableZoom && (
                  <span>🤏 Pinch to zoom</span>
                )}
                {responsiveConfig.interactions.doubleTapZoom && (
                  <span>👆👆 Double tap</span>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
