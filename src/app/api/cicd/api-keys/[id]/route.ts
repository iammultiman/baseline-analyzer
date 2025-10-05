import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/lib/services/api-key-service';
import { API_PERMISSIONS } from '@/lib/types/cicd';
import { authenticateUser, AuthenticationError } from '@/lib/auth-middleware';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, organizationId } = await authenticateUser(request);
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, permissions, expiresAt } = body;

    // Validate permissions if provided
    if (permissions) {
      const validPermissions = Object.values(API_PERMISSIONS);
      const invalidPermissions = permissions.filter((p: string) => !validPermissions.includes(p as any));
      
      if (invalidPermissions.length > 0) {
        return NextResponse.json(
          { error: `Invalid permissions: ${invalidPermissions.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate expiration date if provided
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      return NextResponse.json(
        { error: 'Expiration date must be in the future' },
        { status: 400 }
      );
    }

    await ApiKeyService.updateApiKey(organizationId, params.id, {
      name,
      permissions,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating API key:', error);
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, organizationId } = await authenticateUser(request);
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    await ApiKeyService.revokeApiKey(organizationId, params.id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking API key:', error);
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}