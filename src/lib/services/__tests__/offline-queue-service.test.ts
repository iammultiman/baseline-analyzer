import { offlineQueueService } from '../offline-queue-service';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock fetch
global.fetch = jest.fn();

// Mock navigator
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true
});

describe('OfflineQueueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('queueRequest', () => {
    it('should queue a request successfully', async () => {
      mockLocalStorage.getItem.mockReturnValue('[]');

      const requestId = await offlineQueueService.queueRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        priority: 'high'
      });

      expect(requestId).toBeDefined();
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should handle queue size limit', async () => {
      // Create a full queue with low priority items
      const fullQueue = Array.from({ length: 100 }, (_, i) => ({
        id: `req-${i}`,
        url: `/api/test-${i}`,
        method: 'GET',
        headers: {},
        timestamp: Date.now() - i,
        retryCount: 0,
        maxRetries: 3,
        priority: 'low'
      }));

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(fullQueue));

      const requestId = await offlineQueueService.queueRequest('/api/new', {
        priority: 'high'
      });

      expect(requestId).toBeDefined();
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should assign default values correctly', async () => {
      mockLocalStorage.getItem.mockReturnValue('[]');

      await offlineQueueService.queueRequest('/api/test');

      const setItemCall = mockLocalStorage.setItem.mock.calls[0];
      const queueData = JSON.parse(setItemCall[1]);
      const request = queueData[0];

      expect(request.method).toBe('GET');
      expect(request.priority).toBe('normal');
      expect(request.maxRetries).toBe(3);
      expect(request.retryCount).toBe(0);
    });
  });

  describe('processQueue', () => {
    it('should not process when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await offlineQueueService.processQueue();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[OfflineQueue] Cannot process queue while offline'
      );
      expect(fetch).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should process queued requests when online', async () => {
      // Ensure we're online for this test
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true
      });
      const mockQueue = [
        {
          id: 'req-1',
          url: '/api/test-1',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"test": "data"}',
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'normal'
        }
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueue));
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200
      });

      await offlineQueueService.processQueue();

      expect(fetch).toHaveBeenCalledWith('/api/test-1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"test": "data"}'
      });
    });

    it('should handle failed requests with retry', async () => {
      // Ensure we're online for this test
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true
      });
      const mockQueue = [
        {
          id: 'req-1',
          url: '/api/test-1',
          method: 'GET',
          headers: {},
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'normal'
        }
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueue));
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500
      });

      await offlineQueueService.processQueue();

      expect(fetch).toHaveBeenCalled();
      // Should increment retry count
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should sort requests by priority', async () => {
      // Ensure we're online for this test
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true
      });
      const mockQueue = [
        {
          id: 'req-1',
          url: '/api/low',
          method: 'GET',
          headers: {},
          timestamp: Date.now() - 1000,
          retryCount: 0,
          maxRetries: 3,
          priority: 'low'
        },
        {
          id: 'req-2',
          url: '/api/high',
          method: 'GET',
          headers: {},
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'high'
        }
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueue));
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200
      });

      await offlineQueueService.processQueue();

      // High priority should be processed first
      expect(fetch).toHaveBeenNthCalledWith(1, '/api/high', expect.any(Object));
      expect(fetch).toHaveBeenNthCalledWith(2, '/api/low', expect.any(Object));
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const mockQueue = [
        {
          id: 'req-1',
          url: '/api/test-1',
          method: 'GET',
          headers: {},
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'normal'
        },
        {
          id: 'req-2',
          url: '/api/test-2',
          method: 'GET',
          headers: {},
          timestamp: Date.now(),
          retryCount: 3,
          maxRetries: 3,
          priority: 'normal'
        }
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueue));

      const stats = await offlineQueueService.getStats();

      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.processing).toBe(0);
      expect(stats.failed).toBe(1);
      expect(stats.completed).toBe(0);
    });
  });

  describe('clearQueue', () => {
    it('should clear all queued requests', async () => {
      await offlineQueueService.clearQueue();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'baseline-analyzer-offline-queue',
        '[]'
      );
    });
  });

  describe('removeRequest', () => {
    it('should remove specific request from queue', async () => {
      const mockQueue = [
        {
          id: 'req-1',
          url: '/api/test-1',
          method: 'GET',
          headers: {},
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'normal'
        },
        {
          id: 'req-2',
          url: '/api/test-2',
          method: 'GET',
          headers: {},
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'normal'
        }
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueue));

      const result = await offlineQueueService.removeRequest('req-1');

      expect(result).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();

      const setItemCall = mockLocalStorage.setItem.mock.calls[0];
      const updatedQueue = JSON.parse(setItemCall[1]);
      expect(updatedQueue).toHaveLength(1);
      expect(updatedQueue[0].id).toBe('req-2');
    });

    it('should return false for non-existent request', async () => {
      mockLocalStorage.getItem.mockReturnValue('[]');

      const result = await offlineQueueService.removeRequest('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should notify listeners of queue changes', async () => {
      const listener = jest.fn();
      const unsubscribe = offlineQueueService.subscribe(listener);

      // Should call listener with initial stats
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('getQueuedRequests', () => {
    it('should return all queued requests', async () => {
      const mockQueue = [
        {
          id: 'req-1',
          url: '/api/test-1',
          method: 'GET',
          headers: {},
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'normal'
        }
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueue));

      const requests = await offlineQueueService.getQueuedRequests();

      expect(requests).toEqual(mockQueue);
    });

    it('should handle corrupted localStorage data', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const requests = await offlineQueueService.getQueuedRequests();

      expect(requests).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});