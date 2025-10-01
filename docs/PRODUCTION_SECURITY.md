# Production Security Configuration

This document outlines the comprehensive security measures implemented for the Baseline Analyzer production environment.

## Table of Contents

1. [Security Overview](#security-overview)
2. [CORS Configuration](#cors-configuration)
3. [Rate Limiting & DDoS Protection](#rate-limiting--ddos-protection)
4. [Audit Logging](#audit-logging)
5. [Backup & Disaster Recovery](#backup--disaster-recovery)
6. [Network Security](#network-security)
7. [Encryption](#encryption)
8. [Monitoring & Alerting](#monitoring--alerting)
9. [Compliance](#compliance)
10. [Incident Response](#incident-response)
11. [Security Validation](#security-validation)

## Security Overview

The Baseline Analyzer implements defense-in-depth security with multiple layers of protection:

- **Perimeter Security**: Cloud Armor, WAF rules, DDoS protection
- **Network Security**: VPC, private subnets, firewall rules
- **Application Security**: Input validation, CORS, security headers
- **Data Security**: Encryption at rest and in transit, secure backups
- **Access Control**: IAM, RBAC, API key management
- **Monitoring**: Comprehensive logging, alerting, incident response

## CORS Configuration

### Production CORS Policy

```yaml
cors:
  allowedOrigins:
    - "https://baseline-analyzer.web.app"
    - "https://baseline-analyzer.firebaseapp.com"
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
  allowedHeaders: 
    - "Content-Type"
    - "Authorization"
    - "X-Requested-With"
    - "X-API-Key"
    - "X-Organization-ID"
  credentials: true
  maxAge: 86400
```

### Implementation

The CORS middleware is implemented in `/src/lib/middleware/cors-middleware.ts` and integrated into the main middleware pipeline. It:

- Validates origins against the whitelist
- Handles preflight requests
- Logs CORS violations as security events
- Blocks unauthorized cross-origin requests

### Configuration

CORS origins are configured via environment variables:
```bash
CORS_ORIGINS=https://baseline-analyzer.web.app,https://baseline-analyzer.firebaseapp.com
```

## Rate Limiting & DDoS Protection

### Multi-Layer Protection

1. **Cloud Armor**: Infrastructure-level DDoS protection
2. **Application Rate Limiting**: API endpoint-specific limits
3. **Behavioral Analysis**: Suspicious pattern detection

### Rate Limiting Rules

| Endpoint | Window | Max Requests | Purpose |
|----------|--------|--------------|---------|
| `/api/auth` | 15 min | 5 | Prevent brute force |
| `/api/analysis` | 15 min | 10 | Prevent abuse |
| `/api/credits/purchase` | 1 hour | 3 | Prevent fraud |
| `/api/cicd` | 1 min | 30 | CI/CD rate limiting |
| `/api/admin` | 5 min | 20 | Admin protection |
| `/api/*` | 15 min | 100 | General API limit |

### DDoS Protection Features

- **Rate-based banning**: Automatic IP blocking
- **Geo-blocking**: Block high-risk regions
- **Pattern detection**: SQL injection, XSS protection
- **User agent filtering**: Block known malicious tools

### Implementation

Rate limiting uses Redis for distributed state management:

```typescript
// Rate limiting with Redis backend
const rateLimitConfig = {
  windowMs: 900000, // 15 minutes
  maxRequests: 100,
  keyGenerator: (req) => getClientIP(req)
};
```

## Audit Logging

### Comprehensive Event Tracking

All sensitive operations are logged for compliance and security monitoring:

#### Logged Events

- **Authentication**: Login attempts, failures, token refresh
- **Authorization**: Permission checks, access denials
- **Data Access**: CRUD operations on sensitive data
- **Administrative**: Configuration changes, user management
- **Payment**: Credit purchases, transactions
- **Security**: Failed requests, suspicious activity

#### Log Structure

```json
{
  "timestamp": "2024-12-27T10:30:00Z",
  "level": "AUDIT",
  "service": "baseline-analyzer",
  "event_type": "audit_event",
  "user_id": "user-123",
  "organization_id": "org-456",
  "action": "data_read",
  "resource": "repository_analysis",
  "resource_id": "analysis-789",
  "ip_address": "203.0.113.1",
  "user_agent": "Mozilla/5.0...",
  "success": true,
  "details": {
    "repository_url": "https://github.com/example/repo"
  }
}
```

#### Storage & Retention

- **Primary Storage**: Cloud SQL database
- **Long-term Storage**: Cloud Storage with lifecycle policies
- **Retention**: 7 years for compliance (2555 days)
- **Encryption**: All logs encrypted at rest

#### Compliance Features

- **Immutable logs**: Write-only audit trail
- **Integrity verification**: Cryptographic checksums
- **Access controls**: Restricted log access
- **Export capabilities**: Compliance reporting

### Implementation

Audit logging is implemented via the `AuditService`:

```typescript
await auditService.logAuditEvent({
  userId: user.id,
  action: 'data_read',
  resource: 'repository_analysis',
  resourceId: analysisId,
  success: true,
  ipAddress: request.ip,
  userAgent: request.headers['user-agent']
});
```

## Backup & Disaster Recovery

### Backup Strategy

#### Database Backups
- **Frequency**: Daily at 2:00 AM UTC
- **Retention**: 30 days automated, 7 years compliance
- **Encryption**: AES-256 with Cloud KMS
- **Cross-region**: Replicated to secondary region

#### Application Backups
- **Container Images**: Versioned in Container Registry
- **Configuration**: Stored in Secret Manager
- **Code**: Git repository with tags

#### Log Backups
- **Frequency**: Daily at 4:00 AM UTC
- **Format**: Structured JSON exports
- **Compression**: Gzip compression
- **Encryption**: Client-side encryption

### Disaster Recovery

#### Recovery Objectives
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 24 hours

#### Recovery Procedures

1. **Database Recovery**:
   ```bash
   # Create recovery instance
   gcloud sql instances create baseline-analyzer-db-recovery \
     --database-version=POSTGRES_14 \
     --tier=db-custom-2-4096 \
     --region=us-central1
   
   # Import latest backup
   gcloud sql import sql baseline-analyzer-db-recovery \
     gs://PROJECT_ID-secure-backups/database/latest_backup.sql
   ```

2. **Application Recovery**:
   ```bash
   # Deploy from stable image
   gcloud run deploy baseline-analyzer-api \
     --image=gcr.io/PROJECT_ID/baseline-analyzer-api:stable \
     --region=us-central1
   ```

#### Testing Schedule
- **Monthly**: Backup restoration tests
- **Quarterly**: Full disaster recovery drills
- **Annually**: Complete failover tests

## Network Security

### VPC Configuration

- **Private Subnets**: All resources in private subnets
- **NAT Gateway**: Controlled internet access
- **VPC Peering**: Secure inter-service communication
- **Private Google Access**: Access Google APIs privately

### Firewall Rules

```yaml
firewall_rules:
  - name: "allow-https"
    direction: "ingress"
    ports: ["443"]
    sources: ["0.0.0.0/0"]
  
  - name: "allow-http-redirect"
    direction: "ingress"
    ports: ["80"]
    sources: ["0.0.0.0/0"]
  
  - name: "deny-all-other"
    direction: "ingress"
    action: "deny"
    priority: 1000
```

### Load Balancer Security

- **SSL Termination**: TLS 1.3 encryption
- **Health Checks**: Application-aware monitoring
- **DDoS Protection**: Cloud Armor integration
- **Geographic Restrictions**: Configurable geo-blocking

## Encryption

### Encryption at Rest

- **Database**: Transparent Data Encryption (TDE)
- **Backups**: AES-256 with Cloud KMS keys
- **Logs**: Encrypted storage buckets
- **Secrets**: Google Secret Manager

### Encryption in Transit

- **HTTPS**: TLS 1.3 for all web traffic
- **Database**: SSL/TLS connections required
- **Internal**: mTLS for service-to-service
- **API**: JWT tokens with RS256 signing

### Key Management

- **Cloud KMS**: Centralized key management
- **Key Rotation**: Automatic 90-day rotation
- **Access Controls**: IAM-based key access
- **Audit Trail**: All key operations logged

### Implementation

```typescript
// Database encryption configuration
const databaseConfig = {
  ssl: {
    require: true,
    rejectUnauthorized: true,
    ca: process.env.DB_SSL_CA
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    keyId: 'projects/PROJECT_ID/locations/global/keyRings/baseline-analyzer-keyring/cryptoKeys/database-encryption-key'
  }
};
```

## Monitoring & Alerting

### Security Metrics

- **Request Rate**: Requests per minute/hour
- **Error Rate**: 4xx/5xx response percentages
- **Security Events**: Failed auth, suspicious activity
- **Performance**: Response times, availability

### Alert Policies

| Alert | Condition | Severity | Response Time |
|-------|-----------|----------|---------------|
| High Error Rate | >5% errors for 5min | Warning | 15 minutes |
| Security Event Spike | >10 events/min | Critical | 5 minutes |
| DDoS Attack | >1000 req/min for 2min | Critical | 2 minutes |
| Backup Failure | Backup job failed | Critical | Immediate |

### Dashboards

#### Security Dashboard
- Real-time security event monitoring
- Geographic request distribution
- Attack pattern visualization
- Compliance metrics

#### Operations Dashboard
- Application performance metrics
- Infrastructure health
- Error rate trends
- Capacity utilization

### Implementation

```yaml
# Example alert policy
displayName: "Security Event Alert"
conditions:
  - displayName: "High security event rate"
    conditionThreshold:
      filter: 'jsonPayload.event_type="security_event"'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 10
      duration: "300s"
```

## Compliance

### Standards Compliance

- **SOC 2 Type II**: Security, availability, confidentiality
- **GDPR**: Data protection and privacy
- **PCI DSS**: Payment card data security
- **ISO 27001**: Information security management

### Data Retention Policies

| Data Type | Retention Period | Purpose |
|-----------|------------------|---------|
| User Data | 7 years | Legal compliance |
| Audit Logs | 7 years | Security compliance |
| Backups | 7 years | Business continuity |
| Payment Data | 7 years | Financial compliance |

### Privacy Controls

- **Data Minimization**: Collect only necessary data
- **Purpose Limitation**: Use data only for stated purposes
- **Access Controls**: Role-based data access
- **Right to Erasure**: User data deletion capabilities

### Audit Requirements

- **Regular Assessments**: Quarterly security reviews
- **Penetration Testing**: Annual third-party testing
- **Compliance Audits**: Annual SOC 2 audits
- **Documentation**: Comprehensive security documentation

## Incident Response

### Incident Classification

#### Level 1 - Low Priority
- **Examples**: Minor config issues, non-critical vulnerabilities
- **Response Time**: 4 hours
- **Escalation**: Security team only

#### Level 2 - Medium Priority
- **Examples**: Suspicious activity, failed auth spikes
- **Response Time**: 1 hour
- **Escalation**: Security team + On-call engineer

#### Level 3 - High Priority
- **Examples**: Active attack, suspected data breach
- **Response Time**: 15 minutes
- **Escalation**: Security team + On-call + Management

#### Level 4 - Critical Priority
- **Examples**: Confirmed breach, system compromise
- **Response Time**: 5 minutes
- **Escalation**: All hands + External authorities

### Response Procedures

#### DDoS Attack Response

1. **Detection**: Automated alerts trigger
2. **Analysis**: Review attack patterns and sources
3. **Mitigation**: 
   - Increase rate limiting
   - Block attacking IPs
   - Scale infrastructure
4. **Communication**: Notify stakeholders
5. **Recovery**: Monitor and adjust defenses

#### Data Breach Response

1. **Containment**: Isolate affected systems
2. **Assessment**: Determine scope and impact
3. **Notification**: Legal and regulatory notifications
4. **Investigation**: Forensic analysis
5. **Recovery**: Restore from clean backups
6. **Lessons Learned**: Update security measures

### Contact Information

- **Security Team**: security@company.com
- **On-Call Engineer**: +1-555-0123
- **Management**: management@company.com
- **Legal**: legal@company.com

### External Contacts

- **FBI Cyber Division**: 1-855-292-3937
- **CISA**: 1-888-282-0870
- **Cloud Provider Support**: Google Cloud Support

## Security Validation

### Automated Testing

#### Security Scanning
- **Container Scanning**: Vulnerability detection in images
- **Dependency Scanning**: NPM audit for known vulnerabilities
- **SAST**: Static application security testing
- **DAST**: Dynamic application security testing

#### Penetration Testing
- **Frequency**: Quarterly automated, annually manual
- **Scope**: Full application and infrastructure
- **Reporting**: Detailed findings and remediation
- **Verification**: Re-testing after fixes

### Validation Script

Use the provided validation script to check security configuration:

```bash
# Run security validation
./scripts/validate-security-config.sh

# Expected output
Security Validation Summary
==========================
Total checks: 25
Passed: 23
Failed: 2
Pass rate: 92%

✓ Security configuration is excellent!
```

### Manual Verification

#### Security Headers Check
```bash
curl -I https://baseline-analyzer.web.app | grep -E "(X-Content-Type-Options|X-Frame-Options|Strict-Transport-Security)"
```

#### SSL Configuration Check
```bash
openssl s_client -connect baseline-analyzer.web.app:443 -servername baseline-analyzer.web.app
```

#### Rate Limiting Test
```bash
# Test rate limiting (should get 429 after limit)
for i in {1..150}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://baseline-analyzer.web.app/api/health
done
```

## Security Maintenance

### Regular Tasks

#### Daily
- Review security event logs
- Monitor alert dashboards
- Check backup status

#### Weekly
- Review access logs
- Update security policies
- Validate monitoring alerts

#### Monthly
- Security configuration review
- Backup restoration testing
- Vulnerability scanning

#### Quarterly
- Penetration testing
- Security training updates
- Incident response drills

### Security Updates

#### Dependency Updates
- **Frequency**: Weekly automated scanning
- **Process**: Automated PRs for security updates
- **Testing**: Full test suite before deployment

#### Infrastructure Updates
- **Frequency**: Monthly maintenance windows
- **Process**: Staged rollout with rollback capability
- **Monitoring**: Enhanced monitoring during updates

### Documentation Updates

This security documentation should be reviewed and updated:
- **Quarterly**: Regular review cycle
- **After Incidents**: Lessons learned integration
- **Policy Changes**: Immediate updates for policy changes
- **Compliance Audits**: Updates based on audit findings

---

## Quick Reference

### Emergency Contacts
- **Security Incident**: security@company.com
- **On-Call**: +1-555-0123
- **Management**: management@company.com

### Key Commands
```bash
# Security validation
./scripts/validate-security-config.sh

# Backup validation
./scripts/validate-backups.sh

# Security setup
./scripts/setup-production-security.sh

# Incident response
./scripts/incident-response.sh
```

### Important URLs
- **Security Dashboard**: https://console.cloud.google.com/monitoring/dashboards/custom/security
- **Audit Logs**: https://console.cloud.google.com/logs/query
- **Cloud Armor**: https://console.cloud.google.com/net-security/securitypolicies
- **Secret Manager**: https://console.cloud.google.com/security/secret-manager