#!/bin/bash

# Production Deployment Script for Baseline Analyzer
# This script deploys the application to Google Cloud Platform with proper secret management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-""}
REGION=${GOOGLE_CLOUD_REGION:-"us-central1"}
SERVICE_NAME="baseline-analyzer-api"
IMAGE_NAME="gcr.io/$PROJECT_ID/baseline-analyzer-api"

echo -e "${GREEN}🚀 Starting production deployment for Baseline Analyzer${NC}"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"

# Validate prerequisites
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: GOOGLE_CLOUD_PROJECT environment variable is not set${NC}"
    exit 1
fi

if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}📋 Enabling required Google Cloud APIs...${NC}"
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable monitoring.googleapis.com
gcloud services enable logging.googleapis.com

# Build and push the Docker image
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
docker build -t $IMAGE_NAME:latest .

echo -e "${YELLOW}📤 Pushing Docker image to Container Registry...${NC}"
docker push $IMAGE_NAME:latest

# Update the Cloud Run configuration with the correct project ID
echo -e "${YELLOW}⚙️ Preparing Cloud Run configuration...${NC}"
sed "s/PROJECT_ID/$PROJECT_ID/g" config/cloud-run-production.yaml > /tmp/cloud-run-production.yaml

# Deploy to Cloud Run
echo -e "${YELLOW}🚀 Deploying to Cloud Run...${NC}"
gcloud run services replace /tmp/cloud-run-production.yaml \
    --region=$REGION \
    --platform=managed

# Set up traffic allocation (100% to latest revision)
echo -e "${YELLOW}🔄 Configuring traffic allocation...${NC}"
gcloud run services update-traffic $SERVICE_NAME \
    --to-latest \
    --region=$REGION

# Configure IAM for public access (adjust as needed for your security requirements)
echo -e "${YELLOW}🔐 Configuring IAM permissions...${NC}"
gcloud run services add-iam-policy-binding $SERVICE_NAME \
    --member="allUsers" \
    --role="roles/run.invoker" \
    --region=$REGION

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Deployment Summary:${NC}"
echo "Service Name: $SERVICE_NAME"
echo "Service URL: $SERVICE_URL"
echo "Region: $REGION"
echo "Image: $IMAGE_NAME:latest"
echo ""
echo -e "${YELLOW}🔍 Next Steps:${NC}"
echo "1. Verify the deployment: curl $SERVICE_URL/api/health"
echo "2. Update Firebase hosting configuration with the new API URL"
echo "3. Configure custom domain if needed"
echo "4. Set up monitoring and alerting"
echo "5. Run integration tests against the production environment"
echo ""
echo -e "${YELLOW}📝 Useful Commands:${NC}"
echo "View logs: gcloud run services logs read $SERVICE_NAME --region=$REGION"
echo "Update service: gcloud run services update $SERVICE_NAME --region=$REGION"
echo "View metrics: gcloud monitoring dashboards list"

# Clean up temporary files
rm -f /tmp/cloud-run-production.yaml

echo -e "${GREEN}🎉 Production deployment completed!${NC}"