import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    // Check database health
    const dbStart = Date.now();
    const dbHealth = await checkDatabaseHealth();
    const dbResponseTime = Date.now() - dbStart;

    // Check AI providers health (mock for now - would integrate with actual providers)
    const aiProviders = await checkAIProvidersHealth();

    // Check storage health (mock for now)
    const storageHealth = await checkStorageHealth();

    // Get performance metrics
    const performance = await getPerformanceMetrics();

    // Get system alerts
    const alerts = await getSystemAlerts();

    // Determine overall system status
    const systemStatus = determineSystemStatus(dbHealth, aiProviders, storageHealth);

    const healthData = {
      status: systemStatus,
      services: {
        database: {
          status: dbHealth.status,
          responseTime: dbResponseTime,
          connections: dbHealth.connections,
          maxConnections: dbHealth.maxConnections,
        },
        aiProviders,
        storage: storageHealth,
      },
      performance,
      alerts,
    };

    return NextResponse.json(healthData);
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    );
  }
}

async function checkDatabaseHealth() {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Get connection info (mock values for now)
    const connections = 5; // Would get from actual DB metrics
    const maxConnections = 100;

    return {
      status: 'up' as const,
      connections,
      maxConnections,
    };
  } catch {
    return {
      status: 'down' as const,
      connections: 0,
      maxConnections: 100,
    };
  }
}

async function checkAIProvidersHealth() {
  // Mock AI provider health checks
  // In a real implementation, this would test actual provider endpoints
  const providers = [
    {
      name: 'OpenAI',
      status: 'up' as const,
      responseTime: 150,
      errorRate: 0.01,
    },
    {
      name: 'Google Gemini',
      status: 'up' as const,
      responseTime: 200,
      errorRate: 0.02,
    },
    {
      name: 'Claude',
      status: 'degraded' as const,
      responseTime: 500,
      errorRate: 0.05,
    },
  ];

  return providers;
}

async function checkStorageHealth() {
  // Mock storage health check
  // In a real implementation, this would check actual storage metrics
  return {
    status: 'up' as const,
    usage: 50 * 1024 * 1024 * 1024, // 50GB
    capacity: 100 * 1024 * 1024 * 1024, // 100GB
  };
}

async function getPerformanceMetrics() {
  // Mock performance metrics
  // In a real implementation, this would come from monitoring systems
  return {
    avgResponseTime: 250,
    requestsPerMinute: 45,
    errorRate: 0.02,
    uptime: 86400 * 7, // 7 days in seconds
  };
}

async function getSystemAlerts() {
  // Mock system alerts
  // In a real implementation, this would come from monitoring/alerting systems
  return [
    {
      id: '1',
      level: 'warning' as const,
      message: 'High response time detected on AI provider Claude',
      timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      resolved: false,
    },
    {
      id: '2',
      level: 'info' as const,
      message: 'Database maintenance completed successfully',
      timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      resolved: true,
    },
  ];
}

function determineSystemStatus(
  dbHealth: { status: string },
  aiProviders: Array<{ status: string }>,
  storageHealth: { status: string }
): 'healthy' | 'warning' | 'critical' {
  // Critical if database is down
  if (dbHealth.status === 'down') {
    return 'critical';
  }

  // Critical if storage is down
  if (storageHealth.status === 'down') {
    return 'critical';
  }

  // Warning if any AI provider is down or degraded
  const hasProviderIssues = aiProviders.some(
    provider => provider.status === 'down' || provider.status === 'degraded'
  );

  if (hasProviderIssues) {
    return 'warning';
  }

  return 'healthy';
}