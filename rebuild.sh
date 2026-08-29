#!/bin/bash
echo "Rebuilding Olive Seeds ERP Docker containers..."
# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Stop existing containers
if command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE="docker-compose"
else
  DOCKER_COMPOSE="docker compose"
fi

$DOCKER_COMPOSE down
# Run database migration
echo "Running database migrations..."
# This runs when MySQL container starts
# (files in migrations/ are run by docker-entrypoint-initdb.d)
# Rebuild all containers
$DOCKER_COMPOSE build --no-cache
# Start all containers
$DOCKER_COMPOSE up -d
# Wait for startup
echo "Waiting for services to start..."
sleep 10
# Check status
$DOCKER_COMPOSE ps

# Test backend health
echo "Testing backend..."
curl -s http://localhost:5001/api/health
# Test Google Drive config
echo ""
echo "Checking Google Drive config..."
if grep -q "GOOGLE_CLIENT_ID" .env; then
  echo "  GOOGLE_CLIENT_ID found in .env"
else
  echo "  GOOGLE_CLIENT_ID missing from .env"
fi
if grep -q "GOOGLE_CLIENT_SECRET" .env; then
  echo "  GOOGLE_CLIENT_SECRET found in .env"
else
  echo "  GOOGLE_CLIENT_SECRET missing from .env"
fi
if grep -q "GOOGLE_REDIRECT_URI" .env; then
  echo "  GOOGLE_REDIRECT_URI found in .env"
else
  echo "  GOOGLE_REDIRECT_URI missing from .env"
fi
echo ""
echo "Done! Check $DOCKER_COMPOSE ps for container status."
echo "Check logs: $DOCKER_COMPOSE logs backend"

