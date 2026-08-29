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
