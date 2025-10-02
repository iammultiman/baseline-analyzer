#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

interface SecurityCheck {
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

class SecurityAuditor {
  private prisma: PrismaClient;
  private checks: SecurityCheck[] = [];
  private baseUrl: string;

  constructor() {
    this.prisma = new PrismaClient();
    this.baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  }

  private addCheck(check: SecurityCheck): void {
    this.checks.push(check);
    const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} [${check.category}] ${check.name}: ${check.message}`);
  }

  async auditEnvironmentSecurity(): Promise<void> {
    console.log('\n🔒 Environment Security Audit');
    console.log('==============================');

    // Check for required security environment variables
    const requiredSecurityVars = [
      'NEXTAUTH_SECRET',
      'DATABASE_URL',
      'ALLOWED_ORIGINS',
      'RATE_LIMIT_WINDOW_MS',
      'RATE_LIMIT_MAX_REQUESTS'
    ];

    for (const varName of requiredSecurityVars) {
      const value = process.env[varName];
      if (!value) {
        this.addCheck({
          name: `Environment Variable: ${varName}`,
          category: 'Environment',
          status: 'fail',
          message: 'Required security environment variable is missing'
        });
      } else {
        this.addCheck({
          name: `Environment Variable: ${varName}`,
          category: 'Environment',
          status: 'pass',
          message: 'Security environment variable is configured'
        });
      }
    }

    // Check JWT secret strength
    const jwtSecret = process.env.NEXTAUTH_SECRET;
    if (jwtSecret) {
      if (jwtSecret.length < 32) {
        this.addCheck({
          name: 'JWT Secret Strength',
          category: 'Environment',
          status: 'fail',
          message: 'JWT secret is too short (< 32 characters)'
        });
      } else if (jwtSecret.length < 64) {
        this.addCheck({
          name: 'JWT Secret Strength',
          category: 'Environment',
          status: 'warning',
          message: 'JWT secret could be longer for better security'
        });
      } else {
        this.addCheck({
          name: 'JWT Secret Strength',
          category: 'Environment',
          status: 'pass',
          message: 'JWT secret has adequate length'
        });
      }
    }

    // Check database URL security
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      if (databaseUrl.includes('sslmode=require') || databaseUrl.includes('ssl=true')) {
        this.addCheck({
          name: 'Database SSL',
          category: 'Environment',
          status: 'pass',
          message: 'Database connection uses SSL'
        });
      } else {
        this.addCheck({
          name: 'Database SSL',
          category: 'Environment',
          status: 'warning',
          message: 'Database connection may not use SSL'
        });
      }
    }
  }

  async auditAPIEndpoints(): Promise<void> {
    console.log('\n🌐 API Endpoint Security Audit');
    console.log('===============================');

    // Test authentication on protected endpoints
    const protectedEndpoints = [
      '/api/analysis',
      '/api/credits',
      '/api/organizations',
      '/api/admin/pricing'
    ];

    for (const endpoint of protectedEndpoints) {
      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`);
        if ([401, 403].includes(response.status)) {
          this.addCheck({
            name: `Authentication: ${endpoint}`,
            category: 'API Security',
            status: 'pass',
            message: 'Endpoint properly requires authentication'
          });
        } else {
          this.addCheck({
            name: `Authentication: ${endpoint}`,
            category: 'API Security',
            status: 'fail',
            message: `Endpoint allows unauthenticated access (status: ${response.status})`
          });
        }
      } catch (error) {
        this.addCheck({
          name: `Authentication: ${endpoint}`,
          category: 'API Security',
          status: 'warning',
          message: `Could not test endpoint: ${error}`
        });
      }
    }

    // Test CORS headers
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'OPTIONS'
      });

      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      if (corsOrigin === '*') {
        this.addCheck({
          name: 'CORS Policy',
          category: 'API Security',
          status: 'fail',
          message: 'CORS allows all origins (*) - security risk'
        });
      } else if (corsOrigin) {
        this.addCheck({
          name: 'CORS Policy',
          category: 'API Security',
          status: 'pass',
          message: 'CORS has restrictive origin policy'
        });
      } else {
        this.addCheck({
          name: 'CORS Policy',
          category: 'API Security',
          status: 'warning',
          message: 'CORS headers not found'
        });
      }
    } catch (error) {
      this.addCheck({
        name: 'CORS Policy',
        category: 'API Security',
        status: 'warning',
        message: `Could not test CORS: ${error}`
      });
    }

    // Test security headers
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      
      const securityHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
        'Strict-Transport-Security',
        'Content-Security-Policy'
      ];

      for (const header of securityHeaders) {
        const value = response.headers.get(header);
        if (value) {
          this.addCheck({
            name: `Security Header: ${header}`,
            category: 'API Security',
            status: 'pass',
            message: `Header is configured: ${value}`
          });
        } else {
          const severity = header === 'Strict-Transport-Security' && !this.baseUrl.startsWith('https://') 
            ? 'warning' : 'fail';
          this.addCheck({
            name: `Security Header: ${header}`,
            category: 'API Security',
            status: severity,
            message: 'Security header is missing'
          });
        }
      }
    } catch (error) {
      this.addCheck({
        name: 'Security Headers',
        category: 'API Security',
        status: 'warning',
        message: `Could not test security headers: ${error}`
      });
    }
  }

  async auditRateLimiting(): Promise<void> {
    console.log('\n🚦 Rate Limiting Audit');
    console.log('======================');

    // Test rate limiting by making rapid requests
    try {
      const requests = [];
      for (let i = 0; i < 50; i++) {
        requests.push(
          fetch(`${this.baseUrl}/api/health`, {
            headers: {
              'X-Forwarded-For': '192.168.1.100' // Simulate same IP
            }
          })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      if (rateLimitedCount > 0) {
        this.addCheck({
          name: 'Rate Limiting',
          category: 'Rate Limiting',
          status: 'pass',
          message: `Rate limiting active (${rateLimitedCount}/50 requests limited)`
        });

        // Check rate limit headers
        const rateLimitedResponse = responses.find(r => r.status === 429);
        if (rateLimitedResponse) {
          const headers = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'];
          for (const header of headers) {
            const value = rateLimitedResponse.headers.get(header);
            if (value) {
              this.addCheck({
                name: `Rate Limit Header: ${header}`,
                category: 'Rate Limiting',
                status: 'pass',
                message: `Header present: ${value}`
              });
            } else {
              this.addCheck({
                name: `Rate Limit Header: ${header}`,
                category: 'Rate Limiting',
                status: 'warning',
                message: 'Rate limit header missing'
              });
            }
          }
        }
      } else {
        this.addCheck({
          name: 'Rate Limiting',
          category: 'Rate Limiting',
          status: 'fail',
          message: 'Rate limiting not active or threshold too high'
        });
      }
    } catch (error) {
      this.addCheck({
        name: 'Rate Limiting',
        category: 'Rate Limiting',
        status: 'warning',
        message: `Could not test rate limiting: ${error}`
      });
    }
  }

  async auditDatabaseSecurity(): Promise<void> {
    console.log('\n🗄️ Database Security Audit');
    console.log('===========================');

    try {
      // Check database connection
      await this.prisma.$queryRaw`SELECT 1`;
      this.addCheck({
        name: 'Database Connection',
        category: 'Database',
        status: 'pass',
        message: 'Database connection successful'
      });

      // Check for sensitive data exposure in logs
      const auditLogs = await this.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
      });

      let sensitiveDataFound = false;
      const sensitivePatterns = [
        /password/i,
        /api[_-]?key/i,
        /secret/i,
        /token/i,
        /credit[_-]?card/i,
        /ssn/i
      ];

      for (const log of auditLogs) {
        const logString = JSON.stringify(log);
        for (const pattern of sensitivePatterns) {
          if (pattern.test(logString)) {
            sensitiveDataFound = true;
            break;
          }
        }
        if (sensitiveDataFound) break;
      }

      if (sensitiveDataFound) {
        this.addCheck({
          name: 'Sensitive Data in Logs',
          category: 'Database',
          status: 'fail',
          message: 'Audit logs may contain sensitive information'
        });
      } else {
        this.addCheck({
          name: 'Sensitive Data in Logs',
          category: 'Database',
          status: 'pass',
          message: 'No sensitive data found in audit logs'
        });
      }

      // Check for proper indexing on sensitive queries
      const indexQuery = await this.prisma.$queryRaw`
        SELECT schemaname, tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND (tablename = 'users' OR tablename = 'audit_logs')
      `;

      if (Array.isArray(indexQuery) && indexQuery.length > 0) {
        this.addCheck({
          name: 'Database Indexes',
          category: 'Database',
          status: 'pass',
          message: 'Proper indexes found on sensitive tables'
        });
      } else {
        this.addCheck({
          name: 'Database Indexes',
          category: 'Database',
          status: 'warning',
          message: 'Consider adding indexes for better performance and security'
        });
      }

    } catch (error) {
      this.addCheck({
        name: 'Database Security',
        category: 'Database',
        status: 'fail',
        message: `Database security check failed: ${error}`
      });
    }
  }

  async auditInputValidation(): Promise<void> {
    console.log('\n🛡️ Input Validation Audit');
    console.log('==========================');

    // Test SQL injection protection
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --"
    ];

    for (const payload of sqlPayloads) {
      try {
        const response = await fetch(`${this.baseUrl}/api/analysis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN || 'test-token'}`
          },
          body: JSON.stringify({
            repositoryUrl: payload,
            userId: 'test-user',
            organizationId: 'test-org'
          })
        });

        if (response.status === 400 || response.status === 422) {
          this.addCheck({
            name: 'SQL Injection Protection',
            category: 'Input Validation',
            status: 'pass',
            message: 'Malicious SQL input properly rejected'
          });
        } else if (response.ok) {
          const data = await response.json();
          if (!data.repositoryUrl || !data.repositoryUrl.includes('DROP TABLE')) {
            this.addCheck({
              name: 'SQL Injection Protection',
              category: 'Input Validation',
              status: 'pass',
              message: 'SQL input properly sanitized'
            });
          } else {
            this.addCheck({
              name: 'SQL Injection Protection',
              category: 'Input Validation',
              status: 'fail',
              message: 'SQL injection vulnerability detected'
            });
          }
        }
        break; // Only test one payload to avoid spam
      } catch (error) {
        this.addCheck({
          name: 'SQL Injection Protection',
          category: 'Input Validation',
          status: 'warning',
          message: `Could not test SQL injection protection: ${error}`
        });
        break;
      }
    }

    // Test XSS protection
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert("XSS")'
    ];

    for (const payload of xssPayloads) {
      try {
        const response = await fetch(`${this.baseUrl}/api/organizations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN || 'test-token'}`
          },
          body: JSON.stringify({
            name: payload,
            description: 'Test organization'
          })
        });

        if (response.status === 400 || response.status === 422) {
          this.addCheck({
            name: 'XSS Protection',
            category: 'Input Validation',
            status: 'pass',
            message: 'Malicious script input properly rejected'
          });
        } else if (response.ok) {
          const data = await response.json();
          if (!data.name || !data.name.includes('<script>')) {
            this.addCheck({
              name: 'XSS Protection',
              category: 'Input Validation',
              status: 'pass',
              message: 'Script input properly sanitized'
            });
          } else {
            this.addCheck({
              name: 'XSS Protection',
              category: 'Input Validation',
              status: 'fail',
              message: 'XSS vulnerability detected'
            });
          }
        }
        break; // Only test one payload
      } catch (error) {
        this.addCheck({
          name: 'XSS Protection',
          category: 'Input Validation',
          status: 'warning',
          message: `Could not test XSS protection: ${error}`
        });
        break;
      }
    }
  }

  async auditAuditLogging(): Promise<void> {
    console.log('\n📋 Audit Logging Verification');
    console.log('==============================');

    try {
      // Check if audit logging table exists
      const auditLogCount = await this.prisma.auditLog.count();
      
      if (auditLogCount >= 0) {
        this.addCheck({
          name: 'Audit Log Table',
          category: 'Audit Logging',
          status: 'pass',
          message: `Audit logging is configured (${auditLogCount} logs)`
        });
      }

      // Check recent audit logs for required fields
      const recentLogs = await this.prisma.auditLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
      });

      if (recentLogs.length > 0) {
        const requiredFields = ['action', 'resourceType', 'userId', 'ipAddress', 'createdAt'];
        let allFieldsPresent = true;

        for (const log of recentLogs) {
          for (const field of requiredFields) {
            if (!(field in log) || !log[field as keyof typeof log]) {
              allFieldsPresent = false;
              break;
            }
          }
          if (!allFieldsPresent) break;
        }

        if (allFieldsPresent) {
          this.addCheck({
            name: 'Audit Log Structure',
            category: 'Audit Logging',
            status: 'pass',
            message: 'Audit logs contain all required fields'
          });
        } else {
          this.addCheck({
            name: 'Audit Log Structure',
            category: 'Audit Logging',
            status: 'fail',
            message: 'Audit logs missing required fields'
          });
        }
      } else {
        this.addCheck({
          name: 'Audit Log Activity',
          category: 'Audit Logging',
          status: 'warning',
          message: 'No recent audit logs found'
        });
      }

    } catch (error) {
      this.addCheck({
        name: 'Audit Logging',
        category: 'Audit Logging',
        status: 'fail',
        message: `Audit logging verification failed: ${error}`
      });
    }
  }

  generateReport(): void {
    console.log('\n📊 Security Audit Report');
    console.log('=========================');

    const categories = [...new Set(this.checks.map(c => c.category))];
    const summary = {
      total: this.checks.length,
      passed: this.checks.filter(c => c.status === 'pass').length,
      failed: this.checks.filter(c => c.status === 'fail').length,
      warnings: this.checks.filter(c => c.status === 'warning').length
    };

    console.log(`\n📈 Summary:`);
    console.log(`   Total checks: ${summary.total}`);
    console.log(`   ✅ Passed: ${summary.passed}`);
    console.log(`   ❌ Failed: ${summary.failed}`);
    console.log(`   ⚠️  Warnings: ${summary.warnings}`);

    // Category breakdown
    console.log(`\n📋 By Category:`);
    categories.forEach(category => {
      const categoryChecks = this.checks.filter(c => c.category === category);
      const passed = categoryChecks.filter(c => c.status === 'pass').length;
      const failed = categoryChecks.filter(c => c.status === 'fail').length;
      const warnings = categoryChecks.filter(c => c.status === 'warning').length;
      
      console.log(`   ${category}: ${passed}✅ ${failed}❌ ${warnings}⚠️`);
    });

    // Critical failures
    const criticalFailures = this.checks.filter(c => c.status === 'fail');
    if (criticalFailures.length > 0) {
      console.log(`\n🚨 Critical Security Issues:`);
      criticalFailures.forEach(check => {
        console.log(`   ❌ ${check.name}: ${check.message}`);
      });
    }

    // Security score
    const securityScore = Math.round((summary.passed / summary.total) * 100);
    console.log(`\n🎯 Security Score: ${securityScore}%`);

    if (securityScore >= 90) {
      console.log('🟢 Excellent security posture');
    } else if (securityScore >= 75) {
      console.log('🟡 Good security posture with room for improvement');
    } else {
      console.log('🔴 Security posture needs significant improvement');
    }

    // Recommendations
    if (summary.failed > 0 || summary.warnings > 0) {
      console.log(`\n💡 Recommendations:`);
      if (summary.failed > 0) {
        console.log('   - Address all critical security failures before production deployment');
      }
      if (summary.warnings > 0) {
        console.log('   - Review and resolve security warnings');
      }
      console.log('   - Implement regular security audits');
      console.log('   - Consider penetration testing by security professionals');
    }
  }

  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

async function runSecurityAudit() {
  const auditor = new SecurityAuditor();

  try {
    console.log('🔒 Starting Security Audit...\n');

    await auditor.auditEnvironmentSecurity();
    await auditor.auditAPIEndpoints();
    await auditor.auditRateLimiting();
    await auditor.auditDatabaseSecurity();
    await auditor.auditInputValidation();
    await auditor.auditAuditLogging();

    auditor.generateReport();

    // Exit with error if critical failures exist
    const checks = auditor['checks'] as SecurityCheck[];
    const criticalFailures = checks.filter(c => c.status === 'fail').length;

    if (criticalFailures > 0) {
      console.log('\n❌ Security audit failed due to critical issues');
      console.log('Please address all security failures before production deployment');
      process.exit(1);
    } else {
      console.log('\n✅ Security audit completed successfully');
    }

  } catch (error) {
    console.error('❌ Security audit failed:', error);
    process.exit(1);
  } finally {
    await auditor.cleanup();
  }
}

// Run security audit if this script is executed directly
if (require.main === module) {
  runSecurityAudit();
}

export { SecurityAuditor };