#!/bin/bash

# Security Configuration Validation Script
# This script validates that all security measures are properly configured

set -e

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"baseline-analyzer-prod"}
REGION=${GOOGLE_CLOUD_REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"baseline-analyzer-api"}
DOMAIN=${DOMAIN:-"baseline-analyzer.web.app"}

echo "Validating security configuration for project: $PROJECT_ID"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation functions
validate_check() {
    local check_name="$1"
    local command="$2"
    local expected="$3"
    
    echo -n "Checking $check_name... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        return 1
    fi
}

validate_output() {
    local check_name="$1"
    local command="$2"
    local expected="$3"
    
    echo -n "Checking $check_name... "
    
    local output=$(eval "$command" 2>/dev/null || echo "")
    
    if [[ "$output" == *"$expected"* ]]; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo -e "${YELLOW}  Expected: $expected${NC}"
        echo -e "${YELLOW}  Got: $output${NC}"
        return 1
    fi
}

# Initialize counters
TOTAL_CHECKS=0
PASSED_CHECKS=0

# 1. Cloud Armor Security Policy
echo -e "\n${YELLOW}1. Cloud Armor Security Policy${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Security policy exists" "gcloud compute security-policies describe baseline-analyzer-security-policy --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_output "Rate limiting rule" "gcloud compute security-policies rules list baseline-analyzer-security-policy --project=$PROJECT_ID" "1000"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_output "SQL injection protection" "gcloud compute security-policies rules list baseline-analyzer-security-policy --project=$PROJECT_ID" "sqli-stable"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_output "XSS protection" "gcloud compute security-policies rules list baseline-analyzer-security-policy --project=$PROJECT_ID" "xss-stable"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# 2. SSL/TLS Configuration
echo -e "\n${YELLOW}2. SSL/TLS Configuration${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "SSL certificate exists" "gcloud compute ssl-certificates describe baseline-analyzer-ssl-cert --global --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_output "SSL certificate status" "gcloud compute ssl-certificates describe baseline-analyzer-ssl-cert --global --project=$PROJECT_ID --format='value(managed.status)'" "ACTIVE"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# 3. VPC and Firewall Rules
echo -e "\n${YELLOW}3. VPC and Firewall Rules${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "VPC network exists" "gcloud compute networks describe baseline-analyzer-vpc --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Subnet exists" "gcloud compute networks subnets describe baseline-analyzer-subnet --region=$REGION --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "HTTPS firewall rule" "gcloud compute firewall-rules describe baseline-analyzer-allow-https --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# 4. Cloud KMS Encryption
echo -e "\n${YELLOW}4. Cloud KMS Encryption${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Key ring exists" "gcloud kms keyrings describe baseline-analyzer-keyring --location=global --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Database encryption key" "gcloud kms keys describe database-encryption-key --keyring=baseline-analyzer-keyring --location=global --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "API encryption key" "gcloud kms keys describe api-encryption-key --keyring=baseline-analyzer-keyring --location=global --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Backup encryption key" "gcloud kms keys describe backup-encryption-key --keyring=baseline-analyzer-keyring --location=global --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# 5. Audit Logging
echo -e "\n${YELLOW}5. Audit Logging${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Audit log sink exists" "gcloud logging sinks describe baseline-analyzer-audit-sink --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# 6. Backup Security
echo -e "\n${YELLOW}6. Backup Security${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Secure backup bucket exists" "gsutil ls gs://$PROJECT_ID-secure-backups/"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_output "Backup bucket encryption" "gsutil kms encryption gs://$PROJECT_ID-secure-backups/" "baseline-analyzer-keyring"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# 7. Cloud Run Security
echo -e "\n${YELLOW}7. Cloud Run Security${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Cloud Run service exists" "gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_output "Service account configured" "gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --format='value(spec.template.spec.serviceAccountName)'" "baseline-analyzer"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# 8. Database Security
echo -e "\n${YELLOW}8. Database Security${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Database instance exists" "gcloud sql instances describe baseline-analyzer-db --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_output "Database SSL required" "gcloud sql instances describe baseline-analyzer-db --project=$PROJECT_ID --format='value(settings.ipConfiguration.requireSsl)'" "True"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_output "Database backups enabled" "gcloud sql instances describe baseline-analyzer-db --project=$PROJECT_ID --format='value(settings.backupConfiguration.enabled)'" "True"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# 9. Application Security Headers Test
echo -e "\n${YELLOW}9. Application Security Headers${NC}"
if command -v curl > /dev/null 2>&1; then
    APP_URL="https://$DOMAIN"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if validate_output "X-Content-Type-Options header" "curl -s -I $APP_URL | grep -i x-content-type-options" "nosniff"; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    fi
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if validate_output "X-Frame-Options header" "curl -s -I $APP_URL | grep -i x-frame-options" "DENY"; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    fi
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if validate_output "Strict-Transport-Security header" "curl -s -I $APP_URL | grep -i strict-transport-security" "max-age"; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    fi
else
    echo -e "${YELLOW}Skipping HTTP header tests (curl not available)${NC}"
fi

# 10. Secret Management
echo -e "\n${YELLOW}10. Secret Management${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Secret Manager API enabled" "gcloud services list --enabled --filter='name:secretmanager.googleapis.com' --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# Check for critical secrets
CRITICAL_SECRETS=("database-url" "jwt-secret" "api-encryption-key")
for secret in "${CRITICAL_SECRETS[@]}"; do
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if validate_check "Secret $secret exists" "gcloud secrets describe $secret --project=$PROJECT_ID"; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    fi
done

# 11. IAM Security
echo -e "\n${YELLOW}11. IAM Security${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Service account exists" "gcloud iam service-accounts describe baseline-analyzer@$PROJECT_ID.iam.gserviceaccount.com --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# 12. Monitoring and Alerting
echo -e "\n${YELLOW}12. Monitoring and Alerting${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Monitoring API enabled" "gcloud services list --enabled --filter='name:monitoring.googleapis.com' --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Logging API enabled" "gcloud services list --enabled --filter='name:logging.googleapis.com' --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# 13. Container Security
echo -e "\n${YELLOW}13. Container Security${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_check "Container Analysis API enabled" "gcloud services list --enabled --filter='name:containeranalysis.googleapis.com' --project=$PROJECT_ID"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# 14. Network Security
echo -e "\n${YELLOW}14. Network Security${NC}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if validate_output "Private Google Access enabled" "gcloud compute networks subnets describe baseline-analyzer-subnet --region=$REGION --project=$PROJECT_ID --format='value(privateIpGoogleAccess)'" "True"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# Summary
echo -e "\n${YELLOW}Security Validation Summary${NC}"
echo "=========================="
echo "Total checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$((TOTAL_CHECKS - PASSED_CHECKS))${NC}"

PASS_PERCENTAGE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
echo "Pass rate: $PASS_PERCENTAGE%"

if [ $PASS_PERCENTAGE -ge 90 ]; then
    echo -e "\n${GREEN}✓ Security configuration is excellent!${NC}"
    exit 0
elif [ $PASS_PERCENTAGE -ge 80 ]; then
    echo -e "\n${YELLOW}⚠ Security configuration is good but needs improvement.${NC}"
    exit 0
elif [ $PASS_PERCENTAGE -ge 70 ]; then
    echo -e "\n${YELLOW}⚠ Security configuration needs significant improvement.${NC}"
    exit 1
else
    echo -e "\n${RED}✗ Security configuration is inadequate. Immediate action required.${NC}"
    exit 1
fi