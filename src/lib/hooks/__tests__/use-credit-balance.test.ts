import { renderHook, act, waitFor } from '@testing-library/react'
import { useCreditBalance } from '../use-credit-balance'
import { mockApiResponse, mockApiError } from '../../test-helpers/test-utils'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('useCreditBalance', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('should fetch and return credit balance', async () => {
    const mockBalance = {
      balance: 150,
      stats: {
        totalCreditsUsed: 50,
        analysisCount: 5,
        averageCreditsPerAnalysis: 10,
        period: 'Last 30 days',
      },
    }

    mockFetch.mockResolvedValue(mockApiResponse(mockBalance))

    const { result } = renderHook(() => useCreditBalance())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.balance).toBeNull()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.balance).toBe(150)
    expect(result.current.stats).toEqual(mockBalance.stats)
    expect(result.current.error).toBeNull()
  })

  it('should handle API errors', async () => {
    mockFetch.mockResolvedValue(mockApiError('Failed to fetch balance', 500))

    const { result } = renderHook(() => useCreditBalance())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.balance).toBeNull()
    expect(result.current.error).toBe('Failed to fetch balance')
  })

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useCreditBalance())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.balance).toBeNull()
    expect(result.current.error).toBe('Network error')
  })

  it('should refresh balance when requested', async () => {
    const initialBalance = { balance: 100 }
    const updatedBalance = { balance: 150 }

    mockFetch
      .mockResolvedValueOnce(mockApiResponse(initialBalance))
      .mockResolvedValueOnce(mockApiResponse(updatedBalance))

    const { result } = renderHook(() => useCreditBalance())

    await waitFor(() => {
      expect(result.current.balance).toBe(100)
    })

    await act(async () => {
      await result.current.refreshBalance()
    })

    expect(result.current.balance).toBe(150)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should detect low balance', async () => {
    const mockBalance = { balance: 5 }
    mockFetch.mockResolvedValue(mockApiResponse(mockBalance))

    const { result } = renderHook(() => useCreditBalance({ lowBalanceThreshold: 10 }))

    await waitFor(() => {
      expect(result.current.balance).toBe(5)
    })

    expect(result.current.isLowBalance).toBe(true)
  })

  it('should not detect low balance when above threshold', async () => {
    const mockBalance = { balance: 50 }
    mockFetch.mockResolvedValue(mockApiResponse(mockBalance))

    const { result } = renderHook(() => useCreditBalance({ lowBalanceThreshold: 10 }))

    await waitFor(() => {
      expect(result.current.balance).toBe(50)
    })

    expect(result.current.isLowBalance).toBe(false)
  })

  it('should use custom polling interval', async () => {
    const mockBalance = { balance: 100 }
    mockFetch.mockResolvedValue(mockApiResponse(mockBalance))

    jest.useFakeTimers()

    const { result } = renderHook(() => 
      useCreditBalance({ pollingInterval: 5000 })
    )

    await waitFor(() => {
      expect(result.current.balance).toBe(100)
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Fast forward 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000)
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    jest.useRealTimers()
  })

  it('should stop polling when component unmounts', async () => {
    const mockBalance = { balance: 100 }
    mockFetch.mockResolvedValue(mockApiResponse(mockBalance))

    jest.useFakeTimers()

    const { result, unmount } = renderHook(() => 
      useCreditBalance({ pollingInterval: 1000 })
    )

    await waitFor(() => {
      expect(result.current.balance).toBe(100)
    })

    unmount()

    // Fast forward time - should not make additional calls
    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)

    jest.useRealTimers()
  })

  it('should handle concurrent refresh calls', async () => {
    const mockBalance = { balance: 100 }
    mockFetch.mockResolvedValue(mockApiResponse(mockBalance))

    const { result } = renderHook(() => useCreditBalance())

    await waitFor(() => {
      expect(result.current.balance).toBe(100)
    })

    // Make multiple concurrent refresh calls
    const promises = [
      result.current.refreshBalance(),
      result.current.refreshBalance(),
      result.current.refreshBalance(),
    ]

    await act(async () => {
      await Promise.all(promises)
    })

    // Should only make one additional API call due to deduplication
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should calculate balance status correctly', async () => {
    const testCases = [
      { balance: 0, expected: 'empty' },
      { balance: 5, expected: 'low' },
      { balance: 25, expected: 'medium' },
      { balance: 100, expected: 'high' },
    ]

    for (const testCase of testCases) {
      mockFetch.mockResolvedValue(mockApiResponse({ balance: testCase.balance }))

      const { result } = renderHook(() => useCreditBalance())

      await waitFor(() => {
        expect(result.current.balance).toBe(testCase.balance)
      })

      expect(result.current.balanceStatus).toBe(testCase.expected)

      mockFetch.mockClear()
    }
  })

  it('should provide usage predictions', async () => {
    const mockBalance = {
      balance: 100,
      stats: {
        totalCreditsUsed: 50,
        analysisCount: 5,
        averageCreditsPerAnalysis: 10,
        period: 'Last 30 days',
      },
    }

    mockFetch.mockResolvedValue(mockApiResponse(mockBalance))

    const { result } = renderHook(() => useCreditBalance())

    await waitFor(() => {
      expect(result.current.balance).toBe(100)
    })

    expect(result.current.estimatedDaysRemaining).toBeGreaterThan(0)
    expect(result.current.recommendedTopUp).toBeGreaterThan(0)
  })
})