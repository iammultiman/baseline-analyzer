# Repository Analysis API Documentation

This document describes the Repository Analysis API endpoints that handle repository submission, analysis processing, status tracking, and result retrieval.

## Overview

The Repository Analysis API provides a comprehensive system for analyzing code repositories against web platform baseline standards using AI. The API supports:

- Repository submission and validation
- Asynchronous analysis processing
- Real-time status tracking and progress updates
- Analysis result storage and retrieval
- Error handling for repository access and processing failures
- Bulk operations for managing multiple analyses

## Authentication

All endpoints require authentication via the `authMiddleware` and tenant isolation via the `tenantMiddleware`. Users must be authenticated and belong to an organization to access these endpoints.

## Endpoints

### 1. Submit Repository for Analysis

**POST** `/api/analysis`

Submits a repository URL for analysis and returns an analysis ID for tracking.

#### Request Body

```json
{
  "repositoryUrl": "https://github.com/user/repository",
  "analysisType": "full", // "compatibility" | "recommendations" | "full"
  "priority": "normal" // "low" | "normal" | "high"
}
```

#### Response

**Success (202 Accepted)**
```json
{
  "success": true,
  "analysisId": "uuid-string",
  "status": "PENDING",
  "message": "Analysis submitted successfully",
  "estimatedTime": "2-5 minutes"
}
```

**Error (400 Bad Request)**
```json
{
  "error": "Repository validation failed",
  "details": "Repository not accessible",
  "code": "REPO_NOT_FOUND",
  "retryable": false
}
```

**Error (409 Conflict)**
```json
{
  "error": "Analysis already in progress for this repository",
  "analysisId": "existing-uuid",
  "status": "PROCESSING"
}
```

#### Validation Rules

- `repositoryUrl` must be a valid URL pointing to a supported Git repository
- `analysisType` defaults to "full" if not specified
- `priority` defaults to "normal" if not specified
- Repository must be accessible (public or user has access)
- No duplicate analysis for the same repository while one is in progress

### 2. List User Analyses

**GET** `/api/analysis`

Retrieves a paginated list of analyses for the authenticated user.

#### Query Parameters

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)
- `status` (optional): Filter by status ("PENDING" | "PROCESSING" | "COMPLETED" | "FAILED")
- `repositoryUrl` (optional): Filter by repository URL (partial match)

#### Response

