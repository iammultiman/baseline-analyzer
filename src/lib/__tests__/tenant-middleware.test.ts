import { NextRequest } from 'next/server'
import { 
  tenantMiddleware, 
  extractTenantFromRequest, 
  validateTenantAccess,
  getTenantFromUser 
} from '../tenant-middleware'
import { mockUser, mockOrganization, createMockPrismaClient } from '../test-helpers/test-utils'

// Mock Prisma
const mockPrisma = createMockPrismaClient()
jest.mock('../database', () => ({
  prisma: mockPrisma,
}))

describe('Tenant Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('extractTenantFromRequest', () => {
    it('should extract tenant from header', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'X-Tenant-ID': 'org-123',
        },
      })

      const tenantId = extractTenantFromRequest(request)
      expect(tenantId).toBe('org-123')
    })

    it('should extract tenant from query parameter', () => {
      const request = new NextRequest('http://localhost:3000/api/test?organizationId=org-456')
      const tenantId = extractTenantFromRequest(request)
      expect(tenantId).toBe('org-456')
    })

    it('should extract tenant from URL path', () => {
      const request = new NextRequest('http://localhost:3000/api/organizations/org-789/members')
      const tenantId = extractTenantFromRequest(request)
      expect(tenantId).toBe('org-789')
    })

    it('should return null when no tenant is found', () => {
      const request = new NextRequest('http://localhost:3000/api/test')
      const tenantId = extractTenantFromRequest(request)
      expect(tenantId).toBeNull()
    })

    it('should prioritize header over query parameter', () => {
      const request = new NextRequest('http://localhost:3000/api/test?organizationId=org-query', {
        headers: {
          'X-Tenant-ID': 'org-header',
        },
      })

      const tenantId = extractTenantFromRequest(request)
      expect(tenantId).toBe('org-header')
    })
  })

  describe('getTenantFromUser', () => {
    it('should return user organization ID', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        organizationId: 'org-123',
      })

      const tenantId = await getTenantFromUser('user-123')
      expect(tenantId).toBe('org-123')
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { organizationId: true },
      })
    })

    it('should return null for user without organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        organizationId: null,
      })

      const tenantId = await getTenantFromUser('user-123')
      expect(tenantId).toBeNull()
    })

    it('should return null for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const tenantId = await getTenantFromUser('non-existent')
      expect(tenantId).toBeNull()
    })
  })

  describe('validateTenantAccess', () => {
    it('should validate user access to organization', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(mockOrganization)

      const hasAccess = await validateTenantAccess('user-123', 'org-123')
      expect(hasAccess).toBe(true)
      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'org-123',
          OR: [
            { ownerId: 'user-123' },
            { members: { some: { userId: 'user-123' } } },
          ],
        },
      })
    })

    it('should deny access for unauthorized user', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null)

      const hasAccess = await validateTenantAccess('user-456', 'org-123')
      expect(hasAccess).toBe(false)
    })

    it('should handle database errors', async () => {
      mockPrisma.organization.findFirst.mockRejectedValue(new Error('Database error'))

      const hasAccess = await validateTenantAccess('user-123', 'org-123')
      expect(hasAccess).toBe(false)
    })
  })

  describe('tenantMiddleware', () => {
    const mockHandler = jest.fn()

    beforeEach(() => {
      mockHandler.mockClear()
    })

    it('should allow access with valid tenant', async () => {
      const user = { uid: 'user-123', email: 'test@example.com' }
      mockPrisma.organization.findFirst.mockResolvedValue(mockOrganization)
      mockHandler.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'X-Tenant-ID': 'org-123',
        },
      })

      const wrappedHandler = tenantMiddleware(mockHandler)
      const response = await wrappedHandler(request, { user })

      expect(mockHandler).toHaveBeenCalledWith(request, { 
        user, 
        tenant: { id: 'org-123', organization: mockOrganization } 
      })
      expect(response.status).toBe(200)
    })

    it('should deny access with invalid tenant', async () => {
      const user = { uid: 'user-123', email: 'test@example.com' }
      mockPrisma.organization.findFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'X-Tenant-ID': 'org-unauthorized',
        },
      })

      const wrappedHandler = tenantMiddleware(mockHandler)
      const response = await wrappedHandler(request, { user })

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(403)
      
      const body = await response.json()
      expect(body.error).toContain('Access denied')
    })

    it('should use user default organization when no tenant specified', async () => {
      const user = { uid: 'user-123', email: 'test@example.com' }
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        organizationId: 'org-default',
      })
      mockPrisma.organization.findFirst.mockResolvedValue({
        ...mockOrganization,
        id: 'org-default',
      })
      mockHandler.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      const request = new NextRequest('http://localhost:3000/api/test')

      const wrappedHandler = tenantMiddleware(mockHandler)
      const response = await wrappedHandler(request, { user })

      expect(mockHandler).toHaveBeenCalledWith(request, { 
        user, 
        tenant: { 
          id: 'org-default', 
          organization: expect.objectContaining({ id: 'org-default' }) 
        } 
      })
    })

    it('should handle requests without tenant requirement', async () => {
      const user = { uid: 'user-123', email: 'test@example.com' }
      mockHandler.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      const request = new NextRequest('http://localhost:3000/api/test')

      const wrappedHandler = tenantMiddleware(mockHandler, { required: false })
      const response = await wrappedHandler(request, { user })

      expect(mockHandler).toHaveBeenCalledWith(request, { 
        user, 
        tenant: null 
      })
      expect(response.status).toBe(200)
    })

    it('should require tenant when specified', async () => {
      const user = { uid: 'user-123', email: 'test@example.com' }
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        organizationId: null,
      })

      const request = new NextRequest('http://localhost:3000/api/test')

      const wrappedHandler = tenantMiddleware(mockHandler, { required: true })
      const response = await wrappedHandler(request, { user })

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(400)
      
      const body = await response.json()
      expect(body.error).toContain('Organization context required')
    })

    it('should validate tenant permissions', async () => {
      const user = { uid: 'user-123', email: 'test@example.com' }
      mockPrisma.organization.findFirst.mockResolvedValue({
        ...mockOrganization,
        ownerId: 'different-user',
      })

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'X-Tenant-ID': 'org-123',
        },
      })

      const wrappedHandler = tenantMiddleware(mockHandler, { 
        requiredPermissions: ['admin'] 
      })
      const response = await wrappedHandler(request, { user })

      expect(response.status).toBe(403)
    })

    it('should allow owner access regardless of permissions', async () => {
      const user = { uid: 'user-123', email: 'test@example.com' }
      mockPrisma.organization.findFirst.mockResolvedValue({
        ...mockOrganization,
        ownerId: 'user-123',
      })
      mockHandler.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'X-Tenant-ID': 'org-123',
        },
      })

      const wrappedHandler = tenantMiddleware(mockHandler, { 
        requiredPermissions: ['admin'] 
      })
      const response = await wrappedHandler(request, { user })

      expect(mockHandler).toHaveBeenCalled()
      expect(response.status).toBe(200)
    })
  })
})