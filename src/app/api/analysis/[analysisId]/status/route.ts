import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { authMiddleware } from '@/lib/auth-middleware';
import { tenantMiddleware } from '@/lib/tenant-middleware';
import { RepositoryProcessor } from '@/lib/services/repository-processor';

/**
 * GET /api/analysis/[analysisId]/status
 * Get detailed status and progress information for an analysis
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { analysisId: string } }
) {
  try {
    // Apply authentication middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Apply tenant middleware
    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json(
        { error: tenantResult.error },
        { status: tenantResult.status }
      );
    }

    const { analysisId } = params;

    if (!analysisId) {
      return NextResponse.json(
        { error: 'Analysis ID is required' },
        { status: 400 }
      );
    }

    // Find the analysis in the database
    const analysis = await prisma.repositoryAnalysis.findFirst({
      where: {
        id: analysisId,
        userId: authResult.user!.id,
        organizationId: tenantResult.organizationId!
      },
      select: {
        id: true,
        repositoryUrl: true,
        repositoryName: true,
        analysisDate: true,
        status: true,
        metadata: true
      }
    });

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Build detailed status response
    const statusResponse = {
      analysisId: analysis.id,
      repositoryUrl: analysis.repositoryUrl,
      repositoryName: analysis.repositoryName,
      status: analysis.status,
      submittedAt: analysis.analysisDate,
      progress: calculateProgress(analysis.status),
      stages: getStageInformation(analysis.status),
      estimatedTimeRemaining: calculateEstimatedTime(analysis.analysisDate, analysis.status),
      metadata: analysis.metadata
    };

    // Add repository processing details if available
    if (analysis.metadata) {
      const metadata = analysis.metadata as any;
      if (metadata.processingJobId) {
        const jobStatus = RepositoryProcessor.getJobStatus(metadata.processingJobId);
        if (jobStatus) {
          const queueStatus = RepositoryProcessor.getQueueStatus(metadata.processingJobId);
          statusResponse.repositoryProcessing = {
            jobId: metadata.processingJobId,
            status: jobStatus.status,
            createdAt: jobStatus.createdAt,
            updatedAt: jobStatus.updatedAt,
            error: jobStatus.error,
            queue: queueStatus
          };
        }
      }
    }

    // Add error details if failed
    if (analysis.status === 'FAILED' && analysis.metadata) {
      const metadata = analysis.metadata as any;
      statusResponse.error = {
        message: metadata.error || 'Analysis failed',
        failedAt: metadata.failedAt,
        stage: metadata.failedStage || 'unknown'
      };
    }

    // Add completion details if completed
    if (analysis.status === 'COMPLETED' && analysis.metadata) {
      const metadata = analysis.metadata as any;
      statusResponse.completion = {
        completedAt: metadata.completedAt,
        duration: calculateDuration(analysis.analysisDate, metadata.completedAt),
        creditsCost: analysis.creditsCost
      };
    }

    return NextResponse.json({
      success: true,
      status: statusResponse
    });

  } catch (error) {
    console.error('Get analysis status API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve analysis status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate overall progress percentage based on status
 */
function calculateProgress(status: string): number {
  const progressMap = {
    'PENDING': 10,
    'PROCESSING': 60,
    'COMPLETED': 100,
    'FAILED': 0
  };

  return progressMap[status as keyof typeof progressMap] || 0;
}

/**
 * Get detailed stage information
 */
function getStageInformation(status: string) {
  const stages = [
    {
      name: 'submission',
      title: 'Analysis Submitted',
      description: 'Analysis request has been submitted and queued',
      status: 'completed'
    },
    {
      name: 'validation',
      title: 'Repository Validation',
      description: 'Validating repository accessibility and format',
      status: status === 'PENDING' ? 'current' : 'completed'
    },
    {
      name: 'processing',
      title: 'Repository Processing',
      description: 'Extracting and processing repository content',
      status: status === 'PROCESSING' ? 'current' : 
             status === 'COMPLETED' ? 'completed' : 'pending'
    },
    {
      name: 'analysis',
      title: 'AI Analysis',
      description: 'Analyzing code against baseline standards',
      status: status === 'PROCESSING' ? 'current' : 
             status === 'COMPLETED' ? 'completed' : 'pending'
    },
    {
      name: 'completion',
      title: 'Results Ready',
      description: 'Analysis complete and results available',
      status: status === 'COMPLETED' ? 'completed' : 'pending'
    }
  ];

  // Mark failed stages
  if (status === 'FAILED') {
    const currentStageIndex = stages.findIndex(stage => stage.status === 'current');
    if (currentStageIndex >= 0) {
      stages[currentStageIndex].status = 'failed';
    }
  }

  return stages;
}

/**
 * Calculate estimated time remaining for analysis
 */
function calculateEstimatedTime(startDate: Date, status: string): number {
  const now = new Date();
  const elapsed = now.getTime() - startDate.getTime();
  const elapsedMinutes = elapsed / (1000 * 60);

  // Base estimates in minutes
  const estimates = {
    'PENDING': 1,
    'PROCESSING': 4
  };

  if (status === 'COMPLETED' || status === 'FAILED') {
    return 0;
  }

  const baseEstimate = estimates[status as keyof typeof estimates] || 5;
  const remaining = Math.max(baseEstimate - elapsedMinutes, 0.5);
  
  return Math.round(remaining * 60); // Return in seconds
}

/**
 * Calculate duration between two dates
 */
function calculateDuration(startDate: Date, endDateString?: string): number {
  if (!endDateString) return 0;
  
  const start = new Date(startDate);
  const end = new Date(endDateString);
  return Math.round((end.getTime() - start.getTime()) / 1000); // Duration in seconds
}