import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { InvitationStatus } from '@prisma/client';
import { z } from 'zod';

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required')
});

// POST /api/invitations/accept - Accept invitation
export const POST = withAuth(async (
  request: NextRequest,
  user: { uid: string; email: string }
) => {
  try {
    const body = await request.json();
    const { token } = acceptInvitationSchema.parse(body);

    // Find invitation by token
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true
      }
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 });
    }

    // Check if invitation is valid
    if (invitation.status !== InvitationStatus.PENDING) {
      return NextResponse.json({ error: 'Invitation is no longer valid' }, { status: 400 });
    }

    if (invitation.expiresAt < new Date()) {
      // Mark as expired
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED }
      });
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    // Check if email matches
    if (invitation.email !== user.email) {
      return NextResponse.json({ error: 'Invitation email does not match your account' }, { status: 400 });
    }

    // Check if user is already a member of an organization
    const existingUser = await prisma.user.findUnique({
      where: { id: user.uid },
      include: { organization: true }
    });

    if (existingUser?.organizationId) {
      return NextResponse.json(
        { error: 'You are already a member of an organization' },
        { status: 400 }
      );
    }

    // Accept invitation - update user and invitation in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user to join organization
      const updatedUser = await tx.user.update({
        where: { id: user.uid },
        data: {
          organizationId: invitation.organizationId,
          role: invitation.role
        },
        include: {
          organization: true
        }
      });

      // Mark invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED }
      });

      return updatedUser;
    });

    return NextResponse.json({
      message: 'Invitation accepted successfully',
      user: result,
      organization: result.organization
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});