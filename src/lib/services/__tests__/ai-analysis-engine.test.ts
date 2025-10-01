import { AIAnalysisEngine, AnalysisEngineRequest, RepositoryComplexityMetrics } from '../ai-analysis-engine';
import { AIProviderService } from '../ai-provider-service';
import { ragService } from '../rag-service';
import { CreditService } from '../credit-service';
import { ProcessedRepository } from '@/lib/types/repository';
import { AIAnalysisResponse } from '@/lib/types/ai-provider';

// Mock dependencies
jest.mock('../ai-provider-service');
jest.mock('../rag-service');
jest.mock('../credit-service');
jest.mock('@/lib/database', () => ({
  prisma: {
    repositoryAnalysis: {
      create: jest.fn()
    }
  }
}));

const mockAIProviderService = AIProviderService as jest.Mocked<typeof AIProviderService>;
const mockRagService = ragService as jest.Mocked<typeof ragService>;
const mockCreditService = CreditService as jest.Mocked<typeof CreditService>;

describe('AIAnalysisEngine', () => {
  const mockProcessedRepository: ProcessedRepository = {
    id: 'test-repo-id',
    content: `
      // Sample React component
      import React, { useState } from 'react';
      
      function App() {
        const [data, setData] = useState(null);
        
        const fetchData = async () => {
          const response = await fetch('/api/data');
          const result = await response.json();
          setData(result);
        };
        
        return (
          <div className="app">
            <button onClick={fetchData}>Fetch Data</button>
            {data && <div>{JSON.stringify(data)}</div>}
          </div>
        );
      }
      
      export default App;
    `,
    metadata: {
      repositoryUrl: 'https://github.com/test/repo',
      repositoryName: 'test-repo',
      fileCount: 25,
      totalSize: 1024 * 1024, // 1MB
      processingTime: 5000,
      extractedAt: new Date()
    }
  };

  const mockAnalysisRequest: AnalysisEngineRequest = {
    repositoryContent: mockProcessedRepository,
    userId: 'test-user-id',
    organizationId: 'test-org-id',
    analysisType: 'full'
  };

  const mockAIResponse: AIAnalysisResponse = {
    complianceScore: 85,
    recommendations: [
      {
        id: 'rec-1',
        title: 'Use modern fetch API',
        description: 'The fetch API is well supported across baseline browsers',
        priority: 'medium',
        category: 'api',
        actionItems: ['Replace XMLHttpRequest with fetch'],
        resources: ['https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API']
      }
    ],
    baselineMatches: [
      {
        feature: 'fetch-api',
        status: 'baseline',
        confidence: 0.95,
        description: 'Fetch API for network requests'
      }
    ],
    issues: [],
    tokensUsed: 1500,
    provider: 'OPENAI',
    model: 'gpt-4o',
    processingTime: 3000
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockCreditService.calculateAnalysisCost.mockReturnValue(5);
    mockCreditService.hasSufficientCredits.mockResolvedValue(true);
    mockCreditService.deductCredits.mockResolvedValue({
      success: true,
      newBalance: 95
    });
    
    mockRagService.generateAnalysisPrompt.mockResolvedValue('Enhanced analysis prompt');
    mockRagService.getFeatureBaseline.mockResolvedValue([]);
    
    mockAIProviderService.performAnalysis.mockResolvedValue(mockAIResponse);
  });

  describe('analyzeRepository', () => {
    it('should perform complete repository analysis successfully', async () => {
      const result = await AIAnalysisEngine.analyzeRepository(mockAnalysisRequest);

      expect(result).toMatchObject({
        complianceScore: expect.any(Number),
        recommendations: expect.any(Array),
        baselineMatches: expect.any(Array),
        issues: expect.any(Array),
        creditsCost: 5,
        analysisId: expect.any(String),
        repositoryMetadata: mockProcessedRepository.metadata
      });

      expect(mockCreditService.hasSufficientCredits).toHaveBeenCalledWith('test-user-id', 5);
      expect(mockCreditService.deductCredits).toHaveBeenCalledWith(
        'test-user-id',
        5,
        'Repository analysis: test-repo',
        expect.any(Object)
      );
      expect(mockRagService.generateAnalysisPrompt).toHaveBeenCalled();
      expect(mockAIProviderService.performAnalysis).toHaveBeenCalled();
    });

    it('should throw error when insufficient credits', async () => {
      mockCreditService.hasSufficientCredits.mockResolvedValue(false);

      await expect(AIAnalysisEngine.analyzeRepository(mockAnalysisRequest))
        .rejects.toThrow('Insufficient credits for analysis');

      expect(mockCreditService.deductCredits).not.toHaveBeenCalled();
      expect(mockAIProviderService.performAnalysis).not.toHaveBeenCalled();
    });

    it('should throw error when credit deduction fails', async () => {
      mockCreditService.deductCredits.mockResolvedValue({
        success: false,
        newBalance: 100,
        error: 'Deduction failed'
      });

      await expect(AIAnalysisEngine.analyzeRepository(mockAnalysisRequest))
        .rejects.toThrow('Deduction failed');

      expect(mockAIProviderService.performAnalysis).not.toHaveBeenCalled();
    });

    it('should handle AI provider failures', async () => {
      mockAIProviderService.performAnalysis.mockRejectedValue(new Error('AI provider error'));

      await expect(AIAnalysisEngine.analyzeRepository(mockAnalysisRequest))
        .rejects.toThrow('Analysis failed: AI provider error');
    });
  });

  describe('calculateRepositoryComplexity', () => {
    it('should calculate complexity metrics correctly', () => {
      const complexity = (AIAnalysisEngine as any).calculateRepositoryComplexity(mockProcessedRepository);

      expect(complexity).toMatchObject({
        fileCount: 25,
        totalSize: 1024 * 1024,
        codeComplexity: expect.any(Number),
        technologyStack: expect.arrayContaining(['javascript']),
        frameworksUsed: expect.arrayContaining(['react']),
        apiUsageCount: expect.any(Number)
      });

      expect(complexity.codeComplexity).toBeGreaterThan(0);
      expect(complexity.codeComplexity).toBeLessThanOrEqual(10);
    });

    it('should detect TypeScript projects', () => {
      const tsRepository = {
        ...mockProcessedRepository,
        content: 'interface User { name: string; } const user: User = { name: "test" };'
      };

      const complexity = (AIAnalysisEngine as any).calculateRepositoryComplexity(tsRepository);
      expect(complexity.technologyStack).toContain('typescript');
    });

    it('should detect multiple frameworks', () => {
      const multiFrameworkRepo = {
        ...mockProcessedRepository,
        content: 'import React from "react"; import Vue from "vue"; import express from "express";'
      };

      const complexity = (AIAnalysisEngine as any).calculateRepositoryComplexity(multiFrameworkRepo);
      expect(complexity.frameworksUsed).toEqual(expect.arrayContaining(['react', 'vue', 'express']));
    });
  });

  describe('detectTechnologyStack', () => {
    it('should detect JavaScript/TypeScript', () => {
      const jsContent = 'const app = express(); app.listen(3000);';
      const technologies = (AIAnalysisEngine as any).detectTechnologyStack(jsContent);
      expect(technologies).toContain('javascript');

      const tsContent = 'interface User { name: string; } tsconfig.json';
      const tsTechnologies = (AIAnalysisEngine as any).detectTechnologyStack(tsContent);
      expect(tsTechnologies).toContain('typescript');
    });

    it('should detect CSS preprocessors', () => {
      const sassContent = 'styles.scss $primary-color: blue;';
      const technologies = (AIAnalysisEngine as any).detectTechnologyStack(sassContent);
      expect(technologies).toContain('sass');

      const tailwindContent = 'class="bg-blue-500 text-white" tailwind';
      const tailwindTechnologies = (AIAnalysisEngine as any).detectTechnologyStack(tailwindContent);
      expect(tailwindTechnologies).toContain('tailwindcss');
    });

    it('should detect package managers', () => {
      const npmContent = 'package.json { "dependencies": {} }';
      const technologies = (AIAnalysisEngine as any).detectTechnologyStack(npmContent);
      expect(technologies).toContain('npm');

      const yarnContent = 'yarn.lock # yarn lockfile';
      const yarnTechnologies = (AIAnalysisEngine as any).detectTechnologyStack(yarnContent);
      expect(yarnTechnologies).toContain('yarn');
    });
  });

  describe('extractWebPlatformFeatures', () => {
    it('should extract Web API features', () => {
      const content = `
        fetch('/api/data');
        new WebSocket('ws://localhost');
        localStorage.setItem('key', 'value');
        new Notification('Hello');
      `;

      const features = (AIAnalysisEngine as any).extractWebPlatformFeatures(content);
      expect(features).toEqual(expect.arrayContaining([
        'fetch-api',
        'websockets',
        'web-storage',
        'notifications'
      ]));
    });

    it('should extract CSS features', () => {
      const content = `
        .container { display: grid; }
        .flex { display: flex; }
        .animated { animation: slide 1s; }
        :root { --primary: blue; }
      `;

      const features = (AIAnalysisEngine as any).extractWebPlatformFeatures(content);
      expect(features).toEqual(expect.arrayContaining([
        'css-grid',
        'flexbox',
        'css-animations',
        'css-custom-properties'
      ]));
    });

    it('should extract JavaScript features', () => {
      const content = `
        async function getData() {
          const result = await fetch('/api');
          return result.json();
        }
        
        const users = new Map();
        const { name, age } = user;
        export default component;
      `;

      const features = (AIAnalysisEngine as any).extractWebPlatformFeatures(content);
      expect(features).toEqual(expect.arrayContaining([
        'async-functions',
        'async-await',
        'es6-collections',
        'destructuring',
        'es-modules'
      ]));
    });
  });

  describe('estimateAnalysisCost', () => {
    it('should estimate cost based on repository metadata', () => {
      const cost = AIAnalysisEngine.estimateAnalysisCost(mockProcessedRepository.metadata);
      expect(cost).toBe(5); // Based on mocked calculateAnalysisCost
      expect(mockCreditService.calculateAnalysisCost).toHaveBeenCalledWith({
        repositorySize: 1024, // 1MB converted to KB
        fileCount: 25,
        complexity: 5 // Average complexity
      });
    });
  });

  describe('validateAnalysisRequest', () => {
    it('should validate valid request', () => {
      const validation = AIAnalysisEngine.validateAnalysisRequest(mockAnalysisRequest);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject request without repository content', () => {
      const invalidRequest = {
        ...mockAnalysisRequest,
        repositoryContent: null as any
      };

      const validation = AIAnalysisEngine.validateAnalysisRequest(invalidRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Repository content is required');
    });

    it('should reject request without user ID', () => {
      const invalidRequest = {
        ...mockAnalysisRequest,
        userId: ''
      };

      const validation = AIAnalysisEngine.validateAnalysisRequest(invalidRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('User ID is required');
    });

    it('should reject request with empty repository content', () => {
      const invalidRequest = {
        ...mockAnalysisRequest,
        repositoryContent: {
          ...mockProcessedRepository,
          content: ''
        }
      };

      const validation = AIAnalysisEngine.validateAnalysisRequest(invalidRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Repository content is empty');
    });

    it('should reject request with no files', () => {
      const invalidRequest = {
        ...mockAnalysisRequest,
        repositoryContent: {
          ...mockProcessedRepository,
          metadata: {
            ...mockProcessedRepository.metadata,
            fileCount: 0
          }
        }
      };

      const validation = AIAnalysisEngine.validateAnalysisRequest(invalidRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Repository has no processable files');
    });
  });
});