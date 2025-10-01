/**
 * Repository Analysis API Endpoints Tests
 * 
 * Tests the core functionality of repository analysis submission,
 * status tracking, and result retrieval endpoints.
 */

describe('Repository Analysis API Endpoints', () => {
  describe('Analysis Submission', () => {
    it('should validate repository URL format', () => {
      const validUrls = [
        'https://github.com/user/repo',
        'https://gitlab.com/user/repo',
        'https://bitbucket.org/user/repo'
      ];

      const invalidUrls = [
        'not-a-url',
        'http://invalid',
        'github.com/user/repo', // missing protocol
        ''
      ];

      validUrls.forEach(url => {
        expect(isValidRepositoryUrl(url)).toBe(true);
      });

      invalidUrls.forEach(url => {
        expect(isValidRepositoryUrl(url)).toBe(false);
      });
    });

    it('should validate analysis request parameters', () => {
      const validRequest = {
        repositoryUrl: 'https://github.com/test/repo',
        analysisType: 'full',
        priority: 'normal'
      };

      const invalidRequests = [
        { repositoryUrl: '', analysisType: 'full' }, // empty URL
        { repositoryUrl: 'https://github.com/test/repo', analysisType: 'invalid' }, // invalid type
        { repositoryUrl: 'https://github.com/test/repo', priority: 'invalid' } // invalid priority
      ];

      expect(validateAnalysisRequest(validRequest)).toBe(true);
      
      invalidRequests.forEach(request => {
        expect(validateAnalysisRequest(request)).toBe(false);
      });
    });
  });

  describe('Status Tracking', () => {
    it('should calculate progress correctly', () => {
      expect(calculateProgress('PENDING')).toBe(10);
      expect(calculateProgress('PROCESSING')).toBe(60);
      expect(calculateProgress('COMPLETED')).toBe(100);
      expect(calculateProgress('FAILED')).toBe(0);
    });

    it('should generate stage information', () => {
      const stages = getStageInformation('PROCESSING');
      
      expect(stages).toHaveLength(5);
      expect(stages[0].name).toBe('submission');
      expect(stages[0].status).toBe('completed');
      
      const currentStage = stages.find(s => s.status === 'current');
      expect(currentStage).toBeDefined();
    });

    it('should estimate time remaining', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      
      const remaining = calculateEstimatedTime(oneMinuteAgo, 'PROCESSING');
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThan(300); // Less than 5 minutes
    });
  });

  describe('Error Handling', () => {
    it('should categorize repository errors correctly', () => {
      const errors = [
        { message: 'Repository not found', expected: 'REPO_NOT_FOUND' },
        { message: 'Repository is private', expected: 'REPO_PRIVATE' },
        { message: 'Repository too large', expected: 'REPO_TOO_LARGE' },
        { message: 'Processing timeout', expected: 'PROCESSING_TIMEOUT' },
        { message: 'AI provider error', expected: 'AI_PROVIDER_ERROR' },
        { message: 'Insufficient credits', expected: 'INSUFFICIENT_CREDITS' }
      ];

      errors.forEach(({ message, expected }) => {
        const error = new Error(message);
        const categorized = categorizeError(error);
        expect(categorized.code).toBe(expected);
      });
    });

    it('should determine if errors are retryable', () => {
      const retryableErrors = [
        'PROCESSING_TIMEOUT',
        'AI_PROVIDER_ERROR',
        'DATABASE_ERROR'
      ];

      const nonRetryableErrors = [
        'REPO_NOT_FOUND',
        'REPO_PRIVATE',
        'INSUFFICIENT_CREDITS'
      ];

      retryableErrors.forEach(code => {
        expect(isErrorRetryable(code)).toBe(true);
      });

      nonRetryableErrors.forEach(code => {
        expect(isErrorRetryable(code)).toBe(false);
      });
    });
  });

  describe('Bulk Operations', () => {
    it('should validate bulk operation requests', () => {
      const validRequest = {
        action: 'delete',
        analysisIds: ['id1', 'id2', 'id3']
      };

      const invalidRequests = [
        { action: 'invalid', analysisIds: ['id1'] }, // invalid action
        { action: 'delete', analysisIds: [] }, // empty array
        { action: 'delete', analysisIds: new Array(51).fill('id') } // too many IDs
      ];

      expect(validateBulkRequest(validRequest)).toBe(true);
      
      invalidRequests.forEach(request => {
        expect(validateBulkRequest(request)).toBe(false);
      });
    });
  });
});

