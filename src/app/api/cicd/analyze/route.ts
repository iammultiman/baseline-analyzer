import { NextRequest, NextResponse } from 'next/server';
import { CICDAnalysisService } from '@/lib/services/cicd-analysis-service';
import { CICDAnalysisRequest, API_PERMISSIONS } from '@/lib/types/cicd';
import { ApiKeyAuthContext, withApiKeyAuth } from '@/lib/middleware/api-key-auth';

async function postHandler(context: ApiKeyAuthContext, request: NextRequest) {
  try {
    const body: CICDAnalysisRequest = await request.json();

    if (!body.repositoryUrl) {
      return NextResponse.json(
        { error: 'Repository URL is required' },
        { status: 400 }
      );
    }

    if (!isValidRepositoryUrl(body.repositoryUrl)) {
      return NextResponse.json(
        { error: 'Invalid repository URL format' },
        { status: 400 }
      );
    }

    const result = await CICDAnalysisService.submitAnalysis(
      context.organizationId,
      context.apiKey.createdBy,
      body
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error submitting CI/CD analysis:', error);

    if (error instanceof Error) {
      if (error.message.includes('Insufficient credits')) {
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            code: 'INSUFFICIENT_CREDITS',
            message: error.message,
          },
          { status: 402 }
        );
      }

      if (error.message.includes('Invalid repository')) {
        return NextResponse.json(
          {
            error: 'Invalid repository',
            code: 'INVALID_REPOSITORY',
            message: error.message,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to submit analysis',
        code: 'ANALYSIS_SUBMISSION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function getHandler(context: ApiKeyAuthContext, request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const analyses = await CICDAnalysisService.listAnalyses(
      context.organizationId,
      { status, limit, offset }
    );

    return NextResponse.json({
      analyses,
      pagination: {
        limit,
        offset,
        hasMore: analyses.length === limit,
      },
    });
  } catch (error) {
    console.error('Error listing CI/CD analyses:', error);
    return NextResponse.json(
      { error: 'Failed to list analyses' },
      { status: 500 }
    );
  }
}

export function POST(request: NextRequest, ...args: any[]) {
  const handler = withApiKeyAuth(postHandler, [API_PERMISSIONS.ANALYSIS_WRITE]);
  return handler(request, ...args);
}

export function GET(request: NextRequest, ...args: any[]) {
  const handler = withApiKeyAuth(getHandler, [API_PERMISSIONS.ANALYSIS_READ]);
  return handler(request, ...args);
}

function isValidRepositoryUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // Support GitHub, GitLab, Bitbucket, and other Git hosting services
    const supportedHosts = [
      'github.com',
      'gitlab.com',
      'bitbucket.org',
      'dev.azure.com',
      'git.sr.ht',
    ];
    
    const isSupported = supportedHosts.some(host => 
      urlObj.hostname === host || urlObj.hostname.endsWith(`.${host}`)
    );
    
    if (!isSupported) {
      // Allow any HTTPS Git URL for self-hosted instances
      return urlObj.protocol === 'https:' && urlObj.pathname.includes('/');
    }
    
    return true;
  } catch {
    return false;
  }
}