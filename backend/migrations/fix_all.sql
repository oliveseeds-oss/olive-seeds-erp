-- Google Drive backup columns
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS google_tokens TEXT,
ADD COLUMN IF NOT EXISTS google_drive_email VARCHAR(200),
ADD COLUMN IF NOT EXISTS google_drive_folder VARCHAR(200) DEFAULT 'OliveSeeds ERP Backups',
ADD COLUMN IF NOT EXISTS backup_frequency VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS backup_keep_count INT DEFAULT 10;

-- Backup history table
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

-- Add description columns to quick_bill items tables
ALTER TABLE quick_bill_physical_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;
ALTER TABLE quick_bill_digital_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

-- Add is_active columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
