import { AnalysisErrorHandler } from '../analysis-error-handler'
import { prisma } from '@/lib/database'

jest.mock('@/lib/database', () => ({
  prisma: {
    repositoryAnalysis: {
      update: jest.fn(),
    },
  },
}))

describe('AnalysisErrorHandler', () => {
  const mockUpdate = prisma.repositoryAnalysis.update as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('maps repository not found errors correctly', () => {
    const error = AnalysisErrorHandler.handleError(new Error('repository not found'))

    expect(error.code).toBe('REPO_NOT_FOUND')
    expect(error.retryable).toBe(false)
    expect(error.userMessage).toContain('repository')
  })

  it('marks AI provider errors as retryable', () => {
    const error = AnalysisErrorHandler.handleError(new Error('AI provider timeout'))

    expect(error.code).toBe('PROCESSING_TIMEOUT')
    expect(AnalysisErrorHandler.isRetryable(error)).toBe(true)
  })

  it('falls back to unknown error with details', () => {
    const rawError = new Error('completely unexpected boom')
    const error = AnalysisErrorHandler.handleError(rawError)

    expect(error.code).toBe('UNKNOWN_ERROR')
    expect(error.details).toContain('boom')
    expect(AnalysisErrorHandler.getUserMessage(rawError)).toContain('unexpected')
  })

  it('creates error responses with appropriate status codes', async () => {
    const response = AnalysisErrorHandler.createErrorResponse({
      code: 'INSUFFICIENT_CREDITS',
      message: 'Insufficient credits for analysis',
      retryable: false,
      userMessage: 'Add credits',
    })

    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload).toEqual({
      error: 'Add credits',
      code: 'INSUFFICIENT_CREDITS',
      retryable: false,
      details: undefined,
    })
  })

  it('updates analysis records with error metadata', async () => {
    const error = AnalysisErrorHandler.handleError(new Error('database timeout'))

    await AnalysisErrorHandler.updateAnalysisWithError('analysis-123', error, 'pricing')

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'analysis-123' },
      data: expect.objectContaining({
        status: 'FAILED',
        metadata: expect.objectContaining({
          error: error.message,
          errorCode: error.code,
          failedStage: 'pricing',
        }),
      }),
    })
  })

  it('logs errors without throwing when update fails', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('write failure'))
    const error = AnalysisErrorHandler.handleError(new Error('timeout occurred'))

    await expect(
      AnalysisErrorHandler.updateAnalysisWithError('analysis-456', error)
    ).resolves.toBeUndefined()
  })
})
