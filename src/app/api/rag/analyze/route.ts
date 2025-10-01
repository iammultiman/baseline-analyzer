import { NextRequest, NextResponse } from 'next/server';
import { ragService } from '@/lib/services/rag-service';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { repositoryContent, analysisType = 'full' } = body;

    if (!repositoryContent || typeof repositoryContent !== 'string') {
      return NextResponse.json(
        { error: 'Repository content is required and must be a string' },
        { status: 400 }
      );
    }

    if (!['compatibility', 'recommendations', 'full'].includes(analysisType)) {
      return NextResponse.json(
        { error: 'Invalid analysis type. Must be: compatibility, recommendations, or full' },
        { status: 400 }
      );
    }

    // Generate analysis prompt with RAG context
    const prompt = await ragService.generateAnalysisPrompt(repositoryContent, analysisType);
    
    return NextResponse.json({
      prompt,
      analysisType,
      contentLength: repositoryContent.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in RAG analyze API:', error);
    return NextResponse.json(
      { error: 'Failed to generate analysis prompt' },
      { status: 500 }
    );
  }
}