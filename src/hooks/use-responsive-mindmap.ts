import { useState, useEffect, useCallback, useMemo } from 'react';

export interface ResponsiveBreakpoints {
  mobile: number;
  tablet: number;
  desktop: number;
}

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
  isTouch: boolean;
  pixelRatio: number;
  isLowPowered: boolean;
}

export interface ResponsiveMindmapConfig {
  dimensions: {
    width: number;
    height: number;
  };
  nodeRadius: {
    token: { base: number; max: number };
    kol: { base: number; max: number };
  };
  linkDistance: number;
  forces: {
    charge: number;
    collision: number;
    center: number;
    link: number;
  };
  animation: {
    duration: number;
    alphaTarget: number;
    alphaDecay: number;
  };
  performance: {
    maxNodes: number;
    renderThrottle: number;
    enableAnimations: boolean;
    enableParticles: boolean;
  };
  interactions: {
    enableZoom: boolean;
    enablePan: boolean;
    enableHover: boolean;
    touchSensitivity: number;
    doubleTapZoom: boolean;
  };
}

const DEFAULT_BREAKPOINTS: ResponsiveBreakpoints = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200,
};

// Detect if device is likely low-powered based on various factors
const detectLowPoweredDevice = (): boolean => {
  // Check for reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return true;
  }

  // Check hardware concurrency (CPU cores)
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
    return true;
  }

  // Check device memory (if available)
  if ('deviceMemory' in navigator && (navigator as any).deviceMemory <= 2) {
    return true;
  }

  // Check connection type for mobile data
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    if (connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) {
      return true;
    }
  }

  return false;
};

