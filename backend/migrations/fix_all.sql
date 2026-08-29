-- Backup history table (MySQL 8.0 compatible)
CREATE TABLE IF NOT EXISTS backup_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(300),
  type ENUM('manual','auto','google_drive') DEFAULT 'manual',
  file_size VARCHAR(50),
  status ENUM('success','failed') DEFAULT 'success',
  location TEXT,
  record_counts TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- quick_bill_physical_items: add missing columns
ALTER TABLE quick_bill_physical_items
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS size VARCHAR(100),
  ADD COLUMN IF NOT EXISTS personalization TEXT;

-- orders: add deleted_at and other missing columns
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_time TIME,
  ADD COLUMN IF NOT EXISTS courier_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS personalization_text TEXT,
  ADD COLUMN IF NOT EXISTS remark TEXT,
  ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due DECIMAL(15,2) DEFAULT 0;

-- invoices: add deleted_at and other missing columns
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT FALSE;

-- company_settings: add google/backup/settings columns
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS google_tokens TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_email VARCHAR(200),
  ADD COLUMN IF NOT EXISTS google_drive_folder VARCHAR(200),
  ADD COLUMN IF NOT EXISTS backup_frequency VARCHAR(50) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS backup_keep_count INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS logo_path VARCHAR(500),
  ADD COLUMN IF NOT EXISTS default_signature_path VARCHAR(500),
  ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS invoice_footer TEXT;

-- products: add missing columns
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sac_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS bulk_min_qty INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS marketplace_website BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS thickness VARCHAR(50);

-- customers: add missing columns
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS alt_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS customer_group VARCHAR(100),
  ADD COLUMN IF NOT EXISTS outstanding_balance DECIMAL(15,2) DEFAULT 0;

-- payments: add missing columns
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS cheque_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS clearing_date DATE,
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(15,2) DEFAULT 0;

-- expenses: add missing columns
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS gst_percent DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reference_number VARCHAR(200),
  ADD COLUMN IF NOT EXISTS vendor VARCHAR(200);

-- shipments: add missing columns
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS actual_delivery DATE,
  ADD COLUMN IF NOT EXISTS cod_amount DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_amount DECIMAL(15,2) DEFAULT 0;

-- users: add missing columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signature_path VARCHAR(500);

-- order_items: add missing columns
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS size VARCHAR(100),
  ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personalization TEXT;

-- change_requests: add missing columns
ALTER TABLE change_requests
  ADD COLUMN IF NOT EXISTS change_type VARCHAR(200),
  ADD COLUMN IF NOT EXISTS priority ENUM('low','medium','high') DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS field_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS current_value TEXT,
  ADD COLUMN IF NOT EXISTS requested_value TEXT;
