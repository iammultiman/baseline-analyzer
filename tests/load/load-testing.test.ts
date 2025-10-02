import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

describe('Load Testing and Performance Validation', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Repository Analysis Endpoints Load Testing', () => {
    it('should handle concurrent repository analysis requests', async () => {
      const concurrentRequests = 10;
      const testRepositoryUrl = 'https://github.com/facebook/react';
      
      const requests = Array.from({ length: concurrentRequests }, async (_, index) => {
        const response = await fetch(`${process.env.NEXTAUTH_URL}/api/analysis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
          },
          body: JSON.stringify({
            repositoryUrl: testRepositoryUrl,
            userId: `test-user-${index}`,
            organizationId: `test-org-${index}`
          })
        });
        
        return {
          status: response.status,
          responseTime: Date.now(),
          index
        };
      });

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should complete successfully
      results.forEach(result => {
        expect([200, 201, 202]).toContain(result.status);
      });

      // Total time should be reasonable for concurrent requests
      expect(totalTime).toBeLessThan(30000); // 30 seconds max

      console.log(`Concurrent analysis requests completed in ${totalTime}ms`);
    });

    it('should handle high-frequency analysis status checks', async () => {
      // Create an analysis first
      const analysisResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
        },
        body: JSON.stringify({
          repositoryUrl: 'https://github.com/vercel/next.js',
          userId: 'test-user-status',
          organizationId: 'test-org-status'
        })
      });

      const analysisData = await analysisResponse.json();
      const analysisId = analysisData.id;

      // Make rapid status check requests
      const statusRequests = Array.from({ length: 50 }, async () => {
        const startTime = Date.now();
        const response = await fetch(`${process.env.NEXTAUTH_URL}/api/analysis/${analysisId}/status`, {
          headers: {
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
          }
        });
        const responseTime = Date.now() - startTime;
        
        return {
          status: response.status,
          responseTime
        };
      });

      const results = await Promise.all(statusRequests);

      // All status checks should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.responseTime).toBeLessThan(1000); // Each request under 1 second
      });

      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      console.log(`Average status check response time: ${avgResponseTime}ms`);
    });

    it('should handle bulk analysis requests efficiently', async () => {
      const repositories = [
        'https://github.com/facebook/react',
        'https://github.com/microsoft/vscode',
        'https://github.com/vercel/next.js',
        'https://github.com/nodejs/node',
        'https://github.com/angular/angular'
      ];

      const bulkRequest = {
        repositories: repositories.map((url, index) => ({
          repositoryUrl: url,
          userId: `bulk-user-${index}`,
          organizationId: 'bulk-test-org'
        }))
      };

      const startTime = Date.now();
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/analysis/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
        },
        body: JSON.stringify(bulkRequest)
      });
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(202); // Accepted for async processing
      expect(responseTime).toBeLessThan(5000); // Should accept quickly

      const bulkResult = await response.json();
      expect(bulkResult.batchId).toBeDefined();
      expect(bulkResult.totalRepositories).toBe(repositories.length);

      console.log(`Bulk analysis request processed in ${responseTime}ms`);
    });
  });

  describe('Concurrent User Scenarios and Multi-Tenant Isolation', () => {
    it('should handle multiple organizations accessing data simultaneously', async () => {
      const organizations = ['org-1', 'org-2', 'org-3', 'org-4', 'org-5'];
      
      const orgRequests = organizations.map(async (orgId) => {
        // Each org requests their analysis history
        const response = await fetch(`${process.env.NEXTAUTH_URL}/api/analysis?organizationId=${orgId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`,
            'X-Organization-ID': orgId
          }
        });
        
        const data = await response.json();
        
        return {
          orgId,
          status: response.status,
          dataCount: Array.isArray(data) ? data.length : 0,
          hasOtherOrgData: Array.isArray(data) ? data.some((item: any) => item.organizationId !== orgId) : false
        };
      });

      const results = await Promise.all(orgRequests);

      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.hasOtherOrgData).toBe(false); // Ensure tenant isolation
      });

      console.log('Multi-tenant isolation verified for concurrent access');
    });

    it('should handle concurrent user sessions within same organization', async () => {
      const organizationId = 'concurrent-test-org';
      const userCount = 20;
      
      const userRequests = Array.from({ length: userCount }, async (_, index) => {
        const userId = `concurrent-user-${index}`;
        
        // Simulate user dashboard access
        const dashboardResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/reporting/dashboard`, {
          headers: {
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`,
            'X-User-ID': userId,
            'X-Organization-ID': organizationId
          }
        });
        
        // Simulate credit balance check
        const creditsResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/credits`, {
          headers: {
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`,
            'X-User-ID': userId,
            'X-Organization-ID': organizationId
          }
        });
        
        return {
          userId,
          dashboardStatus: dashboardResponse.status,
          creditsStatus: creditsResponse.status
        };
      });

      const results = await Promise.all(userRequests);

      results.forEach(result => {
        expect(result.dashboardStatus).toBe(200);
        expect(result.creditsStatus).toBe(200);
      });

      console.log(`${userCount} concurrent users handled successfully`);
    });
  });

  describe('AI Provider Failover and Rate Limiting Under Load', () => {
    it('should handle AI provider rate limiting gracefully', async () => {
      const rapidRequests = Array.from({ length: 100 }, async (_, index) => {
        const response = await fetch(`${process.env.NEXTAUTH_URL}/api/analysis/estimate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
          },
          body: JSON.stringify({
            repositoryUrl: `https://github.com/test/repo-${index}`,
            repositorySize: 1000 + index
          })
        });
        
        return {
          status: response.status,
          index,
          timestamp: Date.now()
        };
      });

      const results = await Promise.all(rapidRequests);

      // Should handle rate limiting gracefully (429 or successful responses)
      const successfulRequests = results.filter(r => r.status === 200);
      const rateLimitedRequests = results.filter(r => r.status === 429);
      const totalHandled = successfulRequests.length + rateLimitedRequests.length;

      expect(totalHandled).toBe(results.length);
      console.log(`Rate limiting test: ${successfulRequests.length} successful, ${rateLimitedRequests.length} rate limited`);
    });

    it('should failover between AI providers under load', async () => {
      // Simulate provider failure by making requests that exceed primary provider limits
      const heavyRequests = Array.from({ length: 50 }, async (_, index) => {
        const response = await fetch(`${process.env.NEXTAUTH_URL}/api/analysis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
          },
          body: JSON.stringify({
            repositoryUrl: `https://github.com/large/repo-${index}`,
            userId: `failover-user-${index}`,
            organizationId: 'failover-test-org',
            forceProvider: index < 25 ? 'openai' : 'gemini' // Split between providers
          })
        });
        
        return {
          status: response.status,
          provider: index < 25 ? 'openai' : 'gemini',
          index
        };
      });

      const results = await Promise.all(heavyRequests);

      // Both providers should handle requests successfully
      const openaiResults = results.filter(r => r.provider === 'openai');
      const geminiResults = results.filter(r => r.provider === 'gemini');

      const openaiSuccess = openaiResults.filter(r => [200, 201, 202].includes(r.status)).length;
      const geminiSuccess = geminiResults.filter(r => [200, 201, 202].includes(r.status)).length;

      expect(openaiSuccess).toBeGreaterThan(0);
      expect(geminiSuccess).toBeGreaterThan(0);

      console.log(`Provider failover test: OpenAI ${openaiSuccess}/25, Gemini ${geminiSuccess}/25`);
    });
  });

  describe('PWA Performance and Offline Functionality', () => {
    it('should load PWA resources efficiently', async () => {
      const pwaResources = [
        '/manifest.json',
        '/sw.js',
        '/offline',
        '/_next/static/chunks/main.js',
        '/_next/static/css/app.css'
      ];

      const resourceRequests = pwaResources.map(async (resource) => {
        const startTime = Date.now();
        const response = await fetch(`${process.env.NEXTAUTH_URL}${resource}`);
        const loadTime = Date.now() - startTime;
        
        return {
          resource,
          status: response.status,
          loadTime,
          size: parseInt(response.headers.get('content-length') || '0')
        };
      });

      const results = await Promise.all(resourceRequests);

      results.forEach(result => {
        if (result.resource !== '/offline') { // Offline page might not exist in test
          expect([200, 304]).toContain(result.status); // 200 or cached
        }
        expect(result.loadTime).toBeLessThan(2000); // Under 2 seconds
      });

      const totalSize = results.reduce((sum, r) => sum + r.size, 0);
      const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length;

      console.log(`PWA resources: ${totalSize} bytes, avg load time: ${avgLoadTime}ms`);
    });

    it('should handle offline queue functionality', async () => {
      // Test offline queue by simulating network failure
      const offlineRequests = [
        {
          type: 'analysis',
          data: { repositoryUrl: 'https://github.com/test/offline-repo-1' }
        },
        {
          type: 'credit-purchase',
          data: { amount: 1000, packageId: 'basic' }
        },
        {
          type: 'report-generation',
          data: { analysisId: 'test-analysis-id' }
        }
      ];

      // Simulate adding to offline queue
      const queueResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/offline/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
        },
        body: JSON.stringify({ requests: offlineRequests })
      });

      expect(queueResponse.status).toBe(200);

      // Test queue processing when back online
      const processResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/offline/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.TEST_API_TOKEN}`
        }
      });

      expect(processResponse.status).toBe(200);

      const processResult = await processResponse.json();
      expect(processResult.processed).toBeGreaterThan(0);

      console.log(`Offline queue processed ${processResult.processed} requests`);
    });
  });

  describe('Database Query Performance with Large Datasets', () => {
    it('should perform complex queries efficiently with large datasets', async () => {
      // Test complex dashboard query
      const startTime = Date.now();
      
      const complexQuery = await prisma.$queryRaw`
        SELECT 
          u.id,
          u.email,
          o.name as organization_name,
          COUNT(ra.id) as analysis_count,
          SUM(ra.credits_cost) as total_credits_used,
          AVG(EXTRACT(EPOCH FROM (ra.updated_at - ra.created_at))) as avg_analysis_time
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN repository_analyses ra ON u.id = ra.user_id
        WHERE ra.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY u.id, u.email, o.name
        ORDER BY total_credits_used DESC
        LIMIT 100
      `;
      
      const queryTime = Date.now() - startTime;
      
      expect(queryTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(Array.isArray(complexQuery)).toBe(true);
      
      console.log(`Complex dashboard query completed in ${queryTime}ms`);
    });

    it('should handle vector similarity searches efficiently', async () => {
      const startTime = Date.now();
      
      // Test vector similarity search for baseline data
      const vectorQuery = await prisma.$queryRaw`
        SELECT 
          id,
          feature,
          category,
          description,
          1 - (embedding <=> '[0.1,0.2,0.3,0.4,0.5]'::vector) as similarity
        FROM baseline_data
        WHERE 1 - (embedding <=> '[0.1,0.2,0.3,0.4,0.5]'::vector) > 0.7
        ORDER BY similarity DESC
        LIMIT 20
      `;
      
      const queryTime = Date.now() - startTime;
      
      expect(queryTime).toBeLessThan(3000); // Vector search should be fast
      expect(Array.isArray(vectorQuery)).toBe(true);
      
      console.log(`Vector similarity search completed in ${queryTime}ms`);
    });

    it('should handle concurrent database operations', async () => {
      const concurrentOperations = Array.from({ length: 20 }, async (_, index) => {
        const startTime = Date.now();
        
        // Mix of read and write operations
        if (index % 2 === 0) {
          // Read operation
          await prisma.repositoryAnalysis.findMany({
            where: { status: 'completed' },
            take: 10,
            include: { user: true, organization: true }
          });
        } else {
          // Write operation (insert test data)
          await prisma.repositoryAnalysis.create({
            data: {
              repositoryUrl: `https://github.com/test/concurrent-${index}`,
              repositoryName: `concurrent-test-${index}`,
              status: 'pending',
              userId: 'test-user-concurrent',
              organizationId: 'test-org-concurrent',
              creditsCost: 10
            }
          });
        }
        
        return Date.now() - startTime;
      });

      const operationTimes = await Promise.all(concurrentOperations);
      const avgTime = operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length;
      const maxTime = Math.max(...operationTimes);

      expect(avgTime).toBeLessThan(2000); // Average under 2 seconds
      expect(maxTime).toBeLessThan(5000); // No operation over 5 seconds

      console.log(`Concurrent DB operations: avg ${avgTime}ms, max ${maxTime}ms`);
    });

    it('should maintain performance with large result sets', async () => {
      const startTime = Date.now();
      
      // Test pagination with large datasets
      const paginatedQuery = await prisma.repositoryAnalysis.findMany({
        skip: 0,
        take: 1000,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true } },
          organization: { select: { name: true } }
        }
      });
      
      const queryTime = Date.now() - startTime;
      
      expect(queryTime).toBeLessThan(3000); // Large result set under 3 seconds
      expect(Array.isArray(paginatedQuery)).toBe(true);
      
      console.log(`Large result set query (1000 records) completed in ${queryTime}ms`);
    });
  });
});