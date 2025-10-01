import { NextRequest, NextResponse } from 'next/server';
import { CICDAnalysisService } from '@/lib/services/cicd-analysis-service';
import { API_PERMISSIONS } from '@/lib/types/cicd';
import { withApiKeyAuth } from '@/lib/middleware/api-key-auth';

export const GET = withApiKeyAuth(
  async (context, request: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const analysis = await CICDAnalysisService.getAnalysisStatus(
        context.organizationId,
        params.id
      );
      
      if (!analysis) {
        return NextResponse.json(
          { error: 'Analysis not found' },
          { status: 404 }
        );
      }

      const url = new URL(request.url);
      const failOnCritical = url.searchParams.get('fail_on_critical') === 'true';
      const failOnWarning = url.searchParams.get('fail_on_warning') === 'true';
      const minScore = parseFloat(url.searchParams.get('min_score') || '0');

      // If analysis is not completed, return current status
      if (analysis.status !== 'completed') {
        return NextResponse.json({
          id: analysis.id,
          status: analysis.status,
          repositoryUrl: analysis.repositoryUrl,
          branch: analysis.branch,
          commitSha: analysis.commitSha,
          createdAt: analysis.createdAt,
          exitCode: analysis.status === 'failed' ? 1 : 0,
        });
      }

      // Get full result for completed analysis
      const result = await CICDAnalysisService.getAnalysisResult(
        context.organizationId,
        params.id
      );

      if (!result) {
        return NextResponse.json(
          { error: 'Analysis result not found' },
          { status: 404 }
        );
      }

      // Determine exit code based on quality thresholds
      let exitCode = 0;
      let failureReason: string | undefined;

      if (failOnCritical && result.summary.criticalIssues > 0) {
        exitCode = 1;
        failureReason = `Analysis failed: ${result.summary.criticalIssues} critical issues found`;
      } else if (failOnWarning && result.summary.warningIssues > 0) {
        exitCode = 1;
        failureReason = `Analysis failed: ${result.summary.warningIssues} warning issues found`;
      } else if (minScore > 0 && result.summary.complianceScore < minScore) {
        exitCode = 1;
        failureReason = `Analysis failed: Compliance score ${result.summary.complianceScore} is below minimum ${minScore}`;
      }

      const response = {
        id: analysis.id,
        status: analysis.status,
        repositoryUrl: analysis.repositoryUrl,
        branch: analysis.branch,
        commitSha: analysis.commitSha,
        createdAt: analysis.createdAt,
        completedAt: result.completedAt,
        creditsCost: result.creditsCost,
        exitCode,
        failureReason,
        summary: result.summary,
        qualityGate: {
          passed: exitCode === 0,
          failOnCritical,
          failOnWarning,
          minScore,
          actualScore: result.summary.complianceScore,
        },
      };

      // Return appropriate HTTP status based on exit code
      const httpStatus = exitCode === 0 ? 200 : 422; // 422 for quality gate failures
      
      return NextResponse.json(response, { status: httpStatus });
    } catch (error) {
      console.error('Error checking analysis status:', error);
      return NextResponse.json(
        { 
          error: 'Failed to check analysis status',
          exitCode: 1,
        },
        { status: 500 }
      );
    }
  },
  [API_PERMISSIONS.ANALYSIS_READ]
);