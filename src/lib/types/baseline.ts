export interface BaselineFeature {
  id: string;
  feature: string;
  category?: string;
  status?: 'baseline' | 'limited' | 'not-baseline';
  description?: string;
  documentation?: string;
  browserSupport?: BrowserSupport;
  lastUpdated: Date;
  embedding?: number[];
}

export interface BrowserSupport {
  chrome?: string;
  firefox?: string;
  safari?: string;
  edge?: string;
  [key: string]: string | undefined;
}

export interface BaselineDataSource {
  url: string;
  features: BaselineFeature[];
  lastFetched: Date;
}

export interface SimilaritySearchResult {
  feature: BaselineFeature;
  similarity: number;
}

export interface BaselineUpdateResult {
  success: boolean;
  featuresUpdated: number;
  featuresAdded: number;
  errors?: string[];
}

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}