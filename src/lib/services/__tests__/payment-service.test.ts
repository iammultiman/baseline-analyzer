import { PaymentService } from '../payment-service';
import { CreditPackage } from '../credit-service';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
    },
    paymentMethods: {
      list: jest.fn(),
    },
    customers: {
      list: jest.fn(),
      create: jest.fn(),
    },
  }));
});

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockStripe: any;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentService = PaymentService.getInstance();
    
    // Set up environment variables for testing
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';

    // Get the mocked Stripe instance
    const Stripe = require('stripe');
    mockStripe = new Stripe();
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  describe('createPaymentIntent', () => {
    const mockPackage: CreditPackage = {
      id: 'starter',
      name: 'Starter Pack',
      credits: 100,
      price: 999,
      description: 'Test package',
    };

    it('should create payment intent successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        client_secret: 'pi_123_secret',
        amount: 999,
        currency: 'usd',
        status: 'requires_payment_method',
      };

      mockStripe.paymentIntents.create.mockResolvedValueOnce(mockPaymentIntent);

      const result = await paymentService.createPaymentIntent(mockPackage, 'user-123');

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 999,
        currency: 'usd',
        metadata: {
          userId: 'user-123',
          packageId: 'starter',
          credits: '100',
        },
        description: 'Credit purchase: Starter Pack (100 credits)',
        automatic_payment_methods: {
          enabled: true,
        },
      });

      expect(result).toEqual({
        id: 'pi_123',
        clientSecret: 'pi_123_secret',
        amount: 999,
        currency: 'usd',
        status: 'requires_payment_method',
      });
    });

    it('should include organization ID in metadata when provided', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        client_secret: 'pi_123_secret',
        amount: 999,
        currency: 'usd',
        status: 'requires_payment_method',
      };

      mockStripe.paymentIntents.create.mockResolvedValueOnce(mockPaymentIntent);

      await paymentService.createPaymentIntent(mockPackage, 'user-123', 'org-456');

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            userId: 'user-123',
            packageId: 'starter',
            credits: '100',
            organizationId: 'org-456',
          },
        })
      );
    });

    it('should throw error when Stripe key is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;

      await expect(
        paymentService.createPaymentIntent(mockPackage, 'user-123')
      ).rejects.toThrow('Stripe secret key not configured');
    });

    it('should handle Stripe errors', async () => {
      mockStripe.paymentIntents.create.mockRejectedValueOnce(new Error('Stripe error'));

      await expect(
        paymentService.createPaymentIntent(mockPackage, 'user-123')
      ).rejects.toThrow('Failed to create payment intent');
    });
  });

  describe('getPaymentIntent', () => {
    it('should retrieve payment intent successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        status: 'succeeded',
        amount: 999,
      };

      mockStripe.paymentIntents.retrieve.mockResolvedValueOnce(mockPaymentIntent);

      const result = await paymentService.getPaymentIntent('pi_123');

      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_123');
      expect(result).toEqual(mockPaymentIntent);
    });

    it('should throw error when Stripe key is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;

      await expect(
        paymentService.getPaymentIntent('pi_123')
      ).rejects.toThrow('Stripe secret key not configured');
    });
  });

  describe('handleWebhookEvent', () => {
    it('should handle webhook event successfully', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      };

      mockStripe.webhooks.constructEvent.mockReturnValueOnce(mockEvent);

      const result = await paymentService.handleWebhookEvent('payload', 'signature');

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        'whsec_123'
      );
      expect(result).toEqual({
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      });
    });

    it('should throw error when webhook secret is not configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      await expect(
        paymentService.handleWebhookEvent('payload', 'signature')
      ).rejects.toThrow('Stripe webhook secret not configured');
    });

    it('should handle invalid webhook signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        paymentService.handleWebhookEvent('payload', 'invalid-signature')
      ).rejects.toThrow('Invalid webhook signature');
    });
  });

  describe('extractPaymentMetadata', () => {
    it('should extract metadata correctly', () => {
      const mockPaymentIntent = {
        metadata: {
          userId: 'user-123',
          packageId: 'starter',
          credits: '100',
          organizationId: 'org-456',
        },
      };

      const result = paymentService.extractPaymentMetadata(mockPaymentIntent as any);

      expect(result).toEqual({
        userId: 'user-123',
        packageId: 'starter',
        credits: 100,
        organizationId: 'org-456',
      });
    });

    it('should handle missing organization ID', () => {
      const mockPaymentIntent = {
        metadata: {
          userId: 'user-123',
          packageId: 'starter',
          credits: '100',
        },
      };

      const result = paymentService.extractPaymentMetadata(mockPaymentIntent as any);

      expect(result).toEqual({
        userId: 'user-123',
        packageId: 'starter',
        credits: 100,
        organizationId: undefined,
      });
    });
  });

  describe('createRefund', () => {
    it('should create refund successfully', async () => {
      const mockRefund = {
        id: 're_123',
        amount: 999,
        status: 'succeeded',
      };

      mockStripe.refunds.create.mockResolvedValueOnce(mockRefund);

      const result = await paymentService.createRefund('pi_123', 999, 'requested_by_customer');

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_123',
        amount: 999,
        reason: 'requested_by_customer',
      });
      expect(result).toEqual(mockRefund);
    });

    it('should create full refund when amount not specified', async () => {
      const mockRefund = {
        id: 're_123',
        status: 'succeeded',
      };

      mockStripe.refunds.create.mockResolvedValueOnce(mockRefund);

      await paymentService.createRefund('pi_123');

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_123',
      });
    });
  });

  describe('isConfigured', () => {
    it('should return true when both keys are configured', () => {
      expect(paymentService.isConfigured()).toBe(true);
    });

    it('should return false when secret key is missing', () => {
      delete process.env.STRIPE_SECRET_KEY;
      expect(paymentService.isConfigured()).toBe(false);
    });

    it('should return false when publishable key is missing', () => {
      delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      expect(paymentService.isConfigured()).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PaymentService.getInstance();
      const instance2 = PaymentService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});