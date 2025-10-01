# CI/CD Integration Guide

This guide explains how to integrate Baseline Analyzer into your CI/CD pipeline for automated repository analysis.

## Overview

The CI/CD integration provides:
- API key authentication for automated access
- Webhook notifications for analysis completion
- Machine-readable analysis results in multiple formats
- Quality gate support with configurable thresholds
- Priority processing for CI/CD requests

## Getting Started

### 1. Create an API Key

First, create an API key for your CI/CD system:

```bash
curl -X POST https://your-baseline-analyzer.com/api/cicd/api-keys \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GitHub Actions CI",
    "permissions": ["analysis:read", "analysis:write"],
    "expiresAt": "2025-12-31T23:59:59Z"
  }'
```

Response:
```json
{
  "id": "key-123",
  "name": "GitHub Actions CI",
  "key": "bla_abc123def456...",
  "keyPrefix": "bla_abc123...",
  "permissions": ["analysis:read", "analysis:write"],
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Important**: Save the full API key securely - it's only shown once!

### 2. Set Up Webhooks (Optional)

Configure webhooks to receive notifications when analysis completes:

```bash
curl -X POST https://your-baseline-analyzer.com/api/cicd/webhooks \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-ci-system.com/webhooks/baseline-analyzer",
    "events": ["analysis.completed", "analysis.failed"],
    "secret": "your-webhook-secret"
  }'
```

## API Reference

### Authentication

All CI/CD API endpoints require API key authentication:

```bash
Authorization: Bearer bla_abc123def456...
```

### Submit Analysis

Submit a repository for analysis:

```bash
POST /api/cicd/analyze
```

**Request Body:**
```json
{
  "repositoryUrl": "https://github.com/your-org/your-repo",
  "branch": "main",
  "commitSha": "abc123def456",
  "webhookUrl": "https://your-ci.com/webhook",
  "priority": "high",
  "metadata": {
    "buildId": "12345",
    "pullRequestId": "67"
  }
}
```

**Response:**
```json
{
  "id": "analysis-123",
  "status": "pending",
  "repositoryUrl": "https://github.com/your-org/your-repo",
  "branch": "main",
  "commitSha": "abc123def456",
  "estimatedCredits": 10,
  "createdAt": "2024-12-27T10:00:00Z",
  "webhookUrl": "https://your-ci.com/webhook"
}
```

### Check Analysis Status

Check the status of an analysis:

```bash
GET /api/cicd/analyze/{id}/status?fail_on_critical=true&min_score=80
```

**Response:**
```json
{
  "id": "analysis-123",
  "status": "completed",
  "repositoryUrl": "https://github.com/your-org/your-repo",
  "branch": "main",
  "commitSha": "abc123def456",
  "createdAt": "2024-12-27T10:00:00Z",
  "completedAt": "2024-12-27T10:05:00Z",
  "creditsCost": 8,
  "exitCode": 0,
  "summary": {
    "complianceScore": 85,
    "totalIssues": 3,
    "criticalIssues": 0,
    "warningIssues": 2,
    "infoIssues": 1,
    "passedChecks": 17,
    "totalChecks": 20
  },
  "qualityGate": {
    "passed": true,
    "failOnCritical": true,
    "failOnWarning": false,
    "minScore": 80,
    "actualScore": 85
  }
}
```

**Quality Gate Parameters:**
- `fail_on_critical=true`: Fail if critical issues found
- `fail_on_warning=true`: Fail if warning issues found  
- `min_score=80`: Fail if compliance score below threshold

**Exit Codes:**
- `0`: Analysis passed quality gates
- `1`: Analysis failed quality gates or encountered error

### Get Analysis Results

Retrieve detailed analysis results in various formats:

```bash
GET /api/cicd/analyze/{id}/result?format=json
```

**Supported Formats:**
- `json`: Detailed JSON results (default)
- `junit`: JUnit XML for test reporting
- `sarif`: SARIF format for security tools

**JSON Response:**
```json
{
  "id": "analysis-123",
  "repositoryUrl": "https://github.com/your-org/your-repo",
  "status": "completed",
  "completedAt": "2024-12-27T10:05:00Z",
  "creditsCost": 8,
  "summary": {
    "complianceScore": 85,
    "totalIssues": 3,
    "criticalIssues": 0,
    "warningIssues": 2,
    "infoIssues": 1,
    "passedChecks": 17,
    "totalChecks": 20
  },
  "issues": [
    {
      "id": "issue-1",
      "severity": "warning",
      "category": "compatibility",
      "title": "Missing CSS Grid fallback",
      "description": "CSS Grid is used without fallback for older browsers",
      "file": "src/styles/layout.css",
      "line": 15,
      "recommendation": "Add flexbox fallback for better browser support",
      "baselineFeature": "css-grid"
    }
  ],
  "recommendations": [
    {
      "id": "rec-1",
      "priority": "medium",
      "category": "performance",
      "title": "Optimize images",
      "description": "Use modern image formats like WebP",
      "actionItems": [
        "Convert JPEG images to WebP",
        "Add picture element with fallbacks"
      ],
      "estimatedEffort": "medium"
    }
  ],
  "baselineCompliance": {
    "supportedFeatures": ["css-flexbox", "es6-modules"],
    "unsupportedFeatures": ["css-grid"],
    "partiallySupported": ["web-components"],
    "recommendations": ["Add CSS Grid fallbacks"]
  },
  "metadata": {
    "analysisVersion": "1.0.0",
    "aiProvider": "openai",
    "processingTime": 45000,
    "repositorySize": 2048576,
    "fileCount": 127
  }
}
```

## CI/CD Platform Examples

### GitHub Actions

```yaml
name: Baseline Analysis
on: [push, pull_request]

