import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';

async function handler(request: NextRequest, user: { uid: string; email: string }) {
  return NextResponse.json({
    success: true,
    message: 'Authentication middleware is working correctly',
    user: {
      uid: user.uid,
      email: user.email,
    },
    timestamp: new Date().toISOString(),
  });
}

export const GET = withAuth(handler);
export const POST = withAuth(handler);