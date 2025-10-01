import { prisma } from '@/lib/database';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';

/**
 * Test utilities for organization management system
 */
export class OrganizationTestUtils {
  /**
   * Create a test organization with owner
   */
  static async createTestOrganization(ownerEmail: string = 'owner@test.com') {
    const ownerId = `test-owner-${Date.now()}`;
    const orgSlug = `test-org-${Date.now()}`;

    const organization = await prisma.organization.create({
      data: {
        name: 'Test Organization',
        slug: orgSlug,
        ownerId,
        settings: {
          aiProvider: {
            primary: 'openai',
            models: { 'openai': 'gpt-4' }
          },
          pricingConfig: {
            creditCostPerAnalysis: 10,
            markupPercentage: 0,
            freeTierLimits: {
              creditsPerMonth: 100,
              analysesPerDay: 5,
              maxRepositorySize: 50000000
            }
          }
        }
      }
    });

    const owner = await prisma.user.create({
      data: {
        id: ownerId,
        email: ownerEmail,
        displayName: 'Test Owner',
        organizationId: organization.id,
        role: UserRole.ADMIN
      }
    });

    return { organization, owner };
  }

  /**
   * Create test members for an organization
   */
  static async createTestMembers(organizationId: string, count: number = 2) {
    const members = [];
    
    for (let i = 0; i < count; i++) {
      const member = await prisma.user.create({
        data: {
          id: `test-member-${Date.now()}-${i}`,
          email: `member${i}@test.com`,
          displayName: `Test Member ${i}`,
          organizationId,
          role: i === 0 ? UserRole.ADMIN : UserRole.MEMBER
        }
      });
      members.push(member);
    }

    return members;
  }

  /**
   * Create test invitation
   */
  static async createTestInvitation(organizationId: string, inviterId: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return prisma.invitation.create({
      data: {
        organizationId,
        inviterId,
        email: 'invited@test.com',
        role: UserRole.MEMBER,
        token,
        expiresAt
      }
    });
  }

  /**
   * Clean up test data
   */
  static async cleanupTestData(organizationId: string) {
    // Delete invitations
    await prisma.invitation.deleteMany({
      where: { organizationId }
    });

    // Delete users (members)
    await prisma.user.deleteMany({
      where: { organizationId }
    });

    // Delete organization
    await prisma.organization.delete({
      where: { id: organizationId }
    });
  }

  /**
   * Verify organization isolation
   */
  static async verifyTenantIsolation(org1Id: string, org2Id: string) {
    // Create test data in both organizations
    const [org1Members, org2Members] = await Promise.all([
      prisma.user.findMany({ where: { organizationId: org1Id } }),
      prisma.user.findMany({ where: { organizationId: org2Id } })
    ]);

    // Verify no cross-contamination
    const org1HasOrg2Members = org1Members.some(m => m.organizationId === org2Id);
    const org2HasOrg1Members = org2Members.some(m => m.organizationId === org1Id);

    return {
      isolated: !org1HasOrg2Members && !org2HasOrg1Members,
      org1MemberCount: org1Members.length,
      org2MemberCount: org2Members.length
    };
  }

  /**
   * Test role-based access control
   */
  static async testRolePermissions() {
    const { organization, owner } = await this.createTestOrganization();
    const [admin, member, viewer] = await Promise.all([
      prisma.user.create({
        data: {
          id: `test-admin-${Date.now()}`,
          email: 'admin@test.com',
          displayName: 'Test Admin',
          organizationId: organization.id,
          role: UserRole.ADMIN
        }
      }),
      prisma.user.create({
        data: {
          id: `test-member-${Date.now()}`,
          email: 'member@test.com',
          displayName: 'Test Member',
          organizationId: organization.id,
          role: UserRole.MEMBER
        }
      }),
      prisma.user.create({
        data: {
          id: `test-viewer-${Date.now()}`,
          email: 'viewer@test.com',
          displayName: 'Test Viewer',
          organizationId: organization.id,
          role: UserRole.VIEWER
        }
      })
    ]);

    const results = {
      owner: {
        id: owner.id,
        role: owner.role,
        canManageOrg: true, // Owner can do everything
        canInviteMembers: true,
        canManageMembers: true
      },
      admin: {
        id: admin.id,
        role: admin.role,
        canManageOrg: true, // Admin can manage
        canInviteMembers: true,
        canManageMembers: true
      },
      member: {
        id: member.id,
        role: member.role,
        canManageOrg: false, // Member cannot manage
        canInviteMembers: false,
        canManageMembers: false
      },
      viewer: {
        id: viewer.id,
        role: viewer.role,
        canManageOrg: false, // Viewer cannot manage
        canInviteMembers: false,
        canManageMembers: false
      }
    };

    // Cleanup
    await this.cleanupTestData(organization.id);

    return results;
  }
}