jobs:
  baseline-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Submit Analysis
        id: submit
        run: |
          RESPONSE=$(curl -s -X POST https://your-baseline-analyzer.com/api/cicd/analyze \
            -H "Authorization: Bearer ${{ secrets.BASELINE_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "repositoryUrl": "${{ github.server_url }}/${{ github.repository }}",
              "branch": "${{ github.ref_name }}",
              "commitSha": "${{ github.sha }}",
              "priority": "high",
              "metadata": {
                "workflow": "${{ github.workflow }}",
                "runId": "${{ github.run_id }}"
              }
            }')
          
          ANALYSIS_ID=$(echo $RESPONSE | jq -r '.id')
          echo "analysis_id=$ANALYSIS_ID" >> $GITHUB_OUTPUT
      
      - name: Wait for Analysis
        run: |
          ANALYSIS_ID="${{ steps.submit.outputs.analysis_id }}"
          
          while true; do
            RESPONSE=$(curl -s https://your-baseline-analyzer.com/api/cicd/analyze/$ANALYSIS_ID/status?fail_on_critical=true&min_score=80 \
              -H "Authorization: Bearer ${{ secrets.BASELINE_API_KEY }}")
            
            STATUS=$(echo $RESPONSE | jq -r '.status')
            EXIT_CODE=$(echo $RESPONSE | jq -r '.exitCode')
            
            if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
              echo "Analysis completed with exit code: $EXIT_CODE"
              
              # Download results
              curl -s https://your-baseline-analyzer.com/api/cicd/analyze/$ANALYSIS_ID/result?format=junit \
                -H "Authorization: Bearer ${{ secrets.BASELINE_API_KEY }}" \
                -o baseline-results.xml
              
              exit $EXIT_CODE
            fi
            
            echo "Analysis status: $STATUS, waiting..."
            sleep 30
          done
      
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: baseline-analysis-results
          path: baseline-results.xml