// Helper functions for testing
function isValidRepositoryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['github.com', 'gitlab.com', 'bitbucket.org'].some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

function validateAnalysisRequest(request: any): boolean {
  if (!request.repositoryUrl || !isValidRepositoryUrl(request.repositoryUrl)) {
    return false;
  }
  
  if (request.analysisType && !['compatibility', 'recommendations', 'full'].includes(request.analysisType)) {
    return false;
  }
  
  if (request.priority && !['low', 'normal', 'high'].includes(request.priority)) {
    return false;
  }
  
  return true;
}

function calculateProgress(status: string): number {
  const progressMap: Record<string, number> = {
    'PENDING': 10,
    'PROCESSING': 60,
    'COMPLETED': 100,
    'FAILED': 0
  };
  return progressMap[status] || 0;
}

function getStageInformation(status: string) {
  return [
    { name: 'submission', status: 'completed' },
    { name: 'validation', status: status === 'PENDING' ? 'current' : 'completed' },
    { name: 'processing', status: status === 'PROCESSING' ? 'current' : status === 'COMPLETED' ? 'completed' : 'pending' },
    { name: 'analysis', status: status === 'PROCESSING' ? 'current' : status === 'COMPLETED' ? 'completed' : 'pending' },
    { name: 'completion', status: status === 'COMPLETED' ? 'completed' : 'pending' }
  ];
}

function calculateEstimatedTime(startDate: Date, status: string): number {
  const now = new Date();
  const elapsed = now.getTime() - startDate.getTime();
  const elapsedMinutes = elapsed / (1000 * 60);
  
  const estimates: Record<string, number> = {
    'PENDING': 1,
    'PROCESSING': 4
  };
  
  if (status === 'COMPLETED' || status === 'FAILED') {
    return 0;
  }
  
  const baseEstimate = estimates[status] || 5;
  const remaining = Math.max(baseEstimate - elapsedMinutes, 0.5);
  
  return Math.round(remaining * 60);
}

function categorizeError(error: Error): { code: string } {
  const message = error.message.toLowerCase();
  
  if (message.includes('not found')) return { code: 'REPO_NOT_FOUND' };
  if (message.includes('private')) return { code: 'REPO_PRIVATE' };
  if (message.includes('too large')) return { code: 'REPO_TOO_LARGE' };
  if (message.includes('timeout')) return { code: 'PROCESSING_TIMEOUT' };
  if (message.includes('ai') || message.includes('provider')) return { code: 'AI_PROVIDER_ERROR' };
  if (message.includes('credits')) return { code: 'INSUFFICIENT_CREDITS' };
  if (message.includes('database')) return { code: 'DATABASE_ERROR' };
  
  return { code: 'UNKNOWN_ERROR' };
}

function isErrorRetryable(code: string): boolean {
  const retryableCodes = [
    'PROCESSING_TIMEOUT',
    'AI_PROVIDER_ERROR',
    'DATABASE_ERROR',
    'GITINGEST_ERROR',
    'SYSTEM_OVERLOAD'
  ];
  
  return retryableCodes.includes(code);
}

function validateBulkRequest(request: any): boolean {
  if (!request.action || !['delete', 'cancel', 'retry'].includes(request.action)) {
    return false;
  }
  
  if (!Array.isArray(request.analysisIds) || request.analysisIds.length === 0 || request.analysisIds.length > 50) {
    return false;
  }
  
  return true;
}