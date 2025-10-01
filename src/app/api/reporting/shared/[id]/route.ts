import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-middleware';

// Import the shared store from the parent route (in a real app, this would be a database)
const sharedReportsStore = new Map<string, any>();

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAuthToken(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reportId = params.id;
    const report = sharedReportsStore.get(reportId);

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Check if user has permission to delete this report
    const userKey = authResult.user.organizationId || authResult.user.id;
    if (report.createdBy !== userKey) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the report
    sharedReportsStore.delete(reportId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete shared report error:', error);
    return NextResponse.json(
      { error: 'Failed to delete shared report' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reportId = params.id;
    const report = sharedReportsStore.get(reportId);

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Check if report has expired
    const now = new Date();
    const expiresAt = new Date(report.expiresAt);
    
    if (now > expiresAt) {
      return NextResponse.json({ error: 'Report has expired' }, { status: 410 });
    }

    // Increment access count
    report.accessCount += 1;
    sharedReportsStore.set(reportId, report);

    // Check access permissions
    if (!report.access.isPublic) {
      const authResult = await verifyAuthToken(request);
      if (!authResult.success) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      if (report.access.requireAuth) {
        const userKey = authResult.user.organizationId || authResult.user.id;
        if (report.createdBy !== userKey) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    // Return the report data
    const responseData = {
      id: report.id,
      title: report.title,
      includeData: report.includeData,
      access: report.access,
      timeRange: report.timeRange,
      dashboardData: report.dashboardData,
      createdAt: report.createdAt,
      expiresAt: report.expiresAt,
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Get shared report error:', error);
    return NextResponse.json(
      { error: 'Failed to load shared report' },
      { status: 500 }
    );
  }
}