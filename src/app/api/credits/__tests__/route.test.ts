import { describe, it, expect, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock the dependencies
jest.mock('@/lib/auth-middleware', () => ({
  __esModule: true,
  authMiddleware: jest.fn(),
}));

jest.mock('@/lib/tenant-middleware', () => ({
  __esModule: true,
  tenantMiddleware: jest.fn(),
}));

jest.mock('@/lib/services/credit-service', () => ({
  __esModule: true,
  CreditService: {
    getBalance: jest.fn(),
    getTransactionHistory: jest.fn(),
    getUsageStats: jest.fn(),
    checkUsageLimits: jest.fn(),
  },
}));

const { authMiddleware } = require('@/lib/auth-middleware');
const { tenantMiddleware } = require('@/lib/tenant-middleware');
const { CreditService } = require('@/lib/services/credit-service');
const { GET } = require('../route');

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;
const mockCreditService = CreditService as jest.Mocked<typeof CreditService>;

describe('/api/credits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return credit balance for authenticated user', async () => {
  const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      
      mockAuthMiddleware.mockResolvedValue({
        success: true,
        user: mockUser,
      });

      mockTenantMiddleware.mockResolvedValue({
        success: true,
      });

      mockCreditService.getBalance.mockResolvedValue(100);

      const request = new NextRequest('http://localhost:3000/api/credits');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.balance).toBe(100);
      expect(mockCreditService.getBalance).toHaveBeenCalledWith('test-user-id');
    });

    it('should return 401 for unauthenticated user', async () => {
      mockAuthMiddleware.mockResolvedValue({
        success: false,
        user: undefined,
      });

      const request = new NextRequest('http://localhost:3000/api/credits');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should include history when requested', async () => {
  const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      const mockHistory = [
        {
          id: '1',
          type: 'PURCHASE',
          amount: 100,
          description: 'Credit purchase',
          createdAt: new Date(),
        },
      ];

      mockAuthMiddleware.mockResolvedValue({
        success: true,
        user: mockUser,
      });

      mockTenantMiddleware.mockResolvedValue({
        success: true,
      });

      mockCreditService.getBalance.mockResolvedValue(100);
      mockCreditService.getTransactionHistory.mockResolvedValue(mockHistory as any);

      const request = new NextRequest('http://localhost:3000/api/credits?includeHistory=true');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.balance).toBe(100);
      expect(data.history).toEqual(
        mockHistory.map(entry => ({
          ...entry,
          createdAt: entry.createdAt.toISOString(),
        }))
      );
      expect(mockCreditService.getTransactionHistory).toHaveBeenCalledWith('test-user-id', 20, 0);
    });
  });
});