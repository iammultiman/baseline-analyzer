import { NextRequest, NextResponse } from 'next/server';
import { baselineDataService } from '@/lib/services/baseline-data-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 10, threshold = 0.7 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required and must be a string' },
        { status: 400 }
      );
    }

    const results = await baselineDataService.searchSimilar(query, limit, threshold);
    
    return NextResponse.json({
      query,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('Error in baseline search API:', error);
    return NextResponse.json(
      { error: 'Failed to search baseline data' },
      { status: 500 }
    );
  }
}