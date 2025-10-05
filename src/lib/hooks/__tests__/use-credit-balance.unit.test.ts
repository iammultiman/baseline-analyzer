import { renderHook, act, waitFor } from '@testing-library/react'
import { useCreditBalance } from '../use-credit-balance'
import { mockApiResponse } from '@/lib/test-helpers/test-utils'

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>

beforeAll(() => {
  ;(global as any).fetch = mockFetch
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useCreditBalance hook', () => {
  it('loads balance on mount and exposes state helpers', async () => {
    mockFetch.mockResolvedValueOnce(mockApiResponse({ balance: 250 }, 200) as unknown as Response)

    const { result } = renderHook(() => useCreditBalance())

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(result.current.balance).toBe(250)
    })

    expect(result.current.balance).toBe(250)
    expect(result.current.error).toBeNull()

    mockFetch.mockResolvedValueOnce(mockApiResponse({ balance: 275 }, 200) as unknown as Response)

    let refreshedBalance: number | undefined
    await act(async () => {
      refreshedBalance = await result.current.refreshBalance()
    })

    expect(refreshedBalance).toBe(275)
    expect(result.current.balance).toBe(275)
  })

  it('stores error messages when refresh fails and clearError resets them', async () => {
    mockFetch.mockResolvedValueOnce(mockApiResponse({ error: 'Server unavailable' }, 500) as unknown as Response)

    const { result } = renderHook(() => useCreditBalance())

    await waitFor(() => {
      expect(result.current.error).toBe('Server unavailable')
    })

    act(() => {
      result.current.clearError()
    })

    expect(result.current.error).toBeNull()
  })

  it('retrieves transaction history with parsed dates', async () => {
    mockFetch
      .mockResolvedValueOnce(mockApiResponse({ balance: 0 }, 200) as unknown as Response)
      .mockResolvedValueOnce(
        mockApiResponse(
          {
            transactions: [
              { id: 'tx-1', amount: -10, createdAt: '2025-01-01T00:00:00.000Z' },
            ],
          },
          200
        ) as unknown as Response
      )

    const { result } = renderHook(() => useCreditBalance())

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(result.current.balance).toBe(0)
    })

    let history: Awaited<ReturnType<typeof result.current.getTransactionHistory>>
    await act(async () => {
      history = await result.current.getTransactionHistory(1, 10)
    })

  expect(result.current.transactions[0].createdAt).toBeInstanceOf(Date)
  expect(history!.transactions[0].createdAt).toBe('2025-01-01T00:00:00.000Z')
  expect(result.current.transactions).toHaveLength(1)
  })
})
