CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type ENUM('physical','digital','service') DEFAULT 'physical',
  parent_id INT DEFAULT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO categories (id, name, type) VALUES
(1, 'Engraved Products','physical'),
(2, 'Digital Downloads','digital'),
(3, 'Design Services','service'),
(4, 'Acrylic Products','physical'),
(5, 'Wooden Products','physical'),
(6, 'NFC Products','physical'),
(7, 'Packing Materials','physical');

ALTER TABLE raw_materials
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS maximum_stock DECIMAL(10,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_purchase_date DATE,
ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS location VARCHAR(200),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(150),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_time TIME,
ADD COLUMN IF NOT EXISTS courier_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS personalization_text TEXT,
ADD COLUMN IF NOT EXISTS remark TEXT,
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(15,2) DEFAULT 0;

ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS actual_delivery DATE,
ADD COLUMN IF NOT EXISTS cod_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS insurance_amount DECIMAL(15,2) DEFAULT 0;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS gst_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(200);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS cheque_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS clearing_date DATE,
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS refund_date DATE;

ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS quotation_title VARCHAR(500),
ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS billing_state VARCHAR(100),
ADD COLUMN IF NOT EXISTS billing_pincode VARCHAR(10);

CREATE TABLE IF NOT EXISTS backup_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(300),
  type ENUM('manual','auto','google_drive') DEFAULT 'manual',
  file_size VARCHAR(50),
  status ENUM('success','failed') DEFAULT 'success',
  location VARCHAR(500),
  record_counts TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE quick_bill_physical_items
ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  product_id INT,
  product_name VARCHAR(500) NOT NULL,
  hsn_code VARCHAR(100),
  quantity INT NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  gst_percent DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
