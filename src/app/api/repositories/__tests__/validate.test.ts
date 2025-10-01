import { POST } from '../validate/route'
import { NextRequest } from 'next/server'
import { RepositoryProcessor } from '@/lib/services/repository-processor'

// Mock the RepositoryProcessor
jest.mock('@/lib/services/repository-processor')

describe('/api/repositories/validate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should validate a valid repository URL', async () => {
    const mockValidation = {
      isValid: true,
      repositoryInfo: {
        url: 'https://github.com/user/repo',
        name: 'repo',
        owner: 'user',
        branch: 'main',
        isPrivate: false
      }
    }

    ;(RepositoryProcessor.validateRepository as jest.Mock).mockResolvedValue(mockValidation)

    const request = new NextRequest('http://localhost/api/repositories/validate', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://github.com/user/repo' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockValidation)
    expect(RepositoryProcessor.validateRepository).toHaveBeenCalledWith('https://github.com/user/repo')
  })

  it('should return validation error for invalid repository', async () => {
    const mockValidation = {
      isValid: false,
      error: 'Repository not found'
    }

    ;(RepositoryProcessor.validateRepository as jest.Mock).mockResolvedValue(mockValidation)

    const request = new NextRequest('http://localhost/api/repositories/validate', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://github.com/user/nonexistent' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.isValid).toBe(false)
    expect(data.data.error).toBe('Repository not found')
  })

  it('should return 400 for invalid request body', async () => {
    const request = new NextRequest('http://localhost/api/repositories/validate', {
      method: 'POST',
      body: JSON.stringify({ invalidField: 'value' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Invalid request data')
    expect(data.details).toBeDefined()
  })

  it('should return 400 for invalid URL format', async () => {
    const request = new NextRequest('http://localhost/api/repositories/validate', {
      method: 'POST',
      body: JSON.stringify({ url: 'not-a-url' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Invalid request data')
  })

  it('should handle processor errors gracefully', async () => {
    ;(RepositoryProcessor.validateRepository as jest.Mock).mockRejectedValue(
      new Error('Network error')
    )

    const request = new NextRequest('http://localhost/api/repositories/validate', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://github.com/user/repo' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Internal server error')
  })

  it('should handle malformed JSON', async () => {
    const request = new NextRequest('http://localhost/api/repositories/validate', {
      method: 'POST',
      body: 'invalid json'
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Internal server error')
  })
})