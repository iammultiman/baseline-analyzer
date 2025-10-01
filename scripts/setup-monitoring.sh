#!/bin/bash

# Production Monitoring and Alerting Setup Script
# This script sets up Cloud Monitoring dashboards, alerting policies, and uptime checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-""}
REGION=${GOOGLE_CLOUD_REGION:-"us-central1"}
SERVICE_NAME="baseline-analyzer-api"
ALERT_EMAIL=${ALERT_EMAIL:-"alerts@your-domain.com"}
SLACK_WEBHOOK=${SLACK_WEBHOOK:-""}

echo -e "${GREEN}🔍 Setting up production monitoring for Baseline Analyzer${NC}"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Alert Email: $ALERT_EMAIL"

# Validate prerequisites
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: GOOGLE_CLOUD_PROJECT environment variable is not set${NC}"
    exit 1
fi

if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    exit 1
fi

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}📋 Enabling required Google Cloud APIs...${NC}"
gcloud services enable monitoring.googleapis.com
gcloud services enable logging.googleapis.com
gcloud services enable clouderrorreporting.googleapis.com
gcloud services enable cloudtrace.googleapis.com
gcloud services enable cloudprofiler.googleapis.com

# Create notification channels
echo -e "${YELLOW}📧 Setting up notification channels...${NC}"

# Email notification channel
EMAIL_CHANNEL=$(gcloud alpha monitoring channels create \
    --display-name="Production Alerts Email" \
    --description="Email notifications for production alerts" \
    --type=email \
    --channel-labels=email_address=$ALERT_EMAIL \
    --format="value(name)" 2>/dev/null || echo "")

if [ -n "$EMAIL_CHANNEL" ]; then
    echo -e "${GREEN}✅ Created email notification channel: $EMAIL_CHANNEL${NC}"
else
    echo -e "${YELLOW}⚠️  Email notification channel may already exist${NC}"
    EMAIL_CHANNEL=$(gcloud alpha monitoring channels list \
        --filter="displayName:'Production Alerts Email'" \
        --format="value(name)" | head -1)
fi

# Slack notification channel (if webhook provided)
SLACK_CHANNEL=""
if [ -n "$SLACK_WEBHOOK" ]; then
    SLACK_CHANNEL=$(gcloud alpha monitoring channels create \
        --display-name="Production Alerts Slack" \
        --description="Slack notifications for production alerts" \
        --type=slack \
        --channel-labels=url=$SLACK_WEBHOOK \
        --format="value(name)" 2>/dev/null || echo "")
    
    if [ -n "$SLACK_CHANNEL" ]; then
        echo -e "${GREEN}✅ Created Slack notification channel: $SLACK_CHANNEL${NC}"
    fi
fi

# Create monitoring dashboard
echo -e "${YELLOW}📊 Creating monitoring dashboard...${NC}"

# Update dashboard configuration with project ID
sed "s/PROJECT_ID/$PROJECT_ID/g" config/monitoring-dashboard.json > /tmp/dashboard.json

DASHBOARD_ID=$(gcloud monitoring dashboards create --config-from-file=/tmp/dashboard.json --format="value(name)" 2>/dev/null || echo "")

if [ -n "$DASHBOARD_ID" ]; then
    echo -e "${GREEN}✅ Created monitoring dashboard: $DASHBOARD_ID${NC}"
    echo "Dashboard URL: https://console.cloud.google.com/monitoring/dashboards/custom/$DASHBOARD_ID?project=$PROJECT_ID"
else
    echo -e "${YELLOW}⚠️  Dashboard creation failed or already exists${NC}"
fi

# Create uptime checks
echo -e "${YELLOW}🔍 Setting up uptime checks...${NC}"

# API Health Check
API_UPTIME_CHECK=$(gcloud monitoring uptime create \
    --display-name="Baseline Analyzer API Health Check" \
    --http-check-path="/api/health" \
    --hostname="api-baseline-analyzer-$(echo $PROJECT_ID | tr '[:upper:]' '[:lower:]')-uc.a.run.app" \
    --use-ssl \
    --period=60 \
    --timeout=10s \
    --format="value(name)" 2>/dev/null || echo "")

if [ -n "$API_UPTIME_CHECK" ]; then
    echo -e "${GREEN}✅ Created API uptime check: $API_UPTIME_CHECK${NC}"
fi

# Frontend Health Check
FRONTEND_UPTIME_CHECK=$(gcloud monitoring uptime create \
    --display-name="Baseline Analyzer Frontend Health Check" \
    --http-check-path="/" \
    --hostname="baseline-analyzer.web.app" \
    --use-ssl \
    --period=300 \
    --timeout=10s \
    --format="value(name)" 2>/dev/null || echo "")

if [ -n "$FRONTEND_UPTIME_CHECK" ]; then
    echo -e "${GREEN}✅ Created frontend uptime check: $FRONTEND_UPTIME_CHECK${NC}"
fi

# Create alerting policies
echo -e "${YELLOW}🚨 Setting up alerting policies...${NC}"

