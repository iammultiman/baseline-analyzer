import { renderHook, act, waitFor } from '@testing-library/react'
import { useRepositoryAnalysis } from '../use-repository-analysis'
import { mockApiResponse, mockApiError, mockRepositoryAnalysis } from '../../test-helpers/test-utils'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('useRepositoryAnalysis', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('should submit repository for analysis', async () => {
    const mockSubmitResponse = {
      analysisId: 'analysis-123',
      status: 'PENDING',
      estimatedCredits: 10,
    }

    mockFetch.mockResolvedValue(mockApiResponse(mockSubmitResponse))

    const { result } = renderHook(() => useRepositoryAnalysis())

    expect(result.current.isSubmitting).toBe(false)

    const submitPromise = act(async () => {
      return result.current.submitAnalysis({
        repositoryUrl: 'https://github.com/test/repo',
        analysisType: 'full',
      })
    })

    expect(result.current.isSubmitting).toBe(true)

    const response = await submitPromise

    expect(result.current.isSubmitting).toBe(false)
    expect(response).toEqual(mockSubmitResponse)
    expect(mockFetch).toHaveBeenCalledWith('/api/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repositoryUrl: 'https://github.com/test/repo',
        analysisType: 'full',
      }),
    })
  })

  it('should handle submission errors', async () => {
    mockFetch.mockResolvedValue(mockApiError('Invalid repository URL', 400))

    const { result } = renderHook(() => useRepositoryAnalysis())

    await act(async () => {
      try {
        await result.current.submitAnalysis({
          repositoryUrl: 'invalid-url',
          analysisType: 'full',
        })
      } catch (error) {
        expect(error).toEqual(expect.objectContaining({
          message: 'Invalid repository URL',
        }))
      }
    })

    expect(result.current.isSubmitting).toBe(false)
  })

  it('should fetch analysis status', async () => {
    const mockStatus = {
      id: 'analysis-123',
      status: 'PROCESSING',
      progress: 50,
      estimatedTimeRemaining: 30000,
    }

    mockFetch.mockResolvedValue(mockApiResponse(mockStatus))

    const { result } = renderHook(() => useRepositoryAnalysis())

    const status = await act(async () => {
      return result.current.getAnalysisStatus('analysis-123')
    })

    expect(status).toEqual(mockStatus)
    expect(mockFetch).toHaveBeenCalledWith('/api/analysis/analysis-123/status')
  })

  it('should fetch analysis results', async () => {
    mockFetch.mockResolvedValue(mockApiResponse(mockRepositoryAnalysis))

    const { result } = renderHook(() => useRepositoryAnalysis())

    const analysis = await act(async () => {
      return result.current.getAnalysisResult('analysis-123')
    })

    expect(analysis).toEqual(mockRepositoryAnalysis)
    expect(mockFetch).toHaveBeenCalledWith('/api/analysis/analysis-123')
  })

  it('should fetch user analysis history', async () => {
    const mockHistory = {
      analyses: [mockRepositoryAnalysis],
      totalCount: 1,
      hasMore: false,
    }

    mockFetch.mockResolvedValue(mockApiResponse(mockHistory))

    const { result } = renderHook(() => useRepositoryAnalysis())

    expect(result.current.isLoadingHistory).toBe(false)

    await act(async () => {
      await result.current.fetchHistory()
    })

    expect(result.current.history).toEqual([mockRepositoryAnalysis])
    expect(result.current.totalCount).toBe(1)
    expect(result.current.hasMore).toBe(false)
    expect(result.current.isLoadingHistory).toBe(false)
  })

  it('should load more history items', async () => {
    const initialHistory = {
      analyses: [{ ...mockRepositoryAnalysis, id: 'analysis-1' }],
      totalCount: 2,
      hasMore: true,
    }

    const additionalHistory = {
      analyses: [{ ...mockRepositoryAnalysis, id: 'analysis-2' }],
      totalCount: 2,
      hasMore: false,
    }

    mockFetch
      .mockResolvedValueOnce(mockApiResponse(initialHistory))
      .mockResolvedValueOnce(mockApiResponse(additionalHistory))

    const { result } = renderHook(() => useRepositoryAnalysis())

    // Fetch initial history
    await act(async () => {
      await result.current.fetchHistory()
    })

    expect(result.current.history).toHaveLength(1)
    expect(result.current.hasMore).toBe(true)

    // Load more
    await act(async () => {
      await result.current.loadMore()
    })

    expect(result.current.history).toHaveLength(2)
    expect(result.current.hasMore).toBe(false)
    expect(mockFetch).toHaveBeenCalledWith('/api/analysis?offset=1&limit=10')
  })

  it('should delete analysis', async () => {
    mockFetch.mockResolvedValue(mockApiResponse({ success: true }))

    const { result } = renderHook(() => useRepositoryAnalysis())

    // Set up initial history
    act(() => {
      result.current.history = [mockRepositoryAnalysis]
    })

    await act(async () => {
      await result.current.deleteAnalysis('analysis-123')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/analysis/analysis-123', {
      method: 'DELETE',
    })
    expect(result.current.history).toHaveLength(0)
  })

  it('should estimate analysis cost', async () => {
    const mockEstimate = {
      estimatedCredits: 15,
      breakdown: {
        baseCredits: 5,
        fileCredits: 8,
        sizeCredits: 2,
      },
      repositoryStats: {
        fileCount: 80,
        totalSize: 2048000,
        complexity: 'medium',
      },
    }

    mockFetch.mockResolvedValue(mockApiResponse(mockEstimate))

    const { result } = renderHook(() => useRepositoryAnalysis())

    const estimate = await act(async () => {
      return result.current.estimateCost('https://github.com/test/repo')
    })

    expect(estimate).toEqual(mockEstimate)
    expect(mockFetch).toHaveBeenCalledWith('/api/analysis/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repositoryUrl: 'https://github.com/test/repo',
      }),
    })
  })

  it('should handle polling for analysis completion', async () => {
    const pendingStatus = { status: 'PROCESSING', progress: 50 }
    const completedStatus = { status: 'COMPLETED', progress: 100 }

    mockFetch
      .mockResolvedValueOnce(mockApiResponse(pendingStatus))
      .mockResolvedValueOnce(mockApiResponse(completedStatus))

    jest.useFakeTimers()

    const { result } = renderHook(() => useRepositoryAnalysis())

    const pollPromise = act(async () => {
      return result.current.pollAnalysisStatus('analysis-123', {
        interval: 1000,
        maxAttempts: 5,
      })
    })

    // First poll
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    // Advance timer to trigger second poll
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    const finalStatus = await pollPromise

    expect(finalStatus.status).toBe('COMPLETED')
    expect(mockFetch).toHaveBeenCalledTimes(2)

    jest.useRealTimers()
  })

  it('should stop polling on max attempts', async () => {
    const pendingStatus = { status: 'PROCESSING', progress: 50 }
    mockFetch.mockResolvedValue(mockApiResponse(pendingStatus))

    jest.useFakeTimers()

    const { result } = renderHook(() => useRepositoryAnalysis())

    const pollPromise = act(async () => {
      return result.current.pollAnalysisStatus('analysis-123', {
        interval: 1000,
        maxAttempts: 2,
      })
    })

    // Advance timers to exceed max attempts
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    await expect(pollPromise).rejects.toThrow('Polling timeout')

    jest.useRealTimers()
  })

  it('should filter history by status', async () => {
    const mockHistory = {
      analyses: [
        { ...mockRepositoryAnalysis, id: 'analysis-1', status: 'COMPLETED' },
        { ...mockRepositoryAnalysis, id: 'analysis-2', status: 'FAILED' },
        { ...mockRepositoryAnalysis, id: 'analysis-3', status: 'COMPLETED' },
      ],
      totalCount: 3,
      hasMore: false,
    }

    mockFetch.mockResolvedValue(mockApiResponse(mockHistory))

    const { result } = renderHook(() => useRepositoryAnalysis())

    await act(async () => {
      await result.current.fetchHistory({ status: 'COMPLETED' })
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/analysis?status=COMPLETED&offset=0&limit=10')
  })

  it('should search history by repository name', async () => {
    const mockHistory = {
      analyses: [mockRepositoryAnalysis],
      totalCount: 1,
      hasMore: false,
    }

    mockFetch.mockResolvedValue(mockApiResponse(mockHistory))

    const { result } = renderHook(() => useRepositoryAnalysis())

    await act(async () => {
      await result.current.fetchHistory({ search: 'test-repo' })
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/analysis?search=test-repo&offset=0&limit=10')
  })
})