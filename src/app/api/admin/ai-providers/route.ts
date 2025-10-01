import { NextRequest, NextResponse } from 'next/server'
import { AIProviderService } from '@/lib/services/ai-provider-service'
import { AIProviderCreateInput } from '@/lib/types/ai-provider'
import { verifyAuth } from '@/lib/auth-middleware'
import { getTenantContext } from '@/lib/tenant-middleware'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tenant context
    const tenantResult = await getTenantContext(request, authResult.user.uid)
    if (!tenantResult.success || !tenantResult.organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    // Check if user has admin role
    if (tenantResult.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const configs = await AIProviderService.getProviderConfigs(tenantResult.organizationId)

    // Remove sensitive API keys from response
    const sanitizedConfigs = configs.map(config => ({
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : ''
    }))

    return NextResponse.json({ configs: sanitizedConfigs })
  } catch (error) {
    console.error('Error fetching AI provider configs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI provider configurations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tenant context
    const tenantResult = await getTenantContext(request, authResult.user.uid)
    if (!tenantResult.success || !tenantResult.organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    // Check if user has admin role
    if (tenantResult.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const input: AIProviderCreateInput = {
      ...body,
      organizationId: tenantResult.organizationId
    }

    // Validate input
    const validation = AIProviderService.validateProviderConfig(input)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const config = await AIProviderService.createProviderConfig(input)

    // Remove sensitive API key from response
    const sanitizedConfig = {
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : ''
    }

    return NextResponse.json({ config: sanitizedConfig }, { status: 201 })
  } catch (error) {
    console.error('Error creating AI provider config:', error)
    
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A provider with this name already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create AI provider configuration' },
      { status: 500 }
    )
  }
}