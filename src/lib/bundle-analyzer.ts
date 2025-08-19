/**
 * Bundle Analyzer - Analyze and optimize bundle size and lazy loading
 */

export interface BundleAnalysis {
  totalSize: number;
  mainBundleSize: number;
  lazyChunksSize: number;
  unusedCode: string[];
  optimizationOpportunities: OptimizationOpportunity[];
  loadingPerformance: LoadingPerformance;
}

export interface OptimizationOpportunity {
  type: 'lazy-loading' | 'code-splitting' | 'tree-shaking' | 'compression';
  description: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
  implementation: string;
}

export interface LoadingPerformance {
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
}

class BundleAnalyzer {
  private resourceEntries: PerformanceResourceTiming[] = [];
  private chunkMap: Map<string, { size: number; loadTime: number; isLazy: boolean }> = new Map();

  constructor() {
    this.initializeAnalysis();
  }

  /**
   * Initialize bundle analysis
   */
  private initializeAnalysis(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      this.updateResourceEntries();
      
      // Update resource entries periodically
      setInterval(() => {
        this.updateResourceEntries();
      }, 5000);
    }
  }

  /**
   * Update resource entries from Performance API
   */
  private updateResourceEntries(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      this.resourceEntries = entries.filter(entry => 
        entry.name.includes('.js') || entry.name.includes('.css')
      );
      
      this.analyzeChunks();
    }
  }

  /**
   * Analyze JavaScript chunks
   */
  private analyzeChunks(): void {
    this.chunkMap.clear();
    
    this.resourceEntries.forEach(entry => {
      if (entry.name.includes('.js')) {
        const isLazy = !entry.name.includes('main') && 
                      !entry.name.includes('runtime') &&
                      entry.name.includes('chunk');
        
        const chunkName = this.extractChunkName(entry.name);
        const size = entry.transferSize || entry.encodedBodySize || 0;
        const loadTime = entry.responseEnd - entry.requestStart;
        
        this.chunkMap.set(chunkName, {
          size,
          loadTime,
          isLazy
        });
      }
    });
  }

  /**
   * Extract chunk name from URL
   */
  private extractChunkName(url: string): string {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.split('.')[0] || 'unknown';
  }

  /**
   * Analyze bundle and provide optimization recommendations
   */
  public analyzeBundleOptimization(): BundleAnalysis {
    const totalSize = Array.from(this.chunkMap.values())
      .reduce((sum, chunk) => sum + chunk.size, 0);
    
    const mainBundleSize = Array.from(this.chunkMap.entries())
      .filter(([name, chunk]) => !chunk.isLazy)
      .reduce((sum, [, chunk]) => sum + chunk.size, 0);
    
    const lazyChunksSize = Array.from(this.chunkMap.values())
      .filter(chunk => chunk.isLazy)
      .reduce((sum, chunk) => sum + chunk.size, 0);

    const optimizationOpportunities = this.identifyOptimizationOpportunities();
    const loadingPerformance = this.analyzeLoadingPerformance();
    const unusedCode = this.detectUnusedCode();

    return {
      totalSize,
      mainBundleSize,
      lazyChunksSize,
      unusedCode,
      optimizationOpportunities,
      loadingPerformance
    };
  }

  /**
   * Identify optimization opportunities
   */
  private identifyOptimizationOpportunities(): OptimizationOpportunity[] {
    const opportunities: OptimizationOpportunity[] = [];
    
    // Check for large main bundle
    const mainBundleSize = Array.from(this.chunkMap.entries())
      .filter(([name, chunk]) => !chunk.isLazy)
      .reduce((sum, [, chunk]) => sum + chunk.size, 0);
    
    if (mainBundleSize > 500 * 1024) { // 500KB threshold
      opportunities.push({
        type: 'code-splitting',
        description: 'Main bundle is large. Consider splitting into smaller chunks.',
        potentialSavings: mainBundleSize * 0.3, // Estimate 30% savings
        priority: 'high',
        implementation: 'Use dynamic imports for route-based code splitting'
      });
    }

    // Check for missing lazy loading
    const totalChunks = this.chunkMap.size;
    const lazyChunks = Array.from(this.chunkMap.values()).filter(chunk => chunk.isLazy).length;
    
    if (lazyChunks / totalChunks < 0.5) {
      opportunities.push({
        type: 'lazy-loading',
        description: 'Low percentage of lazy-loaded chunks detected.',
        potentialSavings: mainBundleSize * 0.4,
        priority: 'medium',
        implementation: 'Implement React.lazy() for component-based code splitting'
      });
    }

    // Check for slow loading chunks
    const slowChunks = Array.from(this.chunkMap.entries())
      .filter(([, chunk]) => chunk.loadTime > 1000);
    
    if (slowChunks.length > 0) {
      opportunities.push({
        type: 'compression',
        description: `${slowChunks.length} chunks are loading slowly.`,
        potentialSavings: slowChunks.reduce((sum, [, chunk]) => sum + chunk.size * 0.7, 0),
        priority: 'medium',
        implementation: 'Enable gzip/brotli compression and optimize chunk sizes'
      });
    }

    // Check for tree-shaking opportunities
    if (this.hasTreeShakingOpportunities()) {
      opportunities.push({
        type: 'tree-shaking',
        description: 'Potential unused code detected in bundles.',
        potentialSavings: mainBundleSize * 0.2,
        priority: 'low',
        implementation: 'Review imports and enable tree-shaking in build configuration'
      });
    }

    return opportunities.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Analyze loading performance metrics
   */
  private analyzeLoadingPerformance(): LoadingPerformance {
    const defaultMetrics: LoadingPerformance = {
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      firstInputDelay: 0,
      timeToInteractive: 0
    };

    if (typeof window === 'undefined' || !('performance' in window)) {
      return defaultMetrics;
    }

    try {
      // Get paint metrics
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      
      return {
        firstContentfulPaint: fcpEntry?.startTime || 0,
        largestContentfulPaint: lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : 0,
        cumulativeLayoutShift: this.getCLS(),
        firstInputDelay: this.getFID(),
        timeToInteractive: this.getTTI()
      };
    } catch (error) {
      console.warn('Error analyzing loading performance:', error);
      return defaultMetrics;
    }
  }

  /**
   * Get Cumulative Layout Shift (CLS)
   */
  private getCLS(): number {
    try {
      const observer = new PerformanceObserver((list) => {
        // This would be implemented with a proper CLS calculation
        // For now, return 0 as placeholder
      });
      return 0; // Placeholder - would need proper CLS implementation
    } catch {
      return 0;
    }
  }

  /**
   * Get First Input Delay (FID)
   */
  private getFID(): number {
    try {
      const eventEntries = performance.getEntriesByType('event');
      if (eventEntries.length > 0) {
        const firstEvent = eventEntries[0] as any;
        return firstEvent.processingStart - firstEvent.startTime;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get Time to Interactive (TTI)
   */
  private getTTI(): number {
    try {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return navEntry ? navEntry.domInteractive - navEntry.navigationStart : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Detect unused code (simplified heuristic)
   */
  private detectUnusedCode(): string[] {
    const unusedCode: string[] = [];
    
    // This is a simplified detection - in a real implementation,
    // you'd use tools like webpack-bundle-analyzer or source-map-explorer
    
    // Check for large chunks that might contain unused code
    Array.from(this.chunkMap.entries()).forEach(([name, chunk]) => {
      if (chunk.size > 100 * 1024 && chunk.loadTime > 2000) {
        unusedCode.push(`Large chunk detected: ${name} (${Math.round(chunk.size / 1024)}KB)`);
      }
    });

    return unusedCode;
  }

  /**
   * Check for tree-shaking opportunities (heuristic)
   */
  private hasTreeShakingOpportunities(): boolean {
    // Simple heuristic: if main bundle is large relative to lazy chunks,
    // there might be tree-shaking opportunities
    const mainSize = Array.from(this.chunkMap.values())
      .filter(chunk => !chunk.isLazy)
      .reduce((sum, chunk) => sum + chunk.size, 0);
    
    const lazySize = Array.from(this.chunkMap.values())
      .filter(chunk => chunk.isLazy)
      .reduce((sum, chunk) => sum + chunk.size, 0);
    
    return mainSize > lazySize * 2; // Main bundle is more than 2x lazy chunks
  }

  /**
   * Get optimization recommendations as text
   */
  public getOptimizationRecommendations(): string[] {
    const analysis = this.analyzeBundleOptimization();
    const recommendations: string[] = [];

    analysis.optimizationOpportunities.forEach(opportunity => {
      const savings = Math.round(opportunity.potentialSavings / 1024);
      recommendations.push(
        `${opportunity.description} Potential savings: ${savings}KB. ${opportunity.implementation}`
      );
    });

    // Add performance-based recommendations
    if (analysis.loadingPerformance.firstContentfulPaint > 1500) {
      recommendations.push('First Contentful Paint is slow. Consider optimizing critical rendering path.');
    }

    if (analysis.loadingPerformance.timeToInteractive > 3000) {
      recommendations.push('Time to Interactive is high. Consider reducing JavaScript execution time.');
    }

    return recommendations;
  }

  /**
   * Get bundle size breakdown
   */
  public getBundleBreakdown(): { name: string; size: number; isLazy: boolean; loadTime: number }[] {
    return Array.from(this.chunkMap.entries()).map(([name, chunk]) => ({
      name,
      size: chunk.size,
      isLazy: chunk.isLazy,
      loadTime: chunk.loadTime
    }));
  }
}

// Singleton instance
export const bundleAnalyzer = new BundleAnalyzer();

export default bundleAnalyzer;