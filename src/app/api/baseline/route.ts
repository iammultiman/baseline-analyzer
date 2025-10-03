import { NextRequest, NextResponse } from 'next/server';
import { baselineDataService } from '@/lib/services/baseline-data-service';
import { requireAuth } from '@/lib/auth-middleware';

function serializeFeature(feature: any) {
  return {
    ...feature,
    lastUpdated:
      feature?.lastUpdated instanceof Date
        ? feature.lastUpdated.toISOString()
        : feature?.lastUpdated ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (query) {
      // Perform similarity search
      const results = await baselineDataService.searchSimilar(query, limit);
      return NextResponse.json({
        results: results.map(result => ({
          ...result,
          feature: serializeFeature(result.feature),
        })),
      });
    } else if (category) {
      // Get features by category
      const features = await baselineDataService.getFeaturesByCategory(category);
      return NextResponse.json({
        features: features.map(serializeFeature),
      });
    } else {
      // Get all features
      const features = await baselineDataService.getAllFeatures();
      return NextResponse.json({
        features: features.map(serializeFeature),
      });
    }
  } catch (error) {
    console.error('Error in baseline API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch baseline data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication for data updates
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admin users to update baseline data
    if (authResult.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'update') {
      // Fetch and update baseline data
      const baselineSource = await baselineDataService.fetchLatestBaseline();
      const result = await baselineDataService.updateVectorDatabase(baselineSource.features);
      
      return NextResponse.json({
        success: result.success,
        message: `Updated ${result.featuresUpdated} features, added ${result.featuresAdded} new features`,
        details: result,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error updating baseline data:', error);
    return NextResponse.json(
      { error: 'Failed to update baseline data' },
      { status: 500 }
    );
  }
}