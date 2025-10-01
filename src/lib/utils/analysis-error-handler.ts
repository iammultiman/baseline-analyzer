import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export interface AnalysisError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  userMessage: string;
}

export class AnalysisErrorHandler {
  private static errorMap: Record<string, AnalysisError> = {
    // Repository access errors
    'REPO_NOT_FOUND': {
      code: 'REPO_NOT_FOUND',
      message: 'Repository not found or not accessible',
      retryable: false,
      userMessage: 'The repository could not be found. Please check the URL and ensure the repository is public or you have access to it.'
    },
    'REPO_PRIVATE': {
      code: 'REPO_PRIVATE',
      message: 'Repository is private and requires authentication',
      retryable: false,
      userMessage: 'This repository is private. Please ensure it is public or provide appropriate access credentials.'
    },
    'REPO_TOO_LARGE': {
      code: 'REPO_TOO_LARGE',
      message: 'Repository exceeds size limits',
      retryable: false,
      userMessage: 'This repository is too large to analyze. Please try with a smaller repository or contact support for assistance.'
    },
    'REPO_EMPTY': {
      code: 'REPO_EMPTY',
      message: 'Repository contains no analyzable files',
      retryable: false,
      userMessage: 'This repository appears to be empty or contains no files that can be analyzed.'
    },
    'REPO_INVALID_FORMAT': {
      code: 'REPO_INVALID_FORMAT',
      message: 'Repository format is not supported',
      retryable: false,
      userMessage: 'This repository format is not currently supported for analysis.'
    },

    // Processing errors
    'PROCESSING_TIMEOUT': {
      code: 'PROCESSING_TIMEOUT',
      message: 'Repository processing timed out',
      retryable: true,
      userMessage: 'Repository processing took too long and timed out. Please try again or contact support if the issue persists.'
    },
    'PROCESSING_FAILED': {
      code: 'PROCESSING_FAILED',
      message: 'Repository processing failed',
      retryable: true,
      userMessage: 'An error occurred while processing the repository. Please try again.'
    },
    'GITINGEST_ERROR': {
      code: 'GITINGEST_ERROR',
      message: 'GitIngest service error',
      retryable: true,
      userMessage: 'The repository processing service is temporarily unavailable. Please try again in a few minutes.'
    },

    // AI analysis errors
    'AI_PROVIDER_ERROR': {
      code: 'AI_PROVIDER_ERROR',
      message: 'AI provider service error',
      retryable: true,
      userMessage: 'The AI analysis service is temporarily unavailable. Please try again in a few minutes.'
    },
    'AI_QUOTA_EXCEEDED': {
      code: 'AI_QUOTA_EXCEEDED',
      message: 'AI provider quota exceeded',
      retryable: true,
      userMessage: 'The AI service quota has been exceeded. Please try again later or contact support.'
    },
    'AI_INVALID_RESPONSE': {
      code: 'AI_INVALID_RESPONSE',
      message: 'AI provider returned invalid response',
      retryable: true,
      userMessage: 'The AI analysis returned an unexpected result. Please try again.'
    },

    // Credit and billing errors
    'INSUFFICIENT_CREDITS': {
      code: 'INSUFFICIENT_CREDITS',
      message: 'Insufficient credits for analysis',
      retryable: false,
      userMessage: 'You do not have enough credits to perform this analysis. Please purchase more credits to continue.'
    },
    'CREDIT_DEDUCTION_FAILED': {
      code: 'CREDIT_DEDUCTION_FAILED',
      message: 'Failed to deduct credits',
      retryable: true,
      userMessage: 'There was an issue processing your credits. Please try again or contact support.'
    },

    // System errors
    'DATABASE_ERROR': {
      code: 'DATABASE_ERROR',
      message: 'Database operation failed',
      retryable: true,
      userMessage: 'A system error occurred. Please try again or contact support if the issue persists.'
    },
    'RATE_LIMIT_EXCEEDED': {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded',
      retryable: true,
      userMessage: 'You have exceeded the rate limit. Please wait a moment before trying again.'
    },
    'SYSTEM_OVERLOAD': {
      code: 'SYSTEM_OVERLOAD',
      message: 'System is currently overloaded',
      retryable: true,
      userMessage: 'The system is currently experiencing high load. Please try again in a few minutes.'
    },

    // Generic errors
    'UNKNOWN_ERROR': {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      retryable: true,
      userMessage: 'An unexpected error occurred. Please try again or contact support if the issue persists.'
    }
  };

