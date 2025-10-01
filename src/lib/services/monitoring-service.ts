import { Monitoring } from '@google-cloud/monitoring';

interface CustomMetric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: Date;
}

interface BusinessMetrics {
  analysesCompleted: number;
  analysesInProgress: number;
  activeUsers: number;
  creditTransactions: number;
  errorRate: number;
  averageAnalysisTime: number;
}

export class MonitoringService {
  private monitoring: Monitoring;
  private projectId: string;
  private serviceName: string;

  constructor() {
    this.monitoring = new Monitoring();
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || '';
    this.serviceName = 'baseline-analyzer';
  }

  /**
   * Write a custom metric to Cloud Monitoring
   */
  async writeCustomMetric(metric: CustomMetric): Promise<void> {
    if (!this.projectId || process.env.NODE_ENV !== 'production') {
      // Skip in development or if project not configured
      console.log('Skipping metric write in development:', metric);
      return;
    }

    try {
      const request = {
        name: `projects/${this.projectId}`,
        timeSeries: [
          {
            metric: {
              type: `custom.googleapis.com/${this.serviceName}/${metric.name}`,
              labels: metric.labels || {}
            },
            resource: {
              type: 'global',
              labels: {
                project_id: this.projectId
              }
            },
            points: [
              {
                interval: {
                  endTime: {
                    seconds: Math.floor((metric.timestamp || new Date()).getTime() / 1000)
                  }
                },
                value: {
                  doubleValue: metric.value
                }
              }
            ]
          }
        ]
      };

      await this.monitoring.createTimeSeries(request);
    } catch (error) {
      console.error('Failed to write custom metric:', error);
      // Don't throw - monitoring failures shouldn't break the application
    }
  }

  /**
   * Write multiple custom metrics in batch
   */
  async writeCustomMetrics(metrics: CustomMetric[]): Promise<void> {
    if (!this.projectId || process.env.NODE_ENV !== 'production') {
      console.log('Skipping metrics write in development:', metrics.length, 'metrics');
      return;
    }

    try {
      const timeSeries = metrics.map(metric => ({
        metric: {
          type: `custom.googleapis.com/${this.serviceName}/${metric.name}`,
          labels: metric.labels || {}
        },
        resource: {
          type: 'global',
          labels: {
            project_id: this.projectId
          }
        },
        points: [
          {
            interval: {
              endTime: {
                seconds: Math.floor((metric.timestamp || new Date()).getTime() / 1000)
              }
            },
            value: {
              doubleValue: metric.value
            }
          }
        ]
      }));

      const request = {
        name: `projects/${this.projectId}`,
        timeSeries
      };

      await this.monitoring.createTimeSeries(request);
    } catch (error) {
      console.error('Failed to write custom metrics:', error);
    }
  }

  /**
   * Record business metrics for monitoring
   */
  async recordBusinessMetrics(metrics: BusinessMetrics): Promise<void> {
    const customMetrics: CustomMetric[] = [
      {
        name: 'analyses_completed',
        value: metrics.analysesCompleted,
        labels: { type: 'business' }
      },
      {
        name: 'analyses_in_progress',
        value: metrics.analysesInProgress,
        labels: { type: 'business' }
      },
      {
        name: 'active_users',
        value: metrics.activeUsers,
        labels: { type: 'business' }
      },
      {
        name: 'credit_transactions',
        value: metrics.creditTransactions,
        labels: { type: 'business' }
      },
      {
        name: 'error_rate',
        value: metrics.errorRate,
        labels: { type: 'performance' }
      },
      {
        name: 'average_analysis_time_ms',
        value: metrics.averageAnalysisTime,
        labels: { type: 'performance' }
      }
    ];

    await this.writeCustomMetrics(customMetrics);
  }

  /**
   * Record analysis completion event
   */
  async recordAnalysisCompleted(
    analysisId: string,
    duration: number,
    success: boolean,
    aiProvider: string
  ): Promise<void> {
    const metrics: CustomMetric[] = [
      {
        name: 'analysis_duration_ms',
        value: duration,
        labels: {
          success: success.toString(),
          ai_provider: aiProvider,
          analysis_id: analysisId
        }
      },
      {
        name: 'analysis_count',
        value: 1,
        labels: {
          success: success.toString(),
          ai_provider: aiProvider
        }
      }
    ];

    await this.writeCustomMetrics(metrics);
  }

