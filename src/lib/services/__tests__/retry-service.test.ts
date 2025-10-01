import { RetryService, RetryConfig } from '../retry-service';

// Mock Prisma
jest.mock('@/lib/database', () => ({
  prisma: {
    repositoryAnalysis: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('RetryService', () => {
  const mockPrisma = require('@/lib/database').prisma;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateRetryDelay', () => {
    const config: RetryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableErrors: ['NETWORK_ERROR'],
    };

    it('should calculate exponential backoff delay', () => {
      const delay1 = RetryService.calculateRetryDelay(1, config);
      const delay2 = RetryService.calculateRetryDelay(2, config);
      const delay3 = RetryService.calculateRetryDelay(3, config);

      // First attempt should be around base delay (1000ms)
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThanOrEqual(1100); // With jitter

      // Second attempt should be around 2x base delay
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThanOrEqual(2200);

      // Third attempt should be around 4x base delay
      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThanOrEqual(4400);
    });

    it('should respect maximum delay', () => {
      const delay = RetryService.calculateRetryDelay(10, config);
      expect(delay).toBeLessThanOrEqual(config.maxDelayMs);
    });
  });

  describe('isRetryableError', () => {
    const config: RetryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'RATE_LIMIT_ERROR'],
    };

    it('should identify retryable errors', () => {
      expect(RetryService.isRetryableError('NETWORK_ERROR occurred', config)).toBe(true);
      expect(RetryService.isRetryableError('Connection timeout - TIMEOUT_ERROR', config)).toBe(true);
      expect(RetryService.isRetryableError('Rate limit exceeded', config)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(RetryService.isRetryableError('INVALID_API_KEY', config)).toBe(false);
      expect(RetryService.isRetryableError('PERMISSION_DENIED', config)).toBe(false);
      expect(RetryService.isRetryableError('MALFORMED_REQUEST', config)).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(RetryService.isRetryableError('network_error occurred', config)).toBe(true);
      expect(RetryService.isRetryableError('Network Error', config)).toBe(true);
    });
  });

  describe('getRetryMetadata', () => {
    it('should return default metadata for empty input', () => {
      const metadata = RetryService.getRetryMetadata({});
      
      expect(metadata).toEqual({
        retryCount: 0,
        maxRetries: 3,
        nextRetryAt: undefined,
        attempts: [],
        lastError: undefined,
        isRetryable: true,
      });
    });

    it('should parse existing retry metadata', () => {
      const input = {
        retry: {
          retryCount: 2,
          maxRetries: 5,
          nextRetryAt: '2024-01-15T10:00:00.000Z',
          attempts: [
            { attemptNumber: 1, timestamp: '2024-01-15T09:00:00.000Z', error: 'NETWORK_ERROR' },
          ],
          lastError: 'NETWORK_ERROR',
          isRetryable: true,
        },
      };

      const metadata = RetryService.getRetryMetadata(input);
      
      expect(metadata.retryCount).toBe(2);
      expect(metadata.maxRetries).toBe(5);
      expect(metadata.nextRetryAt).toEqual(new Date('2024-01-15T10:00:00.000Z'));
      expect(metadata.attempts).toHaveLength(1);
      expect(metadata.lastError).toBe('NETWORK_ERROR');
      expect(metadata.isRetryable).toBe(true);
    });
  });

  describe('updateRetryMetadata', () => {
    it('should update metadata for retryable error', () => {
      const currentMetadata = {};
      const error = 'NETWORK_ERROR: Connection failed';
      
      const updated = RetryService.updateRetryMetadata(currentMetadata, error);
      
      expect(updated.retry.retryCount).toBe(1);
      expect(updated.retry.lastError).toBe(error);
      expect(updated.retry.isRetryable).toBe(true);
      expect(updated.retry.nextRetryAt).toBeDefined();
      expect(updated.retry.attempts).toHaveLength(1);
    });

    it('should update metadata for non-retryable error', () => {
      const currentMetadata = {};
      const error = 'INVALID_API_KEY: Authentication failed';
      
      const updated = RetryService.updateRetryMetadata(currentMetadata, error);
      
      expect(updated.retry.retryCount).toBe(1);
      expect(updated.retry.lastError).toBe(error);
      expect(updated.retry.isRetryable).toBe(false);
      expect(updated.retry.nextRetryAt).toBeUndefined();
    });

    it('should mark as non-retryable when max retries exceeded', () => {
      const currentMetadata = {
        retry: {
          retryCount: 2,
          maxRetries: 3,
          attempts: [],
        },
      };
      const error = 'NETWORK_ERROR: Connection failed';
      
      const updated = RetryService.updateRetryMetadata(currentMetadata, error);
      
      expect(updated.retry.retryCount).toBe(3);
      expect(updated.retry.isRetryable).toBe(false);
      expect(updated.retry.nextRetryAt).toBeUndefined();
    });
  });

  describe('scheduleRetry', () => {
    it('should schedule retry for retryable error', async () => {
      const mockAnalysis = {
        metadata: {},
        status: 'FAILED',
      };

      mockPrisma.repositoryAnalysis.findUnique.mockResolvedValueOnce(mockAnalysis);
      mockPrisma.repositoryAnalysis.update.mockResolvedValueOnce({});

      const result = await RetryService.scheduleRetry('analysis-123', 'NETWORK_ERROR');

      expect(result.scheduled).toBe(true);
      expect(result.nextRetryAt).toBeDefined();
      expect(result.retryCount).toBe(1);
      
      expect(mockPrisma.repositoryAnalysis.update).toHaveBeenCalledWith({
        where: { id: 'analysis-123' },
        data: {
          status: 'PENDING',
          metadata: expect.objectContaining({
            retry: expect.objectContaining({
              retryCount: 1,
              isRetryable: true,
            }),
          }),
        },
      });
    });

    it('should not schedule retry when max retries exceeded', async () => {
      const mockAnalysis = {
        metadata: {
          retry: {
            retryCount: 3,
            maxRetries: 3,
            attempts: [],
          },
        },
        status: 'FAILED',
      };

      mockPrisma.repositoryAnalysis.findUnique.mockResolvedValueOnce(mockAnalysis);
      mockPrisma.repositoryAnalysis.update.mockResolvedValueOnce({});

      const result = await RetryService.scheduleRetry('analysis-123', 'NETWORK_ERROR');

      expect(result.scheduled).toBe(false);
      expect(result.retryCount).toBe(4);
      
      expect(mockPrisma.repositoryAnalysis.update).toHaveBeenCalledWith({
        where: { id: 'analysis-123' },
        data: {
          status: 'FAILED',
          metadata: expect.objectContaining({
            retry: expect.objectContaining({
              retryCount: 4,
              isRetryable: false,
            }),
          }),
        },
      });
    });

    it('should not schedule retry for non-retryable error', async () => {
      const mockAnalysis = {
        metadata: {},
        status: 'FAILED',
      };

      mockPrisma.repositoryAnalysis.findUnique.mockResolvedValueOnce(mockAnalysis);
      mockPrisma.repositoryAnalysis.update.mockResolvedValueOnce({});

      const result = await RetryService.scheduleRetry('analysis-123', 'INVALID_API_KEY');

      expect(result.scheduled).toBe(false);
      expect(result.retryCount).toBe(1);
    });

    it('should throw error when analysis not found', async () => {
      mockPrisma.repositoryAnalysis.findUnique.mockResolvedValueOnce(null);

      await expect(
        RetryService.scheduleRetry('analysis-123', 'NETWORK_ERROR')
      ).rejects.toThrow('Failed to schedule retry');
    });
  });

  describe('getAnalysesReadyForRetry', () => {
    it('should return analyses ready for retry', async () => {
      const mockAnalyses = [
        { id: 'analysis-1' },
        { id: 'analysis-2' },
      ];

      mockPrisma.repositoryAnalysis.findMany.mockResolvedValueOnce(mockAnalyses);

      const result = await RetryService.getAnalysesReadyForRetry(10);

      expect(result).toEqual(['analysis-1', 'analysis-2']);
      expect(mockPrisma.repositoryAnalysis.findMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          metadata: {
            path: ['retry', 'nextRetryAt'],
            lte: expect.any(String),
          },
        },
        select: { id: true },
        take: 10,
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.repositoryAnalysis.findMany.mockRejectedValueOnce(new Error('DB Error'));

      const result = await RetryService.getAnalysesReadyForRetry();

      expect(result).toEqual([]);
    });
  });

  describe('bulkRetryAnalyses', () => {
    it('should retry multiple analyses successfully', async () => {
      const mockAnalyses = [
        { id: 'analysis-1', status: 'FAILED', metadata: {} },
        { id: 'analysis-2', status: 'FAILED', metadata: {} },
      ];

      mockPrisma.repositoryAnalysis.findUnique
        .mockResolvedValueOnce(mockAnalyses[0])
        .mockResolvedValueOnce(mockAnalyses[1]);
      
      mockPrisma.repositoryAnalysis.update
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await RetryService.bulkRetryAnalyses(
        ['analysis-1', 'analysis-2'],
        'user-123',
        'org-456'
      );

      expect(result.successful).toEqual(['analysis-1', 'analysis-2']);
      expect(result.failed).toEqual([]);
    });

    it('should handle mixed success and failure', async () => {
      mockPrisma.repositoryAnalysis.findUnique
        .mockResolvedValueOnce({ id: 'analysis-1', status: 'FAILED', metadata: {} })
        .mockResolvedValueOnce(null); // Analysis not found

      mockPrisma.repositoryAnalysis.update.mockResolvedValueOnce({});

      const result = await RetryService.bulkRetryAnalyses(
        ['analysis-1', 'analysis-2'],
        'user-123',
        'org-456'
      );

      expect(result.successful).toEqual(['analysis-1']);
      expect(result.failed).toEqual([
        { id: 'analysis-2', error: 'Analysis not found or access denied' },
      ]);
    });
  });
});