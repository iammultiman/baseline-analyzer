#!/bin/bash

# Production Secrets Validation Script
# This script validates that all required secrets are properly configured in Google Cloud Secret Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-""}

echo -e "${GREEN}🔍 Validating production secrets for Baseline Analyzer${NC}"
echo "Project ID: $PROJECT_ID"

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: GOOGLE_CLOUD_PROJECT environment variable is not set${NC}"
    exit 1
fi

# Required secrets list
REQUIRED_SECRETS=(
    "database-url"
    "database-password"
    "openai-api-key"
    "gemini-api-key"
    "claude-api-key"
    "qwen-api-key"
    "openrouter-api-key"
    "sendgrid-api-key"
    "smtp-username"
    "smtp-password"
    "stripe-secret-key"
    "stripe-webhook-secret"
    "paypal-client-secret"
    "jwt-secret"
    "session-secret"
    "api-encryption-key"
    "firebase-admin-key"
    "firebase-config"
    "gitingest-api-key"
    "webhook-signing-secret"
)

# Optional secrets (warnings only)
OPTIONAL_SECRETS=(
    "database-ssl-cert"
)

MISSING_SECRETS=()
EMPTY_SECRETS=()
VALID_SECRETS=()

echo -e "${YELLOW}📋 Checking required secrets...${NC}"

# Function to check if a secret exists and has a value
check_secret() {
    local secret_name=$1
    local is_required=$2
    
    # Check if secret exists
    if ! gcloud secrets describe $secret_name --project=$PROJECT_ID &>/dev/null; then
        if [ "$is_required" = "true" ]; then
            MISSING_SECRETS+=($secret_name)
            echo -e "${RED}❌ Missing: $secret_name${NC}"
        else
            echo -e "${YELLOW}⚠️  Optional missing: $secret_name${NC}"
        fi
        return 1
    fi
    
    # Check if secret has a value
    local secret_value=$(gcloud secrets versions access latest --secret=$secret_name --project=$PROJECT_ID 2>/dev/null || echo "")
    
    if [ -z "$secret_value" ]; then
        if [ "$is_required" = "true" ]; then
            EMPTY_SECRETS+=($secret_name)
            echo -e "${RED}❌ Empty: $secret_name${NC}"
        else
            echo -e "${YELLOW}⚠️  Optional empty: $secret_name${NC}"
        fi
        return 1
    else
        VALID_SECRETS+=($secret_name)
        echo -e "${GREEN}✅ Valid: $secret_name${NC}"
        return 0
    fi
}

# Check all required secrets
for secret in "${REQUIRED_SECRETS[@]}"; do
    check_secret $secret "true"
done

# Check optional secrets
echo -e "${YELLOW}📋 Checking optional secrets...${NC}"
for secret in "${OPTIONAL_SECRETS[@]}"; do
    check_secret $secret "false"
done

# Summary
echo ""
echo -e "${BLUE}📊 Validation Summary:${NC}"
echo "Valid secrets: ${#VALID_SECRETS[@]}"
echo "Missing secrets: ${#MISSING_SECRETS[@]}"
echo "Empty secrets: ${#EMPTY_SECRETS[@]}"

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ Missing Required Secrets:${NC}"
    for secret in "${MISSING_SECRETS[@]}"; do
        echo "  - $secret"
    done
fi

if [ ${#EMPTY_SECRETS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ Empty Required Secrets:${NC}"
    for secret in "${EMPTY_SECRETS[@]}"; do
        echo "  - $secret"
    done
fi

# Provide commands to fix missing/empty secrets
if [ ${#MISSING_SECRETS[@]} -gt 0 ] || [ ${#EMPTY_SECRETS[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}🔧 Commands to fix issues:${NC}"
    
    for secret in "${MISSING_SECRETS[@]}" "${EMPTY_SECRETS[@]}"; do
        echo "# Create/update $secret:"
        echo "gcloud secrets create $secret --replication-policy=automatic --project=$PROJECT_ID || true"
        echo "echo 'YOUR_SECRET_VALUE' | gcloud secrets versions add $secret --data-file=- --project=$PROJECT_ID"
        echo ""
    done
fi

# Check IAM permissions
echo -e "${YELLOW}🔐 Checking IAM permissions...${NC}"

APP_SA="baseline-analyzer@$PROJECT_ID.iam.gserviceaccount.com"

if gcloud iam service-accounts describe $APP_SA --project=$PROJECT_ID &>/dev/null; then
    echo -e "${GREEN}✅ Application service account exists: $APP_SA${NC}"
    
    # Check if service account has Secret Manager access
    if gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --format="table(bindings.role)" --filter="bindings.members:serviceAccount:$APP_SA AND bindings.role:roles/secretmanager.secretAccessor" | grep -q "secretmanager.secretAccessor"; then
        echo -e "${GREEN}✅ Service account has Secret Manager access${NC}"
    else
        echo -e "${RED}❌ Service account missing Secret Manager access${NC}"
        echo "Fix with: gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$APP_SA --role=roles/secretmanager.secretAccessor"
    fi
else
    echo -e "${RED}❌ Application service account not found: $APP_SA${NC}"
    echo "Create with: gcloud iam service-accounts create baseline-analyzer --project=$PROJECT_ID"
fi

# Final validation result
echo ""
if [ ${#MISSING_SECRETS[@]} -eq 0 ] && [ ${#EMPTY_SECRETS[@]} -eq 0 ]; then
    echo -e "${GREEN}🎉 All required secrets are properly configured!${NC}"
    exit 0
else
    echo -e "${RED}❌ Secrets validation failed. Please fix the issues above before deploying.${NC}"
    exit 1
fi