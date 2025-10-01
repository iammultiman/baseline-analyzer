import { prisma } from '@/lib/database';
import { BaselineFeature, BaselineDataSource, SimilaritySearchResult, BaselineUpdateResult, EmbeddingRequest, EmbeddingResponse } from '@/lib/types/baseline';

export class BaselineDataService {
  private static instance: BaselineDataService;
  private readonly webDevApiUrl = 'https://web.dev/api/baseline';
  private readonly embeddingModel = 'text-embedding-3-small';

  static getInstance(): BaselineDataService {
    if (!BaselineDataService.instance) {
      BaselineDataService.instance = new BaselineDataService();
    }
    return BaselineDataService.instance;
  }

  /**
   * Fetch latest baseline data from web.dev API
   */
  async fetchLatestBaseline(): Promise<BaselineDataSource> {
    try {
      const response = await fetch(this.webDevApiUrl, {
        headers: {
          'User-Agent': 'Baseline-Analyzer/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch baseline data: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform the API response to our BaselineFeature format
      const features: BaselineFeature[] = this.transformWebDevData(data);

      return {
        url: this.webDevApiUrl,
        features,
        lastFetched: new Date(),
      };
    } catch (error) {
      console.error('Error fetching baseline data:', error);
      throw new Error(`Failed to fetch baseline data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transform web.dev API data to our BaselineFeature format
   */
  private transformWebDevData(data: any): BaselineFeature[] {
    const features: BaselineFeature[] = [];

    // Handle different possible API response formats
    if (data.features && Array.isArray(data.features)) {
      features.push(...data.features.map(this.mapFeatureData));
    } else if (Array.isArray(data)) {
      features.push(...data.map(this.mapFeatureData));
    } else if (data.baseline && Array.isArray(data.baseline)) {
      features.push(...data.baseline.map(this.mapFeatureData));
    }

    return features;
  }

  /**
   * Map individual feature data from web.dev API
   */
  private mapFeatureData = (item: any): BaselineFeature => {
    return {
      id: item.id || item.feature || item.name || crypto.randomUUID(),
      feature: item.feature || item.name || item.title || 'Unknown Feature',
      category: item.category || item.group || 'general',
      status: this.normalizeStatus(item.status || item.baseline_status),
      description: item.description || item.summary || '',
      documentation: item.documentation || item.mdn_url || item.spec_url || '',
      browserSupport: this.normalizeBrowserSupport(item.browser_support || item.support || {}),
      lastUpdated: new Date(),
    };
  };

  /**
   * Normalize status values to our enum
   */
  private normalizeStatus(status: string): 'baseline' | 'limited' | 'not-baseline' {
    if (!status) return 'not-baseline';
    
    const normalized = status.toLowerCase();
    if (normalized.includes('baseline') || normalized === 'widely_available') {
      return 'baseline';
    } else if (normalized.includes('limited') || normalized === 'newly_available') {
      return 'limited';
    }
    return 'not-baseline';
  }

  /**
   * Normalize browser support data
   */
  private normalizeBrowserSupport(support: any): any {
    if (!support || typeof support !== 'object') {
      return {};
    }

    return {
      chrome: support.chrome || support.Chrome || support.google_chrome,
      firefox: support.firefox || support.Firefox || support.mozilla_firefox,
      safari: support.safari || support.Safari || support.webkit_safari,
      edge: support.edge || support.Edge || support.microsoft_edge,
      ...support,
    };
  }

  /**
   * Generate vector embeddings for baseline features
   */
  async generateEmbeddings(features: BaselineFeature[]): Promise<BaselineFeature[]> {
    const featuresWithEmbeddings: BaselineFeature[] = [];

    for (const feature of features) {
      try {
        const text = this.createEmbeddingText(feature);
        const embedding = await this.getEmbedding(text);
        
        featuresWithEmbeddings.push({
          ...feature,
          embedding,
        });
      } catch (error) {
        console.error(`Failed to generate embedding for feature ${feature.feature}:`, error);
        // Add feature without embedding to avoid losing data
        featuresWithEmbeddings.push(feature);
      }
    }

    return featuresWithEmbeddings;
  }

  /**
   * Create text for embedding generation
   */
  private createEmbeddingText(feature: BaselineFeature): string {
    const parts = [
      feature.feature,
      feature.category,
      feature.description,
      feature.status,
    ].filter(Boolean);

    return parts.join(' ');
  }

  /**
   * Get embedding from OpenAI API
   */
  private async getEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: this.embeddingModel,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * Update vector database with new baseline data
   */
  async updateVectorDatabase(features: BaselineFeature[]): Promise<BaselineUpdateResult> {
    let featuresUpdated = 0;
    let featuresAdded = 0;
    const errors: string[] = [];

    try {
      // Generate embeddings for features that don't have them
      const featuresWithEmbeddings = await this.generateEmbeddings(features);

      for (const feature of featuresWithEmbeddings) {
        try {
          // Check if feature already exists
          const existing = await prisma.baselineData.findFirst({
            where: { feature: feature.feature },
          });

          if (existing) {
            // Update existing feature
            await prisma.baselineData.update({
              where: { id: existing.id },
              data: {
                category: feature.category,
                status: feature.status,
                description: feature.description,
                documentation: feature.documentation,
                browserSupport: feature.browserSupport,
                lastUpdated: feature.lastUpdated,
                // Note: Prisma doesn't support vector updates directly
                // We'll use raw SQL for embedding updates
              },
            });

            // Update embedding with raw SQL if available
            if (feature.embedding) {
              await prisma.$executeRaw`
                UPDATE baseline_data 
                SET embedding = ${JSON.stringify(feature.embedding)}::vector 
                WHERE id = ${existing.id}::uuid
              `;
            }

            featuresUpdated++;
          } else {
            // Create new feature
            const createData: any = {
              feature: feature.feature,
              category: feature.category,
              status: feature.status,
              description: feature.description,
              documentation: feature.documentation,
              browserSupport: feature.browserSupport,
              lastUpdated: feature.lastUpdated,
            };

            const newFeature = await prisma.baselineData.create({
              data: createData,
            });

            // Add embedding with raw SQL if available
            if (feature.embedding) {
              await prisma.$executeRaw`
                UPDATE baseline_data 
                SET embedding = ${JSON.stringify(feature.embedding)}::vector 
                WHERE id = ${newFeature.id}::uuid
              `;
            }

            featuresAdded++;
          }
        } catch (error) {
          const errorMsg = `Failed to process feature ${feature.feature}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      return {
        success: errors.length === 0,
        featuresUpdated,
        featuresAdded,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error('Error updating vector database:', error);
      return {
        success: false,
        featuresUpdated,
        featuresAdded,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Search for similar baseline features using vector similarity
   */
  async searchSimilar(query: string, limit: number = 10, threshold: number = 0.7): Promise<SimilaritySearchResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.getEmbedding(query);

      // Perform similarity search using pgvector
      const results = await prisma.$queryRaw<Array<{
        id: string;
        feature: string;
        category: string | null;
        status: string | null;
        description: string | null;
        documentation: string | null;
        browser_support: any;
        last_updated: Date;
        similarity: number;
      }>>`
        SELECT 
          id,
          feature,
          category,
          status,
          description,
          documentation,
          browser_support,
          last_updated,
          1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM baseline_data
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > ${threshold}
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `;

      return results.map(row => ({
        feature: {
          id: row.id,
          feature: row.feature,
          category: row.category || undefined,
          status: row.status as any,
          description: row.description || undefined,
          documentation: row.documentation || undefined,
          browserSupport: row.browser_support,
          lastUpdated: row.last_updated,
        },
        similarity: row.similarity,
      }));
    } catch (error) {
      console.error('Error performing similarity search:', error);
      throw new Error(`Similarity search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all baseline features from database
   */
  async getAllFeatures(): Promise<BaselineFeature[]> {
    try {
      const features = await prisma.baselineData.findMany({
        orderBy: { lastUpdated: 'desc' },
      });

      return features.map(feature => ({
        id: feature.id,
        feature: feature.feature,
        category: feature.category || undefined,
        status: feature.status as any,
        description: feature.description || undefined,
        documentation: feature.documentation || undefined,
        browserSupport: feature.browserSupport,
        lastUpdated: feature.lastUpdated,
      }));
    } catch (error) {
      console.error('Error fetching all features:', error);
      throw new Error(`Failed to fetch features: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get baseline features by category
   */
  async getFeaturesByCategory(category: string): Promise<BaselineFeature[]> {
    try {
      const features = await prisma.baselineData.findMany({
        where: { category },
        orderBy: { lastUpdated: 'desc' },
      });

      return features.map(feature => ({
        id: feature.id,
        feature: feature.feature,
        category: feature.category || undefined,
        status: feature.status as any,
        description: feature.description || undefined,
        documentation: feature.documentation || undefined,
        browserSupport: feature.browserSupport,
        lastUpdated: feature.lastUpdated,
      }));
    } catch (error) {
      console.error('Error fetching features by category:', error);
      throw new Error(`Failed to fetch features: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get baseline data statistics
   */
  async getStatistics() {
    try {
      const [total, byStatus, byCategory] = await Promise.all([
        prisma.baselineData.count(),
        prisma.baselineData.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        prisma.baselineData.groupBy({
          by: ['category'],
          _count: { category: true },
        }),
      ]);

      return {
        total,
        byStatus: byStatus.reduce((acc, item) => {
          if (item.status) {
            acc[item.status] = item._count.status;
          }
          return acc;
        }, {} as Record<string, number>),
        byCategory: byCategory.reduce((acc, item) => {
          if (item.category) {
            acc[item.category] = item._count.category;
          }
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      console.error('Error fetching statistics:', error);
      throw new Error(`Failed to fetch statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const baselineDataService = BaselineDataService.getInstance();