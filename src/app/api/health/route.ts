import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Basic health check
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks: {
        database: 'unknown',
        redis: 'unknown',
        external_services: 'unknown'
      }
    };

    // Database connectivity check
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.checks.database = 'healthy';
    } catch (error) {
      health.checks.database = 'unhealthy';
      health.status = 'degraded';
    }

    // Redis connectivity check (if configured)
    try {
      // Add Redis health check here if using Redis
      health.checks.redis = 'healthy';
    } catch (error) {
      health.checks.redis = 'unhealthy';
    }

    // External services check
    try {
      // Check critical external services
      const externalChecks = await Promise.allSettled([
        // Add external service checks here
        Promise.resolve('healthy') // Placeholder
      ]);
      
      const hasFailures = externalChecks.some(result => result.status === 'rejected');
      health.checks.external_services = hasFailures ? 'degraded' : 'healthy';
      
      if (hasFailures && health.status === 'healthy') {
        health.status = 'degraded';
      }
    } catch (error) {
      health.checks.external_services = 'unhealthy';
      health.status = 'degraded';
    }

    const responseTime = Date.now() - startTime;
    
    // Add response time to health check
    (health as any).response_time_ms = responseTime;

    // Return appropriate status code based on health
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    return NextResponse.json(health, { status: statusCode });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      response_time_ms: Date.now() - startTime
    }, { status: 503 });
  }
}