import Stripe from 'stripe';
import { CreditPackage } from './credit-service';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentMetadata {
  userId: string;
  packageId: string;
  credits: number;
  organizationId?: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}

export class PaymentService {
  private static instance: PaymentService;

  private constructor() {}

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Create a payment intent for credit purchase
   */
  async createPaymentIntent(
    creditPackage: CreditPackage,
    userId: string,
    organizationId?: string
  ): Promise<PaymentIntent> {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not configured');
    }

    const metadata: PaymentMetadata = {
      userId,
      packageId: creditPackage.id,
      credits: creditPackage.credits,
    };

    if (organizationId) {
      metadata.organizationId = organizationId;
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: creditPackage.price, // Amount in cents
        currency: 'usd',
        metadata: metadata as Record<string, string>,
        description: `Credit purchase: ${creditPackage.name} (${creditPackage.credits} credits)`,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  /**
   * Retrieve payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not configured');
    }

    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      throw new Error('Failed to retrieve payment intent');
    }
  }

  /**
   * Confirm payment intent (for server-side confirmation)
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string
  ): Promise<Stripe.PaymentIntent> {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not configured');
    }

    try {
      const params: Stripe.PaymentIntentConfirmParams = {};
      
      if (paymentMethodId) {
        params.payment_method = paymentMethodId;
      }

      return await stripe.paymentIntents.confirm(paymentIntentId, params);
    } catch (error) {
      console.error('Error confirming payment intent:', error);
      throw new Error('Failed to confirm payment intent');
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Promise<WebhookEvent> {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Stripe webhook secret not configured');
    }

    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      return {
        id: event.id,
        type: event.type,
        data: event.data,
      };
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Extract metadata from payment intent
   */
  extractPaymentMetadata(paymentIntent: Stripe.PaymentIntent): PaymentMetadata {
    const metadata = paymentIntent.metadata;
    
    return {
      userId: metadata.userId,
      packageId: metadata.packageId,
      credits: parseInt(metadata.credits, 10),
      organizationId: metadata.organizationId || undefined,
    };
  }

  /**
   * Create a refund for a payment
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<Stripe.Refund> {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not configured');
    }

    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundParams.amount = amount;
      }

      if (reason) {
        refundParams.reason = reason as Stripe.RefundCreateParams.Reason;
      }

      return await stripe.refunds.create(refundParams);
    } catch (error) {
      console.error('Error creating refund:', error);
      throw new Error('Failed to create refund');
    }
  }

  /**
   * Get payment methods for a customer
   */
  async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not configured');
    }

    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      console.error('Error retrieving payment methods:', error);
      throw new Error('Failed to retrieve payment methods');
    }
  }

  /**
   * Create or retrieve Stripe customer
   */
  async createOrGetCustomer(
    userId: string,
    email: string,
    name?: string
  ): Promise<Stripe.Customer> {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not configured');
    }

    try {
      // First, try to find existing customer
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
      }

      // Create new customer
      return await stripe.customers.create({
        email: email,
        name: name,
        metadata: {
          userId: userId,
        },
      });
    } catch (error) {
      console.error('Error creating/retrieving customer:', error);
      throw new Error('Failed to create or retrieve customer');
    }
  }

  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.STRIPE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    );
  }
}

export const paymentService = PaymentService.getInstance();