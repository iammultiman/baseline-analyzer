import { BaselineDataService } from '../baseline-data-service';
import { prisma } from '@/lib/database';

// Mock the database
jest.mock('@/lib/database', () => ({
  prisma: {
    baselineData: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('BaselineDataService', () => {
  let service: BaselineDataService;
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;

  beforeEach(() => {
    service = BaselineDataService.getInstance();
    jest.clearAllMocks();
  });

  describe('fetchLatestBaseline', () => {
    it('should fetch and transform baseline data from web.dev API', async () => {
      const mockApiResponse = {
        features: [
          {
            id: 'test-feature',
            feature: 'Test Feature',
            category: 'api',
            status: 'baseline',
            description: 'A test feature',
            documentation: 'https://example.com/docs',
            browser_support: {
              chrome: '90',
              firefox: '88',
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const result = await service.fetchLatestBaseline();

      expect(result.features).toHaveLength(1);
      expect(result.features[0]).toMatchObject({
        id: 'test-feature',
        feature: 'Test Feature',
        category: 'api',
        status: 'baseline',
        description: 'A test feature',
      });
      expect(result.lastFetched).toBeInstanceOf(Date);
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(service.fetchLatestBaseline()).rejects.toThrow(
        'Failed to fetch baseline data: 500 Internal Server Error'
      );
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(service.fetchLatestBaseline()).rejects.toThrow(
        'Failed to fetch baseline data: Network error'
      );
    });
  });

  describe('generateEmbeddings', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';
    });

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it('should generate embeddings for features', async () => {
      const mockFeatures = [
        {
          id: '1',
          feature: 'Test Feature',
          category: 'api',
          status: 'baseline' as const,
          description: 'A test feature',
          lastUpdated: new Date(),
        },
      ];

      const mockEmbedding = [0.1, 0.2, 0.3];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: mockEmbedding }],
        }),
      });

      const result = await service.generateEmbeddings(mockFeatures);

      expect(result).toHaveLength(1);
      expect(result[0].embedding).toEqual(mockEmbedding);
    });

    it('should handle OpenAI API errors', async () => {
      const mockFeatures = [
        {
          id: '1',
          feature: 'Test Feature',
          category: 'api',
          status: 'baseline' as const,
          description: 'A test feature',
          lastUpdated: new Date(),
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await service.generateEmbeddings(mockFeatures);

      // Should return features without embeddings on error
      expect(result).toHaveLength(1);
      expect(result[0].embedding).toBeUndefined();
    });

    it('should throw error when OpenAI API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;

      const mockFeatures = [
        {
          id: '1',
          feature: 'Test Feature',
          category: 'api',
          status: 'baseline' as const,
          description: 'A test feature',
          lastUpdated: new Date(),
        },
      ];

      const result = await service.generateEmbeddings(mockFeatures);

      // Should return features without embeddings when API key is missing
      expect(result).toHaveLength(1);
      expect(result[0].embedding).toBeUndefined();
    });
  });

  describe('updateVectorDatabase', () => {
    it('should update existing features and create new ones', async () => {
      const mockFeatures = [
        {
          id: '1',
          feature: 'Existing Feature',
          category: 'api',
          status: 'baseline' as const,
          description: 'An existing feature',
          lastUpdated: new Date(),
          embedding: [0.1, 0.2, 0.3],
        },
        {
          id: '2',
          feature: 'New Feature',
          category: 'css',
          status: 'limited' as const,
          description: 'A new feature',
          lastUpdated: new Date(),
          embedding: [0.4, 0.5, 0.6],
        },
      ];

      // Mock existing feature found
      mockPrisma.baselineData.findFirst
        .mockResolvedValueOnce({
          id: 'existing-id',
          feature: 'Existing Feature',
          category: 'api',
          status: 'baseline',
          description: 'An existing feature',
          documentation: null,
          browserSupport: null,
          lastUpdated: new Date(),
          embedding: null,
        })
        .mockResolvedValueOnce(null); // New feature not found

      mockPrisma.baselineData.update.mockResolvedValueOnce({} as any);
      mockPrisma.baselineData.create.mockResolvedValueOnce({
        id: 'new-id',
      } as any);
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      // Mock OpenAI API for embedding generation
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      });

      const result = await service.updateVectorDatabase(mockFeatures);

      expect(result.success).toBe(true);
      expect(result.featuresUpdated).toBe(1);
      expect(result.featuresAdded).toBe(1);
      expect(mockPrisma.baselineData.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.baselineData.create).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors gracefully', async () => {
      const mockFeatures = [
        {
          id: '1',
          feature: 'Test Feature',
          category: 'api',
          status: 'baseline' as const,
          description: 'A test feature',
          lastUpdated: new Date(),
        },
      ];

      mockPrisma.baselineData.findFirst.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.updateVectorDatabase(mockFeatures);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('Database error');
    });
  });

  describe('searchSimilar', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';
    });

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it('should perform similarity search', async () => {
      const mockQueryEmbedding = [0.1, 0.2, 0.3];
      const mockResults = [
        {
          id: '1',
          feature: 'Similar Feature',
          category: 'api',
          status: 'baseline',
          description: 'A similar feature',
          documentation: null,
          browser_support: null,
          last_updated: new Date(),
          similarity: 0.85,
        },
      ];

      // Mock OpenAI API for query embedding
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: mockQueryEmbedding }],
        }),
      });

      mockPrisma.$queryRaw.mockResolvedValueOnce(mockResults);

      const result = await service.searchSimilar('test query');

      expect(result).toHaveLength(1);
      expect(result[0].feature.feature).toBe('Similar Feature');
      expect(result[0].similarity).toBe(0.85);
    });

    it('should handle search errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('OpenAI error'));

      await expect(service.searchSimilar('test query')).rejects.toThrow(
        'Similarity search failed: OpenAI error'
      );
    });
  });

  describe('getAllFeatures', () => {
    it('should return all features from database', async () => {
      const mockFeatures = [
        {
          id: '1',
          feature: 'Feature 1',
          category: 'api',
          status: 'baseline',
          description: 'First feature',
          documentation: null,
          browserSupport: null,
          lastUpdated: new Date(),
        },
        {
          id: '2',
          feature: 'Feature 2',
          category: 'css',
          status: 'limited',
          description: 'Second feature',
          documentation: null,
          browserSupport: null,
          lastUpdated: new Date(),
        },
      ];

      mockPrisma.baselineData.findMany.mockResolvedValueOnce(mockFeatures);

      const result = await service.getAllFeatures();

      expect(result).toHaveLength(2);
      expect(result[0].feature).toBe('Feature 1');
      expect(result[1].feature).toBe('Feature 2');
    });
  });

  describe('getStatistics', () => {
    it('should return baseline data statistics', async () => {
      mockPrisma.baselineData.count.mockResolvedValueOnce(100);
      mockPrisma.baselineData.groupBy
        .mockResolvedValueOnce([
          { status: 'baseline', _count: { status: 60 } },
          { status: 'limited', _count: { status: 30 } },
          { status: 'not-baseline', _count: { status: 10 } },
        ])
        .mockResolvedValueOnce([
          { category: 'api', _count: { category: 40 } },
          { category: 'css', _count: { category: 35 } },
          { category: 'html', _count: { category: 25 } },
        ]);

      const result = await service.getStatistics();

      expect(result.total).toBe(100);
      expect(result.byStatus).toEqual({
        baseline: 60,
        limited: 30,
        'not-baseline': 10,
      });
      expect(result.byCategory).toEqual({
        api: 40,
        css: 35,
        html: 25,
      });
    });
  });
});