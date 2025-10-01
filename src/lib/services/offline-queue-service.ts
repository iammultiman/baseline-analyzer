/**
 * Offline Queue Service
 * Manages queuing and processing of analysis requests when offline
 */

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'normal' | 'high';
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  failed: number;
  completed: number;
}

class OfflineQueueService {
  private readonly QUEUE_KEY = 'baseline-analyzer-offline-queue';
  private readonly STATS_KEY = 'baseline-analyzer-queue-stats';
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly DEFAULT_MAX_RETRIES = 3;
  
  private processingQueue = new Set<string>();
  private listeners: Array<(stats: QueueStats) => void> = [];

  /**
   * Add a request to the offline queue
   */
  async queueRequest(
    url: string,
    options: RequestInit & { 
      priority?: 'low' | 'normal' | 'high';
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const request: QueuedRequest = {
      id: this.generateId(),
      url,
      method: options.method || 'GET',
      headers: this.extractHeaders(options.headers),
      body: typeof options.body === 'string' ? options.body : undefined,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries || this.DEFAULT_MAX_RETRIES,
      priority: options.priority || 'normal'
    };

    const queue = await this.getQueue();
    
    // Check queue size limit
    if (queue.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest low priority items
      const filtered = queue
        .filter(item => item.priority !== 'low')
        .slice(-(this.MAX_QUEUE_SIZE - 1));
      
      await this.saveQueue([...filtered, request]);
    } else {
      await this.saveQueue([...queue, request]);
    }

    this.updateStats();
    this.notifyListeners();

    return request.id;
  }

  /**
   * Process all queued requests
   */
  async processQueue(): Promise<void> {
    if (!navigator.onLine) {
      console.log('[OfflineQueue] Cannot process queue while offline');
      return;
    }

    const queue = await this.getQueue();
    const pendingRequests = queue
      .filter(req => !this.processingQueue.has(req.id))
      .sort(this.sortByPriority);

    console.log(`[OfflineQueue] Processing ${pendingRequests.length} queued requests`);

    const processPromises = pendingRequests.map(request => 
      this.processRequest(request)
    );

    await Promise.allSettled(processPromises);
    this.notifyListeners();
  }

  /**
   * Get current queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const queue = await this.getQueue();
    
    return {
      total: queue.length,
      pending: queue.filter(req => !this.processingQueue.has(req.id)).length,
      processing: this.processingQueue.size,
      failed: queue.filter(req => req.retryCount >= req.maxRetries).length,
      completed: 0 // Completed requests are removed from queue
    };
  }

  /**
   * Clear all queued requests
   */
  async clearQueue(): Promise<void> {
    await this.saveQueue([]);
    this.processingQueue.clear();
    this.updateStats();
    this.notifyListeners();
  }

  /**
   * Remove a specific request from the queue
   */
  async removeRequest(requestId: string): Promise<boolean> {
    const queue = await this.getQueue();
    const filteredQueue = queue.filter(req => req.id !== requestId);
    
    if (filteredQueue.length !== queue.length) {
      await this.saveQueue(filteredQueue);
      this.processingQueue.delete(requestId);
      this.updateStats();
      this.notifyListeners();
      return true;
    }
    
    return false;
  }

  /**
   * Get all queued requests
   */
  async getQueuedRequests(): Promise<QueuedRequest[]> {
    return this.getQueue();
  }

  /**
   * Subscribe to queue updates
   */
  subscribe(listener: (stats: QueueStats) => void): () => void {
    this.listeners.push(listener);
    
    // Send initial stats
    this.getStats().then(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Process a single request
   */
  private async processRequest(request: QueuedRequest): Promise<void> {
    this.processingQueue.add(request.id);
    
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });

      if (response.ok) {
        // Request successful, remove from queue
        await this.removeRequest(request.id);
        console.log(`[OfflineQueue] Successfully processed request: ${request.url}`);
        
        // Notify about successful processing
        this.notifyRequestProcessed(request);
      } else {
        // Request failed, increment retry count
        await this.incrementRetryCount(request.id);
        console.log(`[OfflineQueue] Request failed (${response.status}): ${request.url}`);
      }
    } catch (error) {
      // Network error, increment retry count
      await this.incrementRetryCount(request.id);
      console.log(`[OfflineQueue] Network error for request: ${request.url}`, error);
    } finally {
      this.processingQueue.delete(request.id);
    }
  }

  /**
   * Increment retry count for a request
   */
  private async incrementRetryCount(requestId: string): Promise<void> {
    const queue = await this.getQueue();
    const updatedQueue = queue.map(req => {
      if (req.id === requestId) {
        return { ...req, retryCount: req.retryCount + 1 };
      }
      return req;
    });
    
    await this.saveQueue(updatedQueue);
  }

  /**
   * Get queue from storage
   */
  private async getQueue(): Promise<QueuedRequest[]> {
    try {
      const stored = localStorage.getItem(this.QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[OfflineQueue] Failed to load queue:', error);
      return [];
    }
  }

  /**
   * Save queue to storage
   */
  private async saveQueue(queue: QueuedRequest[]): Promise<void> {
    try {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('[OfflineQueue] Failed to save queue:', error);
    }
  }

  /**
   * Sort requests by priority and timestamp
   */
  private sortByPriority(a: QueuedRequest, b: QueuedRequest): number {
    const priorityOrder = { high: 3, normal: 2, low: 1 };
    
    // First sort by priority
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then by timestamp (older first)
    return a.timestamp - b.timestamp;
  }

  /**
   * Generate unique ID for requests
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract headers from various formats
   */
  private extractHeaders(headers?: HeadersInit): Record<string, string> {
    if (!headers) return {};
    
    if (headers instanceof Headers) {
      const result: Record<string, string> = {};
      headers.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }
    
    if (Array.isArray(headers)) {
      const result: Record<string, string> = {};
      headers.forEach(([key, value]) => {
        result[key] = value;
      });
      return result;
    }
    
    return headers as Record<string, string>;
  }

  /**
   * Update queue statistics
   */
  private async updateStats(): Promise<void> {
    const stats = await this.getStats();
    localStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
  }

  /**
   * Notify all listeners about queue changes
   */
  private async notifyListeners(): Promise<void> {
    const stats = await this.getStats();
    this.listeners.forEach(listener => {
      try {
        listener(stats);
      } catch (error) {
        console.error('[OfflineQueue] Error in listener:', error);
      }
    });
  }

  /**
   * Notify about successful request processing
   */
  private notifyRequestProcessed(request: QueuedRequest): void {
    // Send message to service worker if available
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'ANALYSIS_PROCESSED',
        data: {
          url: request.url,
          timestamp: request.timestamp,
          id: request.id
        }
      });
    }

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('offline-request-processed', {
      detail: request
    }));
  }
}

// Export singleton instance
export const offlineQueueService = new OfflineQueueService();

// Auto-process queue when coming online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    offlineQueueService.processQueue();
  });
}