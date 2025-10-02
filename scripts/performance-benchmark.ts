#!/usr/bin/env tsx

import { performance } from 'perf_hooks';
import { PrismaClient } from '@prisma/client';

interface BenchmarkResult {
  name: string;
  duration: number;
  success: boolean;
  details?: any;
}

class PerformanceBenchmark {
  private prisma: PrismaClient;
  private results: BenchmarkResult[] = [];

  constructor() {
    this.prisma = new PrismaClient();
  }

  async runBenchmark(name: string, fn: () => Promise<any>): Promise<BenchmarkResult> {
    console.log(`🔍 Running benchmark: ${name}`);
    
    const startTime = performance.now();
    let success = true;
    let details = null;
    
    try {
      details = await fn();
    } catch (error) {
      success = false;
      details = error;
      console.error(`❌ Benchmark failed: ${name}`, error);
    }
    
    const duration = performance.now() - startTime;
    const result: BenchmarkResult = { name, duration, success, details };
    
    this.results.push(result);
    
    if (success) {
      console.log(`✅ ${name}: ${duration.toFixed(2)}ms`);
    }
    
    return result;
  }

  async benchmarkDatabaseOperations() {
    console.log('\n📊 Database Performance Benchmarks');
    console.log('=====================================');

    // Simple query benchmark
    await this.runBenchmark('Simple User Query', async () => {
      return await this.prisma.user.findMany({ take: 10 });
    });

    // Complex join query benchmark
    await this.runBenchmark('Complex Join Query', async () => {
      return await this.prisma.repositoryAnalysis.findMany({
        take: 50,
        include: {
          user: true,
          organization: true
        },
        orderBy: { createdAt: 'desc' }
      });
    });

    // Vector similarity search benchmark
    await this.runBenchmark('Vector Similarity Search', async () => {
      return await this.prisma.$queryRaw`
        SELECT id, feature, 1 - (embedding <=> '[0.1,0.2,0.3]'::vector) as similarity
        FROM baseline_data
        ORDER BY similarity DESC
        LIMIT 10
      `;
    });

    // Aggregation query benchmark
    await this.runBenchmark('Aggregation Query', async () => {
      return await this.prisma.$queryRaw`
        SELECT 
          o.name,
          COUNT(ra.id) as analysis_count,
          SUM(ra.credits_cost) as total_credits
        FROM organizations o
        LEFT JOIN repository_analyses ra ON o.id = ra.organization_id
        GROUP BY o.id, o.name
        ORDER BY total_credits DESC
      `;
    });

    // Concurrent operations benchmark
    await this.runBenchmark('Concurrent Database Operations', async () => {
      const operations = Array.from({ length: 10 }, () =>
        this.prisma.user.findMany({ take: 5 })
      );
      return await Promise.all(operations);
    });
  }

  async benchmarkAPIEndpoints() {
    console.log('\n📊 API Endpoint Performance Benchmarks');
    console.log('=======================================');

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const authToken = process.env.TEST_API_TOKEN || 'test-token';

    // Health check benchmark
    await this.runBenchmark('Health Check Endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      return { status: response.status, data: await response.json() };
    });

