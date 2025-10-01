import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { verifyAuthToken } from '@/lib/auth-middleware';
import { randomBytes } from 'crypto';

// First, let's add the SharedReport model to the schema (this would be done in a migration)
// For now, we'll simulate it with a simple in-memory store for demonstration
const sharedReportsStore = new Map<string, any>();

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuthToken(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    // In a real implementation, this would query the database
    // For now, return mock data based on the organization/user
    const userKey = organizationId || authResult.user.id;
    const userReports = Array.from(sharedReportsStore.values())
      .filter(report => report.createdBy === userKey)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(userReports);

  } catch (error) {
    console.error('Shared reports GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load shared reports' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuthToken(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      includeData,
      access,
      expiration,
      timeRange,
      organizationId,
      dashboardData,
    } = body;

    // Generate unique ID and secure token
    const reportId = randomBytes(16).toString('hex');
    const token = randomBytes(32).toString('hex');
    
    // Calculate expiration date
    const now = new Date();
    let expiresAt: Date;
    
    switch (expiration) {
      case '1d':
        expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case '7d':
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      case 'never':
        expiresAt = new Date('2099-12-31');
        break;
      default:
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    // Create shared report record
    const sharedReport = {
      id: reportId,
      title,
      token,
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shared-report/${token}`,
      includeData,
      access,
      timeRange,
      organizationId,
      dashboardData,
      createdBy: organizationId || authResult.user.id,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isPublic: access.isPublic,
      accessCount: 0,
    };

    // Store the report (in a real app, this would be saved to the database)
    sharedReportsStore.set(reportId, sharedReport);

    // Return the created report
    return NextResponse.json({
      id: reportId,
      title,
      url: sharedReport.url,
      expiresAt: expiresAt.toISOString(),
      isPublic: access.isPublic,
      accessCount: 0,
      createdAt: now.toISOString(),
    });

  } catch (error) {
    console.error('Shared reports POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create shared report' },
      { status: 500 }
    );
  }
}