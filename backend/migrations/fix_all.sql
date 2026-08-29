-- fix_all.sql
-- One ALTER TABLE per column — MySQL 8.0 compatible
-- migrate.js wraps each statement in try/catch, so duplicates are safe

-- backup_history table
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

-- quick_bill_physical_items
ALTER TABLE quick_bill_physical_items ADD COLUMN description TEXT;
ALTER TABLE quick_bill_physical_items ADD COLUMN size VARCHAR(100);
ALTER TABLE quick_bill_physical_items ADD COLUMN personalization TEXT;

-- orders
ALTER TABLE orders ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE orders ADD COLUMN order_time TIME;
ALTER TABLE orders ADD COLUMN courier_name VARCHAR(200);
ALTER TABLE orders ADD COLUMN personalization_text TEXT;
ALTER TABLE orders ADD COLUMN remark TEXT;
ALTER TABLE orders ADD COLUMN paid_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN balance_due DECIMAL(15,2) DEFAULT 0;

-- invoices
ALTER TABLE invoices ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN customer_name VARCHAR(200);
ALTER TABLE invoices ADD COLUMN customer_email VARCHAR(150);
ALTER TABLE invoices ADD COLUMN customer_phone VARCHAR(20);
ALTER TABLE invoices ADD COLUMN paid_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN balance_due DECIMAL(15,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN payment_mode VARCHAR(50);
ALTER TABLE invoices ADD COLUMN is_finalized BOOLEAN DEFAULT FALSE;

-- company_settings
ALTER TABLE company_settings ADD COLUMN google_tokens TEXT;
ALTER TABLE company_settings ADD COLUMN google_drive_email VARCHAR(200);
ALTER TABLE company_settings ADD COLUMN google_drive_folder VARCHAR(200);
ALTER TABLE company_settings ADD COLUMN backup_frequency VARCHAR(50) DEFAULT 'manual';
ALTER TABLE company_settings ADD COLUMN backup_keep_count INT DEFAULT 10;
ALTER TABLE company_settings ADD COLUMN logo_path VARCHAR(500);
ALTER TABLE company_settings ADD COLUMN default_signature_path VARCHAR(500);
ALTER TABLE company_settings ADD COLUMN upi_id VARCHAR(100);
ALTER TABLE company_settings ADD COLUMN invoice_footer TEXT;

-- products
ALTER TABLE products ADD COLUMN sac_code VARCHAR(20);
ALTER TABLE products ADD COLUMN bulk_min_qty INT DEFAULT 1;
ALTER TABLE products ADD COLUMN marketplace_website BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN thickness VARCHAR(50);

-- customers
ALTER TABLE customers ADD COLUMN alt_phone VARCHAR(20);
ALTER TABLE customers ADD COLUMN customer_group VARCHAR(100);
ALTER TABLE customers ADD COLUMN outstanding_balance DECIMAL(15,2) DEFAULT 0;

-- payments
ALTER TABLE payments ADD COLUMN bank_name VARCHAR(200);
ALTER TABLE payments ADD COLUMN cheque_number VARCHAR(50);
ALTER TABLE payments ADD COLUMN clearing_date DATE;
ALTER TABLE payments ADD COLUMN customer_name VARCHAR(200);
ALTER TABLE payments ADD COLUMN refund_amount DECIMAL(15,2) DEFAULT 0;

-- expenses
ALTER TABLE expenses ADD COLUMN gst_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE expenses ADD COLUMN reference_number VARCHAR(200);
ALTER TABLE expenses ADD COLUMN vendor VARCHAR(200);

-- shipments
ALTER TABLE shipments ADD COLUMN customer_name VARCHAR(200);
ALTER TABLE shipments ADD COLUMN actual_delivery DATE;
ALTER TABLE shipments ADD COLUMN cod_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE shipments ADD COLUMN insurance_amount DECIMAL(15,2) DEFAULT 0;

-- users
ALTER TABLE users ADD COLUMN signature_path VARCHAR(500);

-- order_items
ALTER TABLE order_items ADD COLUMN size VARCHAR(100);
ALTER TABLE order_items ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN subtotal DECIMAL(15,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN personalization TEXT;

-- change_requests
ALTER TABLE change_requests ADD COLUMN change_type VARCHAR(200);
ALTER TABLE change_requests ADD COLUMN priority ENUM('low','medium','high') DEFAULT 'medium';
ALTER TABLE change_requests ADD COLUMN field_name VARCHAR(100);
ALTER TABLE change_requests ADD COLUMN current_value TEXT;
ALTER TABLE change_requests ADD COLUMN requested_value TEXT;
