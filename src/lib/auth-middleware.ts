import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function verifyAuthToken(request: NextRequest): Promise<{ uid: string; email: string } | null> {
  try {
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