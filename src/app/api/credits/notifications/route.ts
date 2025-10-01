import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { CreditService } from '@/lib/services/credit-service';

interface CreditNotification {
  id: string;
  type: 'low_balance' | 'usage_limit' | 'spending_alert' | 'recommendation';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  dismissible: boolean;
  createdAt: string;
  metadata?: any;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }

    const userId = auth.user.id;
    const notifications: CreditNotification[] = [];

    // Get current credit balance
    const balance = await CreditService.getBalance(userId);
    
    // Get usage limits
    const usageLimits = await CreditService.checkUsageLimits(userId);
    
    // Get usage stats for the last 30 days
    const usageStats = await CreditService.getUsageStats(userId, 30);

    // Check for low balance
    if (balance < 10) {
      notifications.push({
        id: `low_balance_${Date.now()}`,
        type: 'low_balance',
        severity: balance < 5 ? 'critical' : 'warning',
        title: 'Low Credit Balance',
        message: `You have ${balance} credits remaining. Consider purchasing more credits to continue analyzing repositories.`,
        actionLabel: 'Buy Credits',
        actionUrl: '/credits?tab=purchase',
        dismissible: true,
        createdAt: new Date().toISOString(),
        metadata: { balance },
      });
    }

    // Check for usage limits
    if (usageLimits.dailyLimitReached) {
      notifications.push({
        id: `daily_limit_${Date.now()}`,
        type: 'usage_limit',
        severity: 'warning',
        title: 'Daily Usage Limit Reached',
        message: `You've reached your daily limit of ${usageLimits.limits.freeUserDailyLimit} analyses. Upgrade to continue analyzing today.`,
        actionLabel: 'Buy Credits',
        actionUrl: '/credits?tab=purchase',
        dismissible: false,
        createdAt: new Date().toISOString(),
        metadata: usageLimits,
      });
    }

    if (usageLimits.monthlyLimitReached) {
      notifications.push({
        id: `monthly_limit_${Date.now()}`,
        type: 'usage_limit',
        severity: 'critical',
        title: 'Monthly Usage Limit Reached',
        message: `You've reached your monthly limit of ${usageLimits.limits.freeUserMonthlyLimit} analyses. Purchase credits to continue this month.`,
        actionLabel: 'Buy Credits',
        actionUrl: '/credits?tab=purchase',
        dismissible: false,
        createdAt: new Date().toISOString(),
        metadata: usageLimits,
      });
    }

    // Check for spending recommendations
    if (usageStats.totalCreditsUsed > 50 && usageStats.analysisCount > 10) {
      const monthlyProjection = (usageStats.totalCreditsUsed / 30) * 30;
      
      if (monthlyProjection > 100) {
        notifications.push({
          id: `recommendation_${Date.now()}`,
          type: 'recommendation',
          severity: 'info',
          title: 'Package Recommendation',
          message: `Based on your usage pattern, you might save money with a larger credit package. You're projected to use ${Math.ceil(monthlyProjection)} credits per month.`,
          actionLabel: 'View Packages',
          actionUrl: '/credits?tab=purchase',
          dismissible: true,
          createdAt: new Date().toISOString(),
          metadata: { monthlyProjection, usageStats },
        });
      }
    }

    // Check for unusual spending patterns
    const recentUsage = await CreditService.getUsageStats(userId, 7);
    if (recentUsage.totalCreditsUsed > usageStats.totalCreditsUsed * 0.5) {
      notifications.push({
        id: `spending_alert_${Date.now()}`,
        type: 'spending_alert',
        severity: 'warning',
        title: 'High Usage Alert',
        message: `You've used ${recentUsage.totalCreditsUsed} credits in the last 7 days, which is unusually high compared to your typical usage.`,
        dismissible: true,
        createdAt: new Date().toISOString(),
        metadata: { recentUsage, normalUsage: usageStats },
      });
    }

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Notifications API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }

    // In a real implementation, you would store dismissed notifications in the database
    // For now, we'll just return success since notifications are generated dynamically
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification dismiss error:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss notification' },
      { status: 500 }
    );
  }
}