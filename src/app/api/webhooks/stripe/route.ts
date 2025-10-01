import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/services/payment-service';
import { CreditService } from '@/lib/services/credit-service';
import { headers } from 'next/headers';

/**
 * POST /api/webhooks/stripe - Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify and parse webhook event
    const event = await paymentService.handleWebhookEvent(body, signature);

    console.log(`Received Stripe webhook: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      
      case 'payment_intent.canceled':
        await handlePaymentCanceled(event.data.object);
        break;
      
      case 'charge.dispute.created':
        await handleChargeDispute(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error handling Stripe webhook:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(paymentIntent: any) {
  try {
    const metadata = paymentService.extractPaymentMetadata(paymentIntent);
    
    console.log(`Payment succeeded for user ${metadata.userId}, package ${metadata.packageId}`);
    
    // Note: Credits should already be processed via the purchase API
    // This webhook serves as a backup and for logging/analytics
    
    // You could add additional logic here such as:
    // - Sending confirmation emails
    // - Updating analytics
    // - Triggering other business processes
    
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent: any) {
  try {
    const metadata = paymentService.extractPaymentMetadata(paymentIntent);
    
    console.log(`Payment failed for user ${metadata.userId}, package ${metadata.packageId}`);
    
    // Log the failure for analytics and support
    // You might want to:
    // - Send notification to user about payment failure
    // - Log for support team review
    // - Trigger retry logic if appropriate
    
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

/**
 * Handle canceled payment
 */
async function handlePaymentCanceled(paymentIntent: any) {
  try {
    const metadata = paymentService.extractPaymentMetadata(paymentIntent);
    
    console.log(`Payment canceled for user ${metadata.userId}, package ${metadata.packageId}`);
    
    // Handle payment cancellation
    // Usually no action needed, but you might want to log for analytics
    
  } catch (error) {
    console.error('Error handling payment cancellation:', error);
  }
}

/**
 * Handle charge disputes (chargebacks)
 */
async function handleChargeDispute(charge: any) {
  try {
    console.log(`Charge dispute created for charge ${charge.id}`);
    
    // Handle dispute/chargeback
    // You might want to:
    // - Notify admin team
    // - Freeze related user account pending investigation
    // - Gather evidence for dispute response
    
  } catch (error) {
    console.error('Error handling charge dispute:', error);
  }
}

/**
 * Handle payment method failures with retry logic
 */
export async function handlePaymentRetry(
  paymentIntentId: string,
  maxRetries: number = 3
): Promise<boolean> {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const paymentIntent = await paymentService.getPaymentIntent(paymentIntentId);
      
      if (paymentIntent.status === 'succeeded') {
        return true;
      }
      
      if (paymentIntent.status === 'requires_payment_method') {
        // Payment method failed, but can be retried with a new payment method
        console.log(`Payment intent ${paymentIntentId} requires new payment method (retry ${retryCount + 1})`);
        
        // In a real implementation, you might:
        // - Notify the user to update their payment method
        // - Automatically retry with a backup payment method if available
        // - Apply exponential backoff
        
        retryCount++;
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      } else {
        // Payment is in a state that can't be retried
        console.log(`Payment intent ${paymentIntentId} is in non-retryable state: ${paymentIntent.status}`);
        return false;
      }
    } catch (error) {
      console.error(`Error during payment retry ${retryCount + 1}:`, error);
      retryCount++;
      
      if (retryCount >= maxRetries) {
        return false;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
    }
  }
  
  return false;
}