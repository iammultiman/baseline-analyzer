import { prisma } from '@/lib/database';
import { Webhook, CreateWebhookRequest, WebhookDelivery, WebhookPayload, WEBHOOK_EVENTS } from '@/lib/types/cicd';
import crypto from 'crypto';

export class WebhookService {
  static async createWebhook(
    organizationId: string,
    request: CreateWebhookRequest
  ): Promise<Webhook> {
    const events = request.events || [
      WEBHOOK_EVENTS.ANALYSIS_COMPLETED,
      WEBHOOK_EVENTS.ANALYSIS_FAILED
    ];

    const webhook = await prisma.webhook.create({
      data: {
        organizationId,
        url: request.url,
        events,
        secret: request.secret,
      },
    });

    return {
      id: webhook.id,
      organizationId: webhook.organizationId,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret || undefined,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    };
  }

  static async listWebhooks(organizationId: string): Promise<Webhook[]> {
    const webhooks = await prisma.webhook.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return webhooks.map(webhook => ({
      id: webhook.id,
      organizationId: webhook.organizationId,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret || undefined,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    }));
  }

  static async updateWebhook(
    organizationId: string,
    webhookId: string,
    updates: Partial<Pick<Webhook, 'url' | 'events' | 'secret' | 'isActive'>>
  ): Promise<void> {
    await prisma.webhook.update({
      where: {
        id: webhookId,
        organizationId,
      },
      data: updates,
    });
  }

  static async deleteWebhook(organizationId: string, webhookId: string): Promise<void> {
    await prisma.webhook.delete({
      where: {
        id: webhookId,
        organizationId,
      },
    });
  }

  static async triggerWebhook(
    organizationId: string,
    event: string,
    payload: WebhookPayload
  ): Promise<void> {
    const webhooks = await prisma.webhook.findMany({
      where: {
        organizationId,
        isActive: true,
        events: {
          has: event,
        },
      },
    });

    for (const webhook of webhooks) {
      await this.scheduleWebhookDelivery(webhook.id, event, payload);
    }
  }

  private static async scheduleWebhookDelivery(
    webhookId: string,
    event: string,
    payload: WebhookPayload
  ): Promise<void> {
    await prisma.webhookDelivery.create({
      data: {
        webhookId,
        event,
        payload: payload as any,
        status: 'PENDING',
        nextAttempt: new Date(),
      },
    });

    // In a real implementation, this would trigger a background job
    // For now, we'll attempt delivery immediately
    setImmediate(() => this.attemptWebhookDelivery(webhookId, event, payload));
  }

  private static async attemptWebhookDelivery(
    webhookId: string,
    event: string,
    payload: WebhookPayload
  ): Promise<void> {
    try {
      const webhook = await prisma.webhook.findUnique({
        where: { id: webhookId },
      });

      if (!webhook) {
        console.error(`Webhook ${webhookId} not found`);
        return;
      }

      const delivery = await prisma.webhookDelivery.findFirst({
        where: {
          webhookId,
          event,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!delivery) {
        console.error(`No pending delivery found for webhook ${webhookId} and event ${event}`);
        return;
      }

      const signature = webhook.secret 
        ? this.generateSignature(JSON.stringify(payload), webhook.secret)
        : undefined;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Baseline-Analyzer-Webhook/1.0',
        'X-Webhook-Event': event,
        'X-Webhook-Delivery': delivery.id,
      };

      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const responseText = await response.text();
      let responseJson;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = { body: responseText };
      }

      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: response.ok ? 'SUCCESS' : 'FAILED',
          attempts: delivery.attempts + 1,
          lastAttempt: new Date(),
          response: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseJson,
          },
          nextAttempt: response.ok ? null : this.calculateNextAttempt(delivery.attempts + 1),
        },
      });

      // Schedule retry if failed and we haven't exceeded max attempts
      if (!response.ok && delivery.attempts < 5) {
        setTimeout(() => {
          this.attemptWebhookDelivery(webhookId, event, payload);
        }, this.calculateRetryDelay(delivery.attempts + 1));
      }

    } catch (error) {
      console.error(`Webhook delivery failed for ${webhookId}:`, error);

      const delivery = await prisma.webhookDelivery.findFirst({
        where: {
          webhookId,
          event,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (delivery) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: delivery.attempts < 5 ? 'RETRYING' : 'FAILED',
            attempts: delivery.attempts + 1,
            lastAttempt: new Date(),
            response: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            nextAttempt: delivery.attempts < 5 ? this.calculateNextAttempt(delivery.attempts + 1) : null,
          },
        });

        // Schedule retry if we haven't exceeded max attempts
        if (delivery.attempts < 5) {
          setTimeout(() => {
            this.attemptWebhookDelivery(webhookId, event, payload);
          }, this.calculateRetryDelay(delivery.attempts + 1));
        }
      }
    }
  }

  private static generateSignature(payload: string, secret: string): string {
    return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  }

  private static calculateRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, attempt - 1), 16000);
  }

  private static calculateNextAttempt(attempt: number): Date {
    const delay = this.calculateRetryDelay(attempt);
    return new Date(Date.now() + delay);
  }

  static async getWebhookDeliveries(
    organizationId: string,
    webhookId?: string,
    limit: number = 50
  ): Promise<WebhookDelivery[]> {
    const whereClause: any = {};
    
    if (webhookId) {
      whereClause.webhookId = webhookId;
    } else {
      // Get deliveries for all webhooks in the organization
      whereClause.webhook = {
        organizationId,
      };
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        webhook: {
          select: {
            url: true,
          },
        },
      },
    });

    return deliveries.map(delivery => ({
      id: delivery.id,
      webhookId: delivery.webhookId,
      event: delivery.event,
      payload: delivery.payload,
      status: delivery.status as 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRYING',
      attempts: delivery.attempts,
      lastAttempt: delivery.lastAttempt || undefined,
      nextAttempt: delivery.nextAttempt || undefined,
      response: delivery.response || undefined,
      createdAt: delivery.createdAt,
    }));
  }

  static async testWebhook(organizationId: string, webhookId: string): Promise<void> {
    const testPayload: WebhookPayload = {
      event: 'webhook.test',
      timestamp: new Date(),
      organizationId,
      analysis: {
        id: 'test-analysis-id',
        repositoryUrl: 'https://github.com/example/test-repo',
        status: 'completed',
        result: {
          id: 'test-analysis-id',
          repositoryUrl: 'https://github.com/example/test-repo',
          status: 'completed',
          completedAt: new Date(),
          creditsCost: 10,
          summary: {
            complianceScore: 85,
            totalIssues: 5,
            criticalIssues: 1,
            warningIssues: 2,
            infoIssues: 2,
            passedChecks: 15,
            totalChecks: 20,
          },
          issues: [],
          recommendations: [],
          baselineCompliance: {
            supportedFeatures: [],
            unsupportedFeatures: [],
            partiallySupported: [],
            recommendations: [],
          },
          metadata: {
            analysisVersion: '1.0.0',
            aiProvider: 'test',
            processingTime: 30000,
            repositorySize: 1024,
            fileCount: 10,
          },
        },
      },
    };

    await this.scheduleWebhookDelivery(webhookId, 'webhook.test', testPayload);
  }
}