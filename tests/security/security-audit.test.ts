import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

describe('Security Audit and Compliance Verification', () => {
  let prisma: PrismaClient;
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Penetration Testing on Endpoints', () => {
    it('should reject requests without authentication', async () => {
      const protectedEndpoints = [
        '/api/analysis',
        '/api/credits',
        '/api/organizations',
        '/api/admin/pricing',
        '/api/reporting/dashboard'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await fetch(`${baseUrl}${endpoint}`);
        expect([401, 403]).toContain(response.status);
      }
    });

    it('should reject requests with invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'Bearer ' + 'a'.repeat(500) // Extremely long token
      ];

      for (const token of invalidTokens) {
        const response = await fetch(`${baseUrl}/api/analysis`, {
          headers: { 'Authorization': token }
        });
        expect([401, 403]).toContain(response.status);
      }
    });

    it('should prevent SQL injection attacks', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
        "' UNION SELECT * FROM users --",
        "'; UPDATE users SET role='admin' WHERE id=1; --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${baseUrl}/api/analysis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
          },
          body: JSON.stringify({
            repositoryUrl: payload,
            userId: payload,
            organizationId: payload
          })
        });

        // Should either reject the request or sanitize the input
        if (response.ok) {
          const data = await response.json();
          expect(data.repositoryUrl).not.toContain('DROP TABLE');
          expect(data.repositoryUrl).not.toContain('INSERT INTO');
          expect(data.repositoryUrl).not.toContain('UPDATE');
        }
      }
    });

    it('should prevent XSS attacks in input fields', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("XSS")',
        '<svg onload="alert(1)">',
        '"><script>alert("XSS")</script>'
      ];

      for (const payload of xssPayloads) {
        const response = await fetch(`${baseUrl}/api/organizations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
          },
          body: JSON.stringify({
            name: payload,
            description: payload
          })
        });

        if (response.ok) {
          const data = await response.json();
          // Should sanitize or escape the input
          expect(data.name).not.toContain('<script>');
          expect(data.name).not.toContain('javascript:');
          expect(data.description).not.toContain('<script>');
        }
      }
    });

    it('should prevent NoSQL injection attacks', async () => {
      const noSqlPayloads = [
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$where": "this.password.length > 0"}',
        '{"$regex": ".*"}',
        '{"$or": [{"password": {"$exists": true}}]}'
      ];

      for (const payload of noSqlPayloads) {
        const response = await fetch(`${baseUrl}/api/analysis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
          },
          body: JSON.stringify({
            repositoryUrl: 'https://github.com/test/repo',
            userId: payload,
            organizationId: 'test-org'
          })
        });

        // Should handle the malformed input gracefully
        expect([400, 422, 500]).not.toContain(response.status);
      }
    });

    it('should prevent directory traversal attacks', async () => {
      const traversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd'
      ];

      for (const payload of traversalPayloads) {
        const response = await fetch(`${baseUrl}/api/analysis/${payload}`, {
          headers: {
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
          }
        });

        // Should not expose system files
        expect(response.status).not.toBe(200);
        if (response.status === 200) {
          const text = await response.text();
          expect(text).not.toContain('root:');
          expect(text).not.toContain('Administrator');
        }
      }
    });

    it('should prevent command injection attacks', async () => {
      const commandInjectionPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '&& rm -rf /',
        '`whoami`',
        '$(id)',
        '; ping -c 1 evil.com'
      ];

      for (const payload of commandInjectionPayloads) {
        const response = await fetch(`${baseUrl}/api/repositories/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
          },
          body: JSON.stringify({
            repositoryUrl: `https://github.com/test/repo${payload}`
          })
        });

        // Should validate and reject malicious URLs
        if (response.ok) {
          const data = await response.json();
          expect(data.valid).toBe(false);
        }
      }
    });
  });

  describe('CORS Policies and Security Headers', () => {
    it('should have proper CORS headers configured', async () => {
      const response = await fetch(`${baseUrl}/api/health`, {
        method: 'OPTIONS'
      });

      const corsHeaders = {
        'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
        'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials')
      };

      // Should have restrictive CORS policy
      expect(corsHeaders['Access-Control-Allow-Origin']).not.toBe('*');
      expect(corsHeaders['Access-Control-Allow-Methods']).toBeDefined();
      expect(corsHeaders['Access-Control-Allow-Headers']).toBeDefined();
    });

    it('should have security headers configured', async () => {
      const response = await fetch(`${baseUrl}/api/health`);

      const securityHeaders = {
        'X-Content-Type-Options': response.headers.get('X-Content-Type-Options'),
        'X-Frame-Options': response.headers.get('X-Frame-Options'),
        'X-XSS-Protection': response.headers.get('X-XSS-Protection'),
        'Strict-Transport-Security': response.headers.get('Strict-Transport-Security'),
        'Content-Security-Policy': response.headers.get('Content-Security-Policy'),
        'Referrer-Policy': response.headers.get('Referrer-Policy')
      };

      expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff');
      expect(securityHeaders['X-Frame-Options']).toMatch(/^(DENY|SAMEORIGIN)$/);
      expect(securityHeaders['X-XSS-Protection']).toBe('1; mode=block');
      
      if (baseUrl.startsWith('https://')) {
        expect(securityHeaders['Strict-Transport-Security']).toContain('max-age=');
      }
    });

    it('should reject requests from unauthorized origins', async () => {
      const unauthorizedOrigins = [
        'https://evil.com',
        'http://malicious-site.com',
        'https://phishing-site.net'
      ];

      for (const origin of unauthorizedOrigins) {
        const response = await fetch(`${baseUrl}/api/analysis`, {
          method: 'POST',
          headers: {
            'Origin': origin,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
          },
          body: JSON.stringify({
            repositoryUrl: 'https://github.com/test/repo',
            userId: 'test-user',
            organizationId: 'test-org'
          })
        });

        // Should either reject the request or not include CORS headers for unauthorized origins
        if (response.status === 200) {
          const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
          expect(corsOrigin).not.toBe(origin);
        }
      }
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should enforce rate limits on API endpoints', async () => {
      const requests = [];
      const maxRequests = 150; // Exceed typical rate limit

      // Make rapid requests to trigger rate limiting
      for (let i = 0; i < maxRequests; i++) {
        requests.push(
          fetch(`${baseUrl}/api/health`, {
            headers: {
              'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`,
              'X-Forwarded-For': '192.168.1.100' // Simulate same IP
            }
          })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      // Should have some rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check rate limit headers
      const rateLimitedResponse = rateLimitedResponses[0];
      expect(rateLimitedResponse.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(rateLimitedResponse.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(rateLimitedResponse.headers.get('Retry-After')).toBeDefined();
    });

    it('should prevent brute force attacks on authentication', async () => {
      const attempts = [];
      const maxAttempts = 20;

      // Simulate brute force login attempts
      for (let i = 0; i < maxAttempts; i++) {
        attempts.push(
          fetch(`${baseUrl}/api/auth/signin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Forwarded-For': '192.168.1.101' // Same IP for brute force
            },
            body: JSON.stringify({
              email: 'victim@example.com',
              password: `wrong-password-${i}`
            })
          })
        );
      }

      const responses = await Promise.all(attempts);
      const blockedResponses = responses.filter(r => r.status === 429 || r.status === 423);

      // Should block after several failed attempts
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    it('should prevent API abuse through request size limits', async () => {
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB payload

      const response = await fetch(`${baseUrl}/api/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
        },
        body: JSON.stringify({
          repositoryUrl: 'https://github.com/test/repo',
          userId: 'test-user',
          organizationId: 'test-org',
          largeData: largePayload
        })
      });

      // Should reject oversized requests
      expect([413, 400]).toContain(response.status);
    });

    it('should prevent concurrent request abuse', async () => {
      const concurrentRequests = 100;
      const requests = [];

      // Make many concurrent requests from same user
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          fetch(`${baseUrl}/api/analysis/estimate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`,
              'X-User-ID': 'abuse-test-user'
            },
            body: JSON.stringify({
              repositoryUrl: `https://github.com/test/repo-${i}`,
              repositorySize: 1000
            })
          })
        );
      }

      const responses = await Promise.all(requests);
      const throttledResponses = responses.filter(r => r.status === 429);

      // Should throttle excessive concurrent requests
      expect(throttledResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Audit Logging Verification', () => {
    it('should log sensitive operations', async () => {
      // Perform sensitive operations
      const operations = [
        {
          endpoint: '/api/organizations',
          method: 'POST',
          body: { name: 'Audit Test Org', description: 'Test organization for audit logging' }
        },
        {
          endpoint: '/api/admin/pricing',
          method: 'PUT',
          body: { creditCost: 10, markupPercentage: 20 }
        },
        {
          endpoint: '/api/credits/purchase',
          method: 'POST',
          body: { packageId: 'basic', amount: 1000 }
        }
      ];

      for (const operation of operations) {
        await fetch(`${baseUrl}${operation.endpoint}`, {
          method: operation.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`,
            'X-User-ID': 'audit-test-user'
          },
          body: JSON.stringify(operation.body)
        });
      }

      // Check if audit logs were created
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          userId: 'audit-test-user',
          createdAt: {
            gte: new Date(Date.now() - 60000) // Last minute
          }
        }
      });

      expect(auditLogs.length).toBeGreaterThan(0);

      // Verify log structure
      auditLogs.forEach(log => {
        expect(log.action).toBeDefined();
        expect(log.resourceType).toBeDefined();
        expect(log.userId).toBe('audit-test-user');
        expect(log.ipAddress).toBeDefined();
        expect(log.userAgent).toBeDefined();
        expect(log.createdAt).toBeDefined();
      });
    });

    it('should log failed authentication attempts', async () => {
      // Attempt failed login
      await fetch(`${baseUrl}/api/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '192.168.1.200'
        },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'wrong-password'
        })
      });

      // Check for security audit log
      const securityLogs = await prisma.auditLog.findMany({
        where: {
          action: 'FAILED_LOGIN',
          createdAt: {
            gte: new Date(Date.now() - 60000)
          }
        }
      });

      expect(securityLogs.length).toBeGreaterThan(0);
      
      const log = securityLogs[0];
      expect(log.details).toContain('nonexistent@example.com');
      expect(log.ipAddress).toBe('192.168.1.200');
    });

    it('should log administrative actions', async () => {
      // Perform admin actions
      const adminActions = [
        { endpoint: '/api/admin/ai-providers', method: 'POST' },
        { endpoint: '/api/admin/system/health', method: 'GET' },
        { endpoint: '/api/admin/usage', method: 'GET' }
      ];

      for (const action of adminActions) {
        await fetch(`${baseUrl}${action.endpoint}`, {
          method: action.method,
          headers: {
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`,
            'X-User-ID': 'admin-audit-user',
            'X-User-Role': 'admin'
          }
        });
      }

      // Check admin audit logs
      const adminLogs = await prisma.auditLog.findMany({
        where: {
          userId: 'admin-audit-user',
          action: { startsWith: 'ADMIN_' },
          createdAt: {
            gte: new Date(Date.now() - 60000)
          }
        }
      });

      expect(adminLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Backup and Disaster Recovery', () => {
    it('should have database backup procedures configured', async () => {
      // Test backup creation
      const backupResponse = await fetch(`${baseUrl}/api/admin/backup/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`,
          'X-User-Role': 'admin'
        }
      });

      expect([200, 202]).toContain(backupResponse.status);

      if (backupResponse.ok) {
        const backupData = await backupResponse.json();
        expect(backupData.backupId).toBeDefined();
        expect(backupData.status).toBeDefined();
      }
    });

    it('should have backup verification procedures', async () => {
      // Test backup listing
      const backupsResponse = await fetch(`${baseUrl}/api/admin/backup/list`, {
        headers: {
          'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`,
          'X-User-Role': 'admin'
        }
      });

      expect(backupsResponse.status).toBe(200);

      const backups = await backupsResponse.json();
      expect(Array.isArray(backups)).toBe(true);

      if (backups.length > 0) {
        const backup = backups[0];
        expect(backup.id).toBeDefined();
        expect(backup.createdAt).toBeDefined();
        expect(backup.size).toBeDefined();
        expect(backup.status).toBeDefined();
      }
    });

    it('should have disaster recovery procedures documented', async () => {
      // Test recovery plan endpoint
      const recoveryResponse = await fetch(`${baseUrl}/api/admin/disaster-recovery/plan`, {
        headers: {
          'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`,
          'X-User-Role': 'admin'
        }
      });

      expect(recoveryResponse.status).toBe(200);

      const recoveryPlan = await recoveryResponse.json();
      expect(recoveryPlan.procedures).toBeDefined();
      expect(recoveryPlan.contacts).toBeDefined();
      expect(recoveryPlan.rto).toBeDefined(); // Recovery Time Objective
      expect(recoveryPlan.rpo).toBeDefined(); // Recovery Point Objective
    });

    it('should test backup restoration procedures', async () => {
      // Test backup restoration (dry run)
      const restoreResponse = await fetch(`${baseUrl}/api/admin/backup/restore/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`,
          'X-User-Role': 'admin'
        },
        body: JSON.stringify({
          backupId: 'test-backup-id',
          dryRun: true
        })
      });

      expect([200, 202]).toContain(restoreResponse.status);

      if (restoreResponse.ok) {
        const restoreData = await restoreResponse.json();
        expect(restoreData.testId).toBeDefined();
        expect(restoreData.status).toBeDefined();
      }
    });
  });

  describe('Data Privacy and Compliance', () => {
    it('should handle data deletion requests (GDPR compliance)', async () => {
      // Test user data deletion
      const deletionResponse = await fetch(`${baseUrl}/api/user/delete-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
        },
        body: JSON.stringify({
          userId: 'gdpr-test-user',
          confirmDeletion: true
        })
      });

      expect([200, 202]).toContain(deletionResponse.status);

      if (deletionResponse.ok) {
        const deletionData = await deletionResponse.json();
        expect(deletionData.requestId).toBeDefined();
        expect(deletionData.status).toBeDefined();
      }
    });

    it('should provide data export functionality (GDPR compliance)', async () => {
      // Test user data export
      const exportResponse = await fetch(`${baseUrl}/api/user/export-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`,
          'X-User-ID': 'export-test-user'
        }
      });

      expect([200, 202]).toContain(exportResponse.status);

      if (exportResponse.ok) {
        const exportData = await exportResponse.json();
        expect(exportData.exportId).toBeDefined();
        expect(exportData.downloadUrl || exportData.status).toBeDefined();
      }
    });

    it('should anonymize sensitive data in logs', async () => {
      // Check that audit logs don't contain sensitive information
      const auditLogs = await prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
      });

      auditLogs.forEach(log => {
        // Should not contain raw passwords, API keys, or other sensitive data
        const logString = JSON.stringify(log);
        expect(logString).not.toMatch(/password.*:/i);
        expect(logString).not.toMatch(/api[_-]?key.*:/i);
        expect(logString).not.toMatch(/secret.*:/i);
        expect(logString).not.toMatch(/token.*:/i);
      });
    });
  });
});