import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { UserRole } from '@prisma/client';

export interface TenantContext {
  user: {
    uid: string;
    email: string;
  };
  organization?: {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    settings: any;
  };
  userRole: UserRole;
  isOwner: boolean;
}

/**
 * Middleware to enforce tenant isolation and provide organization context
 */
export async function getTenantContext(request: NextRequest): Promise<TenantContext | null> {
  try {
    // Verify authentication
    const user = await verifyAuthToken(request);
    if (!user) {
      return null;
    }

    // Get user with organization
    const userWithOrg = await prisma.user.findUnique({
      where: { id: user.uid },
      include: {
        organization: true
      }
    });

    if (!userWithOrg) {
      return null;
    }

    return {
      user,
      organization: userWithOrg.organization || undefined,
      userRole: userWithOrg.role,
      isOwner: userWithOrg.organization?.ownerId === user.uid || false
    };
  } catch (error) {
    console.error('Error getting tenant context:', error);
    return null;
  }
}

/**
 * Middleware wrapper that provides tenant context and enforces organization access
 */
export function withTenant<T extends unknown[]>(
  handler: (request: NextRequest, context: TenantContext, ...args: T) => Promise<NextResponse>,
  options: {
    requireOrganization?: boolean;
    requiredRoles?: UserRole[];
    allowOwnerAccess?: boolean;
  } = {}
) {
  return async (request: NextRequest, ...args: T) => {
    const context = await getTenantContext(request);
    
    if (!context) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if organization is required
    if (options.requireOrganization && !context.organization) {
      return NextResponse.json(
        { error: 'Organization membership required' },
        { status: 403 }
      );
    }

    // Check role requirements
    if (options.requiredRoles && options.requiredRoles.length > 0) {
      const hasRequiredRole = options.requiredRoles.includes(context.userRole);
      const isOwnerWithAccess = options.allowOwnerAccess && context.isOwner;
      
      if (!hasRequiredRole && !isOwnerWithAccess) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    return handler(request, context, ...args);
  };
}

/**
 * Middleware to enforce organization-specific resource access
 */
export function withOrganizationAccess<T extends unknown[]>(
  handler: (request: NextRequest, context: TenantContext, ...args: T) => Promise<NextResponse>,
  getOrganizationId: (params: any) => string
) {
  return withTenant(async (request: NextRequest, context: TenantContext, ...args: T) => {
    const params = (args[0] as any)?.params;
    const requestedOrgId = getOrganizationId(params);

    // Check if user has access to the requested organization
    if (context.organization?.id !== requestedOrgId) {
      // Check if user owns the requested organization
      const ownedOrg = await prisma.organization.findFirst({
        where: {
          id: requestedOrgId,
          ownerId: context.user.uid
        }
      });

      if (!ownedOrg) {
        return NextResponse.json(
          { error: 'Access denied to organization' },
          { status: 403 }
        );
      }

      // Update context with owned organization
      context.organization = ownedOrg;
      context.isOwner = true;
    }

    return handler(request, context, ...args);
  }, { requireOrganization: true });
}

/**
 * Utility to filter database queries by organization
 */
export function addTenantFilter(
  context: TenantContext,
  baseWhere: any = {}
): any {
  if (!context.organization) {
    return baseWhere;
  }

  return {
    ...baseWhere,
    organizationId: context.organization.id
  };
}

/**
 * Utility to ensure created resources belong to user's organization
 */
export function addTenantData(
  context: TenantContext,
  data: any
): any {
  if (!context.organization) {
    return data;
  }

  return {
    ...data,
    organizationId: context.organization.id,
    userId: context.user.uid
  };
}

/**
 * Check if user can access a specific resource within their organization
 */
export async function canAccessResource(
  context: TenantContext,
  resourceType: 'analysis' | 'invitation' | 'member',
  resourceId: string
): Promise<boolean> {
  if (!context.organization) {
    return false;
  }

  try {
    switch (resourceType) {
      case 'analysis':
        const analysis = await prisma.repositoryAnalysis.findFirst({
          where: {
            id: resourceId,
            organizationId: context.organization.id
          }
        });
        return !!analysis;

      case 'invitation':
        const invitation = await prisma.invitation.findFirst({
          where: {
            id: resourceId,
            organizationId: context.organization.id
          }
        });
        return !!invitation;

      case 'member':
        const member = await prisma.user.findFirst({
          where: {
            id: resourceId,
            organizationId: context.organization.id
          }
        });
        return !!member;

      default:
        return false;
    }
  } catch (error) {
    console.error('Error checking resource access:', error);
    return false;
  }
}

/**
 * Get organization usage statistics for rate limiting and billing
 */
export async function getOrganizationUsage(
  organizationId: string,
  period: 'day' | 'month' = 'day'
): Promise<{
  analysisCount: number;
  creditUsage: number;
  activeMembers: number;
}> {
  const now = new Date();
  const startDate = new Date();
  
  if (period === 'day') {
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
  }

  const [analysisCount, creditTransactions, memberCount] = await Promise.all([
    prisma.repositoryAnalysis.count({
      where: {
        organizationId,
        analysisDate: {
          gte: startDate,
          lte: now
        }
      }
    }),
    prisma.creditTransaction.aggregate({
      where: {
        user: {
          organizationId
        },
        type: 'DEDUCTION',
        createdAt: {
          gte: startDate,
          lte: now
        }
      },
      _sum: {
        amount: true
      }
    }),
    prisma.user.count({
      where: {
        organizationId,
        lastLoginAt: {
          gte: startDate
        }
      }
    })
  ]);

  return {
    analysisCount,
    creditUsage: Math.abs(creditTransactions._sum.amount || 0),
    activeMembers: memberCount
  };
}

/**
 * Middleware function for API routes that need tenant context
 */
export async function tenantMiddleware(
  request: NextRequest,
  user: { id: string; email: string }
): Promise<{
  success: boolean;
  organizationId?: string;
  error?: string;
  status?: number;
}> {
  try {
    // Get user with organization
    const userWithOrg = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        organization: true
      }
    });

    if (!userWithOrg) {
      return {
        success: false,
        error: 'User not found',
        status: 404
      };
    }

    if (!userWithOrg.organization) {
      return {
        success: false,
        error: 'Organization membership required',
        status: 403
      };
    }

    return {
      success: true,
      organizationId: userWithOrg.organization.id
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to get tenant context',
      status: 500
    };
  }
}