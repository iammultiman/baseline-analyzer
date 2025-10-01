import { NextRequest, NextResponse } from 'next/server'
import { RepositoryProcessor } from '@/lib/services/repository-processor'
import { z } from 'zod'

const validateRequestSchema = z.object({
  url: z.string().url('Invalid URL format')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = validateRequestSchema.parse(body)

    const validation = await RepositoryProcessor.validateRepository(url)

    return NextResponse.json({
      success: true,
      data: validation
    })
  } catch (error) {
    console.error('Repository validation error:', error)
    
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