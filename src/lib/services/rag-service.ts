import { baselineDataService } from './baseline-data-service';
import { BaselineFeature, SimilaritySearchResult } from '@/lib/types/baseline';

export interface RAGContext {
  query: string;
  relevantFeatures: SimilaritySearchResult[];
  contextText: string;
}

export interface RAGResponse {
  answer: string;
  sources: BaselineFeature[];
  confidence: number;
}

export class RAGService {
  private static instance: RAGService;

  static getInstance(): RAGService {
    if (!RAGService.instance) {
      RAGService.instance = new RAGService();
    }
    return RAGService.instance;
  }

  /**
   * Retrieve relevant baseline data for a given query
   */
  async retrieveContext(query: string, maxResults: number = 5): Promise<RAGContext> {
    try {
      // Search for similar baseline features
      const relevantFeatures = await baselineDataService.searchSimilar(
        query,
        maxResults,
        0.6 // Lower threshold for broader context
      );

      // Create context text from relevant features
      const contextText = this.buildContextText(relevantFeatures);

      return {
        query,
        relevantFeatures,
        contextText,
      };
    } catch (error) {
      console.error('Error retrieving RAG context:', error);
      throw new Error(`Failed to retrieve context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build context text from relevant features
   */
  private buildContextText(features: SimilaritySearchResult[]): string {
    if (features.length === 0) {
      return 'No relevant baseline data found.';
    }

    const contextParts = features.map((result, index) => {
      const feature = result.feature;
      const similarity = (result.similarity * 100).toFixed(1);
      
      return [
        `[${index + 1}] ${feature.feature} (${similarity}% relevant)`,
        `Category: ${feature.category || 'Unknown'}`,
        `Status: ${feature.status || 'Unknown'}`,
        feature.description ? `Description: ${feature.description}` : '',
        feature.documentation ? `Documentation: ${feature.documentation}` : '',
        feature.browserSupport ? `Browser Support: ${this.formatBrowserSupport(feature.browserSupport)}` : '',
        '', // Empty line for separation
      ].filter(Boolean).join('\n');
    });

    return [
      'Relevant Web Platform Baseline Data:',
      '',
      ...contextParts,
    ].join('\n');
  }

  /**
   * Format browser support information
   */
  private formatBrowserSupport(support: any): string {
    if (!support || typeof support !== 'object') {
      return 'Unknown';
    }

    const browsers = ['chrome', 'firefox', 'safari', 'edge'];
    const supportInfo = browsers
      .map(browser => {
        const version = support[browser];
        return version ? `${browser}: ${version}` : null;
      })
      .filter(Boolean);

    return supportInfo.length > 0 ? supportInfo.join(', ') : 'Unknown';
  }

  /**
   * Generate analysis prompt with RAG context
   */
  async generateAnalysisPrompt(
    repositoryContent: string,
    analysisType: 'compatibility' | 'recommendations' | 'full' = 'full'
  ): Promise<string> {
    try {
      // Extract key technologies and features from repository content
      const extractedFeatures = this.extractTechnologies(repositoryContent);
      
      // Get relevant baseline data for each extracted feature
      const contextPromises = extractedFeatures.map(feature =>
        this.retrieveContext(feature, 3)
      );
      
      const contexts = await Promise.all(contextPromises);
      
      // Combine all context
      const combinedContext = contexts
        .map(ctx => ctx.contextText)
        .join('\n\n---\n\n');

      // Generate the analysis prompt based on type
      return this.buildAnalysisPrompt(repositoryContent, combinedContext, analysisType);
    } catch (error) {
      console.error('Error generating analysis prompt:', error);
      throw new Error(`Failed to generate analysis prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract technologies and features from repository content
   */
  private extractTechnologies(content: string): string[] {
    const technologies = new Set<string>();
    
    // Common web technologies and APIs
    const patterns = [
      // JavaScript APIs
      /fetch\s*\(/gi,
      /WebSocket/gi,
      /localStorage/gi,
      /sessionStorage/gi,
      /IndexedDB/gi,
      /ServiceWorker/gi,
      /WebRTC/gi,
      /WebGL/gi,
      /Canvas/gi,
      /WebAudio/gi,
      /Geolocation/gi,
      /Notification/gi,
      /IntersectionObserver/gi,
      /MutationObserver/gi,
      /ResizeObserver/gi,
      
      // CSS features
      /grid/gi,
      /flexbox/gi,
      /transform/gi,
      /animation/gi,
      /transition/gi,
      /custom-properties/gi,
      /css-variables/gi,
      
      // HTML features
      /web-components/gi,
      /custom-elements/gi,
      /shadow-dom/gi,
      /template/gi,
      
      // Modern JavaScript features
      /async\/await/gi,
      /Promise/gi,
      /arrow-functions/gi,
      /destructuring/gi,
      /modules/gi,
      /import/gi,
      /export/gi,
    ];

    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          technologies.add(match.toLowerCase().replace(/[^a-z0-9-]/g, ''));
        });
      }
    });

