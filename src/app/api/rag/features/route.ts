import { NextRequest, NextResponse } from 'next/server';
import { ragService } from '@/lib/services/rag-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { features } = body;

    if (!features || !Array.isArray(features)) {
      return NextResponse.json(
        { error: 'Features parameter is required and must be an array' },
        { status: 400 }
      );
    }

    // Get baseline data for the specified features
    const baselineFeatures = await ragService.getFeatureBaseline(features);
    
    // Check support for each feature
    const supportChecks = await Promise.all(
      features.map(async (feature) => {
        const support = await ragService.checkFeatureSupport(feature);
        return {
          feature,
          ...support,
        };
      })
    );

    return NextResponse.json({
      features: baselineFeatures,
      supportChecks,
      summary: {
        total: features.length,
        supported: supportChecks.filter(check => check.isSupported).length,
        unsupported: supportChecks.filter(check => !check.isSupported).length,
        unknown: supportChecks.filter(check => check.status === 'unknown').length,
      },
    });
  } catch (error) {
    console.error('Error in RAG features API:', error);
    return NextResponse.json(
      { error: 'Failed to analyze features' },
      { status: 500 }
    );
  }
}