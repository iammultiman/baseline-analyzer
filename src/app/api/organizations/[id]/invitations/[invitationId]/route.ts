import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { UserRole, InvitationStatus } from '@prisma/client';

// DELETE /api/organizations/[id]/invitations/[invitationId] - Revoke invitation
export const DELETE = withAuth(async (
  request: NextRequest,
  user: { uid: string; email: string },
  { params }: { params: { id: string; invitationId: string } }
) => {
  try {
    const { id: organizationId, invitationId } = params;

    // Check if user has permission to revoke invitations
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

    // Find and revoke invitation
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Invitation does not belong to this organization' }, { status: 400 });
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      return NextResponse.json({ error: 'Invitation cannot be revoked' }, { status: 400 });
    }

    // Update invitation status
    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED }
    });

    return NextResponse.json({ message: 'Invitation revoked successfully' });
  } catch (error) {
    console.error('Error revoking invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});