    // Analysis estimation benchmark
    await this.runBenchmark('Analysis Estimation', async () => {
      const response = await fetch(`${baseUrl}/api/analysis/estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          repositoryUrl: 'https://github.com/facebook/react',
          repositorySize: 50000
        })
      });
      return { status: response.status, data: await response.json() };
    });

    // Dashboard data benchmark
    await this.runBenchmark('Dashboard Data Retrieval', async () => {
      const response = await fetch(`${baseUrl}/api/reporting/dashboard`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Organization-ID': 'test-org'
        }
      });
      return { status: response.status, data: await response.json() };
    });

    // Credit balance benchmark
    await this.runBenchmark('Credit Balance Check', async () => {
      const response = await fetch(`${baseUrl}/api/credits`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-User-ID': 'test-user'
        }
      });
      return { status: response.status, data: await response.json() };
    });
  }

  async benchmarkConcurrentLoad() {
    console.log('\n📊 Concurrent Load Benchmarks');
    console.log('==============================');

    // Concurrent API requests benchmark
    await this.runBenchmark('Concurrent API Requests (10)', async () => {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const authToken = process.env.TEST_API_TOKEN || 'test-token';
      
      const requests = Array.from({ length: 10 }, () =>
        fetch(`${baseUrl}/api/health`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
      );
      
      const responses = await Promise.all(requests);
      return responses.map(r => r.status);
    });

    // Concurrent database queries benchmark
    await this.runBenchmark('Concurrent DB Queries (20)', async () => {
      const queries = Array.from({ length: 20 }, () =>
        this.prisma.user.count()
      );
      
      return await Promise.all(queries);
    });

    // Mixed workload benchmark
    await this.runBenchmark('Mixed Workload (Read/Write)', async () => {
      const operations = [];
      
      // 70% reads, 30% writes
      for (let i = 0; i < 10; i++) {
        if (i < 7) {
          // Read operation
          operations.push(
            this.prisma.repositoryAnalysis.findMany({ take: 5 })
          );
        } else {
          // Write operation
          operations.push(
            this.prisma.repositoryAnalysis.create({
              data: {
                repositoryUrl: `https://github.com/test/benchmark-${i}`,
                repositoryName: `benchmark-${i}`,
                status: 'pending',
                userId: 'benchmark-user',
                organizationId: 'benchmark-org',
                creditsCost: 5
              }
            })
          );
        }
      }
      
      return await Promise.all(operations);
    });
  }

  async benchmarkMemoryUsage() {
    console.log('\n📊 Memory Usage Benchmarks');
    console.log('===========================');

    const getMemoryUsage = () => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        return process.memoryUsage();
      }
      return null;
    };

    // Large dataset processing benchmark
    await this.runBenchmark('Large Dataset Processing', async () => {
      const memoryBefore = getMemoryUsage();
      
      // Simulate processing large dataset
      const largeDataset = await this.prisma.repositoryAnalysis.findMany({
        take: 1000,
        include: {
          user: true,
          organization: true
        }
      });
      
      // Process the data
      const processed = largeDataset.map(analysis => ({
        id: analysis.id,
        score: Math.random() * 100,
        processed: true
      }));
      
      const memoryAfter = getMemoryUsage();
      
      return {
        recordsProcessed: processed.length,
        memoryBefore,
        memoryAfter,
        memoryDelta: memoryAfter && memoryBefore ? 
          memoryAfter.heapUsed - memoryBefore.heapUsed : null
      };
    });
  }

  generateReport() {
    console.log('\n📋 Performance Benchmark Report');
    console.log('================================');

    const successfulBenchmarks = this.results.filter(r => r.success);
    const failedBenchmarks = this.results.filter(r => !r.success);

    console.log(`\n✅ Successful benchmarks: ${successfulBenchmarks.length}`);
    console.log(`❌ Failed benchmarks: ${failedBenchmarks.length}`);

    if (successfulBenchmarks.length > 0) {
      console.log('\n🏆 Performance Summary:');
      console.log('=======================');

      successfulBenchmarks.forEach(result => {
        const status = result.duration < 1000 ? '🟢' : 
                     result.duration < 3000 ? '🟡' : '🔴';
        console.log(`${status} ${result.name}: ${result.duration.toFixed(2)}ms`);
      });

      const avgDuration = successfulBenchmarks.reduce((sum, r) => sum + r.duration, 0) / successfulBenchmarks.length;
      console.log(`\n📊 Average response time: ${avgDuration.toFixed(2)}ms`);

      // Performance thresholds
      const fastOperations = successfulBenchmarks.filter(r => r.duration < 1000);
      const slowOperations = successfulBenchmarks.filter(r => r.duration > 3000);

      console.log(`🟢 Fast operations (< 1s): ${fastOperations.length}`);
      console.log(`🔴 Slow operations (> 3s): ${slowOperations.length}`);

      if (slowOperations.length > 0) {
        console.log('\n⚠️  Slow operations that need optimization:');
        slowOperations.forEach(op => {
          console.log(`   - ${op.name}: ${op.duration.toFixed(2)}ms`);
        });
      }
    }

    if (failedBenchmarks.length > 0) {
      console.log('\n❌ Failed benchmarks:');
      failedBenchmarks.forEach(result => {
        console.log(`   - ${result.name}: ${result.details}`);
      });
    }

    return {
      total: this.results.length,
      successful: successfulBenchmarks.length,
      failed: failedBenchmarks.length,
      averageDuration: successfulBenchmarks.length > 0 ? 
        successfulBenchmarks.reduce((sum, r) => sum + r.duration, 0) / successfulBenchmarks.length : 0,
      results: this.results
    };
  }

  async cleanup() {
    // Clean up test data created during benchmarks
    try {
      await this.prisma.repositoryAnalysis.deleteMany({
        where: {
          repositoryUrl: { contains: 'benchmark' }
        }
      });
      console.log('✅ Benchmark cleanup completed');
    } catch (error) {
      console.error('❌ Benchmark cleanup failed:', error);
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

async function runPerformanceBenchmarks() {
  const benchmark = new PerformanceBenchmark();

  try {
    console.log('🚀 Starting Performance Benchmarks...\n');

    await benchmark.benchmarkDatabaseOperations();
    await benchmark.benchmarkAPIEndpoints();
    await benchmark.benchmarkConcurrentLoad();
    await benchmark.benchmarkMemoryUsage();

    const report = benchmark.generateReport();

    // Exit with error code if too many operations are slow
    const slowOperationsThreshold = 0.3; // 30% of operations
    const slowOperationsRatio = report.results.filter(r => r.success && r.duration > 3000).length / report.successful;

    if (slowOperationsRatio > slowOperationsThreshold) {
      console.log(`\n⚠️  Warning: ${(slowOperationsRatio * 100).toFixed(1)}% of operations are slow (> 3s)`);
      console.log('Consider optimizing performance before production deployment.');
      process.exit(1);
    } else {
      console.log('\n🎉 Performance benchmarks completed successfully!');
      console.log('System performance is within acceptable limits.');
    }

  } catch (error) {
    console.error('❌ Performance benchmark failed:', error);
    process.exit(1);
  } finally {
    await benchmark.cleanup();
  }
}

// Run benchmarks if this script is executed directly
if (require.main === module) {
  runPerformanceBenchmarks();
}

export { PerformanceBenchmark };