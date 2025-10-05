import { NextRequest, NextResponse } from 'next/server'

const mockVerifyIdToken = jest.fn()

jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: mockVerifyIdToken,
  }),
}))

const initializeApp = jest.fn()
const getApps = jest.fn(() => [])
const cert = jest.fn((config: any) => config)

jest.mock('firebase-admin/app', () => ({
  initializeApp,
  getApps,
  cert,
}))

describe('auth middleware utilities', () => {
  let authModule: typeof import('../auth-middleware')

  beforeAll(() => {
    process.env.FIREBASE_PROJECT_ID = 'test-project'
    process.env.FIREBASE_CLIENT_EMAIL = 'client@test'
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----'
    authModule = require('../auth-middleware')
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockVerifyIdToken.mockReset()
  })

  it('verifies bearer tokens and returns user info', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer valid-token' },
    })

    mockVerifyIdToken.mockResolvedValue({ uid: 'user-1', email: 'test@example.com' })

    const user = await authModule.verifyAuthToken(request)

    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token')
    expect(user).toEqual({ uid: 'user-1', email: 'test@example.com' })
  })

  it('returns null when no token present', async () => {
    const request = new NextRequest('http://localhost/api/test')

    const user = await authModule.verifyAuthToken(request)
    expect(user).toBeNull()
  })

  it('withAuth rejects unauthenticated requests', async () => {
    mockVerifyIdToken.mockImplementation(async () => {
      throw new Error('invalid')
    })
    const handler = jest.fn(async () => NextResponse.json({ ok: true }))
    const wrapped = authModule.withAuth(handler)

    const response = await wrapped(new NextRequest('http://localhost/api/test'))

    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('withAuth passes verified user to handler', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer good' },
    })
    mockVerifyIdToken.mockResolvedValue({ uid: 'abc', email: 'abc@example.com' })

    const wrapped = authModule.withAuth(async (req, user) => {
      expect(user).toEqual({ uid: 'abc', email: 'abc@example.com' })
      return NextResponse.json({ ok: true })
    })

    const response = await wrapped(request)
    expect(response.status).toBe(200)
    expect(mockVerifyIdToken).toHaveBeenCalledWith('good')
  })

  it('authMiddleware returns structured success payload', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer ok' },
    })
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-4', email: 'user@example.com' })

    const result = await authModule.authMiddleware(request)

    expect(result).toEqual({
      success: true,
      user: { id: 'user-4', email: 'user@example.com' },
    })
    expect(mockVerifyIdToken).toHaveBeenCalledWith('ok')
  })

  it('authMiddleware returns error when verification fails', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer bad' },
    })
    mockVerifyIdToken.mockImplementation(async () => {
      throw new Error('invalid')
    })

    const result = await authModule.authMiddleware(request)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unauthorized')
    expect(result.status).toBe(401)
  })
})
