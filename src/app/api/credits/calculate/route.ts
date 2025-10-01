import { NextRequest, NextResponse } from 'next/server';
import { CreditService, CreditCalculationParams } from '@/lib/services/credit-service';
import { authMiddleware } from '@/lib/auth-middleware';

interface CalculateRequest {
  repositorySize: number;
  fileCount: number;
  complexity?: number;
}

/**
 * POST /api/credits/calculate - Calculate credit cost for repository analysis
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CalculateRequest = await request.json();
    const { repositorySize, fileCount, complexity = 5 } = body;

    if (typeof repositorySize !== 'number' || typeof fileCount !== 'number') {
      return NextResponse.json(
        { error: 'Repository size and file count are required as numbers' },
        { status: 400 }
      );
    }

    if (repositorySize < 0 || fileCount < 0) {
      return NextResponse.json(
        { error: 'Repository size and file count must be non-negative' },
        { status: 400 }
      );
    }

    const params: CreditCalculationParams = {
      repositorySize,
      fileCount,
      complexity: Math.max(1, Math.min(10, complexity)),
    };

    const creditCost = CreditService.calculateAnalysisCost(params);
    const userBalance = await CreditService.getBalance(authResult.user.uid);
    const hasSufficientCredits = userBalance >= creditCost;

    return NextResponse.json({
      creditCost,
      userBalance,
      hasSufficientCredits,
      calculation: {
        repositorySize,
        fileCount,
        complexity: params.complexity,
      },
    });
  } catch (error) {
    console.error('Error calculating credit cost:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}