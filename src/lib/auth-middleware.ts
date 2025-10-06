import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
import type { Organization, UserRole } from '@prisma/client';
import { prisma } from '@/lib/database';

// Initialize Firebase Admin SDK
if (!IS_DEMO) {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n'),
      }),
    });
  }
}

export async function verifyAuthToken(request: NextRequest): Promise<{ uid: string; email: string } | null> {
  try {
    if (IS_DEMO) {
      return { uid: 'demo-user', email: 'demo@example.com' };
    }
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
    };
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return null;
  }
}

export function createAuthMiddleware(handler: (request: NextRequest, user: { uid: string; email: string }) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const user = await verifyAuthToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return handler(request, user);
  };
}

export function withAuth<T extends unknown[]>(
  handler: (request: NextRequest, user: { uid: string; email: string }, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T) => {
    const user = await verifyAuthToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return handler(request, user, ...args);
  };
}

// Middleware function for API routes
export async function authMiddleware(request: NextRequest): Promise<{
  success: boolean;
  user?: { id: string; email: string };
  error?: string;
  status?: number;
}> {
  try {
    const user = await verifyAuthToken(request);
    
    if (!user) {
      return {
        success: false,
        error: 'Unauthorized',
        status: 401
      };
    }

    return {
      success: true,
      user: {
        id: user.uid,
        email: user.email
      }
    };
  } catch (error) {
    return {
      success: false,
      error: 'Authentication failed',
      status: 401
    };
  }
}

// Alias for backward compatibility
export const verifyAuth = verifyAuthToken;
export const requireAuth = authMiddleware;

export interface AuthenticatedUserContext {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
  organizationId: string | null;
  organization?: Pick<Organization, 'id' | 'name' | 'slug' | 'ownerId' | 'settings'>;
  isOrganizationOwner: boolean;
}

export class AuthenticationError extends Error {
  status: number;

  constructor(message: string, status: number = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.status = status;
  }
}

export async function authenticateUser(request: NextRequest): Promise<AuthenticatedUserContext> {
  if (IS_DEMO) {
    return {
      user: { id: 'demo-user', email: 'demo@example.com', role: 'ADMIN' as UserRole },
      organizationId: null,
      isOrganizationOwner: true,
    } as AuthenticatedUserContext;
  }
  const authResult = await authMiddleware(request);

  if (!authResult.success || !authResult.user) {
    throw new AuthenticationError(authResult.error || 'Unauthorized');
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: authResult.user.id },
    include: {
      organization: true,
    },
  });

  if (!userRecord) {
    throw new AuthenticationError('User not found', 404);
  }

  const organization = userRecord.organization
    ? {
        id: userRecord.organization.id,
        name: userRecord.organization.name,
        slug: userRecord.organization.slug,
        ownerId: userRecord.organization.ownerId,
        settings: userRecord.organization.settings,
      }
    : undefined;

  return {
    user: {
      id: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
    },
    organizationId: organization?.id ?? null,
    organization,
    isOrganizationOwner: organization?.ownerId === userRecord.id,
  };
}