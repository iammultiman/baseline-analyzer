import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

interface NotificationSettings {
  lowBalanceThreshold: number;
  enableLowBalanceAlerts: boolean;
  enableUsageLimitAlerts: boolean;
  enableSpendingAlerts: boolean;
  enableRecommendations: boolean;
  monthlySpendingLimit?: number;
}

const defaultSettings: NotificationSettings = {
  lowBalanceThreshold: 10,
  enableLowBalanceAlerts: true,
  enableUsageLimitAlerts: true,
  enableSpendingAlerts: true,
  enableRecommendations: true,
};

export async function GET(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }

    const userId = auth.user.id;

    // Get user's notification settings from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationSettings: true },
    });

    const settings = user?.notificationSettings as NotificationSettings || defaultSettings;

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Notification settings GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }

    const userId = auth.user.id;
    const updates = await request.json();

    // Validate the updates
    const validKeys = [
      'lowBalanceThreshold',
      'enableLowBalanceAlerts',
      'enableUsageLimitAlerts',
      'enableSpendingAlerts',
      'enableRecommendations',
      'monthlySpendingLimit',
    ];

    const filteredUpdates = Object.keys(updates)
      .filter(key => validKeys.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as any);

    // Get current settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationSettings: true },
    });

    const currentSettings = user?.notificationSettings as NotificationSettings || defaultSettings;
    const newSettings = { ...currentSettings, ...filteredUpdates };

    // Validate threshold
    if (newSettings.lowBalanceThreshold < 1 || newSettings.lowBalanceThreshold > 100) {
      return NextResponse.json(
        { error: 'Low balance threshold must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Update user's notification settings
    await prisma.user.update({
      where: { id: userId },
      data: { notificationSettings: newSettings },
    });

    return NextResponse.json({ settings: newSettings });
  } catch (error) {
    console.error('Notification settings PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update notification settings' },
      { status: 500 }
    );
  }
}