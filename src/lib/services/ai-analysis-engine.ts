import { AIProviderService } from './ai-provider-service';
import { ragService } from './rag-service';
import { CreditService, CreditCalculationParams } from './credit-service';
import { ProcessedRepository } from '@/lib/types/repository';
import { AIAnalysisRequest, AIAnalysisResponse } from '@/lib/types/ai-provider';
import { BaselineFeature } from '@/lib/types/baseline';
import { prisma } from '@/lib/database';

export interface AnalysisEngineRequest {
  repositoryContent: ProcessedRepository;
  userId: string;
  organizationId: string;
  analysisType?: 'compatibility' | 'recommendations' | 'full';
}

export interface AnalysisEngineResponse extends AIAnalysisResponse {
  creditsCost: number;
  analysisId: string;
  repositoryMetadata: ProcessedRepository['metadata'];
}

export interface RepositoryComplexityMetrics {
  fileCount: number;
  totalSize: number;
  codeComplexity: number; // 1-10 scale
  technologyStack: string[];
  frameworksUsed: string[];
  apiUsageCount: number;
}

export class AIAnalysisEngine {
  /**
   * Perform comprehensive repository analysis
   */
  static async analyzeRepository(request: AnalysisEngineRequest): Promise<AnalysisEngineResponse> {
    const { repositoryContent, userId, organizationId, analysisType = 'full' } = request;
    
    try {
      // Step 1: Calculate complexity and credit cost
      const complexityMetrics = this.calculateRepositoryComplexity(repositoryContent);
      const creditParams: CreditCalculationParams = {
        repositorySize: Math.round(repositoryContent.metadata.totalSize / 1024), // Convert to KB
        fileCount: repositoryContent.metadata.fileCount,
        complexity: complexityMetrics.codeComplexity
      };
      const creditsCost = CreditService.calculateAnalysisCost(creditParams);

      // Step 2: Check and deduct credits
      const hasCredits = await CreditService.hasSufficientCredits(userId, creditsCost);
      if (!hasCredits) {
        throw new Error('Insufficient credits for analysis');
      }

      const deductionResult = await CreditService.deductCredits(
        userId,
        creditsCost,
        `Repository analysis: ${repositoryContent.metadata.repositoryName}`,
        {
          repositoryUrl: repositoryContent.metadata.repositoryUrl,
          analysisType,
          complexity: complexityMetrics.codeComplexity,
          fileCount: repositoryContent.metadata.fileCount
        }
      );

      if (!deductionResult.success) {
        throw new Error(deductionResult.error || 'Failed to deduct credits');
      }

      // Step 3: Generate RAG-enhanced analysis prompt
      const analysisPrompt = await ragService.generateAnalysisPrompt(
        repositoryContent.content,
        analysisType
      );

      // Step 4: Retrieve relevant baseline data for context
      const baselineContext = await this.getBaselineContext(repositoryContent.content);

      // Step 5: Perform AI analysis
      const aiRequest: AIAnalysisRequest = {
        repositoryContent: analysisPrompt,
        baselineData: baselineContext,
        organizationId
      };

      const aiResponse = await AIProviderService.performAnalysis(aiRequest);

      // Step 6: Enhance analysis results with additional insights
      const enhancedResults = await this.enhanceAnalysisResults(
        aiResponse,
        complexityMetrics,
        baselineContext
      );

      // Step 7: Store analysis results in database
      const analysisId = crypto.randomUUID();
      
      await prisma.repositoryAnalysis.create({
        data: {
          id: analysisId,
          userId,
          organizationId,
          repositoryUrl: repositoryContent.metadata.repositoryUrl,
          repositoryName: repositoryContent.metadata.repositoryName,
          status: 'COMPLETED',
          creditsCost,
          results: JSON.parse(JSON.stringify({
            complianceScore: enhancedResults.complianceScore,
            recommendations: enhancedResults.recommendations,
            baselineMatches: enhancedResults.baselineMatches,
            issues: enhancedResults.issues,
            tokensUsed: enhancedResults.tokensUsed,
            provider: enhancedResults.provider,
            model: enhancedResults.model,
            processingTime: enhancedResults.processingTime
          })),
          metadata: JSON.parse(JSON.stringify({
            repositorySize: repositoryContent.metadata.totalSize,
            fileCount: repositoryContent.metadata.fileCount,
            processingTime: repositoryContent.metadata.processingTime,
            aiProvider: enhancedResults.provider,
            complexity: complexityMetrics.codeComplexity,
            technologyStack: complexityMetrics.technologyStack,
            frameworksUsed: complexityMetrics.frameworksUsed,
            apiUsageCount: complexityMetrics.apiUsageCount
          }))
        }
      });

      return {
        ...enhancedResults,
        creditsCost,
        analysisId,
        repositoryMetadata: repositoryContent.metadata
      };

    } catch (error) {
      // If analysis fails after credits were deducted, we should consider refunding
      // For now, we'll log the error and let the user know
      console.error('Analysis failed:', error);
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate repository complexity metrics
   */
  private static calculateRepositoryComplexity(repository: ProcessedRepository): RepositoryComplexityMetrics {
    const content = repository.content;
    const metadata = repository.metadata;

    // Analyze technology stack
    const technologyStack = this.detectTechnologyStack(content);
    const frameworksUsed = this.detectFrameworks(content);
    const apiUsageCount = this.countAPIUsage(content);

    // Calculate complexity score (1-10)
    let complexityScore = 1;

    // File count factor
    if (metadata.fileCount > 100) complexityScore += 2;
    else if (metadata.fileCount > 50) complexityScore += 1;

    // Size factor
    const sizeInMB = metadata.totalSize / (1024 * 1024);
    if (sizeInMB > 10) complexityScore += 2;
    else if (sizeInMB > 5) complexityScore += 1;

    // Technology complexity
    if (frameworksUsed.length > 2) complexityScore += 1;
    if (technologyStack.includes('typescript')) complexityScore += 1;
    if (apiUsageCount > 20) complexityScore += 1;

    // Build tools complexity
    if (this.hasBuildTools(content)) complexityScore += 1;

    // Cap at 10
    complexityScore = Math.min(complexityScore, 10);

    return {
      fileCount: metadata.fileCount,
      totalSize: metadata.totalSize,
      codeComplexity: complexityScore,
      technologyStack,
      frameworksUsed,
      apiUsageCount
    };
  }

  /**
   * Detect technology stack from repository content
   */
  private static detectTechnologyStack(content: string): string[] {
    const technologies: string[] = [];
    
    // JavaScript/TypeScript
    if (content.includes('typescript') || content.includes('.ts') || content.includes('tsconfig') || 
        content.includes('interface ') || content.includes(': string') || content.includes(': number')) {
      technologies.push('typescript');
    }
    
    if (content.includes('javascript') || content.includes('.js') || content.includes('const ') || 
        content.includes('function ') || content.includes('var ') || content.includes('let ')) {
      technologies.push('javascript');
    }

    // CSS preprocessors
    if (content.includes('.scss') || content.includes('sass') || content.includes('$')) technologies.push('sass');
    if (content.includes('.less')) technologies.push('less');
    if (content.includes('tailwind') || content.includes('bg-') || content.includes('text-')) technologies.push('tailwindcss');

    // Package managers
    if (content.includes('package.json')) technologies.push('npm');
    if (content.includes('yarn.lock')) technologies.push('yarn');
    if (content.includes('pnpm-lock')) technologies.push('pnpm');

    // Testing
    if (content.includes('jest') || content.includes('.test.') || content.includes('.spec.') ||
        content.includes('describe(') || content.includes('it(') || content.includes('expect(')) {
      technologies.push('testing');
    }

    return technologies;
  }

  /**
   * Detect frameworks from repository content
   */
  private static detectFrameworks(content: string): string[] {
    const frameworks: string[] = [];
    
    if (content.includes('react') || content.includes('jsx')) frameworks.push('react');
    if (content.includes('vue')) frameworks.push('vue');
    if (content.includes('angular')) frameworks.push('angular');
    if (content.includes('svelte')) frameworks.push('svelte');
    if (content.includes('next.js') || content.includes('next/')) frameworks.push('nextjs');
    if (content.includes('nuxt')) frameworks.push('nuxt');
    if (content.includes('gatsby')) frameworks.push('gatsby');
    if (content.includes('express')) frameworks.push('express');
    if (content.includes('fastify')) frameworks.push('fastify');

    return frameworks;
  }

  /**
   * Count API usage in repository
   */
  private static countAPIUsage(content: string): number {
    const apiPatterns = [
      /fetch\s*\(/g,
      /XMLHttpRequest/g,
      /axios\./g,
      /\.get\s*\(/g,
      /\.post\s*\(/g,
      /\.put\s*\(/g,
      /\.delete\s*\(/g,
      /WebSocket/g,
      /EventSource/g,
      /navigator\./g,
      /window\./g,
      /document\./g,
      /localStorage/g,
      /sessionStorage/g,
      /IndexedDB/g
    ];

    let totalCount = 0;
    apiPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        totalCount += matches.length;
      }
    });

    return totalCount;
  }

  /**
   * Check if repository has build tools
   */
  private static hasBuildTools(content: string): boolean {
    const buildToolPatterns = [
      'webpack.config',
      'vite.config',
      'rollup.config',
      'parcel',
      'esbuild',
      'turbopack',
      'babel.config',
      'postcss.config'
    ];

    return buildToolPatterns.some(pattern => content.includes(pattern));
  }

  /**
   * Get relevant baseline context for analysis
   */
  private static async getBaselineContext(repositoryContent: string): Promise<BaselineFeature[]> {
    try {
      // Extract key features from repository content
      const extractedFeatures = this.extractWebPlatformFeatures(repositoryContent);
      
      // Get baseline data for each feature
      const baselineFeatures = await ragService.getFeatureBaseline(extractedFeatures);
      
      return baselineFeatures;
    } catch (error) {
      console.error('Error getting baseline context:', error);
      return [];
    }
  }

  /**
   * Extract web platform features from repository content
   */
  private static extractWebPlatformFeatures(content: string): string[] {
    const features = new Set<string>();

    // Web APIs
    const webApiPatterns = [
      { pattern: /fetch\s*\(/gi, feature: 'fetch-api' },
      { pattern: /WebSocket/gi, feature: 'websockets' },
      { pattern: /localStorage/gi, feature: 'web-storage' },
      { pattern: /sessionStorage/gi, feature: 'web-storage' },
      { pattern: /IndexedDB/gi, feature: 'indexeddb' },
      { pattern: /ServiceWorker/gi, feature: 'service-workers' },
      { pattern: /navigator\.geolocation/gi, feature: 'geolocation' },
      { pattern: /Notification/gi, feature: 'notifications' },
      { pattern: /WebRTC/gi, feature: 'webrtc' },
      { pattern: /WebGL/gi, feature: 'webgl' },
      { pattern: /Canvas/gi, feature: 'canvas' },
      { pattern: /WebAudio/gi, feature: 'web-audio' },
      { pattern: /IntersectionObserver/gi, feature: 'intersection-observer' },
      { pattern: /MutationObserver/gi, feature: 'mutation-observer' },
      { pattern: /ResizeObserver/gi, feature: 'resize-observer' },
      { pattern: /requestAnimationFrame/gi, feature: 'animation-frame' },
      { pattern: /history\.pushState/gi, feature: 'history-api' },
      { pattern: /navigator\.share/gi, feature: 'web-share' },
      { pattern: /navigator\.clipboard/gi, feature: 'clipboard-api' }
    ];

    // CSS features
    const cssPatterns = [
      { pattern: /display:\s*grid/gi, feature: 'css-grid' },
      { pattern: /display:\s*flex/gi, feature: 'flexbox' },
      { pattern: /transform:/gi, feature: 'css-transforms' },
      { pattern: /@media/gi, feature: 'media-queries' },
      { pattern: /animation:/gi, feature: 'css-animations' },
      { pattern: /transition:/gi, feature: 'css-transitions' },
      { pattern: /--[\w-]+:/gi, feature: 'css-custom-properties' },
      { pattern: /calc\(/gi, feature: 'css-calc' },
      { pattern: /:root/gi, feature: 'css-custom-properties' },
      { pattern: /backdrop-filter:/gi, feature: 'backdrop-filter' },
      { pattern: /clip-path:/gi, feature: 'css-clip-path' }
    ];

    // JavaScript features
    const jsPatterns = [
      { pattern: /async\s+function/gi, feature: 'async-functions' },
      { pattern: /await\s+/gi, feature: 'async-await' },
      { pattern: /Promise\./gi, feature: 'promises' },
      { pattern: /=>/gi, feature: 'arrow-functions' },
      { pattern: /const\s+\{/gi, feature: 'destructuring' },
      { pattern: /import\s+/gi, feature: 'es-modules' },
      { pattern: /export\s+/gi, feature: 'es-modules' },
      { pattern: /class\s+\w+/gi, feature: 'es6-classes' },
      { pattern: /\.\.\./gi, feature: 'spread-operator' },
      { pattern: /Map\(/gi, feature: 'es6-collections' },
      { pattern: /Set\(/gi, feature: 'es6-collections' },
      { pattern: /Symbol\(/gi, feature: 'symbols' }
    ];

    // Apply all patterns
    [...webApiPatterns, ...cssPatterns, ...jsPatterns].forEach(({ pattern, feature }) => {
      if (pattern.test(content)) {
        features.add(feature);
      }
    });

    return Array.from(features);
  }

  /**
   * Enhance analysis results with additional insights
   */
  private static async enhanceAnalysisResults(
    aiResponse: AIAnalysisResponse,
    complexityMetrics: RepositoryComplexityMetrics,
    baselineContext: BaselineFeature[]
  ): Promise<AIAnalysisResponse> {
    // Add complexity-based insights to recommendations
    const enhancedRecommendations = [...aiResponse.recommendations];

    // Add technology-specific recommendations
    if (complexityMetrics.technologyStack.includes('typescript')) {
      enhancedRecommendations.push({
        id: 'typescript-baseline',
        title: 'TypeScript Baseline Compatibility',
        description: 'Ensure TypeScript compilation targets baseline-compatible JavaScript features',
        priority: 'medium',
        category: 'build-tools',
        actionItems: [
          'Review tsconfig.json target and lib settings',
          'Ensure compiled output uses baseline-compatible features',
          'Consider using @babel/preset-env for better browser targeting'
        ],
        resources: [
          'https://www.typescriptlang.org/tsconfig#target',
          'https://web.dev/baseline/'
        ]
      });
    }

    // Add framework-specific recommendations
    complexityMetrics.frameworksUsed.forEach(framework => {
      if (framework === 'react') {
        enhancedRecommendations.push({
          id: 'react-baseline',
          title: 'React Baseline Compatibility',
          description: 'Optimize React application for baseline browser support',
          priority: 'medium',
          category: 'framework',
          actionItems: [
            'Use React 18+ features that are baseline-compatible',
            'Implement proper polyfills for older browsers',
            'Consider using React.lazy for code splitting'
          ],
          resources: [
            'https://react.dev/learn',
            'https://web.dev/baseline/'
          ]
        });
      }
    });

    // Add baseline feature matches from context
    const enhancedBaselineMatches = [...aiResponse.baselineMatches];
    baselineContext.forEach(feature => {
      if (!enhancedBaselineMatches.find(match => match.feature === feature.feature)) {
        const validStatus = ['baseline', 'limited', 'not-baseline'].includes(feature.status || '') 
          ? feature.status as 'baseline' | 'limited' | 'not-baseline'
          : 'not-baseline';
          
        enhancedBaselineMatches.push({
          feature: feature.feature,
          status: validStatus,
          confidence: 0.8, // High confidence since it's from our baseline data
          description: feature.description || '',
          documentation: feature.documentation
        });
      }
    });

    // Adjust compliance score based on complexity
    let adjustedScore = aiResponse.complianceScore;
    if (complexityMetrics.codeComplexity > 7) {
      adjustedScore = Math.max(adjustedScore - 5, 0); // Penalize high complexity
    }

    return {
      ...aiResponse,
      complianceScore: adjustedScore,
      recommendations: enhancedRecommendations,
      baselineMatches: enhancedBaselineMatches
    };
  }

  /**
   * Get analysis cost estimate without performing analysis
   */
  static estimateAnalysisCost(repositoryMetadata: ProcessedRepository['metadata']): number {
    const creditParams: CreditCalculationParams = {
      repositorySize: Math.round(repositoryMetadata.totalSize / 1024), // Convert to KB
      fileCount: repositoryMetadata.fileCount,
      complexity: 5 // Average complexity for estimation
    };

    return CreditService.calculateAnalysisCost(creditParams);
  }

  /**
   * Validate analysis request
   */
  static validateAnalysisRequest(request: AnalysisEngineRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.repositoryContent) {
      errors.push('Repository content is required');
    }

    if (!request.userId) {
      errors.push('User ID is required');
    }

    if (!request.organizationId) {
      errors.push('Organization ID is required');
    }

    if (request.repositoryContent && !request.repositoryContent.content) {
      errors.push('Repository content is empty');
    }

    if (request.repositoryContent && request.repositoryContent.metadata.fileCount === 0) {
      errors.push('Repository has no processable files');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}