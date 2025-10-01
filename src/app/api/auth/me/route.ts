import { NextRequest, NextResponse } from 'next/server';
import { withTenant, TenantContext } from '@/lib/tenant-middleware';

async function handler(request: NextRequest, context: TenantContext) {
  return NextResponse.json({
    success: true,
    user: {
      uid: context.user.uid,
      email: context.user.email,
      role: context.userRole,
      organization: context.organization ? {
        id: context.organization.id,
        name: context.organization.name,
        slug: context.organization.slug,
        isOwner: context.isOwner,
      } : null,
    },
  });
}

export const GET = withTenant(handler);