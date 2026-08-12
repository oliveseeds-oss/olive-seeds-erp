require('dotenv').config();
const db = require('./utils/db');

async function run() {
  console.log('Running database schema migration...');
  try {
    // 1. Branches table
    await db.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        branch_code VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        pincode VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )
    `);
    console.log('✓ branches table checked/created');

    // 2. Warehouses table
    await db.query(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        warehouse_code VARCHAR(20) UNIQUE NOT NULL,
        branch_id INT,
        name VARCHAR(150) NOT NULL,
        location TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )
    `);
    console.log('✓ warehouses table checked/created');

    // 3. Leads table
    await db.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id VARCHAR(30) UNIQUE NOT NULL,
        customer_name VARCHAR(200) NOT NULL,
        company_name VARCHAR(200),
        email VARCHAR(150),
        phone VARCHAR(20),
        whatsapp VARCHAR(20),
        source VARCHAR(100),
        status ENUM('lead', 'enquiry', 'qualified', 'proposal', 'negotiation', 'won', 'lost') DEFAULT 'lead',
        assigned_to INT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )
    `);
    console.log('✓ leads table checked/created');

    // 4. CRM Activities table
    await db.query(`
      CREATE TABLE IF NOT EXISTS crm_activities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT,
        customer_id INT,
        activity_type ENUM('call', 'meeting', 'whatsapp', 'email', 'task', 'reminder', 'note') NOT NULL,
        description TEXT,
        due_date DATETIME NULL,
        completed_at DATETIME NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    console.log('✓ crm_activities table checked/created');

    // 5. Digital Services table
    await db.query(`
      CREATE TABLE IF NOT EXISTS digital_services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        service_category VARCHAR(100),
        pricing_model ENUM('fixed', 'hourly', 'retainer') DEFAULT 'fixed',
        hourly_rate DECIMAL(15,2) DEFAULT 0,
        estimated_duration VARCHAR(100),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ digital_services table checked/created');

    // 6. Project Milestones table
    await db.query(`
      CREATE TABLE IF NOT EXISTS project_milestones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        due_date DATE,
        status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
        completed_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ project_milestones table checked/created');

    // 7. Add deleted_at columns for soft-deletes (checking if they exist first)
    const tablesToAlter = ['products', 'customers', 'orders', 'invoices'];
    for (const t of tablesToAlter) {
      try {
        await db.query(`ALTER TABLE ${t} ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL`);
        console.log(`✓ Soft-delete column added to ${t}`);
      } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
          console.log(`✓ Soft-delete column already exists on ${t}`);
        } else {
          throw err;
        }
      }
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
