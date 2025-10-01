import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { verifyAuthToken } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuthToken(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const organizationId = searchParams.get('organizationId');
    const userId = searchParams.get('userId');

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build where clause based on filters
    const whereClause: any = {
      analysisDate: {
        gte: startDate,
      },
      status: 'COMPLETED',
    };

    if (organizationId) {
      whereClause.organizationId = organizationId;
    } else if (userId) {
      whereClause.userId = userId;
    } else {
      // Default to user's organization or their own analyses
      if (authResult.user.organizationId) {
        whereClause.organizationId = authResult.user.organizationId;
      } else {
        whereClause.userId = authResult.user.id;
      }
    }

    // Get all analyses for the time period
    const analyses = await prisma.repositoryAnalysis.findMany({
      where: whereClause,
      orderBy: {
        analysisDate: 'desc',
      },
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    });

    // Calculate metrics
    const totalAnalyses = analyses.length;
    const averageCompliance = analyses.length > 0
      ? analyses.reduce((sum, analysis) => {
          const results = analysis.results as any;
          return sum + (results?.complianceScore || 0);
        }, 0) / analyses.length
      : 0;

    // Generate trends data (group by day)
    const trendsMap = new Map<string, { total: number; count: number; analysisCount: number }>();
    
    analyses.forEach(analysis => {
      const dateKey = analysis.analysisDate.toISOString().split('T')[0];
      const results = analysis.results as any;
      const complianceScore = results?.complianceScore || 0;
      
      if (!trendsMap.has(dateKey)) {
        trendsMap.set(dateKey, { total: 0, count: 0, analysisCount: 0 });
      }
      
      const dayData = trendsMap.get(dateKey)!;
      dayData.total += complianceScore;
      dayData.count += 1;
      dayData.analysisCount += 1;
    });

    const trendsData = Array.from(trendsMap.entries())
      .map(([date, data]) => ({
        date,
        complianceScore: data.count > 0 ? Math.round(data.total / data.count) : 0,
        analysisCount: data.analysisCount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Analyze common issues
    const issuesMap = new Map<string, { count: number; severity: string }>();
    
    analyses.forEach(analysis => {
      const results = analysis.results as any;
      if (results?.issues) {
        results.issues.forEach((issue: any) => {
          const category = issue.category || issue.type || 'Unknown';
          const severity = issue.severity || issue.priority || 'medium';
          
          if (!issuesMap.has(category)) {
            issuesMap.set(category, { count: 0, severity });
          }
          
          issuesMap.get(category)!.count += 1;
        });
      }
    });

    const topIssues = Array.from(issuesMap.entries())
      .map(([category, data]) => ({
        category,
        count: data.count,
        severity: data.severity as 'high' | 'medium' | 'low',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Format recent analyses
    const recentAnalyses = analyses.slice(0, 20).map(analysis => {
      const results = analysis.results as any;
      return {
        id: analysis.id,
        repositoryName: analysis.repositoryName || 'Unknown Repository',
        complianceScore: results?.complianceScore || 0,
        analysisDate: analysis.analysisDate,
        status: analysis.status,
        user: analysis.user.displayName || analysis.user.email,
      };
    });

    const dashboardData = {
      totalAnalyses,
      averageCompliance,
      trendsData,
      topIssues,
      recentAnalyses,
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}