  /**
   * Record credit transaction event
   */
  async recordCreditTransaction(
    userId: string,
    amount: number,
    type: 'purchase' | 'deduction' | 'refund',
    success: boolean
  ): Promise<void> {
    const metrics: CustomMetric[] = [
      {
        name: 'credit_transaction_amount',
        value: amount,
        labels: {
          type,
          success: success.toString(),
          user_id: userId
        }
      },
      {
        name: 'credit_transaction_count',
        value: 1,
        labels: {
          type,
          success: success.toString()
        }
      }
    ];

    await this.writeCustomMetrics(metrics);
  }

  /**
   * Record AI provider API call metrics
   */
  async recordAIProviderCall(
    provider: string,
    success: boolean,
    responseTime: number,
    tokensUsed?: number
  ): Promise<void> {
    const metrics: CustomMetric[] = [
      {
        name: 'ai_provider_response_time_ms',
        value: responseTime,
        labels: {
          provider,
          success: success.toString()
        }
      },
      {
        name: 'ai_provider_call_count',
        value: 1,
        labels: {
          provider,
          success: success.toString()
        }
      }
    ];

    if (tokensUsed !== undefined) {
      metrics.push({
        name: 'ai_provider_tokens_used',
        value: tokensUsed,
        labels: {
          provider,
          success: success.toString()
        }
      });
    }

    await this.writeCustomMetrics(metrics);
  }

  /**
   * Record database operation metrics
   */
  async recordDatabaseOperation(
    operation: string,
    success: boolean,
    duration: number,
    table?: string
  ): Promise<void> {
    const metrics: CustomMetric[] = [
      {
        name: 'database_operation_duration_ms',
        value: duration,
        labels: {
          operation,
          success: success.toString(),
          table: table || 'unknown'
        }
      },
      {
        name: 'database_operation_count',
        value: 1,
        labels: {
          operation,
          success: success.toString(),
          table: table || 'unknown'
        }
      }
    ];

    await this.writeCustomMetrics(metrics);
  }

  /**
   * Record system resource usage
   */
  async recordSystemMetrics(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics: CustomMetric[] = [
      {
        name: 'memory_heap_used_bytes',
        value: memoryUsage.heapUsed,
        labels: { type: 'system' }
      },
      {
        name: 'memory_heap_total_bytes',
        value: memoryUsage.heapTotal,
        labels: { type: 'system' }
      },
      {
        name: 'memory_external_bytes',
        value: memoryUsage.external,
        labels: { type: 'system' }
      },
      {
        name: 'cpu_user_microseconds',
        value: cpuUsage.user,
        labels: { type: 'system' }
      },
      {
        name: 'cpu_system_microseconds',
        value: cpuUsage.system,
        labels: { type: 'system' }
      },
      {
        name: 'uptime_seconds',
        value: process.uptime(),
        labels: { type: 'system' }
      }
    ];

    await this.writeCustomMetrics(metrics);
  }

  /**
   * Log structured error for monitoring
   */
  logError(error: Error, context: Record<string, any> = {}): void {
    const errorLog = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: error.message,
      stack: error.stack,
      service: this.serviceName,
      ...context
    };

    console.error(JSON.stringify(errorLog));
  }

  /**
   * Log structured info for monitoring
   */
  logInfo(message: string, context: Record<string, any> = {}): void {
    const infoLog = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      service: this.serviceName,
      ...context
    };

    console.log(JSON.stringify(infoLog));
  }

  /**
   * Log structured warning for monitoring
   */
  logWarning(message: string, context: Record<string, any> = {}): void {
    const warningLog = {
      timestamp: new Date().toISOString(),
      level: 'WARNING',
      message,
      service: this.serviceName,
      ...context
    };

    console.warn(JSON.stringify(warningLog));
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();