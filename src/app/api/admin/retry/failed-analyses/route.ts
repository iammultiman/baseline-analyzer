import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { RetryService } from '@/lib/services/retry-service';
import { AnalysisStatus } from '@prisma/client';

// GET /api/admin/retry/failed-analyses - Get failed analyses with retry information
export const GET = withAuth(async (
  request: NextRequest,
  user: { uid: string; email: string }
) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const organizationId = searchParams.get('organizationId') || undefined;

    const whereClause: any = {
      status: AnalysisStatus.FAILED,
    };

    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    const failedAnalyses = await prisma.repositoryAnalysis.findMany({
      where: whereClause,
      select: {
        id: true,
        repositoryUrl: true,
        status: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const analysesWithRetryInfo = failedAnalyses.map(analysis => {
      const retryMetadata = RetryService.getRetryMetadata(analysis.metadata);
      
      return {
        id: analysis.id,
        repositoryUrl: analysis.repositoryUrl,
        status: analysis.status,
        createdAt: analysis.createdAt.toISOString(),
        lastError: retryMetadata.lastError,
        retryCount: retryMetadata.retryCount,
        maxRetries: retryMetadata.maxRetries,
        nextRetryAt: retryMetadata.nextRetryAt?.toISOString(),
        isRetryable: retryMetadata.isRetryable,
      };
    });

    return NextResponse.json({
      analyses: analysesWithRetryInfo,
      total: analysesWithRetryInfo.length,
    });
  } catch (error) {
    console.error('Error fetching failed analyses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch failed analyses' },
      { status: 500 }
    );
  }
});