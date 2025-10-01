import { NextRequest, NextResponse } from 'next/server';
import { WebhookService } from '@/lib/services/webhook-service';
import { authenticateUser } from '@/lib/auth-middleware';

export async function GET(
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

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const deliveries = await WebhookService.getWebhookDeliveries(
      organizationId,
      params.id,
      limit
    );
    
    return NextResponse.json({ deliveries });
  } catch (error) {
    console.error('Error fetching webhook deliveries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook deliveries' },
      { status: 500 }
    );
  }
}