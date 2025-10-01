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
    const format = searchParams.get('format') || 'json';
    const timeRange = searchParams.get('timeRange') || '30d';
    const organizationId = searchParams.get('organizationId');
    const userId = searchParams.get('userId');
    const analysesParam = searchParams.get('analyses');
    const selectedAnalyses = analysesParam ? analysesParam.split(',') : [];

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

    // Build where clause
    const whereClause: any = {
      analysisDate: {
        gte: startDate,
      },
      status: 'COMPLETED',
    };

    if (selectedAnalyses.length > 0) {
      whereClause.id = {
        in: selectedAnalyses,
      };
    } else {
      if (organizationId) {
        whereClause.organizationId = organizationId;
      } else if (userId) {
        whereClause.userId = userId;
      } else {
        if (authResult.user.organizationId) {
          whereClause.organizationId = authResult.user.organizationId;
        } else {
          whereClause.userId = authResult.user.id;
        }
      }
    }

    // Get analyses data
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
        organization: {
          select: {
            name: true,
          },
        },
      },
    });

    // Prepare export data
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        timeRange,
        totalAnalyses: analyses.length,
        organizationId,
        userId,
      },
      summary: {
        totalAnalyses: analyses.length,
        averageCompliance: analyses.length > 0
          ? analyses.reduce((sum, analysis) => {
              const results = analysis.results as any;
              return sum + (results?.complianceScore || 0);
            }, 0) / analyses.length
          : 0,
        dateRange: {
          start: startDate.toISOString(),
          end: now.toISOString(),
        },
      },
      analyses: analyses.map(analysis => {
        const results = analysis.results as any;
        return {
          id: analysis.id,
          repositoryName: analysis.repositoryName,
          repositoryUrl: analysis.repositoryUrl,
          analysisDate: analysis.analysisDate.toISOString(),
          complianceScore: results?.complianceScore || 0,
          creditsCost: analysis.creditsCost,
          user: analysis.user.displayName || analysis.user.email,
          organization: analysis.organization?.name,
          results: format === 'detailed' ? results : {
            complianceScore: results?.complianceScore || 0,
            recommendationsCount: results?.recommendations?.length || 0,
            issuesCount: results?.issues?.length || 0,
            baselineFeaturesCount: results?.baselineMatches?.length || 0,
          },
          metadata: analysis.metadata,
        };
      }),
    };

    // Handle different export formats
    if (format === 'csv') {
      const csvHeaders = [
        'Repository Name',
        'Repository URL',
        'Analysis Date',
        'Compliance Score',
        'Credits Cost',
        'User',
        'Organization',
        'Recommendations Count',
        'Issues Count',
        'Baseline Features Count',
      ];

      const csvRows = analyses.map(analysis => {
        const results = analysis.results as any;
        return [
          analysis.repositoryName || '',
          analysis.repositoryUrl || '',
          analysis.analysisDate.toISOString(),
          results?.complianceScore || 0,
          analysis.creditsCost || 0,
          analysis.user.displayName || analysis.user.email,
          analysis.organization?.name || '',
          results?.recommendations?.length || 0,
          results?.issues?.length || 0,
          results?.baselineMatches?.length || 0,
        ];
      });

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="baseline-analysis-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Default to JSON format
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="baseline-analysis-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });

  } catch (error) {
    console.error('Export API error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}