#!/bin/bash

# Production Backup and Disaster Recovery Setup Script
# This script sets up automated backups and disaster recovery procedures

set -e

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"baseline-analyzer-prod"}
REGION=${GOOGLE_CLOUD_REGION:-"us-central1"}
DB_INSTANCE_NAME=${DB_INSTANCE_NAME:-"baseline-analyzer-db"}
BACKUP_BUCKET=${BACKUP_BUCKET:-"${PROJECT_ID}-backups"}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

echo "Setting up backup and disaster recovery for project: $PROJECT_ID"

# 1. Create backup storage bucket
echo "Creating backup storage bucket..."
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$BACKUP_BUCKET/ || echo "Bucket already exists"

# Set lifecycle policy for backup retention
cat > backup-lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": $BACKUP_RETENTION_DAYS}
      }
    ]
  }
}
EOF

gsutil lifecycle set backup-lifecycle.json gs://$BACKUP_BUCKET/
rm backup-lifecycle.json

# 2. Enable automated backups for Cloud SQL
echo "Configuring Cloud SQL automated backups..."
gcloud sql instances patch $DB_INSTANCE_NAME \
  --backup-start-time=02:00 \
  --backup-location=$REGION \
  --retained-backups-count=7 \
  --retained-transaction-log-days=7 \
  --enable-bin-log

# 3. Create backup export job
echo "Setting up database export job..."
cat > backup-export-job.yaml << EOF
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
              DATE=\$(date +%Y%m%d_%H%M%S)
              BACKUP_FILE="database_backup_\${DATE}.sql"
              
              # Export database
              gcloud sql export sql $DB_INSTANCE_NAME gs://$BACKUP_BUCKET/database/\$BACKUP_FILE \
                --database=baseline_analyzer
              
              # Export to different regions for disaster recovery
              gsutil cp gs://$BACKUP_BUCKET/database/\$BACKUP_FILE gs://$BACKUP_BUCKET-dr/database/\$BACKUP_FILE
              
              echo "Backup completed: \$BACKUP_FILE"
          restartPolicy: OnFailure
EOF

# 4. Create service account for backups
echo "Creating backup service account..."
gcloud iam service-accounts create backup-service-account \
  --display-name="Backup Service Account" \
  --description="Service account for automated backups" || echo "Service account already exists"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:backup-service-account@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:backup-service-account@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# 5. Create disaster recovery bucket in different region
DR_REGION="us-east1"
DR_BUCKET="${PROJECT_ID}-backups-dr"
echo "Creating disaster recovery bucket in $DR_REGION..."
gsutil mb -p $PROJECT_ID -c STANDARD -l $DR_REGION gs://$DR_BUCKET/ || echo "DR bucket already exists"

# 6. Set up cross-region replication
echo "Setting up cross-region replication..."
cat > replication-config.json << EOF
{
  "destination": "gs://$DR_BUCKET",
  "objectConditions": {
    "minTimeElapsedSinceLastModification": "15m"
  },
  "replicateDeletes": true
}
EOF

gsutil rewrite -r gs://$BACKUP_BUCKET gs://$DR_BUCKET

# 7. Create monitoring and alerting for backup failures
echo "Setting up backup monitoring..."
cat > backup-alert-policy.yaml << EOF
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
  - projects/$PROJECT_ID/notificationChannels/EMAIL_NOTIFICATION_CHANNEL
alertStrategy:
  autoClose: "86400s"
EOF

# 8. Create disaster recovery runbook
echo "Creating disaster recovery runbook..."
cat > disaster-recovery-runbook.md << 'EOF'
# Disaster Recovery Runbook

## Overview
This runbook provides step-by-step procedures for disaster recovery scenarios.

## Scenarios

### 1. Database Corruption/Loss
**Recovery Steps:**
1. Identify the latest valid backup:
   ```bash
   gsutil ls gs://BACKUP_BUCKET/database/ | sort | tail -5
   ```

2. Create new Cloud SQL instance:
   ```bash
   gcloud sql instances create baseline-analyzer-db-recovery \
     --database-version=POSTGRES_14 \
     --tier=db-custom-2-4096 \
     --region=us-central1
   ```

3. Import backup:
   ```bash
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
   ```bash
   gsutil ls gs://BACKUP_BUCKET-dr/database/ | sort | tail -1
   ```
4. Update DNS to point to DR region
5. Monitor application health

### 3. Application Deployment Failure
**Recovery Steps:**
1. Rollback to previous Cloud Run revision:
   ```bash
   gcloud run services update-traffic baseline-analyzer-api \
     --to-revisions=PREVIOUS_REVISION=100 \
     --region=us-central1
   ```

2. If rollback fails, deploy from backup:
   ```bash
   gcloud run deploy baseline-analyzer-api \
     --image=gcr.io/PROJECT_ID/baseline-analyzer-api:STABLE_TAG \
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
EOF

# 9. Create backup validation script
echo "Creating backup validation script..."
cat > validate-backups.sh << 'EOF'
#!/bin/bash

# Backup Validation Script
# Tests backup integrity and restoration procedures

set -e

PROJECT_ID=${GOOGLE_CLOUD_PROJECT}
BACKUP_BUCKET="${PROJECT_ID}-backups"
TEST_INSTANCE="backup-test-$(date +%s)"

echo "Starting backup validation..."

# Get latest backup
LATEST_BACKUP=$(gsutil ls gs://$BACKUP_BUCKET/database/ | sort | tail -1)
echo "Testing backup: $LATEST_BACKUP"

# Create test instance
echo "Creating test instance..."
gcloud sql instances create $TEST_INSTANCE \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --no-backup

# Import backup
echo "Importing backup..."
gcloud sql import sql $TEST_INSTANCE $LATEST_BACKUP

# Validate data integrity
echo "Validating data integrity..."
gcloud sql connect $TEST_INSTANCE --user=postgres << 'SQL'
\c baseline_analyzer
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM organizations;
SELECT COUNT(*) FROM repository_analyses;
\q
SQL

# Cleanup
echo "Cleaning up test instance..."
gcloud sql instances delete $TEST_INSTANCE --quiet

echo "Backup validation completed successfully!"
EOF

chmod +x validate-backups.sh

# 10. Set up log backup
echo "Setting up log backup..."
cat > log-backup-job.yaml << EOF
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
              DATE=\$(date +%Y%m%d)
              YESTERDAY=\$(date -d "yesterday" +%Y%m%d)
              
              # Export application logs
              gcloud logging read "timestamp>=\\"\${YESTERDAY}T00:00:00Z\\" AND timestamp<\\"\${DATE}T00:00:00Z\\"" \
                --format="json" > /tmp/app_logs_\${YESTERDAY}.json
              
              # Upload to backup bucket
              gsutil cp /tmp/app_logs_\${YESTERDAY}.json gs://$BACKUP_BUCKET/logs/
              
              echo "Log backup completed for \$YESTERDAY"
          restartPolicy: OnFailure
EOF

echo "Backup and disaster recovery setup completed!"
echo ""
echo "Next steps:"
echo "1. Apply Kubernetes jobs: kubectl apply -f backup-export-job.yaml"
echo "2. Apply log backup job: kubectl apply -f log-backup-job.yaml"
echo "3. Set up monitoring alert policy"
echo "4. Schedule regular backup validation tests"
echo "5. Review and customize disaster recovery runbook"
echo ""
echo "Important files created:"
echo "- backup-export-job.yaml: Automated database backup job"
echo "- log-backup-job.yaml: Automated log backup job"
echo "- disaster-recovery-runbook.md: Recovery procedures"
echo "- validate-backups.sh: Backup validation script"