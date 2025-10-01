import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CreditService } from '../credit-service';
import { prisma } from '@/lib/database';
import { TransactionType } from '@prisma/client';

// Mock the database
jest.mock('@/lib/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    creditTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('CreditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return user credit balance', async () => {
      const userId = 'test-user-id';
      const expectedBalance = 100;

      mockPrisma.user.findUnique.mockResolvedValue({
        creditBalance: expectedBalance,
      } as any);

      const balance = await CreditService.getBalance(userId);

      expect(balance).toBe(expectedBalance);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { creditBalance: true },
      });
    });

    it('should return 0 if user not found', async () => {
      const userId = 'non-existent-user';

      mockPrisma.user.findUnique.mockResolvedValue(null);

      const balance = await CreditService.getBalance(userId);

      expect(balance).toBe(0);
    });
  });

  describe('hasSufficientCredits', () => {
    it('should return true if user has sufficient credits', async () => {
      const userId = 'test-user-id';
      const requiredCredits = 50;

      mockPrisma.user.findUnique.mockResolvedValue({
        creditBalance: 100,
      } as any);

      const result = await CreditService.hasSufficientCredits(userId, requiredCredits);

      expect(result).toBe(true);
    });

    it('should return false if user has insufficient credits', async () => {
      const userId = 'test-user-id';
      const requiredCredits = 150;

      mockPrisma.user.findUnique.mockResolvedValue({
        creditBalance: 100,
      } as any);

      const result = await CreditService.hasSufficientCredits(userId, requiredCredits);

      expect(result).toBe(false);
    });
  });

  describe('calculateAnalysisCost', () => {
    it('should calculate cost correctly with default config', () => {
      const params = {
        repositorySize: 1000, // 1000 KB
        fileCount: 50,
        complexity: 5,
      };

      const cost = CreditService.calculateAnalysisCost(params);

      // Base (1) + files (50 * 0.1 = 5) + size (1000 * 0.01 = 10) = 16
      // Complexity multiplier: 1 + (5-1) * 0.1 = 1.4
      // Total: 16 * 1.4 = 22.4, rounded up to 23
      expect(cost).toBe(23);
    });

    it('should handle minimum complexity', () => {
      const params = {
        repositorySize: 100,
        fileCount: 10,
        complexity: 1,
      };

      const cost = CreditService.calculateAnalysisCost(params);

      // Base (1) + files (10 * 0.1 = 1) + size (100 * 0.01 = 1) = 3
      // Complexity multiplier: 1 + (1-1) * 0.1 = 1
      // Total: 3 * 1 = 3
      expect(cost).toBe(3);
    });

    it('should handle maximum complexity', () => {
      const params = {
        repositorySize: 100,
        fileCount: 10,
        complexity: 10,
      };

      const cost = CreditService.calculateAnalysisCost(params);

      // Base (1) + files (10 * 0.1 = 1) + size (100 * 0.01 = 1) = 3
      // Complexity multiplier: 1 + (10-1) * 0.1 = 1.9
      // Total: 3 * 1.9 = 5.7, rounded up to 6
      expect(cost).toBe(6);
    });
  });

  describe('deductCredits', () => {
    it('should successfully deduct credits', async () => {
      const userId = 'test-user-id';
      const amount = 10;
      const description = 'Test deduction';

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          user: {
            findUnique: jest.fn().mockResolvedValue({ creditBalance: 100 }),
            update: jest.fn().mockResolvedValue({ creditBalance: 90 }),
          },
          creditTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
        } as any);
      });

      const result = await CreditService.deductCredits(userId, amount, description);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(90);
    });

    it('should fail if insufficient credits', async () => {
      const userId = 'test-user-id';
      const amount = 150;
      const description = 'Test deduction';

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          user: {
            findUnique: jest.fn().mockResolvedValue({ creditBalance: 100 }),
          },
        } as any);
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        creditBalance: 100,
      } as any);

      const result = await CreditService.deductCredits(userId, amount, description);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient credits');
    });
  });

  describe('addCredits', () => {
    it('should successfully add credits', async () => {
      const userId = 'test-user-id';
      const amount = 50;
      const type = TransactionType.PURCHASE;
      const description = 'Test purchase';

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          user: {
            update: jest.fn().mockResolvedValue({ creditBalance: 150 }),
          },
          creditTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
        } as any);
      });

      const result = await CreditService.addCredits(userId, amount, type, description);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(150);
    });
  });

  describe('getCreditPackages', () => {
    it('should return default packages', () => {
      const packages = CreditService.getCreditPackages();

      expect(packages).toHaveLength(3);
      expect(packages[0]).toEqual({
        id: 'starter',
        name: 'Starter Pack',
        credits: 100,
        price: 999,
        description: '100 credits for small projects',
      });
    });
  });
});