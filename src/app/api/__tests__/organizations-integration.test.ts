import { NextRequest } from 'next/server'
import { GET as getOrganizations, POST as createOrganization } from '../organizations/route'
import { GET as getOrganization, PUT as updateOrganization, DELETE as deleteOrganization } from '../organizations/[id]/route'
import { createMockPrismaClient, mockUser, mockOrganization } from '../../../lib/test-helpers/test-utils'

// Mock Prisma
const mockPrisma = createMockPrismaClient()
jest.mock('../../../lib/database', () => ({
  prisma: mockPrisma,
}))

// Mock auth middleware
const mockAuthContext = {
  user: { uid: 'user-123', email: 'test@example.com' }
}

jest.mock('../../../lib/auth-middleware', () => ({
  authMiddleware: (handler: any) => (req: any) => handler(req, mockAuthContext),
}))

describe('Organizations API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/organizations', () => {
    it('should return user organizations', async () => {
      const mockOrganizations = [
        { ...mockOrganization, id: 'org-1', name: 'Organization 1' },
        { ...mockOrganization, id: 'org-2', name: 'Organization 2' },
      ]

      mockPrisma.organization.findMany.mockResolvedValue(mockOrganizations)

      const request = new NextRequest('http://localhost:3000/api/organizations')
      const response = await getOrganizations(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.organizations).toHaveLength(2)
      expect(data.organizations[0].name).toBe('Organization 1')
      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { ownerId: 'user-123' },
            { members: { some: { userId: 'user-123' } } },
          ],
        },
        include: {
          members: {
            include: { user: { select: { id: true, email: true, displayName: true } } },
          },
          _count: { select: { members: true } },
        },
      })
    })

    it('should return empty array when user has no organizations', async () => {
      mockPrisma.organization.findMany.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/organizations')
      const response = await getOrganizations(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.organizations).toHaveLength(0)
    })

    it('should handle database errors', async () => {
      mockPrisma.organization.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/organizations')
      const response = await getOrganizations(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to fetch organizations')
    })
  })

  describe('POST /api/organizations', () => {
    it('should create a new organization', async () => {
      const newOrganization = {
        ...mockOrganization,
        id: 'new-org-123',
        name: 'New Organization',
        slug: 'new-organization',
      }

      mockPrisma.organization.findUnique.mockResolvedValue(null) // Slug available
      mockPrisma.organization.create.mockResolvedValue(newOrganization)

      const request = new NextRequest('http://localhost:3000/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Organization',
          slug: 'new-organization',
        }),
      })

      const response = await createOrganization(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.organization.name).toBe('New Organization')
      expect(data.organization.slug).toBe('new-organization')
      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: {
          name: 'New Organization',
          slug: 'new-organization',
          ownerId: 'user-123',
          settings: {},
        },
        include: {
          members: {
            include: { user: { select: { id: true, email: true, displayName: true } } },
          },
          _count: { select: { members: true } },
        },
      })
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing name and slug
        }),
      })

      const response = await createOrganization(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('validation')
    })

    it('should prevent duplicate slugs', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization) // Slug exists

      const request = new NextRequest('http://localhost:3000/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Organization',
          slug: 'existing-slug',
        }),
      })

      const response = await createOrganization(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toContain('already exists')
    })

    it('should auto-generate slug from name if not provided', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null)
      mockPrisma.organization.create.mockResolvedValue({
        ...mockOrganization,
        name: 'Auto Slug Organization',
        slug: 'auto-slug-organization',
      })

      const request = new NextRequest('http://localhost:3000/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Auto Slug Organization',
        }),
      })

      const response = await createOrganization(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.organization.slug).toBe('auto-slug-organization')
    })
  })

  describe('GET /api/organizations/[id]', () => {
    it('should return organization details', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({
        ...mockOrganization,
        members: [
          {
            id: 'member-1',
            userId: 'user-123',
            role: 'OWNER',
            user: { id: 'user-123', email: 'owner@example.com', displayName: 'Owner' },
          },
        ],
      })

      const request = new NextRequest('http://localhost:3000/api/organizations/org-123')
      const response = await getOrganization(request, { params: { id: 'org-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.organization.id).toBe('org-123')
      expect(data.organization.members).toHaveLength(1)
    })

    it('should return 404 for non-existent organization', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/organizations/non-existent')
      const response = await getOrganization(request, { params: { id: 'non-existent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('Organization not found')
    })

    it('should return 403 for unauthorized access', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null) // No access

      const request = new NextRequest('http://localhost:3000/api/organizations/unauthorized')
      const response = await getOrganization(request, { params: { id: 'unauthorized' } })
      const data = await response.json()

      expect(response.status).toBe(404) // Returns 404 to prevent information disclosure
      expect(data.error).toContain('Organization not found')
    })
  })

  describe('PUT /api/organizations/[id]', () => {
    it('should update organization as owner', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({
        ...mockOrganization,
        ownerId: 'user-123', // User is owner
      })

      mockPrisma.organization.update.mockResolvedValue({
        ...mockOrganization,
        name: 'Updated Organization',
      })

      const request = new NextRequest('http://localhost:3000/api/organizations/org-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Organization',
        }),
      })

      const response = await updateOrganization(request, { params: { id: 'org-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.organization.name).toBe('Updated Organization')
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: { name: 'Updated Organization' },
        include: {
          members: {
            include: { user: { select: { id: true, email: true, displayName: true } } },
          },
          _count: { select: { members: true } },
        },
      })
    })

    it('should prevent non-owners from updating organization', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({
        ...mockOrganization,
        ownerId: 'different-user', // User is not owner
      })

      const request = new NextRequest('http://localhost:3000/api/organizations/org-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Organization',
        }),
      })

      const response = await updateOrganization(request, { params: { id: 'org-123' } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Only organization owners')
    })

    it('should validate update data', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({
        ...mockOrganization,
        ownerId: 'user-123',
      })

      const request = new NextRequest('http://localhost:3000/api/organizations/org-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '', // Invalid empty name
        }),
      })

      const response = await updateOrganization(request, { params: { id: 'org-123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('validation')
    })
  })

  describe('DELETE /api/organizations/[id]', () => {
    it('should delete organization as owner', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({
        ...mockOrganization,
        ownerId: 'user-123',
      })

      mockPrisma.organization.delete.mockResolvedValue(mockOrganization)

      const request = new NextRequest('http://localhost:3000/api/organizations/org-123', {
        method: 'DELETE',
      })

      const response = await deleteOrganization(request, { params: { id: 'org-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockPrisma.organization.delete).toHaveBeenCalledWith({
        where: { id: 'org-123' },
      })
    })

    it('should prevent non-owners from deleting organization', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({
        ...mockOrganization,
        ownerId: 'different-user',
      })

      const request = new NextRequest('http://localhost:3000/api/organizations/org-123', {
        method: 'DELETE',
      })

      const response = await deleteOrganization(request, { params: { id: 'org-123' } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Only organization owners')
    })

    it('should handle deletion of organization with members', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({
        ...mockOrganization,
        ownerId: 'user-123',
        _count: { members: 5 },
      })

      mockPrisma.organization.delete.mockRejectedValue(
        new Error('Cannot delete organization with members')
      )

      const request = new NextRequest('http://localhost:3000/api/organizations/org-123', {
        method: 'DELETE',
      })

      const response = await deleteOrganization(request, { params: { id: 'org-123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Cannot delete organization with active members')
    })
  })
})