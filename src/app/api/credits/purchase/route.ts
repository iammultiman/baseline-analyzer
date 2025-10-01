import { NextRequest, NextResponse } from 'next/server';
import { CreditService } from '@/lib/services/credit-service';
import { paymentService } from '@/lib/services/payment-service';
import { authMiddleware } from '@/lib/auth-middleware';
import { tenantMiddleware } from '@/lib/tenant-middleware';

interface PurchaseRequest {
  packageId: string;
  paymentIntentId?: string; // For Stripe payment confirmation
  paymentMethodId?: string; // For Stripe payment method
  useDemo?: boolean; // For demo/testing purposes
}

/**
 * POST /api/credits/purchase - Purchase credits with Stripe integration
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (!tenantResult.success) {
      return NextResponse.json({ error: tenantResult.error }, { status: 403 });
    }

    const body: PurchaseRequest = await request.json();
    const { packageId, paymentIntentId, paymentMethodId, useDemo } = body;

    if (!packageId) {
      return NextResponse.json(
        { error: 'Package ID is required' },
        { status: 400 }
      );
    }

    // Validate package exists
    const packages = CreditService.getCreditPackages();
    const selectedPackage = packages.find(p => p.id === packageId);
    
    if (!selectedPackage) {
      return NextResponse.json(
        { error: 'Invalid package ID' },
        { status: 400 }
      );
    }

    let paymentMetadata: any = {
      timestamp: new Date().toISOString(),
      amount: selectedPackage.price,
    };

    // Handle payment processing
    if (useDemo || !paymentService.isConfigured()) {
      // Demo mode - simulate successful payment
      paymentMetadata = {
        ...paymentMetadata,
        paymentMethod: 'demo',
        paymentIntentId: 'demo_' + Date.now(),
        status: 'succeeded',
      };
    } else {
      // Production mode - use Stripe
      if (!paymentIntentId) {
        return NextResponse.json(
          { error: 'Payment intent ID is required for production payments' },
          { status: 400 }
        );
      }

      try {
        // Retrieve and validate payment intent
        const paymentIntent = await paymentService.getPaymentIntent(paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
          return NextResponse.json(
            { error: 'Payment not completed. Please complete the payment first.' },
            { status: 400 }
          );
        }

        // Validate payment amount matches package price
        if (paymentIntent.amount !== selectedPackage.price) {
          return NextResponse.json(
            { error: 'Payment amount does not match package price' },
            { status: 400 }
          );
        }

        // Extract metadata from payment intent
        const stripeMetadata = paymentService.extractPaymentMetadata(paymentIntent);
        
        // Validate user ID matches
        if (stripeMetadata.userId !== authResult.user.uid) {
          return NextResponse.json(
            { error: 'Payment intent does not belong to current user' },
            { status: 403 }
          );
        }

        paymentMetadata = {
          ...paymentMetadata,
          paymentIntentId: paymentIntent.id,
          paymentMethod: 'stripe',
          status: paymentIntent.status,
          stripeCustomerId: paymentIntent.customer,
        };
      } catch (error) {
        console.error('Error validating payment:', error);
        return NextResponse.json(
          { error: 'Failed to validate payment' },
          { status: 400 }
        );
      }
    }

    // Process the credit purchase
    const result = await CreditService.processCreditPurchase(
      authResult.user.uid,
      packageId,
      paymentMetadata
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to process purchase' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
      package: selectedPackage,
      transaction: {
        credits: selectedPackage.credits,
        price: selectedPackage.price,
      },
      paymentMethod: paymentMetadata.paymentMethod,
    });
  } catch (error) {
    console.error('Error processing credit purchase:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}