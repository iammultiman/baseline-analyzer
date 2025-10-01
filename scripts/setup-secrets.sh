#!/bin/bash

# Production Secrets Setup Script for Google Cloud Secret Manager
# This script sets up all required secrets for the Baseline Analyzer application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-""}
REGION=${GOOGLE_CLOUD_REGION:-"us-central1"}

echo -e "${GREEN}Setting up production secrets for Baseline Analyzer${NC}"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    exit 1
fi

# Check if project ID is set
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: GOOGLE_CLOUD_PROJECT environment variable is not set${NC}"
    exit 1
fi

# Enable required APIs
echo -e "${YELLOW}Enabling required Google Cloud APIs...${NC}"
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID
gcloud services enable sqladmin.googleapis.com --project=$PROJECT_ID
gcloud services enable run.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudfunctions.googleapis.com --project=$PROJECT_ID

# Function to create or update a secret
create_secret() {
    local secret_name=$1
    local secret_description=$2
    
    echo -e "${YELLOW}Creating secret: $secret_name${NC}"
    
    # Check if secret already exists
    if gcloud secrets describe $secret_name --project=$PROJECT_ID &>/dev/null; then
        echo "Secret $secret_name already exists, skipping creation"
    else
        gcloud secrets create $secret_name \
            --replication-policy="automatic" \
            --project=$PROJECT_ID \
            --labels="app=baseline-analyzer,env=production"
        echo -e "${GREEN}Created secret: $secret_name${NC}"
    fi
}

# Database Configuration Secrets
echo -e "${YELLOW}Setting up database secrets...${NC}"
create_secret "database-url" "Production database connection string"
create_secret "database-password" "Database user password"
create_secret "database-ssl-cert" "Database SSL certificate"

# AI Provider API Keys
echo -e "${YELLOW}Setting up AI provider secrets...${NC}"
create_secret "openai-api-key" "OpenAI API key for AI analysis"
create_secret "gemini-api-key" "Google Gemini API key"
create_secret "claude-api-key" "Anthropic Claude API key"
create_secret "qwen-api-key" "Qwen API key"
create_secret "openrouter-api-key" "OpenRouter API key"

# Email Service Configuration
echo -e "${YELLOW}Setting up email service secrets...${NC}"
create_secret "sendgrid-api-key" "SendGrid API key for email notifications"
create_secret "smtp-username" "SMTP username for email service"
create_secret "smtp-password" "SMTP password for email service"

# Payment Processor Configuration
echo -e "${YELLOW}Setting up payment processor secrets...${NC}"
create_secret "stripe-secret-key" "Stripe secret key for payment processing"
create_secret "stripe-webhook-secret" "Stripe webhook endpoint secret"
create_secret "paypal-client-secret" "PayPal client secret"

# Application Security Secrets
echo -e "${YELLOW}Setting up application security secrets...${NC}"
create_secret "jwt-secret" "JWT signing secret for authentication"
create_secret "session-secret" "Session encryption secret"
create_secret "api-encryption-key" "API key encryption secret"

# Firebase Configuration
echo -e "${YELLOW}Setting up Firebase secrets...${NC}"
create_secret "firebase-admin-key" "Firebase Admin SDK private key"
create_secret "firebase-config" "Firebase client configuration"

# External Service API Keys
echo -e "${YELLOW}Setting up external service secrets...${NC}"
create_secret "gitingest-api-key" "GitIngest API key for repository processing"
create_secret "webhook-signing-secret" "Webhook signature verification secret"

# Set up IAM permissions for Cloud Run and Cloud Functions
echo -e "${YELLOW}Setting up IAM permissions...${NC}"

# Get the default compute service account
COMPUTE_SA=$(gcloud iam service-accounts list --filter="email:*-compute@developer.gserviceaccount.com" --format="value(email)" --project=$PROJECT_ID)

if [ -n "$COMPUTE_SA" ]; then
    echo "Granting Secret Manager access to: $COMPUTE_SA"
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$COMPUTE_SA" \
        --role="roles/secretmanager.secretAccessor"
else
    echo -e "${YELLOW}Warning: Could not find default compute service account${NC}"
fi

# Create a dedicated service account for the application
APP_SA="baseline-analyzer@$PROJECT_ID.iam.gserviceaccount.com"
echo "Creating application service account: $APP_SA"

if ! gcloud iam service-accounts describe $APP_SA --project=$PROJECT_ID &>/dev/null; then
    gcloud iam service-accounts create baseline-analyzer \
        --display-name="Baseline Analyzer Application" \
        --description="Service account for Baseline Analyzer production deployment" \
        --project=$PROJECT_ID
fi

# Grant necessary permissions to the application service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$APP_SA" \
    --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$APP_SA" \
    --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$APP_SA" \
    --role="roles/storage.objectAdmin"

echo -e "${GREEN}✅ Production secrets setup completed successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Add secret values using: gcloud secrets versions add SECRET_NAME --data-file=path/to/secret"
echo "2. Or add via console: https://console.cloud.google.com/security/secret-manager"
echo "3. Update your Cloud Run service to use the baseline-analyzer service account"
echo "4. Configure environment variables to reference these secrets"
echo ""
echo -e "${YELLOW}Example secret value commands:${NC}"
echo "gcloud secrets versions add database-url --data-file=- <<< 'postgresql://user:pass@host:5432/db'"
echo "gcloud secrets versions add openai-api-key --data-file=- <<< 'sk-...'"
echo "gcloud secrets versions add stripe-secret-key --data-file=- <<< 'sk_live_...'"