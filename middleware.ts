import { NextRequest, NextResponse } from 'next/server';
import { 
  securityHeaders, 
  corsMiddleware, 
  ddosProtection, 
  logSecurityEvent,
  validateInput,
  sanitizeString 
} from '@/lib/middleware/security-middleware';
import { createCORSMiddleware } from '@/lib/middleware/cors-middleware';
import { createRateLimitMiddleware, createDDoSProtectionMiddleware } from '@/lib/middleware/rate-limit-middleware';

// Initialize middleware components
const corsHandler = createCORSMiddleware();
let rateLimitHandler: any = null;
const ddosHandler = createDDoSProtectionMiddleware();

// Initialize rate limiting (async)
createRateLimitMiddleware().then(handler => {
  rateLimitHandler = handler;
});

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const userAgent = request.headers.get('user-agent') || '';
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

  // 1. Apply security headers first
  let response = securityHeaders(request);

  // 2. Handle CORS for production
  if (process.env.NODE_ENV === 'production') {
    const corsResult = corsHandler?.(request);
    if (corsResult) {
      // CORS blocked the request
      if (corsResult.status === 403) {
        logSecurityEvent('suspicious_activity', {
          reason: 'CORS violation',
          origin,
          path: pathname,
          ip
        }, request);
        return corsResult;
      }
      // Preflight response
      if (corsResult.status === 200) {
        return corsResult;
      }
    }
  }

  // 3. Apply DDoS protection
  const ddosResult = ddosHandler?.(request);
  if (ddosResult) {
    logSecurityEvent('suspicious_activity', {
      reason: 'DDoS protection triggered',
      user_agent: userAgent,
      ip
    }, request);
    return ddosResult;
  }

  // 4. Apply rate limiting for API routes
  if (pathname.startsWith('/api/') && rateLimitHandler) {
    try {
      const rateLimitResult = await rateLimitHandler(request);
      if (rateLimitResult) {
        logSecurityEvent('rate_limit_exceeded', {
          path: pathname,
          ip,
          user_agent: userAgent
        }, request);
        return rateLimitResult;
      }
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Continue without rate limiting if it fails
    }
  }

  // 5. Input validation for query parameters
  const url = request.nextUrl;
  for (const [key, value] of url.searchParams.entries()) {
    const sanitizedValue = sanitizeString(value);
    if (sanitizedValue !== value) {
      logSecurityEvent('suspicious_activity', {
        reason: 'Malicious input detected',
        parameter: key,
        original_value: value.substring(0, 100), // Limit logged value
        ip
      }, request);
      
      // Sanitize the parameter
      url.searchParams.set(key, sanitizedValue);
      return NextResponse.redirect(url);
    }
  }

  // 6. Block known malicious patterns
  const suspiciousPatterns = [
    /\.\.\//g, // Directory traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript protocol
    /data:.*base64/i, // Data URI attacks
  ];

  const fullUrl = request.url;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fullUrl)) {
      logSecurityEvent('suspicious_activity', {
        reason: 'Malicious pattern detected',
        pattern: pattern.source,
        url: fullUrl.substring(0, 200),
        ip
      }, request);
      
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // 7. Enhanced logging for sensitive endpoints
  const sensitiveEndpoints = [
    '/api/auth',
    '/api/admin',
    '/api/credits/purchase',
    '/api/organizations',
  ];

  if (sensitiveEndpoints.some(endpoint => pathname.startsWith(endpoint))) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: 'baseline-analyzer',
      event_type: 'sensitive_endpoint_access',
      path: pathname,
      method: request.method,
      ip,
      user_agent: userAgent,
      origin
    }));
  }

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/signup', 
    '/auth/forgot-password',
    '/auth/test',
    '/api/health',
    '/shared-report',
  ];

  // Define protected routes that require authentication
  const protectedRoutes = [
    '/dashboard',
    '/admin',
    '/credits',
    '/repository-analysis',
    '/analysis',
    '/api/auth/me',
    '/api/test-auth',
  ];

  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );

  // For API routes, we'll handle authentication in the route handlers
  if (pathname.startsWith('/api/')) {
    return response;
  }

  // Allow public routes
  if (isPublicRoute) {
    return response;
  }

  // For protected routes, we'll let the client-side ProtectedRoute component handle the redirect
  // This is because we can't easily verify Firebase tokens in Edge Runtime middleware
  if (isProtectedRoute) {
    return response;
  }

  // Allow all other routes by default
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-*).*)',
  ],
};