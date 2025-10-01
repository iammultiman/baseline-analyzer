import { prisma } from '@/lib/database';
import { 
  CICDAnalysisRequest, 
  CICDAnalysisResponse, 
  MachineReadableAnalysisResult,
  WebhookPayload,
  WEBHOOK_EVENTS 
} from '@/lib/types/cicd';
import { RepositoryProcessor } from '@/lib/services/repository-processor';
import { AIAnalysisEngine } from '@/lib/services/ai-analysis-engine';
import { CreditService } from '@/lib/services/credit-service';
import { WebhookService } from '@/lib/services/webhook-service';

export class CICDAnalysisService {
  static async submitAnalysis(
    organizationId: string,
    userId: string,
    request: CICDAnalysisRequest
  ): Promise<CICDAnalysisResponse> {
    // Validate repository URL
    const validation = await RepositoryProcessor.validateRepository(request.repositoryUrl);
    if (!validation.isValid) {
      throw new Error(`Invalid repository: ${validation.error}`);
    }

    // Estimate credits required
    const estimation = await this.estimateCredits(request.repositoryUrl);
    
    // Check if user has sufficient credits
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });

    if (!user || user.creditBalance < estimation.estimatedCredits) {
      throw new Error('Insufficient credits for analysis');
    }

    // Create analysis record
    const analysis = await prisma.repositoryAnalysis.create({
      data: {
        userId,
        organizationId,
        repositoryUrl: request.repositoryUrl,
        repositoryName: this.extractRepoName(request.repositoryUrl),
        status: 'PENDING',
        metadata: {
          branch: request.branch,
          commitSha: request.commitSha,
          webhookUrl: request.webhookUrl,
          priority: request.priority || 'normal',
          cicdMetadata: request.metadata,
          estimatedCredits: estimation.estimatedCredits,
        },
      },
    });

    // Trigger webhook for analysis started
    if (request.webhookUrl || organizationId) {
      const payload: WebhookPayload = {
        event: WEBHOOK_EVENTS.ANALYSIS_STARTED,
        timestamp: new Date(),
        organizationId,
        analysis: {
          id: analysis.id,
          repositoryUrl: request.repositoryUrl,
          branch: request.branch,
          commitSha: request.commitSha,
          status: 'completed', // This will be updated when analysis completes
        },
      };

      if (request.webhookUrl) {
        // Send to specific webhook URL
        await this.sendWebhookToUrl(request.webhookUrl, payload);
      } else {
        // Send to organization webhooks
        await WebhookService.triggerWebhook(organizationId, WEBHOOK_EVENTS.ANALYSIS_STARTED, payload);
      }
    }

    // Start analysis in background (high priority for CI/CD)
    setImmediate(() => this.processAnalysis(analysis.id, request.priority === 'high'));

    return {
      id: analysis.id,
      status: 'pending',
      repositoryUrl: request.repositoryUrl,
      branch: request.branch,
      commitSha: request.commitSha,
      estimatedCredits: estimation.estimatedCredits,
      createdAt: analysis.analysisDate,
      webhookUrl: request.webhookUrl,
    };
  }

  static async getAnalysisStatus(
    organizationId: string,
    analysisId: string
  ): Promise<CICDAnalysisResponse | null> {
    const analysis = await prisma.repositoryAnalysis.findFirst({
      where: {
        id: analysisId,
        organizationId,
      },
    });

    if (!analysis) {
      return null;
    }

    const metadata = analysis.metadata as any;

    return {
      id: analysis.id,
      status: analysis.status.toLowerCase() as any,
      repositoryUrl: analysis.repositoryUrl,
      branch: metadata?.branch,
      commitSha: metadata?.commitSha,
      estimatedCredits: metadata?.estimatedCredits || 0,
      createdAt: analysis.analysisDate,
      webhookUrl: metadata?.webhookUrl,
    };
  }

  static async getAnalysisResult(
    organizationId: string,
    analysisId: string
  ): Promise<MachineReadableAnalysisResult | null> {
    const analysis = await prisma.repositoryAnalysis.findFirst({
      where: {
        id: analysisId,
        organizationId,
        status: 'COMPLETED',
      },
    });

    if (!analysis || !analysis.results) {
      return null;
    }

    return this.formatMachineReadableResult(analysis);
  }

  private static async processAnalysis(analysisId: string, highPriority: boolean = false): Promise<void> {
    try {
      // Update status to processing
      await prisma.repositoryAnalysis.update({
        where: { id: analysisId },
        data: { status: 'PROCESSING' },
      });

      const analysis = await prisma.repositoryAnalysis.findUnique({
        where: { id: analysisId },
        include: {
          user: true,
          organization: true,
        },
      });

      if (!analysis) {
        throw new Error('Analysis not found');
      }

      // Process repository
      const processResult = await RepositoryProcessor.processRepository(
        analysis.repositoryUrl,
        analysis.userId
      );

      // Perform AI analysis
      const aiResult = await AIAnalysisEngine.analyzeRepository(
        processResult.content,
        analysis.organizationId
      );

      // Calculate actual credit cost
      const creditCost = await CreditService.calculateCreditCost(
        analysis.organizationId,
        processResult.metadata.size,
        aiResult.metadata?.complexity || 1
      );

      // Deduct credits
      await CreditService.deductCredits(analysis.userId, creditCost);

      // Update analysis with results
      await prisma.repositoryAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'COMPLETED',
          creditsCost: creditCost,
          results: aiResult,
          metadata: {
            ...analysis.metadata,
            actualCredits: creditCost,
            completedAt: new Date(),
            processingTime: Date.now() - analysis.analysisDate.getTime(),
          },
        },
      });

      // Send completion webhook
      await this.sendCompletionWebhook(analysis, aiResult);

    } catch (error) {
      console.error(`Analysis ${analysisId} failed:`, error);

      // Update analysis with error
      await prisma.repositoryAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'FAILED',
          results: {
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
            },
          },
        },
      });

      // Send failure webhook
      await this.sendFailureWebhook(analysisId, error);
    }
  }

  private static async sendCompletionWebhook(analysis: any, result: any): Promise<void> {
    const metadata = analysis.metadata as any;
    const machineResult = this.formatMachineReadableResult({
      ...analysis,
      results: result,
    });

    const payload: WebhookPayload = {
      event: WEBHOOK_EVENTS.ANALYSIS_COMPLETED,
      timestamp: new Date(),
      organizationId: analysis.organizationId,
      analysis: {
        id: analysis.id,
        repositoryUrl: analysis.repositoryUrl,
        branch: metadata?.branch,
        commitSha: metadata?.commitSha,
        status: 'completed',
        result: machineResult,
      },
    };

    if (metadata?.webhookUrl) {
      await this.sendWebhookToUrl(metadata.webhookUrl, payload);
    } else {
      await WebhookService.triggerWebhook(analysis.organizationId, WEBHOOK_EVENTS.ANALYSIS_COMPLETED, payload);
    }
  }

  private static async sendFailureWebhook(analysisId: string, error: any): Promise<void> {
    const analysis = await prisma.repositoryAnalysis.findUnique({
      where: { id: analysisId },
    });

    if (!analysis) return;

    const metadata = analysis.metadata as any;

    const payload: WebhookPayload = {
      event: WEBHOOK_EVENTS.ANALYSIS_FAILED,
      timestamp: new Date(),
      organizationId: analysis.organizationId,
      analysis: {
        id: analysis.id,
        repositoryUrl: analysis.repositoryUrl,
        branch: metadata?.branch,
        commitSha: metadata?.commitSha,
        status: 'failed',
        error: {
          code: 'ANALYSIS_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      },
    };

    if (metadata?.webhookUrl) {
      await this.sendWebhookToUrl(metadata.webhookUrl, payload);
    } else {
      await WebhookService.triggerWebhook(analysis.organizationId, WEBHOOK_EVENTS.ANALYSIS_FAILED, payload);
    }
  }

  private static async sendWebhookToUrl(url: string, payload: WebhookPayload): Promise<void> {
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Baseline-Analyzer-CICD/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      console.error(`Failed to send webhook to ${url}:`, error);
    }
  }

  private static formatMachineReadableResult(analysis: any): MachineReadableAnalysisResult {
    const results = analysis.results || {};
    const metadata = analysis.metadata as any;

    return {
      id: analysis.id,
      repositoryUrl: analysis.repositoryUrl,
      branch: metadata?.branch,
      commitSha: metadata?.commitSha,
      status: 'completed',
      completedAt: new Date(metadata?.completedAt || analysis.analysisDate),
      creditsCost: analysis.creditsCost || 0,
      summary: {
        complianceScore: results.complianceScore || 0,
        totalIssues: results.issues?.length || 0,
        criticalIssues: results.issues?.filter((i: any) => i.severity === 'critical').length || 0,
        warningIssues: results.issues?.filter((i: any) => i.severity === 'warning').length || 0,
        infoIssues: results.issues?.filter((i: any) => i.severity === 'info').length || 0,
        passedChecks: results.passedChecks || 0,
        totalChecks: results.totalChecks || 0,
      },
      issues: results.issues || [],
      recommendations: results.recommendations || [],
      baselineCompliance: results.baselineCompliance || {
        supportedFeatures: [],
        unsupportedFeatures: [],
        partiallySupported: [],
        recommendations: [],
      },
      metadata: {
        analysisVersion: '1.0.0',
        aiProvider: results.aiProvider || 'unknown',
        processingTime: metadata?.processingTime || 0,
        repositorySize: metadata?.repositorySize || 0,
        fileCount: metadata?.fileCount || 0,
      },
    };
  }

  private static async estimateCredits(repositoryUrl: string): Promise<{ estimatedCredits: number }> {
    // Simple estimation based on repository URL
    // In a real implementation, this might fetch repository metadata
    return { estimatedCredits: 10 }; // Default estimation
  }

  private static extractRepoName(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        return `${pathParts[pathParts.length - 2]}/${pathParts[pathParts.length - 1]}`;
      }
      return url;
    } catch {
      return url;
    }
  }

  static async listAnalyses(
    organizationId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CICDAnalysisResponse[]> {
    const { status, limit = 50, offset = 0 } = options;

    const whereClause: any = { organizationId };
    if (status) {
      whereClause.status = status.toUpperCase();
    }

    const analyses = await prisma.repositoryAnalysis.findMany({
      where: whereClause,
      orderBy: { analysisDate: 'desc' },
      take: limit,
      skip: offset,
    });

    return analyses.map(analysis => {
      const metadata = analysis.metadata as any;
      return {
        id: analysis.id,
        status: analysis.status.toLowerCase() as any,
        repositoryUrl: analysis.repositoryUrl,
        branch: metadata?.branch,
        commitSha: metadata?.commitSha,
        estimatedCredits: metadata?.estimatedCredits || 0,
        createdAt: analysis.analysisDate,
        webhookUrl: metadata?.webhookUrl,
      };
    });
  }
}