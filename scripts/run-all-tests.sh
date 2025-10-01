#!/bin/bash

# Baseline Analyzer - Comprehensive Test Runner
# This script runs all test suites in the correct order

set -e  # Exit on any error

echo "🧪 Starting Baseline Analyzer Test Suite"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
UNIT_TESTS_PASSED=false
INTEGRATION_TESTS_PASSED=false
E2E_TESTS_PASSED=false
SECURITY_TESTS_PASSED=false

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "info")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        "success")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "error")
            echo -e "${RED}❌ $message${NC}"
            ;;
    esac
}

# Function to run a test suite
run_test_suite() {
    local suite_name=$1
    local command=$2
    local required=${3:-true}
    
    print_status "info" "Running $suite_name..."
    
    if eval "$command"; then
        print_status "success" "$suite_name passed"
        return 0
    else
        if [ "$required" = true ]; then
            print_status "error" "$suite_name failed (required)"
            return 1
        else
            print_status "warning" "$suite_name failed (optional)"
            return 0
        fi
    fi
}

# Check if required environment variables are set
check_environment() {
    print_status "info" "Checking environment..."
    
    if [ -z "$DATABASE_URL" ]; then
        export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/baseline_analyzer_test"
        print_status "warning" "DATABASE_URL not set, using default: $DATABASE_URL"
    fi
    
    if [ -z "$NODE_ENV" ]; then
        export NODE_ENV="test"
        print_status "info" "NODE_ENV set to: $NODE_ENV"
    fi
    
    print_status "success" "Environment check complete"
}

# Setup test database
setup_database() {
    print_status "info" "Setting up test database..."
    
    # Check if PostgreSQL is running
    if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        print_status "warning" "PostgreSQL not running locally, skipping database setup"
        return 0
    fi
    
    # Run database migrations
    if npm run db:migrate:deploy; then
        print_status "success" "Database migrations completed"
    else
        print_status "error" "Database migrations failed"
        return 1
    fi
    
    # Seed test data
    if npm run db:seed; then
        print_status "success" "Test data seeded"
    else
        print_status "warning" "Test data seeding failed (continuing anyway)"
    fi
}

# Cleanup function
cleanup() {
    print_status "info" "Cleaning up test artifacts..."
    
    # Remove test artifacts
    rm -rf coverage/ test-results/ playwright-report/ .nyc_output/
    
    print_status "success" "Cleanup complete"
}

# Main test execution
main() {
    echo
    print_status "info" "Starting test execution..."
    
    # Check environment
    check_environment
    
    # Setup database if available
    setup_database || true  # Don't fail if database setup fails
    
    echo
    print_status "info" "Phase 1: Unit Tests"
    echo "-------------------"
    
    if run_test_suite "Unit Tests" "npm run test -- --coverage --watchAll=false --passWithNoTests"; then
        UNIT_TESTS_PASSED=true
    fi
    
    echo
    print_status "info" "Phase 2: Integration Tests"
    echo "-------------------------"
    
    if run_test_suite "Integration Tests" "npm run test -- --testPathPattern=integration --watchAll=false --passWithNoTests"; then
        INTEGRATION_TESTS_PASSED=true
    fi
    
    echo
    print_status "info" "Phase 3: End-to-End Tests"
    echo "------------------------"
    
    # Install Playwright browsers if not already installed
    if ! npx playwright install --dry-run >/dev/null 2>&1; then
        print_status "info" "Installing Playwright browsers..."
        npx playwright install --with-deps
    fi
    
    if run_test_suite "E2E Tests" "npm run test:e2e"; then
        E2E_TESTS_PASSED=true
    fi
    
    echo
    print_status "info" "Phase 4: Security Tests"
    echo "----------------------"
    
    if run_test_suite "Security Audit" "npm audit --audit-level=moderate" false; then
        SECURITY_TESTS_PASSED=true
    fi
    
    echo
    print_status "info" "Phase 5: Code Quality Checks"
    echo "---------------------------"
    
    run_test_suite "Linting" "npm run lint" false
    run_test_suite "Type Checking" "npx tsc --noEmit" false
    
    # Generate test report
    generate_report
}

# Generate test report
generate_report() {
    echo
    echo "📊 Test Results Summary"
    echo "======================"
    
    local total_tests=0
    local passed_tests=0
    
    # Count and display results
    if [ "$UNIT_TESTS_PASSED" = true ]; then
        print_status "success" "Unit Tests: PASSED"
        ((passed_tests++))
    else
        print_status "error" "Unit Tests: FAILED"
    fi
    ((total_tests++))
    
    if [ "$INTEGRATION_TESTS_PASSED" = true ]; then
        print_status "success" "Integration Tests: PASSED"
        ((passed_tests++))
    else
        print_status "error" "Integration Tests: FAILED"
    fi
    ((total_tests++))
    
    if [ "$E2E_TESTS_PASSED" = true ]; then
        print_status "success" "E2E Tests: PASSED"
        ((passed_tests++))
    else
        print_status "error" "E2E Tests: FAILED"
    fi
    ((total_tests++))
    
    if [ "$SECURITY_TESTS_PASSED" = true ]; then
        print_status "success" "Security Tests: PASSED"
        ((passed_tests++))
    else
        print_status "warning" "Security Tests: FAILED (non-critical)"
    fi
    ((total_tests++))
    
    echo
    echo "Results: $passed_tests/$total_tests test suites passed"
    
    # Determine overall result
    if [ "$UNIT_TESTS_PASSED" = true ] && [ "$INTEGRATION_TESTS_PASSED" = true ] && [ "$E2E_TESTS_PASSED" = true ]; then
        print_status "success" "🎉 All critical tests passed! Ready for deployment."
        
        # Generate coverage report if available
        if [ -d "coverage" ]; then
            print_status "info" "Coverage report available in coverage/ directory"
        fi
        
        return 0
    else
        print_status "error" "💥 Some critical tests failed. Please review and fix issues."
        return 1
    fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"