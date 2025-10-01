#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

class BaselineCLI {
  constructor() {
    this.baseUrl = process.env.BASELINE_ANALYZER_URL || 'https://baseline-analyzer.dev';
    this.apiKey = process.env.BASELINE_API_KEY;
    this.timeout = parseInt(process.env.BASELINE_TIMEOUT || '600') * 1000; // 10 minutes default
  }

  async request(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Baseline-CLI/1.0.0',
        },
      };

      if (data) {
        const body = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = client.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = responseData ? JSON.parse(responseData) : {};
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${parsed.error || responseData}`));
            }
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${responseData}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async submitAnalysis(repositoryUrl, options = {}) {
    const payload = {
      repositoryUrl,
      ...options,
    };

    console.log(`Submitting analysis for: ${repositoryUrl}`);
    
    try {
      const result = await this.request('POST', '/api/cicd/analyze', payload);
      console.log(`Analysis submitted: ${result.id}`);
      console.log(`Estimated credits: ${result.estimatedCredits}`);
      return result;
    } catch (error) {
      console.error('Failed to submit analysis:', error.message);
      process.exit(1);
    }
  }

  async waitForCompletion(analysisId, qualityGates = {}) {
    console.log(`Waiting for analysis ${analysisId} to complete...`);
    
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds
    
    while (Date.now() - startTime < this.timeout) {
      try {
        const params = new URLSearchParams(qualityGates).toString();
        const endpoint = `/api/cicd/analyze/${analysisId}/status${params ? '?' + params : ''}`;
        
        const status = await this.request('GET', endpoint);
        
        console.log(`Status: ${status.status}`);
        
        if (status.status === 'completed') {
          console.log('Analysis completed successfully!');
          console.log(`Compliance Score: ${status.summary.complianceScore}`);
          console.log(`Issues: ${status.summary.totalIssues} (${status.summary.criticalIssues} critical, ${status.summary.warningIssues} warnings)`);
          
          if (status.qualityGate && !status.qualityGate.passed) {
            console.error(`Quality gate failed: ${status.failureReason}`);
            process.exit(status.exitCode || 1);
          }
          
          return status;
        } else if (status.status === 'failed') {
          console.error('Analysis failed');
          process.exit(1);
        }
        
        // Still processing, wait and retry
        await this.sleep(pollInterval);
        
      } catch (error) {
        console.error('Error checking status:', error.message);
        process.exit(1);
      }
    }
    
    console.error('Analysis timeout exceeded');
    process.exit(1);
  }

  async downloadResults(analysisId, format = 'json', outputFile = null) {
    try {
      const endpoint = `/api/cicd/analyze/${analysisId}/result?format=${format}`;
      
      if (format === 'json') {
        const result = await this.request('GET', endpoint);
        
        if (outputFile) {
          fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
          console.log(`Results saved to: ${outputFile}`);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        
        return result;
      } else {
        // For non-JSON formats, we need to handle the response differently
        return new Promise((resolve, reject) => {
          const url = new URL(endpoint, this.baseUrl);
          const isHttps = url.protocol === 'https:';
          const client = isHttps ? https : http;

          const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'User-Agent': 'Baseline-CLI/1.0.0',
            },
          };

          const req = client.request(options, (res) => {
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}`));
              return;
            }

            if (outputFile) {
              const writeStream = fs.createWriteStream(outputFile);
              res.pipe(writeStream);
              
              writeStream.on('finish', () => {
                console.log(`Results saved to: ${outputFile}`);
                resolve();
              });
              
              writeStream.on('error', reject);
            } else {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                console.log(data);
                resolve();
              });
            }
          });

          req.on('error', reject);
          req.end();
        });
      }
    } catch (error) {
      console.error('Failed to download results:', error.message);
      process.exit(1);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printUsage() {
    console.log(`
Baseline Analyzer CLI

Usage:
  baseline-cli analyze <repository-url> [options]
  baseline-cli status <analysis-id> [options]
  baseline-cli results <analysis-id> [options]

Commands:
  analyze     Submit repository for analysis
  status      Check analysis status
  results     Download analysis results

Options:
  --branch <branch>           Git branch to analyze
  --commit <sha>              Git commit SHA
  --priority <level>          Priority: high, normal, low (default: normal)
  --webhook <url>             Webhook URL for notifications
  --fail-on-critical         Fail if critical issues found
  --fail-on-warning          Fail if warning issues found
  --min-score <score>         Minimum compliance score (0-100)
  --format <format>           Output format: json, junit, sarif (default: json)
  --output <file>             Output file path
  --timeout <seconds>         Analysis timeout in seconds (default: 600)

Environment Variables:
  BASELINE_ANALYZER_URL       Base URL of the Baseline Analyzer instance
  BASELINE_API_KEY           API key for authentication
  BASELINE_TIMEOUT           Default timeout in seconds

Examples:
  baseline-cli analyze https://github.com/user/repo --branch main --fail-on-critical
  baseline-cli status analysis-123 --min-score 80
  baseline-cli results analysis-123 --format junit --output results.xml

Exit Codes:
  0    Success
  1    Analysis failed or error occurred
`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    new BaselineCLI().printUsage();
    process.exit(1);
  }

  const cli = new BaselineCLI();
  
  if (!cli.apiKey) {
    console.error('Error: BASELINE_API_KEY environment variable is required');
    process.exit(1);
  }

  const command = args[0];
  
  try {
    switch (command) {
      case 'analyze': {
        if (args.length < 2) {
          console.error('Error: Repository URL is required');
          process.exit(1);
        }
        
        const repositoryUrl = args[1];
        const options = {};
        const qualityGates = {};
        
        for (let i = 2; i < args.length; i += 2) {
          const flag = args[i];
          const value = args[i + 1];
          
          switch (flag) {
            case '--branch':
              options.branch = value;
              break;
            case '--commit':
              options.commitSha = value;
              break;
            case '--priority':
              options.priority = value;
              break;
            case '--webhook':
              options.webhookUrl = value;
              break;
            case '--fail-on-critical':
              qualityGates.fail_on_critical = 'true';
              i--; // No value for this flag
              break;
            case '--fail-on-warning':
              qualityGates.fail_on_warning = 'true';
              i--; // No value for this flag
              break;
            case '--min-score':
              qualityGates.min_score = value;
              break;
            case '--timeout':
              cli.timeout = parseInt(value) * 1000;
              break;
          }
        }
        
        const analysis = await cli.submitAnalysis(repositoryUrl, options);
        const result = await cli.waitForCompletion(analysis.id, qualityGates);
        
        console.log(`\nAnalysis completed successfully!`);
        console.log(`Analysis ID: ${analysis.id}`);
        console.log(`Credits used: ${result.creditsCost || 'N/A'}`);
        break;
      }
      
      case 'status': {
        if (args.length < 2) {
          console.error('Error: Analysis ID is required');
          process.exit(1);
        }
        
        const analysisId = args[1];
        const qualityGates = {};
        
        for (let i = 2; i < args.length; i += 2) {
          const flag = args[i];
          const value = args[i + 1];
          
          switch (flag) {
            case '--fail-on-critical':
              qualityGates.fail_on_critical = 'true';
              i--; // No value for this flag
              break;
            case '--fail-on-warning':
              qualityGates.fail_on_warning = 'true';
              i--; // No value for this flag
              break;
            case '--min-score':
              qualityGates.min_score = value;
              break;
          }
        }
        
        const params = new URLSearchParams(qualityGates).toString();
        const endpoint = `/api/cicd/analyze/${analysisId}/status${params ? '?' + params : ''}`;
        
        const status = await cli.request('GET', endpoint);
        console.log(JSON.stringify(status, null, 2));
        
        if (status.exitCode && status.exitCode !== 0) {
          process.exit(status.exitCode);
        }
        break;
      }
      
      case 'results': {
        if (args.length < 2) {
          console.error('Error: Analysis ID is required');
          process.exit(1);
        }
        
        const analysisId = args[1];
        let format = 'json';
        let outputFile = null;
        
        for (let i = 2; i < args.length; i += 2) {
          const flag = args[i];
          const value = args[i + 1];
          
          switch (flag) {
            case '--format':
              format = value;
              break;
            case '--output':
              outputFile = value;
              break;
          }
        }
        
        await cli.downloadResults(analysisId, format, outputFile);
        break;
      }
      
      default:
        console.error(`Unknown command: ${command}`);
        cli.printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = BaselineCLI;