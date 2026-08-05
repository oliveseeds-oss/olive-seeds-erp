# 🌿 Olive Seeds Design Studio — Complete ERP System
## Version 1.0.0 | Full Stack Business Management

---

## 📦 WHAT'S INCLUDED

```
olive-seeds-erp/
├── backend/          ← Node.js + Express REST API
├── frontend/         ← React Web Application
├── android/          ← Android APK (WebView wrapper)
└── README.md
```

---

## 🚀 QUICK SETUP (VPS / Ubuntu Server)

### Step 1: Install Requirements
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (web server)
sudo apt install -y nginx
```

### Step 2: Setup Database
```bash
sudo mysql -u root -p
```
```sql
CREATE DATABASE olive_seeds_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'oliveuser'@'localhost' IDENTIFIED BY 'YourStrongPassword123!';
GRANT ALL PRIVILEGES ON olive_seeds_erp.* TO 'oliveuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```
```bash
# Import schema
mysql -u oliveuser -p olive_seeds_erp < /var/www/olive-seeds-erp/backend/database.sql
```

### Step 3: Deploy Backend
```bash
# Upload project to server
cd /var/www/olive-seeds-erp/backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
nano .env   # Fill in your actual values

# Start with PM2
pm2 start server.js --name olive-seeds-erp
pm2 save
pm2 startup
```

### Step 4: Build & Deploy Frontend
```bash
cd /var/www/olive-seeds-erp/frontend

# Install dependencies
npm install

# Build for production
REACT_APP_API_URL="" npm run build

# The build folder goes to dist - served by backend
cp -r build/ ../backend/frontend/dist/
```

### Step 5: Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/oliveseeds
```
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/oliveseeds /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Install SSL (HTTPS)
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 🔐 DEFAULT LOGIN ACCOUNTS

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| 👑 **Admin** | admin@oliveseeds.com | password | Full access: create, read, update, delete, manage users |
| 👨‍💼 **Employee** | employee@oliveseeds.com | password | Create new entries only. Cannot edit/delete. Must submit change requests. |
| 👁️ **Viewer** | viewer@oliveseeds.com | password | Read-only. View all data, no modifications. |

> ⚠️ **IMPORTANT: Change all passwords immediately after first login!**
> Go to Settings → Users → Edit → Change Password

---

## 📱 ANDROID APK SETUP

### Before Building:
1. Open `android/app/build.gradle`
2. Find this line:
   ```
   buildConfigField "String", "SERVER_URL", '"https://yourdomain.com"'
   ```
3. Replace `https://yourdomain.com` with your actual domain

### Build APK:
```bash
# Requires Android Studio or JDK 17 + Android SDK

cd android

# Debug APK (for testing)
./gradlew assembleDebug

# Release APK (for distribution)
./gradlew assembleRelease

# APK location:
# android/app/build/outputs/apk/debug/app-debug.apk
# android/app/build/outputs/apk/release/app-release.apk
```

### Install on Android Phone:
- Transfer the APK to your phone
- Enable "Install from unknown sources" in Settings
- Open the APK file and install
- The app connects to your server domain

---

## 🗂️ MODULE OVERVIEW

### ✅ Dashboard
- Today's sales, orders, revenue, profit
- Monthly GST payable
- Low stock & out of stock alerts
- Sales graph (30 days)
- Top products, country-wise sales
- Source-wise breakdown (Amazon, Flipkart, Etsy, etc.)

### ✅ Orders
- Create orders from all sources (Website, Amazon, Flipkart, Etsy, WhatsApp, Manual)
- Auto GST calculation (CGST/SGST for intrastate, IGST for interstate)
- Order status workflow: Pending → Processing → Manufacturing → Engraving → QC → Packing → Ready → Shipped → Delivered
- Personalization/engraving notes per item
- Bulk status updates, tracking number assignment

### ✅ Invoices & PDF Generation
- Tax Invoice (GST)
- Retail Invoice (Non-GST)
- Proforma Invoice
- Quotation
- Delivery Challan
- Credit Note / Debit Note
- Commercial Invoice (for international/export)
- All invoices generate professional PDF with company logo, GST details, bank info

### ✅ Customers
- Personal, Business, Wholesale, Corporate, International
- GSTIN, PAN, billing & shipping addresses
- Purchase history, credit limit
- Multi-currency support

