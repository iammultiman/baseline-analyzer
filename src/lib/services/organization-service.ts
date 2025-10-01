import { prisma } from '@/lib/database';
import { UserRole, InvitationStatus } from '@prisma/client';
import { TenantContext } from '@/lib/tenant-middleware';
import crypto from 'crypto';

export class OrganizationService {
  /**
   * Check if user can perform action on organization
   */
  static async canPerformAction(
    context: TenantContext,
    organizationId: string,
    action: 'read' | 'write' | 'admin' | 'owner'
  ): Promise<boolean> {
    if (!context.organization) {
      return false;
    }

    // Check if user has access to this organization
    const hasOrgAccess = context.organization.id === organizationId || context.isOwner;
    if (!hasOrgAccess) {
      return false;
    }

    switch (action) {
      case 'read':
        return true; // Any member can read

      case 'write':
        return (context.userRole === UserRole.ADMIN || context.userRole === UserRole.MEMBER) || context.isOwner;

      case 'admin':
        return context.userRole === UserRole.ADMIN || context.isOwner;

      case 'owner':
        return context.isOwner;

      default:
        return false;
    }
  }

  /**
   * Get organization with usage statistics
   */
  static async getOrganizationWithStats(organizationId: string) {
    const [organization, memberCount, analysisCount, pendingInvitations] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              displayName: true,
            }
          }
        }
      }),
      prisma.user.count({
        where: { organizationId }
      }),
      prisma.repositoryAnalysis.count({
        where: { organizationId }
      }),
      prisma.invitation.count({
        where: {
          organizationId,
          status: InvitationStatus.PENDING
        }
      })
    ]);

    if (!organization) {
      return null;
    }

    return {
      ...organization,
      stats: {
        memberCount,
        analysisCount,
        pendingInvitations
      }
    };
  }

  /**
   * Create organization invitation
   */
  static async createInvitation(
    organizationId: string,
    inviterId: string,
    email: string,
    role: UserRole
  ) {
    // Check if user is already a member
    const existingMember = await prisma.user.findFirst({
      where: {
        email,
        organizationId
      }
    });

    if (existingMember) {
      throw new Error('User is already a member of this organization');
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        organizationId,
        email,
        status: InvitationStatus.PENDING
      }
    });

    if (existingInvitation) {
      throw new Error('Invitation already sent to this email');
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return prisma.invitation.create({
      data: {
        organizationId,
        inviterId,
        email,
        role,
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
  }

  /**
   * Accept invitation
   */
  static async acceptInvitation(token: string, userId: string, userEmail: string) {
    // Find invitation by token
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true
      }
    });

    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    // Validate invitation
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error('Invitation is no longer valid');
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED }
      });
      throw new Error('Invitation has expired');
    }

    if (invitation.email !== userEmail) {
      throw new Error('Invitation email does not match your account');
    }

    // Check if user is already a member of an organization
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true }
    });

    if (existingUser?.organizationId) {
      throw new Error('You are already a member of an organization');
    }

    // Accept invitation in transaction
    return prisma.$transaction(async (tx) => {
      // Update user to join organization
      const updatedUser = await tx.user.update({
        where: { id: userId },
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
  }

  /**
   * Remove member from organization
   */
  static async removeMember(organizationId: string, memberId: string) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Prevent owner from being removed
    if (organization.ownerId === memberId) {
      throw new Error('Cannot remove organization owner');
    }

    const targetMember = await prisma.user.findFirst({
      where: {
        id: memberId,
        organizationId
      }
    });

    if (!targetMember) {
      throw new Error('Member not found in organization');
    }

    // Remove member from organization
    await prisma.user.update({
      where: { id: memberId },
      data: {
        organizationId: null,
        role: UserRole.MEMBER // Reset to default role
      }
    });

    return { success: true };
  }

  /**
   * Update member role
   */
  static async updateMemberRole(organizationId: string, memberId: string, newRole: UserRole) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Prevent owner role from being modified
    if (organization.ownerId === memberId) {
      throw new Error('Cannot modify organization owner role');
    }

    const targetMember = await prisma.user.findFirst({
      where: {
        id: memberId,
        organizationId
      }
    });

    if (!targetMember) {
      throw new Error('Member not found in organization');
    }

    return prisma.user.update({
      where: { id: memberId },
      data: { role: newRole },
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
  }

  /**
   * Get organization usage for rate limiting
   */
  static async getUsageStats(organizationId: string, period: 'day' | 'month' = 'day') {
    const now = new Date();
    const startDate = new Date();
    
    if (period === 'day') {
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    const [analysisCount, creditUsage] = await Promise.all([
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
      })
    ]);

    return {
      analysisCount,
      creditUsage: Math.abs(creditUsage._sum.amount || 0)
    };
  }
}