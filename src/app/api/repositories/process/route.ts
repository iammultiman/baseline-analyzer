import { NextRequest, NextResponse } from 'next/server'
import { RepositoryProcessor } from '@/lib/services/repository-processor'
import { verifyAuthToken } from '@/lib/auth-middleware'
import { z } from 'zod'

const processRequestSchema = z.object({
  url: z.string().url('Invalid URL format')
})

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuthToken(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { url } = processRequestSchema.parse(body)

    // Validate repository first
    const validation = await RepositoryProcessor.validateRepository(url)
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error || 'Repository validation failed'
        },
        { status: 400 }
      )
    }

    // Start processing
    const jobId = await RepositoryProcessor.processRepository(
      url,
      authResult.user.uid,
      authResult.user.organizationId || authResult.user.uid // Use user ID as org ID if no organization
    )

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        message: 'Repository processing started'
      }
    })
  } catch (error) {
    console.error('Repository processing error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}