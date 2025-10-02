import '@testing-library/jest-dom'

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-jest-testing-environment'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.SENDGRID_API_KEY = 'test-sendgrid-key'
process.env.SENDGRID_FROM_EMAIL = 'test@example.com'
process.env.SENDGRID_FROM_NAME = 'Test App'
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
process.env.FIREBASE_PROJECT_ID = 'test-project'
process.env.FIREBASE_CLIENT_EMAIL = 'test@test-project.iam.gserviceaccount.com'
process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\nxIuOAiNQM4+ur5yMjVBqiDdVaM3/VwxbNq37HrfTmhTeRBfWW91xtEtIsmHk9WXL\nUgYkXYP7XZ9j8yd+t6Li2Oyreqlt5Br2AlBo3W7cglRxjTXXXAGBx+sBwIDAQAB\nAoIBABagpxpM1aoLWfvDKHcWxnDddfHBjGphziHkePiMRNuGQN2+3hRwMGJMYlgJ\nOtcXoXxJmxqwhwiU2ckj7158d6fTjuUd9grL6VwcLGRxHstfn5NjjQoaq30cINhw\nwsW3omTRRCWRkfloD3XKVu+2uP71upe9mkihC4M9vqEkUKBWlcTU3hHRoJMHRxDx\nAoGBANjANRKLBtcxmW4foK5ILTuFkuaHgjf661r2r4F3dDdK7xQcTkOhqTGp1lnV\nfqN8cwdwsOp8ck8fX6aTAoGBANWGQDKhPiVZsjbxeXI4y1riX3GJqiNXSyObz+rR\nCIc7KEAXyq9vHWvQBromhCtfwgMH01QcCpz7HnazyvqVAoGBAKfFGI4aEOqW8A+W\n3gNBxqhPiluqFSqABU6pgBYCoGAzrETgjBbqWkx5rQtNObDyGjiBQRzzX1UcMsP9\nk8Smq0wHdnRTnEbRlJ2aR7xd6sMxOGPfyoai80xHaJMhTI5gx4YdCRFBukrxkd6z\nePBHCAFOK4nPEjFMxqCulkxBjEspAoGBAKLlm0oVsVlkPiuRyMPUESlhXpwgOcaL\nwbLLspHEduUkJBFHuigJHusHuSPjVQCXt2mdo7n6wz7dFNXenNTKEe3j5nikitkx\nAoGAQHKyFYuaJwn+CyBgtClDEIMkP4qQxQ2JMfrugsgnfLpXFUrMmPn5nAXAx3IB\nli6uFpbsMoLTTK6Ni79M7jSYOiMg+qrW2xHtPX+o/ufzPpS6bnZBrfzfVZ2Smk0Y\n-----END PRIVATE KEY-----'

// Mock Next.js Request and Response
global.Request = global.Request || class MockRequest {
  constructor(url, options = {}) {
    this.url = url
    this.method = options.method || 'GET'
    this.headers = new Map(Object.entries(options.headers || {}))
    this.body = options.body
  }
  
  async json() {
    return JSON.parse(this.body || '{}')
  }
  
  async text() {
    return this.body || ''
  }
}

global.Response = global.Response || class MockResponse {
  constructor(body, options = {}) {
    this.body = body
    this.status = options.status || 200
    this.headers = new Map(Object.entries(options.headers || {}))
  }
  
  async json() {
    return JSON.parse(this.body || '{}')
  }
  
  async text() {
    return this.body || ''
  }
  
  static json(data, options = {}) {
    return new MockResponse(JSON.stringify(data), {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    })
  }
}

// Mock TextEncoder/TextDecoder for Node.js compatibility
global.TextEncoder = global.TextEncoder || require('util').TextEncoder
global.TextDecoder = global.TextDecoder || require('util').TextDecoder

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
}))

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
    onAuthStateChanged: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
  })),
  GoogleAuthProvider: jest.fn(),
  signInWithPopup: jest.fn(),
}))

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
}))

// Mock Firebase Admin
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  cert: jest.fn(() => ({})),
}))

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'test-uid',
      email: 'test@example.com',
    }),
  })),
}))

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Next.js server
jest.mock('next/server', () => ({
  NextRequest: global.Request,
  NextResponse: {
    json: (data, options = {}) => {
      const response = new global.Response(JSON.stringify(data), {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers }
      })
      return response
    },
    next: () => new global.Response('', { status: 200 }),
    redirect: (url, status = 302) => new global.Response('', { status, headers: { Location: url } }),
  },
}))

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    repositoryAnalysis: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    creditTransaction: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    baselineData: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    invitation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  })),
  // Export Prisma enums for tests
  UserRole: {
    ADMIN: 'ADMIN',
    MEMBER: 'MEMBER',
  },
  TransactionType: {
    PURCHASE: 'PURCHASE',
    DEDUCTION: 'DEDUCTION',
    BONUS: 'BONUS',
    REFUND: 'REFUND',
  },
  AnalysisStatus: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  },
  InvitationStatus: {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    EXPIRED: 'EXPIRED',
  },
}))

// Global test utilities
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url')
global.URL.revokeObjectURL = jest.fn()

// Mock fetch if not already mocked
if (!global.fetch) {
  global.fetch = jest.fn()
}

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }))
})

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}))

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}