    // Add some general web platform features
    technologies.add('web platform');
    technologies.add('browser compatibility');
    technologies.add('modern web standards');

    return Array.from(technologies).slice(0, 10); // Limit to top 10
  }

  /**
   * Build the analysis prompt with context
   */
  private buildAnalysisPrompt(
    repositoryContent: string,
    context: string,
    analysisType: 'compatibility' | 'recommendations' | 'full'
  ): string {
    const basePrompt = `
You are a web platform expert analyzing a code repository for compatibility with modern web standards and baseline browser support.

BASELINE DATA CONTEXT:
${context}

REPOSITORY CONTENT:
${repositoryContent.substring(0, 8000)} ${repositoryContent.length > 8000 ? '...[truncated]' : ''}

ANALYSIS INSTRUCTIONS:
`;

    switch (analysisType) {
      case 'compatibility':
        return basePrompt + `
Focus on browser compatibility analysis:
1. Identify web platform features used in the code
2. Check compatibility against the baseline data provided
3. Highlight any features that may not be widely supported
4. Provide specific browser version requirements
5. Suggest fallbacks or polyfills where needed

Format your response as JSON with:
- compatibilityScore (0-100)
- supportedFeatures: array of features with good baseline support
- unsupportedFeatures: array of features with limited or no baseline support
- recommendations: array of specific actions to improve compatibility
`;

      case 'recommendations':
        return basePrompt + `
Focus on actionable recommendations:
1. Analyze the code against modern web standards
2. Identify opportunities to use baseline-supported features
3. Suggest improvements for better browser compatibility
4. Recommend modern alternatives to outdated practices
5. Prioritize recommendations by impact and effort

Format your response as JSON with:
- recommendations: array of objects with {title, description, priority, effort, impact}
- modernizationOpportunities: array of features that could be upgraded
- bestPractices: array of web platform best practices to implement
`;

      case 'full':
      default:
        return basePrompt + `
Provide a comprehensive analysis:
1. Overall compatibility assessment with baseline browser support
2. Detailed feature-by-feature analysis
3. Specific recommendations for improvements
4. Risk assessment for unsupported features
5. Roadmap for modernization

Format your response as JSON with:
- summary: overall assessment
- compatibilityScore: 0-100 score
- featureAnalysis: detailed breakdown of each feature found
- recommendations: prioritized list of improvements
- riskAssessment: potential issues and their severity
- modernizationRoadmap: step-by-step improvement plan
`;
    }
  }

  /**
   * Get baseline data for specific features
   */
  async getFeatureBaseline(features: string[]): Promise<BaselineFeature[]> {
    try {
      const results: BaselineFeature[] = [];
      
      for (const feature of features) {
        const searchResults = await baselineDataService.searchSimilar(feature, 1, 0.8);
        if (searchResults.length > 0) {
          results.push(searchResults[0].feature);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error getting feature baseline:', error);
      throw new Error(`Failed to get feature baseline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a feature has baseline support
   */
  async checkFeatureSupport(feature: string): Promise<{
    isSupported: boolean;
    status: string;
    confidence: number;
    details?: BaselineFeature;
  }> {
    try {
      const results = await baselineDataService.searchSimilar(feature, 1, 0.7);
      
      if (results.length === 0) {
        return {
          isSupported: false,
          status: 'unknown',
          confidence: 0,
        };
      }

      const result = results[0];
      const isSupported = result.feature.status === 'baseline';
      
      return {
        isSupported,
        status: result.feature.status || 'unknown',
        confidence: result.similarity,
        details: result.feature,
      };
    } catch (error) {
      console.error('Error checking feature support:', error);
      return {
        isSupported: false,
        status: 'error',
        confidence: 0,
      };
    }
  }
}

export const ragService = RAGService.getInstance();