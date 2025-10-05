import { NextRequest, NextResponse } from 'next/server';
import { WebhookService } from '@/lib/services/webhook-service';
import { authenticateUser, AuthenticationError } from '@/lib/auth-middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, organizationId } = await authenticateUser(request);
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    await WebhookService.testWebhook(organizationId, params.id);
    
    return NextResponse.json({ 
      success: true,
      message: 'Test webhook sent successfully'
    });
  } catch (error) {
    console.error('Error testing webhook:', error);
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: 'Failed to test webhook' },
      { status: 500 }
    );
  }
}