```

### GitLab CI

```yaml
baseline-analysis:
  stage: test
  image: curlimages/curl:latest
  script:
    - |
      # Submit analysis
      RESPONSE=$(curl -s -X POST $BASELINE_ANALYZER_URL/api/cicd/analyze \
        -H "Authorization: Bearer $BASELINE_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
          \"repositoryUrl\": \"$CI_PROJECT_URL\",
          \"branch\": \"$CI_COMMIT_REF_NAME\",
          \"commitSha\": \"$CI_COMMIT_SHA\",
          \"priority\": \"high\"
        }")
      
      ANALYSIS_ID=$(echo $RESPONSE | jq -r '.id')
      echo "Analysis ID: $ANALYSIS_ID"
      
      # Wait for completion
      while true; do
        RESPONSE=$(curl -s $BASELINE_ANALYZER_URL/api/cicd/analyze/$ANALYSIS_ID/status?fail_on_critical=true \
          -H "Authorization: Bearer $BASELINE_API_KEY")
        
        STATUS=$(echo $RESPONSE | jq -r '.status')
        EXIT_CODE=$(echo $RESPONSE | jq -r '.exitCode')
        
        if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
          # Download SARIF results for GitLab security dashboard
          curl -s $BASELINE_ANALYZER_URL/api/cicd/analyze/$ANALYSIS_ID/result?format=sarif \
            -H "Authorization: Bearer $BASELINE_API_KEY" \
            -o gl-sast-report.json
          
          exit $EXIT_CODE
        fi
        
        sleep 30
      done
  artifacts:
    reports:
      sast: gl-sast-report.json
    when: always
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    environment {
        BASELINE_API_KEY = credentials('baseline-api-key')
        BASELINE_URL = 'https://your-baseline-analyzer.com'
    }
    
    stages {
        stage('Baseline Analysis') {
            steps {
                script {
                    // Submit analysis
                    def response = sh(
                        script: """
                            curl -s -X POST ${BASELINE_URL}/api/cicd/analyze \\
                                -H "Authorization: Bearer ${BASELINE_API_KEY}" \\
                                -H "Content-Type: application/json" \\
                                -d '{
                                    "repositoryUrl": "${env.GIT_URL}",
                                    "branch": "${env.GIT_BRANCH}",
                                    "commitSha": "${env.GIT_COMMIT}",
                                    "priority": "high"
                                }'
                        """,
                        returnStdout: true
                    ).trim()
                    
                    def analysisData = readJSON text: response
                    def analysisId = analysisData.id
                    
                    // Wait for completion
                    timeout(time: 10, unit: 'MINUTES') {
                        waitUntil {
                            def statusResponse = sh(
                                script: """
                                    curl -s ${BASELINE_URL}/api/cicd/analyze/${analysisId}/status?fail_on_critical=true \\
                                        -H "Authorization: Bearer ${BASELINE_API_KEY}"
                                """,
                                returnStdout: true
                            ).trim()
                            
                            def statusData = readJSON text: statusResponse
                            
                            if (statusData.status == 'completed' || statusData.status == 'failed') {
                                // Download results
                                sh """
                                    curl -s ${BASELINE_URL}/api/cicd/analyze/${analysisId}/result?format=junit \\
                                        -H "Authorization: Bearer ${BASELINE_API_KEY}" \\
                                        -o baseline-results.xml
                                """
                                
                                if (statusData.exitCode != 0) {
                                    error("Baseline analysis failed with exit code: ${statusData.exitCode}")
                                }
                                
                                return true
                            }
                            
                            return false
                        }
                    }
                }
            }
            
            post {
                always {
                    // Publish test results
                    publishTestResults testResultsPattern: 'baseline-results.xml'
                    archiveArtifacts artifacts: 'baseline-results.xml', allowEmptyArchive: true
                }
            }
        }
    }
}
```

## Webhook Integration

### Webhook Payload

When analysis completes, webhooks receive this payload:

```json
{
  "event": "analysis.completed",
  "timestamp": "2024-12-27T10:05:00Z",
  "organizationId": "org-123",
  "analysis": {
    "id": "analysis-123",
    "repositoryUrl": "https://github.com/your-org/your-repo",
    "branch": "main",
    "commitSha": "abc123def456",
    "status": "completed",
    "result": {
      // Full analysis result object
    }
  }
}
```

### Webhook Verification

Verify webhook authenticity using the signature:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`;
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Express.js example
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhook(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  const { event, analysis } = req.body;
  
  if (event === 'analysis.completed') {
    console.log(`Analysis ${analysis.id} completed with score: ${analysis.result.summary.complianceScore}`);
  }
  
  res.status(200).send('OK');
});
```

## Error Handling

### Common Error Codes

- `UNAUTHORIZED` (401): Invalid or missing API key
- `INSUFFICIENT_PERMISSIONS` (403): API key lacks required permissions
- `INSUFFICIENT_CREDITS` (402): Not enough credits for analysis
- `INVALID_REPOSITORY` (400): Repository URL invalid or inaccessible
- `ANALYSIS_SUBMISSION_FAILED` (500): Internal error during submission

### Retry Logic

Implement exponential backoff for transient errors:

```bash
#!/bin/bash

submit_analysis() {
  local attempt=1
  local max_attempts=5
  
  while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt of $max_attempts"
    
    RESPONSE=$(curl -s -w "%{http_code}" -X POST $BASELINE_URL/api/cicd/analyze \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d "$REQUEST_BODY")
    
    HTTP_CODE="${RESPONSE: -3}"
    BODY="${RESPONSE%???}"
    
    if [ "$HTTP_CODE" -eq 201 ]; then
      echo "Analysis submitted successfully"
      echo "$BODY" | jq -r '.id'
      return 0
    elif [ "$HTTP_CODE" -eq 429 ] || [ "$HTTP_CODE" -ge 500 ]; then
      echo "Transient error ($HTTP_CODE), retrying..."
      sleep $((2 ** attempt))
      ((attempt++))
    else
      echo "Permanent error ($HTTP_CODE): $BODY"
      return 1
    fi
  done
  
  echo "Max attempts reached"
  return 1
}
```

## Best Practices

1. **Secure API Keys**: Store API keys in your CI/CD platform's secret management
2. **Set Expiration**: Use reasonable expiration dates for API keys
3. **Monitor Usage**: Track API key usage and set up alerts
4. **Quality Gates**: Configure appropriate thresholds for your project
5. **Caching**: Cache results for the same commit SHA to avoid duplicate analysis
6. **Timeouts**: Set reasonable timeouts for analysis completion
7. **Artifacts**: Save analysis results as build artifacts for later review
8. **Notifications**: Use webhooks for real-time notifications instead of polling

## Troubleshooting

### Analysis Takes Too Long

- Check repository size and complexity
- Verify sufficient credits are available
- Consider using priority processing for CI/CD

### Webhook Not Received

- Verify webhook URL is accessible from the internet
- Check webhook secret configuration
- Review webhook delivery logs in the dashboard

### Quality Gate Failures

- Review analysis results to understand issues
- Adjust quality gate thresholds if needed
- Consider treating warnings as non-blocking initially

### API Key Issues

- Verify API key has correct permissions
- Check expiration date
- Ensure proper Authorization header format

For additional support, check the webhook delivery logs and API key usage statistics in your organization dashboard.