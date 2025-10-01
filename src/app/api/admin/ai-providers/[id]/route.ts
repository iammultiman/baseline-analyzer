import { NextRequest, NextResponse } from 'next/server'
import { AIProviderService } from '@/lib/services/ai-provider-service'
import { AIProviderUpdateInput } from '@/lib/types/ai-provider'
import { verifyAuth } from '@/lib/auth-middleware'
import { getTenantContext } from '@/lib/tenant-middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const config = await AIProviderService.getProviderConfig(params.id)
    
    if (!config) {
      return NextResponse.json({ error: 'AI provider configuration not found' }, { status: 404 })
    }

    // Verify the config belongs to the user's organization
    if (config.organizationId !== tenantResult.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Remove sensitive API key from response
    const sanitizedConfig = {
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : ''
    }

    return NextResponse.json({ config: sanitizedConfig })
  } catch (error) {
    console.error('Error fetching AI provider config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI provider configuration' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verify the config exists and belongs to the organization
    const existingConfig = await AIProviderService.getProviderConfig(params.id)
    if (!existingConfig) {
      return NextResponse.json({ error: 'AI provider configuration not found' }, { status: 404 })
    }

    if (existingConfig.organizationId !== tenantResult.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const input: AIProviderUpdateInput = body

    // Validate input
    const validation = AIProviderService.validateProviderConfig(input)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const config = await AIProviderService.updateProviderConfig(params.id, input)

    // Remove sensitive API key from response
    const sanitizedConfig = {
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : ''
    }

    return NextResponse.json({ config: sanitizedConfig })
  } catch (error) {
    console.error('Error updating AI provider config:', error)
    return NextResponse.json(
      { error: 'Failed to update AI provider configuration' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verify the config exists and belongs to the organization
    const existingConfig = await AIProviderService.getProviderConfig(params.id)
    if (!existingConfig) {
      return NextResponse.json({ error: 'AI provider configuration not found' }, { status: 404 })
    }

    if (existingConfig.organizationId !== tenantResult.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    await AIProviderService.deleteProviderConfig(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting AI provider config:', error)
    return NextResponse.json(
      { error: 'Failed to delete AI provider configuration' },
      { status: 500 }
    )
  }
}