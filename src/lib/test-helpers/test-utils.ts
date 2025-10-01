import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

// Mock data generators
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  organizationId: 'org-123',
  role: 'member' as const,
  creditBalance: 100,
  createdAt: new Date('2024-01-01'),
  lastLoginAt: new Date('2024-01-01'),
}

export const mockOrganization = {
  id: 'org-123',
  name: 'Test Organization',
  slug: 'test-org',
  ownerId: 'user-123',
  createdAt: new Date('2024-01-01'),
  settings: {
    aiProvider: {
      provider: 'OPENAI' as const,
      apiKey: 'test-key',
      model: 'gpt-4',
    },
    pricingConfig: {
      freeCredits: 10,
      creditCostPerAnalysis: { base: 1, perFile: 0.1, perKB: 0.01 },
    },
  },
}

export const mockRepositoryAnalysis = {
  id: 'analysis-123',
  userId: 'user-123',
  organizationId: 'org-123',
  repositoryUrl: 'https://github.com/test/repo',
  repositoryName: 'test-repo',
  analysisDate: new Date('2024-01-01'),
  status: 'COMPLETED' as const,
  creditsCost: 10,
  results: {
    complianceScore: 85,
    recommendations: [
      {
        category: 'Accessibility',
        severity: 'medium' as const,
        title: 'Add alt text to images',
        description: 'Images should have descriptive alt text',
        files: ['src/components/image.tsx'],
      },
    ],
    baselineMatches: [
      {
        feature: 'CSS Grid',
        status: 'baseline' as const,
        usage: ['src/styles/layout.css'],
      },
    ],
    issues: [
      {
        category: 'Performance',
        severity: 'high' as const,
        title: 'Large bundle size',
        description: 'Bundle size exceeds recommended limits',
        files: ['dist/main.js'],
      },
    ],
  },
  metadata: {
    repositorySize: 1024000,
    fileCount: 50,
    processingTime: 30000,
    aiProvider: 'openai',
  },
}

export const mockBaselineData = {
  id: 'baseline-123',
  feature: 'CSS Grid',
  category: 'Layout',
  status: 'baseline' as const,
  description: 'CSS Grid Layout provides a two-dimensional layout system',
  documentation: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout',
  browserSupport: {
    chrome: '57',
    firefox: '52',
    safari: '10.1',
    edge: '16',
  },
  lastUpdated: new Date('2024-01-01'),
  embedding: new Array(1536).fill(0.1),
}

export const mockCreditTransaction = {
  id: 'transaction-123',
  userId: 'user-123',
  type: 'PURCHASE' as const,
  amount: 100,
  description: 'Credit purchase - Starter Pack',
  createdAt: new Date('2024-01-01'),
  metadata: {
    packageId: 'starter',
    paymentMethod: 'stripe',
  },
}

// API response mocks
export const mockApiResponse = <T>(data: T, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
  blob: async () => new Blob([JSON.stringify(data)]),
})

export const mockApiError = (message: string, status = 500) => ({
  ok: false,
  status,
  json: async () => ({ error: message }),
  text: async () => JSON.stringify({ error: message }),
})

// Test wrapper components
export const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid="test-wrapper">{children}</div>
}

// Custom render function
export const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: TestWrapper, ...options })

// Async test helpers
export const waitForApiCall = (mockFetch: jest.MockedFunction<typeof fetch>) => {
  return new Promise(resolve => {
    const checkCalls = () => {
      if (mockFetch.mock.calls.length > 0) {
        resolve(mockFetch.mock.calls)
      } else {
        setTimeout(checkCalls, 10)
      }
    }
    checkCalls()
  })
}

export const mockFetchSequence = (responses: any[]) => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
  responses.forEach(response => {
    mockFetch.mockResolvedValueOnce(response as Response)
  })
  return mockFetch
}

// Form test helpers
export const fillForm = (form: HTMLFormElement, data: Record<string, string>) => {
  Object.entries(data).forEach(([name, value]) => {
    const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement
    if (input) {
      input.value = value
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
}

// Error boundary test helper
export const TestErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  try {
    return <>{children}</>
  } catch (error) {
    return <div data-testid="error-boundary">Error: {String(error)}</div>
  }
}

// Performance test helpers
export const measureRenderTime = (renderFn: () => void) => {
  const start = performance.now()
  renderFn()
  const end = performance.now()
  return end - start
}

// Database test helpers
export const createMockPrismaClient = () => ({
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
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn(),
})

export * from '@testing-library/react'
export { customRender as render }