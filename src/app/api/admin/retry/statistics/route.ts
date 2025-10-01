import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { RetryService } from '@/lib/services/retry-service';

// GET /api/admin/retry/statistics - Get retry statistics
export const GET = withAuth(async (
  request: NextRequest,
  user: { uid: string; email: string }
) => {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    const organizationId = searchParams.get('organizationId') || undefined;

    const statistics = await RetryService.getRetryStatistics(organizationId, days);

    return NextResponse.json(statistics);
  } catch (error) {
    console.error('Error fetching retry statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch retry statistics' },
      { status: 500 }
    );
  }
});