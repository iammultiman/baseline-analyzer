import { prisma } from '@/lib/database'
import {
  AIProvider,
  AIProviderConfig,
  AIProviderCreateInput,
  AIProviderUpdateInput,
  AIAnalysisRequest,
  AIAnalysisResponse,
  AI_PROVIDER_DEFAULTS
} from '@/lib/types/ai-provider'

export class AIProviderService {
  /**
   * Get all AI provider configurations for an organization
   */
  static async getProviderConfigs(organizationId: string): Promise<AIProviderConfig[]> {
    const configs = await prisma.aIProviderConfig.findMany({
      where: { organizationId },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    return configs.map(config => ({
      ...config,
      provider: config.provider as AIProvider
    }))
  }

  /**
   * Get enabled AI provider configurations for an organization, ordered by priority
   */
  static async getEnabledProviderConfigs(organizationId: string): Promise<AIProviderConfig[]> {
    const configs = await prisma.aIProviderConfig.findMany({
      where: { 
        organizationId,
        isEnabled: true
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    return configs.map(config => ({
      ...config,
      provider: config.provider as AIProvider
    }))
  }

  /**
   * Get a specific AI provider configuration
   */
  static async getProviderConfig(id: string): Promise<AIProviderConfig | null> {
    const config = await prisma.aIProviderConfig.findUnique({
      where: { id }
    })

    if (!config) return null

    return {
      ...config,
      provider: config.provider as AIProvider
    }
  }

  /**
   * Create a new AI provider configuration
   */
  static async createProviderConfig(input: AIProviderCreateInput): Promise<AIProviderConfig> {
    // Validate the provider type
    if (!Object.values(AIProvider).includes(input.provider)) {
      throw new Error(`Invalid AI provider: ${input.provider}`)
    }

    // Apply defaults for the provider
    const defaults = AI_PROVIDER_DEFAULTS[input.provider]
    
    const config = await prisma.aIProviderConfig.create({
      data: {
        organizationId: input.organizationId,
        provider: input.provider,
        name: input.name,
        apiKey: input.apiKey,
        baseUrl: input.baseUrl || defaults.baseUrl,
        model: input.model || defaults.model,
        maxTokens: input.maxTokens || defaults.maxTokens,
        temperature: input.temperature ?? defaults.temperature,
        isEnabled: input.isEnabled ?? true,
        priority: input.priority ?? 1,
        costPerToken: input.costPerToken ?? defaults.costPerToken
      }
    })

    return {
      ...config,
      provider: config.provider as AIProvider
    }
  }

  /**
   * Update an AI provider configuration
   */
  static async updateProviderConfig(id: string, input: AIProviderUpdateInput): Promise<AIProviderConfig> {
    const config = await prisma.aIProviderConfig.update({
      where: { id },
      data: {
        ...input,
        updatedAt: new Date()
      }
    })

    return {
      ...config,
      provider: config.provider as AIProvider
    }
  }

  /**
   * Delete an AI provider configuration
   */
  static async deleteProviderConfig(id: string): Promise<void> {
    await prisma.aIProviderConfig.delete({
      where: { id }
    })
  }

  /**
   * Test an AI provider configuration
   */
  static async testProviderConfig(config: AIProviderConfig): Promise<{ success: boolean; error?: string; latency?: number }> {
    const startTime = Date.now()
    
    try {
      const client = this.createProviderClient(config)
      await client.testConnection()
      
      return {
        success: true,
        latency: Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Select the best available AI provider for analysis
   */
  static async selectProvider(organizationId: string): Promise<AIProviderConfig | null> {
    const enabledConfigs = await this.getEnabledProviderConfigs(organizationId)
    
    if (enabledConfigs.length === 0) {
      return null
    }

    // For now, return the highest priority (lowest priority number) provider
    // In the future, this could include load balancing, health checks, etc.
    return enabledConfigs[0]
  }

  /**
   * Perform AI analysis with automatic provider selection and failover
   */
  static async performAnalysis(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const enabledConfigs = await this.getEnabledProviderConfigs(request.organizationId)
    
    if (enabledConfigs.length === 0) {
      throw new Error('No AI providers configured for this organization')
    }

    let lastError: Error | null = null

    // Try each provider in priority order
    for (const config of enabledConfigs) {
      try {
        const client = this.createProviderClient(config)
        const result = await client.analyze(request.repositoryContent, request.baselineData)
        
        return {
          ...result,
          provider: config.provider,
          model: config.model || 'unknown'
        }
      } catch (error) {
        console.warn(`AI provider ${config.provider} failed:`, error)
        lastError = error instanceof Error ? error : new Error('Unknown error')
        continue
      }
    }

    throw new Error(`All AI providers failed. Last error: ${lastError?.message}`)
  }

  /**
   * Create a provider-specific client
   */
  private static createProviderClient(config: AIProviderConfig): AIProviderClient {
    switch (config.provider) {
      case AIProvider.OPENAI:
        return new OpenAIClient(config)
      case AIProvider.GEMINI:
        return new GeminiClient(config)
      case AIProvider.CLAUDE:
        return new ClaudeClient(config)
      case AIProvider.QWEN:
        return new QwenClient(config)
      case AIProvider.OPENROUTER:
        return new OpenRouterClient(config)
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`)
    }
  }

  /**
   * Get provider capabilities and defaults
   */
  static getProviderDefaults(provider: AIProvider) {
    return AI_PROVIDER_DEFAULTS[provider]
  }

  /**
   * Validate provider configuration
   */
  static validateProviderConfig(input: AIProviderCreateInput | AIProviderUpdateInput): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if ('provider' in input && !Object.values(AIProvider).includes(input.provider)) {
      errors.push('Invalid AI provider')
    }

    if ('name' in input && (!input.name || input.name.trim().length === 0)) {
      errors.push('Provider name is required')
    }

    if ('apiKey' in input && (!input.apiKey || input.apiKey.trim().length === 0)) {
      errors.push('API key is required')
    }

    if ('maxTokens' in input && input.maxTokens !== undefined && (input.maxTokens < 1 || input.maxTokens > 200000)) {
      errors.push('Max tokens must be between 1 and 200,000')
    }

    if ('temperature' in input && input.temperature !== undefined && (input.temperature < 0 || input.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2')
    }

    if ('priority' in input && input.priority !== undefined && input.priority < 1) {
      errors.push('Priority must be at least 1')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

/**
 * Abstract base class for AI provider clients
 */
abstract class AIProviderClient {
  constructor(protected config: AIProviderConfig) {}

  abstract testConnection(): Promise<void>
  abstract analyze(repositoryContent: string, baselineData: any[]): Promise<Omit<AIAnalysisResponse, 'provider' | 'model'>>
}

/**
 * OpenAI client implementation
 */
class OpenAIClient extends AIProviderClient {
  async testConnection(): Promise<void> {
    const response = await fetch(`${this.config.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`OpenAI API test failed: ${response.statusText}`)
    }
  }

  async analyze(repositoryContent: string, baselineData: any[]): Promise<Omit<AIAnalysisResponse, 'provider' | 'model'>> {
    const startTime = Date.now()
    
    const prompt = this.buildAnalysisPrompt(repositoryContent, baselineData)
    
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert web developer analyzing code repositories for compliance with web platform baseline standards.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API request failed: ${response.statusText}`)
    }

    const result = await response.json()
    const content = result.choices[0]?.message?.content

    if (!content) {
      throw new Error('No response content from OpenAI')
    }

    return {
      ...this.parseAnalysisResponse(content),
      tokensUsed: result.usage?.total_tokens || 0,
      processingTime: Date.now() - startTime
    }
  }

  private buildAnalysisPrompt(repositoryContent: string, baselineData: any[]): string {
    return `
Analyze the following repository content against web platform baseline standards.

Repository Content:
${repositoryContent}

Baseline Data:
${JSON.stringify(baselineData, null, 2)}

Please provide a comprehensive analysis in the following JSON format:
{
  "complianceScore": number (0-100),
  "recommendations": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "priority": "high|medium|low",
      "category": "string",
      "actionItems": ["string"],
      "resources": ["string"]
    }
  ],
  "baselineMatches": [
    {
      "feature": "string",
      "status": "baseline|limited|not-baseline",
      "confidence": number (0-1),
      "description": "string",
      "documentation": "string"
    }
  ],
  "issues": [
    {
      "id": "string",
      "type": "error|warning|info",
      "title": "string",
      "description": "string",
      "file": "string",
      "line": number,
      "suggestion": "string"
    }
  ]
}
`
  }

  private parseAnalysisResponse(content: string): Omit<AIAnalysisResponse, 'provider' | 'model' | 'tokensUsed' | 'processingTime'> {
    try {
      const parsed = JSON.parse(content)
      return {
        complianceScore: parsed.complianceScore || 0,
        recommendations: parsed.recommendations || [],
        baselineMatches: parsed.baselineMatches || [],
        issues: parsed.issues || []
      }
    } catch (error) {
      // Fallback parsing if JSON is malformed
      return {
        complianceScore: 0,
        recommendations: [],
        baselineMatches: [],
        issues: [{
          id: 'parse-error',
          type: 'error',
          title: 'Analysis Parsing Error',
          description: 'Failed to parse AI analysis response',
          suggestion: 'Please try the analysis again'
        }]
      }
    }
  }
}

/**
 * Placeholder implementations for other providers
 * These would be implemented similarly to OpenAIClient
 */
class GeminiClient extends AIProviderClient {
  async testConnection(): Promise<void> {
    // Implementation for Gemini API test
    throw new Error('Gemini client not yet implemented')
  }

  async analyze(repositoryContent: string, baselineData: any[]): Promise<Omit<AIAnalysisResponse, 'provider' | 'model'>> {
    // Implementation for Gemini analysis
    throw new Error('Gemini client not yet implemented')
  }
}

class ClaudeClient extends AIProviderClient {
  async testConnection(): Promise<void> {
    // Implementation for Claude API test
    throw new Error('Claude client not yet implemented')
  }

  async analyze(repositoryContent: string, baselineData: any[]): Promise<Omit<AIAnalysisResponse, 'provider' | 'model'>> {
    // Implementation for Claude analysis
    throw new Error('Claude client not yet implemented')
  }
}

class QwenClient extends AIProviderClient {
  async testConnection(): Promise<void> {
    // Implementation for Qwen API test
    throw new Error('Qwen client not yet implemented')
  }

  async analyze(repositoryContent: string, baselineData: any[]): Promise<Omit<AIAnalysisResponse, 'provider' | 'model'>> {
    // Implementation for Qwen analysis
    throw new Error('Qwen client not yet implemented')
  }
}

class OpenRouterClient extends AIProviderClient {
  async testConnection(): Promise<void> {
    // Implementation for OpenRouter API test
    throw new Error('OpenRouter client not yet implemented')
  }

  async analyze(repositoryContent: string, baselineData: any[]): Promise<Omit<AIAnalysisResponse, 'provider' | 'model'>> {
    // Implementation for OpenRouter analysis
    throw new Error('OpenRouter client not yet implemented')
  }
}