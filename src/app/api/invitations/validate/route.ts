import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { InvitationStatus } from '@prisma/client';
import { z } from 'zod';

const validateInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required')
});

// POST /api/invitations/validate - Validate invitation token (public endpoint)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = validateInvitationSchema.parse(body);

    // Find invitation by token
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
        inviter: {
          select: {
            displayName: true,
            email: true,
          }
        }
      }
    });

    if (!invitation) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid invitation token' 
      }, { status: 404 });
    }

    // Check if invitation is still valid
    const now = new Date();
    const isExpired = invitation.expiresAt < now;
    const isNotPending = invitation.status !== InvitationStatus.PENDING;

    if (isExpired) {
      // Mark as expired if not already
      if (invitation.status === InvitationStatus.PENDING) {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED }
        });
      }
      
      return NextResponse.json({ 
        valid: false, 
        error: 'Invitation has expired' 
      }, { status: 400 });
    }

    if (isNotPending) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Invitation is no longer valid' 
      }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        organization: invitation.organization,
        inviter: invitation.inviter,
        expiresAt: invitation.expiresAt,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { valid: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error validating invitation:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}