# Function to create alerting policy
create_alert_policy() {
    local policy_name=$1
    local filter=$2
    local threshold=$3
    local duration=$4
    local comparison=$5
    local description=$6
    
    echo "Creating alert policy: $policy_name"
    
    cat > /tmp/alert_policy.yaml << EOF
displayName: "$policy_name"
documentation:
  content: "$description"
  mimeType: "text/markdown"
conditions:
  - displayName: "$policy_name Condition"
    conditionThreshold:
      filter: '$filter'
      comparison: $comparison
      thresholdValue: $threshold
      duration: ${duration}s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_SUM
combiner: OR
enabled: true
notificationChannels:
EOF

    if [ -n "$EMAIL_CHANNEL" ]; then
        echo "  - $EMAIL_CHANNEL" >> /tmp/alert_policy.yaml
    fi
    
    if [ -n "$SLACK_CHANNEL" ]; then
        echo "  - $SLACK_CHANNEL" >> /tmp/alert_policy.yaml
    fi
    
    gcloud alpha monitoring policies create --policy-from-file=/tmp/alert_policy.yaml 2>/dev/null || echo "Policy may already exist"
}

# High Error Rate Alert
create_alert_policy \
    "Baseline Analyzer - High Error Rate" \
    'resource.type="cloud_run_revision" AND resource.labels.service_name="'$SERVICE_NAME'" AND metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class!="2xx"' \
    "0.05" \
    "300" \
    "COMPARISON_GREATER_THAN" \
    "Alert when error rate exceeds 5% for 5 minutes"

# High Latency Alert
create_alert_policy \
    "Baseline Analyzer - High Response Latency" \
    'resource.type="cloud_run_revision" AND resource.labels.service_name="'$SERVICE_NAME'" AND metric.type="run.googleapis.com/request_latencies"' \
    "5000" \
    "300" \
    "COMPARISON_GREATER_THAN" \
    "Alert when 95th percentile response latency exceeds 5 seconds"

# High Memory Usage Alert
create_alert_policy \
    "Baseline Analyzer - High Memory Usage" \
    'resource.type="cloud_run_revision" AND resource.labels.service_name="'$SERVICE_NAME'" AND metric.type="run.googleapis.com/container/memory/utilizations"' \
    "0.85" \
    "600" \
    "COMPARISON_GREATER_THAN" \
    "Alert when memory utilization exceeds 85% for 10 minutes"

# Service Unavailable Alert (using uptime check)
if [ -n "$API_UPTIME_CHECK" ]; then
    create_alert_policy \
        "Baseline Analyzer - Service Unavailable" \
        'resource.type="uptime_check_id" AND resource.labels.check_id="'$(basename $API_UPTIME_CHECK)'" AND metric.type="monitoring.googleapis.com/uptime_check/check_passed"' \
        "0" \
        "180" \
        "COMPARISON_EQUAL" \
        "Alert when health check fails or service is unreachable"
fi

# Set up log-based metrics for custom alerts
echo -e "${YELLOW}📝 Setting up log-based metrics...${NC}"

# AI Provider Error Metric
gcloud logging metrics create ai_provider_errors \
    --description="Count of AI provider API errors" \
    --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="'$SERVICE_NAME'" AND (textPayload:"AI provider error" OR jsonPayload.error:"AI provider")' \
    --project=$PROJECT_ID 2>/dev/null || echo "Metric may already exist"

# Payment Processing Error Metric
gcloud logging metrics create payment_failures \
    --description="Count of payment processing failures" \
    --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="'$SERVICE_NAME'" AND (textPayload:"Payment failed" OR jsonPayload.error:"payment")' \
    --project=$PROJECT_ID 2>/dev/null || echo "Metric may already exist"

# Database Error Metric
gcloud logging metrics create database_errors \
    --description="Count of database connection errors" \
    --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="'$SERVICE_NAME'" AND (textPayload:"Database error" OR jsonPayload.error:"database")' \
    --project=$PROJECT_ID 2>/dev/null || echo "Metric may already exist"

# Clean up temporary files
rm -f /tmp/dashboard.json /tmp/alert_policy.yaml

echo -e "${GREEN}✅ Production monitoring setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Monitoring Summary:${NC}"
echo "Dashboard: https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
echo "Alerting: https://console.cloud.google.com/monitoring/alerting?project=$PROJECT_ID"
echo "Uptime Checks: https://console.cloud.google.com/monitoring/uptime?project=$PROJECT_ID"
echo "Logs: https://console.cloud.google.com/logs/query?project=$PROJECT_ID"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Verify uptime checks are working"
echo "2. Test alerting policies by triggering conditions"
echo "3. Configure additional notification channels if needed"
echo "4. Set up log aggregation and analysis"
echo "5. Configure custom metrics for business logic monitoring"
echo ""
echo -e "${YELLOW}🔧 Useful Commands:${NC}"
echo "List dashboards: gcloud monitoring dashboards list"
echo "List alert policies: gcloud alpha monitoring policies list"
echo "List uptime checks: gcloud monitoring uptime list"
echo "View logs: gcloud logging read 'resource.type=\"cloud_run_revision\"' --limit=50"