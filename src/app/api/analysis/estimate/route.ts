import { NextRequest, NextResponse } from 'next/server';
import { AIAnalysisEngine } from '@/lib/services/ai-analysis-engine';
import { RepositoryProcessor } from '@/lib/services/repository-processor';
import { authMiddleware } from '@/lib/auth-middleware';

/**
 * POST /api/analysis/estimate
 * Get cost estimate for repository analysis
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

    const body = await request.json();
    const { repositoryUrl } = body;

    if (!repositoryUrl) {
      return NextResponse.json(
        { error: 'Repository URL is required' },
        { status: 400 }
      );
    }

    // Validate repository URL
    const validation = await RepositoryProcessor.validateRepository(repositoryUrl);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // For estimation, we'll use the repository info to make a rough estimate
    const repoInfo = validation.repositoryInfo!;
    
    // Create estimated metadata based on repository info
    const estimatedMetadata = {
      repositoryUrl: repoInfo.url,
      repositoryName: repoInfo.name,
      fileCount: repoInfo.fileCount || 50, // Default estimate
      totalSize: repoInfo.size ? repoInfo.size * 1024 : 1024 * 1024, // Convert KB to bytes or default to 1MB
      processingTime: 0,
      extractedAt: new Date()
    };

    const estimatedCost = AIAnalysisEngine.estimateAnalysisCost(estimatedMetadata);

    return NextResponse.json({
      success: true,
      estimate: {
        creditsCost: estimatedCost,
        repositoryInfo: repoInfo,
        estimatedMetadata: {
          fileCount: estimatedMetadata.fileCount,
          totalSize: estimatedMetadata.totalSize,
          repositoryName: estimatedMetadata.repositoryName
        }
      }
    });

  } catch (error) {
    console.error('Analysis estimate API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to estimate analysis cost',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}