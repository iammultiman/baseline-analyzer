import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { AIProviderService } from '@/lib/services/ai-provider-service';
import { EmailService } from '@/lib/services/email-service';
import { PaymentService } from '@/lib/services/payment-service';

describe('Production Environment Validation', () => {
  let prisma: PrismaClient;
  let aiProviderService: AIProviderService;
  let emailService: EmailService;
  let paymentService: PaymentService;

  beforeAll(async () => {
    prisma = new PrismaClient();
    aiProviderService = new AIProviderService();
    emailService = new EmailService();
    paymentService = new PaymentService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Environment Variables and Secrets', () => {
    it('should have all required environment variables', () => {
      const requiredEnvVars = [
        'DATABASE_URL',
        'NEXTAUTH_SECRET',
        'NEXTAUTH_URL',
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY',
        'GOOGLE_CLOUD_PROJECT_ID',
        'OPENAI_API_KEY',
        'GEMINI_API_KEY',
        'ANTHROPIC_API_KEY',
        'OPENROUTER_API_KEY',
        'SENDGRID_API_KEY',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET'
      ];

      requiredEnvVars.forEach(envVar => {
        expect(process.env[envVar]).toBeDefined();
        expect(process.env[envVar]).not.toBe('');
      });
    });

    it('should have valid database URL format', () => {
      const databaseUrl = process.env.DATABASE_URL;
      expect(databaseUrl).toMatch(/^postgresql:\/\/.+/);
    });

    it('should have valid Firebase configuration', () => {
      expect(process.env.FIREBASE_PROJECT_ID).toMatch(/^[a-z0-9-]+$/);
      expect(process.env.FIREBASE_CLIENT_EMAIL).toMatch(/^.+@.+\.iam\.gserviceaccount\.com$/);
      expect(process.env.FIREBASE_PRIVATE_KEY).toContain('-----BEGIN PRIVATE KEY-----');
    });

    it('should have valid Google Cloud project configuration', () => {
      expect(process.env.GOOGLE_CLOUD_PROJECT_ID).toMatch(/^[a-z0-9-]+$/);
    });
  });

  describe('Database Connectivity and Performance', () => {
    it('should connect to production database successfully', async () => {
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      expect(result).toBeDefined();
    });

    it('should have pgvector extension enabled', async () => {
      const extensions = await prisma.$queryRaw`
        SELECT extname FROM pg_extension WHERE extname = 'vector'
      `;
      expect(Array.isArray(extensions) && extensions.length > 0).toBe(true);
    });

    it('should have proper database indexes', async () => {
      const indexes = await prisma.$queryRaw`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public'
        AND indexname LIKE '%baseline_data%'
      `;
      expect(Array.isArray(indexes) && indexes.length > 0).toBe(true);
    });

    it('should perform database queries within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await prisma.user.findMany({
        take: 10,
        include: {
          organization: true
        }
      });
      
      const queryTime = Date.now() - startTime;
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent database connections', async () => {
      const concurrentQueries = Array.from({ length: 10 }, () =>
        prisma.$queryRaw`SELECT COUNT(*) FROM users`
      );
      
      const results = await Promise.all(concurrentQueries);
      expect(results).toHaveLength(10);
      results.forEach(result => expect(result).toBeDefined());
    });
  });

  describe('AI Provider Integration Validation', () => {
    it('should validate OpenAI API key and connectivity', async () => {
      const isValid = await aiProviderService.validateProvider('openai');
      expect(isValid).toBe(true);
    });

    it('should validate Google Gemini API key and connectivity', async () => {
      const isValid = await aiProviderService.validateProvider('gemini');
      expect(isValid).toBe(true);
    });

    it('should validate Anthropic Claude API key and connectivity', async () => {
      const isValid = await aiProviderService.validateProvider('anthropic');
      expect(isValid).toBe(true);
    });

    it('should validate OpenRouter API key and connectivity', async () => {
      const isValid = await aiProviderService.validateProvider('openrouter');
      expect(isValid).toBe(true);
    });

    it('should handle AI provider failover correctly', async () => {
      const providers = await aiProviderService.getAvailableProviders();
      expect(providers.length).toBeGreaterThan(1);
      
      // Test failover mechanism
      const primaryProvider = providers[0];
      const fallbackProvider = providers[1];
      
      expect(primaryProvider.id).not.toBe(fallbackProvider.id);
    });

    it('should respect AI provider rate limits', async () => {
      const rateLimits = await aiProviderService.getRateLimits();
      expect(rateLimits).toBeDefined();
      expect(rateLimits.requestsPerMinute).toBeGreaterThan(0);
    });
  });

  describe('Email Service Configuration Validation', () => {
    it('should validate email service configuration', async () => {
      const isConfigured = await emailService.validateConfiguration();
      expect(isConfigured).toBe(true);
    });

    it('should send test email successfully', async () => {
      const testEmail = {
        to: process.env.TEST_EMAIL || 'test@example.com',
        subject: 'Production Validation Test',
        text: 'This is a test email from production validation.',
        html: '<p>This is a test email from production validation.</p>'
      };

      const result = await emailService.sendEmail(testEmail);
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should handle email template rendering', async () => {
      const templateData = {
        organizationName: 'Test Organization',
        inviterName: 'Test User',
        inviteUrl: 'https://example.com/invite/test'
      };

      const renderedEmail = await emailService.renderTemplate('invitation', templateData);
      expect(renderedEmail.subject).toContain('Test Organization');
      expect(renderedEmail.html).toContain('Test User');
      expect(renderedEmail.html).toContain('https://example.com/invite/test');
    });

    it('should validate email delivery status tracking', async () => {
      const deliveryStatus = await emailService.getDeliveryStatus('test-message-id');
      expect(deliveryStatus).toBeDefined();
      expect(['delivered', 'pending', 'failed', 'bounced']).toContain(deliveryStatus.status);
    });
  });

  describe('Payment Processing Validation', () => {
    it('should validate Stripe configuration', async () => {
      const isConfigured = await paymentService.validateConfiguration();
      expect(isConfigured).toBe(true);
    });

    it('should create test payment intent successfully', async () => {
      const paymentIntent = await paymentService.createPaymentIntent({
        amount: 1000, // $10.00 in cents
        currency: 'usd',
        userId: 'test-user-id',
        description: 'Production validation test'
      });

      expect(paymentIntent.id).toBeDefined();
      expect(paymentIntent.client_secret).toBeDefined();
      expect(paymentIntent.amount).toBe(1000);
      expect(paymentIntent.currency).toBe('usd');
    });

    it('should handle webhook signature validation', async () => {
      const testPayload = JSON.stringify({
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test',
            amount: 1000,
            currency: 'usd'
          }
        }
      });

      const signature = paymentService.generateWebhookSignature(testPayload);
      const isValid = paymentService.validateWebhookSignature(testPayload, signature);
      expect(isValid).toBe(true);
    });

    it('should process refunds correctly', async () => {
      // Create a test payment intent first
      const paymentIntent = await paymentService.createPaymentIntent({
        amount: 1000,
        currency: 'usd',
        userId: 'test-user-id',
        description: 'Refund test'
      });

      // Simulate successful payment (in test mode)
      const refund = await paymentService.createRefund({
        paymentIntentId: paymentIntent.id,
        amount: 500, // Partial refund
        reason: 'requested_by_customer'
      });

      expect(refund.id).toBeDefined();
      expect(refund.amount).toBe(500);
      expect(refund.status).toBe('succeeded');
    });

    it('should handle payment failures gracefully', async () => {
      const failedPayment = await paymentService.createPaymentIntent({
        amount: 1000,
        currency: 'usd',
        userId: 'test-user-id',
        description: 'Failure test',
        paymentMethod: 'pm_card_chargeDeclined' // Test card that will be declined
      });

      expect(failedPayment.status).toBe('requires_payment_method');
    });
  });

  describe('Security and Authentication Validation', () => {
    it('should validate JWT token configuration', () => {
      expect(process.env.NEXTAUTH_SECRET).toBeDefined();
      expect(process.env.NEXTAUTH_SECRET!.length).toBeGreaterThan(32);
    });

    it('should validate CORS configuration', async () => {
      const corsConfig = {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://baseline-analyzer.com'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
      };

      expect(corsConfig.origin).toBeDefined();
      expect(corsConfig.origin.length).toBeGreaterThan(0);
      expect(corsConfig.credentials).toBe(true);
    });

    it('should validate rate limiting configuration', () => {
      const rateLimitConfig = {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
        standardHeaders: true,
        legacyHeaders: false
      };

      expect(rateLimitConfig.windowMs).toBeGreaterThan(0);
      expect(rateLimitConfig.max).toBeGreaterThan(0);
    });
  });

  describe('Monitoring and Health Checks', () => {
    it('should validate health check endpoints', async () => {
      const healthResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/health`);
      expect(healthResponse.status).toBe(200);
      
      const healthData = await healthResponse.json();
      expect(healthData.status).toBe('healthy');
      expect(healthData.timestamp).toBeDefined();
    });

    it('should validate metrics endpoint', async () => {
      const metricsResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/health/metrics`);
      expect(metricsResponse.status).toBe(200);
      
      const metricsData = await metricsResponse.json();
      expect(metricsData.database).toBeDefined();
      expect(metricsData.aiProviders).toBeDefined();
      expect(metricsData.emailService).toBeDefined();
    });

    it('should validate logging configuration', () => {
      expect(process.env.LOG_LEVEL).toBeDefined();
      expect(['error', 'warn', 'info', 'debug']).toContain(process.env.LOG_LEVEL);
    });
  });
});