  /**
   * Handle and categorize analysis errors
   */
  static handleError(error: any, context?: string): AnalysisError {
    console.error(`Analysis error in ${context || 'unknown context'}:`, error);

    // Try to match error to known patterns
    const errorMessage = error?.message || error?.toString() || '';
    const errorCode = error?.code || '';

    // Repository access errors
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return this.errorMap.REPO_NOT_FOUND;
    }
    if (errorMessage.includes('private') || errorMessage.includes('403')) {
      return this.errorMap.REPO_PRIVATE;
    }
    if (errorMessage.includes('too large') || errorMessage.includes('size limit')) {
      return this.errorMap.REPO_TOO_LARGE;
    }
    if (errorMessage.includes('empty') || errorMessage.includes('no files')) {
      return this.errorMap.REPO_EMPTY;
    }

    // Processing errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return this.errorMap.PROCESSING_TIMEOUT;
    }
    if (errorMessage.includes('gitingest') || errorMessage.includes('GitIngest')) {
      return this.errorMap.GITINGEST_ERROR;
    }

    // AI errors
    if (errorMessage.includes('AI') || errorMessage.includes('provider')) {
      if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        return this.errorMap.AI_QUOTA_EXCEEDED;
      }
      return this.errorMap.AI_PROVIDER_ERROR;
    }

    // Credit errors
    if (errorMessage.includes('insufficient credits') || errorMessage.includes('credit')) {
      return this.errorMap.INSUFFICIENT_CREDITS;
    }

    // Database errors
    if (errorMessage.includes('database') || errorMessage.includes('prisma') || errorCode.includes('P')) {
      return this.errorMap.DATABASE_ERROR;
    }

    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return this.errorMap.RATE_LIMIT_EXCEEDED;
    }

    // Default to unknown error
    return {
      ...this.errorMap.UNKNOWN_ERROR,
      details: errorMessage
    };
  }

  /**
   * Update analysis record with error information
   */
  static async updateAnalysisWithError(
    analysisId: string,
    error: AnalysisError,
    stage?: string
  ): Promise<void> {
    try {
      await prisma.repositoryAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'FAILED',
          metadata: {
            error: error.message,
            errorCode: error.code,
            userMessage: error.userMessage,
            retryable: error.retryable,
            failedAt: new Date().toISOString(),
            failedStage: stage || 'unknown',
            details: error.details
          }
        }
      });
    } catch (dbError) {
      console.error('Failed to update analysis with error:', dbError);
    }
  }

  /**
   * Create error response for API endpoints
   */
  static createErrorResponse(error: AnalysisError, statusCode?: number): NextResponse {
    const status = statusCode || this.getStatusCodeForError(error);
    
    return NextResponse.json(
      {
        error: error.userMessage,
        code: error.code,
        retryable: error.retryable,
        details: error.details
      },
      { status }
    );
  }

  /**
   * Get appropriate HTTP status code for error type
   */
  private static getStatusCodeForError(error: AnalysisError): number {
    switch (error.code) {
      case 'REPO_NOT_FOUND':
      case 'REPO_EMPTY':
        return 404;
      case 'REPO_PRIVATE':
        return 403;
      case 'REPO_TOO_LARGE':
      case 'REPO_INVALID_FORMAT':
      case 'INSUFFICIENT_CREDITS':
        return 400;
      case 'RATE_LIMIT_EXCEEDED':
        return 429;
      case 'AI_PROVIDER_ERROR':
      case 'AI_QUOTA_EXCEEDED':
      case 'PROCESSING_TIMEOUT':
      case 'PROCESSING_FAILED':
      case 'GITINGEST_ERROR':
      case 'DATABASE_ERROR':
      case 'SYSTEM_OVERLOAD':
        return 503;
      default:
        return 500;
    }
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: any): boolean {
    const analysisError = this.handleError(error);
    return analysisError.retryable;
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error: any): string {
    const analysisError = this.handleError(error);
    return analysisError.userMessage;
  }

  /**
   * Log error with context
   */
  static logError(error: any, context: string, metadata?: any): void {
    const analysisError = this.handleError(error, context);
    
    console.error('Analysis Error:', {
      code: analysisError.code,
      message: analysisError.message,
      context,
      retryable: analysisError.retryable,
      metadata,
      timestamp: new Date().toISOString(),
      stack: error?.stack
    });
  }
}