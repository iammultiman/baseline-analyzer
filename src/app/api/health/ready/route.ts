import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Readiness check - more strict than health check
    const readiness = {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: false,
        migrations: false,
        secrets: false,
        dependencies: false
      }
    };

    // Database connectivity and basic query
    try {
      await prisma.$queryRaw`SELECT 1`;
      
      // Check if essential tables exist
      const userCount = await prisma.user.count({ take: 1 });
      readiness.checks.database = true;
      readiness.checks.migrations = true;
    } catch (error) {
      console.error('Database readiness check failed:', error);
      readiness.checks.database = false;
      readiness.status = 'not_ready';
    }

    // Check essential environment variables/secrets
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'FIREBASE_CONFIG'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    readiness.checks.secrets = missingEnvVars.length === 0;
    
    if (missingEnvVars.length > 0) {
      readiness.status = 'not_ready';
      console.error('Missing environment variables:', missingEnvVars);
    }

    // Check critical dependencies
    try {
      // Verify Firebase configuration
      if (process.env.FIREBASE_CONFIG) {
        JSON.parse(process.env.FIREBASE_CONFIG);
      }
      readiness.checks.dependencies = true;
    } catch (error) {
      console.error('Dependencies check failed:', error);
      readiness.checks.dependencies = false;
      readiness.status = 'not_ready';
    }

    const responseTime = Date.now() - startTime;
    (readiness as any).response_time_ms = responseTime;

    // Return 200 if ready, 503 if not ready
    const statusCode = readiness.status === 'ready' ? 200 : 503;
    
    return NextResponse.json(readiness, { status: statusCode });
    
  } catch (error) {
    console.error('Readiness check failed:', error);
    
    return NextResponse.json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
      response_time_ms: Date.now() - startTime
    }, { status: 503 });
  }
}