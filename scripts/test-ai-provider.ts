#!/usr/bin/env tsx

import { AIProviderService } from '../src/lib/services/ai-provider-service';

async function testAIProvider() {
  const args = process.argv.slice(2);
  const providerArg = args.find(arg => arg.startsWith('--provider='));
  const provider = providerArg ? providerArg.split('=')[1] : 'openai';
  
  console.log(`Testing AI provider: ${provider}`);
  
  const aiProviderService = new AIProviderService();
  
  try {
    const isValid = await aiProviderService.validateProvider(provider);
    
    if (isValid) {
      console.log(`✅ ${provider} provider is accessible and working`);
      
      // Test rate limits
      const rateLimits = await aiProviderService.getRateLimits(provider);
      console.log(`✅ Rate limits: ${rateLimits.requestsPerMinute} requests/minute`);
      
      process.exit(0);
    } else {
      console.log(`❌ ${provider} provider validation failed`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ ${provider} provider test failed:`, error);
    process.exit(1);
  }
}

testAIProvider();