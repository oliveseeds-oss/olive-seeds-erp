# Olive Seeds ERP Deployment Guide

## Requirements
- Ubuntu 20.04 or later
- Node.js 18+
- MySQL 8.0+
- Nginx
- PM2

## 1. Setup VPS
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx mysql-server
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. Database Setup
```bash
sudo mysql -u root
```
```sql
CREATE DATABASE oliveseeds;
CREATE USER 'olive'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON oliveseeds.* TO 'olive'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 3. Clone Repository
```bash
cd /var/www
sudo git clone <your-repo-url> olive-seeds-erp
sudo chown -R $USER:$USER /var/www/olive-seeds-erp
cd olive-seeds-erp
```

## 4. Environment Variables
Create `.env` in `backend` directory:
```bash
cp backend/.env.example backend/.env
nano backend/.env
```
Update DB credentials and JWT secret.

## 5. Build and Install
```bash
# Backend
cd /var/www/olive-seeds-erp/backend
npm install

# Frontend
cd /var/www/olive-seeds-erp/frontend
npm install
npm run build
```

## 6. PM2 and Nginx Configuration
```bash
cd /var/www/olive-seeds-erp
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Nginx
sudo cp nginx.conf /etc/nginx/sites-available/olive-seeds-erp
sudo ln -s /etc/nginx/sites-available/olive-seeds-erp /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 7. SSL Certificate (Optional but recommended)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```
