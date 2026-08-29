# Olive Seeds Billing ERP — Database Recovery Audit

## 1. Current Database Status
The actual database is running on **MariaDB 10.4.32** (port 3306). A total of **36 tables** were successfully verified. While most tables exist and have their primary keys, indexes, and foreign keys intact, there are critical naming and column mismatches that break specific features (like the automated Google Drive Backup and Backup History logging).

Furthermore, the static `database.sql` file in the codebase is severely outdated, missing multiple tables and columns that have been added by migrations or manual edits but are actively required by the backend code.

---

## 2. Expected Database Structure
The application expects a combined schema from `backend/database.sql` and the incremental updates defined in:
1. `backend/migrate.js` (soft deletes, branches, warehouses, crm, project milestones, etc.)
2. `backend/utils/migrate.js` (quotations, digital invoices, quick bills, backup history, alter columns)
3. `backend/migrations/fix_all.sql` (google backups, altered history definitions)

---

## 3. Missing Tables
- **TOTAL MISSING TABLES:** `0`
- *Note:* All 36 expected tables exist in the actual database. However, they were created in an inconsistent order, preventing subsequent schema updates from running.

---

## 4. Missing Columns

### 4.1 Missing in the Current Database (Causes runtime failures)
- **Table:** `company_settings`
  - **Column:** `google_tokens`
- **Table:** `backup_history`
  - **Columns:** `filename`, `type`, `created_by`

### 4.2 Missing in Schema Files (Will cause failures on fresh deploy)
- **Table:** `quotations`
  - **Columns:** `quotation_title` (VARCHAR), `billing_city` (VARCHAR), `billing_state` (VARCHAR), `billing_pincode` (VARCHAR)
- **Table:** `raw_materials`
  - **Columns:** `category` (VARCHAR), `maximum_stock` (DECIMAL), `last_purchase_date` (DATE), `supplier_name` (VARCHAR), `location` (TEXT), `description` (TEXT), `is_active` (BOOLEAN)

---

## 5. Incorrect Columns / Data Types
- **Table:** `backup_history`
  - **Mismatches:**
    - Database has `backup_type` (VARCHAR(50)) but backend query expects `type` (ENUM).
    - Database has `records_count` (INT) but backend query expects `record_counts` (TEXT).

---

## 6. Missing Foreign Keys
- **Table:** `backup_history`
  - **Missing FK:** `created_by` should reference `users(id) ON DELETE SET NULL`. (Currently cannot be created because the column `created_by` is missing from the table).

---

## 7. Missing Indexes
- **Table:** `backup_history`
  - **Missing Index:** Index on `created_by` for faster joins with the `users` table.

---

## 8. Frontend → Backend Field Mismatches
- **File:** [DigitalInvoices.js](file:///d:/olive-seeds-erp/frontend/src/pages/DigitalInvoices.js)
  - The frontend correctly sends structured JSON matching the `/api/digital-invoices` (hyphenated route) payload.
  - An unused backend route file [digital_invoices.js](file:///d:/olive-seeds-erp/backend/routes/digital_invoices.js) (underscored) expects fields like `product_name`, `license_key`, and `price` directly inside `digital_invoices` instead of using the `digital_invoice_items` table. However, since the hyphenated route is the only one mounted in `server.js`, there is no active mismatch affecting the user interface.

---

## 9. Backend → Database Field Mismatches
All queries in the active application match the expected schema with the exception of the `backup` and `backup_history` fields.

---

## 10. Fields Sent by Frontend but Not Saved
- **Field:** `google_tokens`
  - **Frontend Page:** Settings / Backup Page
  - **Status:** Unsaved because the column `google_tokens` is missing from `company_settings` table.

---

## 11. Database Fields Never Used
- **Table:** `shipments`
  - **Column:** `customer_name`
  - **Status:** Unused. The backend queries join the `orders` table to retrieve `customer_name` dynamically.

---

## 12. Failed INSERT Operations

### Issue 1: Saving Backup Logs
- **FILE:** [backup.js](file:///d:/olive-seeds-erp/backend/routes/backup.js)
- **LINE:** 151-156
- **TABLE:** `backup_history`
- **COLUMN:** `filename`, `type`, `created_by`
- **CURRENT DATABASE:** Table does not contain these columns.
- **APPLICATION EXPECTATION:** Expects to save metadata of each created backup.
- **EVIDENCE:**
  ```javascript
  await db.query(`
    INSERT INTO backup_history 
    (filename, type, file_size, status, location, created_by)
    VALUES (?, ?, ?, ?, ?, ?)`, ...
  ```
- **SEVERITY:** **HIGH** (Causes backup logs to fail silently due to try-catch blocks)
- **RECOMMENDED FIX:** Add missing columns and alter the table structure to match the query expectation.

---

## 13. Failed UPDATE Operations

### Issue 2: Storing Google OAuth Tokens
- **FILE:** [backup.js](file:///d:/olive-seeds-erp/backend/routes/backup.js)
- **LINE:** 43-46
- **TABLE:** `company_settings`
- **COLUMN:** `google_tokens`
- **CURRENT DATABASE:** Column is missing.
- **APPLICATION EXPECTATION:** Expects to store Google OAuth JSON credentials.
- **EVIDENCE:**
  ```javascript
  await db.query(
    'UPDATE company_settings SET google_tokens = ?',
    [JSON.stringify(tokens)]
  );
  ```
- **SEVERITY:** **CRITICAL** (Completely breaks Google Drive automatic backup configuration)
- **RECOMMENDED FIX:** Add `google_tokens` column to `company_settings`.

---

## 14. Evidence From Source Code
The table `backup_history` was created on server startup via `backend/utils/migrate.js` using an outdated structure, which caused the correct definition inside `backend/migrations/fix_all.sql` (`CREATE TABLE IF NOT EXISTS backup_history ...`) to be ignored by MariaDB.

---

## 15. Database Restoration Plan

### PROPOSED SQL — DO NOT EXECUTE

```sql
-- 1. Restore missing google_tokens to company_settings
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS google_tokens TEXT AFTER google_drive_email;

-- 2. Drop the incorrect backup_history table structure (Caution: backup_history only contains metadata logs)
DROP TABLE IF EXISTS backup_history;

-- 3. Recreate backup_history with the correct columns expected by backup.js
CREATE TABLE backup_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(300) NOT NULL,
  type ENUM('manual', 'auto', 'google_drive') DEFAULT 'manual',
  file_size VARCHAR(50),
  status ENUM('success', 'failed') DEFAULT 'success',
  location TEXT,
  record_counts TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_backup_history_user (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Align raw_materials schema in case of rebuilds (extra columns expected by inventory.js)
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT NULL;
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS maximum_stock DECIMAL(10,3) DEFAULT 0.000;
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS last_purchase_date DATE DEFAULT NULL;
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(200) DEFAULT NULL;
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS location TEXT DEFAULT NULL;
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1;

-- 5. Align quotations schema in case of rebuilds (extra columns expected by quotations.js)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quotation_title VARCHAR(200) DEFAULT NULL;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100) DEFAULT NULL;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS billing_state VARCHAR(100) DEFAULT NULL;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS billing_pincode VARCHAR(10) DEFAULT NULL;
```
