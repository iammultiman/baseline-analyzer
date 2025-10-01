import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { UserRole, InvitationStatus } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { emailService } from '@/lib/services/email-service';

const createInvitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER'], {
    errorMap: () => ({ message: 'Role must be ADMIN, MEMBER, or VIEWER' })
  })
});

// GET /api/organizations/[id]/invitations - Get organization invitations
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
    const isAdmin = member?.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get invitations
    const invitations = await prisma.invitation.findMany({
      where: { organizationId },
      include: {
        inviter: {
          select: {
            id: true,
            email: true,
            displayName: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/organizations/[id]/invitations - Create invitation
export const POST = withAuth(async (
  request: NextRequest,
  user: { uid: string; email: string },
  { params }: { params: { id: string } }
) => {
  try {
    const organizationId = params.id;
    const body = await request.json();
    const validatedData = createInvitationSchema.parse(body);

    // Check if user has permission to invite
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

    // Check if user is already a member
    const existingMember = await prisma.user.findFirst({
      where: {
        email: validatedData.email,
        organizationId: organizationId
      }
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 409 }
      );
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        organizationId,
        email: validatedData.email,
        status: InvitationStatus.PENDING
      }
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'Invitation already sent to this email' },
        { status: 409 }
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        organizationId,
        inviterId: user.uid,
        email: validatedData.email,
        role: validatedData.role as UserRole,
        token,
        expiresAt
      },
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
            id: true,
            email: true,
            displayName: true,
          }
        }
      }
    });

    // Send invitation email
    try {
      await emailService.sendInvitationEmail({
        id: invitation.id,
        email: invitation.email,
        token: invitation.token,
        organizationName: invitation.organization.name,
        inviterName: invitation.inviter.displayName || invitation.inviter.email,
        inviterEmail: invitation.inviter.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      });
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the invitation creation if email fails
      // The invitation is still valid and can be accepted via direct link
    }

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});