import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { withOrganizationAccess } from '@/lib/tenant-middleware';
import { prisma } from '@/lib/database';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  settings: z.object({
    aiProvider: z.object({
      primary: z.string(),
      fallback: z.array(z.string()).optional(),
      models: z.record(z.string()),
      rateLimits: z.record(z.number())
    }).optional(),
    pricingConfig: z.object({
      creditCostPerAnalysis: z.number().min(1),
      markupPercentage: z.number().min(0).max(100),
      freeTierLimits: z.object({
        creditsPerMonth: z.number().min(0),
        analysesPerDay: z.number().min(0),
        maxRepositorySize: z.number().min(0)
      })
    }).optional(),
    usageLimits: z.object({
      maxAnalysesPerDay: z.number().min(1),
      maxAnalysesPerMonth: z.number().min(1),
      maxRepositorySize: z.number().min(1),
      maxConcurrentAnalyses: z.number().min(1)
    }).optional()
  }).optional()
});

// GET /api/organizations/[id] - Get organization details
export const GET = withOrganizationAccess(async (
  request: NextRequest, 
  context,
  { params }: { params: { id: string } }
) => {
  try {
    const organizationId = params.id;

    // Get organization with members (access already verified by middleware)
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            displayName: true,
          }
        },
        members: {
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            createdAt: true,
            lastLoginAt: true,
          }
        },
        invitations: {
          where: { status: 'PENDING' },
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            expiresAt: true,
          }
        }
      }
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ organization });
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, (params) => params.id);

// PUT /api/organizations/[id] - Update organization
export const PUT = withOrganizationAccess(async (
  request: NextRequest,
  context,
  { params }: { params: { id: string } }
) => {
  try {
    const organizationId = params.id;
    const body = await request.json();
    const validatedData = updateOrganizationSchema.parse(body);

    // Check if user has admin permissions
    const canAdmin = context.isOwner || context.userRole === UserRole.ADMIN;
    if (!canAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get current organization for merging settings
    const currentOrg = await prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!currentOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Update organization
    const updatedOrganization = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.settings && { 
          settings: {
            ...currentOrg.settings as any,
            ...validatedData.settings
          }
        })
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            displayName: true,
          }
        },
        members: {
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            createdAt: true,
          }
        }
      }
    });

    return NextResponse.json({ organization: updatedOrganization });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, (params) => params.id);

// DELETE /api/organizations/[id] - Delete organization
export const DELETE = withOrganizationAccess(async (
  request: NextRequest,
  context,
  { params }: { params: { id: string } }
) => {
  try {
    const organizationId = params.id;

    // Only owner can delete organization
    if (!context.isOwner) {
      return NextResponse.json({ error: 'Only organization owner can delete' }, { status: 403 });
    }

    // Delete organization (cascade will handle related records)
    await prisma.organization.delete({
      where: { id: organizationId }
    });

    return NextResponse.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Error deleting organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, (params) => params.id);