### ✅ Products
- Physical, Digital, Service types
- SKU, barcode, HSN code, GST %
- Purchase price, selling price, bulk price, international price
- Stock management with reorder alerts
- Categories & subcategories

### ✅ Inventory
- Real-time stock tracking
- Low stock / out of stock alerts
- Stock movement history (in/out/adjustment/damage/return)
- Raw materials management

### ✅ Bulk Orders
- Upload Excel/CSV with hundreds of orders
- Auto-create orders, calculate GST, update inventory
- Download Excel template
- Upload history tracking

### ✅ GST Reports
- GSTR-1: B2B (GST registered) and B2C (unregistered) invoices
- GSTR-3B: Net tax payable after input credit
- HSN-wise summary
- Export to CSV for filing on GST portal

### ✅ International / Export
- Commercial Invoice with IEC, HS Code, country of origin/destination
- Packing list
- Export declaration
- Multi-currency invoices

### ✅ Shipping
- Shiprocket, FedEx, UPS, DHL, Aramex, India Post, DTDC, BlueDart
- Tracking number & AWB assignment
- Prepaid / COD tracking

### ✅ Reports
- Sales (daily/monthly/yearly)
- Product-wise sales
- Customer-wise revenue
- Marketplace comparison
- Profit & Loss
- Inventory valuation
- Country-wise international sales
- All exportable to CSV

### ✅ User Roles
- **Admin**: Full CRUD access + user management + settings
- **Employee**: Create new records only. For corrections, submits change request to admin.
- **Viewer**: Read-only access everywhere

### ✅ Change Request System
- Employee submits request: "Order #42, field: total, wrong value: 500, correct: 550, reason: typo"
- Admin reviews and approves (auto-applies to DB) or rejects
- Full audit trail

### ✅ Offline Support (Web + Android)
- Web app caches API responses locally
- Failed requests queued in localStorage
- On reconnect, queued requests automatically sync to server
- Android app detects offline and shows friendly screen

---

## 📁 KEY FILES

| File | Purpose |
|------|---------|
| `backend/.env` | All configuration (DB, JWT, email, company) |
| `backend/database.sql` | Complete MySQL schema |
| `backend/server.js` | Main Express server |
| `backend/routes/invoices.js` | PDF invoice generation |
| `backend/routes/bulk.js` | Excel bulk upload |
| `backend/routes/gst.js` | GSTR-1 and GSTR-3B |
| `frontend/src/pages/NewOrder.js` | POS/order entry |
| `frontend/src/pages/Dashboard.js` | Main dashboard |
| `android/app/build.gradle` | ⚠️ Change SERVER_URL here |

---

## 🔧 ENVIRONMENT VARIABLES (.env)

```env
PORT=5001
DB_HOST=localhost
DB_USER=oliveuser
DB_PASSWORD=YourPassword
DB_NAME=olive_seeds_erp
JWT_SECRET=change_this_to_random_long_string
COMPANY_NAME=Olive Seeds Design Studio
COMPANY_GSTIN=YOUR_GSTIN
COMPANY_PAN=YOUR_PAN
COMPANY_IEC=YOUR_IEC
FRONTEND_URL=https://yourdomain.com
```

---

## 🆘 TROUBLESHOOTING

**Backend won't start:**
```bash
pm2 logs olive-seeds-erp
# Check database connection in .env
```

**"Table doesn't exist" errors:**
```bash
mysql -u oliveuser -p olive_seeds_erp < backend/database.sql
```

**PDF not generating:**
```bash
npm install pdfkit  # in backend folder
```

**Android app shows blank screen:**
- Check SERVER_URL in build.gradle matches your actual domain
- Ensure HTTPS is working on your server
- Check phone has internet connection

---

## 📞 SUPPORT NOTES

- Backend runs on port 5001 (configurable in .env)
- Frontend is served by the backend as static files
- MySQL on localhost:3306 (default)
- PM2 auto-restarts backend on crash
- Nginx handles SSL and reverse proxy
- All uploads stored in `backend/uploads/`
- Invoice PDFs generated on-the-fly (not stored)

---

*Olive Seeds ERP v1.0.0 — Built for Olive Seeds Design Studio*

# olive-seeds-erp