```json
{
  "success": true,
  "analyses": [
    {
      "id": "uuid-string",
      "repositoryUrl": "https://github.com/user/repo",
      "repositoryName": "repo-name",
      "analysisDate": "2024-01-01T00:00:00Z",
      "status": "COMPLETED",
      "creditsCost": 50,
      "metadata": {
        "analysisType": "full",
        "priority": "normal"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

### 3. Get Analysis Details

**GET** `/api/analysis/{analysisId}`

Retrieves detailed information about a specific analysis, including results if completed.

#### Response

**Completed Analysis**
```json
{
  "success": true,
  "analysis": {
    "id": "uuid-string",
    "repositoryUrl": "https://github.com/user/repo",
    "repositoryName": "repo-name",
    "analysisDate": "2024-01-01T00:00:00Z",
    "status": "COMPLETED",
    "creditsCost": 50,
    "results": {
      "complianceScore": 85,
      "recommendations": [...],
      "baselineMatches": [...],
      "issues": [...]
    },
    "metadata": {
      "repositorySize": 1024000,
      "fileCount": 150,
      "processingTime": 45000,
      "aiProvider": "openai"
    },
    "duration": 180 // seconds
  }
}
```

**Processing Analysis**
```json
{
  "success": true,
  "analysis": {
    "id": "uuid-string",
    "status": "PROCESSING",
    "progress": {
      "stage": "ai-analysis",
      "repositoryProcessing": {
        "status": "completed",
        "progress": 100
      },
      "queue": {
        "position": 0,
        "estimatedWaitTime": 120,
        "totalInQueue": 3
      },
      "estimatedTimeRemaining": 180
    }
  }
}
```

### 4. Get Analysis Status

**GET** `/api/analysis/{analysisId}/status`

Retrieves detailed status and progress information for an analysis.

#### Response

```json
{
  "success": true,
  "status": {
    "analysisId": "uuid-string",
    "repositoryUrl": "https://github.com/user/repo",
    "repositoryName": "repo-name",
    "status": "PROCESSING",
    "submittedAt": "2024-01-01T00:00:00Z",
    "progress": 60,
    "stages": [
      {
        "name": "submission",
        "title": "Analysis Submitted",
        "description": "Analysis request has been submitted and queued",
        "status": "completed"
      },
      {
        "name": "validation",
        "title": "Repository Validation",
        "description": "Validating repository accessibility and format",
        "status": "completed"
      },
      {
        "name": "processing",
        "title": "Repository Processing",
        "description": "Extracting and processing repository content",
        "status": "current"
      },
      {
        "name": "analysis",
        "title": "AI Analysis",
        "description": "Analyzing code against baseline standards",
        "status": "pending"
      },
      {
        "name": "completion",
        "title": "Results Ready",
        "description": "Analysis complete and results available",
        "status": "pending"
      }
    ],
    "estimatedTimeRemaining": 180,
    "repositoryProcessing": {
      "jobId": "job-uuid",
      "status": "processing",
      "queue": {
        "position": 1,
        "estimatedWaitTime": 120,
        "totalInQueue": 3
      }
    }
  }
}
```

### 5. Update Analysis

**PATCH** `/api/analysis/{analysisId}`

Updates an analysis (currently supports cancellation).

#### Request Body

```json
{
  "action": "cancel"
}
```

#### Response

```json
{
  "success": true,
  "message": "Analysis cancelled successfully"
}
```

### 6. Delete Analysis

**DELETE** `/api/analysis/{analysisId}`

Deletes an analysis and its results. Cannot delete analyses that are currently processing.

#### Response

```json
{
  "success": true,
  "message": "Analysis deleted successfully"
}
```

### 7. Bulk Operations

**POST** `/api/analysis/bulk`

Performs bulk operations on multiple analyses.

#### Request Body

```json
{
  "action": "delete", // "delete" | "cancel" | "retry"
  "analysisIds": ["uuid1", "uuid2", "uuid3"]
}
```

#### Response

```json
{
  "success": true,
  "action": "delete",
  "results": {
    "total": 3,
    "successful": 2,
    "failed": 1,
    "details": {
      "successful": ["uuid1", "uuid2"],
      "failed": [
        {
          "id": "uuid3",
          "error": "Cannot delete processing analysis"
        }
      ]
    }
  }
}
```

## Analysis Status Flow

1. **PENDING**: Analysis has been submitted and is waiting to be processed
2. **PROCESSING**: Repository is being processed and analyzed
3. **COMPLETED**: Analysis is complete and results are available
4. **FAILED**: Analysis failed due to an error

## Error Handling

The API uses a comprehensive error handling system that categorizes errors and provides user-friendly messages.

### Error Categories

| Code | Description | Retryable | HTTP Status |
|------|-------------|-----------|-------------|
| `REPO_NOT_FOUND` | Repository not found or not accessible | No | 404 |
| `REPO_PRIVATE` | Repository is private and requires authentication | No | 403 |
| `REPO_TOO_LARGE` | Repository exceeds size limits | No | 400 |
| `REPO_EMPTY` | Repository contains no analyzable files | No | 404 |
| `PROCESSING_TIMEOUT` | Repository processing timed out | Yes | 503 |
| `AI_PROVIDER_ERROR` | AI provider service error | Yes | 503 |
| `INSUFFICIENT_CREDITS` | Not enough credits for analysis | No | 400 |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded | Yes | 429 |
| `DATABASE_ERROR` | Database operation failed | Yes | 503 |

### Error Response Format

```json
{
  "error": "User-friendly error message",
  "code": "ERROR_CODE",
  "retryable": true,
  "details": "Additional error details"
}
```

## Rate Limiting

- Analysis submission: 10 requests per minute per user
- Status checks: 60 requests per minute per user
- List operations: 30 requests per minute per user

## Credit System Integration

- Each analysis consumes credits based on repository size and complexity
- Credit cost is calculated before analysis begins
- Analysis is blocked if insufficient credits are available
- Credits are deducted when analysis starts, not when submitted

## Repository Processing

The API integrates with the Repository Processor service to:

1. Validate repository accessibility
2. Extract repository content using GitIngest
3. Convert content to LLM-readable format
4. Track processing progress and queue status

## AI Analysis Integration

The API integrates with the AI Analysis Engine to:

1. Select appropriate AI provider based on configuration
2. Generate analysis prompts with baseline data context
3. Process AI responses and extract insights
4. Calculate compliance scores and recommendations

## Monitoring and Logging

All API operations are logged with structured logging including:

- Request/response details
- Processing times
- Error information
- User and organization context
- Credit usage tracking

## Security Considerations

- All endpoints require authentication
- Tenant isolation ensures users can only access their own analyses
- Repository URLs are validated to prevent SSRF attacks
- Input validation prevents injection attacks
- Rate limiting prevents abuse

## Performance Optimization

- Asynchronous processing prevents request timeouts
- Database queries are optimized with proper indexing
- Pagination limits response sizes
- Caching is used for frequently accessed data
- Background processing handles long-running operations