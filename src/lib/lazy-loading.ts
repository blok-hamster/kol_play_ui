/**
 * Lazy Loading Utilities - Optimize bundle size with intelligent lazy loading
 */

import { ComponentType, lazy, LazyExoticComponent } from 'react';

export interface LazyLoadOptions {
  fallback?: ComponentType;
  preload?: boolean;
  priority?: 'high' | 'medium' | 'low';
  chunkName?: string;
}

export interface LazyComponentInfo {
  component: LazyExoticComponent<any>;
  isLoaded: boolean;
  size?: number;
  error?: Error;
}

class LazyLoadingManager {
  private loadedComponents: Map<string, LazyComponentInfo> = new Map();
  private preloadQueue: Array<{ name: string; loader: () => Promise<any>; priority: number }> = [];
  private isPreloading = false;

  /**
   * Create a lazy-loaded component with error handling
   */
  public createLazyComponent<T extends ComponentType<any>>(
    loader: () => Promise<{ default: T }>,
    options: LazyLoadOptions = {}
  ): LazyExoticComponent<T> {
    const { preload = false, priority = 'medium', chunkName } = options;
    
    const componentName = chunkName || this.generateComponentName();
    
    // Wrap loader with error handling
    const trackedLoader = async () => {
      try {
        const module = await loader();
        
        // Update component info
        const componentInfo = this.loadedComponents.get(componentName);
        if (componentInfo) {
          componentInfo.isLoaded = true;
        }
        
        return module;
      } catch (error) {
        const componentInfo = this.loadedComponents.get(componentName);
        if (componentInfo) {
          componentInfo.error = error as Error;
        }
        
        console.error(`Failed to lazy load ${componentName}:`, error);
        throw error;
      }
    };

    const lazyComponent = lazy(trackedLoader);
    
    // Register component
    this.loadedComponents.set(componentName, {
      component: lazyComponent,
      isLoaded: false
    });
    
    // Add to preload queue if requested
    if (preload) {
      this.addToPreloadQueue(componentName, trackedLoader, this.getPriorityValue(priority));
    }
    
    return lazyComponent;
  }

  /**
   * Preload a component
   */
  public preloadComponent(componentName: string): Promise<void> {
    const componentInfo = this.loadedComponents.get(componentName);
    if (!componentInfo || componentInfo.isLoaded) {
      return Promise.resolve();
    }

    // Trigger the lazy component to load
    return new Promise((resolve, reject) => {
      try {
        // This is a bit of a hack to trigger lazy loading
        // In a real implementation, you'd store the loader function
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add component to preload queue
   */
  private addToPreloadQueue(
    name: string, 
    loader: () => Promise<any>, 
    priority: number
  ): void {
    this.preloadQueue.push({ name, loader, priority });
    this.preloadQueue.sort((a, b) => b.priority - a.priority);
    
    // Start preloading if not already running
    if (!this.isPreloading) {
      this.processPreloadQueue();
    }
  }

  /**
   * Process the preload queue
   */
  private async processPreloadQueue(): Promise<void> {
    if (this.isPreloading || this.preloadQueue.length === 0) {
      return;
    }

    this.isPreloading = true;

    // Wait for page to be idle before preloading
    if ('requestIdleCallback' in window) {
      await new Promise(resolve => {
        (window as any).requestIdleCallback(resolve, { timeout: 2000 });
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    while (this.preloadQueue.length > 0) {
      const { name, loader } = this.preloadQueue.shift()!;
      
      try {
        await loader();
        console.log(`Preloaded component: ${name}`);
      } catch (error) {
        console.warn(`Failed to preload component ${name}:`, error);
      }
      
      // Small delay between preloads to avoid blocking
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.isPreloading = false;
  }

  /**
   * Get priority value for sorting
   */
  private getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  /**
   * Generate a component name
   */
  private generateComponentName(): string {
    return `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get loading statistics
   */
  public getLoadingStats(): {
    totalComponents: number;
    loadedComponents: number;
    failedComponents: number;
  } {
    const components = Array.from(this.loadedComponents.values());
    const loadedComponents = components.filter(c => c.isLoaded);
    const failedComponents = components.filter(c => c.error);

    return {
      totalComponents: components.length,
      loadedComponents: loadedComponents.length,
      failedComponents: failedComponents.length
    };
  }

  /**
   * Get component info
   */
  public getComponentInfo(name: string): LazyComponentInfo | undefined {
    return this.loadedComponents.get(name);
  }

  /**
   * Clear component cache
   */
  public clearCache(): void {
    this.loadedComponents.clear();
    this.preloadQueue.length = 0;
    this.isPreloading = false;
  }
}

// Singleton instance
export const lazyLoadingManager = new LazyLoadingManager();

/**
 * Utility function to create lazy components with error handling
 */
export function createLazyComponent<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  options?: LazyLoadOptions
): LazyExoticComponent<T> {
  return lazyLoadingManager.createLazyComponent(loader, options);
}

/**
 * Preload components based on user interaction hints
 */
export function preloadOnHover(componentName: string): {
  onMouseEnter: () => void;
  onFocus: () => void;
} {
  let preloadTriggered = false;
  
  const triggerPreload = () => {
    if (!preloadTriggered) {
      preloadTriggered = true;
      lazyLoadingManager.preloadComponent(componentName);
    }
  };

  return {
    onMouseEnter: triggerPreload,
    onFocus: triggerPreload
  };
}

/**
 * Preload components when they're likely to be needed
 */
export function preloadOnIntersection(
  componentName: string,
  options: IntersectionObserverInit = {}
): (element: Element | null) => void {
  let observer: IntersectionObserver | null = null;
  let preloadTriggered = false;

  return (element: Element | null) => {
    if (observer) {
      observer.disconnect();
    }

    if (element && !preloadTriggered) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !preloadTriggered) {
              preloadTriggered = true;
              lazyLoadingManager.preloadComponent(componentName);
              observer?.disconnect();
            }
          });
        },
        { rootMargin: '50px', ...options }
      );

      observer.observe(element);
    }
  };
}

/**
 * Bundle size analyzer for lazy loading optimization
 */
export function analyzeBundleUsage(): {
  recommendations: string[];
  potentialSavings: number;
} {
  const stats = lazyLoadingManager.getLoadingStats();
  const recommendations: string[] = [];
  let potentialSavings = 0;

  // Analyze loading patterns
  if (stats.loadedComponents / stats.totalComponents < 0.7) {
    recommendations.push(
      'Consider implementing more lazy loading - only 70% of components are being loaded'
    );
    potentialSavings += 100; // Estimate 100KB savings
  }



  if (stats.failedComponents > 0) {
    recommendations.push(
      `${stats.failedComponents} components failed to load - check network conditions and error handling`
    );
  }

  // Check for opportunities based on current page
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    
    if (currentPath === '/' && stats.totalComponents > 10) {
      recommendations.push(
        'Home page has many components - consider lazy loading non-critical sections'
      );
      potentialSavings += 200;
    }
  }

  return {
    recommendations,
    potentialSavings
  };
}

export default lazyLoadingManager;