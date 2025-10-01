import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { authMiddleware } from '@/lib/auth-middleware';
import { tenantMiddleware } from '@/lib/tenant-middleware';
import { RetryService } from '@/lib/services/retry-service';
import { z } from 'zod';

// Bulk operation schema
const bulkOperationSchema = z.object({
  action: z.enum(['delete', 'cancel', 'retry']),
  analysisIds: z.array(z.string().uuid()).min(1).max(50)
});

/**
 * POST /api/analysis/bulk
 * Perform bulk operations on analyses
 */
export async function POST(request: NextRequest) {
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

    // Validate request body
    const body = await request.json();
    const validationResult = bulkOperationSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { action, analysisIds } = validationResult.data;

    // Verify all analyses belong to the user
    const analyses = await prisma.repositoryAnalysis.findMany({
      where: {
        id: { in: analysisIds },
        userId: authResult.user!.id,
        organizationId: tenantResult.organizationId!
      },
      select: {
        id: true,
        status: true,
        repositoryUrl: true
      }
    });

    if (analyses.length !== analysisIds.length) {
      return NextResponse.json(
        { error: 'Some analyses not found or access denied' },
        { status: 404 }
      );
    }

    const results = {
      successful: [] as string[],
      failed: [] as { id: string; error: string }[]
    };

    // Perform bulk operation
    switch (action) {
      case 'delete':
        for (const analysis of analyses) {
          try {
            if (analysis.status === 'PROCESSING') {
              results.failed.push({
                id: analysis.id,
                error: 'Cannot delete processing analysis'
              });
              continue;
            }

            await prisma.repositoryAnalysis.delete({
              where: { id: analysis.id }
            });

            results.successful.push(analysis.id);
          } catch (error) {
            results.failed.push({
              id: analysis.id,
              error: error instanceof Error ? error.message : 'Delete failed'
            });
          }
        }
        break;

      case 'cancel':
        for (const analysis of analyses) {
          try {
            if (analysis.status !== 'PENDING' && analysis.status !== 'PROCESSING') {
              results.failed.push({
                id: analysis.id,
                error: 'Cannot cancel analysis that is not pending or processing'
              });
              continue;
            }

            await prisma.repositoryAnalysis.update({
              where: { id: analysis.id },
              data: {
                status: 'FAILED',
                metadata: {
                  cancelledAt: new Date().toISOString(),
                  cancelledBy: authResult.user!.id,
                  error: 'Analysis cancelled by user'
                }
              }
            });

            results.successful.push(analysis.id);
          } catch (error) {
            results.failed.push({
              id: analysis.id,
              error: error instanceof Error ? error.message : 'Cancel failed'
            });
          }
        }
        break;

      case 'retry':
        const retryResults = await RetryService.bulkRetryAnalyses(
          analysisIds,
          authResult.user!.id,
          tenantResult.organizationId!
        );
        
        results.successful = retryResults.successful;
        results.failed = retryResults.failed;
        break;
    }

    return NextResponse.json({
      success: true,
      action,
      results: {
        total: analysisIds.length,
        successful: results.successful.length,
        failed: results.failed.length,
        details: results
      }
    });

  } catch (error) {
    console.error('Bulk operation error:', error);
    return NextResponse.json(
      { 
        error: 'Bulk operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}