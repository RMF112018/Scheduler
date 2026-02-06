#!/bin/bash

# Local Staging Deployment Test Script
# Tests the staging docker-compose setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Local Staging Deployment Test${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Change to staging directory
cd "$(dirname "$0")/../docker/staging"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found. Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${RED}Please edit docker/staging/.env with your configuration before continuing.${NC}"
    exit 1
fi

# Step 1: Build and start services
echo -e "${GREEN}Step 1: Building and starting services...${NC}"
docker compose up -d --build

# Wait for services to be ready
echo -e "${GREEN}Waiting for services to start...${NC}"
sleep 10

# Step 2: Check service health
echo -e "\n${GREEN}Step 2: Checking service health...${NC}"

# Check PostgreSQL
echo -n "PostgreSQL: "
if docker compose exec -T postgres pg_isready -U scheduler > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Healthy${NC}"
else
    echo -e "${RED}✗ Unhealthy${NC}"
    exit 1
fi

# Check Redis
echo -n "Redis: "
if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Healthy${NC}"
else
    echo -e "${RED}✗ Unhealthy${NC}"
    exit 1
fi

# Check Backend
echo -n "Backend: "
BACKEND_HEALTH=$(curl -s http://localhost:4000/health || echo "failed")
if echo "$BACKEND_HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✓ Healthy${NC}"
else
    echo -e "${RED}✗ Unhealthy${NC}"
    echo -e "${YELLOW}Response: $BACKEND_HEALTH${NC}"
    echo -e "${YELLOW}Backend logs:${NC}"
    docker compose logs backend | tail -20
    exit 1
fi

# Check Frontend
echo -n "Frontend: "
FRONTEND_HEALTH=$(curl -s http://localhost/health || echo "failed")
if echo "$FRONTEND_HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Healthy${NC}"
else
    echo -e "${RED}✗ Unhealthy${NC}"
    echo -e "${YELLOW}Response: $FRONTEND_HEALTH${NC}"
    echo -e "${YELLOW}Frontend logs:${NC}"
    docker compose logs frontend | tail -20
    exit 1
fi

# Step 3: Test API endpoints
echo -e "\n${GREEN}Step 3: Testing API endpoints...${NC}"

# Test health endpoint
echo -n "GET /health: "
HEALTH_RESPONSE=$(curl -s http://localhost:4000/health)
if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
    echo -e "${YELLOW}Response: $HEALTH_RESPONSE${NC}"
fi

# Test API version endpoint
echo -n "GET /api/v1/health: "
API_HEALTH=$(curl -s http://localhost:4000/api/v1/health 2>/dev/null || echo "failed")
if echo "$API_HEALTH" | grep -q "ok" || echo "$API_HEALTH" | grep -q "404"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${YELLOW}⚠ Response: $API_HEALTH${NC}"
fi

# Step 4: Check container status
echo -e "\n${GREEN}Step 4: Container status...${NC}"
docker compose ps

# Step 5: Display service URLs
echo -e "\n${GREEN}Step 5: Service URLs${NC}"
echo -e "${BLUE}Backend API:${NC} http://localhost:4000"
echo -e "${BLUE}Backend Health:${NC} http://localhost:4000/health"
echo -e "${BLUE}Frontend:${NC} http://localhost"
echo -e "${BLUE}PostgreSQL:${NC} localhost:5432"
echo -e "${BLUE}Redis:${NC} localhost:6379"

# Step 6: Display logs command
echo -e "\n${GREEN}Step 6: Useful commands${NC}"
echo -e "${YELLOW}View logs:${NC} docker compose logs -f"
echo -e "${YELLOW}View backend logs:${NC} docker compose logs -f backend"
echo -e "${YELLOW}View frontend logs:${NC} docker compose logs -f frontend"
echo -e "${YELLOW}Stop services:${NC} docker compose down"
echo -e "${YELLOW}Stop and remove volumes:${NC} docker compose down -v"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Local Staging Test Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Access http://localhost in your browser"
echo "2. Test login with a test account"
echo "3. Create a test project"
echo "4. Test lookahead workflow"
echo "5. Run E2E tests: BASE_URL=http://localhost pnpm test:e2e"
