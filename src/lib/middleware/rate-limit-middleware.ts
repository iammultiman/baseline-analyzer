import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (request: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitRule {
  path: string;
  config: RateLimitConfig;
}

// Initialize Redis client for rate limiting (use Upstash Redis for serverless)
const redis = process.env.UPSTASH_REDIS_REST_URL 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Rate limiting rules for different endpoints
const rateLimitRules: RateLimitRule[] = [
  {
    path: '/api/analysis',
    config: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10, // 10 analysis requests per 15 minutes per user
      keyGenerator: (req) => `analysis:${getClientId(req)}`,
    }
  },
  {
    path: '/api/auth',
    config: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 auth attempts per 15 minutes per IP
      keyGenerator: (req) => `auth:${getClientIP(req)}`,
    }
  },
  {
    path: '/api/credits/purchase',
    config: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3, // 3 purchase attempts per hour per user
      keyGenerator: (req) => `purchase:${getClientId(req)}`,
    }
  },
  {
    path: '/api/cicd',
    config: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30, // 30 CI/CD requests per minute per API key
      keyGenerator: (req) => `cicd:${getAPIKey(req)}`,
    }
  },
  {
    path: '/api',
    config: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 general API requests per 15 minutes per IP
      keyGenerator: (req) => `general:${getClientIP(req)}`,
    }
  }
];

export async function createRateLimitMiddleware() {
  if (!redis) {
    console.warn('Redis not configured, rate limiting disabled');
    return null;
  }

  return async function rateLimitMiddleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    
    // Find matching rate limit rule
    const rule = rateLimitRules.find(rule => pathname.startsWith(rule.path));
    if (!rule) return null;

    try {
      const isLimited = await checkRateLimit(request, rule.config);
      if (isLimited) {
        return new NextResponse(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil(rule.config.windowMs / 1000)
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil(rule.config.windowMs / 1000).toString(),
              'X-RateLimit-Limit': rule.config.maxRequests.toString(),
              'X-RateLimit-Window': rule.config.windowMs.toString(),
            }
          }
        );
      }
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Continue without rate limiting if Redis fails
    }

    return null;
  };
}

async function checkRateLimit(request: NextRequest, config: RateLimitConfig): Promise<boolean> {
  if (!redis) return false;

  const key = config.keyGenerator(request);
  const window = Math.floor(Date.now() / config.windowMs);
  const redisKey = `ratelimit:${key}:${window}`;

  try {
    const current = await redis.incr(redisKey);
    
    if (current === 1) {
      // Set expiration for the first request in this window
      await redis.expire(redisKey, Math.ceil(config.windowMs / 1000));
    }

    return current > config.maxRequests;
  } catch (error) {
    console.error('Redis rate limit check failed:', error);
    return false; // Fail open
  }
}

function getClientIP(request: NextRequest): string {
  // Try various headers for getting real IP
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return realIP || cfConnectingIP || 'unknown';
}

function getClientId(request: NextRequest): string {
  // Try to get user ID from JWT token
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // In a real implementation, you'd decode the JWT to get user ID
      // For now, use a hash of the token
      return `user:${hashString(token)}`;
    } catch {
      // Fall back to IP if token is invalid
    }
  }
  
  return `ip:${getClientIP(request)}`;
}

function getAPIKey(request: NextRequest): string {
  const apiKey = request.headers.get('x-api-key');
  return apiKey ? `key:${hashString(apiKey)}` : `ip:${getClientIP(request)}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// DDoS protection middleware
export function createDDoSProtectionMiddleware() {
  const suspiciousPatterns = [
    /bot|crawler|spider|scraper/i,
    /curl|wget|python|java/i,
  ];

  const blockedUserAgents = [
    'sqlmap',
    'nikto',
    'nmap',
    'masscan',
  ];

  return function ddosProtectionMiddleware(request: NextRequest) {
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    
    // Block known malicious user agents
    if (blockedUserAgents.some(blocked => userAgent.toLowerCase().includes(blocked))) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Check for suspicious patterns
    if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
      // Log suspicious activity
      console.warn('Suspicious user agent detected:', {
        userAgent,
        ip: getClientIP(request),
        path: request.nextUrl.pathname,
        referer
      });
    }

    // Check for rapid requests from same IP (basic protection)
    const ip = getClientIP(request);
    if (ip !== 'unknown') {
      // This would typically use Redis or similar for tracking
      // For now, just log for monitoring
      console.log('Request from IP:', ip, 'to', request.nextUrl.pathname);
    }

    return null;
  };
}