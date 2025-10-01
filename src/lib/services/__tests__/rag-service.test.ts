import { RAGService } from '../rag-service';
import { baselineDataService } from '../baseline-data-service';

// Mock the baseline data service
jest.mock('../baseline-data-service', () => ({
  baselineDataService: {
    searchSimilar: jest.fn(),
  },
}));

describe('RAGService', () => {
  let service: RAGService;
  const mockBaselineService = baselineDataService as jest.Mocked<typeof baselineDataService>;

  beforeEach(() => {
    service = RAGService.getInstance();
    jest.clearAllMocks();
  });

  describe('retrieveContext', () => {
    it('should retrieve relevant context for a query', async () => {
      const mockResults = [
        {
          feature: {
            id: '1',
            feature: 'Fetch API',
            category: 'api',
            status: 'baseline' as const,
            description: 'Modern way to make HTTP requests',
            documentation: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API',
            browserSupport: { chrome: '42', firefox: '39', safari: '10.1' },
            lastUpdated: new Date(),
          },
          similarity: 0.85,
        },
      ];

      mockBaselineService.searchSimilar.mockResolvedValueOnce(mockResults);

      const result = await service.retrieveContext('fetch API usage');

      expect(result.query).toBe('fetch API usage');
      expect(result.relevantFeatures).toEqual(mockResults);
      expect(result.contextText).toContain('Fetch API');
      expect(result.contextText).toContain('85.0% relevant');
      expect(result.contextText).toContain('Modern way to make HTTP requests');
    });

    it('should handle empty results', async () => {
      mockBaselineService.searchSimilar.mockResolvedValueOnce([]);

      const result = await service.retrieveContext('unknown feature');

      expect(result.query).toBe('unknown feature');
      expect(result.relevantFeatures).toEqual([]);
      expect(result.contextText).toBe('No relevant baseline data found.');
    });

    it('should handle service errors', async () => {
      mockBaselineService.searchSimilar.mockRejectedValueOnce(new Error('Service error'));

      await expect(service.retrieveContext('test query')).rejects.toThrow(
        'Failed to retrieve context: Service error'
      );
    });
  });

  describe('generateAnalysisPrompt', () => {
    beforeEach(() => {
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

      mockBaselineService.searchSimilar.mockResolvedValue(mockResults);
    });

    it('should generate compatibility analysis prompt', async () => {
      const repositoryContent = `
        fetch('/api/data')
          .then(response => response.json())
          .then(data => console.log(data));
      `;

      const prompt = await service.generateAnalysisPrompt(repositoryContent, 'compatibility');

      expect(prompt).toContain('Focus on browser compatibility analysis');
      expect(prompt).toContain('compatibilityScore');
      expect(prompt).toContain('supportedFeatures');
      expect(prompt).toContain('unsupportedFeatures');
      expect(prompt).toContain('Fetch API');
    });

    it('should generate recommendations analysis prompt', async () => {
      const repositoryContent = `
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/data');
        xhr.send();
      `;

      const prompt = await service.generateAnalysisPrompt(repositoryContent, 'recommendations');

      expect(prompt).toContain('Focus on actionable recommendations');
      expect(prompt).toContain('recommendations');
      expect(prompt).toContain('modernizationOpportunities');
      expect(prompt).toContain('bestPractices');
    });

    it('should generate full analysis prompt', async () => {
      const repositoryContent = `
        document.querySelector('.container').style.display = 'grid';
      `;

      const prompt = await service.generateAnalysisPrompt(repositoryContent, 'full');

      expect(prompt).toContain('Provide a comprehensive analysis');
      expect(prompt).toContain('summary');
      expect(prompt).toContain('compatibilityScore');
      expect(prompt).toContain('featureAnalysis');
      expect(prompt).toContain('riskAssessment');
      expect(prompt).toContain('modernizationRoadmap');
    });

    it('should handle long repository content', async () => {
      const longContent = 'a'.repeat(10000);

      const prompt = await service.generateAnalysisPrompt(longContent, 'full');

      expect(prompt).toContain('[truncated]');
      expect(prompt.length).toBeLessThan(15000); // Should be truncated
    });
  });

  describe('getFeatureBaseline', () => {
    it('should get baseline data for specific features', async () => {
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
          similarity: 0.9,
        },
      ];

      mockBaselineService.searchSimilar.mockResolvedValue(mockResults);

      const result = await service.getFeatureBaseline(['fetch', 'websocket']);

      expect(result).toHaveLength(2); // Called twice, once for each feature
      expect(result[0].feature).toBe('Fetch API');
      expect(mockBaselineService.searchSimilar).toHaveBeenCalledTimes(2);
    });

    it('should handle features with no baseline data', async () => {
      mockBaselineService.searchSimilar.mockResolvedValue([]);

      const result = await service.getFeatureBaseline(['unknown-feature']);

      expect(result).toHaveLength(0);
    });
  });

  describe('checkFeatureSupport', () => {
    it('should check if a feature has baseline support', async () => {
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

      const result = await service.checkFeatureSupport('fetch');

      expect(result.isSupported).toBe(true);
      expect(result.status).toBe('baseline');
      expect(result.confidence).toBe(0.85);
      expect(result.details).toEqual(mockResults[0].feature);
    });

    it('should handle unsupported features', async () => {
      const mockResults = [
        {
          feature: {
            id: '1',
            feature: 'Experimental API',
            category: 'api',
            status: 'not-baseline' as const,
            description: 'Experimental feature',
            lastUpdated: new Date(),
          },
          similarity: 0.75,
        },
      ];

      mockBaselineService.searchSimilar.mockResolvedValueOnce(mockResults);

      const result = await service.checkFeatureSupport('experimental-api');

      expect(result.isSupported).toBe(false);
      expect(result.status).toBe('not-baseline');
      expect(result.confidence).toBe(0.75);
    });

    it('should handle unknown features', async () => {
      mockBaselineService.searchSimilar.mockResolvedValueOnce([]);

      const result = await service.checkFeatureSupport('completely-unknown');

      expect(result.isSupported).toBe(false);
      expect(result.status).toBe('unknown');
      expect(result.confidence).toBe(0);
      expect(result.details).toBeUndefined();
    });

    it('should handle service errors gracefully', async () => {
      mockBaselineService.searchSimilar.mockRejectedValueOnce(new Error('Service error'));

      const result = await service.checkFeatureSupport('test-feature');

      expect(result.isSupported).toBe(false);
      expect(result.status).toBe('error');
      expect(result.confidence).toBe(0);
    });
  });

  describe('extractTechnologies', () => {
    it('should extract web technologies from code', () => {
      const content = `
        fetch('/api/data')
        localStorage.setItem('key', 'value')
        new WebSocket('ws://localhost')
        document.querySelector('.grid')
        async function getData() {
          const response = await fetch('/api');
          return response.json();
        }
      `;

      // Access private method for testing
      const extractTechnologies = (service as any).extractTechnologies.bind(service);
      const technologies = extractTechnologies(content);

      expect(technologies).toContain('fetch');
      expect(technologies).toContain('localstorage');
      expect(technologies).toContain('websocket');
      expect(technologies).toContain('web platform');
    });

    it('should limit the number of extracted technologies', () => {
      const content = `
        fetch() localStorage sessionStorage IndexedDB ServiceWorker
        WebRTC WebGL Canvas WebAudio Geolocation Notification
        IntersectionObserver MutationObserver ResizeObserver
        grid flexbox transform animation transition
      `;

      const extractTechnologies = (service as any).extractTechnologies.bind(service);
      const technologies = extractTechnologies(content);

      expect(technologies.length).toBeLessThanOrEqual(10);
    });
  });
});