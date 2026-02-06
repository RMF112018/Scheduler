#!/bin/bash

# Azure Resource Setup Script for Staging
# This script creates all necessary Azure resources for staging deployment

set -e

# Configuration
RESOURCE_GROUP="scheduler-staging-rg"
LOCATION="eastus"
APP_SERVICE_PLAN="scheduler-staging-plan"
BACKEND_APP_NAME="scheduler-backend-staging"
FRONTEND_APP_NAME="scheduler-frontend-staging"
POSTGRES_SERVER="scheduler-staging-db"
POSTGRES_DB="scheduler_staging"
POSTGRES_USER="scheduler"
REDIS_NAME="scheduler-staging-redis"
STORAGE_ACCOUNT="schedulerstagingstorage"
APP_INSIGHTS="scheduler-staging-insights"
SKU_PLAN="B1"
POSTGRES_SKU="Standard_B1ms"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Azure resource setup for staging...${NC}"

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Azure. Please run 'az login' first.${NC}"
    exit 1
fi

# Prompt for PostgreSQL password
echo -e "${YELLOW}Enter PostgreSQL admin password (min 8 chars, must contain uppercase, lowercase, numbers):${NC}"
read -s POSTGRES_PASSWORD

if [ ${#POSTGRES_PASSWORD} -lt 8 ]; then
    echo -e "${RED}Error: Password must be at least 8 characters long.${NC}"
    exit 1
fi

# 1. Create Resource Group
echo -e "${GREEN}Creating resource group...${NC}"
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none

# 2. Create App Service Plan
echo -e "${GREEN}Creating App Service plan...${NC}"
az appservice plan create \
  --name "$APP_SERVICE_PLAN" \
  --resource-group "$RESOURCE_GROUP" \
  --sku "$SKU_PLAN" \
  --is-linux \
  --output none

# 3. Create PostgreSQL Flexible Server
echo -e "${GREEN}Creating PostgreSQL server...${NC}"
az postgres flexible-server create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --location "$LOCATION" \
  --admin-user "$POSTGRES_USER" \
  --admin-password "$POSTGRES_PASSWORD" \
  --sku-name "$POSTGRES_SKU" \
  --tier Burstable \
  --version 16 \
  --storage-size 32 \
  --public-access 0.0.0.0 \
  --output none

# 4. Create Database
echo -e "${GREEN}Creating database...${NC}"
az postgres flexible-server db create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$POSTGRES_SERVER" \
  --database-name "$POSTGRES_DB" \
  --output none

# 5. Create Redis Cache (Optional - comment out if not needed)
echo -e "${GREEN}Creating Redis cache...${NC}"
az redis create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$REDIS_NAME" \
  --location "$LOCATION" \
  --sku Basic \
  --vm-size c0 \
  --output none || echo -e "${YELLOW}Redis creation skipped (may already exist)${NC}"

# 6. Create Storage Account
echo -e "${GREEN}Creating storage account...${NC}"
az storage account create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STORAGE_ACCOUNT" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --output none

# 7. Create Application Insights
echo -e "${GREEN}Creating Application Insights...${NC}"
az monitor app-insights component create \
  --app "$APP_INSIGHTS" \
  --location "$LOCATION" \
  --resource-group "$RESOURCE_GROUP" \
  --output none

# 8. Create Backend App Service
echo -e "${GREEN}Creating backend App Service...${NC}"
az webapp create \
  --resource-group "$RESOURCE_GROUP" \
  --plan "$APP_SERVICE_PLAN" \
  --name "$BACKEND_APP_NAME" \
  --runtime "NODE:18-lts" \
  --output none

# 9. Create Frontend App Service
echo -e "${GREEN}Creating frontend App Service...${NC}"
az webapp create \
  --resource-group "$RESOURCE_GROUP" \
  --plan "$APP_SERVICE_PLAN" \
  --name "$FRONTEND_APP_NAME" \
  --runtime "NODE:18-lts" \
  --output none

# Get connection strings and keys
echo -e "${GREEN}Retrieving connection information...${NC}"

POSTGRES_CONNECTION_STRING=$(az postgres flexible-server show-connection-string \
  --server-name "$POSTGRES_SERVER" \
  --database-name "$POSTGRES_DB" \
  --admin-user "$POSTGRES_USER" \
  --admin-password "$POSTGRES_PASSWORD" \
  --query connectionStrings.psql \
  --output tsv)

REDIS_CONNECTION_STRING=$(az redis list-keys \
  --resource-group "$RESOURCE_GROUP" \
  --name "$REDIS_NAME" \
  --query primaryKey \
  --output tsv 2>/dev/null || echo "")

STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STORAGE_ACCOUNT" \
  --query connectionString \
  --output tsv)

APP_INSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
  --app "$APP_INSIGHTS" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString \
  --output tsv)

# Output summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Azure Resources Created Successfully!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${YELLOW}Resource Group:${NC} $RESOURCE_GROUP"
echo -e "${YELLOW}Location:${NC} $LOCATION"
echo -e "${YELLOW}Backend App:${NC} https://$BACKEND_APP_NAME.azurewebsites.net"
echo -e "${YELLOW}Frontend App:${NC} https://$FRONTEND_APP_NAME.azurewebsites.net"
echo -e "${YELLOW}PostgreSQL Server:${NC} $POSTGRES_SERVER.postgres.database.azure.com"
echo -e "${YELLOW}Database:${NC} $POSTGRES_DB"
echo -e "${YELLOW}Redis:${NC} $REDIS_NAME.redis.cache.windows.net"
echo -e "${YELLOW}Storage Account:${NC} $STORAGE_ACCOUNT"
echo -e "${YELLOW}App Insights:${NC} $APP_INSIGHTS"

echo -e "\n${YELLOW}Connection Strings (save these securely):${NC}\n"
echo -e "${YELLOW}DATABASE_URL:${NC}"
echo "$POSTGRES_CONNECTION_STRING"

if [ -n "$REDIS_CONNECTION_STRING" ]; then
  echo -e "\n${YELLOW}REDIS_URL:${NC}"
  echo "rediss://:$REDIS_CONNECTION_STRING@$REDIS_NAME.redis.cache.windows.net:6380"
fi

echo -e "\n${YELLOW}AZURE_STORAGE_CONNECTION_STRING:${NC}"
echo "$STORAGE_CONNECTION_STRING"

echo -e "\n${YELLOW}APPLICATIONINSIGHTS_CONNECTION_STRING:${NC}"
echo "$APP_INSIGHTS_CONNECTION_STRING"

echo -e "\n${GREEN}Next Steps:${NC}"
echo "1. Configure App Service environment variables (see docs/DEPLOYMENT.md)"
echo "2. Build and push Docker images"
echo "3. Deploy to App Services"
echo "4. Run database migrations"
echo "5. Verify deployment"
