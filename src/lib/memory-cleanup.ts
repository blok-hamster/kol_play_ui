/**
 * Memory Cleanup Utility - Manage memory usage and prevent memory leaks
 */

export interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  percentage: number;
}

export interface CleanupTask {
  id: string;
  name: string;
  cleanup: () => void;
  priority: 'high' | 'medium' | 'low';
  lastRun?: number;
}

class MemoryCleanupManager {
  private cleanupTasks: Map<string, CleanupTask> = new Map();
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private memoryThreshold = 0.8; // 80% memory usage threshold
  private cleanupHistory: { timestamp: number; beforeSize: number; afterSize: number }[] = [];

  constructor() {
    this.initializeDefaultCleanupTasks();
  }

  /**
   * Initialize default cleanup tasks
   */
  private initializeDefaultCleanupTasks(): void {
    // Cache cleanup
    this.registerCleanupTask({
      id: 'cache-cleanup',
      name: 'Clear expired cache entries',
      cleanup: () => this.clearExpiredCaches(),
      priority: 'medium'
    });

    // Event listener cleanup
    this.registerCleanupTask({
      id: 'event-listeners',
      name: 'Remove orphaned event listeners',
      cleanup: () => this.cleanupEventListeners(),
      priority: 'high'
    });

    // DOM cleanup
    this.registerCleanupTask({
      id: 'dom-cleanup',
      name: 'Clean up detached DOM nodes',
      cleanup: () => this.cleanupDetachedNodes(),
      priority: 'medium'
    });

    // Performance entries cleanup
    this.registerCleanupTask({
      id: 'performance-cleanup',
      name: 'Clear performance entries',
      cleanup: () => this.clearPerformanceEntries(),
      priority: 'low'
    });

    // WebSocket cleanup
    this.registerCleanupTask({
      id: 'websocket-cleanup',
      name: 'Close inactive WebSocket connections',
      cleanup: () => this.cleanupWebSockets(),
      priority: 'high'
    });
  }

  /**
   * Start memory monitoring
   */
  public startMonitoring(intervalMs: number = 10000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, intervalMs);

