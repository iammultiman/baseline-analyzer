# Production Secrets Setup Script for Google Cloud Secret Manager (PowerShell)
# This script sets up all required secrets for the Baseline Analyzer application

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-central1"
)

# Check prerequisites
if (-not $ProjectId) {
    Write-Error "GOOGLE_CLOUD_PROJECT environment variable is not set or ProjectId parameter not provided"
    exit 1
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error "gcloud CLI is not installed"
    exit 1
}

Write-Host "Setting up production secrets for Baseline Analyzer" -ForegroundColor Green
Write-Host "Project ID: $ProjectId"
Write-Host "Region: $Region"

# Enable required APIs
Write-Host "Enabling required Google Cloud APIs..." -ForegroundColor Yellow
gcloud services enable secretmanager.googleapis.com --project=$ProjectId
gcloud services enable sqladmin.googleapis.com --project=$ProjectId
gcloud services enable run.googleapis.com --project=$ProjectId
gcloud services enable cloudfunctions.googleapis.com --project=$ProjectId

# Function to create or update a secret
function New-Secret {
    param(
        [string]$SecretName,
        [string]$Description
    )
    
    Write-Host "Creating secret: $SecretName" -ForegroundColor Yellow
    
    # Check if secret already exists
    $secretExists = gcloud secrets describe $SecretName --project=$ProjectId 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Secret $SecretName already exists, skipping creation" -ForegroundColor Cyan
    } else {
        gcloud secrets create $SecretName `
            --replication-policy="automatic" `
            --project=$ProjectId `
            --labels="app=baseline-analyzer,env=production"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Created secret: $SecretName" -ForegroundColor Green
        } else {
            Write-Error "Failed to create secret: $SecretName"
        }
    }
}

# Database Configuration Secrets
Write-Host "Setting up database secrets..." -ForegroundColor Yellow
New-Secret "database-url" "Production database connection string"
New-Secret "database-password" "Database user password"
New-Secret "database-ssl-cert" "Database SSL certificate"

# AI Provider API Keys
Write-Host "Setting up AI provider secrets..." -ForegroundColor Yellow
New-Secret "openai-api-key" "OpenAI API key for AI analysis"
New-Secret "gemini-api-key" "Google Gemini API key"
New-Secret "claude-api-key" "Anthropic Claude API key"
New-Secret "qwen-api-key" "Qwen API key"
New-Secret "openrouter-api-key" "OpenRouter API key"

# Email Service Configuration
Write-Host "Setting up email service secrets..." -ForegroundColor Yellow
New-Secret "sendgrid-api-key" "SendGrid API key for email notifications"
New-Secret "smtp-username" "SMTP username for email service"
New-Secret "smtp-password" "SMTP password for email service"

# Payment Processor Configuration
Write-Host "Setting up payment processor secrets..." -ForegroundColor Yellow
New-Secret "stripe-secret-key" "Stripe secret key for payment processing"
New-Secret "stripe-webhook-secret" "Stripe webhook endpoint secret"
New-Secret "paypal-client-secret" "PayPal client secret"

# Application Security Secrets
Write-Host "Setting up application security secrets..." -ForegroundColor Yellow
New-Secret "jwt-secret" "JWT signing secret for authentication"
New-Secret "session-secret" "Session encryption secret"
New-Secret "api-encryption-key" "API key encryption secret"

# Firebase Configuration
Write-Host "Setting up Firebase secrets..." -ForegroundColor Yellow
New-Secret "firebase-admin-key" "Firebase Admin SDK private key"
New-Secret "firebase-config" "Firebase client configuration"

# External Service API Keys
Write-Host "Setting up external service secrets..." -ForegroundColor Yellow
New-Secret "gitingest-api-key" "GitIngest API key for repository processing"
New-Secret "webhook-signing-secret" "Webhook signature verification secret"

# Set up IAM permissions for Cloud Run and Cloud Functions
Write-Host "Setting up IAM permissions..." -ForegroundColor Yellow

# Get the default compute service account
$computeSA = gcloud iam service-accounts list --filter="email:*-compute@developer.gserviceaccount.com" --format="value(email)" --project=$ProjectId

if ($computeSA) {
    Write-Host "Granting Secret Manager access to: $computeSA" -ForegroundColor Cyan
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$computeSA" `
        --role="roles/secretmanager.secretAccessor"
} else {
    Write-Warning "Could not find default compute service account"
}

# Create a dedicated service account for the application
$appSA = "baseline-analyzer@$ProjectId.iam.gserviceaccount.com"
Write-Host "Creating application service account: $appSA" -ForegroundColor Cyan

$saExists = gcloud iam service-accounts describe $appSA --project=$ProjectId 2>$null
if ($LASTEXITCODE -ne 0) {
    gcloud iam service-accounts create baseline-analyzer `
        --display-name="Baseline Analyzer Application" `
        --description="Service account for Baseline Analyzer production deployment" `
        --project=$ProjectId
}

# Grant necessary permissions to the application service account
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$appSA" `
    --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$appSA" `
    --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$appSA" `
    --role="roles/storage.objectAdmin"

Write-Host "✅ Production secrets setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Add secret values using: gcloud secrets versions add SECRET_NAME --data-file=path/to/secret"
Write-Host "2. Or add via console: https://console.cloud.google.com/security/secret-manager"
Write-Host "3. Update your Cloud Run service to use the baseline-analyzer service account"
Write-Host "4. Configure environment variables to reference these secrets"
Write-Host ""
Write-Host "Example secret value commands:" -ForegroundColor Yellow
Write-Host "echo 'postgresql://user:pass@host:5432/db' | gcloud secrets versions add database-url --data-file=-"
Write-Host "echo 'sk-...' | gcloud secrets versions add openai-api-key --data-file=-"
Write-Host "echo 'sk_live_...' | gcloud secrets versions add stripe-secret-key --data-file=-"