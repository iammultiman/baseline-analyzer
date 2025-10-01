import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { emailService } from '@/lib/services/email-service';
import { z } from 'zod';

const testEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// POST /api/admin/email/test - Send test email
export const POST = withAuth(async (
  request: NextRequest,
  user: { uid: string; email: string }
) => {
  try {
    const body = await request.json();
    const { email } = testEmailSchema.parse(body);

    // Check if user is admin (you might want to add proper admin role checking)
    // For now, we'll allow any authenticated user to test email
    
    await emailService.sendTestEmail(email);

    return NextResponse.json({ 
      success: true, 
      message: 'Test email sent successfully' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error sending test email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});