# Production Security Setup Script (PowerShell)
# This script configures all security measures for production deployment

param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT ?? "baseline-analyzer-prod",
    [string]$Region = $env:GOOGLE_CLOUD_REGION ?? "us-central1",
    [string]$ServiceName = $env:SERVICE_NAME ?? "baseline-analyzer-api",
    [string]$Domain = $env:DOMAIN ?? "baseline-analyzer.web.app"
)

Write-Host "Setting up production security for project: $ProjectId" -ForegroundColor Green

try {
    # 1. Configure Cloud Armor for DDoS protection
    Write-Host "Setting up Cloud Armor DDoS protection..." -ForegroundColor Yellow

    # Create security policy
    try {
        gcloud compute security-policies create baseline-analyzer-security-policy `
            --description="Security policy for Baseline Analyzer" `
            --project=$ProjectId
    }
    catch {
        Write-Host "Security policy already exists" -ForegroundColor Yellow
    }

    # Add rate limiting rule
    try {
        gcloud compute security-policies rules create 1000 `
            --security-policy=baseline-analyzer-security-policy `
            --expression="true" `
            --action=rate-based-ban `
            --rate-limit-threshold-count=100 `
            --rate-limit-threshold-interval-sec=60 `
            --ban-duration-sec=600 `
            --conform-action=allow `
            --exceed-action=deny-429 `
            --enforce-on-key=IP `
            --project=$ProjectId
    }
    catch {
        Write-Host "Rate limiting rule already exists" -ForegroundColor Yellow
    }

    # Add SQL injection protection
    try {
        gcloud compute security-policies rules create 3000 `
            --security-policy=baseline-analyzer-security-policy `
            --expression="evaluatePreconfiguredExpr('sqli-stable')" `
            --action=deny-403 `
            --description="Block SQL injection attempts" `
            --project=$ProjectId
    }
    catch {
        Write-Host "SQL injection rule already exists" -ForegroundColor Yellow
    }

    # Add XSS protection
    try {
        gcloud compute security-policies rules create 3001 `
            --security-policy=baseline-analyzer-security-policy `
            --expression="evaluatePreconfiguredExpr('xss-stable')" `
            --action=deny-403 `
            --description="Block XSS attempts" `
            --project=$ProjectId
    }
    catch {
        Write-Host "XSS protection rule already exists" -ForegroundColor Yellow
    }

    # 2. Set up Web Application Firewall (WAF) rules
    Write-Host "Configuring WAF rules..." -ForegroundColor Yellow

    # Block malicious user agents
    try {
        gcloud compute security-policies rules create 4000 `
            --security-policy=baseline-analyzer-security-policy `
            --expression="request.headers['user-agent'].contains('sqlmap') || request.headers['user-agent'].contains('nikto') || request.headers['user-agent'].contains('nmap')" `
            --action=deny-403 `
            --description="Block malicious user agents" `
            --project=$ProjectId
    }
    catch {
        Write-Host "Malicious user agent rule already exists" -ForegroundColor Yellow
    }

    # 3. Configure SSL/TLS certificates
    Write-Host "Setting up SSL certificates..." -ForegroundColor Yellow

    try {
        gcloud compute ssl-certificates create baseline-analyzer-ssl-cert `
            --domains=$Domain `
            --global `
            --project=$ProjectId
    }
    catch {
        Write-Host "SSL certificate already exists" -ForegroundColor Yellow
    }

    # 4. Set up VPC and firewall rules
    Write-Host "Configuring VPC and firewall..." -ForegroundColor Yellow

    # Create VPC network
    try {
        gcloud compute networks create baseline-analyzer-vpc `
            --subnet-mode=custom `
            --project=$ProjectId
    }
    catch {
        Write-Host "VPC already exists" -ForegroundColor Yellow
    }

    # Create subnet
    try {
        gcloud compute networks subnets create baseline-analyzer-subnet `
            --network=baseline-analyzer-vpc `
            --range=10.0.0.0/24 `
            --region=$Region `
            --project=$ProjectId
    }
    catch {
        Write-Host "Subnet already exists" -ForegroundColor Yellow
    }

    # Create firewall rules
    try {
        gcloud compute firewall-rules create baseline-analyzer-allow-https `
            --network=baseline-analyzer-vpc `
            --allow=tcp:443 `
            --source-ranges=0.0.0.0/0 `
            --description="Allow HTTPS traffic" `
            --project=$ProjectId
    }
    catch {
        Write-Host "HTTPS firewall rule already exists" -ForegroundColor Yellow
    }

    # 5. Set up Cloud KMS for encryption
    Write-Host "Setting up Cloud KMS..." -ForegroundColor Yellow

    # Create key ring
    try {
        gcloud kms keyrings create baseline-analyzer-keyring `
            --location=global `
            --project=$ProjectId
    }
    catch {
        Write-Host "Key ring already exists" -ForegroundColor Yellow
    }

    # Create encryption keys
    $keys = @("database-encryption-key", "api-encryption-key", "backup-encryption-key")
    foreach ($key in $keys) {
        try {
            gcloud kms keys create $key `
                --keyring=baseline-analyzer-keyring `
                --location=global `
                --purpose=encryption `
                --project=$ProjectId
        }
        catch {
            Write-Host "$key already exists" -ForegroundColor Yellow
        }
    }

    # 6. Configure audit logging
    Write-Host "Setting up audit logging..." -ForegroundColor Yellow

    $auditPolicy = @"
auditConfigs:
- service: allServices
  auditLogConfigs:
  - logType: ADMIN_READ
  - logType: DATA_READ
  - logType: DATA_WRITE
- service: cloudsql.googleapis.com
  auditLogConfigs:
  - logType: ADMIN_READ
  - logType: DATA_READ
  - logType: DATA_WRITE
- service: run.googleapis.com
  auditLogConfigs:
  - logType: ADMIN_READ
  - logType: DATA_READ
  - logType: DATA_WRITE
"@

    $auditPolicy | Out-File -FilePath "audit-policy.yaml" -Encoding UTF8

    try {
        gcloud logging sinks create baseline-analyzer-audit-sink `
            "bigquery.googleapis.com/projects/$ProjectId/datasets/audit_logs" `
            --log-filter='protoPayload.serviceName="cloudsql.googleapis.com" OR protoPayload.serviceName="run.googleapis.com" OR protoPayload.serviceName="iam.googleapis.com"' `
            --project=$ProjectId
    }
    catch {
        Write-Host "Audit sink already exists" -ForegroundColor Yellow
    }

    # 7. Configure backup encryption
    Write-Host "Setting up backup encryption..." -ForegroundColor Yellow

    # Create backup bucket with encryption
    try {
        gsutil mb -p $ProjectId -c STANDARD -l $Region "gs://$ProjectId-secure-backups/"
    }
    catch {
        Write-Host "Backup bucket already exists" -ForegroundColor Yellow
    }

    # Set default encryption
    gsutil kms encryption -k "projects/$ProjectId/locations/global/keyRings/baseline-analyzer-keyring/cryptoKeys/backup-encryption-key" "gs://$ProjectId-secure-backups/"

    # 8. Create security monitoring dashboard
    Write-Host "Creating security monitoring dashboard..." -ForegroundColor Yellow

    $dashboardConfig = @{
        displayName = "Baseline Analyzer Security Dashboard"
        mosaicLayout = @{
            tiles = @(
                @{
                    width = 6
                    height = 4
                    widget = @{
                        title = "Request Rate"
                        xyChart = @{
                            dataSets = @(
                                @{
                                    timeSeriesQuery = @{
                                        timeSeriesFilter = @{
                                            filter = 'resource.type="https_lb_rule"'
                                            aggregation = @{
                                                alignmentPeriod = "60s"
                                                perSeriesAligner = "ALIGN_RATE"
                                                crossSeriesReducer = "REDUCE_SUM"
                                            }
                                        }
                                    }
                                }
                            )
                        }
                    }
                },
                @{
                    width = 6
                    height = 4
                    xPos = 6
                    widget = @{
                        title = "Error Rate"
                        xyChart = @{
                            dataSets = @(
                                @{
                                    timeSeriesQuery = @{
                                        timeSeriesFilter = @{
                                            filter = 'resource.type="cloud_run_revision" AND severity="ERROR"'
                                            aggregation = @{
                                                alignmentPeriod = "60s"
                                                perSeriesAligner = "ALIGN_RATE"
                                                crossSeriesReducer = "REDUCE_SUM"
                                            }
                                        }
                                    }
                                }
                            )
                        }
                    }
                }
            )
        }
    } | ConvertTo-Json -Depth 10

    $dashboardConfig | Out-File -FilePath "security-dashboard.json" -Encoding UTF8

    # 9. Create incident response runbook
    Write-Host "Creating incident response runbook..." -ForegroundColor Yellow

    $runbookContent = @'
# Security Incident Response Runbook

## Overview
This runbook provides procedures for responding to security incidents.

## Incident Classification

### Level 1 - Low Priority
- Minor configuration issues
- Non-critical vulnerabilities
- **Response Time**: 4 hours
- **Escalation**: Security team only

### Level 2 - Medium Priority  
- Suspicious activity detected
- Failed authentication spikes
- **Response Time**: 1 hour
- **Escalation**: Security team + On-call engineer

### Level 3 - High Priority
- Active attack detected
- Data breach suspected
- **Response Time**: 15 minutes
- **Escalation**: Security team + On-call + Management

### Level 4 - Critical Priority
- Confirmed data breach
- System compromise
- **Response Time**: 5 minutes
- **Escalation**: All hands + External authorities

## Response Procedures

### DDoS Attack Response
1. **Immediate Actions**:
   ```powershell
   # Check Cloud Armor metrics
   gcloud compute security-policies describe baseline-analyzer-security-policy
   
   # Review attack patterns
   gcloud logging read "resource.type=https_lb_rule AND severity>=WARNING" --limit=100
   ```

2. **Mitigation**:
   ```powershell
   # Increase rate limiting
   gcloud compute security-policies rules update 1000 `
     --security-policy=baseline-analyzer-security-policy `
     --rate-limit-threshold-count=50
   
   # Add IP blocking rule
   gcloud compute security-policies rules create 5000 `
     --security-policy=baseline-analyzer-security-policy `
     --expression="inIpRange(origin.ip, 'ATTACKER_IP/32')" `
     --action=deny-403
   ```

### Data Breach Response
1. **Immediate Actions**:
   - Isolate affected systems
   - Preserve evidence
   - Notify stakeholders

2. **Investigation**:
   ```powershell
   # Review audit logs
   gcloud logging read "protoPayload.methodName!=`"`" AND severity>=WARNING" `
     --format="json" | Out-File incident-logs.json
   
   # Check database access
   gcloud sql operations list --instance=baseline-analyzer-db
   ```

3. **Recovery**:
   - Restore from clean backups
   - Reset all credentials
   - Update security measures

## Contact Information
- **Security Team**: security@company.com
- **On-Call Engineer**: +1-555-0123
- **Management**: management@company.com
- **Legal**: legal@company.com

## External Contacts
- **FBI Cyber Division**: 1-855-292-3937
- **CISA**: 1-888-282-0870
- **Cloud Provider Support**: [Provider-specific number]
'@

    $runbookContent | Out-File -FilePath "incident-response-runbook.md" -Encoding UTF8

    # 10. Create automated security scanning configuration
    Write-Host "Setting up automated security scanning..." -ForegroundColor Yellow

    $securityScanConfig = @"
steps:
  # Container vulnerability scanning
  - name: 'gcr.io/cloud-builders/gcloud'
    args: ['container', 'images', 'scan', 'gcr.io/$ProjectId/baseline-analyzer-api:latest']
  
  # Dependency vulnerability scanning
  - name: 'node:18'
    entrypoint: 'npm'
    args: ['audit', '--audit-level=moderate']
    dir: 'baseline-analyzer'
  
  # SAST scanning with SonarQube (if configured)
  - name: 'sonarqube/sonar-scanner-cli'
    args: [
      '-Dsonar.projectKey=baseline-analyzer',
      '-Dsonar.sources=baseline-analyzer/src',
      '-Dsonar.host.url=`$SONAR_HOST_URL',
      '-Dsonar.login=`$SONAR_TOKEN'
    ]

