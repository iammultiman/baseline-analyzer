import { NextRequest, NextResponse } from 'next/server';
import { AIAnalysisEngine, AnalysisEngineRequest } from '@/lib/services/ai-analysis-engine';
import { RepositoryProcessor } from '@/lib/services/repository-processor';
import { authMiddleware } from '@/lib/auth-middleware';
import { tenantMiddleware } from '@/lib/tenant-middleware';
import { prisma } from '@/lib/database';
import { z } from 'zod';

// Request validation schema
const submitAnalysisSchema = z.object({
  repositoryUrl: z.string().url('Invalid repository URL'),
  analysisType: z.enum(['compatibility', 'recommendations', 'full']).default('full'),
  priority: z.enum(['low', 'normal', 'high']).default('normal')
});

/**
 * POST /api/analysis
 * Submit a repository for analysis
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
    const validationResult = submitAnalysisSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { repositoryUrl, analysisType, priority } = validationResult.data;

    // Validate repository URL and accessibility
    const validation = await RepositoryProcessor.validateRepository(repositoryUrl);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Repository validation failed',
          details: validation.error
        },
        { status: 400 }
      );
    }

    // Check if analysis already exists for this repository
    const existingAnalysis = await prisma.repositoryAnalysis.findFirst({
      where: {
        repositoryUrl,
        userId: authResult.user!.id,
        organizationId: tenantResult.organizationId!,
        status: {
          in: ['PENDING', 'PROCESSING']
        }
      }
    });

    if (existingAnalysis) {
      return NextResponse.json(
        {
          error: 'Analysis already in progress for this repository',
          analysisId: existingAnalysis.id,
          status: existingAnalysis.status
        },
        { status: 409 }
      );
    }

    // Create analysis record in database
    const analysis = await prisma.repositoryAnalysis.create({
      data: {
        userId: authResult.user!.id,
        organizationId: tenantResult.organizationId!,
        repositoryUrl,
        repositoryName: validation.repositoryInfo?.name || 'Unknown Repository',
        status: 'PENDING',
        metadata: {
          analysisType,
          priority,
          submittedAt: new Date().toISOString(),
          repositoryInfo: validation.repositoryInfo
        }
      }
    });

    // Start asynchronous processing
    processRepositoryAnalysis(analysis.id, repositoryUrl, analysisType, authResult.user!.id, tenantResult.organizationId!)
      .catch(error => {
        console.error('Background analysis processing failed:', error);
        // Update analysis status to failed
        prisma.repositoryAnalysis.update({
          where: { id: analysis.id },
          data: {
            status: 'FAILED',
            metadata: {
              ...analysis.metadata as any,
              error: error.message,
              failedAt: new Date().toISOString()
            }
          }
        }).catch(console.error);
      });

    return NextResponse.json({
      success: true,
      analysisId: analysis.id,
      status: 'PENDING',
      message: 'Analysis submitted successfully',
      estimatedTime: '2-5 minutes'
    }, { status: 202 });

  } catch (error) {
    const { AnalysisErrorHandler } = await import('@/lib/utils/analysis-error-handler');
    AnalysisErrorHandler.logError(error, 'analysis-submission');
    const analysisError = AnalysisErrorHandler.handleError(error, 'analysis-submission');
    return AnalysisErrorHandler.createErrorResponse(analysisError);
  }
}

/**
 * GET /api/analysis
 * List user's repository analyses
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const status = searchParams.get('status') as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | null;
    const repositoryUrl = searchParams.get('repositoryUrl');

    // Build where clause
    const where: any = {
      userId: authResult.user!.id,
      organizationId: tenantResult.organizationId!
    };

    if (status) {
      where.status = status;
    }

    if (repositoryUrl) {
      where.repositoryUrl = {
        contains: repositoryUrl,
        mode: 'insensitive'
      };
    }

    // Get analyses with pagination
    const [analyses, total] = await Promise.all([
      prisma.repositoryAnalysis.findMany({
        where,
        select: {
          id: true,
          repositoryUrl: true,
          repositoryName: true,
          analysisDate: true,
          status: true,
          creditsCost: true,
          metadata: true
        },
        orderBy: {
          analysisDate: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.repositoryAnalysis.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      analyses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    const { AnalysisErrorHandler } = await import('@/lib/utils/analysis-error-handler');
    AnalysisErrorHandler.logError(error, 'list-analyses');
    const analysisError = AnalysisErrorHandler.handleError(error, 'list-analyses');
    return AnalysisErrorHandler.createErrorResponse(analysisError);
  }
}

/**
 * Background processing function for repository analysis
 */
async function processRepositoryAnalysis(
  analysisId: string,
  repositoryUrl: string,
  analysisType: string,
  userId: string,
  organizationId: string
) {
  try {
    // Update status to processing
    await prisma.repositoryAnalysis.update({
      where: { id: analysisId },
      data: {
        status: 'PROCESSING',
        metadata: {
          processingStartedAt: new Date().toISOString()
        }
      }
    });

    // Process repository
    const jobId = await RepositoryProcessor.processRepository(
      repositoryUrl,
      userId,
      organizationId
    );

    // Wait for processing to complete
    let processingJob = RepositoryProcessor.getJobStatus(jobId);
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max wait

    while (processingJob && processingJob.status === 'processing' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      processingJob = RepositoryProcessor.getJobStatus(jobId);
      attempts++;
    }

    if (!processingJob || processingJob.status !== 'completed') {
      throw new Error(processingJob?.error || 'Repository processing failed or timed out');
    }

    if (!processingJob.result) {
      throw new Error('No processing result available');
    }

    // Perform AI analysis
    const analysisRequest: AnalysisEngineRequest = {
      repositoryContent: processingJob.result,
      userId,
      organizationId,
      analysisType: analysisType as any
    };

    const analysisResult = await AIAnalysisEngine.analyzeRepository(analysisRequest);

    // Update analysis with results
    await prisma.repositoryAnalysis.update({
      where: { id: analysisId },
      data: {
        status: 'COMPLETED',
        creditsCost: analysisResult.creditsCost,
        results: analysisResult as any,
        metadata: {
          ...analysisResult.repositoryMetadata,
          analysisType,
          completedAt: new Date().toISOString(),
          processingJobId: jobId
        }
      }
    });

  } catch (error) {
    const { AnalysisErrorHandler } = await import('@/lib/utils/analysis-error-handler');
    AnalysisErrorHandler.logError(error, 'background-analysis-processing', { analysisId });
    const analysisError = AnalysisErrorHandler.handleError(error, 'background-analysis-processing');
    
    // Update analysis status with detailed error information
    await AnalysisErrorHandler.updateAnalysisWithError(analysisId, analysisError, 'processing');

    throw error;
  }
}