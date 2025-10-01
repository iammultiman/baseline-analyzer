import { NextRequest, NextResponse } from 'next/server';
import { PricingConfig } from '@/lib/services/credit-service';
import { authMiddleware } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

/**
 * GET /api/admin/pricing - Get current pricing configuration
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: authResult.user.uid },
      include: { organization: true },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get pricing config from organization settings or use defaults
    const pricingConfig = user.organization?.settings as any;
    
    return NextResponse.json({
      pricingConfig: pricingConfig?.pricing || null,
    });
  } catch (error) {
    console.error('Error fetching pricing configuration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/pricing - Update pricing configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: authResult.user.uid },
      include: { organization: true },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!user.organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const pricingConfig: PricingConfig = await request.json();

    // Validate pricing config structure
    if (!pricingConfig.packages || !Array.isArray(pricingConfig.packages)) {
      return NextResponse.json(
        { error: 'Invalid pricing configuration: packages array required' },
        { status: 400 }
      );
    }

    if (typeof pricingConfig.freeCredits !== 'number' || pricingConfig.freeCredits < 0) {
      return NextResponse.json(
        { error: 'Invalid pricing configuration: freeCredits must be a non-negative number' },
        { status: 400 }
      );
    }

    // Validate packages
    for (const pkg of pricingConfig.packages) {
      if (!pkg.id || !pkg.name || typeof pkg.credits !== 'number' || typeof pkg.price !== 'number') {
        return NextResponse.json(
          { error: 'Invalid package configuration: id, name, credits, and price are required' },
          { status: 400 }
        );
      }
      if (pkg.credits <= 0 || pkg.price <= 0) {
        return NextResponse.json(
          { error: 'Invalid package configuration: credits and price must be positive' },
          { status: 400 }
        );
      }
    }

    // Update organization settings
    const currentSettings = user.organization.settings as any || {};
    const updatedSettings = {
      ...currentSettings,
      pricing: pricingConfig,
      lastUpdated: new Date().toISOString(),
    };

    await prisma.organization.update({
      where: { id: user.organization.id },
      data: { settings: updatedSettings },
    });

    return NextResponse.json({
      success: true,
      pricingConfig,
    });
  } catch (error) {
    console.error('Error updating pricing configuration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}