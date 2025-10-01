# Production Backup and Disaster Recovery Setup Script (PowerShell)
# This script sets up automated backups and disaster recovery procedures

param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT ?? "baseline-analyzer-prod",
    [string]$Region = $env:GOOGLE_CLOUD_REGION ?? "us-central1",
    [string]$DbInstanceName = $env:DB_INSTANCE_NAME ?? "baseline-analyzer-db",
    [string]$BackupBucket = "$ProjectId-backups",
    [int]$BackupRetentionDays = 30
)

Write-Host "Setting up backup and disaster recovery for project: $ProjectId" -ForegroundColor Green

try {
    # 1. Create backup storage bucket
    Write-Host "Creating backup storage bucket..." -ForegroundColor Yellow
    try {
        gsutil mb -p $ProjectId -c STANDARD -l $Region "gs://$BackupBucket/"
    }
    catch {
        Write-Host "Bucket already exists or creation failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    # Set lifecycle policy for backup retention
    $lifecycleConfig = @{
        lifecycle = @{
            rule = @(
                @{
                    action = @{ type = "Delete" }
                    condition = @{ age = $BackupRetentionDays }
                }
            )
        }
    } | ConvertTo-Json -Depth 10

    $lifecycleConfig | Out-File -FilePath "backup-lifecycle.json" -Encoding UTF8
    gsutil lifecycle set backup-lifecycle.json "gs://$BackupBucket/"
    Remove-Item "backup-lifecycle.json" -Force

    # 2. Enable automated backups for Cloud SQL
    Write-Host "Configuring Cloud SQL automated backups..." -ForegroundColor Yellow
    gcloud sql instances patch $DbInstanceName `
        --backup-start-time=02:00 `
        --backup-location=$Region `
        --retained-backups-count=7 `
        --retained-transaction-log-days=7 `
        --enable-bin-log

    # 3. Create backup export job
    Write-Host "Setting up database export job..." -ForegroundColor Yellow
    $backupJobYaml = @"
apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup-export
  namespace: default
spec:
  schedule: "0 3 * * *"  # Daily at 3 AM
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: backup-service-account
          containers:
          - name: backup-exporter
            image: gcr.io/google.com/cloudsdktool/cloud-sdk:latest
            command:
            - /bin/bash
            - -c
            - |
              DATE=`$(date +%Y%m%d_%H%M%S)
              BACKUP_FILE="database_backup_`${DATE}.sql"
              
              # Export database
              gcloud sql export sql $DbInstanceName gs://$BackupBucket/database/`$BACKUP_FILE \
                --database=baseline_analyzer
              
              # Export to different regions for disaster recovery
              gsutil cp gs://$BackupBucket/database/`$BACKUP_FILE gs://$BackupBucket-dr/database/`$BACKUP_FILE
              
              echo "Backup completed: `$BACKUP_FILE"
          restartPolicy: OnFailure
"@

    $backupJobYaml | Out-File -FilePath "backup-export-job.yaml" -Encoding UTF8

    # 4. Create service account for backups
    Write-Host "Creating backup service account..." -ForegroundColor Yellow
    try {
        gcloud iam service-accounts create backup-service-account `
            --display-name="Backup Service Account" `
            --description="Service account for automated backups"
    }
    catch {
        Write-Host "Service account already exists" -ForegroundColor Yellow
    }

    # Grant necessary permissions
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:backup-service-account@$ProjectId.iam.gserviceaccount.com" `
        --role="roles/cloudsql.admin"

    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:backup-service-account@$ProjectId.iam.gserviceaccount.com" `
        --role="roles/storage.admin"

    # 5. Create disaster recovery bucket in different region
    $drRegion = "us-east1"
    $drBucket = "$ProjectId-backups-dr"
    Write-Host "Creating disaster recovery bucket in $drRegion..." -ForegroundColor Yellow
    try {
        gsutil mb -p $ProjectId -c STANDARD -l $drRegion "gs://$drBucket/"
    }
    catch {
        Write-Host "DR bucket already exists" -ForegroundColor Yellow
    }

    # 6. Create disaster recovery runbook
    Write-Host "Creating disaster recovery runbook..." -ForegroundColor Yellow
    $runbookContent = @'
# Disaster Recovery Runbook

## Overview
This runbook provides step-by-step procedures for disaster recovery scenarios.

## Scenarios

### 1. Database Corruption/Loss
**Recovery Steps:**
1. Identify the latest valid backup:
   ```powershell
   gsutil ls gs://BACKUP_BUCKET/database/ | Sort-Object | Select-Object -Last 5
   ```

2. Create new Cloud SQL instance:
   ```powershell
   gcloud sql instances create baseline-analyzer-db-recovery `
     --database-version=POSTGRES_14 `
     --tier=db-custom-2-4096 `
     --region=us-central1
   ```

3. Import backup:
   ```powershell
   gcloud sql import sql baseline-analyzer-db-recovery gs://BACKUP_BUCKET/database/BACKUP_FILE.sql
   ```

4. Update application configuration to use recovery instance
5. Test application functionality
6. Switch DNS/load balancer to recovery instance

### 2. Complete Region Failure
**Recovery Steps:**
1. Deploy application to disaster recovery region (us-east1)
2. Create Cloud SQL instance in DR region
3. Import latest backup from DR bucket:
   ```powershell
   gsutil ls gs://BACKUP_BUCKET-dr/database/ | Sort-Object | Select-Object -Last 1
   ```
4. Update DNS to point to DR region
5. Monitor application health

### 3. Application Deployment Failure
**Recovery Steps:**
1. Rollback to previous Cloud Run revision:
   ```powershell
   gcloud run services update-traffic baseline-analyzer-api `
     --to-revisions=PREVIOUS_REVISION=100 `
     --region=us-central1
   ```

2. If rollback fails, deploy from backup:
   ```powershell
   gcloud run deploy baseline-analyzer-api `
     --image=gcr.io/PROJECT_ID/baseline-analyzer-api:STABLE_TAG `
     --region=us-central1
   ```

### 4. Data Center Outage
**Recovery Steps:**
1. Activate disaster recovery site
2. Update DNS records to point to DR region
3. Scale up DR resources
4. Monitor and validate functionality
5. Communicate status to users

## Recovery Time Objectives (RTO)
- Database recovery: 2 hours
- Application recovery: 30 minutes
- Full disaster recovery: 4 hours

## Recovery Point Objectives (RPO)
- Database: 24 hours (daily backups)
- Application state: 1 hour (continuous replication)

## Testing Schedule
- Monthly: Backup restoration test
- Quarterly: Full disaster recovery drill
- Annually: Complete failover test

## Contact Information
- On-call engineer: [PHONE]
- Database admin: [PHONE]
- Infrastructure team: [EMAIL]
'@

    $runbookContent | Out-File -FilePath "disaster-recovery-runbook.md" -Encoding UTF8

    # 7. Create backup validation script (PowerShell)
    Write-Host "Creating backup validation script..." -ForegroundColor Yellow
    $validationScript = @'
# Backup Validation Script (PowerShell)
# Tests backup integrity and restoration procedures

param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$BackupBucket = "$ProjectId-backups"
)

Write-Host "Starting backup validation..." -ForegroundColor Green

try {
    # Get latest backup
    $latestBackup = gsutil ls "gs://$BackupBucket/database/" | Sort-Object | Select-Object -Last 1
    Write-Host "Testing backup: $latestBackup" -ForegroundColor Yellow

    # Create test instance
    $testInstance = "backup-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
    Write-Host "Creating test instance: $testInstance..." -ForegroundColor Yellow
    
    gcloud sql instances create $testInstance `
        --database-version=POSTGRES_14 `
        --tier=db-f1-micro `
        --region=us-central1 `
        --no-backup

    # Import backup
    Write-Host "Importing backup..." -ForegroundColor Yellow
    gcloud sql import sql $testInstance $latestBackup

    # Validate data integrity
    Write-Host "Validating data integrity..." -ForegroundColor Yellow
    $sqlCommands = @"
\c baseline_analyzer
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM organizations;
SELECT COUNT(*) FROM repository_analyses;
\q
"@

    $sqlCommands | gcloud sql connect $testInstance --user=postgres

    # Cleanup
    Write-Host "Cleaning up test instance..." -ForegroundColor Yellow
    gcloud sql instances delete $testInstance --quiet

    Write-Host "Backup validation completed successfully!" -ForegroundColor Green
}
catch {
    Write-Error "Backup validation failed: $($_.Exception.Message)"
    # Cleanup on failure
    try {
        gcloud sql instances delete $testInstance --quiet
    }
    catch {
        Write-Warning "Failed to cleanup test instance: $testInstance"
    }
}
'@

    $validationScript | Out-File -FilePath "validate-backups.ps1" -Encoding UTF8

    # 8. Set up log backup job
    Write-Host "Setting up log backup..." -ForegroundColor Yellow
    $logBackupYaml = @"
apiVersion: batch/v1
kind: CronJob
metadata:
  name: log-backup-export
  namespace: default
spec:
  schedule: "0 4 * * *"  # Daily at 4 AM
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: backup-service-account
          containers:
          - name: log-exporter
            image: gcr.io/google.com/cloudsdktool/cloud-sdk:latest
            command:
            - /bin/bash
            - -c
            - |
              DATE=`$(date +%Y%m%d)
              YESTERDAY=`$(date -d "yesterday" +%Y%m%d)
              
              # Export application logs
              gcloud logging read "timestamp>=\\"`${YESTERDAY}T00:00:00Z\\" AND timestamp<\\"`${DATE}T00:00:00Z\\"" \
                --format="json" > /tmp/app_logs_`${YESTERDAY}.json
              
              # Upload to backup bucket
              gsutil cp /tmp/app_logs_`${YESTERDAY}.json gs://$BackupBucket/logs/
              
              echo "Log backup completed for `$YESTERDAY"
          restartPolicy: OnFailure
"@

    $logBackupYaml | Out-File -FilePath "log-backup-job.yaml" -Encoding UTF8

    # 9. Create backup monitoring alert policy
    $alertPolicyYaml = @"
displayName: "Database Backup Failure Alert"
conditions:
  - displayName: "Backup job failed"
    conditionThreshold:
      filter: 'resource.type="k8s_job" AND resource.labels.job_name="database-backup-export"'
      comparison: COMPARISON_EQUAL
      thresholdValue: 1
      duration: "300s"
      aggregations:
        - alignmentPeriod: "300s"
          perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_SUM
notificationChannels:
  - projects/$ProjectId/notificationChannels/EMAIL_NOTIFICATION_CHANNEL
alertStrategy:
  autoClose: "86400s"
"@

    $alertPolicyYaml | Out-File -FilePath "backup-alert-policy.yaml" -Encoding UTF8

    Write-Host "Backup and disaster recovery setup completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Apply Kubernetes jobs: kubectl apply -f backup-export-job.yaml" -ForegroundColor White
    Write-Host "2. Apply log backup job: kubectl apply -f log-backup-job.yaml" -ForegroundColor White
    Write-Host "3. Set up monitoring alert policy" -ForegroundColor White
    Write-Host "4. Schedule regular backup validation tests: .\validate-backups.ps1" -ForegroundColor White
    Write-Host "5. Review and customize disaster recovery runbook" -ForegroundColor White
    Write-Host ""
    Write-Host "Important files created:" -ForegroundColor Cyan
    Write-Host "- backup-export-job.yaml: Automated database backup job" -ForegroundColor White
    Write-Host "- log-backup-job.yaml: Automated log backup job" -ForegroundColor White
    Write-Host "- disaster-recovery-runbook.md: Recovery procedures" -ForegroundColor White
    Write-Host "- validate-backups.ps1: Backup validation script" -ForegroundColor White
    Write-Host "- backup-alert-policy.yaml: Monitoring alert configuration" -ForegroundColor White
}
catch {
    Write-Error "Setup failed: $($_.Exception.Message)"
    exit 1
}