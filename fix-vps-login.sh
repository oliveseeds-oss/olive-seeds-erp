#!/bin/bash
# fix-vps-login.sh
# Diagnostic and helper script to fix 405 Method Not Allowed on VPS

echo "=== OLIVE SEEDS ERP: VPS LOGIN FIX ==="

cd /var/www/olive-seeds-erp || echo "Assuming local test..."

echo "[1] Running backend diagnostics..."
if [ -d "backend" ]; then
  cd backend
  node diagnose.js || echo "Diagnose script failed"
  cd ..
fi

echo "[2] Rebuilding frontend with correct API URL..."
if [ -d "frontend" ]; then
  cd frontend
  # Ensure production env does not hardcode wrong localhost port or leaves it empty so relative path works
  echo "REACT_APP_API_URL=" > .env.production
  npm install
  npm run build
  cd ..
fi

echo "[3] Resetting passwords (testing)..."
if [ -d "backend" ]; then
  cd backend
  node reset-passwords.js
  cd ..
fi

echo "[4] Restarting PM2 / Backend service..."
pm2 restart all || echo "PM2 not found or nothing running."

echo "[5] Reloading Nginx..."
sudo systemctl reload nginx || echo "Nginx reload skipped."

echo "=== DONE ==="
echo "Please verify login at /login"
