-- ============================================
-- OLIVE SEEDS ERP - Complete Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS olive_seeds_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE olive_seeds_erp;

-- ============================================
-- USERS & ROLES
-- ============================================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100 NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','employee','viewer') NOT NULL DEFAULT 'viewer',
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- COMPANY SETTINGS
-- ============================================
CREATE TABLE company_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(200) NOT NULL,
  gstin VARCHAR(20),
  pan VARCHAR(15),
  iec VARCHAR(20),
  email VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  country VARCHAR(100) DEFAULT 'India',
  logo_url VARCHAR(500),
  invoice_prefix VARCHAR(10) DEFAULT 'INV',
  invoice_counter INT DEFAULT 1,
  currency VARCHAR(10) DEFAULT 'INR',
  bank_name VARCHAR(200),
  bank_account VARCHAR(30),
  bank_ifsc VARCHAR(20),
  bank_branch VARCHAR(200),
  upi_id VARCHAR(100),
  terms_conditions TEXT,
  invoice_footer TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- CUSTOMERS
-- ============================================
CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id VARCHAR(20) UNIQUE NOT NULL,
  customer_type ENUM('personal','business','wholesale','corporate','international') DEFAULT 'personal',
  name VARCHAR(200) NOT NULL,
  company_name VARCHAR(200),
  gstin VARCHAR(20),
  pan VARCHAR(15),
  email VARCHAR(150),
  phone VARCHAR(20),
  alt_phone VARCHAR(20),
  billing_address TEXT,
  billing_city VARCHAR(100),
  billing_state VARCHAR(100),
  billing_pincode VARCHAR(10),
  billing_country VARCHAR(100) DEFAULT 'India',
  shipping_address TEXT,
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(100),
  shipping_pincode VARCHAR(10),
  shipping_country VARCHAR(100) DEFAULT 'India',
  currency VARCHAR(10) DEFAULT 'INR',
  language VARCHAR(50) DEFAULT 'English',
  customer_group VARCHAR(100),
  credit_limit DECIMAL(15,2) DEFAULT 0,
  outstanding_balance DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- CATEGORIES
-- ============================================
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  parent_id INT,
  type ENUM('physical','digital','service') DEFAULT 'physical',
  description TEXT,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ============================================
-- PRODUCTS - Physical
-- ============================================
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(30) UNIQUE NOT NULL,
  product_type ENUM('physical','digital','service') DEFAULT 'physical',
  sku VARCHAR(100) UNIQUE,
  barcode VARCHAR(100),
  name VARCHAR(500) NOT NULL,
  category_id INT,
  material VARCHAR(200),
  color VARCHAR(100),
  finish VARCHAR(100),
  size VARCHAR(100),
  thickness VARCHAR(50),
  weight DECIMAL(10,3),
  description TEXT,
  hsn_code VARCHAR(20),
  sac_code VARCHAR(20),
  gst_percent DECIMAL(5,2) DEFAULT 18,
  purchase_price DECIMAL(15,2) DEFAULT 0,
  selling_price DECIMAL(15,2) NOT NULL,
  bulk_price DECIMAL(15,2),
  bulk_min_qty INT DEFAULT 1,
  international_price DECIMAL(15,2),
  min_order INT DEFAULT 1,
  max_order INT,
  stock INT DEFAULT 0,
  reorder_level INT DEFAULT 5,
  warehouse VARCHAR(200),
  image_urls TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  marketplace_amazon BOOLEAN DEFAULT FALSE,
  marketplace_flipkart BOOLEAN DEFAULT FALSE,
  marketplace_etsy BOOLEAN DEFAULT FALSE,
  marketplace_website BOOLEAN DEFAULT FALSE,
  amazon_asin VARCHAR(50),
  flipkart_sku VARCHAR(50),
  etsy_listing_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ============================================
-- DIGITAL PRODUCTS
-- ============================================
CREATE TABLE digital_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  file_path VARCHAR(500),
  download_link VARCHAR(500),
  version VARCHAR(50),
  license_type VARCHAR(100),
  file_size VARCHAR(50),
  download_limit INT DEFAULT 5,
  expiry_days INT DEFAULT 365,
  watermark_option BOOLEAN DEFAULT FALSE,
  preview_images TEXT,
  preview_video VARCHAR(500),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================
