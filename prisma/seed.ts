import { PrismaClient, UserRole, TransactionType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create a test organization owner
  const owner = await prisma.user.upsert({
    where: { email: 'admin@baseline-analyzer.com' },
    update: {},
    create: {
      email: 'admin@baseline-analyzer.com',
      displayName: 'Admin User',
      creditBalance: 1000,
      role: UserRole.ADMIN,
    },
  })

  console.log('✅ Created admin user:', owner.email)

  // Create a test organization
  const organization = await prisma.organization.upsert({
    where: { slug: 'baseline-analyzer-demo' },
    update: {},
    create: {
      name: 'Baseline Analyzer Demo',
      slug: 'baseline-analyzer-demo',
      ownerId: owner.id,
      settings: {
        aiProvider: {
          primary: 'openai',
          fallback: ['gemini', 'claude'],
          models: {
            openai: 'gpt-4',
            gemini: 'gemini-pro',
            claude: 'claude-3-sonnet'
          }
        },
        pricingConfig: {
          creditCostPerAnalysis: 10,
          markupPercentage: 20,
          packages: [
            { id: 'starter', name: 'Starter', credits: 100, price: 9.99 },
            { id: 'pro', name: 'Pro', credits: 500, price: 39.99, popular: true },
            { id: 'enterprise', name: 'Enterprise', credits: 2000, price: 149.99 }
          ],
          freeTierLimits: {
            creditsPerMonth: 50,
            analysesPerDay: 5,
            maxRepositorySize: 10485760 // 10MB
          }
        },
        usageLimits: {
          maxAnalysesPerDay: 100,
          maxAnalysesPerMonth: 1000,
          maxRepositorySize: 104857600, // 100MB
          maxConcurrentAnalyses: 5
        }
      }
    },
  })

  console.log('✅ Created demo organization:', organization.name)

  // Update owner to be part of the organization
  await prisma.user.update({
    where: { id: owner.id },
    data: { organizationId: organization.id },
  })

  // Create some test users
  const testUsers = [
    {
      email: 'developer@example.com',
      displayName: 'Test Developer',
      role: UserRole.MEMBER,
      creditBalance: 100,
    },
    {
      email: 'viewer@example.com',
      displayName: 'Test Viewer',
      role: UserRole.VIEWER,
      creditBalance: 50,
    },
  ]

  for (const userData of testUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        organizationId: organization.id,
      },
    })
    console.log('✅ Created test user:', user.email)

    // Create initial credit transaction
    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        type: TransactionType.BONUS,
        amount: userData.creditBalance,
        description: 'Welcome bonus credits',
        metadata: {
          source: 'seed_script',
          reason: 'initial_signup'
        }
      },
    })
  }

  // Create some sample baseline data
  const sampleBaselineData = [
    {
      feature: 'CSS Grid Layout',
      category: 'CSS',
      status: 'baseline',
      description: 'CSS Grid Layout provides a two-dimensional grid-based layout system',
      documentation: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout',
      browserSupport: {
        chrome: '57+',
        firefox: '52+',
        safari: '10.1+',
        edge: '16+'
      }
    },
    {
      feature: 'Flexbox',
      category: 'CSS',
      status: 'baseline',
      description: 'CSS Flexible Box Layout provides efficient arrangement of items in a container',
      documentation: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Flexible_Box_Layout',
      browserSupport: {
        chrome: '29+',
        firefox: '28+',
        safari: '9+',
        edge: '12+'
      }
    },
    {
      feature: 'Web Components',
      category: 'JavaScript',
      status: 'limited',
      description: 'Web Components allow creation of reusable custom elements',
      documentation: 'https://developer.mozilla.org/en-US/docs/Web/Web_Components',
      browserSupport: {
        chrome: '54+',
        firefox: '63+',
        safari: '10.1+',
        edge: '79+'
      }
    },
    {
      feature: 'Service Workers',
      category: 'JavaScript',
      status: 'baseline',
      description: 'Service Workers enable offline functionality and background sync',
      documentation: 'https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API',
      browserSupport: {
        chrome: '40+',
        firefox: '44+',
        safari: '11.1+',
        edge: '17+'
      }
    },
    {
      feature: 'CSS Container Queries',
      category: 'CSS',
      status: 'not-baseline',
      description: 'Container queries allow styling based on container size',
      documentation: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Container_Queries',
      browserSupport: {
        chrome: '105+',
        firefox: '110+',
        safari: '16+',
        edge: '105+'
      }
    }
  ]

  for (const baselineItem of sampleBaselineData) {
    await prisma.baselineData.create({
      data: baselineItem,
    })
  }

  console.log('✅ Created sample baseline data')

  // Create a sample repository analysis
  const sampleAnalysis = await prisma.repositoryAnalysis.create({
    data: {
      userId: owner.id,
      organizationId: organization.id,
      repositoryUrl: 'https://github.com/example/sample-repo',
      repositoryName: 'sample-repo',
      status: 'COMPLETED',
      creditsCost: 15,
      results: {
        complianceScore: 85,
        recommendations: [
          {
            id: '1',
            title: 'Update to CSS Grid',
            description: 'Consider using CSS Grid for better layout control',
            priority: 'medium',
            category: 'CSS',
            actionItems: [
              'Replace float-based layouts with CSS Grid',
              'Update browser support documentation'
            ],
            resources: [
              {
                title: 'CSS Grid Guide',
                url: 'https://css-tricks.com/snippets/css/complete-guide-grid/',
                type: 'tutorial'
              }
            ]
          }
        ],
        baselineMatches: [
          {
            feature: 'Flexbox',
            status: 'baseline',
            confidence: 0.95,
            description: 'Flexbox is widely used and well-supported'
          }
        ],
        issues: [
          {
            id: '1',
            type: 'warning',
            title: 'Outdated CSS practices',
            description: 'Some CSS practices could be modernized',
            severity: 'medium'
          }
        ]
      },
      metadata: {
        repositorySize: 1024000,
        fileCount: 45,
        processingTime: 12.5,
        aiProvider: 'openai',
        languages: ['JavaScript', 'CSS', 'HTML'],
        frameworks: ['React', 'Next.js'],
        dependencies: ['react', 'next', 'tailwindcss']
      }
    },
  })

  console.log('✅ Created sample repository analysis')

  // Create credit transaction for the analysis
  await prisma.creditTransaction.create({
    data: {
      userId: owner.id,
      type: TransactionType.DEDUCTION,
      amount: -15,
      description: 'Repository analysis: sample-repo',
      metadata: {
        analysisId: sampleAnalysis.id,
        repositoryUrl: 'https://github.com/example/sample-repo'
      }
    },
  })

  console.log('🎉 Database seed completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })