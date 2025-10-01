import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(255),
  slug: z.string()
    .min(1, 'Organization slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
});

// GET /api/organizations - Get user's organizations
export const GET = withAuth(async (request: NextRequest, user: { uid: string; email: string }) => {
  try {
    // Get user with their organization
    const userWithOrg = await prisma.user.findUnique({
      where: { id: user.uid },
      include: {
        organization: true,
        ownedOrganizations: {
          include: {
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
        }
      }
    });

    if (!userWithOrg) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organizations = [];
    
    // Add organization user is a member of
    if (userWithOrg.organization) {
      organizations.push({
        ...userWithOrg.organization,
        role: userWithOrg.role,
        isOwner: false,
      });
    }

    // Add organizations user owns
    userWithOrg.ownedOrganizations.forEach(org => {
      organizations.push({
        ...org,
        role: 'ADMIN' as UserRole,
        isOwner: true,
      });
    });

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/organizations - Create new organization
export const POST = withAuth(async (request: NextRequest, user: { uid: string; email: string }) => {
  try {
    const body = await request.json();
    const validatedData = createOrganizationSchema.parse(body);

    // Check if slug is already taken
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: validatedData.slug }
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: 'Organization slug already exists' },
        { status: 409 }
      );
    }

    // Check if user already owns an organization (business rule)
    const userWithOwnedOrgs = await prisma.user.findUnique({
      where: { id: user.uid },
      include: { ownedOrganizations: true }
    });

    if (userWithOwnedOrgs?.ownedOrganizations.length) {
      return NextResponse.json(
        { error: 'User can only own one organization' },
        { status: 400 }
      );
    }

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        ownerId: user.uid,
        settings: {
          aiProvider: {
            primary: 'openai',
            models: { 'openai': 'gpt-4' },
            rateLimits: { 'openai': 100 }
          },
          pricingConfig: {
            creditCostPerAnalysis: 10,
            markupPercentage: 0,
            freeTierLimits: {
              creditsPerMonth: 100,
              analysesPerDay: 5,
              maxRepositorySize: 50000000 // 50MB
            }
          },
          usageLimits: {
            maxAnalysesPerDay: 50,
            maxAnalysesPerMonth: 1000,
            maxRepositorySize: 500000000, // 500MB
            maxConcurrentAnalyses: 5
          }
        }
      },
      include: {
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

    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});