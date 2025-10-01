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
      
      return NextResponse.json(analysis);
    } catch (error) {
      console.error('Error fetching analysis status:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analysis status' },
        { status: 500 }
      );
    }
  },
  [API_PERMISSIONS.ANALYSIS_READ]
);