export const useResponsiveMindmap = (
  containerRef: React.RefObject<HTMLElement>,
  breakpoints: ResponsiveBreakpoints = DEFAULT_BREAKPOINTS
) => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        screenWidth: 1200,
        screenHeight: 800,
        orientation: 'landscape',
        isTouch: false,
        pixelRatio: 1,
        isLowPowered: false,
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    
    return {
      isMobile: width < breakpoints.mobile,
      isTablet: width >= breakpoints.mobile && width < breakpoints.tablet,
      isDesktop: width >= breakpoints.tablet,
      screenWidth: width,
      screenHeight: height,
      orientation: width > height ? 'landscape' : 'portrait',
      isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      pixelRatio: window.devicePixelRatio || 1,
      isLowPowered: detectLowPoweredDevice(),
    };
  });

  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  // Update device info on resize and orientation change
  const updateDeviceInfo = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    setDeviceInfo({
      isMobile: width < breakpoints.mobile,
      isTablet: width >= breakpoints.mobile && width < breakpoints.tablet,
      isDesktop: width >= breakpoints.tablet,
      screenWidth: width,
      screenHeight: height,
      orientation: width > height ? 'landscape' : 'portrait',
      isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      pixelRatio: window.devicePixelRatio || 1,
      isLowPowered: detectLowPoweredDevice(),
    });
  }, [breakpoints]);

  // Update container dimensions
  const updateContainerDimensions = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContainerDimensions({
        width: rect.width,
        height: rect.height,
      });
    }
  }, [containerRef]);

  // Set up event listeners
  useEffect(() => {
    updateDeviceInfo();
    updateContainerDimensions();

    const handleResize = () => {
      updateDeviceInfo();
      updateContainerDimensions();
    };

    const handleOrientationChange = () => {
      // Delay to allow for orientation change to complete
      setTimeout(() => {
        updateDeviceInfo();
        updateContainerDimensions();
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    // Use ResizeObserver for container size changes
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(updateContainerDimensions);
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [updateDeviceInfo, updateContainerDimensions, containerRef]);

  // Generate responsive configuration
  const responsiveConfig = useMemo<ResponsiveMindmapConfig>(() => {
    const { isMobile, isTablet, isDesktop, isLowPowered, isTouch, orientation } = deviceInfo;
    const { width: containerWidth, height: containerHeight } = containerDimensions;

    // Calculate optimal dimensions
    let width: number, height: number;
    
    if (isMobile) {
      width = Math.max(320, Math.min(containerWidth || 400, 600));
      height = Math.max(200, Math.min(containerHeight || 300, 400));
      
      // Adjust for orientation
      if (orientation === 'landscape') {
        height = Math.min(height, 300);
      }
    } else if (isTablet) {
      width = Math.max(400, Math.min(containerWidth || 600, 900));
      height = Math.max(300, Math.min(containerHeight || 400, 500));
    } else {
      width = Math.max(600, Math.min(containerWidth || 800, 1200));
      height = Math.max(400, Math.min(containerHeight || 600, 800));
    }

    // Node sizing based on device
    const nodeRadius = isMobile
      ? { token: { base: 12, max: 28 }, kol: { base: 8, max: 20 } }
      : isTablet
      ? { token: { base: 16, max: 40 }, kol: { base: 12, max: 30 } }
      : { token: { base: 20, max: 55 }, kol: { base: 14, max: 40 } };

    // Link distance based on screen size
    const linkDistance = isMobile ? 50 : isTablet ? 80 : 120;

    // Forces optimized for device performance
    const forces = {
      charge: isLowPowered ? (isMobile ? -150 : -250) : (isMobile ? -200 : isTablet ? -300 : -400),
      collision: 0.7,
      center: isMobile ? 0.15 : 0.1,
      link: 0.3,
    };

    // Animation settings based on performance
    const animation = {
      duration: isLowPowered ? 150 : isMobile ? 200 : 300,
      alphaTarget: isLowPowered ? 0.1 : 0.3,
      alphaDecay: isLowPowered ? 0.05 : 0.0228,
    };

    // Performance settings
    const performance = {
      maxNodes: isLowPowered ? (isMobile ? 20 : 30) : (isMobile ? 40 : isTablet ? 60 : 100),
      renderThrottle: isLowPowered ? 200 : isMobile ? 100 : 50,
      enableAnimations: !isLowPowered,
      enableParticles: !isLowPowered && !isMobile,
    };

    // Interaction settings
    const interactions = {
      enableZoom: true,
      enablePan: true,
      enableHover: !isTouch || isTablet || isDesktop, // Disable hover on mobile touch
      touchSensitivity: isTouch ? (isMobile ? 1.5 : 1.2) : 1.0,
      doubleTapZoom: isTouch,
    };

    return {
      dimensions: { width, height },
      nodeRadius,
      linkDistance,
      forces,
      animation,
      performance,
      interactions,
    };
  }, [deviceInfo, containerDimensions]);

  // Touch gesture handlers
  const touchHandlers = useMemo(() => {
    if (!deviceInfo.isTouch) {
      return {};
    }

    let lastTouchDistance = 0;
    let lastTouchCenter = { x: 0, y: 0 };
    let lastTap = 0;

    return {
      onTouchStart: (event: TouchEvent) => {
        if (event.touches.length === 2) {
          // Pinch gesture start
          const touch1 = event.touches[0];
          const touch2 = event.touches[1];
          
          lastTouchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
          );
          
          lastTouchCenter = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2,
          };
        } else if (event.touches.length === 1) {
          // Single touch - check for double tap
          const now = Date.now();
          const timeDiff = now - lastTap;
          
          if (timeDiff < 300 && timeDiff > 0) {
            // Double tap detected
            event.preventDefault();
            return { type: 'doubleTap', point: { x: event.touches[0].clientX, y: event.touches[0].clientY } };
          }
          
          lastTap = now;
        }
        
        return null;
      },

      onTouchMove: (event: TouchEvent) => {
        if (event.touches.length === 2) {
          // Pinch gesture
          const touch1 = event.touches[0];
          const touch2 = event.touches[1];
          
          const currentDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
          );
          
          const currentCenter = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2,
          };
          
          if (lastTouchDistance > 0) {
            const scale = currentDistance / lastTouchDistance;
            const deltaX = currentCenter.x - lastTouchCenter.x;
            const deltaY = currentCenter.y - lastTouchCenter.y;
            
            event.preventDefault();
            return {
              type: 'pinch',
              scale,
              center: currentCenter,
              delta: { x: deltaX, y: deltaY },
            };
          }
          
          lastTouchDistance = currentDistance;
          lastTouchCenter = currentCenter;
        }
        
        return null;
      },

      onTouchEnd: () => {
        lastTouchDistance = 0;
        return null;
      },
    };
  }, [deviceInfo.isTouch]);

  return {
    deviceInfo,
    containerDimensions,
    responsiveConfig,
    touchHandlers,
    
    // Utility functions
    isResponsiveBreakpoint: (breakpoint: keyof ResponsiveBreakpoints) => {
      switch (breakpoint) {
        case 'mobile':
          return deviceInfo.isMobile;
        case 'tablet':
          return deviceInfo.isTablet;
        case 'desktop':
          return deviceInfo.isDesktop;
        default:
          return false;
      }
    },
    
    getOptimalNodeCount: () => responsiveConfig.performance.maxNodes,
    shouldReduceAnimations: () => deviceInfo.isLowPowered || deviceInfo.isMobile,
    shouldEnableTouch: () => deviceInfo.isTouch,
  };
};

export default useResponsiveMindmap;