import { 
  handleAnalysisError, 
  getErrorMessage, 
  isRetryableError, 
  getRetryDelay 
} from '../analysis-error-handler'

describe('Analysis Error Handler', () => {
  describe('handleAnalysisError', () => {
    it('should handle network errors', () => {
      const error = new Error('Network error')
      error.name = 'NetworkError'
      
      const result = handleAnalysisError(error)
      
      expect(result.type).toBe('network')
      expect(result.message).toContain('network')
      expect(result.retryable).toBe(true)
    })

    it('should handle authentication errors', () => {
      const error = new Error('Unauthorized')
      error.name = 'AuthenticationError'
      
      const result = handleAnalysisError(error)
      
      expect(result.type).toBe('authentication')
      expect(result.message).toContain('authentication')
      expect(result.retryable).toBe(false)
    })

    it('should handle rate limit errors', () => {
      const error = new Error('Rate limit exceeded')
      error.name = 'RateLimitError'
      
      const result = handleAnalysisError(error)
      
      expect(result.type).toBe('rate_limit')
      expect(result.message).toContain('rate limit')
      expect(result.retryable).toBe(true)
      expect(result.retryAfter).toBeGreaterThan(0)
    })

    it('should handle insufficient credits errors', () => {
      const error = new Error('Insufficient credits')
      error.name = 'InsufficientCreditsError'
      
      const result = handleAnalysisError(error)
      
      expect(result.type).toBe('insufficient_credits')
      expect(result.message).toContain('credits')
      expect(result.retryable).toBe(false)
    })

    it('should handle repository access errors', () => {
      const error = new Error('Repository not found')
      error.name = 'RepositoryAccessError'
      
      const result = handleAnalysisError(error)
      
      expect(result.type).toBe('repository_access')
      expect(result.message).toContain('repository')
      expect(result.retryable).toBe(false)
    })

    it('should handle AI provider errors', () => {
      const error = new Error('AI service unavailable')
      error.name = 'AIProviderError'
      
      const result = handleAnalysisError(error)
      
      expect(result.type).toBe('ai_provider')
      expect(result.message).toContain('AI service')
      expect(result.retryable).toBe(true)
    })

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error')
      
      const result = handleAnalysisError(error)
      
      expect(result.type).toBe('unknown')
      expect(result.message).toContain('unexpected error')
      expect(result.retryable).toBe(false)
    })

    it('should include error context when provided', () => {
      const error = new Error('Test error')
      const context = {
        repositoryUrl: 'https://github.com/test/repo',
        userId: 'user-123',
        analysisId: 'analysis-456'
      }
      
      const result = handleAnalysisError(error, context)
      
      expect(result.context).toEqual(context)
    })
  })

  describe('getErrorMessage', () => {
    it('should return user-friendly messages for known error types', () => {
      expect(getErrorMessage('network')).toContain('connection')
      expect(getErrorMessage('authentication')).toContain('authentication')
      expect(getErrorMessage('rate_limit')).toContain('rate limit')
      expect(getErrorMessage('insufficient_credits')).toContain('credits')
      expect(getErrorMessage('repository_access')).toContain('repository')
      expect(getErrorMessage('ai_provider')).toContain('AI service')
    })

    it('should return generic message for unknown error types', () => {
      const message = getErrorMessage('unknown_type' as any)
      expect(message).toContain('unexpected error')
    })

    it('should include suggestions when available', () => {
      const message = getErrorMessage('network')
      expect(message).toContain('check your connection')
    })
  })

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      expect(isRetryableError('network')).toBe(true)
      expect(isRetryableError('rate_limit')).toBe(true)
      expect(isRetryableError('ai_provider')).toBe(true)
    })

    it('should identify non-retryable errors', () => {
      expect(isRetryableError('authentication')).toBe(false)
      expect(isRetryableError('insufficient_credits')).toBe(false)
      expect(isRetryableError('repository_access')).toBe(false)
      expect(isRetryableError('unknown')).toBe(false)
    })
  })

  describe('getRetryDelay', () => {
    it('should return appropriate delays for different error types', () => {
      expect(getRetryDelay('network', 1)).toBe(1000)
      expect(getRetryDelay('network', 2)).toBe(2000)
      expect(getRetryDelay('network', 3)).toBe(4000)
      
      expect(getRetryDelay('rate_limit', 1)).toBe(60000)
      expect(getRetryDelay('ai_provider', 1)).toBe(5000)
    })

    it('should cap maximum delay', () => {
      expect(getRetryDelay('network', 10)).toBeLessThanOrEqual(30000)
    })

    it('should return 0 for non-retryable errors', () => {
      expect(getRetryDelay('authentication', 1)).toBe(0)
      expect(getRetryDelay('insufficient_credits', 1)).toBe(0)
    })
  })
})