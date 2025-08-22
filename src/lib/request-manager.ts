/**
 * Global request manager to control authenticated requests during auth sessions
 */

import { AuthRedirectManager } from './auth-redirect';

interface PendingRequest {
  id: string;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  request: () => Promise<any>;
  timestamp: number;
}

class RequestManager {
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private readonly MAX_PENDING_REQUESTS = 50;
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  /**
   * Check if requests should be blocked due to authentication state
   */
  shouldBlockRequest(): boolean {
    return (
      AuthRedirectManager.isModalOpening() ||
      AuthRedirectManager.isAuthenticationInProgress() ||
      AuthRedirectManager.isRedirecting()
    );
  }

  /**
   * Execute a request with authentication state checking
   */
  async executeRequest<T>(requestFn: () => Promise<T>, options: {
    allowDuringAuth?: boolean;
    timeout?: number;
    priority?: 'high' | 'medium' | 'low';
  } = {}): Promise<T> {
    const {
      allowDuringAuth = false,
      timeout = this.REQUEST_TIMEOUT,
      priority = 'medium'
    } = options;

    // Allow non-authenticated requests to proceed
    if (allowDuringAuth || !this.shouldBlockRequest()) {
      return requestFn();
    }

    // Block request and queue it for later execution
    return this.queueRequest(requestFn, timeout, priority);
  }

  /**
   * Queue a request for execution after authentication completes
   */
  private async queueRequest<T>(
    requestFn: () => Promise<T>,
    timeout: number,
    priority: 'high' | 'medium' | 'low'
  ): Promise<T> {
    // Prevent queue overflow
    if (this.pendingRequests.size >= this.MAX_PENDING_REQUESTS) {
      // Remove oldest low priority requests
      this.cleanupOldRequests('low');
      
      if (this.pendingRequests.size >= this.MAX_PENDING_REQUESTS) {
        throw new Error('Request queue full - too many pending requests');
      }
    }

    const requestId = `req_${++this.requestCounter}_${Date.now()}`;
    
    return new Promise<T>((resolve, reject) => {
      const pendingRequest: PendingRequest = {
        id: requestId,
        resolve,
        reject,
        request: requestFn,
        timestamp: Date.now()
      };

      this.pendingRequests.set(requestId, pendingRequest);

      // Set timeout for the request
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout - authentication took too long'));
        }
      }, timeout);

      console.log(`🔄 Request queued: ${requestId} (${this.pendingRequests.size} pending)`);
    });
  }

  /**
   * Execute all pending requests after authentication completes
   */
  async executePendingRequests(): Promise<void> {
    if (this.pendingRequests.size === 0) {
      return;
    }

    console.log(`🚀 Executing ${this.pendingRequests.size} pending requests`);

    const requests = Array.from(this.pendingRequests.values());
    this.pendingRequests.clear();

    // Execute requests in batches to prevent overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      // Execute batch in parallel
      const batchPromises = batch.map(async (pendingRequest) => {
        try {
          const result = await pendingRequest.request();
          pendingRequest.resolve(result);
        } catch (error) {
          pendingRequest.reject(error);
        }
      });

      await Promise.allSettled(batchPromises);

      // Small delay between batches to prevent overwhelming
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Completed executing pending requests`);
  }

  /**
   * Clear all pending requests (e.g., on logout or error)
   */
  clearPendingRequests(reason: string = 'Authentication failed'): void {
    console.log(`🚫 Clearing ${this.pendingRequests.size} pending requests: ${reason}`);
    
    this.pendingRequests.forEach(request => {
      request.reject(new Error(reason));
    });
    
    this.pendingRequests.clear();
  }

  /**
   * Clean up old requests by priority
   */
  private cleanupOldRequests(priority: 'high' | 'medium' | 'low'): void {
    const now = Date.now();
    const maxAge = 15000; // 15 seconds

    for (const [id, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > maxAge) {
        this.pendingRequests.delete(id);
        request.reject(new Error('Request expired'));
      }
    }
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    pendingCount: number;
    isBlocking: boolean;
  } {
    return {
      pendingCount: this.pendingRequests.size,
      isBlocking: this.shouldBlockRequest()
    };
  }
}

// Global singleton instance
export const requestManager = new RequestManager();

/**
 * Wrapper for fetch that respects authentication state
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit & {
    allowDuringAuth?: boolean;
    timeout?: number;
    priority?: 'high' | 'medium' | 'low';
  } = {}
): Promise<Response> {
  const { allowDuringAuth, timeout, priority, ...fetchOptions } = options;

  return requestManager.executeRequest(
    () => fetch(url, fetchOptions),
    { allowDuringAuth, timeout, priority }
  );
}

/**
 * Wrapper for axios requests that respects authentication state
 */
export async function authenticatedRequest<T>(
  requestFn: () => Promise<T>,
  options: {
    allowDuringAuth?: boolean;
    timeout?: number;
    priority?: 'high' | 'medium' | 'low';
  } = {}
): Promise<T> {
  return requestManager.executeRequest(requestFn, options);
}