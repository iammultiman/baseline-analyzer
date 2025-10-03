import { NextRequest } from 'next/server';
import { POST } from '../route';
import { AIAnalysisEngine } from '@/lib/services/ai-analysis-engine';
import { RepositoryProcessor } from '@/lib/services/repository-processor';
import { authMiddleware } from '@/lib/auth-middleware';
import { tenantMiddleware } from '@/lib/tenant-middleware';

// Mock dependencies
jest.mock('@/lib/services/ai-analysis-engine');
jest.mock('@/lib/services/repository-processor');
jest.mock('@/lib/auth-middleware');
jest.mock('@/lib/tenant-middleware');

const mockAIAnalysisEngine = AIAnalysisEngine as jest.Mocked<typeof AIAnalysisEngine>;
const mockRepositoryProcessor = RepositoryProcessor as jest.Mocked<typeof RepositoryProcessor>;
const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;

describe('/api/analysis', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User'
  };

  const mockProcessedRepository = {
    id: 'test-repo-id',
    content: 'repository content',
    metadata: {
      repositoryUrl: 'https://github.com/test/repo',
      repositoryName: 'test-repo',
      fileCount: 25,
      totalSize: 1024 * 1024,
      processingTime: 5000,
      extractedAt: new Date()
    }
  };

  const mockAnalysisResult = {
    complianceScore: 85,
    recommendations: [],
    baselineMatches: [],
    issues: [],
    tokensUsed: 1500,
    provider: 'OPENAI',
    model: 'gpt-4o',
    processingTime: 3000,
    creditsCost: 5,
    analysisId: 'test-analysis-id',
    repositoryMetadata: mockProcessedRepository.metadata
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default successful auth and tenant middleware
    mockAuthMiddleware.mockResolvedValue({
      success: true,
      user: mockUser
    });

    mockTenantMiddleware.mockResolvedValue({
      success: true,
      organizationId: 'test-org-id'
    });
  });

  describe('POST', () => {
    it('should analyze repository successfully', async () => {
      const requestBody = {
        repositoryUrl: 'https://github.com/test/repo',
        analysisType: 'full'
      };

      const request = new NextRequest('http://localhost/api/analysis', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Mock repository validation and processing
      mockRepositoryProcessor.validateRepository.mockResolvedValue({
        isValid: true,
        repositoryInfo: {
          url: 'https://github.com/test/repo',
          name: 'test-repo',
          owner: 'test',
          isPrivate: false
        }
      });

      mockRepositoryProcessor.processRepository.mockResolvedValue('test-job-id');
      
      mockRepositoryProcessor.getJobStatus
        .mockReturnValueOnce({
          id: 'test-job-id',
          userId: 'test-user-id',
          organizationId: 'test-org-id',
          repositoryUrl: 'https://github.com/test/repo',
          status: 'processing',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockReturnValueOnce({
          id: 'test-job-id',
          userId: 'test-user-id',
          organizationId: 'test-org-id',
          repositoryUrl: 'https://github.com/test/repo',
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date(),
          result: mockProcessedRepository
        });

      mockAIAnalysisEngine.validateAnalysisRequest.mockReturnValue({
        valid: true,
        errors: []
      });

      mockAIAnalysisEngine.analyzeRepository.mockResolvedValue(mockAnalysisResult);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.analysis).toEqual({
        ...mockAnalysisResult,
        repositoryMetadata: {
          ...mockAnalysisResult.repositoryMetadata,
          extractedAt: mockAnalysisResult.repositoryMetadata.extractedAt.toISOString(),
        },
      });
      expect(data.processingJobId).toBe('test-job-id');

      expect(mockRepositoryProcessor.validateRepository).toHaveBeenCalledWith('https://github.com/test/repo');
      expect(mockRepositoryProcessor.processRepository).toHaveBeenCalledWith(
        'https://github.com/test/repo',
        'test-user-id',
        'test-org-id'
      );
      expect(mockAIAnalysisEngine.analyzeRepository).toHaveBeenCalledWith({
        repositoryContent: mockProcessedRepository,
        userId: 'test-user-id',
        organizationId: 'test-org-id',
        analysisType: 'full'
      });
    });

    it('should return 401 when authentication fails', async () => {
      mockAuthMiddleware.mockResolvedValue({
        success: false,
        error: 'Unauthorized',
        status: 401
      });

      const request = new NextRequest('http://localhost/api/analysis', {
        method: 'POST',
        body: JSON.stringify({ repositoryUrl: 'https://github.com/test/repo' }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when tenant middleware fails', async () => {
      mockTenantMiddleware.mockResolvedValue({
        success: false,
        error: 'Forbidden',
        status: 403
      });

      const request = new NextRequest('http://localhost/api/analysis', {
        method: 'POST',
        body: JSON.stringify({ repositoryUrl: 'https://github.com/test/repo' }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 400 when repository URL is missing', async () => {
      const request = new NextRequest('http://localhost/api/analysis', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Repository URL is required');
    });

    it('should return 400 when repository validation fails', async () => {
      mockRepositoryProcessor.validateRepository.mockResolvedValue({
        isValid: false,
        error: 'Invalid repository URL'
      });

      const request = new NextRequest('http://localhost/api/analysis', {
        method: 'POST',
        body: JSON.stringify({ repositoryUrl: 'invalid-url' }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid repository URL');
    });

    it('should return 500 when repository processing fails', async () => {
      mockRepositoryProcessor.validateRepository.mockResolvedValue({
        isValid: true,
        repositoryInfo: {
          url: 'https://github.com/test/repo',
          name: 'test-repo',
          owner: 'test',
          isPrivate: false
        }
      });

      mockRepositoryProcessor.processRepository.mockResolvedValue('test-job-id');
      
      mockRepositoryProcessor.getJobStatus.mockReturnValue({
        id: 'test-job-id',
        userId: 'test-user-id',
        organizationId: 'test-org-id',
        repositoryUrl: 'https://github.com/test/repo',
        status: 'failed',
        createdAt: new Date(),
        updatedAt: new Date(),
        error: 'Processing failed'
      });

      const request = new NextRequest('http://localhost/api/analysis', {
        method: 'POST',
        body: JSON.stringify({ repositoryUrl: 'https://github.com/test/repo' }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Processing failed');
    });

    it('should return 400 when analysis request validation fails', async () => {
      mockRepositoryProcessor.validateRepository.mockResolvedValue({
        isValid: true,
        repositoryInfo: {
          url: 'https://github.com/test/repo',
          name: 'test-repo',
          owner: 'test',
          isPrivate: false
        }
      });

      mockRepositoryProcessor.processRepository.mockResolvedValue('test-job-id');
      
      mockRepositoryProcessor.getJobStatus.mockReturnValue({
        id: 'test-job-id',
        userId: 'test-user-id',
        organizationId: 'test-org-id',
        repositoryUrl: 'https://github.com/test/repo',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
        result: mockProcessedRepository
      });

      mockAIAnalysisEngine.validateAnalysisRequest.mockReturnValue({
        valid: false,
        errors: ['Repository content is empty']
      });

      const request = new NextRequest('http://localhost/api/analysis', {
        method: 'POST',
        body: JSON.stringify({ repositoryUrl: 'https://github.com/test/repo' }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid analysis request');
      expect(data.details).toEqual(['Repository content is empty']);
    });

    it('should return 500 when analysis fails', async () => {
      mockRepositoryProcessor.validateRepository.mockResolvedValue({
        isValid: true,
        repositoryInfo: {
          url: 'https://github.com/test/repo',
          name: 'test-repo',
          owner: 'test',
          isPrivate: false
        }
      });

      mockRepositoryProcessor.processRepository.mockResolvedValue('test-job-id');
      
      mockRepositoryProcessor.getJobStatus.mockReturnValue({
        id: 'test-job-id',
        userId: 'test-user-id',
        organizationId: 'test-org-id',
        repositoryUrl: 'https://github.com/test/repo',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
        result: mockProcessedRepository
      });

      mockAIAnalysisEngine.validateAnalysisRequest.mockReturnValue({
        valid: true,
        errors: []
      });

      mockAIAnalysisEngine.analyzeRepository.mockRejectedValue(new Error('Insufficient credits'));

      const request = new NextRequest('http://localhost/api/analysis', {
        method: 'POST',
        body: JSON.stringify({ repositoryUrl: 'https://github.com/test/repo' }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Analysis failed');
      expect(data.details).toBe('Insufficient credits');
    });

    it('should use default analysis type when not specified', async () => {
      const requestBody = {
        repositoryUrl: 'https://github.com/test/repo'
        // analysisType not specified
      };

      mockRepositoryProcessor.validateRepository.mockResolvedValue({
        isValid: true,
        repositoryInfo: {
          url: 'https://github.com/test/repo',
          name: 'test-repo',
          owner: 'test',
          isPrivate: false
        }
      });

      mockRepositoryProcessor.processRepository.mockResolvedValue('test-job-id');
      
      mockRepositoryProcessor.getJobStatus.mockReturnValue({
        id: 'test-job-id',
        userId: 'test-user-id',
        organizationId: 'test-org-id',
        repositoryUrl: 'https://github.com/test/repo',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
        result: mockProcessedRepository
      });

      mockAIAnalysisEngine.validateAnalysisRequest.mockReturnValue({
        valid: true,
        errors: []
      });

      mockAIAnalysisEngine.analyzeRepository.mockResolvedValue(mockAnalysisResult);

      const request = new NextRequest('http://localhost/api/analysis', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockAIAnalysisEngine.analyzeRepository).toHaveBeenCalledWith(
        expect.objectContaining({
          analysisType: 'full' // Default value
        })
      );
    });
  });
});