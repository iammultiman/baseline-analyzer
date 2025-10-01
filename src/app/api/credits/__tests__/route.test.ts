import { describe, it, expect, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock the dependencies
jest.mock('@/lib/auth-middleware');
jest.mock('@/lib/tenant-middleware');
jest.mock('@/lib/services/credit-service');

import { authMiddleware } from '@/lib/auth-middleware';
import { tenantMiddleware } from '@/lib/tenant-middleware';
import { CreditService } from '@/lib/services/credit-service';

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;
const mockCreditService = CreditService as jest.Mocked<typeof CreditService>;

describe('/api/credits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return credit balance for authenticated user', async () => {
      const mockUser = { uid: 'test-user-id', email: 'test@example.com' };
      
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
        user: null,
      });

      const request = new NextRequest('http://localhost:3000/api/credits');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should include history when requested', async () => {
      const mockUser = { uid: 'test-user-id', email: 'test@example.com' };
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
      expect(data.history).toEqual(mockHistory);
      expect(mockCreditService.getTransactionHistory).toHaveBeenCalledWith('test-user-id', 20, 0);
    });
  });
});