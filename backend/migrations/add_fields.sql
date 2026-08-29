-- ============================================
-- ALTER ORDERS
-- ============================================
ALTER TABLE orders ADD COLUMN order_time TIME;
ALTER TABLE orders ADD COLUMN paid_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN balance_due DECIMAL(15,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN personalization_text TEXT;
ALTER TABLE orders ADD COLUMN remark TEXT;

-- ============================================
-- ALTER CUSTOMERS
-- ============================================
ALTER TABLE customers ADD COLUMN customer_type VARCHAR(100) DEFAULT 'Personal';
ALTER TABLE customers ADD COLUMN company_name VARCHAR(200);
ALTER TABLE customers ADD COLUMN pan VARCHAR(20);
ALTER TABLE customers ADD COLUMN alternate_phone VARCHAR(20);
ALTER TABLE customers ADD COLUMN currency VARCHAR(10) DEFAULT 'INR';
ALTER TABLE customers ADD COLUMN customer_group VARCHAR(100) DEFAULT 'Regular';
ALTER TABLE customers ADD COLUMN credit_limit DECIMAL(15,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- ============================================
-- ALTER PRODUCTS
-- ============================================
ALTER TABLE products ADD COLUMN SAC_code VARCHAR(20);

-- ============================================
-- ALTER EXPENSES
-- ============================================
ALTER TABLE expenses ADD COLUMN gst_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE expenses ADD COLUMN gst_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE expenses ADD COLUMN reference_number VARCHAR(100);
ALTER TABLE expenses ADD COLUMN receipt_image_url VARCHAR(500);

-- ============================================
-- ALTER SUPPLIERS
-- ============================================
ALTER TABLE suppliers ADD COLUMN pan VARCHAR(20);
ALTER TABLE suppliers ADD COLUMN alternate_phone VARCHAR(20);
ALTER TABLE suppliers ADD COLUMN bank_name VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN bank_account_no VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN ifsc_code VARCHAR(50);
ALTER TABLE suppliers ADD COLUMN payment_terms VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN credit_limit DECIMAL(15,2) DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN outstanding_balance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- ============================================
-- ALTER SHIPMENTS
-- ============================================
ALTER TABLE shipments ADD COLUMN invoice_number VARCHAR(100);
ALTER TABLE shipments ADD COLUMN actual_delivery DATE;
ALTER TABLE shipments ADD COLUMN volumetric_weight DECIMAL(10,3) DEFAULT 0;
ALTER TABLE shipments ADD COLUMN cod_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE shipments ADD COLUMN shipping_label_url VARCHAR(500);