-- SUPPLIERS
-- ============================================
CREATE TABLE suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  company_name VARCHAR(200),
  gstin VARCHAR(20),
  pan VARCHAR(15),
  email VARCHAR(150),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  country VARCHAR(100) DEFAULT 'India',
  bank_name VARCHAR(200),
  bank_account VARCHAR(30),
  bank_ifsc VARCHAR(20),
  payment_terms VARCHAR(200),
  outstanding DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INVENTORY
-- ============================================
CREATE TABLE inventory_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  movement_type ENUM('in','out','adjustment','damage','return','transfer') NOT NULL,
  quantity INT NOT NULL,
  reference_type VARCHAR(50),
  reference_id INT,
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE raw_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  unit VARCHAR(50),
  stock DECIMAL(10,3) DEFAULT 0,
  reorder_level DECIMAL(10,3) DEFAULT 0,
  purchase_price DECIMAL(15,2) DEFAULT 0,
  supplier_id INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- ============================================
-- ORDERS
-- ============================================
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(30) UNIQUE NOT NULL,
  order_type ENUM('regular','bulk','digital','service') DEFAULT 'regular',
  source ENUM('website','amazon','flipkart','etsy','instagram','whatsapp','manual','walkin') DEFAULT 'manual',
  marketplace_order_id VARCHAR(100),
  customer_id INT,
  customer_name VARCHAR(200),
  customer_email VARCHAR(150),
  customer_phone VARCHAR(20),
  billing_address TEXT,
  shipping_address TEXT,
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(100),
  shipping_pincode VARCHAR(10),
  shipping_country VARCHAR(100) DEFAULT 'India',
  status ENUM('pending','processing','manufacturing','engraving','qc','packing','ready','shipped','delivered','cancelled','returned','refunded') DEFAULT 'pending',
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  cgst DECIMAL(15,2) DEFAULT 0,
  sgst DECIMAL(15,2) DEFAULT 0,
  igst DECIMAL(15,2) DEFAULT 0,
  total_tax DECIMAL(15,2) DEFAULT 0,
  shipping_cost DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate DECIMAL(10,4) DEFAULT 1,
  payment_status ENUM('pending','partial','paid','refunded') DEFAULT 'pending',
  payment_method VARCHAR(50),
  notes TEXT,
  personalization_notes TEXT,
  laser_file_path VARCHAR(500),
  is_gst_invoice BOOLEAN DEFAULT TRUE,
  is_international BOOLEAN DEFAULT FALSE,
  tracking_number VARCHAR(200),
  courier VARCHAR(100),
  awb_number VARCHAR(100),
  shipped_at DATETIME,
  delivered_at DATETIME,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT,
  product_name VARCHAR(500) NOT NULL,
  sku VARCHAR(100),
  hsn_code VARCHAR(20),
  quantity INT NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  discount DECIMAL(15,2) DEFAULT 0,
  gst_percent DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  personalization TEXT,
  approval_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- ============================================
-- INVOICES
-- ============================================
CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_type ENUM('tax','retail','wholesale','corporate','proforma','quotation','delivery_challan','credit_note','debit_note','estimate','purchase','commercial','gift','sample') DEFAULT 'tax',
  order_id INT,
  customer_id INT,
  supplier_id INT,
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  cgst DECIMAL(15,2) DEFAULT 0,
  sgst DECIMAL(15,2) DEFAULT 0,
  igst DECIMAL(15,2) DEFAULT 0,
  total_tax DECIMAL(15,2) DEFAULT 0,
  shipping_cost DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate DECIMAL(10,4) DEFAULT 1,
  payment_status ENUM('pending','partial','paid','refunded') DEFAULT 'pending',
  paid_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  terms TEXT,
  pdf_path VARCHAR(500),
  is_international BOOLEAN DEFAULT FALSE,
  country_of_origin VARCHAR(100) DEFAULT 'India',
  country_of_destination VARCHAR(100),
  hs_code VARCHAR(20),
  weight DECIMAL(10,3),
  declaration TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id VARCHAR(30) UNIQUE NOT NULL,
  invoice_id INT,
  order_id INT,
  customer_id INT,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  payment_method ENUM('cash','upi','card','netbanking','paypal','razorpay','stripe','bank_transfer','cod','advance','partial','wallet') NOT NULL,
  transaction_id VARCHAR(200),
  payment_date DATE NOT NULL,
  status ENUM('pending','completed','failed','refunded') DEFAULT 'completed',
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- SHIPPING
-- ============================================
CREATE TABLE shipments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shipment_id VARCHAR(30) UNIQUE NOT NULL,
  order_id INT NOT NULL,
  courier ENUM('shiprocket','amazon','fedex','ups','dhl','aramex','indiapost','dtdc','bluedart','other') DEFAULT 'other',
  tracking_number VARCHAR(200),
  awb_number VARCHAR(200),
  shipping_label_path VARCHAR(500),
  weight DECIMAL(10,3),
  length DECIMAL(10,2),
  width DECIMAL(10,2),
  height DECIMAL(10,2),
  shipping_cost DECIMAL(15,2) DEFAULT 0,
  insurance DECIMAL(15,2) DEFAULT 0,
  payment_type ENUM('prepaid','cod') DEFAULT 'prepaid',
  pickup_date DATE,
  expected_delivery DATE,
  status ENUM('pending','picked','in_transit','out_delivery','delivered','returned') DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ============================================
