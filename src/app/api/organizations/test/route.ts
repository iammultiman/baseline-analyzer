import { NextRequest, NextResponse } from 'next/server';
import runIntegrationTests from '@/lib/test-integration';

// Test endpoint to verify organization management functionality
export async function GET() {
  try {
    const result = await runIntegrationTests();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Multi-tenancy and organization management system test completed successfully',
        results: result.results
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Integration tests failed'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Organization management test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}