import { CreditService } from '../credit-service'
import { prisma } from '@/lib/database'
import { TransactionType } from '@prisma/client'

jest.mock('@/lib/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    creditTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

describe('CreditService unit tests', () => {
  const mockPrisma = prisma as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calculates analysis cost with default pricing', () => {
    const cost = CreditService.calculateAnalysisCost({
      repositorySize: 500,
      fileCount: 40,
      complexity: 6,
    })

    // Base 1 + files 4 + size 5 = 10, multiplier 1.5 => 15 -> ceil 15
    expect(cost).toBe(15)
  })

  it('returns true when user has enough credits', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ creditBalance: 120 })

    const result = await CreditService.hasSufficientCredits('user-1', 100)

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { creditBalance: true },
    })
    expect(result).toBe(true)
  })

  it('deducts credits and logs transaction on success', async () => {
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
      return callback({
        user: {
          findUnique: jest.fn().mockResolvedValue({ creditBalance: 200 }),
          update: jest.fn().mockResolvedValue({ creditBalance: 150 }),
        },
        creditTransaction: {
          create: jest.fn().mockResolvedValue({ id: 'tx-1' }),
        },
      })
    })

    const result = await CreditService.deductCredits('user-1', 50, 'analysis deduction')

    expect(result).toEqual({ success: true, newBalance: 150 })
  })

  it('returns failure when deduction throws error', async () => {
    ;(mockPrisma.$transaction as jest.Mock).mockRejectedValueOnce(new Error('Insufficient credits'))
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ creditBalance: 25 })

    const result = await CreditService.deductCredits('user-1', 50, 'analysis deduction')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Insufficient credits')
    expect(result.newBalance).toBe(25)
  })

  it('processes credit purchase via addCredits', async () => {
    const addCreditsSpy = jest.spyOn(CreditService, 'addCredits').mockResolvedValue({
      success: true,
      newBalance: 300,
    }) as any

    const payload = await CreditService.processCreditPurchase('user-123', 'starter', { paymentIntent: 'pi_123' })

    expect(addCreditsSpy).toHaveBeenCalledWith(
      'user-123',
      expect.any(Number),
      TransactionType.PURCHASE,
      expect.stringContaining('Starter Pack'),
      expect.objectContaining({ paymentIntent: 'pi_123' })
    )
    expect(payload).toEqual({ success: true, newBalance: 300 })

    addCreditsSpy.mockRestore()
  })

  it('throws when credit package is invalid', async () => {
    await expect(
      CreditService.processCreditPurchase('user-1', 'unknown', {})
    ).rejects.toThrow('Invalid package ID')
  })
})
