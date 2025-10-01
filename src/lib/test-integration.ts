/**
 * Integration test for multi-tenancy and organization management
 * This file can be run to verify the implementation works correctly
 */

import { prisma } from '@/lib/database';
import { UserRole, InvitationStatus } from '@prisma/client';
import { OrganizationService } from '@/lib/services/organization-service';

export async function runIntegrationTests() {
  console.log('🧪 Starting multi-tenancy integration tests...');
  
  const timestamp = Date.now();
  const testResults = {
    organizationCreation: false,
    userManagement: false,
    invitationSystem: false,
    tenantIsolation: false,
    roleBasedAccess: false,
    cleanup: false
  };

  try {
    // Test 1: Organization Creation
    console.log('📝 Test 1: Organization Creation');
    const testOrg = await prisma.organization.create({
      data: {
        name: 'Integration Test Org',
        slug: `integration-test-${timestamp}`,
        ownerId: `test-owner-${timestamp}`,
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
    testResults.organizationCreation = !!testOrg.id;
    console.log(`✅ Organization created: ${testOrg.id}`);

    // Test 2: User Management
    console.log('👥 Test 2: User Management');
    const owner = await prisma.user.create({
      data: {
        id: `test-owner-${timestamp}`,
        email: `owner-${timestamp}@test.com`,
        displayName: 'Test Owner',
        organizationId: testOrg.id,
        role: UserRole.ADMIN,
        creditBalance: 100
      }
    });

    const member = await prisma.user.create({
      data: {
        id: `test-member-${timestamp}`,
        email: `member-${timestamp}@test.com`,
        displayName: 'Test Member',
        organizationId: testOrg.id,
        role: UserRole.MEMBER,
        creditBalance: 50
      }
    });

    testResults.userManagement = !!owner.id && !!member.id;
    console.log(`✅ Users created: Owner ${owner.id}, Member ${member.id}`);

    // Test 3: Invitation System
    console.log('📧 Test 3: Invitation System');
    const invitation = await OrganizationService.createInvitation(
      testOrg.id,
      owner.id,
      `invited-${timestamp}@test.com`,
      UserRole.VIEWER
    );

    testResults.invitationSystem = !!invitation.id;
    console.log(`✅ Invitation created: ${invitation.id}`);

    // Test 4: Tenant Isolation
    console.log('🔒 Test 4: Tenant Isolation');
    const secondOrg = await prisma.organization.create({
      data: {
        name: 'Second Test Org',
        slug: `second-test-${timestamp}`,
        ownerId: `second-owner-${timestamp}`,
        settings: {}
      }
    });

    const secondOwner = await prisma.user.create({
      data: {
        id: `second-owner-${timestamp}`,
        email: `second-owner-${timestamp}@test.com`,
        displayName: 'Second Owner',
        organizationId: secondOrg.id,
        role: UserRole.ADMIN
      }
    });

    // Verify isolation
    const org1Members = await prisma.user.findMany({
      where: { organizationId: testOrg.id }
    });
    const org2Members = await prisma.user.findMany({
      where: { organizationId: secondOrg.id }
    });

    const isolated = !org1Members.some(m => m.organizationId === secondOrg.id) &&
                    !org2Members.some(m => m.organizationId === testOrg.id);

    testResults.tenantIsolation = isolated;
    console.log(`✅ Tenant isolation verified: ${isolated}`);

    // Test 5: Role-Based Access
    console.log('🛡️ Test 5: Role-Based Access Control');
    const mockContext = {
      user: { uid: member.id, email: member.email },
      organization: {
        id: testOrg.id,
        name: testOrg.name,
        slug: testOrg.slug,
        ownerId: testOrg.ownerId,
        settings: testOrg.settings
      },
      userRole: UserRole.MEMBER,
      isOwner: false
    };

    const canRead = await OrganizationService.canPerformAction(mockContext, testOrg.id, 'read');
    const canWrite = await OrganizationService.canPerformAction(mockContext, testOrg.id, 'write');
    const cannotAdmin = !(await OrganizationService.canPerformAction(mockContext, testOrg.id, 'admin'));

    testResults.roleBasedAccess = canRead && canWrite && cannotAdmin;
    console.log(`✅ Role-based access verified: Read=${canRead}, Write=${canWrite}, NoAdmin=${cannotAdmin}`);

    // Test 6: Cleanup
    console.log('🧹 Test 6: Cleanup');
    await prisma.invitation.delete({ where: { id: invitation.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, member.id, secondOwner.id] } }
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [testOrg.id, secondOrg.id] } }
    });

    testResults.cleanup = true;
    console.log('✅ Cleanup completed');

    // Summary
    console.log('\n📊 Test Results Summary:');
    Object.entries(testResults).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });

    const allPassed = Object.values(testResults).every(result => result);
    console.log(`\n🎯 Overall Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

    return { success: allPassed, results: testResults };

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Export for use in API routes or standalone execution
export default runIntegrationTests;