import { NextRequest, NextResponse } from 'next/server';
import { CreditService } from '@/lib/services/credit-service';
import { authMiddleware } from '@/lib/auth-middleware';
import { tenantMiddleware } from '@/lib/tenant-middleware';

/**
 * GET /api/credits - Get user's credit balance and usage stats
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.user.id ?? (authResult.user as any).uid;

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (!tenantResult.success) {
      return NextResponse.json({ error: tenantResult.error }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const includeStats = searchParams.get('includeStats') === 'true';
    const historyLimit = parseInt(searchParams.get('limit') || '20');
    const historyOffset = parseInt(searchParams.get('offset') || '0');

    const balance = await CreditService.getBalance(userId);
    
    const response: any = { balance };

    if (includeHistory) {
      response.history = await CreditService.getTransactionHistory(
        userId,
        historyLimit,
        historyOffset
      );
    }

    if (includeStats) {
      response.stats = await CreditService.getUsageStats(userId);
      response.usageLimits = await CreditService.checkUsageLimits(userId);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching credit information:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}