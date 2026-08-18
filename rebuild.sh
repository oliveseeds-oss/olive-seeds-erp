#!/bin/bash
echo "Rebuilding Olive Seeds ERP Docker containers..."
cd /var/www/olive-seeds-erp
# Stop existing containers
docker-compose down
# Run database migration
echo "Running database migrations..."
# This runs when MySQL container starts
# (files in migrations/ are run by docker-entrypoint-initdb.d)
# Rebuild all containers
docker-compose build --no-cache
# Start all containers
docker-compose up -d
# Wait for startup
echo "Waiting for services to start..."
sleep 10
# Check status
docker-compose ps
# Test backend health
echo "Testing backend..."
curl -s http://localhost:5000/api/health
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
echo "Done! Check docker-compose ps for container status."
echo "Check logs: docker-compose logs backend"
