# Production Secrets Configuration

This document describes how to configure production secrets for the Baseline Analyzer application using Google Cloud Secret Manager.

## Overview

The Baseline Analyzer uses Google Cloud Secret Manager to securely store and manage sensitive configuration data in production. This approach provides:

- Centralized secret management
- Automatic secret rotation capabilities
- Fine-grained access control
- Audit logging for secret access
- Integration with Cloud Run and Cloud Functions

## Required Secrets

### Database Configuration

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `database-url` | PostgreSQL connection string | `postgresql://user:password@host:5432/baseline_analyzer` |
| `database-password` | Database user password | `secure_password_123` |
| `database-ssl-cert` | SSL certificate for database connection (optional) | `-----BEGIN CERTIFICATE-----...` |

### AI Provider API Keys

| Secret Name | Description | Required |
|-------------|-------------|----------|
| `openai-api-key` | OpenAI API key for GPT models | Yes |
| `gemini-api-key` | Google Gemini API key | Yes |
| `claude-api-key` | Anthropic Claude API key | Yes |
| `qwen-api-key` | Qwen API key | Yes |
| `openrouter-api-key` | OpenRouter API key for multiple providers | Yes |

### Email Service Configuration

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `sendgrid-api-key` | SendGrid API key for email delivery | `SG.xxx...` |
| `smtp-username` | SMTP username | `apikey` |
| `smtp-password` | SMTP password | `SG.xxx...` |

### Payment Processor Configuration

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `stripe-secret-key` | Stripe secret key for payment processing | `sk_live_xxx...` |
| `stripe-webhook-secret` | Stripe webhook endpoint secret | `whsec_xxx...` |
| `paypal-client-secret` | PayPal client secret | `xxx...` |

### Application Security

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `jwt-secret` | JWT signing secret | `your-256-bit-secret` |
| `session-secret` | Session encryption secret | `your-session-secret` |
| `api-encryption-key` | API key encryption secret | `your-encryption-key` |

### Firebase Configuration

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `firebase-admin-key` | Firebase Admin SDK private key | `{"type": "service_account"...}` |
| `firebase-config` | Firebase client configuration | `{"apiKey": "xxx"...}` |

### External Services

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `gitingest-api-key` | GitIngest API key for repository processing | `gi_xxx...` |
| `webhook-signing-secret` | Webhook signature verification secret | `your-webhook-secret` |

## Setup Instructions

### 1. Prerequisites

- Google Cloud CLI installed and authenticated
- Project with billing enabled
- Required APIs enabled (done automatically by setup script)

### 2. Run Setup Script

#### Linux/macOS:
```bash
cd baseline-analyzer
chmod +x scripts/setup-secrets.sh
./scripts/setup-secrets.sh
```

#### Windows (PowerShell):
```powershell
cd baseline-analyzer
.\scripts\setup-secrets.ps1
```

### 3. Add Secret Values

After running the setup script, add actual values to the secrets:

```bash
# Database configuration
echo 'postgresql://username:password@host:5432/database' | \
  gcloud secrets versions add database-url --data-file=-

# AI Provider API keys
echo 'sk-your-openai-key' | \
  gcloud secrets versions add openai-api-key --data-file=-

echo 'your-gemini-key' | \
  gcloud secrets versions add gemini-api-key --data-file=-

# Email service
echo 'SG.your-sendgrid-key' | \
  gcloud secrets versions add sendgrid-api-key --data-file=-

# Payment processing
echo 'sk_live_your-stripe-key' | \
  gcloud secrets versions add stripe-secret-key --data-file=-

# Application security
echo 'your-256-bit-jwt-secret' | \
  gcloud secrets versions add jwt-secret --data-file=-

# Firebase configuration
cat firebase-admin-key.json | \
  gcloud secrets versions add firebase-admin-key --data-file=-
```

### 4. Validate Configuration

Run the validation script to ensure all secrets are properly configured:

```bash
./scripts/validate-secrets.sh
```

## Cloud Run Integration

The secrets are automatically injected into Cloud Run containers as environment variables using the configuration in `config/cloud-run-production.yaml`.

Example environment variable configuration:
```yaml
env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: database-url
      key: latest
```

## Security Best Practices

### 1. Least Privilege Access

- Use dedicated service accounts for different components
- Grant only necessary permissions
- Regularly audit IAM permissions

### 2. Secret Rotation

- Implement regular secret rotation for API keys
- Use versioned secrets to enable zero-downtime rotation
- Monitor secret usage and access patterns

### 3. Monitoring and Alerting

- Enable audit logging for secret access
- Set up alerts for unusual secret access patterns
- Monitor failed authentication attempts

### 4. Development vs Production

- Use separate projects for development and production
- Never use production secrets in development
- Use different service accounts for each environment

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   ```bash
   # Grant Secret Manager access to service account
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
     --role="roles/secretmanager.secretAccessor"
   ```

2. **Secret Not Found**
   ```bash
   # List all secrets
   gcloud secrets list --project=PROJECT_ID
   
   # Check secret versions
   gcloud secrets versions list SECRET_NAME --project=PROJECT_ID
   ```

3. **Empty Secret Values**
   ```bash
   # Add a new version to existing secret
   echo 'new-secret-value' | \
     gcloud secrets versions add SECRET_NAME --data-file=-
   ```

### Validation Commands

```bash
# Check if secret exists
gcloud secrets describe SECRET_NAME --project=PROJECT_ID

# Access secret value (for debugging)
gcloud secrets versions access latest --secret=SECRET_NAME --project=PROJECT_ID

# List all secrets
gcloud secrets list --project=PROJECT_ID

# Check IAM permissions
gcloud projects get-iam-policy PROJECT_ID
```

## Environment Variables Reference

The following environment variables are automatically configured in Cloud Run:

| Environment Variable | Secret Reference | Description |
|---------------------|------------------|-------------|
| `DATABASE_URL` | `database-url` | PostgreSQL connection string |
| `OPENAI_API_KEY` | `openai-api-key` | OpenAI API key |
| `STRIPE_SECRET_KEY` | `stripe-secret-key` | Stripe secret key |
| `SENDGRID_API_KEY` | `sendgrid-api-key` | SendGrid API key |
| `JWT_SECRET` | `jwt-secret` | JWT signing secret |

For a complete list, see `config/cloud-run-production.yaml`.

## Next Steps

After configuring secrets:

1. Deploy the application using `scripts/deploy-production.sh`
2. Configure monitoring and alerting (Task 22.2)
3. Set up security and compliance measures (Task 22.3)
4. Run integration tests against the production environment