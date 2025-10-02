import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

export async function setupTestDatabase() {
  try {
    // Clean up existing data
    await cleanupTestDatabase()
    
    // Seed test data
    await seedTestData()
  } catch (error) {
    console.error('Error setting up test database:', error)
    throw error
  }
}

export async function cleanupTestDatabase() {
  try {
    // Delete in correct order to respect foreign key constraints
    await prisma.auditLog.deleteMany()
    await prisma.webhookDelivery.deleteMany()
    await prisma.webhook.deleteMany()
    await prisma.apiKey.deleteMany()
    await prisma.invitation.deleteMany()
    await prisma.creditTransaction.deleteMany()
    await prisma.repositoryAnalysis.deleteMany()
    await prisma.aIProviderConfig.deleteMany()
    await prisma.user.deleteMany()
    await prisma.organization.deleteMany()
    await prisma.baselineData.deleteMany()
  } catch (error) {
    console.error('Error cleaning up test database:', error)
    // Continue even if cleanup fails
  }
}

export async function seedTestData() {
  // Create test users
  const testUser = await prisma.user.create({
    data: {
      id: 'test-user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      creditBalance: 100,
    },
  })

  const adminUser = await prisma.user.create({
    data: {
      id: 'admin-user-123',
      email: 'admin@example.com',
      displayName: 'Admin User',
      creditBalance: 1000,
      role: 'ADMIN',
    },
  })

  // Create test organization
  const testOrg = await prisma.organization.create({
    data: {
      id: 'test-org-123',
      name: 'Test Organization',
      slug: 'test-org',
      ownerId: adminUser.id,
      settings: {
        aiProvider: {
          provider: 'OPENAI',
          apiKey: 'test-key',
          model: 'gpt-4',
        },
        pricingConfig: {
          freeCredits: 10,
          creditCostPerAnalysis: { base: 1, perFile: 0.1, perKB: 0.01 },
        },
      },
    },
  })

  // Update test user with organization
  await prisma.user.update({
    where: { id: testUser.id },
    data: { 
      organizationId: testOrg.id,
      role: 'MEMBER'
    },
  })

  // Create test repository analysis
  await prisma.repositoryAnalysis.create({
    data: {
      id: 'test-analysis-123',
      userId: testUser.id,
      organizationId: testOrg.id,
      repositoryUrl: 'https://github.com/test/sample-repo',
      repositoryName: 'sample-repo',
      status: 'COMPLETED',
      creditsCost: 15,
      results: {
        complianceScore: 85,
        recommendations: [
          {
            category: 'Accessibility',
            severity: 'medium',
            title: 'Add alt text to images',
            description: 'Images should have descriptive alt text',
            files: ['src/components/image.tsx'],
          },
        ],
        baselineMatches: [
          {
            feature: 'CSS Grid',
            status: 'baseline',
            usage: ['src/styles/layout.css'],
          },
        ],
        issues: [
          {
            category: 'Performance',
            severity: 'high',
            title: 'Large bundle size',
            description: 'Bundle size exceeds recommended limits',
            files: ['dist/main.js'],
          },
        ],
      },
      metadata: {
        repositorySize: 2048000,
        fileCount: 80,
        processingTime: 45000,
        aiProvider: 'openai',
      },
    },
  })

  // Create test credit transactions
  await prisma.creditTransaction.createMany({
    data: [
      {
        id: 'txn-purchase-123',
        userId: testUser.id,
        type: 'PURCHASE',
        amount: 100,
        description: 'Credit purchase - Starter Pack',
        metadata: {
          packageId: 'starter',
          paymentMethod: 'stripe',
        },
      },
      {
        id: 'txn-deduction-123',
        userId: testUser.id,
        type: 'DEDUCTION',
        amount: -15,
        description: 'Repository analysis - sample-repo',
        metadata: {
          analysisId: 'test-analysis-123',
        },
      },
    ],
  })

  // Create test baseline data
  await prisma.baselineData.createMany({
    data: [
      {
        id: 'baseline-css-grid',
        feature: 'CSS Grid',
        category: 'Layout',
        status: 'BASELINE',
        description: 'CSS Grid Layout provides a two-dimensional layout system',
        documentation: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout',
        browserSupport: {
          chrome: '57',
          firefox: '52',
          safari: '10.1',
          edge: '16',
        },
        embedding: new Array(1536).fill(0.1),
      },
      {
        id: 'baseline-flexbox',
        feature: 'CSS Flexbox',
        category: 'Layout',
        status: 'BASELINE',
        description: 'CSS Flexible Box Layout provides efficient arrangement of items',
        documentation: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Flexible_Box_Layout',
        browserSupport: {
          chrome: '29',
          firefox: '28',
          safari: '9',
          edge: '12',
        },
        embedding: new Array(1536).fill(0.2),
      },
    ],
  })

  console.log('Test data seeded successfully')
}

export { prisma as testPrisma }