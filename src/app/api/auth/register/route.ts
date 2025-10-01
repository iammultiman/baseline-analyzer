import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { CreditService } from '@/lib/services/credit-service';
import { prisma } from '@/lib/database';

interface RegisterRequest {
  displayName?: string;
}

/**
 * POST /api/auth/register - Complete user registration after Firebase auth
 * This endpoint should be called after successful Firebase authentication
 * to create the user record in our database and grant initial credits
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RegisterRequest = await request.json();
    const { displayName } = body;

    // Check if user already exists in our database
    const existingUser = await prisma.user.findUnique({
      where: { id: authResult.user.uid },
    });

    if (existingUser) {
      return NextResponse.json({
        success: true,
        user: existingUser,
        message: 'User already registered',
      });
    }

    // Create user in database
    const newUser = await prisma.user.create({
      data: {
        id: authResult.user.uid,
        email: authResult.user.email!,
        displayName: displayName || authResult.user.displayName,
        photoUrl: authResult.user.photoURL,
        lastLoginAt: new Date(),
      },
    });

    // Grant initial free credits
    const creditResult = await CreditService.grantInitialCredits(authResult.user.uid);
    
    if (!creditResult.success) {
      console.error('Failed to grant initial credits:', creditResult.error);
      // Don't fail the registration if credit granting fails
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        creditBalance: creditResult.success ? creditResult.newBalance : 0,
      },
      initialCredits: creditResult.success ? creditResult.newBalance : 0,
    });
  } catch (error) {
    console.error('Error during user registration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}