import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { TransactionType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (range) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    const userId = auth.user.id;

    // Get all transactions in the date range
    const transactions = await prisma.creditTransaction.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: now,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate overview statistics
    const deductions = transactions.filter(t => t.type === TransactionType.DEDUCTION);
    const purchases = transactions.filter(t => t.type === TransactionType.PURCHASE);
    
    const totalCreditsUsed = deductions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalAnalyses = deductions.length;
    const averageCreditsPerAnalysis = totalAnalyses > 0 ? totalCreditsUsed / totalAnalyses : 0;
    const totalSpent = purchases.reduce((sum, t) => {
      const metadata = t.metadata as any;
      return sum + (metadata?.price || 0);
    }, 0);

    // Generate daily trends
    const dailyTrends = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= now) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayTransactions = transactions.filter(t => 
        t.createdAt >= dayStart && t.createdAt <= dayEnd
      );
      
      const dayDeductions = dayTransactions.filter(t => t.type === TransactionType.DEDUCTION);
      const dayPurchases = dayTransactions.filter(t => t.type === TransactionType.PURCHASE);
      
      dailyTrends.push({
        date: currentDate.toISOString().split('T')[0],
        creditsUsed: dayDeductions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
        analyses: dayDeductions.length,
        cost: dayPurchases.reduce((sum, t) => {
          const metadata = t.metadata as any;
          return sum + (metadata?.price || 0);
        }, 0),
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Generate complexity breakdown (mock data for now - would need to track this in metadata)
    const complexityBreakdown = [
      { complexity: 'Simple', creditsUsed: Math.floor(totalCreditsUsed * 0.2), percentage: 20, color: '#0088FE' },
      { complexity: 'Moderate', creditsUsed: Math.floor(totalCreditsUsed * 0.4), percentage: 40, color: '#00C49F' },
      { complexity: 'Complex', creditsUsed: Math.floor(totalCreditsUsed * 0.3), percentage: 30, color: '#FFBB28' },
      { complexity: 'Very Complex', creditsUsed: Math.floor(totalCreditsUsed * 0.1), percentage: 10, color: '#FF8042' },
    ];

    // Generate repository size breakdown (mock data for now)
    const sizeBreakdown = [
      { sizeRange: '< 100KB', creditsUsed: Math.floor(totalCreditsUsed * 0.3), analyses: Math.floor(totalAnalyses * 0.4) },
      { sizeRange: '100KB - 1MB', creditsUsed: Math.floor(totalCreditsUsed * 0.4), analyses: Math.floor(totalAnalyses * 0.35) },
      { sizeRange: '1MB - 10MB', creditsUsed: Math.floor(totalCreditsUsed * 0.25), analyses: Math.floor(totalAnalyses * 0.2) },
      { sizeRange: '> 10MB', creditsUsed: Math.floor(totalCreditsUsed * 0.05), analyses: Math.floor(totalAnalyses * 0.05) },
    ];

    // Calculate monthly projection
    const daysInRange = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyAverage = totalCreditsUsed / daysInRange;
    const monthlyProjection = Math.ceil(dailyAverage * 30);

    // Determine recommended package
    let recommendedPackage = 'Starter Pack';
    if (monthlyProjection > 300) {
      recommendedPackage = 'Professional Pack';
    }
    if (monthlyProjection > 1000) {
      recommendedPackage = 'Enterprise Pack';
    }

    // Calculate potential savings
    const currentCostPerCredit = totalSpent > 0 ? totalSpent / (purchases.reduce((sum, t) => sum + t.amount, 0) || 1) : 0;
    const savingsOpportunity = monthlyProjection > 100 ? Math.floor(monthlyProjection * 0.1 * currentCostPerCredit) : 0;

    const analytics = {
      overview: {
        totalCreditsUsed,
        totalAnalyses,
        averageCreditsPerAnalysis: Math.round(averageCreditsPerAnalysis * 10) / 10,
        totalSpent,
        period: `${range} (${daysInRange} days)`,
      },
      trends: {
        daily: dailyTrends,
        weekly: [], // Could implement weekly aggregation
        monthly: [], // Could implement monthly aggregation
      },
      breakdown: {
        byComplexity: complexityBreakdown,
        byRepositorySize: sizeBreakdown,
      },
      projections: {
        monthlyProjection,
        recommendedPackage,
        savingsOpportunity: savingsOpportunity > 0 ? savingsOpportunity : undefined,
      },
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}