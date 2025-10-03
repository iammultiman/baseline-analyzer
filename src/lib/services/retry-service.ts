import { prisma } from '@/lib/database';
import { AnalysisStatus } from '@prisma/client';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: Date;
  error?: string;
  delayMs?: number;
}

export interface RetryMetadata {
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  attempts: RetryAttempt[];
  lastError?: string;
  isRetryable: boolean;
}

export class RetryService {
  private static defaultConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000, // 1 second
    maxDelayMs: 300000, // 5 minutes
    backoffMultiplier: 2,
    retryableErrors: [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'RATE_LIMIT_ERROR',
      'TEMPORARY_FAILURE',
      'AI_PROVIDER_ERROR',
      'REPOSITORY_ACCESS_ERROR',
    ],
  };

  /**
   * Calculate delay for next retry attempt using exponential backoff
   */
  static calculateRetryDelay(attemptNumber: number, config: RetryConfig = this.defaultConfig): number {
    const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    
    return Math.min(delay + jitter, config.maxDelayMs);
  }

  /**
   * Check if an error is retryable
   */
  static isRetryableError(error: string, config: RetryConfig = this.defaultConfig): boolean {
    const normalizedError = error.replace(/[\s_-]+/g, '').toUpperCase();

    return config.retryableErrors.some(retryableError => {
      const normalizedRetryable = retryableError.replace(/[\s_-]+/g, '').toUpperCase();

      if (normalizedError.includes(normalizedRetryable)) {
        return true;
      }

      const softenedRetryable = normalizedRetryable
        .replace(/(ERROR|FAILURE|EXCEPTION)$/u, '')
        .replace(/[^A-Z]/g, '');

      return softenedRetryable.length > 0 && normalizedError.includes(softenedRetryable);
    });
  }

  /**
   * Get retry metadata for an analysis
   */
  static getRetryMetadata(metadata: any): RetryMetadata {
    const retryData = metadata?.retry || {};
    
    return {
      retryCount: retryData.retryCount || 0,
      maxRetries: retryData.maxRetries || this.defaultConfig.maxRetries,
      nextRetryAt: retryData.nextRetryAt ? new Date(retryData.nextRetryAt) : undefined,
      attempts: retryData.attempts || [],
      lastError: retryData.lastError,
      isRetryable: retryData.isRetryable !== false,
    };
  }

  /**
   * Update retry metadata for an analysis
   */
  static updateRetryMetadata(
    currentMetadata: any,
    error: string,
    config: RetryConfig = this.defaultConfig
  ): any {
    const retryMetadata = this.getRetryMetadata(currentMetadata);
    const attemptNumber = retryMetadata.retryCount + 1;
    const isRetryable = this.isRetryableError(error, config);
    const canRetry = isRetryable && attemptNumber < config.maxRetries;

    const newAttempt: RetryAttempt = {
      attemptNumber,
      timestamp: new Date(),
      error,
    };

    let nextRetryAt: Date | undefined;
    if (canRetry) {
      const delayMs = this.calculateRetryDelay(attemptNumber, config);
      nextRetryAt = new Date(Date.now() + delayMs);
      newAttempt.delayMs = delayMs;
    }

    const updatedRetryData = {
      retryCount: attemptNumber,
      maxRetries: config.maxRetries,
      nextRetryAt: nextRetryAt?.toISOString(),
      attempts: [...retryMetadata.attempts, newAttempt],
    lastError: error,
    isRetryable: canRetry,
    };

    return {
      ...currentMetadata,
      retry: updatedRetryData,
    };
  }

  /**
   * Mark analysis for retry
   */
  static async scheduleRetry(
    analysisId: string,
    error: string,
    config: RetryConfig = this.defaultConfig
  ): Promise<{ scheduled: boolean; nextRetryAt?: Date; retryCount: number }> {
    try {
      const analysis = await prisma.repositoryAnalysis.findUnique({
        where: { id: analysisId },
        select: { metadata: true, status: true },
      });

      if (!analysis) {
        throw new Error('Analysis not found');
      }

      const currentMetadata = analysis.metadata || {};
      const retryMetadata = this.getRetryMetadata(currentMetadata);
      
      // Check if we can retry
      const canRetry = retryMetadata.retryCount < config.maxRetries && 
                      this.isRetryableError(error, config);

      if (!canRetry) {
        // Mark as permanently failed
        await prisma.repositoryAnalysis.update({
          where: { id: analysisId },
          data: {
            status: AnalysisStatus.FAILED,
            metadata: this.updateRetryMetadata(currentMetadata, error, config),
          },
        });

        return {
          scheduled: false,
          retryCount: retryMetadata.retryCount + 1,
        };
      }

      // Schedule retry
      const updatedMetadata = this.updateRetryMetadata(currentMetadata, error, config);
      const nextRetryAt = new Date(updatedMetadata.retry.nextRetryAt);

      await prisma.repositoryAnalysis.update({
        where: { id: analysisId },
        data: {
          status: AnalysisStatus.PENDING,
          metadata: updatedMetadata,
        },
      });

      return {
        scheduled: true,
        nextRetryAt,
        retryCount: retryMetadata.retryCount + 1,
      };
    } catch (err) {
      console.error('Error scheduling retry:', err);
      throw new Error('Failed to schedule retry');
    }
  }

  /**
   * Get analyses ready for retry
   */
  static async getAnalysesReadyForRetry(limit: number = 50): Promise<string[]> {
    try {
      const now = new Date();
      
      // Find analyses that are pending and have a nextRetryAt time that has passed
      const analyses = await prisma.repositoryAnalysis.findMany({
        where: {
          status: AnalysisStatus.PENDING,
          metadata: {
            path: ['retry', 'nextRetryAt'],
            lte: now.toISOString(),
          },
        },
        select: { id: true },
        take: limit,
        orderBy: { createdAt: 'asc' },
      });

      return analyses.map(a => a.id);
    } catch (error) {
      console.error('Error getting analyses ready for retry:', error);
      return [];
    }
  }

  /**
   * Bulk retry failed analyses
   */
  static async bulkRetryAnalyses(
    analysisIds: string[],
    userId: string,
    organizationId: string
  ): Promise<{
    successful: string[];
    failed: { id: string; error: string }[];
  }> {
    const results = {
      successful: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    for (const analysisId of analysisIds) {
      try {
        const analysis = await prisma.repositoryAnalysis.findUnique({
          where: {
            id: analysisId,
            userId,
            organizationId,
          },
          select: {
            id: true,
            status: true,
            metadata: true,
          },
        });

        if (!analysis) {
          results.failed.push({
            id: analysisId,
            error: 'Analysis not found or access denied',
          });
          continue;
        }

        if (analysis.status !== AnalysisStatus.FAILED) {
          results.failed.push({
            id: analysisId,
            error: 'Can only retry failed analyses',
          });
          continue;
        }

        const retryMetadata = this.getRetryMetadata(analysis.metadata);
        
        if (!retryMetadata.isRetryable) {
          results.failed.push({
            id: analysisId,
            error: 'Analysis has exceeded maximum retry attempts',
          });
          continue;
        }

        // Reset to pending for immediate retry
        await prisma.repositoryAnalysis.update({
          where: { id: analysisId },
          data: {
            status: AnalysisStatus.PENDING,
            metadata: {
              ...analysis.metadata,
              manualRetryAt: new Date().toISOString(),
              manualRetryBy: userId,
            },
          },
        });

        results.successful.push(analysisId);
      } catch (error) {
        results.failed.push({
          id: analysisId,
          error: error instanceof Error ? error.message : 'Retry failed',
        });
      }
    }

    return results;
  }

  /**
   * Get retry statistics for monitoring
   */
  static async getRetryStatistics(
    organizationId?: string,
    days: number = 7
  ): Promise<{
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    averageRetryCount: number;
    retryReasons: { [key: string]: number };
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const whereClause: any = {
        createdAt: { gte: startDate },
        metadata: {
          path: ['retry'],
          not: null,
        },
      };

      if (organizationId) {
        whereClause.organizationId = organizationId;
      }

      const analyses = await prisma.repositoryAnalysis.findMany({
        where: whereClause,
        select: {
          status: true,
          metadata: true,
        },
      });

      let totalRetries = 0;
      let successfulRetries = 0;
      let failedRetries = 0;
      const retryReasons: { [key: string]: number } = {};

      for (const analysis of analyses) {
        const retryMetadata = this.getRetryMetadata(analysis.metadata);
        
        if (retryMetadata.retryCount > 0) {
          totalRetries += retryMetadata.retryCount;
          
          if (analysis.status === AnalysisStatus.COMPLETED) {
            successfulRetries++;
          } else if (analysis.status === AnalysisStatus.FAILED) {
            failedRetries++;
          }

          // Count retry reasons
          for (const attempt of retryMetadata.attempts) {
            if (attempt.error) {
              const errorType = this.categorizeError(attempt.error);
              retryReasons[errorType] = (retryReasons[errorType] || 0) + 1;
            }
          }
        }
      }

      return {
        totalRetries,
        successfulRetries,
        failedRetries,
        averageRetryCount: analyses.length > 0 ? totalRetries / analyses.length : 0,
        retryReasons,
      };
    } catch (error) {
      console.error('Error getting retry statistics:', error);
      return {
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        averageRetryCount: 0,
        retryReasons: {},
      };
    }
  }

  /**
   * Categorize error for statistics
   */
  private static categorizeError(error: string): string {
    const errorUpper = error.toUpperCase();
    
    if (errorUpper.includes('NETWORK') || errorUpper.includes('CONNECTION')) {
      return 'Network Error';
    }
    if (errorUpper.includes('TIMEOUT')) {
      return 'Timeout Error';
    }
    if (errorUpper.includes('RATE_LIMIT') || errorUpper.includes('RATE LIMIT')) {
      return 'Rate Limit Error';
    }
    if (errorUpper.includes('AI_PROVIDER') || errorUpper.includes('AI PROVIDER')) {
      return 'AI Provider Error';
    }
    if (errorUpper.includes('REPOSITORY') || errorUpper.includes('REPO')) {
      return 'Repository Error';
    }
    if (errorUpper.includes('CREDIT') || errorUpper.includes('INSUFFICIENT')) {
      return 'Credit Error';
    }
    
    return 'Other Error';
  }
}