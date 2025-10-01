import { NextRequest, NextResponse } from 'next/server';
import { CreditService } from '@/lib/services/credit-service';
import { paymentService } from '@/lib/services/payment-service';
import { authMiddleware } from '@/lib/auth-middleware';
import { tenantMiddleware } from '@/lib/tenant-middleware';
import { z } from 'zod';

const createPaymentIntentSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
});

/**
 * POST /api/credits/payment-intent - Create a payment intent for credit purchase
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

    // Check if Stripe is configured
    if (!paymentService.isConfigured()) {
      return NextResponse.json(
        { error: 'Payment processing not configured. Please use demo mode.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { packageId } = createPaymentIntentSchema.parse(body);

    // Validate package exists
    const packages = CreditService.getCreditPackages();
    const selectedPackage = packages.find(p => p.id === packageId);
    
    if (!selectedPackage) {
      return NextResponse.json(
        { error: 'Invalid package ID' },
        { status: 400 }
      );
    }

    // Create payment intent
    const paymentIntent = await paymentService.createPaymentIntent(
      selectedPackage,
      authResult.user.uid,
      tenantResult.organizationId
    );

    return NextResponse.json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.clientSecret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      },
      package: selectedPackage,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}