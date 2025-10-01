import { NextRequest } from 'next/server'
import { authMiddleware, verifyToken, extractTokenFromRequest } from '../auth-middleware'
import { mockApiResponse, mockApiError } from '../test-helpers/test-utils'

// Mock Firebase Admin
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}))

describe('Auth Middleware', () => {
  const mockVerifyIdToken = require('firebase-admin/auth').getAuth().verifyIdToken

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('extractTokenFromRequest', () => {
    it('should extract token from Authorization header', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': 'Bearer valid-token-123',
        },
      })

      const token = extractTokenFromRequest(request)
      expect(token).toBe('valid-token-123')
    })

    it('should extract token from cookie', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Cookie': 'auth-token=cookie-token-456; other=value',
        },
      })

      const token = extractTokenFromRequest(request)
      expect(token).toBe('cookie-token-456')
    })

    it('should return null when no token is found', () => {
      const request = new NextRequest('http://localhost:3000/api/test')
      const token = extractTokenFromRequest(request)
      expect(token).toBeNull()
    })

    it('should prioritize Authorization header over cookie', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': 'Bearer header-token',
          'Cookie': 'auth-token=cookie-token',
        },
      })

      const token = extractTokenFromRequest(request)
      expect(token).toBe('header-token')
    })
  })

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const mockDecodedToken = {
        uid: 'user-123',
        email: 'test@example.com',
        email_verified: true,
      }

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)

      const result = await verifyToken('valid-token')
      expect(result).toEqual(mockDecodedToken)
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token')
    })

    it('should throw error for invalid token', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

      await expect(verifyToken('invalid-token')).rejects.toThrow('Invalid token')
    })

    it('should throw error for expired token', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Token expired'))

      await expect(verifyToken('expired-token')).rejects.toThrow('Token expired')
    })
  })

  describe('authMiddleware', () => {
    const mockHandler = jest.fn()

    beforeEach(() => {
      mockHandler.mockClear()
    })

    it('should allow authenticated requests', async () => {
      const mockDecodedToken = {
        uid: 'user-123',
        email: 'test@example.com',
        email_verified: true,
      }

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)
      mockHandler.mockResolvedValue(mockApiResponse({ success: true }))

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      })

      const wrappedHandler = authMiddleware(mockHandler)
      const response = await wrappedHandler(request)

      expect(mockHandler).toHaveBeenCalledWith(request, { user: mockDecodedToken })
      expect(response.status).toBe(200)
    })

    it('should reject requests without token', async () => {
      const request = new NextRequest('http://localhost:3000/api/test')
      const wrappedHandler = authMiddleware(mockHandler)
      const response = await wrappedHandler(request)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(401)
      
      const body = await response.json()
      expect(body.error).toContain('Authentication required')
    })

    it('should reject requests with invalid token', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      })

      const wrappedHandler = authMiddleware(mockHandler)
      const response = await wrappedHandler(request)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(401)
      
      const body = await response.json()
      expect(body.error).toContain('Invalid token')
    })

    it('should handle middleware errors gracefully', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Firebase service unavailable'))

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      })

      const wrappedHandler = authMiddleware(mockHandler)
      const response = await wrappedHandler(request)

      expect(response.status).toBe(500)
      
      const body = await response.json()
      expect(body.error).toContain('Authentication service unavailable')
    })

    it('should pass through handler errors', async () => {
      const mockDecodedToken = {
        uid: 'user-123',
        email: 'test@example.com',
        email_verified: true,
      }

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)
      mockHandler.mockRejectedValue(new Error('Handler error'))

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      })

      const wrappedHandler = authMiddleware(mockHandler)
      
      await expect(wrappedHandler(request)).rejects.toThrow('Handler error')
    })

    it('should handle optional authentication', async () => {
      const request = new NextRequest('http://localhost:3000/api/test')
      const wrappedHandler = authMiddleware(mockHandler, { optional: true })
      
      mockHandler.mockResolvedValue(mockApiResponse({ success: true }))
      
      const response = await wrappedHandler(request)

      expect(mockHandler).toHaveBeenCalledWith(request, { user: null })
      expect(response.status).toBe(200)
    })

    it('should validate required roles', async () => {
      const mockDecodedToken = {
        uid: 'user-123',
        email: 'test@example.com',
        email_verified: true,
        role: 'member',
      }

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      })

      const wrappedHandler = authMiddleware(mockHandler, { 
        requiredRoles: ['admin'] 
      })
      
      const response = await wrappedHandler(request)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(403)
      
      const body = await response.json()
      expect(body.error).toContain('Insufficient permissions')
    })

    it('should allow access with correct role', async () => {
      const mockDecodedToken = {
        uid: 'user-123',
        email: 'test@example.com',
        email_verified: true,
        role: 'admin',
      }

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken)
      mockHandler.mockResolvedValue(mockApiResponse({ success: true }))

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      })

      const wrappedHandler = authMiddleware(mockHandler, { 
        requiredRoles: ['admin', 'member'] 
      })
      
      const response = await wrappedHandler(request)

      expect(mockHandler).toHaveBeenCalledWith(request, { user: mockDecodedToken })
      expect(response.status).toBe(200)
    })
  })
})