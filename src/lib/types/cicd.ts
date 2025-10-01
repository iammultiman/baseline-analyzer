export interface ApiKey {
  id: string;
  organizationId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  createdBy: string;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions?: string[];
  expiresAt?: Date;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  key: string; // Full key returned only once
  keyPrefix: string;
  permissions: string[];
  expiresAt?: Date;
}

export interface Webhook {
  id: string;
  organizationId: string;
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWebhookRequest {
  url: string;
  events?: string[];
  secret?: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRYING';
  attempts: number;
  lastAttempt?: Date;
  nextAttempt?: Date;
  response?: any;
  createdAt: Date;
}

export interface CICDAnalysisRequest {
  repositoryUrl: string;
  branch?: string;
  commitSha?: string;
  webhookUrl?: string;
  metadata?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
}

export interface CICDAnalysisResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  repositoryUrl: string;
  branch?: string;
  commitSha?: string;
  estimatedCredits: number;
  createdAt: Date;
  webhookUrl?: string;
}

export interface MachineReadableAnalysisResult {
  id: string;
  repositoryUrl: string;
  branch?: string;
  commitSha?: string;
  status: 'completed' | 'failed';
  completedAt: Date;
  creditsCost: number;
  summary: {
    complianceScore: number;
    totalIssues: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
    passedChecks: number;
    totalChecks: number;
  };
  issues: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    category: string;
    title: string;
    description: string;
    file?: string;
    line?: number;
    column?: number;
    recommendation: string;
    baselineFeature?: string;
  }>;
  recommendations: Array<{
    id: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
    title: string;
    description: string;
    actionItems: string[];
    estimatedEffort: 'low' | 'medium' | 'high';
  }>;
  baselineCompliance: {
    supportedFeatures: string[];
    unsupportedFeatures: string[];
    partiallySupported: string[];
    recommendations: string[];
  };
  metadata: {
    analysisVersion: string;
    aiProvider: string;
    processingTime: number;
    repositorySize: number;
    fileCount: number;
  };
}

export interface WebhookPayload {
  event: string;
  timestamp: Date;
  organizationId: string;
  analysis: {
    id: string;
    repositoryUrl: string;
    branch?: string;
    commitSha?: string;
    status: 'completed' | 'failed';
    result?: MachineReadableAnalysisResult;
    error?: {
      code: string;
      message: string;
      details?: any;
    };
  };
}

export const WEBHOOK_EVENTS = {
  ANALYSIS_STARTED: 'analysis.started',
  ANALYSIS_COMPLETED: 'analysis.completed',
  ANALYSIS_FAILED: 'analysis.failed',
  ANALYSIS_CANCELLED: 'analysis.cancelled',
} as const;

export const API_PERMISSIONS = {
  ANALYSIS_READ: 'analysis:read',
  ANALYSIS_WRITE: 'analysis:write',
  WEBHOOK_READ: 'webhook:read',
  WEBHOOK_WRITE: 'webhook:write',
  APIKEY_READ: 'apikey:read',
  APIKEY_WRITE: 'apikey:write',
} as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS];
export type ApiPermission = typeof API_PERMISSIONS[keyof typeof API_PERMISSIONS];