const db = require('./db');

const fs = require('fs');
const path = require('path');

async function runMigrations() {
  console.log('Running database migrations...');
  try {
    // 0. Always ensure ALL core tables exist using IF NOT EXISTS — safe to run every time

    // users
    await db.query(`CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin','employee','viewer') NOT NULL DEFAULT 'viewer',
      phone VARCHAR(20),
      is_active BOOLEAN DEFAULT TRUE,
      last_login DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    // company_settings
    await db.query(`CREATE TABLE IF NOT EXISTS company_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_name VARCHAR(200) NOT NULL DEFAULT 'My Company',
      gstin VARCHAR(20),
      pan VARCHAR(15),
      email VARCHAR(100),
      phone VARCHAR(20),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100) DEFAULT 'Tamil Nadu',
      pincode VARCHAR(10),
      country VARCHAR(100) DEFAULT 'India',
      invoice_prefix VARCHAR(10) DEFAULT 'OS',
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
    )`);

    // categories
    await db.query(`CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      parent_id INT,
      type ENUM('physical','digital','service') DEFAULT 'physical',
      description TEXT
    )`);

    // customers
    await db.query(`CREATE TABLE IF NOT EXISTS customers (
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
      customer_group VARCHAR(100),
      credit_limit DECIMAL(15,2) DEFAULT 0,
      outstanding_balance DECIMAL(15,2) DEFAULT 0,
      notes TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      deleted_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    // suppliers
    await db.query(`CREATE TABLE IF NOT EXISTS suppliers (
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
    )`);

    // products
    await db.query(`CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id VARCHAR(30) UNIQUE NOT NULL,
      product_type ENUM('physical','digital','service') DEFAULT 'physical',
      sku VARCHAR(100) UNIQUE,
      name VARCHAR(500) NOT NULL,
      category_id INT,
      material VARCHAR(200),
      color VARCHAR(100),
      size VARCHAR(100),
      thickness VARCHAR(50),
      weight DECIMAL(10,3),
      description TEXT,
      hsn_code VARCHAR(20),
      sac_code VARCHAR(20),
      gst_percent DECIMAL(5,2) DEFAULT 18,
      purchase_price DECIMAL(15,2) DEFAULT 0,
      selling_price DECIMAL(15,2) NOT NULL DEFAULT 0,
      bulk_price DECIMAL(15,2),
      bulk_min_qty INT DEFAULT 1,
      stock INT DEFAULT 0,
      reorder_level INT DEFAULT 5,
      image_urls TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      marketplace_website BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    // inventory_movements
    await db.query(`CREATE TABLE IF NOT EXISTS inventory_movements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      movement_type ENUM('in','out','adjustment','damage','return','transfer') NOT NULL,
      quantity INT NOT NULL,
      reference_type VARCHAR(50),
      reference_id INT,
      notes TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // raw_materials
    await db.query(`CREATE TABLE IF NOT EXISTS raw_materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      material_id VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(200) NOT NULL,
      unit VARCHAR(50),
      stock DECIMAL(10,3) DEFAULT 0,
      reorder_level DECIMAL(10,3) DEFAULT 0,
      purchase_price DECIMAL(15,2) DEFAULT 0,
      supplier_id INT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // orders
    await db.query(`CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(30) UNIQUE NOT NULL,
      order_type ENUM('regular','bulk','digital','service') DEFAULT 'regular',
      source ENUM('website','amazon','flipkart','etsy','instagram','whatsapp','manual','walkin') DEFAULT 'manual',
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
      discount_percent DECIMAL(5,2) DEFAULT 0,
      cgst DECIMAL(15,2) DEFAULT 0,
      sgst DECIMAL(15,2) DEFAULT 0,
      igst DECIMAL(15,2) DEFAULT 0,
      total_tax DECIMAL(15,2) DEFAULT 0,
      shipping_cost DECIMAL(15,2) DEFAULT 0,
      total DECIMAL(15,2) DEFAULT 0,
      paid_amount DECIMAL(15,2) DEFAULT 0,
      balance_due DECIMAL(15,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'INR',
      exchange_rate DECIMAL(10,4) DEFAULT 1,
      payment_status ENUM('pending','partial','paid','refunded') DEFAULT 'pending',
      payment_method VARCHAR(50),
      notes TEXT,
      personalization_notes TEXT,
      personalization_text TEXT,
      remark TEXT,
      is_gst_invoice BOOLEAN DEFAULT TRUE,
      is_international BOOLEAN DEFAULT FALSE,
      tracking_number VARCHAR(200),
      courier VARCHAR(100),
      courier_name VARCHAR(200),
      awb_number VARCHAR(100),
      order_time TIME,
      shipped_at DATETIME,
      delivered_at DATETIME,
      deleted_at TIMESTAMP NULL DEFAULT NULL,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    // order_items
    await db.query(`CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT,
      product_name VARCHAR(500) NOT NULL,
      sku VARCHAR(100),
      hsn_code VARCHAR(20),
      quantity INT NOT NULL,
      unit_price DECIMAL(15,2) NOT NULL,
      discount DECIMAL(15,2) DEFAULT 0,
      discount_percent DECIMAL(5,2) DEFAULT 0,
      gst_percent DECIMAL(5,2) DEFAULT 0,
      cgst_amount DECIMAL(15,2) DEFAULT 0,
      sgst_amount DECIMAL(15,2) DEFAULT 0,
      igst_amount DECIMAL(15,2) DEFAULT 0,
      subtotal DECIMAL(15,2) DEFAULT 0,
      total DECIMAL(15,2) NOT NULL DEFAULT 0,
      personalization TEXT,
      size VARCHAR(100),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`);

    // invoices
    await db.query(`CREATE TABLE IF NOT EXISTS invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      invoice_type ENUM('tax','retail','wholesale','corporate','proforma','quotation','delivery_challan','credit_note','debit_note','estimate','purchase','commercial','gift','sample') DEFAULT 'tax',
      order_id INT,
      customer_id INT,
      supplier_id INT,
      customer_name VARCHAR(200),
      customer_email VARCHAR(150),
      customer_phone VARCHAR(20),
      invoice_date DATE NOT NULL,
      due_date DATE,
      subtotal DECIMAL(15,2) DEFAULT 0,
      discount DECIMAL(15,2) DEFAULT 0,
      cgst DECIMAL(15,2) DEFAULT 0,
      sgst DECIMAL(15,2) DEFAULT 0,
      igst DECIMAL(15,2) DEFAULT 0,
      total_tax DECIMAL(15,2) DEFAULT 0,
      shipping_cost DECIMAL(15,2) DEFAULT 0,
      total DECIMAL(15,2) NOT NULL DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'INR',
      exchange_rate DECIMAL(10,4) DEFAULT 1,
      payment_status ENUM('pending','partial','paid','refunded') DEFAULT 'pending',
      paid_amount DECIMAL(15,2) DEFAULT 0,
      balance_due DECIMAL(15,2) DEFAULT 0,
      payment_mode VARCHAR(50),
      is_finalized BOOLEAN DEFAULT FALSE,
      notes TEXT,
      terms TEXT,
      internal_notes TEXT,
      is_international BOOLEAN DEFAULT FALSE,
      country_of_origin VARCHAR(100) DEFAULT 'India',
      country_of_destination VARCHAR(100),
      hs_code VARCHAR(20),
      weight DECIMAL(10,3),
      declaration TEXT,
      deleted_at TIMESTAMP NULL DEFAULT NULL,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // invoice_items
    await db.query(`CREATE TABLE IF NOT EXISTS invoice_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL,
      product_id INT,
      product_name VARCHAR(500) NOT NULL,
      hsn_code VARCHAR(20),
      quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
      discount_percent DECIMAL(5,2) DEFAULT 0,
      gst_percent DECIMAL(5,2) DEFAULT 0,
      cgst_amount DECIMAL(15,2) DEFAULT 0,
      sgst_amount DECIMAL(15,2) DEFAULT 0,
      igst_amount DECIMAL(15,2) DEFAULT 0,
      total DECIMAL(15,2) NOT NULL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )`);

    // payments
    await db.query(`CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      payment_id VARCHAR(30) UNIQUE NOT NULL,
      invoice_id INT,
      order_id INT,
      customer_id INT,
      customer_name VARCHAR(200),
      amount DECIMAL(15,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      payment_method ENUM('cash','upi','card','netbanking','paypal','razorpay','stripe','bank_transfer','cod','advance','partial','wallet') NOT NULL,
      transaction_id VARCHAR(200),
      payment_date DATE NOT NULL,
      status ENUM('pending','completed','failed','refunded') DEFAULT 'completed',
      bank_name VARCHAR(200),
      cheque_number VARCHAR(50),
      clearing_date DATE,
      refund_amount DECIMAL(15,2) DEFAULT 0,
      notes TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // shipments
    await db.query(`CREATE TABLE IF NOT EXISTS shipments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shipment_id VARCHAR(30) UNIQUE NOT NULL,
      order_id INT NOT NULL,
      customer_name VARCHAR(200),
      courier ENUM('shiprocket','amazon','fedex','ups','dhl','aramex','indiapost','dtdc','bluedart','other') DEFAULT 'other',
      tracking_number VARCHAR(200),
      awb_number VARCHAR(200),
      weight DECIMAL(10,3),
      shipping_cost DECIMAL(15,2) DEFAULT 0,
      actual_delivery DATE,
      expected_delivery DATE,
      cod_amount DECIMAL(15,2) DEFAULT 0,
      insurance_amount DECIMAL(15,2) DEFAULT 0,
      status ENUM('pending','picked','in_transit','out_delivery','delivered','returned') DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // expenses
    await db.query(`CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      expense_id VARCHAR(20) UNIQUE NOT NULL,
      category VARCHAR(200) NOT NULL,
      description TEXT,
      amount DECIMAL(15,2) NOT NULL,
      gst_amount DECIMAL(15,2) DEFAULT 0,
      gst_percent DECIMAL(5,2) DEFAULT 0,
      expense_date DATE NOT NULL,
      payment_method VARCHAR(50),
      vendor VARCHAR(200),
      reference_number VARCHAR(200),
      receipt_path VARCHAR(500),
      deleted_at TIMESTAMP NULL DEFAULT NULL,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // gst_returns
    await db.query(`CREATE TABLE IF NOT EXISTS gst_returns (
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
    )`);

    // bulk_order_batches
    await db.query(`CREATE TABLE IF NOT EXISTS bulk_order_batches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      batch_id VARCHAR(30) UNIQUE NOT NULL,
      name VARCHAR(200),
      total_orders INT DEFAULT 0,
      source_file VARCHAR(500),
      status ENUM('processing','completed','failed') DEFAULT 'processing',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // activity_log
    await db.query(`CREATE TABLE IF NOT EXISTS activity_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      action VARCHAR(100) NOT NULL,
      module VARCHAR(100),
      record_id INT,
      old_value TEXT,
      new_value TEXT,
      ip_address VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // change_requests
    await db.query(`CREATE TABLE IF NOT EXISTS change_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      requested_by INT NOT NULL,
      module VARCHAR(100) NOT NULL,
      record_id INT,
      change_type VARCHAR(200),
      field_name VARCHAR(100),
      current_value TEXT,
      requested_value TEXT,
      priority ENUM('low','medium','high') DEFAULT 'medium',
      reason TEXT,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      reviewed_by INT,
      reviewed_at DATETIME,
      review_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Ensure default company settings row exists
    try {
      const [[cs]] = await db.query('SELECT id FROM company_settings LIMIT 1');
      if (!cs) {
        await db.query(`INSERT INTO company_settings (company_name, state, country, invoice_prefix, currency)
          VALUES ('Olive Seeds Design Studio', 'Tamil Nadu', 'India', 'OS', 'INR')`);
        console.log('✓ Default company settings inserted.');
      }
    } catch(e) { console.log('Company settings check note:', e.message); }

    console.log('✓ All core tables verified/created.');



    // 1. Create quotations tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_number VARCHAR(50) UNIQUE NOT NULL,
        quotation_date DATE NOT NULL,
        valid_until DATE,
        customer_id INT,
        customer_name VARCHAR(200),
        customer_email VARCHAR(150),
        customer_phone VARCHAR(20),
        customer_company VARCHAR(200),
        customer_gstin VARCHAR(20),
        billing_address TEXT,
        subtotal DECIMAL(15,2) DEFAULT 0,
        discount DECIMAL(15,2) DEFAULT 0,
        cgst DECIMAL(15,2) DEFAULT 0,
        sgst DECIMAL(15,2) DEFAULT 0,
        igst DECIMAL(15,2) DEFAULT 0,
        total_tax DECIMAL(15,2) DEFAULT 0,
        shipping_estimate DECIMAL(15,2) DEFAULT 0,
        total DECIMAL(15,2) DEFAULT 0,
        notes TEXT,
        terms TEXT,
        internal_notes TEXT,
        status ENUM('draft','sent','accepted','rejected','expired') DEFAULT 'draft',
        remark TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_id INT NOT NULL,
        product_name VARCHAR(500) NOT NULL,
        description TEXT,
        size VARCHAR(100),
        quantity INT NOT NULL,
        unit VARCHAR(50),
        unit_price DECIMAL(15,2) NOT NULL,
        discount_percent DECIMAL(5,2) DEFAULT 0,
        gst_percent DECIMAL(5,2) DEFAULT 0,
        cgst_amount DECIMAL(15,2) DEFAULT 0,
        sgst_amount DECIMAL(15,2) DEFAULT 0,
        igst_amount DECIMAL(15,2) DEFAULT 0,
        total DECIMAL(15,2) NOT NULL,
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      )
    `);

    // 2. Create digital_invoices tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS digital_invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE,
        customer_id INT,
        customer_name VARCHAR(200) NOT NULL,
        customer_email VARCHAR(150) NOT NULL,
        customer_phone VARCHAR(20),
        customer_gstin VARCHAR(20),
        billing_address TEXT,
        delivery_method VARCHAR(100),
        download_link TEXT,
        download_password VARCHAR(100),
        link_expiry DATE,
        download_limit INT DEFAULT 5,
        file_size VARCHAR(50),
        version_number VARCHAR(50),
        subtotal DECIMAL(15,2) DEFAULT 0,
        discount DECIMAL(15,2) DEFAULT 0,
        cgst DECIMAL(15,2) DEFAULT 0,
        sgst DECIMAL(15,2) DEFAULT 0,
        igst DECIMAL(15,2) DEFAULT 0,
        total_tax DECIMAL(15,2) DEFAULT 0,
        total DECIMAL(15,2) DEFAULT 0,
        paid_amount DECIMAL(15,2) DEFAULT 0,
        payment_mode VARCHAR(50),
        payment_status ENUM('paid','partial','unpaid','draft') DEFAULT 'unpaid',
        notes TEXT,
        internal_notes TEXT,
        status ENUM('draft','sent','paid','delivered','cancelled') DEFAULT 'draft',
        remark TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS digital_invoice_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        digital_invoice_id INT NOT NULL,
        product_name VARCHAR(500) NOT NULL,
        item_type VARCHAR(100),
        description TEXT,
        file_format VARCHAR(100),
        license_type VARCHAR(100),
        quantity INT DEFAULT 1,
        unit VARCHAR(50),
        unit_price DECIMAL(15,2) NOT NULL,
        discount_percent DECIMAL(5,2) DEFAULT 0,
        gst_percent DECIMAL(5,2) DEFAULT 18,
        cgst_amount DECIMAL(15,2) DEFAULT 0,
        sgst_amount DECIMAL(15,2) DEFAULT 0,
        igst_amount DECIMAL(15,2) DEFAULT 0,
        total DECIMAL(15,2) NOT NULL,
        FOREIGN KEY (digital_invoice_id) REFERENCES digital_invoices(id) ON DELETE CASCADE
      )
    `);

    // Create backup_history table
    await db.query(`
      CREATE TABLE IF NOT EXISTS backup_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        backup_type VARCHAR(50) DEFAULT 'Manual',
        file_size VARCHAR(50),
        records_count INT DEFAULT 0,
        location VARCHAR(255) DEFAULT 'Local',
        status VARCHAR(50) DEFAULT 'Success'
      )
    `);

    // Create quick_bills_physical
    await db.query(`
      CREATE TABLE IF NOT EXISTS quick_bills_physical (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_number VARCHAR(50) UNIQUE NOT NULL,
        bill_type ENUM('cash_memo','gst_invoice') DEFAULT 'cash_memo',
        bill_date DATE NOT NULL,
        bill_time TIME NOT NULL,
        customer_name VARCHAR(200),
        customer_phone VARCHAR(20),
        customer_gstin VARCHAR(20),
        customer_company VARCHAR(200),
        subtotal DECIMAL(15,2) NOT NULL,
        gst_percent DECIMAL(5,2) DEFAULT 0,
        gst_amount DECIMAL(15,2) DEFAULT 0,
        total DECIMAL(15,2) NOT NULL,
        amount_received DECIMAL(15,2) DEFAULT 0,
        change_amount DECIMAL(15,2) DEFAULT 0,
        balance_due DECIMAL(15,2) DEFAULT 0,
        payment_mode ENUM('cash','upi','card','bank') DEFAULT 'cash',
        payment_status ENUM('paid','partial','unpaid') DEFAULT 'paid',
        upi_reference VARCHAR(200),
        card_last4 VARCHAR(4),
        terminal_id VARCHAR(100),
        bank_utr VARCHAR(200),
        bank_name VARCHAR(200),
        internal_notes TEXT,
        created_by INT,
        created_by_name VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create quick_bill_physical_items
    await db.query(`
      CREATE TABLE IF NOT EXISTS quick_bill_physical_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_id INT NOT NULL,
        product_id INT,
        product_name VARCHAR(500) NOT NULL,
        description TEXT,
        quantity INT NOT NULL,
        unit_price DECIMAL(15,2) NOT NULL,
        discount_percent DECIMAL(5,2) DEFAULT 0,
        amount DECIMAL(15,2) NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES quick_bills_physical(id) ON DELETE CASCADE
      )
    `);


    // Create quick_bills_digital
    await db.query(`
      CREATE TABLE IF NOT EXISTS quick_bills_digital (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_number VARCHAR(50) UNIQUE NOT NULL,
        bill_type ENUM('simple_receipt','gst_invoice') DEFAULT 'simple_receipt',
        bill_date DATE NOT NULL,
        bill_time TIME NOT NULL,
        customer_name VARCHAR(200) NOT NULL,
        customer_email VARCHAR(150) NOT NULL,
        customer_phone VARCHAR(20),
        customer_gstin VARCHAR(20),
        customer_company VARCHAR(200),
        has_digital_files BOOLEAN DEFAULT FALSE,
        download_link TEXT,
        link_password VARCHAR(200),
        link_valid_until DATE,
        subtotal DECIMAL(15,2) NOT NULL,
        gst_percent DECIMAL(5,2) DEFAULT 0,
        gst_amount DECIMAL(15,2) DEFAULT 0,
        total DECIMAL(15,2) NOT NULL,
        amount_received DECIMAL(15,2) DEFAULT 0,
        change_amount DECIMAL(15,2) DEFAULT 0,
        balance_due DECIMAL(15,2) DEFAULT 0,
        payment_mode ENUM('upi','card','bank','cash') DEFAULT 'upi',
        payment_status ENUM('paid','partial','unpaid') DEFAULT 'paid',
        upi_reference VARCHAR(200),
        card_last4 VARCHAR(4),
        terminal_id VARCHAR(100),
        bank_utr VARCHAR(200),
        bank_name VARCHAR(200),
        internal_notes TEXT,
        created_by INT,
        created_by_name VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create quick_bill_digital_items
    await db.query(`
      CREATE TABLE IF NOT EXISTS quick_bill_digital_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_id INT NOT NULL,
        item_type VARCHAR(100) NOT NULL,
        product_name VARCHAR(500) NOT NULL,
        description TEXT,
        file_format VARCHAR(100),
        license_type VARCHAR(100),
        quantity INT DEFAULT 1,
        unit_price DECIMAL(15,2) NOT NULL,
        discount_percent DECIMAL(5,2) DEFAULT 0,
        amount DECIMAL(15,2) NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES quick_bills_digital(id) ON DELETE CASCADE
      )
    `);

    // 3. Alter existing tables to add columns safely (handling duplicate column name error)
    const addColumnSafely = async (table, column, definition) => {
      try {
        await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      } catch (err) {
        if (!err.message.includes('Duplicate column name')) {
          console.error(`Error adding column ${column} to table ${table}:`, err.message);
        }
      }
    };

    // User signature path
    await addColumnSafely('users', 'signature_path', 'VARCHAR(500) DEFAULT NULL');
    await addColumnSafely('users', 'is_active', 'BOOLEAN DEFAULT TRUE');

    // Company Settings Backup fields
    await addColumnSafely('company_settings', 'backup_frequency', "VARCHAR(50) DEFAULT 'Weekly'");
    await addColumnSafely('company_settings', 'backup_folder', "VARCHAR(255) DEFAULT 'OliveSeeds ERP Backups'");
    await addColumnSafely('company_settings', 'keep_backups', 'INT DEFAULT 10');
    await addColumnSafely('company_settings', 'google_drive_connected', 'BOOLEAN DEFAULT FALSE');
    await addColumnSafely('company_settings', 'google_drive_email', 'VARCHAR(255)');
    await addColumnSafely('company_settings', 'google_tokens', 'TEXT');
    await addColumnSafely('company_settings', 'google_drive_folder', "VARCHAR(255) DEFAULT 'OliveSeeds ERP Backups'");
    await addColumnSafely('company_settings', 'backup_keep_count', 'INT DEFAULT 10');
    await addColumnSafely('company_settings', 'default_signature_path', 'VARCHAR(500) DEFAULT NULL');
    await addColumnSafely('company_settings', 'logo_path', 'VARCHAR(500) DEFAULT NULL');

    // Quick Bill counters
    await addColumnSafely('company_settings', 'counter_cm', 'INT DEFAULT 1');
    await addColumnSafely('company_settings', 'counter_ph', 'INT DEFAULT 1');
    await addColumnSafely('company_settings', 'counter_db', 'INT DEFAULT 1');
    await addColumnSafely('company_settings', 'counter_dg', 'INT DEFAULT 1');

    // Quick Bill physical items
    await addColumnSafely('quick_bill_physical_items', 'description', 'TEXT DEFAULT NULL');
    await addColumnSafely('quick_bill_digital_items', 'description', 'TEXT DEFAULT NULL');


    // Orders
    await addColumnSafely('orders', 'order_time', 'TIME');
    await addColumnSafely('orders', 'courier_name', 'VARCHAR(200)');
    await addColumnSafely('orders', 'personalization_text', 'TEXT');
    await addColumnSafely('orders', 'remark', 'TEXT');
    await addColumnSafely('orders', 'discount_percent', 'DECIMAL(5,2) DEFAULT 0');
    await addColumnSafely('orders', 'paid_amount', 'DECIMAL(15,2) DEFAULT 0');
    await addColumnSafely('orders', 'balance_due', 'DECIMAL(15,2) DEFAULT 0');

    // Order Items
    await addColumnSafely('order_items', 'size', 'VARCHAR(100)');
    await addColumnSafely('order_items', 'discount_percent', 'DECIMAL(5,2) DEFAULT 0');
    await addColumnSafely('order_items', 'subtotal', 'DECIMAL(15,2) DEFAULT 0');
    await addColumnSafely('order_items', 'personalization', 'TEXT');

    // Customers
    await addColumnSafely('customers', 'customer_type', "VARCHAR(100) DEFAULT 'Personal'");
    await addColumnSafely('customers', 'company_name', 'VARCHAR(200)');
    await addColumnSafely('customers', 'pan', 'VARCHAR(20)');
    await addColumnSafely('customers', 'alternate_phone', 'VARCHAR(20)');
    await addColumnSafely('customers', 'alt_phone', 'VARCHAR(20)');
    await addColumnSafely('customers', 'currency', "VARCHAR(10) DEFAULT 'INR'");
    await addColumnSafely('customers', 'customer_group', "VARCHAR(100) DEFAULT 'Regular'");
    await addColumnSafely('customers', 'credit_limit', 'DECIMAL(15,2) DEFAULT 0');
    await addColumnSafely('customers', 'is_active', 'BOOLEAN DEFAULT TRUE');

    // Products
    await addColumnSafely('products', 'SAC_code', 'VARCHAR(20)');
    await addColumnSafely('products', 'sac_code', 'VARCHAR(20)');
    await addColumnSafely('products', 'bulk_min_qty', 'INT DEFAULT 1');
    await addColumnSafely('products', 'marketplace_website', 'BOOLEAN DEFAULT FALSE');
    await addColumnSafely('products', 'is_active', 'BOOLEAN DEFAULT TRUE');

    // Expenses
    await addColumnSafely('expenses', 'gst_amount', 'DECIMAL(15,2) DEFAULT 0');
    await addColumnSafely('expenses', 'gst_percent', 'DECIMAL(5,2) DEFAULT 0');
    await addColumnSafely('expenses', 'reference_number', 'VARCHAR(200)');
    await addColumnSafely('expenses', 'receipt_image_url', 'VARCHAR(500)');

    // Payments
    await addColumnSafely('payments', 'bank_name', 'VARCHAR(200)');
    await addColumnSafely('payments', 'cheque_number', 'VARCHAR(50)');
    await addColumnSafely('payments', 'clearing_date', 'DATE');
    await addColumnSafely('payments', 'refund_amount', 'DECIMAL(15,2) DEFAULT 0');
    await addColumnSafely('payments', 'refund_date', 'DATE');

    // Suppliers
    await addColumnSafely('suppliers', 'pan', 'VARCHAR(20)');
    await addColumnSafely('suppliers', 'alternate_phone', 'VARCHAR(20)');
    await addColumnSafely('suppliers', 'bank_name', 'VARCHAR(100)');
    await addColumnSafely('suppliers', 'bank_account_no', 'VARCHAR(100)');
    await addColumnSafely('suppliers', 'ifsc_code', 'VARCHAR(50)');
    await addColumnSafely('suppliers', 'payment_terms', 'VARCHAR(100)');
    await addColumnSafely('suppliers', 'credit_limit', 'DECIMAL(15,2) DEFAULT 0');
    await addColumnSafely('suppliers', 'outstanding_balance', 'DECIMAL(15,2) DEFAULT 0');
    await addColumnSafely('suppliers', 'is_active', 'BOOLEAN DEFAULT TRUE');

    // Shipments
    await addColumnSafely('shipments', 'invoice_number', 'VARCHAR(100)');
    await addColumnSafely('shipments', 'actual_delivery', 'DATE');
    await addColumnSafely('shipments', 'volumetric_weight', 'DECIMAL(10,3) DEFAULT 0');
    await addColumnSafely('shipments', 'cod_amount', 'DECIMAL(15,2) DEFAULT 0');
    await addColumnSafely('shipments', 'insurance_amount', 'DECIMAL(15,2) DEFAULT 0');
    await addColumnSafely('shipments', 'shipping_label_url', 'VARCHAR(500)');

    // Add deleted_at columns for orders, invoices, quotations, and expenses
    await addColumnSafely('orders', 'deleted_at', 'TIMESTAMP NULL DEFAULT NULL');
    await addColumnSafely('invoices', 'deleted_at', 'TIMESTAMP NULL DEFAULT NULL');
    await addColumnSafely('quotations', 'deleted_at', 'TIMESTAMP NULL DEFAULT NULL');
    await addColumnSafely('expenses', 'deleted_at', 'TIMESTAMP NULL DEFAULT NULL');

    // Execute queries from migrations/fix_all.sql
    const fixAllPath = path.join(__dirname, '../migrations/fix_all.sql');
    if (fs.existsSync(fixAllPath)) {
      console.log('Running migrations/fix_all.sql...');
      const sqlContent = fs.readFileSync(fixAllPath, 'utf8');
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const stmt of statements) {
        try {
          await db.query(stmt);
        } catch (err) {
          // Log but continue — some columns may already exist
          console.log('Migration note:', err.message);
        }
      }
      console.log('✓ migrations/fix_all.sql executed successfully.');
    }

    console.log('Migration complete');
  } catch (err) {
    console.error('Error running migrations:', err);
  }
}

module.exports = runMigrations;
