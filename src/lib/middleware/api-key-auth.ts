import { NextRequest } from 'next/server';
import { ApiKeyService } from '@/lib/services/api-key-service';
import { ApiKey, API_PERMISSIONS } from '@/lib/types/cicd';

export interface ApiKeyAuthContext {
  apiKey: ApiKey;
  organizationId: string;
}

export class ApiKeyAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
    public code: string = 'UNAUTHORIZED'
  ) {
    super(message);
    this.name = 'ApiKeyAuthError';
  }
}

export async function authenticateApiKey(request: NextRequest): Promise<ApiKeyAuthContext> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    throw new ApiKeyAuthError('Missing Authorization header', 401, 'MISSING_AUTH_HEADER');
  }

  const [scheme, token] = authHeader.split(' ');
  
  if (scheme !== 'Bearer' || !token) {
    throw new ApiKeyAuthError('Invalid Authorization header format. Use: Bearer <api_key>', 401, 'INVALID_AUTH_FORMAT');
  }

  const apiKey = await ApiKeyService.validateApiKey(token);
  
  if (!apiKey) {
    throw new ApiKeyAuthError('Invalid or expired API key', 401, 'INVALID_API_KEY');
  }

  return {
    apiKey,
    organizationId: apiKey.organizationId,
  };
}

export function requirePermission(permission: string) {
  return (context: ApiKeyAuthContext): void => {
    if (!ApiKeyService.hasPermission(context.apiKey, permission)) {
      throw new ApiKeyAuthError(
        `Insufficient permissions. Required: ${permission}`,
        403,
        'INSUFFICIENT_PERMISSIONS'
      );
    }
  };
}

export function withApiKeyAuth<T extends any[]>(
  handler: (context: ApiKeyAuthContext, request: NextRequest, ...args: T) => Promise<Response>,
  requiredPermissions: string[] = []
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      const context = await authenticateApiKey(request);
      
      // Check required permissions
      for (const permission of requiredPermissions) {
        requirePermission(permission)(context);
      }
      
  return await handler(context, request, ...args);
    } catch (error) {
      if (error instanceof ApiKeyAuthError) {
        return new Response(
          JSON.stringify({
            error: {
              code: error.code,
              message: error.message,
            },
          }),
          {
            status: error.statusCode,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
      
      console.error('Unexpected error in API key authentication:', error);
      return new Response(
        JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  };
}

// Helper function to extract API key from various sources
export function extractApiKey(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const [scheme, token] = authHeader.split(' ');
    if (scheme === 'Bearer' && token) {
      return token;
    }
  }

  // Try X-API-Key header
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Try query parameter (less secure, but sometimes needed)
  const url = new URL(request.url);
  const apiKeyParam = url.searchParams.get('api_key');
  if (apiKeyParam) {
    return apiKeyParam;
  }

  return null;
}