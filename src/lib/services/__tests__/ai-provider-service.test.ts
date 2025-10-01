import { AIProviderService } from '../ai-provider-service'
import { AIProvider, AIProviderCreateInput } from '@/lib/types/ai-provider'
import { prisma } from '@/lib/database'

// Mock Prisma
jest.mock('@/lib/database', () => ({
  prisma: {
    aIProviderConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  }
}))

// Mock fetch for API calls
global.fetch = jest.fn()

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('AIProviderService', () => {
  const mockOrganizationId = 'org-123'
  const mockConfigId = 'config-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getProviderConfigs', () => {
    it('should return all provider configurations for an organization', async () => {
      const mockConfigs = [
        {
          id: 'config-1',
          organizationId: mockOrganizationId,
          provider: 'OPENAI',
          name: 'OpenAI Production',
          apiKey: 'sk-test123',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o',
          maxTokens: 4096,
          temperature: 0.7,
          isEnabled: true,
          priority: 1,
          costPerToken: 0.03,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      mockPrisma.aIProviderConfig.findMany.mockResolvedValue(mockConfigs as any)

      const result = await AIProviderService.getProviderConfigs(mockOrganizationId)

      expect(mockPrisma.aIProviderConfig.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId },
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'asc' }
        ]
      })
      expect(result).toHaveLength(1)
      expect(result[0].provider).toBe(AIProvider.OPENAI)
    })
  })

  describe('validateProviderConfig', () => {
    it('should validate a valid configuration', () => {
      const input: AIProviderCreateInput = {
        organizationId: mockOrganizationId,
        provider: AIProvider.OPENAI,
        name: 'Test Provider',
        apiKey: 'sk-test123',
        maxTokens: 4096,
        temperature: 0.7,
        priority: 1
      }

      const result = AIProviderService.validateProviderConfig(input)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return errors for invalid configuration', () => {
      const input = {
        organizationId: mockOrganizationId,
        provider: 'INVALID' as AIProvider,
        name: '',
        apiKey: '',
        maxTokens: -1,
        temperature: 3,
        priority: 0
      }

      const result = AIProviderService.validateProviderConfig(input)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid AI provider')
      expect(result.errors).toContain('Provider name is required')
      expect(result.errors).toContain('API key is required')
      expect(result.errors).toContain('Max tokens must be between 1 and 200,000')
      expect(result.errors).toContain('Temperature must be between 0 and 2')
      expect(result.errors).toContain('Priority must be at least 1')
    })
  })

  describe('getProviderDefaults', () => {
    it('should return correct defaults for OpenAI', () => {
      const defaults = AIProviderService.getProviderDefaults(AIProvider.OPENAI)

      expect(defaults.baseUrl).toBe('https://api.openai.com/v1')
      expect(defaults.model).toBe('gpt-4o')
      expect(defaults.capabilities.maxTokens).toBe(128000)
      expect(defaults.capabilities.supportsStreaming).toBe(true)
    })

    it('should return correct defaults for Gemini', () => {
      const defaults = AIProviderService.getProviderDefaults(AIProvider.GEMINI)

      expect(defaults.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta')
      expect(defaults.model).toBe('gemini-1.5-pro')
      expect(defaults.capabilities.maxTokens).toBe(2097152)
    })
  })
})