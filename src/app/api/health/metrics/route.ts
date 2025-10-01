import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Application metrics for monitoring
    const metrics = {
      timestamp: new Date().toISOString(),
      application: {
        name: 'baseline-analyzer',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime_seconds: Math.floor(process.uptime()),
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage()
      },
      database: {
        connection_pool: {
          // Add connection pool metrics if available
          active_connections: 0,
          idle_connections: 0,
          total_connections: 0
        }
      },
      business_metrics: {
        total_users: 0,
        total_organizations: 0,
        total_analyses: 0,
        analyses_last_24h: 0,
        active_users_last_24h: 0,
        credit_transactions_last_24h: 0
      },
      performance_metrics: {
        avg_analysis_time_ms: 0,
        avg_response_time_ms: 0,
        error_rate_last_hour: 0
      }
    };

    // Gather database metrics
    try {
      const [
        userCount,
        orgCount,
        analysisCount,
        recentAnalyses,
        activeUsers,
        recentTransactions
      ] = await Promise.all([
        prisma.user.count(),
        prisma.organization.count(),
        prisma.repositoryAnalysis.count(),
        prisma.repositoryAnalysis.count({
          where: {
            analysisDate: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        }),
        prisma.user.count({
          where: {
            lastLoginAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        }),
        prisma.creditTransaction.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      metrics.business_metrics = {
        total_users: userCount,
        total_organizations: orgCount,
        total_analyses: analysisCount,
        analyses_last_24h: recentAnalyses,
        active_users_last_24h: activeUsers,
        credit_transactions_last_24h: recentTransactions
      };

      // Calculate average analysis time
      const avgAnalysisTime = await prisma.repositoryAnalysis.aggregate({
        where: {
          status: 'completed',
          analysisDate: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        _avg: {
          // Add processing time field if available
          // processingTimeMs: true
        }
      });

      // metrics.performance_metrics.avg_analysis_time_ms = avgAnalysisTime._avg.processingTimeMs || 0;

    } catch (error) {
      console.error('Failed to gather database metrics:', error);
    }

    return NextResponse.json(metrics);
    
  } catch (error) {
    console.error('Metrics endpoint failed:', error);
    
    return NextResponse.json({
      error: 'Failed to gather metrics',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}