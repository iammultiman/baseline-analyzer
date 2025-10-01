import { NextRequest, NextResponse } from 'next/server';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// CORS configuration for production
export const corsConfig = {
  origin: [
    'https://baseline-analyzer.web.app',
    'https://baseline-analyzer.firebaseapp.com',
    ...(process.env.CORS_ORIGINS?.split(',') || [])
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-Organization-ID',
    'X-Trace-ID'
  ],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => {
    // Skip rate limiting for health checks
    return req.url?.includes('/api/health');
  }
};

// Slow down configuration for additional protection
export const slowDownConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  skip: (req: any) => {
    return req.url?.includes('/api/health');
  }
};

// Security headers middleware
export function securityHeaders(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Strict Transport Security (HSTS)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com https://api.anthropic.com https://openrouter.ai https://api.stripe.com",
    "frame-src 'self' https://js.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

// CORS middleware
export function corsMiddleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const response = NextResponse.next();

  // Check if origin is allowed
  if (origin && corsConfig.origin.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    // Allow all origins in development
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  response.headers.set('Access-Control-Allow-Methods', corsConfig.methods.join(', '));
  response.headers.set('Access-Control-Allow-Headers', corsConfig.allowedHeaders.join(', '));
  response.headers.set('Access-Control-Allow-Credentials', corsConfig.credentials.toString());
  response.headers.set('Access-Control-Max-Age', corsConfig.maxAge.toString());

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: response.headers });
  }

  return response;
}

// Input validation and sanitization
export function validateInput(input: any, type: 'string' | 'number' | 'email' | 'url' | 'uuid'): boolean {
  if (input === null || input === undefined) {
    return false;
  }

  switch (type) {
    case 'string':
      return typeof input === 'string' && input.length > 0 && input.length <= 10000;
    
    case 'number':
      return typeof input === 'number' && !isNaN(input) && isFinite(input);
    
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return typeof input === 'string' && emailRegex.test(input) && input.length <= 254;
    
    case 'url':
      try {
        const url = new URL(input);
        return ['http:', 'https:'].includes(url.protocol);
      } catch {
        return false;
      }
    
    case 'uuid':
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return typeof input === 'string' && uuidRegex.test(input);
    
    default:
      return false;
  }
}

// Sanitize string input to prevent XSS
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[<>]/g, '') // Remove < and > characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .slice(0, 10000); // Limit length
}

// Audit logging for sensitive operations
export interface AuditLogEntry {
  timestamp: string;
  userId?: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: Record<string, any>;
}

export function logAuditEvent(entry: AuditLogEntry): void {
  const auditLog = {
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
    level: 'AUDIT',
    service: 'baseline-analyzer'
  };

  // Log to structured logging for Cloud Logging
  console.log(JSON.stringify(auditLog));
}

// Security event logging
export function logSecurityEvent(
  event: 'authentication_failure' | 'authorization_failure' | 'suspicious_activity' | 'rate_limit_exceeded',
  details: Record<string, any>,
  request?: NextRequest
): void {
  const securityLog = {
    timestamp: new Date().toISOString(),
    level: 'WARNING',
    service: 'baseline-analyzer',
    event_type: event,
    ip_address: request?.ip || request?.headers.get('x-forwarded-for') || 'unknown',
    user_agent: request?.headers.get('user-agent') || 'unknown',
    ...details
  };

  console.warn(JSON.stringify(securityLog));
}

// DDoS protection middleware
export class DDoSProtection {
  private requestCounts = new Map<string, { count: number; resetTime: number }>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 1000, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(ip: string): boolean {
    const now = Date.now();
    const record = this.requestCounts.get(ip);

    if (!record || now > record.resetTime) {
      this.requestCounts.set(ip, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    record.count++;
    
    if (record.count > this.maxRequests) {
      logSecurityEvent('rate_limit_exceeded', {
        ip_address: ip,
        request_count: record.count,
        max_requests: this.maxRequests
      });
      return false;
    }

    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [ip, record] of this.requestCounts.entries()) {
      if (now > record.resetTime) {
        this.requestCounts.delete(ip);
      }
    }
  }
}

// Initialize DDoS protection
export const ddosProtection = new DDoSProtection();

// Cleanup DDoS protection records every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    ddosProtection.cleanup();
  }, 5 * 60 * 1000);
}