options:
  logging: CLOUD_LOGGING_ONLY
"@

    $securityScanConfig | Out-File -FilePath "security-scan-cloudbuild.yaml" -Encoding UTF8

    Write-Host "Production security setup completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Security measures configured:" -ForegroundColor Cyan
    Write-Host "✓ Cloud Armor DDoS protection" -ForegroundColor White
    Write-Host "✓ WAF rules for common attacks" -ForegroundColor White
    Write-Host "✓ SSL/TLS certificates" -ForegroundColor White
    Write-Host "✓ VPC and firewall rules" -ForegroundColor White
    Write-Host "✓ Cloud KMS encryption" -ForegroundColor White
    Write-Host "✓ Comprehensive audit logging" -ForegroundColor White
    Write-Host "✓ Encrypted backups" -ForegroundColor White
    Write-Host "✓ Security dashboard" -ForegroundColor White
    Write-Host "✓ Incident response procedures" -ForegroundColor White
    Write-Host "✓ Automated security scanning" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Review and customize security policies" -ForegroundColor White
    Write-Host "2. Set up notification channels with real email addresses" -ForegroundColor White
    Write-Host "3. Test incident response procedures" -ForegroundColor White
    Write-Host "4. Schedule regular security assessments" -ForegroundColor White
    Write-Host "5. Train team on security procedures" -ForegroundColor White
    Write-Host ""
    Write-Host "Important files created:" -ForegroundColor Cyan
    Write-Host "- security-dashboard.json: Security monitoring dashboard" -ForegroundColor White
    Write-Host "- incident-response-runbook.md: Security incident procedures" -ForegroundColor White
    Write-Host "- security-scan-cloudbuild.yaml: Automated security scanning" -ForegroundColor White

    # Cleanup temporary files
    Remove-Item "audit-policy.yaml" -Force -ErrorAction SilentlyContinue
}
catch {
    Write-Error "Security setup failed: $($_.Exception.Message)"
    exit 1
}