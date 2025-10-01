export enum AIProvider {
  OPENAI = 'OPENAI',
  GEMINI = 'GEMINI',
  CLAUDE = 'CLAUDE',
  QWEN = 'QWEN',
  OPENROUTER = 'OPENROUTER'
}

export interface AIProviderConfig {
  id: string
  organizationId: string
  provider: AIProvider
  name: string
  apiKey: string
  baseUrl?: string
  model?: string
  maxTokens?: number
  temperature?: number
  isEnabled: boolean
  priority: number
  costPerToken?: number
  createdAt: Date
  updatedAt: Date
}

export interface AIProviderCreateInput {
  organizationId: string
  provider: AIProvider
  name: string
  apiKey: string
  baseUrl?: string
  model?: string
  maxTokens?: number
  temperature?: number
  isEnabled?: boolean
  priority?: number
  costPerToken?: number
}

export interface AIProviderUpdateInput {
  name?: string
  apiKey?: string
  baseUrl?: string
  model?: string
  maxTokens?: number
  temperature?: number
  isEnabled?: boolean
  priority?: number
  costPerToken?: number
}

export interface AIAnalysisRequest {
  repositoryContent: string
  baselineData: any[]
  organizationId: string
}

export interface AIAnalysisResponse {
  complianceScore: number
  recommendations: Recommendation[]
  baselineMatches: BaselineMatch[]
  issues: Issue[]
  tokensUsed: number
  provider: string
  model: string
  processingTime: number
}

export interface Recommendation {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: string
  actionItems: string[]
  resources: string[]
}

export interface BaselineMatch {
  feature: string
  status: 'baseline' | 'limited' | 'not-baseline'
  confidence: number
  description: string
  documentation?: string
}

export interface Issue {
  id: string
  type: 'error' | 'warning' | 'info'
  title: string
  description: string
  file?: string
  line?: number
  suggestion?: string
}

export interface AIProviderCapabilities {
  maxTokens: number
  supportedModels: string[]
  costPerToken: number
  supportsStreaming: boolean
  supportsVision: boolean
  rateLimit: {
    requestsPerMinute: number
    tokensPerMinute: number
  }
}

export const AI_PROVIDER_DEFAULTS: Record<AIProvider, Partial<AIProviderConfig> & { capabilities: AIProviderCapabilities }> = {
  [AIProvider.OPENAI]: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.7,
    costPerToken: 0.03, // Per 1000 tokens
    capabilities: {
      maxTokens: 128000,
      supportedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      costPerToken: 0.03,
      supportsStreaming: true,
      supportsVision: true,
      rateLimit: {
        requestsPerMinute: 500,
        tokensPerMinute: 160000
      }
    }
  },
  [AIProvider.GEMINI]: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-1.5-pro',
    maxTokens: 8192,
    temperature: 0.7,
    costPerToken: 0.0035,
    capabilities: {
      maxTokens: 2097152,
      supportedModels: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
      costPerToken: 0.0035,
      supportsStreaming: true,
      supportsVision: true,
      rateLimit: {
        requestsPerMinute: 300,
        tokensPerMinute: 32000
      }
    }
  },
  [AIProvider.CLAUDE]: {
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 8192,
    temperature: 0.7,
    costPerToken: 0.015,
    capabilities: {
      maxTokens: 200000,
      supportedModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
      costPerToken: 0.015,
      supportsStreaming: true,
      supportsVision: true,
      rateLimit: {
        requestsPerMinute: 50,
        tokensPerMinute: 40000
      }
    }
  },
  [AIProvider.QWEN]: {
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    model: 'qwen-turbo',
    maxTokens: 6000,
    temperature: 0.7,
    costPerToken: 0.002,
    capabilities: {
      maxTokens: 30000,
      supportedModels: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
      costPerToken: 0.002,
      supportsStreaming: true,
      supportsVision: false,
      rateLimit: {
        requestsPerMinute: 100,
        tokensPerMinute: 20000
      }
    }
  },
  [AIProvider.OPENROUTER]: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3.5-sonnet',
    maxTokens: 4096,
    temperature: 0.7,
    costPerToken: 0.015,
    capabilities: {
      maxTokens: 200000,
      supportedModels: [
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
        'google/gemini-pro-1.5',
        'meta-llama/llama-3.1-405b-instruct'
      ],
      costPerToken: 0.015,
      supportsStreaming: true,
      supportsVision: true,
      rateLimit: {
        requestsPerMinute: 200,
        tokensPerMinute: 40000
      }
    }
  }
}