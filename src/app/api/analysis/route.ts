import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { AIAnalysisEngine, AnalysisEngineRequest } from '@/lib/services/ai-analysis-engine';
import { RepositoryProcessor } from '@/lib/services/repository-processor';
import { authMiddleware } from '@/lib/auth-middleware';
import { tenantMiddleware } from '@/lib/tenant-middleware';
import { prisma } from '@/lib/database';
import { z } from 'zod';

// Request validation schema
const submitAnalysisSchema = z.object({
  repositoryUrl: z
    .string({ required_error: 'Repository URL is required' })
    .url('Invalid repository URL'),
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
      const errorMessages = validationResult.error.errors.map(err => err.message);
      return NextResponse.json(
        {
          error: errorMessages[0] || 'Invalid request data',
          details: errorMessages,
        },
        { status: 400 }
      );
    }

    const { repositoryUrl, analysisType, priority } = validationResult.data;

    // Validate repository URL and accessibility
    const repositoryValidation = await RepositoryProcessor.validateRepository(repositoryUrl);
    if (!repositoryValidation.isValid) {
      return NextResponse.json(
        {
          error:
            typeof repositoryValidation.error === 'string'
              ? repositoryValidation.error
              : 'Repository validation failed',
          details: repositoryValidation.error,
        },
        { status: 400 }
      );
    }

    const userId = authResult.user!.id;
    const organizationId = tenantResult.organizationId!;

    // Check if analysis already exists for this repository
    const existingAnalysis = await prisma.repositoryAnalysis.findFirst({
      where: {
        repositoryUrl,
        userId,
        organizationId,
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

  const analysisId = randomUUID();
    const submittedAt = new Date().toISOString();
    const baseMetadata = {
      analysisType,
      priority,
      submittedAt,
      repositoryInfo: repositoryValidation.repositoryInfo,
    };

    // Create analysis record in database
    await prisma.repositoryAnalysis.create({
      data: {
        id: analysisId,
        userId,
        organizationId,
        repositoryUrl,
        repositoryName: repositoryValidation.repositoryInfo?.name || 'Unknown Repository',
        status: 'PROCESSING',
        metadata: baseMetadata,
      }
    });

    const processingJobId = await RepositoryProcessor.processRepository(
      repositoryUrl,
      userId,
      organizationId
    );

    let jobStatus = RepositoryProcessor.getJobStatus(processingJobId);
    let attempts = 0;
    const maxAttempts = 60;

    while (jobStatus && jobStatus.status === 'processing' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      jobStatus = RepositoryProcessor.getJobStatus(processingJobId);
      attempts++;
    }

    if (!jobStatus || jobStatus.status !== 'completed' || !jobStatus.result) {
      await prisma.repositoryAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'FAILED',
          metadata: {
            ...baseMetadata,
            error: jobStatus?.error || 'Processing failed',
            failedAt: new Date().toISOString(),
            processingJobId,
          },
        },
      });

      return NextResponse.json(
        { error: jobStatus?.error || 'Processing failed' },
        { status: 500 }
      );
    }

    const analysisRequest: AnalysisEngineRequest = {
      repositoryContent: jobStatus.result,
      userId,
      organizationId,
      analysisType,
    };

    const analysisValidation = AIAnalysisEngine.validateAnalysisRequest(analysisRequest);
    if (!analysisValidation.valid) {
      await prisma.repositoryAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'FAILED',
          metadata: {
            ...baseMetadata,
            validationErrors: analysisValidation.errors,
            failedAt: new Date().toISOString(),
            processingJobId,
          },
        },
      });

      return NextResponse.json(
        {
          error: 'Invalid analysis request',
          details: analysisValidation.errors,
        },
        { status: 400 }
      );
    }

    let analysisResult;

    try {
      analysisResult = await AIAnalysisEngine.analyzeRepository(analysisRequest);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const detail = message.replace(/^Analysis failed:\s*/i, '');

      await prisma.repositoryAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'FAILED',
          metadata: {
            ...baseMetadata,
            error: detail,
            failedAt: new Date().toISOString(),
            processingJobId,
          },
        },
      });

      return NextResponse.json(
        {
          error: 'Analysis failed',
          details: detail,
        },
        { status: 500 }
      );
    }

    await prisma.repositoryAnalysis.update({
      where: { id: analysisId },
      data: {
        status: 'COMPLETED',
        creditsCost: analysisResult.creditsCost,
        results: analysisResult as any,
        metadata: {
          ...baseMetadata,
          ...analysisResult.repositoryMetadata,
          analysisType,
          priority,
          completedAt: new Date().toISOString(),
          processingJobId,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        analysis: analysisResult,
        processingJobId,
        analysisId,
      },
      { status: 200 }
    );

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
