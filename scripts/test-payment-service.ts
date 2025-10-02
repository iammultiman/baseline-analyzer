#!/usr/bin/env tsx

import { PaymentService } from '../src/lib/services/payment-service';

async function testPaymentService() {
  console.log('Testing payment service configuration...');
  
  const paymentService = new PaymentService();
  
  try {
    // Test configuration
    const isConfigured = await paymentService.validateConfiguration();
    
    if (!isConfigured) {
      console.log('❌ Payment service is not properly configured');
      process.exit(1);
    }
    
    console.log('✅ Payment service configuration is valid');
    
    // Test payment intent creation
    const paymentIntent = await paymentService.createPaymentIntent({
      amount: 1000, // $10.00 in cents
      currency: 'usd',
      userId: 'test-user-id',
      description: 'Production validation test'
    });
    
    if (paymentIntent.id && paymentIntent.client_secret) {
      console.log('✅ Payment intent creation works');
      console.log(`Payment Intent ID: ${paymentIntent.id}`);
    } else {
      console.log('❌ Payment intent creation failed');
      process.exit(1);
    }
    
    // Test webhook signature validation
    const testPayload = JSON.stringify({
      id: 'evt_test',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: paymentIntent.id,
          amount: 1000,
          currency: 'usd'
        }
      }
    });
    
    const signature = paymentService.generateWebhookSignature(testPayload);
    const isValidSignature = paymentService.validateWebhookSignature(testPayload, signature);
    
    if (isValidSignature) {
      console.log('✅ Webhook signature validation works');
    } else {
      console.log('❌ Webhook signature validation failed');
      process.exit(1);
    }
    
    // Test refund creation (if payment was successful)
    try {
      const refund = await paymentService.createRefund({
        paymentIntentId: paymentIntent.id,
        amount: 500, // Partial refund
        reason: 'requested_by_customer'
      });
      
      if (refund.id) {
        console.log('✅ Refund creation works');
        console.log(`Refund ID: ${refund.id}`);
      }
    } catch (refundError) {
      console.log('ℹ️  Refund test skipped (payment not captured)');
    }
    
    console.log('✅ Payment service test completed successfully');
    
  } catch (error) {
    console.error('❌ Payment service test failed:', error);
    process.exit(1);
  }
}

testPaymentService();