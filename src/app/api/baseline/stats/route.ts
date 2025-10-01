import { NextRequest, NextResponse } from 'next/server';
import { baselineDataService } from '@/lib/services/baseline-data-service';

export async function GET(request: NextRequest) {
  try {
    const stats = await baselineDataService.getStatistics();
    
    return NextResponse.json({
      statistics: stats,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in baseline stats API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch baseline statistics' },
      { status: 500 }
    );
  }
}