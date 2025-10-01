import { PrismaClient } from '@prisma/client';

export interface AuditEvent {
  userId?: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface AuditQuery {
  userId?: string;
  organizationId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
}

class AuditLogger {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async log(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: event.userId,
          organizationId: event.organizationId,
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId,
          details: event.details || {},
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          success: event.success,
          errorMessage: event.errorMessage,
          metadata: event.metadata || {},
          timestamp: new Date(),
        },
      });

      // Also log to Cloud Logging for production monitoring
      if (process.env.NODE_ENV === 'production') {
        console.log('AUDIT_LOG', JSON.stringify({
          ...event,
          timestamp: new Date().toISOString(),
        }));
      }
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw - audit logging should not break the main flow
    }
  }

  async query(params: AuditQuery): Promise<any[]> {
    const where: any = {};

    if (params.userId) where.userId = params.userId;
    if (params.organizationId) where.organizationId = params.organizationId;
    if (params.action) where.action = params.action;
    if (params.resource) where.resource = params.resource;
    if (params.success !== undefined) where.success = params.success;
    
    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) where.timestamp.gte = params.startDate;
      if (params.endDate) where.timestamp.lte = params.endDate;
    }

    return await this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: params.limit || 100,
      skip: params.offset || 0,
    });
  }

  // Convenience methods for common audit events
  async logAuthentication(userId: string, success: boolean, ipAddress?: string, userAgent?: string, errorMessage?: string): Promise<void> {
    await this.log({
      userId,
      action: 'AUTHENTICATE',
      resource: 'USER',
      resourceId: userId,
      success,
      ipAddress,
      userAgent,
      errorMessage,
    });
  }

  async logRepositoryAnalysis(userId: string, organizationId: string, repositoryUrl: string, success: boolean, details?: Record<string, any>, errorMessage?: string): Promise<void> {
    await this.log({
      userId,
      organizationId,
      action: 'ANALYZE_REPOSITORY',
      resource: 'REPOSITORY',
      resourceId: repositoryUrl,
      details: { repositoryUrl, ...details },
      success,
      errorMessage,
    });
  }

  async logCreditTransaction(userId: string, organizationId: string, action: 'PURCHASE' | 'DEDUCT' | 'REFUND', amount: number, success: boolean, details?: Record<string, any>): Promise<void> {
    await this.log({
      userId,
      organizationId,
      action: `CREDIT_${action}`,
      resource: 'CREDITS',
      details: { amount, ...details },
      success,
    });
  }

  async logOrganizationChange(userId: string, organizationId: string, action: 'CREATE' | 'UPDATE' | 'DELETE' | 'INVITE' | 'REMOVE_MEMBER', details?: Record<string, any>): Promise<void> {
    await this.log({
      userId,
      organizationId,
      action: `ORGANIZATION_${action}`,
      resource: 'ORGANIZATION',
      resourceId: organizationId,
      details,
      success: true,
    });
  }

  async logAdminAction(userId: string, action: string, resource: string, resourceId?: string, details?: Record<string, any>): Promise<void> {
    await this.log({
      userId,
      action: `ADMIN_${action}`,
      resource,
      resourceId,
      details,
      success: true,
      metadata: { adminAction: true },
    });
  }

  async logAPIKeyUsage(apiKeyId: string, organizationId: string, endpoint: string, success: boolean, ipAddress?: string): Promise<void> {
    await this.log({
      organizationId,
      action: 'API_KEY_USAGE',
      resource: 'API_KEY',
      resourceId: apiKeyId,
      details: { endpoint },
      success,
      ipAddress,
    });
  }

  async logSecurityEvent(event: 'RATE_LIMIT_EXCEEDED' | 'SUSPICIOUS_ACTIVITY' | 'UNAUTHORIZED_ACCESS', details: Record<string, any>, ipAddress?: string): Promise<void> {
    await this.log({
      action: `SECURITY_${event}`,
      resource: 'SECURITY',
      details,
      success: false,
      ipAddress,
      metadata: { securityEvent: true },
    });
  }
}

// Singleton instance
let auditLogger: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (!auditLogger) {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    auditLogger = new AuditLogger(prisma);
  }
  return auditLogger;
}

// Middleware helper for automatic audit logging
export function createAuditMiddleware() {
  const logger = getAuditLogger();

  return function auditMiddleware(
    action: string,
    resource: string,
    extractDetails?: (req: any, res: any) => Record<string, any>
  ) {
    return async function(req: any, res: any, next: any) {
      const startTime = Date.now();
      let success = true;
      let errorMessage: string | undefined;

      // Override res.json to capture response
      const originalJson = res.json;
      res.json = function(data: any) {
        if (res.statusCode >= 400) {
          success = false;
          errorMessage = data?.error || data?.message || 'Unknown error';
        }
        return originalJson.call(this, data);
      };

      // Override res.status to capture error status
      const originalStatus = res.status;
      res.status = function(code: number) {
        if (code >= 400) {
          success = false;
        }
        return originalStatus.call(this, code);
      };

      try {
        await next();
      } catch (error: any) {
        success = false;
        errorMessage = error.message;
        throw error;
      } finally {
        // Log the audit event
        const details = extractDetails ? extractDetails(req, res) : {};
        const processingTime = Date.now() - startTime;

        await logger.log({
          userId: req.user?.id,
          organizationId: req.organization?.id,
          action,
          resource,
          resourceId: req.params?.id,
          details: { ...details, processingTime },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          success,
          errorMessage,
        });
      }
    };
  };
}