import { POST } from '../process/route'
import { NextRequest } from 'next/server'
import { RepositoryProcessor } from '@/lib/services/repository-processor'
import { verifyAuthToken } from '@/lib/auth-middleware'

// Mock dependencies
jest.mock('@/lib/services/repository-processor')
jest.mock('@/lib/auth-middleware')

describe('/api/repositories/process', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should start repository processing for authenticated user', async () => {
    const mockAuthResult = {
      success: true,
      user: {
        uid: 'user123',
        organizationId: 'org456'
      }
    }

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

    ;(verifyAuthToken as jest.Mock).mockResolvedValue(mockAuthResult)
    ;(RepositoryProcessor.validateRepository as jest.Mock).mockResolvedValue(mockValidation)
    ;(RepositoryProcessor.processRepository as jest.Mock).mockResolvedValue('job123')

    const request = new NextRequest('http://localhost/api/repositories/process', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ url: 'https://github.com/user/repo' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.jobId).toBe('job123')
    expect(data.data.message).toBe('Repository processing started')
    
    expect(RepositoryProcessor.validateRepository).toHaveBeenCalledWith('https://github.com/user/repo')
    expect(RepositoryProcessor.processRepository).toHaveBeenCalledWith(
      'https://github.com/user/repo',
      'user123',
      'org456'
    )
  })

  it('should use user ID as organization ID when no organization', async () => {
    const mockAuthResult = {
      success: true,
      user: {
        uid: 'user123',
        organizationId: null
      }
    }

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

    ;(verifyAuthToken as jest.Mock).mockResolvedValue(mockAuthResult)
    ;(RepositoryProcessor.validateRepository as jest.Mock).mockResolvedValue(mockValidation)
    ;(RepositoryProcessor.processRepository as jest.Mock).mockResolvedValue('job123')

    const request = new NextRequest('http://localhost/api/repositories/process', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ url: 'https://github.com/user/repo' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(RepositoryProcessor.processRepository).toHaveBeenCalledWith(
      'https://github.com/user/repo',
      'user123',
      'user123' // Should use user ID as org ID
    )
  })

  it('should return 401 for unauthenticated request', async () => {
    ;(verifyAuthToken as jest.Mock).mockResolvedValue({
      success: false,
      user: null
    })

    const request = new NextRequest('http://localhost/api/repositories/process', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://github.com/user/repo' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 400 for invalid repository', async () => {
    const mockAuthResult = {
      success: true,
      user: {
        uid: 'user123',
        organizationId: 'org456'
      }
    }

    const mockValidation = {
      isValid: false,
      error: 'Repository not found'
    }

    ;(verifyAuthToken as jest.Mock).mockResolvedValue(mockAuthResult)
    ;(RepositoryProcessor.validateRepository as jest.Mock).mockResolvedValue(mockValidation)

    const request = new NextRequest('http://localhost/api/repositories/process', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ url: 'https://github.com/user/nonexistent' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Repository not found')
    expect(RepositoryProcessor.processRepository).not.toHaveBeenCalled()
  })

  it('should return 400 for invalid request body', async () => {
    const mockAuthResult = {
      success: true,
      user: {
        uid: 'user123',
        organizationId: 'org456'
      }
    }

    ;(verifyAuthToken as jest.Mock).mockResolvedValue(mockAuthResult)

    const request = new NextRequest('http://localhost/api/repositories/process', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ invalidField: 'value' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Invalid request data')
  })

  it('should handle processing errors gracefully', async () => {
    const mockAuthResult = {
      success: true,
      user: {
        uid: 'user123',
        organizationId: 'org456'
      }
    }

    ;(verifyAuthToken as jest.Mock).mockResolvedValue(mockAuthResult)
    ;(RepositoryProcessor.validateRepository as jest.Mock).mockRejectedValue(
      new Error('Network error')
    )

    const request = new NextRequest('http://localhost/api/repositories/process', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ url: 'https://github.com/user/repo' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Internal server error')
  })
})