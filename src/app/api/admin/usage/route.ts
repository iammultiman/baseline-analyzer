import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { TransactionType } from '@prisma/client';

/**
 * GET /api/admin/usage - Get usage analytics and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: authResult.user.uid },
      include: { organization: true },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get organization members for filtering
    const orgMembers = await prisma.user.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true },
    });
    const memberIds = orgMembers.map(m => m.id);

    // Get usage statistics
    const [
      totalUsers,
      activeUsers,
      totalTransactions,
      totalCreditsUsed,
      totalCreditsPurchased,
      recentTransactions,
      userBalances,
    ] = await Promise.all([
      // Total users in organization
      prisma.user.count({
        where: { organizationId: user.organizationId },
      }),

      // Active users (users with transactions in the period)
      prisma.user.count({
        where: {
          organizationId: user.organizationId,
          creditTransactions: {
            some: {
              createdAt: { gte: startDate },
            },
          },
        },
      }),

      // Total transactions in period
      prisma.creditTransaction.count({
        where: {
          userId: { in: memberIds },
          createdAt: { gte: startDate },
        },
      }),

      // Total credits used (deductions)
      prisma.creditTransaction.aggregate({
        where: {
          userId: { in: memberIds },
          type: TransactionType.DEDUCTION,
          createdAt: { gte: startDate },
        },
        _sum: { amount: true },
      }),

      // Total credits purchased
      prisma.creditTransaction.aggregate({
        where: {
          userId: { in: memberIds },
          type: TransactionType.PURCHASE,
          createdAt: { gte: startDate },
        },
        _sum: { amount: true },
      }),

      // Recent transactions for activity feed
      prisma.creditTransaction.findMany({
        where: {
          userId: { in: memberIds },
          createdAt: { gte: startDate },
        },
        include: {
          user: {
            select: {
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),

      // User credit balances
      prisma.user.findMany({
        where: { organizationId: user.organizationId },
        select: {
          id: true,
          displayName: true,
          email: true,
          creditBalance: true,
          createdAt: true,
        },
        orderBy: { creditBalance: 'desc' },
      }),
    ]);

    // Calculate daily usage for the chart
    const dailyUsage = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transactions,
        SUM(CASE WHEN type = 'DEDUCTION' THEN ABS(amount) ELSE 0 END) as credits_used,
        SUM(CASE WHEN type = 'PURCHASE' THEN amount ELSE 0 END) as credits_purchased
      FROM credit_transactions 
      WHERE user_id = ANY(${memberIds}) 
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    ` as Array<{
      date: Date;
      transactions: bigint;
      credits_used: bigint;
      credits_purchased: bigint;
    }>;

    return NextResponse.json({
      period: `${days} days`,
      summary: {
        totalUsers,
        activeUsers,
        totalTransactions,
        totalCreditsUsed: Math.abs(totalCreditsUsed._sum.amount || 0),
        totalCreditsPurchased: totalCreditsPurchased._sum.amount || 0,
      },
      dailyUsage: dailyUsage.map(day => ({
        date: day.date,
        transactions: Number(day.transactions),
        creditsUsed: Number(day.credits_used),
        creditsPurchased: Number(day.credits_purchased),
      })),
      recentTransactions: recentTransactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        createdAt: tx.createdAt,
        user: {
          displayName: tx.user.displayName,
          email: tx.user.email,
        },
      })),
      userBalances,
    });
  } catch (error) {
    console.error('Error fetching usage analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}