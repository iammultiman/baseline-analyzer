import { NextResponse } from 'next/server'
import { DatabaseHealthChecker } from '@/lib/database-health'

export async function GET() {
  try {
    const healthCheck = await DatabaseHealthChecker.performHealthCheck()
    
    const statusCode = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 206 : 503

    return NextResponse.json(healthCheck, { status: statusCode })
  } catch (error) {
    console.error('Database health check endpoint failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    }, { status: 503 })
  }
}

export async function POST() {
  try {
    // Perform detailed health check with performance metrics
    const [healthCheck, performanceMetrics, vectorTest] = await Promise.all([
      DatabaseHealthChecker.performHealthCheck(),
      DatabaseHealthChecker.getPerformanceMetrics(),
      DatabaseHealthChecker.testVectorSearchPerformance()
    ])

    return NextResponse.json({
      ...healthCheck,
      performanceMetrics,
      vectorTest
    })
  } catch (error) {
    console.error('Detailed database health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    }, { status: 503 })
  }
}