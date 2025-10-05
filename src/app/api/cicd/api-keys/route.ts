import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/lib/services/api-key-service';
import { CreateApiKeyRequest, API_PERMISSIONS } from '@/lib/types/cicd';
import { authenticateUser, AuthenticationError } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const { user, organizationId } = await authenticateUser(request);
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    const apiKeys = await ApiKeyService.listApiKeys(organizationId);
    
    return NextResponse.json({
      apiKeys,
      usage: await ApiKeyService.getApiKeyUsageStats(organizationId),
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, organizationId } = await authenticateUser(request);
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    const body: CreateApiKeyRequest = await request.json();
    
    // Validate request
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      );
    }

    // Validate permissions
    if (body.permissions) {
      const validPermissions = Object.values(API_PERMISSIONS);
      const invalidPermissions = body.permissions.filter(p => !validPermissions.includes(p as any));
      
      if (invalidPermissions.length > 0) {
        return NextResponse.json(
          { error: `Invalid permissions: ${invalidPermissions.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate expiration date
    if (body.expiresAt && new Date(body.expiresAt) <= new Date()) {
      return NextResponse.json(
        { error: 'Expiration date must be in the future' },
        { status: 400 }
      );
    }

    const apiKey = await ApiKeyService.createApiKey(organizationId, user.id, body);
    
    return NextResponse.json(apiKey, { status: 201 });
  } catch (error) {
    console.error('Error creating API key:', error);
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}