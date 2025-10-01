import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { AIProviderService } from '@/lib/services/ai-provider-service'
import { verifyAuth } from '@/lib/auth-middleware'
import { getTenantContext } from '@/lib/tenant-middleware'
import { AIProvider } from '@/lib/types/ai-provider'

// Mock dependencies
jest.mock('@/lib/services/ai-provider-service')
jest.mock('@/lib/auth-middleware')
jest.mock('@/lib/tenant-middleware')

describe('/api/admin/ai-providers', () => {
  const mockOrganizationId = 'org-123'
  const mockUserId = 'user-123'

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock successful auth by default
    ;(verifyAuth as jest.Mock).mockResolvedValue({
      success: true,
      user: { uid: mockUserId }
    })

    // Mock successful tenant context by default
    ;(getTenantContext as jest.Mock).mockResolvedValue({
      success: true,
      organizationId: mockOrganizationId,
      userRole: 'ADMIN'
    })
  })

  describe('GET', () => {
    it('should return AI provider configurations for admin user', async () => {
      const mockConfigs = [
        {
          id: 'config-1',
          organizationId: mockOrganizationId,
          provider: AIProvider.OPENAI,
          name: 'OpenAI Production',
          apiKey: 'sk-test123456',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o',
          isEnabled: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      ;(AIProviderService.getProviderConfigs as jest.Mock).mockResolvedValue(mockConfigs)

      const request = new NextRequest('http://localhost/api/admin/ai-providers')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.configs).toHaveLength(1)
      expect(data.configs[0].apiKey).toBe('***3456') // API key should be masked
      expect(AIProviderService.getProviderConfigs).toHaveBeenCalledWith(mockOrganizationId)
    })

    it('should return 401 for unauthenticated user', async () => {
      ;(verifyAuth as jest.Mock).mockResolvedValue({
        success: false,
        user: null
      })

      const request = new NextRequest('http://localhost/api/admin/ai-providers')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('should return 403 for non-admin user', async () => {
      ;(getTenantContext as jest.Mock).mockResolvedValue({
        success: true,
        organizationId: mockOrganizationId,
        userRole: 'MEMBER'
      })

      const request = new NextRequest('http://localhost/api/admin/ai-providers')
      const response = await GET(request)

      expect(response.status).toBe(403)
    })
  })

  describe('POST', () => {
    const validCreateInput = {
      provider: AIProvider.OPENAI,
      name: 'Test OpenAI',
      apiKey: 'sk-test123456'
    }

    it('should create AI provider configuration for admin user', async () => {
      const mockCreatedConfig = {
        id: 'config-123',
        organizationId: mockOrganizationId,
        ...validCreateInput,
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        isEnabled: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      ;(AIProviderService.validateProviderConfig as jest.Mock).mockReturnValue({
        valid: true,
        errors: []
      })
      ;(AIProviderService.createProviderConfig as jest.Mock).mockResolvedValue(mockCreatedConfig)

      const request = new NextRequest('http://localhost/api/admin/ai-providers', {
        method: 'POST',
        body: JSON.stringify(validCreateInput)
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.config.id).toBe('config-123')
      expect(data.config.apiKey).toBe('***3456') // API key should be masked
      expect(AIProviderService.createProviderConfig).toHaveBeenCalledWith({
        ...validCreateInput,
        organizationId: mockOrganizationId
      })
    })

    it('should return 400 for invalid input', async () => {
      ;(AIProviderService.validateProviderConfig as jest.Mock).mockReturnValue({
        valid: false,
        errors: ['Provider name is required', 'API key is required']
      })

      const request = new NextRequest('http://localhost/api/admin/ai-providers', {
        method: 'POST',
        body: JSON.stringify({
          provider: AIProvider.OPENAI,
          name: '',
          apiKey: ''
        })
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.details).toContain('Provider name is required')
    })
  })
})