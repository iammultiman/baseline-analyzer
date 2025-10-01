import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { authMiddleware } from '@/lib/auth-middleware';
import { tenantMiddleware } from '@/lib/tenant-middleware';
import { RepositoryProcessor } from '@/lib/services/repository-processor';

/**
 * GET /api/analysis/[analysisId]
 * Get analysis results and status by ID
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
        creditsCost: true,
        results: true,
        metadata: true
      }
    });

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Add progress information for processing analyses
    let progressInfo = null;
    if (analysis.status === 'PROCESSING' && analysis.metadata) {
      const metadata = analysis.metadata as any;
      if (metadata.processingJobId) {
        const jobStatus = RepositoryProcessor.getJobStatus(metadata.processingJobId);
        if (jobStatus) {
          const queueStatus = RepositoryProcessor.getQueueStatus(metadata.processingJobId);
          progressInfo = {
            stage: jobStatus.status === 'processing' ? 'repository-processing' : 'ai-analysis',
            repositoryProcessing: {
              status: jobStatus.status,
              progress: jobStatus.status === 'completed' ? 100 : 
                       jobStatus.status === 'processing' ? 50 : 0
            },
            queue: queueStatus,
            estimatedTimeRemaining: calculateEstimatedTime(analysis.analysisDate, analysis.status)
          };
        }
      }
    }

    // Calculate analysis duration for completed analyses
    let duration = null;
    if (analysis.status === 'COMPLETED' && analysis.metadata) {
      const metadata = analysis.metadata as any;
      if (metadata.submittedAt && metadata.completedAt) {
        const start = new Date(metadata.submittedAt);
        const end = new Date(metadata.completedAt);
        duration = Math.round((end.getTime() - start.getTime()) / 1000); // Duration in seconds
      }
    }

    return NextResponse.json({
      success: true,
      analysis: {
        ...analysis,
        progress: progressInfo,
        duration
      }
    });

  } catch (error) {
    console.error('Get analysis API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/analysis/[analysisId]
 * Update analysis (e.g., cancel processing)
 */
export async function PATCH(
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
    const body = await request.json();
    const { action } = body;

    if (!analysisId) {
      return NextResponse.json(
        { error: 'Analysis ID is required' },
        { status: 400 }
      );
    }

    // Find the analysis
    const analysis = await prisma.repositoryAnalysis.findFirst({
      where: {
        id: analysisId,
        userId: authResult.user!.id,
        organizationId: tenantResult.organizationId!
      }
    });

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Handle different actions
    if (action === 'cancel') {
      if (analysis.status !== 'PENDING' && analysis.status !== 'PROCESSING') {
        return NextResponse.json(
          { error: 'Cannot cancel analysis that is not pending or processing' },
          { status: 400 }
        );
      }

      // Cancel the analysis
      await prisma.repositoryAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'FAILED',
          metadata: {
            ...analysis.metadata as any,
            cancelledAt: new Date().toISOString(),
            cancelledBy: authResult.user!.id,
            error: 'Analysis cancelled by user'
          }
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Analysis cancelled successfully'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Update analysis API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/analysis/[analysisId]
 * Delete analysis results
 */
export async function DELETE(
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

    // Check if analysis exists and user has permission
    const analysis = await prisma.repositoryAnalysis.findFirst({
      where: {
        id: analysisId,
        userId: authResult.user!.id,
        organizationId: tenantResult.organizationId!
      }
    });

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Don't allow deletion of processing analyses
    if (analysis.status === 'PROCESSING') {
      return NextResponse.json(
        { error: 'Cannot delete analysis that is currently processing. Cancel it first.' },
        { status: 400 }
      );
    }

    // Delete the analysis
    await prisma.repositoryAnalysis.delete({
      where: { id: analysisId }
    });

    return NextResponse.json({
      success: true,
      message: 'Analysis deleted successfully'
    });

  } catch (error) {
    console.error('Delete analysis API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
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
    PENDING: 2,
    PROCESSING: 3
  };

  const baseEstimate = estimates[status as keyof typeof estimates] || 5;
  const remaining = Math.max(baseEstimate - elapsedMinutes, 0.5);
  
  return Math.round(remaining * 60); // Return in seconds
}