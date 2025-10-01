import { prisma } from '@/lib/database';
import { monitoringService } from './monitoring-service';

export interface AuditEvent {
  userId?: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: Record<string, any>;
  timestamp?: Date;
}

export interface SecurityEvent {
  type: 'authentication_failure' | 'authorization_failure' | 'suspicious_activity' | 'rate_limit_exceeded' | 'data_breach_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  timestamp?: Date;
}

export class AuditService {
  /**
   * Log an audit event for compliance and security monitoring
   */
  async logAuditEvent(event: AuditEvent): Promise<void> {
    try {
      // Store in database for compliance
      await prisma.auditLog.create({
        data: {
          userId: event.userId,
          organizationId: event.organizationId,
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          success: event.success,
          details: event.details || {},
          timestamp: event.timestamp || new Date()
        }
      });

      // Log to structured logging for Cloud Logging
      const auditLog = {
        timestamp: (event.timestamp || new Date()).toISOString(),
        level: 'AUDIT',
        service: 'baseline-analyzer',
        event_type: 'audit_event',
        user_id: event.userId,
        organization_id: event.organizationId,
        action: event.action,
        resource: event.resource,
        resource_id: event.resourceId,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        success: event.success,
        details: event.details
      };

      console.log(JSON.stringify(auditLog));

      // Record custom metric
      await monitoringService.writeCustomMetric({
        name: 'audit_events',
        value: 1,
        labels: {
          action: event.action,
          resource: event.resource,
          success: event.success.toString()
        }
      });

    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging failures shouldn't break the application
    }
  }

  /**
   * Log a security event for threat monitoring
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Store in database for security analysis
      await prisma.securityEvent.create({
        data: {
          type: event.type,
          severity: event.severity,
          userId: event.userId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          details: event.details,
          timestamp: event.timestamp || new Date()
        }
      });

      // Log to structured logging
      const securityLog = {
        timestamp: (event.timestamp || new Date()).toISOString(),
        level: event.severity === 'critical' ? 'CRITICAL' : 
               event.severity === 'high' ? 'ERROR' : 'WARNING',
        service: 'baseline-analyzer',
        event_type: 'security_event',
        security_event_type: event.type,
        severity: event.severity,
        user_id: event.userId,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        details: event.details
      };

      console.log(JSON.stringify(securityLog));

      // Record custom metric
      await monitoringService.writeCustomMetric({
        name: 'security_events',
        value: 1,
        labels: {
          type: event.type,
          severity: event.severity
        }
      });

      // Alert on critical security events
      if (event.severity === 'critical') {
        await this.alertCriticalSecurityEvent(event);
      }

    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Log user authentication events
   */
  async logAuthenticationEvent(
    userId: string,
    success: boolean,
    method: 'email' | 'google' | 'api_key',
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logAuditEvent({
      userId,
      action: success ? 'authentication_success' : 'authentication_failure',
      resource: 'user_session',
      ipAddress,
      userAgent,
      success,
      details: {
        method,
        ...details
      }
    });

    if (!success) {
      await this.logSecurityEvent({
        type: 'authentication_failure',
        severity: 'medium',
        userId,
        ipAddress,
        userAgent,
        details: {
          method,
          ...details
        }
      });
    }
  }

  /**
   * Log authorization events
   */
  async logAuthorizationEvent(
    userId: string,
    resource: string,
    action: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logAuditEvent({
      userId,
      action: success ? 'authorization_granted' : 'authorization_denied',
      resource,
      ipAddress,
      userAgent,
      success,
      details: {
        requested_action: action,
        ...details
      }
    });

    if (!success) {
      await this.logSecurityEvent({
        type: 'authorization_failure',
        severity: 'medium',
        userId,
        ipAddress,
        userAgent,
        details: {
          resource,
          requested_action: action,
          ...details
        }
      });
    }
  }

  /**
   * Log data access events
   */
  async logDataAccessEvent(
    userId: string,
    resource: string,
    resourceId: string,
    action: 'read' | 'create' | 'update' | 'delete',
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logAuditEvent({
      userId,
      action: `data_${action}`,
      resource,
      resourceId,
      ipAddress,
      userAgent,
      success,
      details
    });
  }

  /**
   * Log payment events for compliance
   */
  async logPaymentEvent(
    userId: string,
    organizationId: string,
    action: 'purchase' | 'refund' | 'chargeback',
    amount: number,
    currency: string,
    success: boolean,
    paymentMethod: string,
    transactionId?: string,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logAuditEvent({
      userId,
      organizationId,
      action: `payment_${action}`,
      resource: 'credit_transaction',
      resourceId: transactionId,
      ipAddress,
      userAgent,
      success,
      details: {
        amount,
        currency,
        payment_method: paymentMethod,
        ...details
      }
    });
  }

  /**
   * Log admin configuration changes
   */
  async logAdminConfigChange(
    userId: string,
    configType: string,
    changes: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAuditEvent({
      userId,
      action: 'admin_config_change',
      resource: configType,
      ipAddress,
      userAgent,
      success: true,
      details: {
        changes
      }
    });
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logSecurityEvent({
      type: 'suspicious_activity',
      severity,
      userId,
      ipAddress,
      userAgent,
      details: {
        activity_type: type,
        ...details
      }
    });
  }

  /**
   * Get audit logs for a user or organization
   */
  async getAuditLogs(
    filters: {
      userId?: string;
      organizationId?: string;
      resource?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    },
    limit = 100,
    offset = 0
  ) {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.organizationId) where.organizationId = filters.organizationId;
    if (filters.resource) where.resource = filters.resource;
    if (filters.action) where.action = filters.action;
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    return await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
  }

  /**
   * Get security events for analysis
   */
  async getSecurityEvents(
    filters: {
      type?: string;
      severity?: string;
      userId?: string;
      ipAddress?: string;
      startDate?: Date;
      endDate?: Date;
    },
    limit = 100,
    offset = 0
  ) {
    const where: any = {};

    if (filters.type) where.type = filters.type;
    if (filters.severity) where.severity = filters.severity;
    if (filters.userId) where.userId = filters.userId;
    if (filters.ipAddress) where.ipAddress = filters.ipAddress;
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    return await prisma.securityEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
  }

  /**
   * Alert on critical security events
   */
  private async alertCriticalSecurityEvent(event: SecurityEvent): Promise<void> {
    // This would integrate with your alerting system
    // For now, we'll log it as a critical event
    console.error('CRITICAL SECURITY EVENT:', JSON.stringify(event));
    
    // You could integrate with:
    // - PagerDuty
    // - Slack webhooks
    // - Email alerts
    // - SMS notifications
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ) {
    const auditLogs = await this.getAuditLogs({
      organizationId,
      startDate,
      endDate
    }, 10000); // Get more records for reporting

    const securityEvents = await this.getSecurityEvents({
      startDate,
      endDate
    }, 1000);

    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      organization_id: organizationId,
      audit_summary: {
        total_events: auditLogs.length,
        successful_events: auditLogs.filter(log => log.success).length,
        failed_events: auditLogs.filter(log => !log.success).length,
        actions: this.groupBy(auditLogs, 'action'),
        resources: this.groupBy(auditLogs, 'resource')
      },
      security_summary: {
        total_events: securityEvents.length,
        by_type: this.groupBy(securityEvents, 'type'),
        by_severity: this.groupBy(securityEvents, 'severity'),
        critical_events: securityEvents.filter(event => event.severity === 'critical')
      },
      generated_at: new Date().toISOString()
    };
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((acc, item) => {
      const value = item[key] || 'unknown';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }
}

// Export singleton instance
export const auditService = new AuditService();