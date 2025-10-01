# Database Setup Guide

This guide covers setting up the PostgreSQL database with pgvector extension for the Baseline Analyzer application.

## Overview

The Baseline Analyzer uses:
- **PostgreSQL 15** as the primary database
- **pgvector extension** for vector similarity search
- **Prisma ORM** for database operations
- **Google Cloud SQL** for production hosting

## Quick Start

### 1. Automated Setup (Recommended)

Run the database setup script:

```bash
cd baseline-analyzer
chmod +x scripts/setup-database.sh
./scripts/setup-database.sh
```

This script will:
- Create a Cloud SQL PostgreSQL instance
- Set up the database and user
- Generate secure credentials
- Provide connection instructions

### 2. Manual Setup

If you prefer manual setup or need to customize the configuration:

#### Create Cloud SQL Instance

```bash
# Set your project ID
export PROJECT_ID="your-project-id"

# Create the instance
gcloud sql instances create baseline-analyzer-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup-start-time=03:00
```

#### Create Database and User

```bash
# Create database
gcloud sql databases create baseline_analyzer --instance=baseline-analyzer-db

# Create user
gcloud sql users create baseline_user \
  --instance=baseline-analyzer-db \
  --password=your-secure-password
```

## Local Development Setup

### 1. Install Cloud SQL Proxy

Download and install the Cloud SQL Proxy:

```bash
# macOS
brew install cloud-sql-proxy

# Linux/Windows
# Download from: https://cloud.google.com/sql/docs/postgres/sql-proxy
```

### 2. Connect to Cloud SQL

```bash
# Get your connection name
gcloud sql instances describe baseline-analyzer-db --format="value(connectionName)"

# Start the proxy
cloud_sql_proxy -instances=YOUR_PROJECT:REGION:INSTANCE_NAME=tcp:5432
```

### 3. Configure Environment

Update your `.env.local` file:

```env
DATABASE_URL=postgresql://baseline_user:your_password@localhost:5432/baseline_analyzer
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Migrations

```bash
# Generate Prisma client
npm run db:generate

# Apply migrations
npm run db:migrate:deploy

# Seed the database (optional)
npm run db:seed
```

## Database Schema

### Core Tables

- **users** - User accounts and authentication
- **organizations** - Multi-tenant organization management
- **repository_analyses** - Repository analysis results
- **baseline_data** - Web platform baseline data with vector embeddings
- **credit_transactions** - Credit system transactions
- **invitations** - Team invitation management

### Key Features

- **UUID Primary Keys** - All tables use UUID for better scalability
- **Vector Embeddings** - pgvector extension for similarity search
- **JSONB Storage** - Flexible storage for analysis results and metadata
- **Audit Trails** - Timestamps and transaction logging
- **Multi-tenancy** - Organization-based data isolation

## Database Operations

### Migrations

```bash
# Create a new migration
npm run db:migrate

# Deploy migrations to production
npm run db:migrate:deploy

# Reset database (development only)
npx prisma migrate reset
```

### Prisma Studio

Access the database GUI:

```bash
npm run db:studio
```

### Seeding

Populate with sample data:

```bash
npm run db:seed
```

## Vector Search Setup

### Enable pgvector Extension

Connect to your database and run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Vector Operations

The application includes utilities for vector operations:

```typescript
import { DatabaseConnection } from '@/lib/database'

// Similarity search
const results = await DatabaseConnection.vectorSimilaritySearch(
  embedding, // number[]
  limit,     // number
  threshold  // number
)

// Insert with embedding
await DatabaseConnection.insertBaselineDataWithEmbedding({
  feature: 'CSS Grid',
  embedding: [0.1, 0.2, 0.3, ...] // 1536-dimensional vector
})
```

## Health Monitoring

### Health Check Endpoint

```bash
# Basic health check
curl http://localhost:3000/api/health/database

# Detailed health check with metrics
curl -X POST http://localhost:3000/api/health/database
```

### Performance Monitoring

The application includes built-in database performance monitoring:

- Connection pool status
- Query performance metrics
- Vector search performance
- Table and index statistics

## Production Considerations

### Security

- Use Cloud SQL IAM authentication when possible
- Enable SSL connections
- Restrict network access with authorized networks
- Use Cloud SQL Proxy for secure connections

### Performance

- Configure appropriate instance size based on usage
- Monitor connection pool settings
- Optimize vector search with proper indexing
- Use read replicas for read-heavy workloads

### Backup and Recovery

- Cloud SQL automatic backups are enabled
- Point-in-time recovery available
- Consider cross-region backups for critical data

### Scaling

- Start with db-f1-micro for development
- Scale to db-n1-standard-1 or higher for production
- Monitor CPU and memory usage
- Consider read replicas for scaling reads

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure Cloud SQL Proxy is running
   - Check firewall rules and authorized networks
   - Verify instance is running

2. **pgvector Extension Missing**
   - Connect to database and run `CREATE EXTENSION vector;`
   - Ensure you have superuser privileges

3. **Migration Failures**
   - Check database permissions
   - Ensure all dependencies are installed
   - Review migration logs

4. **Performance Issues**
   - Monitor connection pool usage
   - Check for missing indexes
   - Analyze slow query logs

### Getting Help

- Check Cloud SQL logs in Google Cloud Console
- Use `npm run db:studio` to inspect data
- Run health checks: `curl http://localhost:3000/api/health/database`
- Review Prisma documentation: https://www.prisma.io/docs/

## Environment Variables

Required environment variables:

```env
# Database connection
DATABASE_URL=postgresql://user:password@host:port/database

# Google Cloud (for Cloud SQL)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_REGION=us-central1
```

## Next Steps

After setting up the database:

1. Configure authentication (Firebase Auth)
2. Set up AI provider integrations
3. Implement repository processing pipeline
4. Deploy to Cloud Run

For more information, see the main [README.md](../README.md) file.