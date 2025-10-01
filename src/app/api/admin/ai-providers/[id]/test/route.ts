import { NextRequest, NextResponse } from 'next/server'
import { AIProviderService } from '@/lib/services/ai-provider-service'
import { verifyAuth } from '@/lib/auth-middleware'
import { getTenantContext } from '@/lib/tenant-middleware'

export async function POST(
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

    // Get the AI provider configuration
    const config = await AIProviderService.getProviderConfig(params.id)
    
    if (!config) {
      return NextResponse.json({ error: 'AI provider configuration not found' }, { status: 404 })
    }

    // Verify the config belongs to the user's organization
    if (config.organizationId !== tenantResult.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Test the provider configuration
    const testResult = await AIProviderService.testProviderConfig(config)

    return NextResponse.json({
      success: testResult.success,
      error: testResult.error,
      latency: testResult.latency,
      provider: config.provider,
      model: config.model
    })
  } catch (error) {
    console.error('Error testing AI provider config:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to test AI provider configuration'
      },
      { status: 500 }
    )
  }
}