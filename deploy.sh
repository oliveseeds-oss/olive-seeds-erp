#!/bin/bash
# ============================================================
# Olive Seeds ERP - VPS Deployment Script
# Run: chmod +x deploy.sh && sudo ./deploy.sh
# ============================================================

set -e

echo ""
echo "🌿 ========================================"
echo "   Olive Seeds ERP - Auto Deploy Script"
echo "=========================================="
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root: sudo ./deploy.sh"
  exit 1
fi

# ---- CONFIG (EDIT THESE) ----
APP_DIR="/var/www/olive-seeds-erp"
DOMAIN="yourdomain.com"
DB_NAME="olive_seeds_erp"
DB_USER="oliveuser"
DB_PASS="OliveSeeds@2024!"
JWT_SECRET=$(openssl rand -hex 32)
NODE_PORT=5000
# ------------------------------

echo "📦 Step 1: Updating system packages..."
apt update -y && apt upgrade -y

echo "📦 Step 2: Installing Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "✅ Node $(node -v)"

echo "📦 Step 3: Installing MySQL..."
if ! command -v mysql &> /dev/null; then
  apt install -y mysql-server
  systemctl start mysql
  systemctl enable mysql
fi
echo "✅ MySQL installed"

echo "📦 Step 4: Installing Nginx..."
if ! command -v nginx &> /dev/null; then
  apt install -y nginx
  systemctl enable nginx
fi

echo "📦 Step 5: Installing PM2..."
npm install -g pm2 2>/dev/null || true
echo "✅ PM2 installed"

echo "🗄️ Step 6: Setting up database..."
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

echo "📁 Step 7: Setting up app directory..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/backend/uploads/{products,bulk,docs}

echo "⚙️ Step 8: Creating .env file..."
cat > $APP_DIR/backend/.env <<ENVEOF
PORT=$NODE_PORT
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
COMPANY_NAME=Olive Seeds Design Studio
COMPANY_GSTIN=YOUR_GSTIN_HERE
COMPANY_PAN=YOUR_PAN_HERE
COMPANY_IEC=YOUR_IEC_HERE
COMPANY_EMAIL=info@oliveseeds.com
COMPANY_PHONE=+91-XXXXXXXXXX
COMPANY_ADDRESS=Your Address
COMPANY_STATE=Tamil Nadu
COMPANY_COUNTRY=India
FRONTEND_URL=https://$DOMAIN
ENVEOF
echo "✅ .env created (update GSTIN, PAN, IEC manually)"

echo "📦 Step 9: Installing backend dependencies..."
cd $APP_DIR/backend
npm install --production

echo "🗄️ Step 10: Importing database schema..."
mysql -u $DB_USER -p"$DB_PASS" $DB_NAME < $APP_DIR/backend/database.sql
echo "✅ Database schema imported"

echo "🌐 Step 11: Configuring Nginx..."
cat > /etc/nginx/sites-available/oliveseeds <<NGCONF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:$NODE_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
NGCONF

ln -sf /etc/nginx/sites-available/oliveseeds /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "✅ Nginx configured"

echo "🚀 Step 12: Starting app with PM2..."
cd $APP_DIR/backend
pm2 delete olive-seeds-erp 2>/dev/null || true
pm2 start server.js --name olive-seeds-erp --env production
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true
echo "✅ App running with PM2"

echo ""
echo "🎉 ========================================"
echo "   DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "🌐 Web App:     http://$DOMAIN"
echo "🔑 Admin:       admin@oliveseeds.com / password"
echo "👨‍💼 Employee:    employee@oliveseeds.com / password"
echo "👁️  Viewer:      viewer@oliveseeds.com / password"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "  1. Edit $APP_DIR/backend/.env with your GSTIN, PAN, IEC"
echo "  2. Setup SSL: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "  3. Change all default passwords in the app"
echo "  4. For Android APK: Update SERVER_URL in android/app/build.gradle"
echo ""
echo "📊 Check app status: pm2 status"
echo "📋 View logs:        pm2 logs olive-seeds-erp"
echo ""
