import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { UserRole } from '@prisma/client';

// GET /api/organizations/[id]/members - Get organization members
export const GET = withAuth(async (
  request: NextRequest,
  user: { uid: string; email: string },
  { params }: { params: { id: string } }
) => {
  try {
    const organizationId = params.id;

    // Check if user has access to this organization
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: { where: { id: user.uid } }
      }
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const isOwner = organization.ownerId === user.uid;
    const member = organization.members[0];
    const hasAccess = isOwner || member;

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all members
    const members = await prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        displayName: true,
        photoUrl: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'asc' }
    });

    // Add owner information
    const owner = await prisma.user.findUnique({
      where: { id: organization.ownerId },
      select: {
        id: true,
        email: true,
        displayName: true,
        photoUrl: true,
        createdAt: true,
        lastLoginAt: true,
      }
    });

    const allMembers = [
      ...(owner ? [{ ...owner, role: 'OWNER' as const, isOwner: true }] : []),
      ...members.map(member => ({ ...member, isOwner: false }))
    ];

    return NextResponse.json({ members: allMembers });
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});