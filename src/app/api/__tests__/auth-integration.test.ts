import { NextRequest } from 'next/server'
import { POST as registerHandler } from '../auth/register/route'
import { GET as meHandler } from '../auth/me/route'
import { createMockPrismaClient, mockUser } from '../../../lib/test-helpers/test-utils'

// Mock Prisma
const mockPrisma = createMockPrismaClient()
jest.mock('../../../lib/database', () => ({
  prisma: mockPrisma,
}))

// Mock Firebase Admin
const mockVerifyIdToken = jest.fn()
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}))

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}))

describe('Auth API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockDecodedToken = {
        uid: 'firebase-uid-123',
        email: 'test@example.com',
        email_verified: true,
      }

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)
      mockPrisma.user.findUnique.mockResolvedValue(null) // User doesn't exist
      mockPrisma.user.create.mockResolvedValue({
        ...mockUser,
        id: 'user-123',
        email: 'test@example.com',
      })

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({
          displayName: 'Test User',
          acceptTerms: true,
        }),
      })

      const response = await registerHandler(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.user.email).toBe('test@example.com')
      expect(data.user.displayName).toBe('Test User')
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          id: 'firebase-uid-123',
          email: 'test@example.com',
          displayName: 'Test User',
          emailVerified: true,
          creditBalance: 10, // Free credits
        },
      })
    })

    it('should return error if user already exists', async () => {
      const mockDecodedToken = {
        uid: 'firebase-uid-123',
        email: 'test@example.com',
        email_verified: true,
      }

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)
      mockPrisma.user.findUnique.mockResolvedValue(mockUser) // User exists

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({
          displayName: 'Test User',
          acceptTerms: true,
        }),
      })

      const response = await registerHandler(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toContain('already exists')
    })

    it('should validate required fields', async () => {
      const mockDecodedToken = {
        uid: 'firebase-uid-123',
        email: 'test@example.com',
        email_verified: true,
      }

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({
          // Missing displayName and acceptTerms
        }),
      })

      const response = await registerHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('validation')
    })

    it('should require email verification', async () => {
      const mockDecodedToken = {
        uid: 'firebase-uid-123',
        email: 'test@example.com',
        email_verified: false, // Not verified
      }

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({
          displayName: 'Test User',
          acceptTerms: true,
        }),
      })

      const response = await registerHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('email verification')
    })

    it('should handle database errors', async () => {
      const mockDecodedToken = {
        uid: 'firebase-uid-123',
        email: 'test@example.com',
        email_verified: true,
      }

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({
          displayName: 'Test User',
          acceptTerms: true,
        }),
      })

      const response = await registerHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('registration failed')
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return current user information', async () => {
      const mockDecodedToken = {
        uid: 'user-123',
        email: 'test@example.com',
        email_verified: true,
      }

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        organization: {
          id: 'org-123',
          name: 'Test Organization',
          slug: 'test-org',
        },
      })

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      })

      const response = await meHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.user.id).toBe('user-123')
      expect(data.user.email).toBe('test@example.com')
      expect(data.user.organization.name).toBe('Test Organization')
    })

    it('should return 401 for unauthenticated requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/me')

      const response = await meHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('Authentication required')
    })

    it('should return 404 for non-existent user', async () => {
      const mockDecodedToken = {
        uid: 'non-existent-user',
        email: 'test@example.com',
        email_verified: true,
      }

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      })

      const response = await meHandler(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('User not found')
    })

    it('should handle database errors gracefully', async () => {
      const mockDecodedToken = {
        uid: 'user-123',
        email: 'test@example.com',
        email_verified: true,
      }

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      })

      const response = await meHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Internal server error')
    })
  })

  describe('Authentication Flow Integration', () => {
    it('should complete full registration and login flow', async () => {
      const mockDecodedToken = {
        uid: 'firebase-uid-123',
        email: 'newuser@example.com',
        email_verified: true,
      }

      // Step 1: Register new user
      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        ...mockUser,
        id: 'firebase-uid-123',
        email: 'newuser@example.com',
        displayName: 'New User',
      })

      const registerRequest = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({
          displayName: 'New User',
          acceptTerms: true,
        }),
      })

      const registerResponse = await registerHandler(registerRequest)
      expect(registerResponse.status).toBe(201)

      // Step 2: Get user info
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: 'firebase-uid-123',
        email: 'newuser@example.com',
        displayName: 'New User',
      })

      const meRequest = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      })

      const meResponse = await meHandler(meRequest)
      const userData = await meResponse.json()

      expect(meResponse.status).toBe(200)
      expect(userData.user.email).toBe('newuser@example.com')
      expect(userData.user.displayName).toBe('New User')
    })
  })
})