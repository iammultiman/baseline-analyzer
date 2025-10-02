#!/bin/bash

# Production Environment Validation Script
# This script validates the production environment configuration

set -e

ENVIRONMENT=${1:-production}
VERBOSE=${VERBOSE:-false}
SKIP_TESTS=${SKIP_TESTS:-false}

echo "🔍 Starting Production Environment Validation..."
echo "Environment: $ENVIRONMENT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Function to check if environment variable exists and is not empty
check_env_var() {
    local var_name=$1
    local required=${2:-true}
    
    if [ -z "${!var_name}" ]; then
        if [ "$required" = true ]; then
            echo -e "${RED}❌ Missing required environment variable: $var_name${NC}"
            return 1
        else
            echo -e "${YELLOW}⚠️  Optional environment variable not set: $var_name${NC}"
            return 0
        fi
    else
        echo -e "${GREEN}✅ $var_name is configured${NC}"
        if [ "$VERBOSE" = true ]; then
            if [[ $var_name =~ (KEY|SECRET|PASSWORD|TOKEN) ]]; then
                masked_value="${!var_name:0:8}..."
            else
                masked_value="${!var_name}"
            fi
            echo -e "${GRAY}   Value: $masked_value${NC}"
        fi
        return 0
    fi
}

# Function to test database connectivity
test_database_connectivity() {
    echo -e "${BLUE}🔍 Testing database connectivity...${NC}"
    
    if npm run db:test-connection > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
        return 0
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        return 1
    fi
}

# Function to test AI provider connectivity
test_ai_providers() {
    echo -e "${BLUE}🔍 Testing AI provider connectivity...${NC}"
    
    local providers=("openai" "gemini" "anthropic" "openrouter")
    local all_valid=true
    
    for provider in "${providers[@]}"; do
        if npm run test:ai-provider -- --provider="$provider" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $provider provider is accessible${NC}"
        else
            echo -e "${RED}❌ $provider provider failed${NC}"
            all_valid=false
        fi
    done
    
    if [ "$all_valid" = true ]; then
        return 0
    else
        return 1
    fi
}

# Function to test email service
test_email_service() {
    echo -e "${BLUE}🔍 Testing email service...${NC}"
    
    if npm run test:email-service > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Email service is configured and working${NC}"
        return 0
    else
        echo -e "${RED}❌ Email service test failed${NC}"
        return 1
    fi
}

# Function to test payment processing
test_payment_processing() {
    echo -e "${BLUE}🔍 Testing payment processing...${NC}"
    
    if npm run test:payment-service > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Payment processing is configured and working${NC}"
        return 0
    else
        echo -e "${RED}❌ Payment processing test failed${NC}"
        return 1
    fi
}

# Function to validate security configuration
test_security_configuration() {
    echo -e "${BLUE}🔍 Validating security configuration...${NC}"
    
    local security_valid=true
    
    # Check CORS configuration
    if [ -z "$ALLOWED_ORIGINS" ]; then
        echo -e "${RED}❌ ALLOWED_ORIGINS not configured${NC}"
        security_valid=false
    else
        echo -e "${GREEN}✅ CORS origins configured${NC}"
    fi
    
    # Check rate limiting
    if [ -z "$RATE_LIMIT_WINDOW_MS" ] || [ -z "$RATE_LIMIT_MAX_REQUESTS" ]; then
        echo -e "${RED}❌ Rate limiting not properly configured${NC}"
        security_valid=false
    else
        echo -e "${GREEN}✅ Rate limiting configured${NC}"
    fi
    
    # Check JWT secret strength
    if [ -z "$NEXTAUTH_SECRET" ] || [ ${#NEXTAUTH_SECRET} -lt 32 ]; then
        echo -e "${RED}❌ JWT secret is too weak or missing${NC}"
        security_valid=false
    else
        echo -e "${GREEN}✅ JWT secret is properly configured${NC}"
    fi
    
    if [ "$security_valid" = true ]; then
        return 0
    else
        return 1
    fi
}

# Main validation process
declare -A validation_results

echo -e "\n${BLUE}📋 Validating Environment Variables...${NC}"
env_vars_valid=true

# Required environment variables
required_vars=(
    "DATABASE_URL"
    "NEXTAUTH_SECRET"
    "NEXTAUTH_URL"
    "FIREBASE_PROJECT_ID"
    "FIREBASE_CLIENT_EMAIL"
    "FIREBASE_PRIVATE_KEY"
    "GOOGLE_CLOUD_PROJECT_ID"
    "OPENAI_API_KEY"
    "GEMINI_API_KEY"
    "ANTHROPIC_API_KEY"
    "OPENROUTER_API_KEY"
    "SENDGRID_API_KEY"
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
)

for var in "${required_vars[@]}"; do
    if ! check_env_var "$var"; then
        env_vars_valid=false
    fi
done

validation_results["Environment Variables"]=$env_vars_valid

# Test database connectivity
echo -e "\n${BLUE}📋 Testing Database...${NC}"
if test_database_connectivity; then
    validation_results["Database"]=true
else
    validation_results["Database"]=false
fi

# Test AI providers
echo -e "\n${BLUE}📋 Testing AI Providers...${NC}"
if test_ai_providers; then
    validation_results["AI Providers"]=true
else
    validation_results["AI Providers"]=false
fi

# Test email service
echo -e "\n${BLUE}📋 Testing Email Service...${NC}"
if test_email_service; then
    validation_results["Email Service"]=true
else
    validation_results["Email Service"]=false
fi

# Test payment processing
echo -e "\n${BLUE}📋 Testing Payment Processing...${NC}"
if test_payment_processing; then
    validation_results["Payment Processing"]=true
else
    validation_results["Payment Processing"]=false
fi

# Test security configuration
echo -e "\n${BLUE}📋 Testing Security Configuration...${NC}"
if test_security_configuration; then
    validation_results["Security"]=true
else
    validation_results["Security"]=false
fi

# Run comprehensive tests if not skipped
if [ "$SKIP_TESTS" != true ]; then
    echo -e "\n${BLUE}📋 Running Comprehensive Tests...${NC}"
    if npm run test:production > /dev/null 2>&1; then
        echo -e "${GREEN}✅ All production tests passed${NC}"
        validation_results["Comprehensive Tests"]=true
    else
        echo -e "${RED}❌ Some production tests failed${NC}"
        validation_results["Comprehensive Tests"]=false
    fi
fi

# Summary
echo -e "\n${BLUE}📊 Validation Summary:${NC}"
echo -e "${BLUE}===================${NC}"

all_passed=true
for key in "${!validation_results[@]}"; do
    if [ "${validation_results[$key]}" = true ]; then
        echo -e "${GREEN}$key: ✅ PASS${NC}"
    else
        echo -e "${RED}$key: ❌ FAIL${NC}"
        all_passed=false
    fi
done

echo ""
if [ "$all_passed" = true ]; then
    echo -e "${GREEN}🎉 Production environment validation completed successfully!${NC}"
    echo -e "${GREEN}Your environment is ready for production deployment.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Production environment validation failed!${NC}"
    echo -e "${RED}Please fix the issues above before deploying to production.${NC}"
    exit 1
fi