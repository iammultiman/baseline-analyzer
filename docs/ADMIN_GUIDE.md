# Baseline Analyzer Administrator Guide

## Table of Contents
1. [Initial Setup](#initial-setup)
2. [AI Provider Configuration](#ai-provider-configuration)
3. [Pricing Management](#pricing-management)
4. [User and Organization Management](#user-and-organization-management)
5. [System Monitoring](#system-monitoring)
6. [Security Configuration](#security-configuration)
7. [Backup and Recovery](#backup-and-recovery)
8. [Troubleshooting](#troubleshooting)

## Initial Setup

### First-Time Configuration

After deploying the Baseline Analyzer, complete these initial setup steps:

1. **Access Admin Panel**: Navigate to `/admin` with your administrator account
2. **Configure AI Providers**: Set up at least one AI provider for analysis
3. **Set Pricing Structure**: Configure credit costs and packages
4. **Configure Email Service**: Set up email notifications for invitations
5. **Review Security Settings**: Ensure proper security configurations
6. **Test System Health**: Verify all components are functioning

### Administrator Account Creation

```bash
# Create initial admin user via database
npm run create-admin -- --email admin@yourcompany.com --password SecurePassword123!
```

Or use the setup script:
```bash
./scripts/setup-admin.sh
```

## AI Provider Configuration

### Supported Providers

The system supports multiple AI providers for redundancy and cost optimization:

- **OpenAI**: GPT-3.5 Turbo, GPT-4, GPT-4 Turbo
- **Google Gemini**: Gemini Pro, Gemini Pro Vision
- **Anthropic Claude**: Claude-3 Haiku, Claude-3 Sonnet, Claude-3 Opus
- **Alibaba Qwen**: Qwen-Turbo, Qwen-Plus, Qwen-Max
- **OpenRouter**: Access to multiple models through single API

### Adding AI Providers

1. **Navigate to AI Providers**: Admin Panel → AI Providers
2. **Add New Provider**: Click "Add Provider"
3. **Configure Settings**:
   ```json
   {
     "name": "OpenAI Production",
     "type": "openai",
     "apiKey": "sk-your-api-key-here",
     "model": "gpt-4-turbo-preview",
     "maxTokens": 4096,
     "temperature": 0.1,
     "enabled": true,
     "priority": 1,
     "rateLimits": {
       "requestsPerMinute": 60,
       "tokensPerMinute": 150000
     }
   }
   ```

### Provider Failover Configuration

Configure automatic failover between providers:

```json
{
  "failoverStrategy": "priority",
  "providers": [
    {
      "name": "Primary OpenAI",
      "priority": 1,
      "healthCheck": true
    },
    {
      "name": "Backup Gemini",
      "priority": 2,
      "healthCheck": true
    },
    {
      "name": "Emergency Claude",
      "priority": 3,
      "healthCheck": true
    }
  ],
  "healthCheckInterval": 300,
  "failoverThreshold": 3
}
```

### Cost Optimization

- **Model Selection**: Choose appropriate models for different analysis types
- **Rate Limiting**: Configure limits to control costs
- **Usage Monitoring**: Track provider costs and usage patterns
- **Automatic Scaling**: Configure scaling based on demand

## Pricing Management

### Credit System Configuration

#### Base Pricing Structure
```json
{
  "baseCostPerAnalysis": 10,
  "costPerFile": 0.5,
  "costPerKB": 0.01,
  "complexityMultipliers": {
    "simple": 1.0,
    "moderate": 1.5,
    "complex": 2.0,
    "enterprise": 3.0
  },
  "markupPercentage": 20
}
```

#### Credit Packages
```json
{
  "packages": [
    {
      "id": "starter",
      "name": "Starter Pack",
      "credits": 100,
      "price": 1000,
      "currency": "USD",
      "description": "Perfect for individual developers"
    },
    {
      "id": "professional",
      "name": "Professional Pack",
      "credits": 500,
      "price": 4000,
      "currency": "USD",
      "description": "Great for small teams",
      "discount": 20
    }
  ]
}
```

### Free Tier Configuration

Set up free tier limits for new users:

```json
{
  "freeTier": {
    "initialCredits": 100,
    "monthlyRefill": 50,
    "maxFreeCredits": 200,
    "restrictions": {
      "maxRepositorySize": "100MB",
      "maxAnalysesPerDay": 5,
      "maxAnalysesPerMonth": 50
    }
  }
}
```

### Dynamic Pricing Updates

Update pricing in real-time without affecting existing credits:

1. **Navigate to Pricing**: Admin Panel → Pricing Configuration
2. **Modify Settings**: Update costs, packages, or multipliers
3. **Preview Changes**: Review impact on future analyses
4. **Apply Changes**: Confirm and activate new pricing
5. **Notify Users**: Send notifications about pricing changes (optional)

## User and Organization Management

### User Administration

#### User Management Interface
- **View All Users**: Search, filter, and sort user accounts
- **User Details**: View profile, credit balance, and usage history
- **Account Actions**: Enable/disable accounts, reset passwords, adjust credits
- **Usage Analytics**: Monitor user activity and patterns

#### Bulk Operations
```bash
# Bulk credit adjustment
npm run admin:credits -- --add 100 --users user1@example.com,user2@example.com

# Bulk user export
npm run admin:export-users -- --format csv --output users.csv

# Bulk notifications
npm run admin:notify -- --template maintenance --users all
```

### Organization Management

#### Organization Oversight
- **View Organizations**: List all organizations with key metrics
- **Organization Details**: Members, usage, billing information
- **Billing Management**: Handle organization-level billing and credits
- **Support Actions**: Assist with organization setup and issues

#### Organization Analytics
```sql
-- Top organizations by usage
SELECT 
  o.name,
  COUNT(ra.id) as total_analyses,
  SUM(ra.credits_cost) as total_credits_used,
  COUNT(DISTINCT u.id) as active_members
FROM organizations o
JOIN users u ON u.organization_id = o.id
LEFT JOIN repository_analyses ra ON ra.organization_id = o.id
WHERE ra.created_at >= NOW() - INTERVAL '30 days'
GROUP BY o.id, o.name
ORDER BY total_credits_used DESC;
```

## System Monitoring

### Health Monitoring Dashboard

The admin panel provides comprehensive system monitoring:

#### System Health Metrics
- **Database Performance**: Connection pool status, query performance
- **AI Provider Status**: Response times, error rates, availability
- **Application Performance**: Response times, memory usage, CPU utilization
- **Queue Status**: Background job processing, queue lengths

#### Key Performance Indicators
```json
{
  "systemHealth": {
    "database": {
      "status": "healthy",
      "responseTime": "15ms",
      "activeConnections": 12,
      "maxConnections": 100
    },
    "aiProviders": {
      "openai": {
        "status": "operational",
        "responseTime": "2.3s",
        "successRate": "99.2%",
        "rateLimitStatus": "normal"
      }
    },
    "application": {
      "uptime": "99.9%",
      "memoryUsage": "65%",
      "cpuUsage": "23%",
      "activeUsers": 145
    }
  }
}
```

### Alerting Configuration

Set up alerts for critical system events:

```yaml
# config/alerting-policies.yaml
alerts:
  - name: "High Error Rate"
    condition: "error_rate > 5%"
    duration: "5m"
    severity: "critical"
    notifications:
      - email: "admin@yourcompany.com"
      - slack: "#alerts"
  
  - name: "AI Provider Down"
    condition: "ai_provider_availability < 90%"
    duration: "2m"
    severity: "high"
    notifications:
      - email: "devops@yourcompany.com"
  
  - name: "Database Performance"
    condition: "db_response_time > 1000ms"
    duration: "10m"
    severity: "medium"
    notifications:
      - email: "dba@yourcompany.com"
```

### Usage Analytics

#### Analysis Trends
- **Daily/Weekly/Monthly Analysis Volumes**: Track usage patterns
- **Popular Repositories**: Most analyzed repositories and patterns
- **User Engagement**: Active users, retention rates, feature usage
- **Performance Metrics**: Analysis completion times, success rates

#### Revenue Analytics
- **Credit Sales**: Track credit package purchases and revenue
- **Usage Patterns**: Understand how credits are consumed
- **Customer Lifetime Value**: Analyze user value and retention
- **Pricing Optimization**: Data-driven pricing decisions

## Security Configuration

### Authentication and Authorization

#### Multi-Factor Authentication
Enable MFA for administrator accounts:
```json
{
  "mfa": {
    "required": true,
    "methods": ["totp", "sms", "email"],
    "backupCodes": true,
    "sessionTimeout": 3600
  }
}
```

#### Role-Based Access Control
```json
{
  "roles": {
    "super_admin": {
      "permissions": ["*"],
      "description": "Full system access"
    },
    "admin": {
      "permissions": [
        "users:read",
        "users:write",
        "organizations:read",
        "organizations:write",
        "system:monitor"
      ]
    },
    "support": {
      "permissions": [
        "users:read",
        "organizations:read",
        "system:monitor"
      ]
    }
  }
}
```

### Security Hardening

#### Rate Limiting Configuration
```json
{
  "rateLimits": {
    "api": {
      "windowMs": 900000,
      "max": 100,
      "message": "Too many requests"
    },
    "auth": {
      "windowMs": 900000,
      "max": 5,
      "skipSuccessfulRequests": true
    },
    "analysis": {
      "windowMs": 3600000,
      "max": 10,
      "keyGenerator": "user_id"
    }
  }
}
```

#### CORS and Security Headers
```json
{
  "cors": {
    "origin": ["https://yourapp.com", "https://admin.yourapp.com"],
    "credentials": true,
    "optionsSuccessStatus": 200
  },
  "securityHeaders": {
    "contentSecurityPolicy": {
      "directives": {
        "defaultSrc": ["'self'"],
        "scriptSrc": ["'self'", "'unsafe-inline'"],
        "styleSrc": ["'self'", "'unsafe-inline'"],
        "imgSrc": ["'self'", "data:", "https:"]
      }
    },
    "hsts": {
      "maxAge": 31536000,
      "includeSubDomains": true,
      "preload": true
    }
  }
}
```

### Audit Logging

All administrative actions are logged for security and compliance:

```json
{
  "auditLog": {
    "action": "user_credit_adjustment",
    "actor": "admin@yourcompany.com",
    "target": "user@example.com",
    "details": {
      "previousBalance": 50,
      "newBalance": 150,
      "adjustment": 100,
      "reason": "Customer support credit"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0..."
  }
}
```

## Backup and Recovery

### Database Backup Strategy

#### Automated Backups
```bash
# Daily full backup
0 2 * * * /usr/local/bin/pg_dump baseline_analyzer > /backups/daily/$(date +%Y%m%d).sql

# Hourly incremental backup
0 * * * * /scripts/incremental-backup.sh

# Weekly full backup with compression
0 1 * * 0 /usr/local/bin/pg_dump baseline_analyzer | gzip > /backups/weekly/$(date +%Y%m%d).sql.gz
```

#### Backup Verification
```bash
#!/bin/bash
# Verify backup integrity
BACKUP_FILE="/backups/daily/$(date +%Y%m%d).sql"
if pg_restore --list "$BACKUP_FILE" > /dev/null 2>&1; then
    echo "Backup verification successful"
else
    echo "Backup verification failed" | mail -s "Backup Alert" admin@yourcompany.com
fi
```

### Disaster Recovery Plan

#### Recovery Time Objectives (RTO)
- **Database Recovery**: 30 minutes
- **Application Recovery**: 15 minutes
- **Full System Recovery**: 1 hour

#### Recovery Point Objectives (RPO)
- **Maximum Data Loss**: 1 hour
- **Backup Frequency**: Every 15 minutes
- **Cross-Region Replication**: Real-time

#### Recovery Procedures
1. **Assess Damage**: Determine scope of failure
2. **Activate DR Site**: Switch to backup infrastructure
3. **Restore Database**: Use most recent backup
4. **Verify Data Integrity**: Run consistency checks
5. **Resume Operations**: Redirect traffic to recovered system
6. **Post-Recovery**: Analyze incident and update procedures

## Troubleshooting

### Common Issues

#### High Analysis Failure Rate
**Symptoms**: Increased analysis failures, user complaints
**Diagnosis**:
```bash
# Check AI provider status
curl -H "Authorization: Bearer $API_KEY" https://api.openai.com/v1/models

# Check database performance
SELECT * FROM pg_stat_activity WHERE state = 'active';

# Review error logs
tail -f /var/log/baseline-analyzer/error.log
```

**Solutions**:
- Switch to backup AI provider
- Scale database resources
- Restart application services
- Check network connectivity

#### Performance Degradation
**Symptoms**: Slow response times, timeouts
**Diagnosis**:
```sql
-- Slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Database locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Connection pool status
SELECT * FROM pg_stat_database;
```

**Solutions**:
- Optimize slow queries
- Increase connection pool size
- Add database indexes
- Scale infrastructure

#### Credit System Issues
**Symptoms**: Incorrect credit calculations, payment failures
**Diagnosis**:
```sql
-- Credit transaction audit
SELECT * FROM credit_transactions 
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- Payment processing errors
SELECT * FROM payment_logs 
WHERE status = 'failed'
AND created_at >= NOW() - INTERVAL '1 day';
```

**Solutions**:
- Verify payment processor configuration
- Check credit calculation logic
- Review transaction logs
- Contact payment provider support

### Maintenance Procedures

#### Regular Maintenance Tasks
```bash
#!/bin/bash
# Weekly maintenance script

# Update baseline data
npm run update-baseline-data

# Clean old analysis results
npm run cleanup:old-analyses --days 90

# Optimize database
psql -d baseline_analyzer -c "VACUUM ANALYZE;"

# Update system dependencies
npm audit fix

# Restart services
systemctl restart baseline-analyzer
```

#### Performance Optimization
```sql
-- Database maintenance
REINDEX DATABASE baseline_analyzer;
VACUUM FULL;
ANALYZE;

-- Update statistics
UPDATE pg_stat_statements_reset();
```

### Emergency Procedures

#### System Outage Response
1. **Immediate Actions**:
   - Check system status dashboard
   - Verify infrastructure health
   - Check external dependencies
   - Activate incident response team

2. **Communication**:
   - Update status page
   - Notify users via email/social media
   - Provide regular updates
   - Document incident timeline

3. **Recovery Actions**:
   - Implement emergency fixes
   - Scale resources if needed
   - Switch to backup systems
   - Monitor recovery progress

4. **Post-Incident**:
   - Conduct post-mortem analysis
   - Update procedures
   - Implement preventive measures
   - Communicate lessons learned

This administrator guide provides comprehensive information for managing and maintaining the Baseline Analyzer platform. For additional support or specific technical issues, please contact the development team or refer to the technical documentation.