-- EXPENSES
-- ============================================
CREATE TABLE expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expense_id VARCHAR(20) UNIQUE NOT NULL,
  category VARCHAR(200) NOT NULL,
  description TEXT,
  amount DECIMAL(15,2) NOT NULL,
  gst_amount DECIMAL(15,2) DEFAULT 0,
  expense_date DATE NOT NULL,
  payment_method VARCHAR(50),
  vendor VARCHAR(200),
  receipt_path VARCHAR(500),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- GST REPORTS
-- ============================================
CREATE TABLE gst_returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  return_type ENUM('GSTR1','GSTR3B') NOT NULL,
  period VARCHAR(20) NOT NULL,
  total_taxable DECIMAL(15,2) DEFAULT 0,
  total_cgst DECIMAL(15,2) DEFAULT 0,
  total_sgst DECIMAL(15,2) DEFAULT 0,
  total_igst DECIMAL(15,2) DEFAULT 0,
  total_tax DECIMAL(15,2) DEFAULT 0,
  status ENUM('draft','filed') DEFAULT 'draft',
  filed_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BULK ORDERS
-- ============================================
CREATE TABLE bulk_order_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(200),
  total_orders INT DEFAULT 0,
  source_file VARCHAR(500),
  status ENUM('processing','completed','failed') DEFAULT 'processing',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- ACTIVITY LOG (Admin change requests)
-- ============================================
CREATE TABLE activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(100),
  record_id INT,
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE change_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  requested_by INT NOT NULL,
  module VARCHAR(100) NOT NULL,
  record_id INT,
  field_name VARCHAR(100),
  current_value TEXT,
  requested_value TEXT,
  reason TEXT,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  reviewed_by INT,
  reviewed_at DATETIME,
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- ============================================
-- DIGITAL DOWNLOAD LOGS
-- ============================================
CREATE TABLE download_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  order_id INT,
  customer_email VARCHAR(150),
  download_token VARCHAR(200) UNIQUE,
  download_count INT DEFAULT 0,
  max_downloads INT DEFAULT 5,
  expires_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- DEFAULT ADMIN USER (password: Admin@123)
-- ============================================
INSERT INTO users (user_id, name, email, password, role) VALUES 
('USR001', 'Admin', 'admin@oliveseeds.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('USR002', 'Employee', 'employee@oliveseeds.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee'),
('USR003', 'Viewer', 'viewer@oliveseeds.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'viewer');

INSERT INTO company_settings (company_name, gstin, email, address, state, country, invoice_prefix, currency) VALUES
('Olive Seeds Design Studio', 'YOUR_GSTIN', 'info@oliveseeds.com', 'Your Address', 'Tamil Nadu', 'India', 'OS', 'INR');

INSERT INTO categories (name, type) VALUES 
('Engraved Products', 'physical'),
('Digital Downloads', 'digital'),
('Design Services', 'service'),
('Acrylic Products', 'physical'),
('Wooden Products', 'physical'),
('NFC Products', 'physical');
