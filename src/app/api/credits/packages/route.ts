import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { CreditService } from '@/lib/services/credit-service';

export async function GET(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }

    // Get available credit packages
    const packages = CreditService.getCreditPackages();

    return NextResponse.json({ packages });
  } catch (error) {
    console.error('Packages API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit packages' },
      { status: 500 }
    );
  }
}