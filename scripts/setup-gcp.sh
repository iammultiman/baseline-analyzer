#!/bin/bash

# Setup script for Google Cloud Platform
# This script enables required APIs and sets up the initial infrastructure

set -e

PROJECT_ID=${1:-"your-project-id"}
REGION=${2:-"us-central1"}

echo "Setting up Google Cloud Project: $PROJECT_ID"
echo "Region: $REGION"

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "Enabling required Google Cloud APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable firebase.googleapis.com
gcloud services enable firestore.googleapis.com

# Create Cloud SQL instance
echo "Creating Cloud SQL PostgreSQL instance..."
gcloud sql instances create baseline-analyzer-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=$REGION \
    --storage-type=SSD \
    --storage-size=10GB \
    --backup-start-time=03:00 \
    --enable-bin-log \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=04

# Create database
echo "Creating database..."
gcloud sql databases create baseline_analyzer --instance=baseline-analyzer-db

# Create database user
echo "Creating database user..."
gcloud sql users create baseline_user \
    --instance=baseline-analyzer-db \
    --password=baseline_password_change_me

# Create secrets for database connection
echo "Creating database connection secret..."
gcloud secrets create database-url --data-file=- <<< "postgresql://baseline_user:baseline_password_change_me@/baseline_analyzer?host=/cloudsql/$PROJECT_ID:$REGION:baseline-analyzer-db"

echo "Setup complete!"
echo "Next steps:"
echo "1. Update your .env.local file with the correct values"
echo "2. Initialize Firebase project: firebase init"
echo "3. Deploy your application: npm run deploy"