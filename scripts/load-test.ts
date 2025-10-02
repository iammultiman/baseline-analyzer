#!/usr/bin/env tsx

import { performance } from 'perf_hooks';

interface LoadTestConfig {
  baseUrl: string;
  authToken: string;
  duration: number; // in seconds
  concurrency: number;
  rampUp: number; // in seconds
}

interface LoadTestResult {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errors: string[];
}

class LoadTester {
  private config: LoadTestConfig;
  private results: Map<string, LoadTestResult> = new Map();

  constructor(config: LoadTestConfig) {
    this.config = config;
  }

  async runLoadTest(endpoint: string, method: string = 'GET', body?: any): Promise<LoadTestResult> {
    console.log(`🔥 Starting load test for ${endpoint}`);
    console.log(`   Concurrency: ${this.config.concurrency} users`);
    console.log(`   Duration: ${this.config.duration}s`);
    console.log(`   Ramp-up: ${this.config.rampUp}s`);

    const result: LoadTestResult = {
      endpoint,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errors: []
    };

    const responseTimes: number[] = [];
    const startTime = Date.now();
    const endTime = startTime + (this.config.duration * 1000);
    const rampUpInterval = (this.config.rampUp * 1000) / this.config.concurrency;

    const workers: Promise<void>[] = [];

    // Create workers with ramp-up
    for (let i = 0; i < this.config.concurrency; i++) {
      const workerDelay = i * rampUpInterval;
      
      const worker = new Promise<void>((resolve) => {
        setTimeout(async () => {
          await this.runWorker(endpoint, method, body, endTime, result, responseTimes);
          resolve();
        }, workerDelay);
      });

      workers.push(worker);
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    // Calculate final statistics
    const totalDuration = (Date.now() - startTime) / 1000;
    result.averageResponseTime = responseTimes.length > 0 ? 
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
    result.minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    result.maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
    result.requestsPerSecond = result.totalRequests / totalDuration;

    this.results.set(endpoint, result);

    console.log(`✅ Load test completed for ${endpoint}`);
    console.log(`   Total requests: ${result.totalRequests}`);
    console.log(`   Success rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`);
    console.log(`   Avg response time: ${result.averageResponseTime.toFixed(2)}ms`);
    console.log(`   Requests/sec: ${result.requestsPerSecond.toFixed(2)}`);

    return result;
  }

  private async runWorker(
    endpoint: string,
    method: string,
    body: any,
    endTime: number,
    result: LoadTestResult,
    responseTimes: number[]
  ): Promise<void> {
    while (Date.now() < endTime) {
      const requestStart = performance.now();
      
      try {
        const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.authToken}`
          },
          body: body ? JSON.stringify(body) : undefined
        });

        const responseTime = performance.now() - requestStart;
        responseTimes.push(responseTime);
        result.totalRequests++;

        if (response.ok) {
          result.successfulRequests++;
        } else {
          result.failedRequests++;
          result.errors.push(`HTTP ${response.status}: ${response.statusText}`);
        }

      } catch (error) {
        const responseTime = performance.now() - requestStart;
        responseTimes.push(responseTime);
        result.totalRequests++;
        result.failedRequests++;
        result.errors.push(`Network error: ${error}`);
      }

      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  async runHealthCheckLoadTest(): Promise<LoadTestResult> {
    return await this.runLoadTest('/api/health');
  }

  async runAnalysisEstimationLoadTest(): Promise<LoadTestResult> {
    const body = {
      repositoryUrl: 'https://github.com/facebook/react',
      repositorySize: 50000
    };
    return await this.runLoadTest('/api/analysis/estimate', 'POST', body);
  }

  async runDashboardLoadTest(): Promise<LoadTestResult> {
    return await this.runLoadTest('/api/reporting/dashboard');
  }

  async runCreditBalanceLoadTest(): Promise<LoadTestResult> {
    return await this.runLoadTest('/api/credits');
  }

  async runAnalysisStatusLoadTest(): Promise<LoadTestResult> {
    // First create an analysis to check status for
    const analysisBody = {
      repositoryUrl: 'https://github.com/vercel/next.js',
      userId: 'load-test-user',
      organizationId: 'load-test-org'
    };

    try {
      const createResponse = await fetch(`${this.config.baseUrl}/api/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.authToken}`
        },
        body: JSON.stringify(analysisBody)
      });

      if (createResponse.ok) {
        const analysisData = await createResponse.json();
        return await this.runLoadTest(`/api/analysis/${analysisData.id}/status`);
      } else {
        throw new Error('Failed to create analysis for status load test');
      }
    } catch (error) {
      console.error('❌ Failed to setup analysis status load test:', error);
      throw error;
    }
  }

  generateReport(): void {
    console.log('\n📊 Load Test Report');
    console.log('===================');

    const allResults = Array.from(this.results.values());
    
    if (allResults.length === 0) {
      console.log('No load test results available.');
      return;
    }

    // Summary statistics
    const totalRequests = allResults.reduce((sum, r) => sum + r.totalRequests, 0);
    const totalSuccessful = allResults.reduce((sum, r) => sum + r.successfulRequests, 0);
    const totalFailed = allResults.reduce((sum, r) => sum + r.failedRequests, 0);
    const avgResponseTime = allResults.reduce((sum, r) => sum + r.averageResponseTime, 0) / allResults.length;
    const avgRequestsPerSecond = allResults.reduce((sum, r) => sum + r.requestsPerSecond, 0) / allResults.length;

    console.log(`\n📈 Overall Statistics:`);
    console.log(`   Total requests: ${totalRequests}`);
    console.log(`   Successful: ${totalSuccessful} (${((totalSuccessful / totalRequests) * 100).toFixed(2)}%)`);
    console.log(`   Failed: ${totalFailed} (${((totalFailed / totalRequests) * 100).toFixed(2)}%)`);
    console.log(`   Average response time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   Average requests/sec: ${avgRequestsPerSecond.toFixed(2)}`);

    // Individual endpoint results
    console.log(`\n📋 Endpoint Results:`);
    console.log('====================');

    allResults.forEach(result => {
      const successRate = (result.successfulRequests / result.totalRequests) * 100;
      const status = successRate >= 95 ? '🟢' : successRate >= 90 ? '🟡' : '🔴';
      
      console.log(`\n${status} ${result.endpoint}`);
      console.log(`   Requests: ${result.totalRequests}`);
      console.log(`   Success rate: ${successRate.toFixed(2)}%`);
      console.log(`   Response time: ${result.averageResponseTime.toFixed(2)}ms (min: ${result.minResponseTime.toFixed(2)}ms, max: ${result.maxResponseTime.toFixed(2)}ms)`);
      console.log(`   Throughput: ${result.requestsPerSecond.toFixed(2)} req/s`);
      
      if (result.errors.length > 0) {
        const uniqueErrors = [...new Set(result.errors)];
        console.log(`   Errors: ${uniqueErrors.slice(0, 3).join(', ')}${uniqueErrors.length > 3 ? '...' : ''}`);
      }
    });

    // Performance assessment
    console.log(`\n🎯 Performance Assessment:`);
    console.log('==========================');

    const performanceIssues: string[] = [];

    if (avgResponseTime > 2000) {
      performanceIssues.push(`High average response time: ${avgResponseTime.toFixed(2)}ms`);
    }

    if (avgRequestsPerSecond < 10) {
      performanceIssues.push(`Low throughput: ${avgRequestsPerSecond.toFixed(2)} req/s`);
    }

    const lowSuccessRateEndpoints = allResults.filter(r => 
      (r.successfulRequests / r.totalRequests) < 0.95
    );

    if (lowSuccessRateEndpoints.length > 0) {
      performanceIssues.push(`${lowSuccessRateEndpoints.length} endpoint(s) with success rate < 95%`);
    }

    if (performanceIssues.length === 0) {
      console.log('🎉 All performance metrics are within acceptable limits!');
    } else {
      console.log('⚠️  Performance issues detected:');
      performanceIssues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
    }
  }

  getResults(): Map<string, LoadTestResult> {
    return this.results;
  }
}

async function runLoadTests() {
  const config: LoadTestConfig = {
    baseUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    authToken: process.env.TEST_API_TOKEN || 'test-token',
    duration: parseInt(process.env.LOAD_TEST_DURATION || '30'), // 30 seconds
    concurrency: parseInt(process.env.LOAD_TEST_CONCURRENCY || '10'), // 10 concurrent users
    rampUp: parseInt(process.env.LOAD_TEST_RAMP_UP || '5') // 5 seconds ramp-up
  };

  console.log('🚀 Starting Load Tests...');
  console.log(`Target: ${config.baseUrl}`);
  console.log(`Configuration: ${config.concurrency} users, ${config.duration}s duration, ${config.rampUp}s ramp-up\n`);

  const loadTester = new LoadTester(config);

  try {
    // Run load tests for different endpoints
    await loadTester.runHealthCheckLoadTest();
    await loadTester.runAnalysisEstimationLoadTest();
    await loadTester.runDashboardLoadTest();
    await loadTester.runCreditBalanceLoadTest();
    
    // Skip analysis status test if it fails to setup
    try {
      await loadTester.runAnalysisStatusLoadTest();
    } catch (error) {
      console.log('⚠️  Skipping analysis status load test due to setup failure');
    }

    // Generate and display report
    loadTester.generateReport();

    // Check if load tests passed
    const results = Array.from(loadTester.getResults().values());
    const failedTests = results.filter(r => (r.successfulRequests / r.totalRequests) < 0.9);

    if (failedTests.length > 0) {
      console.log('\n❌ Load tests failed! Some endpoints have success rate < 90%');
      process.exit(1);
    } else {
      console.log('\n✅ Load tests passed! All endpoints performed within acceptable limits');
    }

  } catch (error) {
    console.error('❌ Load test execution failed:', error);
    process.exit(1);
  }
}

// Run load tests if this script is executed directly
if (require.main === module) {
  runLoadTests();
}

export { LoadTester, LoadTestConfig, LoadTestResult };