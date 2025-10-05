import { NextRequest, NextResponse } from 'next/server';
import { WebhookService } from '@/lib/services/webhook-service';
import { CreateWebhookRequest, WEBHOOK_EVENTS } from '@/lib/types/cicd';
import { authenticateUser, AuthenticationError } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const { user, organizationId } = await authenticateUser(request);
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    const webhooks = await WebhookService.listWebhooks(organizationId);
    
    return NextResponse.json({
      webhooks,
      availableEvents: Object.values(WEBHOOK_EVENTS),
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, organizationId } = await authenticateUser(request);
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    const body: CreateWebhookRequest = await request.json();
    
    // Validate request
    if (!body.url || !isValidUrl(body.url)) {
      return NextResponse.json(
        { error: 'Valid webhook URL is required' },
        { status: 400 }
      );
    }

    // Validate events
    if (body.events) {
      const validEvents = Object.values(WEBHOOK_EVENTS);
      const invalidEvents = body.events.filter(e => !validEvents.includes(e as any));
      
      if (invalidEvents.length > 0) {
        return NextResponse.json(
          { error: `Invalid events: ${invalidEvents.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const webhook = await WebhookService.createWebhook(organizationId, body);
    
    return NextResponse.json(webhook, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook:', error);
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    );
  }
}

function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}