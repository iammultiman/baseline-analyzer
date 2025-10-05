import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { createMockPrismaClient } from '@/lib/test-helpers/test-utils'

const mockVerifyAuthToken = jest.fn()

jest.mock('@/lib/auth-middleware', () => ({
  verifyAuthToken: (request: NextRequest) => mockVerifyAuthToken(request),
}))

const mockPrisma = createMockPrismaClient() as any
mockPrisma.repositoryAnalysis.count = jest.fn()
mockPrisma.repositoryAnalysis.findFirst = jest.fn()
mockPrisma.invitation = { findFirst: jest.fn() }
mockPrisma.creditTransaction.aggregate = jest.fn()
mockPrisma.user.count = jest.fn()

jest.mock('@/lib/database', () => ({
  prisma: mockPrisma,
}))

describe('tenant middleware helpers', () => {
  let tenantModule: typeof import('../tenant-middleware')

  beforeAll(() => {
    tenantModule = require('../tenant-middleware')
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('builds tenant context when user and organization exist', async () => {
    const request = new NextRequest('http://localhost/api/secure')
    mockVerifyAuthToken.mockResolvedValueOnce({ uid: 'user-1', email: 'test@example.com' })
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      role: UserRole.ADMIN,
      organization: {
        id: 'org-1',
        ownerId: 'user-1',
        name: 'Test Org',
        slug: 'test-org',
        settings: {},
      },
    })

    const context = await tenantModule.getTenantContext(request)

    expect(context).toEqual({
      user: { uid: 'user-1', email: 'test@example.com' },
      organization: expect.objectContaining({ id: 'org-1' }),
      userRole: UserRole.ADMIN,
      isOwner: true,
    })
  })

  it('withTenant enforces organization requirement', async () => {
    mockVerifyAuthToken.mockResolvedValueOnce({ uid: 'user-2', email: 'member@example.com' })
    mockPrisma.user.findUnique.mockResolvedValueOnce({ role: UserRole.MEMBER, organization: null })

    const handler = jest.fn(async () => NextResponse.json({ ok: true }))
    const wrapped = tenantModule.withTenant(handler, { requireOrganization: true })

    const response = await wrapped(new NextRequest('http://localhost/api/secure'))

    expect(response.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('addTenantFilter injects organization id', () => {
    const filter = tenantModule.addTenantFilter({
      user: { uid: 'user-1', email: 'user@example.com' },
      organization: { id: 'org-123' },
      userRole: UserRole.MEMBER,
      isOwner: false,
    } as any, { status: 'active' })

    expect(filter).toEqual({ status: 'active', organizationId: 'org-123' })
  })

  it('addTenantData attaches organization and user ids', () => {
    const data = tenantModule.addTenantData({
      user: { uid: 'user-1', email: 'user@example.com' },
      organization: { id: 'org-123' },
      userRole: UserRole.MEMBER,
      isOwner: false,
    } as any, { name: 'resource' })

    expect(data).toEqual({ name: 'resource', organizationId: 'org-123', userId: 'user-1' })
  })

  it('canAccessResource checks repository membership', async () => {
    const context = {
      user: { uid: 'user-1', email: 'test@example.com' },
      organization: { id: 'org-1' },
      userRole: UserRole.ADMIN,
      isOwner: true,
    } as any

    mockPrisma.repositoryAnalysis.findFirst.mockResolvedValueOnce({ id: 'analysis-1' })

    const canAccess = await tenantModule.canAccessResource(context, 'analysis', 'analysis-1')

    expect(canAccess).toBe(true)
    expect(mockPrisma.repositoryAnalysis.findFirst).toHaveBeenCalledWith({
      where: { id: 'analysis-1', organizationId: 'org-1' },
    })
  })

  it('getOrganizationUsage aggregates usage metrics', async () => {
    mockPrisma.repositoryAnalysis.count.mockResolvedValueOnce(5)
    mockPrisma.creditTransaction.aggregate.mockResolvedValueOnce({ _sum: { amount: -123 } })
    mockPrisma.user.count.mockResolvedValueOnce(3)

    const usage = await tenantModule.getOrganizationUsage('org-99', 'month')

    expect(usage).toEqual({
      analysisCount: 5,
      creditUsage: 123,
      activeMembers: 3,
    })
  })
})
