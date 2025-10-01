import { NextRequest, NextResponse } from 'next/server'
import { RepositoryProcessor } from '@/lib/services/repository-processor'
import { verifyAuthToken } from '@/lib/auth-middleware'

interface RouteParams {
  params: Promise<{
    jobId: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify authentication
    const authResult = await verifyAuthToken(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const jobStatus = RepositoryProcessor.getJobStatus(jobId)
    if (!jobStatus) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      )
    }

    // Verify user owns this job
    if (jobStatus.userId !== authResult.user.uid) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const queueStatus = RepositoryProcessor.getQueueStatus(jobId)

    return NextResponse.json({
      success: true,
      data: {
        job: jobStatus,
        queue: queueStatus
      }
    })
  } catch (error) {
    console.error('Job status error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}