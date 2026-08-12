-- ============================================
-- ALTER ORDERS
-- ============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_time TIME;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS balance_due DECIMAL(15,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS personalization_text TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS remark TEXT;

-- ============================================
-- ALTER CUSTOMERS
-- ============================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type VARCHAR(100) DEFAULT 'Personal';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name VARCHAR(200);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pan VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS alternate_phone VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_group VARCHAR(100) DEFAULT 'Regular';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ============================================
-- ALTER PRODUCTS
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS SAC_code VARCHAR(20);

-- ============================================
-- ALTER EXPENSES
-- ============================================
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS gst_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_image_url VARCHAR(500);

-- ============================================
-- ALTER SUPPLIERS
-- ============================================
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS pan VARCHAR(20);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS alternate_phone VARCHAR(20);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(50);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2) DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS outstanding_balance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ============================================
-- ALTER SHIPMENTS
-- ============================================
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS actual_delivery DATE;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS volumetric_weight DECIMAL(10,3) DEFAULT 0;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS cod_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS shipping_label_url VARCHAR(500);
