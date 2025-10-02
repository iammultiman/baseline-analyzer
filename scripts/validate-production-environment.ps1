#!/usr/bin/env pwsh

# Production Environment Validation Script
# This script validates the production environment configuration

param(
    [string]$Environment = "production",
    [switch]$Verbose = $false,
    [switch]$SkipTests = $false
)

Write-Host "🔍 Starting Production Environment Validation..." -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Yellow

# Function to check if environment variable exists and is not empty
function Test-EnvironmentVariable {
    param([string]$Name, [bool]$Required = $true)
    
    $value = [System.Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrEmpty($value)) {
        if ($Required) {
            Write-Host "❌ Missing required environment variable: $Name" -ForegroundColor Red
            return $false
        } else {
            Write-Host "⚠️  Optional environment variable not set: $Name" -ForegroundColor Yellow
            return $true
        }
    } else {
        Write-Host "✅ $Name is configured" -ForegroundColor Green
        if ($Verbose) {
            $maskedValue = if ($Name -match "(KEY|SECRET|PASSWORD|TOKEN)") { 
                $value.Substring(0, [Math]::Min(8, $value.Length)) + "..." 
            } else { 
                $value 
            }
            Write-Host "   Value: $maskedValue" -ForegroundColor Gray
        }
        return $true
    }
}

# Function to test database connectivity
function Test-DatabaseConnectivity {
    Write-Host "🔍 Testing database connectivity..." -ForegroundColor Blue
    
    try {
        $result = npm run db:test-connection 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database connection successful" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Database connection failed: $result" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Database connection test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to test AI provider connectivity
function Test-AIProviders {
    Write-Host "🔍 Testing AI provider connectivity..." -ForegroundColor Blue
    
    $providers = @("openai", "gemini", "anthropic", "openrouter")
    $allValid = $true
    
    foreach ($provider in $providers) {
        try {
            $result = npm run test:ai-provider -- --provider=$provider 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ $provider provider is accessible" -ForegroundColor Green
            } else {
                Write-Host "❌ $provider provider failed: $result" -ForegroundColor Red
                $allValid = $false
            }
        } catch {
            Write-Host "❌ $provider provider test failed: $($_.Exception.Message)" -ForegroundColor Red
            $allValid = $false
        }
    }
    
    return $allValid
}

# Function to test email service
function Test-EmailService {
    Write-Host "🔍 Testing email service..." -ForegroundColor Blue
    
    try {
        $result = npm run test:email-service 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Email service is configured and working" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Email service test failed: $result" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Email service test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to test payment processing
function Test-PaymentProcessing {
    Write-Host "🔍 Testing payment processing..." -ForegroundColor Blue
    
    try {
        $result = npm run test:payment-service 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Payment processing is configured and working" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Payment processing test failed: $result" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Payment processing test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to validate security configuration
function Test-SecurityConfiguration {
    Write-Host "🔍 Validating security configuration..." -ForegroundColor Blue
    
    $securityValid = $true
    
    # Check CORS configuration
    $allowedOrigins = [System.Environment]::GetEnvironmentVariable("ALLOWED_ORIGINS")
    if ([string]::IsNullOrEmpty($allowedOrigins)) {
        Write-Host "❌ ALLOWED_ORIGINS not configured" -ForegroundColor Red
        $securityValid = $false
    } else {
        Write-Host "✅ CORS origins configured" -ForegroundColor Green
    }
    
    # Check rate limiting
    $rateLimitWindow = [System.Environment]::GetEnvironmentVariable("RATE_LIMIT_WINDOW_MS")
    $rateLimitMax = [System.Environment]::GetEnvironmentVariable("RATE_LIMIT_MAX_REQUESTS")
    
    if ([string]::IsNullOrEmpty($rateLimitWindow) -or [string]::IsNullOrEmpty($rateLimitMax)) {
        Write-Host "❌ Rate limiting not properly configured" -ForegroundColor Red
        $securityValid = $false
    } else {
        Write-Host "✅ Rate limiting configured" -ForegroundColor Green
    }
    
    # Check JWT secret strength
    $jwtSecret = [System.Environment]::GetEnvironmentVariable("NEXTAUTH_SECRET")
    if ([string]::IsNullOrEmpty($jwtSecret) -or $jwtSecret.Length -lt 32) {
        Write-Host "❌ JWT secret is too weak or missing" -ForegroundColor Red
        $securityValid = $false
    } else {
        Write-Host "✅ JWT secret is properly configured" -ForegroundColor Green
    }
    
    return $securityValid
}

# Main validation process
$validationResults = @{}

Write-Host "`n📋 Validating Environment Variables..." -ForegroundColor Blue
$envVarsValid = $true

# Required environment variables
$requiredVars = @(
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "GOOGLE_CLOUD_PROJECT_ID",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENROUTER_API_KEY",
    "SENDGRID_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET"
)

foreach ($var in $requiredVars) {
    if (-not (Test-EnvironmentVariable -Name $var)) {
        $envVarsValid = $false
    }
}

$validationResults["Environment Variables"] = $envVarsValid

# Test database connectivity
Write-Host "`n📋 Testing Database..." -ForegroundColor Blue
$validationResults["Database"] = Test-DatabaseConnectivity

# Test AI providers
Write-Host "`n📋 Testing AI Providers..." -ForegroundColor Blue
$validationResults["AI Providers"] = Test-AIProviders

# Test email service
Write-Host "`n📋 Testing Email Service..." -ForegroundColor Blue
$validationResults["Email Service"] = Test-EmailService

# Test payment processing
Write-Host "`n📋 Testing Payment Processing..." -ForegroundColor Blue
$validationResults["Payment Processing"] = Test-PaymentProcessing

# Test security configuration
Write-Host "`n📋 Testing Security Configuration..." -ForegroundColor Blue
$validationResults["Security"] = Test-SecurityConfiguration

# Run comprehensive tests if not skipped
if (-not $SkipTests) {
    Write-Host "`n📋 Running Comprehensive Tests..." -ForegroundColor Blue
    try {
        $testResult = npm run test:production 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ All production tests passed" -ForegroundColor Green
            $validationResults["Comprehensive Tests"] = $true
        } else {
            Write-Host "❌ Some production tests failed: $testResult" -ForegroundColor Red
            $validationResults["Comprehensive Tests"] = $false
        }
    } catch {
        Write-Host "❌ Production tests failed to run: $($_.Exception.Message)" -ForegroundColor Red
        $validationResults["Comprehensive Tests"] = $false
    }
}

# Summary
Write-Host "`n📊 Validation Summary:" -ForegroundColor Blue
Write-Host "===================" -ForegroundColor Blue

$allPassed = $true
foreach ($key in $validationResults.Keys) {
    $status = if ($validationResults[$key]) { "✅ PASS" } else { "❌ FAIL" }
    $color = if ($validationResults[$key]) { "Green" } else { "Red" }
    Write-Host "$key`: $status" -ForegroundColor $color
    
    if (-not $validationResults[$key]) {
        $allPassed = $false
    }
}

Write-Host "`n" -NoNewline
if ($allPassed) {
    Write-Host "🎉 Production environment validation completed successfully!" -ForegroundColor Green
    Write-Host "Your environment is ready for production deployment." -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  Production environment validation failed!" -ForegroundColor Red
    Write-Host "Please fix the issues above before deploying to production." -ForegroundColor Red
    exit 1
}