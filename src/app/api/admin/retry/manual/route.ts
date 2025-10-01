import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { RetryService } from '@/lib/services/retry-service';
import { z } from 'zod';

const manualRetrySchema = z.object({
  analysisIds: z.array(z.string().uuid()).min(1).max(50),
  organizationId: z.string().uuid().optional(),
});

// POST /api/admin/retry/manual - Manually trigger retry for analyses
export const POST = withAuth(async (
  request: NextRequest,
  user: { uid: string; email: string }
) => {
  try {
    const body = await request.json();
    const { analysisIds, organizationId } = manualRetrySchema.parse(body);

    // For admin users, we might want to allow cross-organization retries
    // For now, we'll use the user's organization or the provided one
    const targetOrganizationId = organizationId || user.uid; // Fallback to user ID

    const result = await RetryService.bulkRetryAnalyses(
      analysisIds,
      user.uid,
      targetOrganizationId
    );

    return NextResponse.json({
      success: true,
      successful: result.successful.length,
      failed: result.failed.length,
      details: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error in manual retry:', error);
    return NextResponse.json(
      { error: 'Failed to retry analyses' },
      { status: 500 }
    );
  }
});