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

    if (jobStatus.status !== 'completed') {
      return NextResponse.json(
        { 
          success: false, 
          error: `Job is not completed. Current status: ${jobStatus.status}` 
        },
        { status: 400 }
      )
    }

    if (!jobStatus.result) {
      return NextResponse.json(
        { success: false, error: 'No result available' },
        { status: 404 }
      )
    }

    // Get query parameter to determine format
    const format = request.nextUrl.searchParams.get('format') || 'json'

    if (format === 'llm') {
      // Return LLM-formatted content
      const llmContent = RepositoryProcessor.formatForLLM(jobStatus.result)
      
      return new NextResponse(llmContent, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${jobStatus.result.metadata.repositoryName}-llm-format.txt"`
        }
      })
    }

    // Return JSON format by default
    return NextResponse.json({
      success: true,
      data: jobStatus.result
    })
  } catch (error) {
    console.error('Job result error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}