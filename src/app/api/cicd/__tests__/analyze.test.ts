import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST, GET } from '../analyze/route';
import { CICDAnalysisService } from '@/lib/services/cicd-analysis-service';
import { API_PERMISSIONS } from '@/lib/types/cicd';

// Mock Next.js globals
global.Request = global.Request || class Request {};
global.Response = global.Response || class Response {};

// Mock the services
jest.mock('@/lib/services/cicd-analysis-service');
jest.mock('@/lib/middleware/api-key-auth');

const mockCICDAnalysisService = CICDAnalysisService as jest.Mocked<typeof CICDAnalysisService>;

const serializeAnalysis = (analysis: any) => ({
  ...analysis,
  createdAt: analysis.createdAt instanceof Date ? analysis.createdAt.toISOString() : analysis.createdAt,
});

describe('/api/cicd/analyze', () => {
  const mockApiKeyContext = {
    apiKey: {
      id: 'key-1',
      organizationId: 'org-1',
      permissions: [API_PERMISSIONS.ANALYSIS_READ, API_PERMISSIONS.ANALYSIS_WRITE],
      createdBy: 'user-1',
    },
    organizationId: 'org-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock withApiKeyAuth to call the handler directly
    const { withApiKeyAuth } = require('@/lib/middleware/api-key-auth');
    withApiKeyAuth.mockImplementation((handler) => {
      return async (request: NextRequest, ...args: any[]) => {
        return handler(mockApiKeyContext, request, ...args);
      };
    });
  });

  describe('POST /api/cicd/analyze', () => {
    it('should submit analysis request', async () => {
      const mockAnalysisResponse = {
        id: 'analysis-1',
        status: 'pending',
        repositoryUrl: 'https://github.com/example/repo',
        estimatedCredits: 10,
        createdAt: new Date(),
      };

      mockCICDAnalysisService.submitAnalysis.mockResolvedValue(mockAnalysisResponse);

      const requestBody = {
        repositoryUrl: 'https://github.com/example/repo',
        branch: 'main',
        commitSha: 'abc123',
      };

      const request = new NextRequest('http://localhost/api/cicd/analyze', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
  expect(data).toEqual(serializeAnalysis(mockAnalysisResponse));
      expect(mockCICDAnalysisService.submitAnalysis).toHaveBeenCalledWith(
        'org-1',
        'user-1',
        requestBody
      );
    });

    it('should validate repository URL', async () => {
      const request = new NextRequest('http://localhost/api/cicd/analyze', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Repository URL is required');
    });

    it('should validate repository URL format', async () => {
      const request = new NextRequest('http://localhost/api/cicd/analyze', {
        method: 'POST',
        body: JSON.stringify({
          repositoryUrl: 'invalid-url',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid repository URL format');
    });

    it('should handle insufficient credits error', async () => {
      mockCICDAnalysisService.submitAnalysis.mockRejectedValue(
        new Error('Insufficient credits for analysis')
      );

      const request = new NextRequest('http://localhost/api/cicd/analyze', {
        method: 'POST',
        body: JSON.stringify({
          repositoryUrl: 'https://github.com/example/repo',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.code).toBe('INSUFFICIENT_CREDITS');
    });

    it('should handle invalid repository error', async () => {
      mockCICDAnalysisService.submitAnalysis.mockRejectedValue(
        new Error('Invalid repository: Repository not accessible')
      );

      const request = new NextRequest('http://localhost/api/cicd/analyze', {
        method: 'POST',
        body: JSON.stringify({
          repositoryUrl: 'https://github.com/example/private-repo',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_REPOSITORY');
    });
  });

  describe('GET /api/cicd/analyze', () => {
    it('should list analyses', async () => {
      const mockAnalyses = [
        {
          id: 'analysis-1',
          status: 'completed',
          repositoryUrl: 'https://github.com/example/repo',
          estimatedCredits: 10,
          createdAt: new Date(),
        },
      ];

      mockCICDAnalysisService.listAnalyses.mockResolvedValue(mockAnalyses);

      const request = new NextRequest('http://localhost/api/cicd/analyze');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
  expect(data.analyses).toEqual(mockAnalyses.map(serializeAnalysis));
      expect(data.pagination).toEqual({
        limit: 50,
        offset: 0,
        hasMore: false,
      });
    });

    it('should handle query parameters', async () => {
      mockCICDAnalysisService.listAnalyses.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/cicd/analyze?status=completed&limit=10&offset=20'
      );
      const response = await GET(request);

      expect(mockCICDAnalysisService.listAnalyses).toHaveBeenCalledWith(
        'org-1',
        { status: 'completed', limit: 10, offset: 20 }
      );
    });
  });
});