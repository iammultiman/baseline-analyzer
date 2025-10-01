import { RetryService } from './retry-service';
import { AIAnalysisEngine } from './ai-analysis-engine';
import { prisma } from '@/lib/database';
import { AnalysisStatus } from '@prisma/client';

export class RetryProcessor {
  private static isProcessing = false;
  private static processingInterval: NodeJS.Timeout | null = null;

  /**
   * Start the retry processor
   */
  static start(intervalMs: number = 60000) { // Default: 1 minute
    if (this.processingInterval) {
      console.log('Retry processor already running');
      return;
    }

    console.log('Starting retry processor...');
    this.processingInterval = setInterval(() => {
      this.processRetries().catch(error => {
        console.error('Error in retry processor:', error);
      });
    }, intervalMs);

    // Process immediately on start
    this.processRetries().catch(error => {
      console.error('Error in initial retry processing:', error);
    });
  }

  /**
   * Stop the retry processor
   */
  static stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('Retry processor stopped');
    }
  }

  /**
   * Process pending retries
   */
  static async processRetries(): Promise<void> {
    if (this.isProcessing) {
      console.log('Retry processing already in progress, skipping...');
      return;
    }

    try {
      this.isProcessing = true;
      
      // Get analyses ready for retry
      const analysisIds = await RetryService.getAnalysesReadyForRetry(10); // Process 10 at a time
      
      if (analysisIds.length === 0) {
        return;
      }

      console.log(`Processing ${analysisIds.length} analyses for retry`);

      // Process each analysis
      for (const analysisId of analysisIds) {
        try {
          await this.processAnalysisRetry(analysisId);
        } catch (error) {
          console.error(`Error processing retry for analysis ${analysisId}:`, error);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process retry for a single analysis
   */
  private static async processAnalysisRetry(analysisId: string): Promise<void> {
    try {
      // Get analysis details
      const analysis = await prisma.repositoryAnalysis.findUnique({
        where: { id: analysisId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              creditBalance: true,
            },
          },
        },
      });

      if (!analysis) {
        console.error(`Analysis ${analysisId} not found`);
        return;
      }

      // Mark as processing
      await prisma.repositoryAnalysis.update({
        where: { id: analysisId },
        data: { status: AnalysisStatus.PROCESSING },
      });

      console.log(`Retrying analysis ${analysisId} for repository ${analysis.repositoryUrl}`);

      // Simulate repository processing and analysis
      // In a real implementation, you would:
      // 1. Re-fetch the repository content
      // 2. Re-run the AI analysis
      // 3. Update the results

      // For this implementation, we'll simulate the process
      await this.simulateAnalysisRetry(analysis);

    } catch (error) {
      console.error(`Error in analysis retry ${analysisId}:`, error);
      
      // Schedule another retry if possible
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during retry';
      await RetryService.scheduleRetry(analysisId, errorMessage);
    }
  }

  /**
   * Simulate analysis retry (replace with actual analysis logic)
   */
  private static async simulateAnalysisRetry(analysis: any): Promise<void> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate random success/failure for demo purposes
    const shouldSucceed = Math.random() > 0.3; // 70% success rate

    if (shouldSucceed) {
      // Mark as completed with mock results
      await prisma.repositoryAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: AnalysisStatus.COMPLETED,
          results: {
            complianceScore: Math.floor(Math.random() * 40) + 60, // 60-100
            recommendations: [
              {
                category: 'Performance',
                title: 'Optimize bundle size',
                description: 'Consider code splitting to reduce initial bundle size',
                priority: 'medium',
              },
            ],
            baselineMatches: [],
            issues: [],
            retrySuccess: true,
            retriedAt: new Date().toISOString(),
          },
          metadata: {
            ...analysis.metadata,
            completedAt: new Date().toISOString(),
            retrySuccess: true,
          },
        },
      });

      console.log(`Analysis ${analysis.id} completed successfully on retry`);
    } else {
      // Simulate failure and schedule retry
      const errorMessage = 'TEMPORARY_FAILURE: Simulated retry failure';
      await RetryService.scheduleRetry(analysis.id, errorMessage);
      
      console.log(`Analysis ${analysis.id} failed on retry, scheduled for next attempt`);
    }
  }

  /**
   * Get processor status
   */
  static getStatus(): {
    isRunning: boolean;
    isProcessing: boolean;
    intervalMs: number | null;
  } {
    return {
      isRunning: this.processingInterval !== null,
      isProcessing: this.isProcessing,
      intervalMs: this.processingInterval ? 60000 : null, // We don't store the actual interval
    };
  }

  /**
   * Process a specific analysis immediately (for manual triggers)
   */
  static async processAnalysisImmediately(analysisId: string): Promise<void> {
    try {
      await this.processAnalysisRetry(analysisId);
    } catch (error) {
      console.error(`Error processing immediate retry for ${analysisId}:`, error);
      throw error;
    }
  }
}

// Auto-start the processor in production
if (process.env.NODE_ENV === 'production') {
  RetryProcessor.start();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  RetryProcessor.stop();
});

process.on('SIGINT', () => {
  RetryProcessor.stop();
});