import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { baselineDataService } from '@/lib/services/baseline-data-service';
import { requireAuth } from '@/lib/auth-middleware';

// Mock dependencies
jest.mock('@/lib/services/baseline-data-service');
jest.mock('@/lib/auth-middleware');

describe('/api/baseline', () => {
  const mockBaselineService = baselineDataService as jest.Mocked<typeof baselineDataService>;
  const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

  const serializeFeatures = (features: Array<{ lastUpdated: Date }>) =>
    features.map((feature) => ({
      ...feature,
      lastUpdated: feature.lastUpdated.toISOString(),
    }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return all features when no parameters provided', async () => {
      const mockFeatures = [
        {
          id: '1',
          feature: 'Fetch API',
          category: 'api',
          status: 'baseline' as const,
          description: 'Modern HTTP requests',
          lastUpdated: new Date(),
        },
      ];

      mockBaselineService.getAllFeatures.mockResolvedValueOnce(mockFeatures);

  const request = new NextRequest('http://localhost/api/baseline');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.features).toEqual(serializeFeatures(mockFeatures));
      expect(mockBaselineService.getAllFeatures).toHaveBeenCalledTimes(1);
    });

    it('should return features by category when category parameter provided', async () => {
      const mockFeatures = [
        {
          id: '1',
          feature: 'CSS Grid',
          category: 'css',
          status: 'baseline' as const,
          description: 'CSS Grid Layout',
          lastUpdated: new Date(),
        },
      ];

      mockBaselineService.getFeaturesByCategory.mockResolvedValueOnce(mockFeatures);

  const request = new NextRequest('http://localhost/api/baseline?category=css');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.features).toEqual(serializeFeatures(mockFeatures));
      expect(mockBaselineService.getFeaturesByCategory).toHaveBeenCalledWith('css');
    });

    it('should perform similarity search when query parameter provided', async () => {
      const mockResults = [
        {
          feature: {
            id: '1',
            feature: 'Fetch API',
            category: 'api',
            status: 'baseline' as const,
            description: 'Modern HTTP requests',
            lastUpdated: new Date(),
          },
          similarity: 0.85,
        },
      ];

      mockBaselineService.searchSimilar.mockResolvedValueOnce(mockResults);

  const request = new NextRequest('http://localhost/api/baseline?query=fetch&limit=5');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toEqual(
        mockResults.map((result) => ({
          ...result,
          feature: {
            ...result.feature,
            lastUpdated: result.feature.lastUpdated.toISOString(),
          },
        }))
      );
      expect(mockBaselineService.searchSimilar).toHaveBeenCalledWith('fetch', 5);
    });

    it('should handle service errors', async () => {
      mockBaselineService.getAllFeatures.mockRejectedValueOnce(new Error('Service error'));

  const request = new NextRequest('http://localhost/api/baseline');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch baseline data');
    });
  });

  describe('POST', () => {
    it('should update baseline data when authenticated as admin', async () => {
      mockRequireAuth.mockResolvedValueOnce({
        success: true,
        user: { id: '1', role: 'ADMIN' } as any,
      });

      const mockBaselineSource = {
        url: 'https://web.dev/api/baseline',
        features: [
          {
            id: '1',
            feature: 'Test Feature',
            category: 'api',
            status: 'baseline' as const,
            description: 'A test feature',
            lastUpdated: new Date(),
          },
        ],
        lastFetched: new Date(),
      };

      const mockUpdateResult = {
        success: true,
        featuresUpdated: 5,
        featuresAdded: 3,
      };

      mockBaselineService.fetchLatestBaseline.mockResolvedValueOnce(mockBaselineSource);
      mockBaselineService.updateVectorDatabase.mockResolvedValueOnce(mockUpdateResult);

        const request = new NextRequest('http://localhost/api/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Updated 5 features, added 3 new features');
      expect(data.details).toEqual(mockUpdateResult);
    });

    it('should reject unauthorized requests', async () => {
      mockRequireAuth.mockResolvedValueOnce({
        success: false,
        error: 'Unauthorized',
      });

      const request = new NextRequest('http://localhost/api/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject non-admin users', async () => {
      mockRequireAuth.mockResolvedValueOnce({
        success: true,
        user: { id: '1', role: 'MEMBER' } as any,
      });

        const request = new NextRequest('http://localhost/api/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should reject invalid actions', async () => {
      mockRequireAuth.mockResolvedValueOnce({
        success: true,
        user: { id: '1', role: 'ADMIN' } as any,
      });

        const request = new NextRequest('http://localhost/api/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalid' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });

    it('should handle update errors', async () => {
      mockRequireAuth.mockResolvedValueOnce({
        success: true,
        user: { id: '1', role: 'ADMIN' } as any,
      });

      mockBaselineService.fetchLatestBaseline.mockRejectedValueOnce(new Error('Fetch error'));

        const request = new NextRequest('http://localhost/api/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update baseline data');
    });
  });
});