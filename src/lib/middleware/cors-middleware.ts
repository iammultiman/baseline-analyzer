import { NextRequest, NextResponse } from 'next/server';

interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  maxAge: number;
  credentials: boolean;
}

const productionCORSConfig: CORSConfig = {
  allowedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || 'https://baseline-analyzer.web.app',
    'https://baseline-analyzer.firebaseapp.com',
    // Add your production domains here
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-API-Key',
    'X-Organization-ID'
  ],
  maxAge: 86400, // 24 hours
  credentials: true
};

const developmentCORSConfig: CORSConfig = {
  allowedOrigins: ['*'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['*'],
  maxAge: 3600,
  credentials: true
};

export function createCORSMiddleware() {
  const config = process.env.NODE_ENV === 'production' 
    ? productionCORSConfig 
    : developmentCORSConfig;

  return function corsMiddleware(request: NextRequest) {
    const origin = request.headers.get('origin');
    const method = request.method;

    // Handle preflight requests
    if (method === 'OPTIONS') {
      return handlePreflightRequest(origin, config);
    }

    // Check if origin is allowed
    if (config.allowedOrigins[0] !== '*' && origin) {
      const isAllowed = config.allowedOrigins.some(allowedOrigin => {
        if (allowedOrigin === '*') return true;
        if (allowedOrigin.includes('*')) {
          const pattern = allowedOrigin.replace(/\*/g, '.*');
          return new RegExp(`^${pattern}$`).test(origin);
        }
        return allowedOrigin === origin;
      });

      if (!isAllowed) {
        return new NextResponse('CORS: Origin not allowed', { status: 403 });
      }
    }

    return null; // Continue to next middleware
  };
}

function handlePreflightRequest(origin: string | null, config: CORSConfig): NextResponse {
  const headers = new Headers();

  // Set allowed origin
  if (config.allowedOrigins[0] === '*') {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && config.allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else {
    return new NextResponse('CORS: Origin not allowed', { status: 403 });
  }

  // Set other CORS headers
  headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
  headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
  headers.set('Access-Control-Max-Age', config.maxAge.toString());
  
  if (config.credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return new NextResponse(null, { status: 200, headers });
}

export function addCORSHeaders(response: NextResponse, origin: string | null): NextResponse {
  const config = process.env.NODE_ENV === 'production' 
    ? productionCORSConfig 
    : developmentCORSConfig;

  if (config.allowedOrigins[0] === '*') {
    response.headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && config.allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  if (config.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}