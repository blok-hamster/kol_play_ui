'use client';

import React, { useRef } from 'react';
import { useResponsiveMindmap } from '@/hooks/use-responsive-mindmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Smartphone, Tablet, Monitor, Zap, ZapOff } from 'lucide-react';

/**
 * Demo component to showcase responsive mindmap capabilities
 */
export const ResponsiveMindmapDemo: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    deviceInfo,
    responsiveConfig,
    isResponsiveBreakpoint,
    getOptimalNodeCount,
    shouldReduceAnimations,
    shouldEnableTouch,
  } = useResponsiveMindmap(containerRef);

  const getDeviceIcon = () => {
    if (deviceInfo.isMobile) return Smartphone;
    if (deviceInfo.isTablet) return Tablet;
    return Monitor;
  };

  const DeviceIcon = getDeviceIcon();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DeviceIcon className="h-5 w-5" />
            <span>Responsive Mindmap Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Device Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Device Type</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant={deviceInfo.isMobile ? "default" : "secondary"}>
                  Mobile
                </Badge>
                <Badge variant={deviceInfo.isTablet ? "default" : "secondary"}>
                  Tablet
                </Badge>
                <Badge variant={deviceInfo.isDesktop ? "default" : "secondary"}>
                  Desktop
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Capabilities</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant={deviceInfo.isTouch ? "default" : "secondary"}>
                  Touch
                </Badge>
                <Badge variant={deviceInfo.isLowPowered ? "destructive" : "default"}>
                  {deviceInfo.isLowPowered ? "Low Power" : "High Performance"}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Screen Info</h4>
              <div className="text-sm text-muted-foreground">
                <div>{deviceInfo.screenWidth} × {deviceInfo.screenHeight}</div>
                <div>Orientation: {deviceInfo.orientation}</div>
                <div>Pixel Ratio: {deviceInfo.pixelRatio}x</div>
              </div>
            </div>
          </div>

          {/* Responsive Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Mindmap Dimensions</h4>
              <div className="text-sm text-muted-foreground">
                <div>Width: {responsiveConfig.dimensions.width}px</div>
                <div>Height: {responsiveConfig.dimensions.height}px</div>
                <div>Link Distance: {responsiveConfig.linkDistance}px</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Performance Settings</h4>
              <div className="text-sm text-muted-foreground">
                <div>Max Nodes: {responsiveConfig.performance.maxNodes}</div>
                <div>Render Throttle: {responsiveConfig.performance.renderThrottle}ms</div>
                <div className="flex items-center space-x-1">
                  {responsiveConfig.performance.enableAnimations ? (
                    <Zap className="h-3 w-3 text-green-500" />
                  ) : (
                    <ZapOff className="h-3 w-3 text-red-500" />
                  )}
                  <span>Animations: {responsiveConfig.performance.enableAnimations ? 'On' : 'Off'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interaction Settings */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Interaction Settings</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <Badge variant={responsiveConfig.interactions.enableZoom ? "default" : "secondary"}>
                Zoom: {responsiveConfig.interactions.enableZoom ? 'On' : 'Off'}
              </Badge>
              <Badge variant={responsiveConfig.interactions.enablePan ? "default" : "secondary"}>
                Pan: {responsiveConfig.interactions.enablePan ? 'On' : 'Off'}
              </Badge>
              <Badge variant={responsiveConfig.interactions.enableHover ? "default" : "secondary"}>
                Hover: {responsiveConfig.interactions.enableHover ? 'On' : 'Off'}
              </Badge>
              <Badge variant={responsiveConfig.interactions.doubleTapZoom ? "default" : "secondary"}>
                Double Tap: {responsiveConfig.interactions.doubleTapZoom ? 'On' : 'Off'}
              </Badge>
            </div>
          </div>

          {/* Utility Functions */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Utility Functions</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Optimal Node Count: {getOptimalNodeCount()}</div>
              <div>Should Reduce Animations: {shouldReduceAnimations() ? 'Yes' : 'No'}</div>
              <div>Should Enable Touch: {shouldEnableTouch() ? 'Yes' : 'No'}</div>
              <div>Is Mobile Breakpoint: {isResponsiveBreakpoint('mobile') ? 'Yes' : 'No'}</div>
              <div>Is Tablet Breakpoint: {isResponsiveBreakpoint('tablet') ? 'Yes' : 'No'}</div>
              <div>Is Desktop Breakpoint: {isResponsiveBreakpoint('desktop') ? 'Yes' : 'No'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demo Container */}
      <Card>
        <CardHeader>
          <CardTitle>Responsive Container</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={containerRef}
            className={cn(
              "border-2 border-dashed border-muted-foreground/20 rounded-lg p-4 min-h-[300px]",
              "flex items-center justify-center text-muted-foreground"
            )}
            style={{
              width: responsiveConfig.dimensions.width,
              height: responsiveConfig.dimensions.height,
            }}
          >
            <div className="text-center space-y-2">
              <DeviceIcon className="h-12 w-12 mx-auto" />
              <div className="font-semibold">
                {deviceInfo.isMobile ? 'Mobile' : deviceInfo.isTablet ? 'Tablet' : 'Desktop'} Layout
              </div>
              <div className="text-sm">
                {responsiveConfig.dimensions.width} × {responsiveConfig.dimensions.height}
              </div>
              {deviceInfo.isTouch && (
                <div className="text-xs">
                  Touch interactions enabled
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResponsiveMindmapDemo;