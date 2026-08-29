const db = require('./db');

const fs = require('fs');
const path = require('path');

async function runMigrations() {
  console.log('Running database migrations...');
  try {
    // 0. Verify if core tables (like users) exist. If not, run database.sql schema first.
    let schemaNeeded = false;
    try {
      await db.query('SELECT 1 FROM users LIMIT 1');
    } catch (err) {
      console.log('Verification check for users table failed:', err.message);
      schemaNeeded = true;
    }


    if (schemaNeeded) {
      const dbSqlPath = path.join(__dirname, '../database.sql');
      if (fs.existsSync(dbSqlPath)) {
        console.log('Core tables missing. Loading database.sql schema...');
        const sqlContent = fs.readFileSync(dbSqlPath, 'utf8');
        
        // Advanced SQL splitter that ignores comments and extracts statements correctly
        const statements = [];
        let currentStatement = '';
        const lines = sqlContent.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
            continue;
          }
          currentStatement += line + '\n';
          if (trimmed.endsWith(';')) {
            const stmt = currentStatement.trim().replace(/;$/, '');
            if (stmt && !stmt.startsWith('CREATE DATABASE') && !stmt.startsWith('USE')) {
              statements.push(stmt);
            }
            currentStatement = '';
          }
        }
        
        for (const statement of statements) {
          try {
            await db.query(statement);
          } catch (stmtErr) {
            console.error('Error executing statement from database.sql:', stmtErr.message, 'Query:', statement.substring(0, 100));
          }
        }
        console.log('✓ database.sql executed successfully.');
      }
    }


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

    // Company Settings Backup fields
    await addColumnSafely('company_settings', 'backup_frequency', "VARCHAR(50) DEFAULT 'Weekly'");
    await addColumnSafely('company_settings', 'backup_folder', "VARCHAR(255) DEFAULT 'OliveSeeds ERP Backups'");
    await addColumnSafely('company_settings', 'keep_backups', 'INT DEFAULT 10');
    await addColumnSafely('company_settings', 'google_drive_connected', 'BOOLEAN DEFAULT FALSE');
    await addColumnSafely('company_settings', 'google_drive_email', 'VARCHAR(255)');
    await addColumnSafely('company_settings', 'default_signature_path', 'VARCHAR(500) DEFAULT NULL');
    await addColumnSafely('company_settings', 'logo_path', 'VARCHAR(500) DEFAULT NULL');

    // Quick Bill counters
    await addColumnSafely('company_settings', 'counter_cm', 'INT DEFAULT 1');
    await addColumnSafely('company_settings', 'counter_ph', 'INT DEFAULT 1');
    await addColumnSafely('company_settings', 'counter_db', 'INT DEFAULT 1');
    await addColumnSafely('company_settings', 'counter_dg', 'INT DEFAULT 1');

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

    // Execute queries from migrations/fix_all.sql
    const fixAllPath = path.join(__dirname, '../migrations/fix_all.sql');
    if (fs.existsSync(fixAllPath)) {

      console.log('Running migrations/fix_all.sql...');
      const sqlContent = fs.readFileSync(fixAllPath, 'utf8');
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        try {
          await db.query(statement);
        } catch (err) {
          // Ignore duplicate column errors or duplicate key errors
          if (!err.message.includes('Duplicate column name') && !err.message.includes('already exists')) {
            console.error('Error running statement from fix_all.sql:', statement, err.message);
          }
        }
      }
      console.log('✓ migrations/fix_all.sql executed successfully.');
    }

    console.log('Database migrations completed successfully.');
  } catch (err) {
    console.error('Error running migrations:', err);
  }
}

module.exports = runMigrations;
