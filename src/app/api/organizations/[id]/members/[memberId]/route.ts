import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const updateMemberSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER'], {
    errorMap: () => ({ message: 'Role must be ADMIN, MEMBER, or VIEWER' })
  })
});

// PUT /api/organizations/[id]/members/[memberId] - Update member role
export const PUT = withAuth(async (
  request: NextRequest,
  user: { uid: string; email: string },
  { params }: { params: { id: string; memberId: string } }
) => {
  try {
    const { id: organizationId, memberId } = params;
    const body = await request.json();
    const { role } = updateMemberSchema.parse(body);

    // Check if user has permission to update member roles
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
    const isAdmin = member?.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if target member exists in organization
    const targetMember = await prisma.user.findFirst({
      where: {
        id: memberId,
        organizationId: organizationId
      }
    });

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found in organization' }, { status: 404 });
    }

    // Prevent owner from being modified
    if (organization.ownerId === memberId) {
      return NextResponse.json({ error: 'Cannot modify organization owner role' }, { status: 400 });
    }

    // Prevent non-owners from modifying admin roles
    if (!isOwner && (targetMember.role === UserRole.ADMIN || role === 'ADMIN')) {
      return NextResponse.json({ error: 'Only organization owner can manage admin roles' }, { status: 403 });
    }

    // Update member role
    const updatedMember = await prisma.user.update({
      where: { id: memberId },
      data: { role: role as UserRole },
      select: {
        id: true,
        email: true,
        displayName: true,
        photoUrl: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      }
    });

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating member role:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/organizations/[id]/members/[memberId] - Remove member
export const DELETE = withAuth(async (
  request: NextRequest,
  user: { uid: string; email: string },
  { params }: { params: { id: string; memberId: string } }
) => {
  try {
    const { id: organizationId, memberId } = params;

    // Check if user has permission to remove members
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
    const isAdmin = member?.role === UserRole.ADMIN;

    // Allow self-removal or admin/owner removal of others
    const isSelfRemoval = memberId === user.uid;
    const canRemoveOthers = isOwner || isAdmin;

    if (!isSelfRemoval && !canRemoveOthers) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if target member exists in organization
    const targetMember = await prisma.user.findFirst({
      where: {
        id: memberId,
        organizationId: organizationId
      }
    });

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found in organization' }, { status: 404 });
    }

    // Prevent owner from being removed
    if (organization.ownerId === memberId) {
      return NextResponse.json({ error: 'Cannot remove organization owner' }, { status: 400 });
    }

    // Prevent non-owners from removing admins (unless self-removal)
    if (!isOwner && !isSelfRemoval && targetMember.role === UserRole.ADMIN) {
      return NextResponse.json({ error: 'Only organization owner can remove admins' }, { status: 403 });
    }

    // Remove member from organization
    await prisma.user.update({
      where: { id: memberId },
      data: {
        organizationId: null,
        role: UserRole.MEMBER // Reset to default role
      }
    });

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});