import { NextRequest } from 'next/server';
import { GET } from '../dashboard/route';
import { prisma } from '@/lib/database';
import { verifyAuthToken } from '@/lib/auth-middleware';

// Mock dependencies
jest.mock('@/lib/database', () => ({
  prisma: {
    repositoryAnalysis: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth-middleware', () => ({
  verifyAuthToken: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockVerifyAuthToken = verifyAuthToken as jest.MockedFunction<typeof verifyAuthToken>;

describe('/api/reporting/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns unauthorized when auth fails', async () => {
    mockVerifyAuthToken.mockResolvedValue({
      success: false,
      error: 'Invalid token',
    });

    const request = new NextRequest('http://localhost:3000/api/reporting/dashboard');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns dashboard data for authenticated user', async () => {
    const mockUser = {
      id: 'user-123',
      organizationId: 'org-456',
      email: 'test@example.com',
    };

    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      user: mockUser,
    });

    const mockAnalyses = [
      {
        id: 'analysis-1',
        userId: 'user-123',
        organizationId: 'org-456',
        repositoryName: 'test-repo-1',
        repositoryUrl: 'https://github.com/test/repo1',
        analysisDate: new Date('2024-01-01'),
        status: 'COMPLETED',
        creditsCost: 10,
        results: {
          complianceScore: 85,
          recommendations: [{ id: '1', title: 'Test rec' }],
          issues: [{ id: '1', category: 'Accessibility', severity: 'high' }],
          baselineMatches: [{ feature: 'CSS Grid' }],
        },
        metadata: {},
        user: {
          displayName: 'Test User',
          email: 'test@example.com',
        },
      },
      {
        id: 'analysis-2',
        userId: 'user-123',
        organizationId: 'org-456',
        repositoryName: 'test-repo-2',
        repositoryUrl: 'https://github.com/test/repo2',
        analysisDate: new Date('2024-01-02'),
        status: 'COMPLETED',
        creditsCost: 15,
        results: {
          complianceScore: 72,
          recommendations: [{ id: '2', title: 'Test rec 2' }],
          issues: [
            { id: '2', category: 'Performance', severity: 'medium' },
            { id: '3', category: 'Accessibility', severity: 'high' },
          ],
          baselineMatches: [{ feature: 'Flexbox' }],
        },
        metadata: {},
        user: {
          displayName: 'Test User',
          email: 'test@example.com',
        },
      },
    ];

    mockPrisma.repositoryAnalysis.findMany.mockResolvedValue(mockAnalyses as any);

    const request = new NextRequest('http://localhost:3000/api/reporting/dashboard?timeRange=30d');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.totalAnalyses).toBe(2);
    expect(data.averageCompliance).toBe(78.5); // (85 + 72) / 2
    expect(data.recentAnalyses).toHaveLength(2);
    expect(data.topIssues).toEqual([
      { category: 'Accessibility', count: 2, severity: 'high' },
      { category: 'Performance', count: 1, severity: 'medium' },
    ]);
  });

  it('handles different time ranges correctly', async () => {
    const mockUser = {
      id: 'user-123',
      organizationId: 'org-456',
      email: 'test@example.com',
    };

    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      user: mockUser,
    });

    mockPrisma.repositoryAnalysis.findMany.mockResolvedValue([]);

    // Test 7d time range
    const request = new NextRequest('http://localhost:3000/api/reporting/dashboard?timeRange=7d');
    await GET(request);

    expect(mockPrisma.repositoryAnalysis.findMany).toHaveBeenCalledWith({
      where: {
        analysisDate: {
          gte: expect.any(Date),
        },
        status: 'COMPLETED',
        organizationId: 'org-456',
      },
      orderBy: {
        analysisDate: 'desc',
      },
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    });

    // Verify the date range is approximately correct (within 1 minute)
    const call = mockPrisma.repositoryAnalysis.findMany.mock.calls[0][0];
    const startDate = call.where.analysisDate.gte;
    const expectedStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const timeDiff = Math.abs(startDate.getTime() - expectedStartDate.getTime());
    expect(timeDiff).toBeLessThan(60000); // Within 1 minute
  });

  it('filters by organization when organizationId is provided', async () => {
    const mockUser = {
      id: 'user-123',
      organizationId: 'org-456',
      email: 'test@example.com',
    };

    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      user: mockUser,
    });

    mockPrisma.repositoryAnalysis.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/reporting/dashboard?organizationId=org-789');
    await GET(request);

    expect(mockPrisma.repositoryAnalysis.findMany).toHaveBeenCalledWith({
      where: {
        analysisDate: {
          gte: expect.any(Date),
        },
        status: 'COMPLETED',
        organizationId: 'org-789',
      },
      orderBy: {
        analysisDate: 'desc',
      },
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    });
  });

  it('filters by user when userId is provided', async () => {
    const mockUser = {
      id: 'user-123',
      organizationId: 'org-456',
      email: 'test@example.com',
    };

    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      user: mockUser,
    });

    mockPrisma.repositoryAnalysis.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/reporting/dashboard?userId=user-789');
    await GET(request);

    expect(mockPrisma.repositoryAnalysis.findMany).toHaveBeenCalledWith({
      where: {
        analysisDate: {
          gte: expect.any(Date),
        },
        status: 'COMPLETED',
        userId: 'user-789',
      },
      orderBy: {
        analysisDate: 'desc',
      },
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    });
  });

  it('generates trends data correctly', async () => {
    const mockUser = {
      id: 'user-123',
      organizationId: 'org-456',
      email: 'test@example.com',
    };

    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      user: mockUser,
    });

    const mockAnalyses = [
      {
        id: 'analysis-1',
        analysisDate: new Date('2024-01-01T10:00:00Z'),
        results: { complianceScore: 80 },
        user: { displayName: 'Test User', email: 'test@example.com' },
      },
      {
        id: 'analysis-2',
        analysisDate: new Date('2024-01-01T14:00:00Z'),
        results: { complianceScore: 90 },
        user: { displayName: 'Test User', email: 'test@example.com' },
      },
      {
        id: 'analysis-3',
        analysisDate: new Date('2024-01-02T10:00:00Z'),
        results: { complianceScore: 70 },
        user: { displayName: 'Test User', email: 'test@example.com' },
      },
    ];

    mockPrisma.repositoryAnalysis.findMany.mockResolvedValue(mockAnalyses as any);

    const request = new NextRequest('http://localhost:3000/api/reporting/dashboard');
    const response = await GET(request);

    const data = await response.json();

    expect(data.trendsData).toEqual([
      { date: '2024-01-01', complianceScore: 85, analysisCount: 2 }, // (80 + 90) / 2 = 85
      { date: '2024-01-02', complianceScore: 70, analysisCount: 1 },
    ]);
  });

  it('handles database errors gracefully', async () => {
    const mockUser = {
      id: 'user-123',
      organizationId: 'org-456',
      email: 'test@example.com',
    };

    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      user: mockUser,
    });

    mockPrisma.repositoryAnalysis.findMany.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/reporting/dashboard');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to load dashboard data');
  });

  it('returns empty data when no analyses found', async () => {
    const mockUser = {
      id: 'user-123',
      organizationId: 'org-456',
      email: 'test@example.com',
    };

    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      user: mockUser,
    });

    mockPrisma.repositoryAnalysis.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/reporting/dashboard');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.totalAnalyses).toBe(0);
    expect(data.averageCompliance).toBe(0);
    expect(data.trendsData).toEqual([]);
    expect(data.topIssues).toEqual([]);
    expect(data.recentAnalyses).toEqual([]);
  });
});