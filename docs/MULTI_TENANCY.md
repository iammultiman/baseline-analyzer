# Multi-Tenancy and Organization Management

This document describes the multi-tenancy and organization management system implemented in the Baseline Analyzer application.

## Overview

The application implements a comprehensive multi-tenant architecture with organization-based isolation, role-based access control, and team invitation system. Each organization operates as an isolated tenant with its own members, settings, and data.

## Architecture Components

### 1. Database Models

#### Organization Model
- **Purpose**: Central tenant entity that groups users and resources
- **Key Fields**:
  - `id`: Unique organization identifier
  - `name`: Human-readable organization name
  - `slug`: URL-friendly unique identifier
  - `ownerId`: Reference to the organization owner
  - `settings`: JSON configuration for AI providers, pricing, and usage limits

#### User Model
- **Purpose**: User accounts with organization membership and roles
- **Key Fields**:
  - `organizationId`: Foreign key to organization (nullable for unassigned users)
  - `role`: User role within the organization (ADMIN, MEMBER, VIEWER)
  - `creditBalance`: User's available credits for analysis

#### Invitation Model
- **Purpose**: Manages team invitations with secure tokens
- **Key Fields**:
  - `organizationId`: Target organization
  - `email`: Invited user's email
  - `role`: Proposed role for the invited user
  - `token`: Secure invitation token
  - `status`: Invitation status (PENDING, ACCEPTED, EXPIRED, REVOKED)
  - `expiresAt`: Invitation expiration timestamp

### 2. Role-Based Access Control (RBAC)

#### Role Hierarchy
1. **Owner**: Organization creator with full administrative rights
2. **Admin**: Can manage members, invitations, and organization settings
3. **Member**: Can perform analysis and view organization data
4. **Viewer**: Read-only access to organization data

#### Permission Matrix
| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| View organization | ✓ | ✓ | ✓ | ✓ |
| Perform analysis | ✓ | ✓ | ✓ | ✗ |
| Invite members | ✓ | ✓ | ✗ | ✗ |
| Manage members | ✓ | ✓ | ✗ | ✗ |
| Update settings | ✓ | ✓ | ✗ | ✗ |
| Delete organization | ✓ | ✗ | ✗ | ✗ |

### 3. Tenant Isolation Middleware

#### TenantContext
The `getTenantContext` function provides:
- Authenticated user information
- Organization membership details
- User role and ownership status
- Automatic tenant isolation enforcement

#### Middleware Functions
- `withTenant`: Wraps API handlers with tenant context
- `withOrganizationAccess`: Enforces organization-specific access
- `addTenantFilter`: Adds organization filters to database queries
- `addTenantData`: Ensures created resources belong to user's organization

### 4. Organization Service

#### Core Methods
- `canPerformAction`: Checks user permissions for specific actions
- `getOrganizationWithStats`: Retrieves organization with usage statistics
- `createInvitation`: Creates secure team invitations
- `acceptInvitation`: Processes invitation acceptance
- `removeMember`: Removes members from organization
- `updateMemberRole`: Updates member roles with proper authorization

## API Endpoints

### Organization Management
- `GET /api/organizations` - List user's organizations
- `POST /api/organizations` - Create new organization
- `GET /api/organizations/[id]` - Get organization details
- `PUT /api/organizations/[id]` - Update organization settings
- `DELETE /api/organizations/[id]` - Delete organization (owner only)

### Member Management
- `GET /api/organizations/[id]/members` - List organization members
- `PUT /api/organizations/[id]/members/[memberId]` - Update member role
- `DELETE /api/organizations/[id]/members/[memberId]` - Remove member

### Invitation Management
- `GET /api/organizations/[id]/invitations` - List pending invitations
- `POST /api/organizations/[id]/invitations` - Create invitation
- `DELETE /api/organizations/[id]/invitations/[invitationId]` - Revoke invitation
- `POST /api/invitations/validate` - Validate invitation token (public)
- `POST /api/invitations/accept` - Accept invitation (authenticated)

## Security Features

### 1. Tenant Isolation
- All database queries are automatically filtered by organization
- Cross-tenant data access is prevented at the middleware level
- Resource ownership is verified before any operations

### 2. Secure Invitations
- Cryptographically secure tokens (32 bytes)
- Time-limited invitations (7 days default)
- Email verification ensures invitations reach intended recipients
- Token-based validation prevents unauthorized access

### 3. Role Enforcement
- Granular permission checks for all operations
- Owner privileges cannot be transferred or modified
- Admin actions are logged and auditable
- Self-service member removal is allowed

### 4. Data Protection
- Organization settings include sensitive AI provider credentials
- Credit balances are protected from cross-tenant access
- Analysis results are isolated by organization
- Audit trails for sensitive operations

## Usage Examples

### Creating an Organization
```typescript
const response = await fetch('/api/organizations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Company',
    slug: 'my-company'
  })
});
```

### Inviting Team Members
```typescript
const response = await fetch(`/api/organizations/${orgId}/invitations`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'colleague@company.com',
    role: 'MEMBER'
  })
});
```

### Accepting Invitations
```typescript
const response = await fetch('/api/invitations/accept', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'invitation-token-from-email'
  })
});
```

## Testing

The system includes comprehensive tests covering:
- Organization creation and management
- Multi-tenant data isolation
- Role-based permission enforcement
- Invitation workflow end-to-end
- Error handling and edge cases

Run tests using the test endpoint:
```bash
curl -X GET http://localhost:3000/api/organizations/test
```

## Configuration

### Organization Settings Structure
```json
{
  "aiProvider": {
    "primary": "openai",
    "fallback": ["gemini", "claude"],
    "models": {
      "openai": "gpt-4",
      "gemini": "gemini-pro"
    },
    "rateLimits": {
      "openai": 100,
      "gemini": 50
    }
  },
  "pricingConfig": {
    "creditCostPerAnalysis": 10,
    "markupPercentage": 20,
    "freeTierLimits": {
      "creditsPerMonth": 100,
      "analysesPerDay": 5,
      "maxRepositorySize": 50000000
    }
  },
  "usageLimits": {
    "maxAnalysesPerDay": 50,
    "maxAnalysesPerMonth": 1000,
    "maxRepositorySize": 500000000,
    "maxConcurrentAnalyses": 5
  }
}
```

## Best Practices

### 1. Always Use Tenant Context
- Never bypass tenant middleware for organization-related operations
- Always validate organization access before resource operations
- Use `addTenantFilter` for database queries

### 2. Role Validation
- Check permissions at both API and service levels
- Use the `canPerformAction` method for consistent permission checks
- Implement defense in depth for sensitive operations

### 3. Invitation Security
- Generate cryptographically secure tokens
- Implement proper expiration handling
- Validate email ownership before acceptance

### 4. Error Handling
- Provide clear error messages without exposing sensitive information
- Log security-related events for auditing
- Implement proper fallback mechanisms

## Monitoring and Observability

The system provides metrics for:
- Organization creation and growth
- Member invitation and acceptance rates
- Permission violations and security events
- Resource usage by organization
- API endpoint performance and errors

These metrics can be used for billing, security monitoring, and system optimization.