    console.log('Memory monitoring started');
  }

  /**
   * Stop memory monitoring
   */
  public stopMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    this.isMonitoring = false;
    console.log('Memory monitoring stopped');
  }

  /**
   * Get current memory statistics
   */
  public getMemoryStats(): MemoryStats | null {
    if (typeof window === 'undefined' || !('performance' in window) || !('memory' in (window.performance as any))) {
      return null;
    }

    const memory = (window.performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
    };
  }

  /**
   * Check memory usage and trigger cleanup if needed
   */
  private checkMemoryUsage(): void {
    const stats = this.getMemoryStats();
    if (!stats) return;

    const memoryPercentage = stats.percentage / 100;
    
    if (memoryPercentage > this.memoryThreshold) {
      console.warn(`High memory usage detected: ${Math.round(stats.percentage)}%`);
      this.performCleanup('automatic');
    }

    // Log memory usage in development
    if (process.env.NODE_ENV === 'development' && memoryPercentage > 0.6) {
      console.log(`Memory usage: ${Math.round(stats.percentage)}% (${this.formatBytes(stats.usedJSHeapSize)})`);
    }
  }

  /**
   * Register a cleanup task
   */
  public registerCleanupTask(task: CleanupTask): void {
    this.cleanupTasks.set(task.id, task);
  }

  /**
   * Unregister a cleanup task
   */
  public unregisterCleanupTask(taskId: string): void {
    this.cleanupTasks.delete(taskId);
  }

  /**
   * Perform memory cleanup
   */
  public performCleanup(trigger: 'manual' | 'automatic' = 'manual'): void {
    const beforeStats = this.getMemoryStats();
    const beforeSize = beforeStats?.usedJSHeapSize || 0;

    console.log(`Starting memory cleanup (${trigger})...`);

    // Sort tasks by priority
    const tasks = Array.from(this.cleanupTasks.values()).sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Execute cleanup tasks
    tasks.forEach(task => {
      try {
        const startTime = performance.now();
        task.cleanup();
        task.lastRun = Date.now();
        const duration = performance.now() - startTime;
        
        if (duration > 10) { // Log slow cleanup tasks
          console.log(`Cleanup task "${task.name}" took ${Math.round(duration)}ms`);
        }
      } catch (error) {
        console.error(`Error in cleanup task "${task.name}":`, error);
      }
    });

    // Force garbage collection if available (Chrome DevTools)
    if (typeof window !== 'undefined' && 'gc' in window) {
      try {
        (window as any).gc();
      } catch (e) {
        // gc() not available
      }
    }

    // Record cleanup results
    const afterStats = this.getMemoryStats();
    const afterSize = afterStats?.usedJSHeapSize || 0;
    
    this.cleanupHistory.push({
      timestamp: Date.now(),
      beforeSize,
      afterSize
    });

    // Keep only last 10 cleanup records
    if (this.cleanupHistory.length > 10) {
      this.cleanupHistory.shift();
    }

    const savedBytes = beforeSize - afterSize;
    if (savedBytes > 0) {
      console.log(`Memory cleanup completed. Freed: ${this.formatBytes(savedBytes)}`);
    } else {
      console.log('Memory cleanup completed. No significant memory freed.');
    }
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCaches(): void {
    // Clear sessionStorage entries older than 1 hour
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('cache_')) {
          try {
            const item = JSON.parse(sessionStorage.getItem(key) || '{}');
            if (item.timestamp && now - item.timestamp > oneHour) {
              sessionStorage.removeItem(key);
            }
          } catch (e) {
            // Invalid JSON, remove it
            sessionStorage.removeItem(key);
          }
        }
      }
    }

    // Clear localStorage entries older than 24 hours
    if (typeof window !== 'undefined' && window.localStorage) {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('temp_')) {
          try {
            const item = JSON.parse(localStorage.getItem(key) || '{}');
            if (item.timestamp && now - item.timestamp > oneDay) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            // Invalid JSON, remove it
            localStorage.removeItem(key);
          }
        }
      }
    }
  }

  /**
   * Clean up orphaned event listeners
   */
  private cleanupEventListeners(): void {
    // This is a placeholder - in a real implementation, you'd track
    // event listeners and remove ones attached to removed DOM elements
    
    // Remove listeners from detached elements
    if (typeof window !== 'undefined') {
      // Clear any global event listeners that might be orphaned
      const events = ['resize', 'scroll', 'beforeunload'];
      events.forEach(eventType => {
        // This would require tracking listeners - simplified for demo
        console.log(`Checking for orphaned ${eventType} listeners`);
      });
    }
  }

  /**
   * Clean up detached DOM nodes
   */
  private cleanupDetachedNodes(): void {
    // This is a simplified cleanup - in practice, you'd need more sophisticated detection
    if (typeof window !== 'undefined' && window.document) {
      // Remove any elements marked for cleanup
      const elementsToClean = document.querySelectorAll('[data-cleanup="true"]');
      elementsToClean.forEach(element => {
        element.remove();
      });
    }
  }

  /**
   * Clear performance entries
   */
  private clearPerformanceEntries(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      try {
        // Clear old performance entries
        performance.clearMarks();
        performance.clearMeasures();
        
        // Clear resource entries older than 5 minutes
        const entries = performance.getEntriesByType('resource');
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        
        entries.forEach(entry => {
          if (entry.startTime < fiveMinutesAgo) {
            // Note: Can't selectively clear resource entries, but we can track this
            console.log(`Old resource entry: ${entry.name}`);
          }
        });
      } catch (error) {
        console.warn('Error clearing performance entries:', error);
      }
    }
  }

  /**
   * Clean up inactive WebSocket connections
   */
  private cleanupWebSockets(): void {
    // This would require tracking WebSocket instances
    // For now, just log that we're checking
    console.log('Checking for inactive WebSocket connections');
  }

  /**
   * Set memory threshold for automatic cleanup
   */
  public setMemoryThreshold(threshold: number): void {
    if (threshold > 0 && threshold <= 1) {
      this.memoryThreshold = threshold;
    }
  }

  /**
   * Get cleanup history
   */
  public getCleanupHistory(): typeof this.cleanupHistory {
    return [...this.cleanupHistory];
  }

  /**
   * Get registered cleanup tasks
   */
  public getCleanupTasks(): CleanupTask[] {
    return Array.from(this.cleanupTasks.values());
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleanup all resources when shutting down
   */
  public destroy(): void {
    this.stopMonitoring();
    this.cleanupTasks.clear();
    this.cleanupHistory.length = 0;
  }
}

// Singleton instance
export const memoryCleanup = new MemoryCleanupManager();

// Auto-start monitoring in browser environment
if (typeof window !== 'undefined') {
  // Start monitoring after a short delay to allow app initialization
  setTimeout(() => {
    memoryCleanup.startMonitoring();
  }, 5000);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    memoryCleanup.performCleanup('automatic');
    memoryCleanup.destroy();
  });
}

export default memoryCleanup;