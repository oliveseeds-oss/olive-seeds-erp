const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const upload = multer({ dest: 'uploads/temp/' });

function arrayToCSV(arr) {
  if (!arr || !arr.length) return '';
  const headers = Object.keys(arr[0]);
  const headerLine = headers.join(',');
  const rowLines = arr.map(row => 
    headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
        return `"${str}"`;
      }
      return str;
    }).join(',')
  );
  return [headerLine, ...rowLines].join('\n');
}

function parseCSV(csvText) {
  if (!csvText) return [];
  const lines = [];
  let row = [""];
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const next = csvText[i+1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',') {
      if (inQuotes) {
        row[row.length - 1] += ',';
      } else {
        row.push('');
      }
    } else if (char === '\n' || char === '\r') {
      if (inQuotes) {
        row[row.length - 1] += char;
      } else {
        if (char === '\r' && next === '\n') i++;
        lines.push(row);
        row = [''];
      }
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  if (lines.length < 2) return [];
  const headers = lines[0].map(h => h.trim());
  return lines.slice(1).map(line => {
    const obj = {};
    headers.forEach((h, idx) => {
      const val = line[idx];
      obj[h] = val === '' ? null : val;
    });
    return obj;
  });
}

const TABLES = [
  'orders', 'order_items', 'customers', 'products', 'categories', 'invoices',
  'payments', 'expenses', 'suppliers', 'shipments', 'inventory_movements',
  'quick_bills_physical', 'quick_bill_physical_items', 'quick_bills_digital',
  'quick_bill_digital_items', 'quotations', 'quotation_items', 'digital_invoices',
  'digital_invoice_items', 'bulk_order_batches', 'raw_materials', 'users',
  'company_settings', 'activity_log', 'change_requests', 'backup_history'
];

// GET: Download backup zip
router.get('/download', authenticate, requireAdmin, async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `OliveSeeds_Backup_${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => {
      console.error('Archive error:', err);
    });
    archive.pipe(res);

    let totalRecords = 0;
    const counts = {};

    for (const table of TABLES) {
      try {
        const [rows] = await db.query(`SELECT * FROM \`${table}\``);
        counts[table] = rows.length;
        totalRecords += rows.length;
        if (rows.length > 0) {
          const csv = arrayToCSV(rows);
          archive.append('\uFEFF' + csv, { name: `${table}.csv` });
        } else {
          archive.append('', { name: `${table}.csv` });
        }
      } catch (e) {
        console.log(`Skip table ${table}: ${e.message}`);
        archive.append(`# Table ${table} not available\n`, { name: `${table}.csv` });
      }
    }

    const [[settings]] = await db.query('SELECT * FROM company_settings LIMIT 1');
    archive.append(JSON.stringify(settings || {}, null, 2), { name: 'settings.json' });

    const info = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      tables_count: TABLES.length,
      records: counts,
      generated_by: req.user.name || 'System'
    };
    archive.append(JSON.stringify(info, null, 2), { name: 'backup_info.json' });

    // Log to history
    await db.query(
      'INSERT INTO backup_history (backup_type, file_size, records_count, location, status) VALUES (?,?,?,?,?)',
      ['Manual', 'N/A', totalRecords, 'Local Download', 'Success']
    );

    await archive.finalize();
  } catch (err) {
    console.error('Backup error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Backup failed: ' + err.message });
    }
  }
});

// POST: Restore database from zip
router.post('/restore', authenticate, requireAdmin, upload.single('backup'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No backup file provided' });
  const conn = await db.getConnection();
  try {
    const zip = new AdmZip(req.file.path);
    const zipEntries = zip.getEntries();

    // Validate entries
    const fileNames = zipEntries.map(e => e.entryName);
    const requiredFiles = TABLES.map(t => `${t}.csv`);
    const missing = requiredFiles.filter(f => !fileNames.includes(f));
    if (missing.length > 0) {
      return res.status(400).json({ error: `Invalid backup. Missing files: ${missing.join(', ')}` });
    }

    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    const counts = {};
    for (const table of TABLES) {
      const entry = zip.getEntry(`${table}.csv`);
      const csvText = entry.getData().toString('utf8').replace(/^\uFEFF/, '');
      const rows = parseCSV(csvText);

      await conn.query(`TRUNCATE TABLE \`${table}\``);
      counts[table] = rows.length;

      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        const keysSql = headers.map(h => `\`${h}\``).join(',');
        const placeholders = headers.map(() => '?').join(',');

        for (const row of rows) {
          const values = headers.map(h => row[h]);
          await conn.query(`INSERT INTO \`${table}\` (${keysSql}) VALUES (${placeholders})`, values);
        }
      }
    }

    // Restore Settings
    const settingsEntry = zip.getEntry('settings.json');
    if (settingsEntry) {
      const settings = JSON.parse(settingsEntry.getData().toString('utf8'));
      if (settings && Object.keys(settings).length > 0) {
        await conn.query('TRUNCATE TABLE company_settings');
        const headers = Object.keys(settings);
        const keysSql = headers.map(h => `\`${h}\``).join(',');
        const placeholders = headers.map(() => '?').join(',');
        const values = headers.map(h => settings[h]);
        await conn.query(`INSERT INTO company_settings (${keysSql}) VALUES (${placeholders})`, values);
      }
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();

    // Log restore
    await db.query(
      'INSERT INTO backup_history (backup_type, file_size, records_count, location, status) VALUES (?,?,?,?,?)',
      ['Restore', 'N/A', 0, 'Local', 'Success']
    );

    res.json({ success: true, records: counts });
  } catch (err) {
    await conn.rollback();
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.error(err);
    res.status(500).json({ error: 'Error restoring data' });
  } finally {
    conn.release();
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

// GET: Backup history
router.get('/history', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM backup_history ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// GET: Status of latest backup
router.get('/status', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM backup_history ORDER BY created_at DESC LIMIT 1');
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// GET: Backup settings
router.get('/settings', authenticate, async (req, res) => {
  try {
    const [[s]] = await db.query('SELECT backup_frequency, backup_folder, keep_backups, google_drive_connected, google_drive_email FROM company_settings LIMIT 1');
    res.json(s || {});
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST: Save settings
router.post('/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { backup_frequency, backup_folder, keep_backups, google_drive_connected, google_drive_email } = req.body;
    await db.query(
      'UPDATE company_settings SET backup_frequency=?, backup_folder=?, keep_backups=?, google_drive_connected=?, google_drive_email=? WHERE id = 1',
      [
        backup_frequency || 'Weekly', 
        backup_folder || 'OliveSeeds ERP Backups', 
        keep_backups || 10,
        google_drive_connected === undefined ? false : !!google_drive_connected,
        google_drive_email || null
      ]
    );
    res.json({ message: 'Backup settings saved' });
  } catch (err) {
    res.status(500).json({ error: 'Error: ' + err.message });
  }
});

// POST: Google Auth
router.post('/google-auth', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query(
      'UPDATE company_settings SET google_drive_connected=true, google_drive_email="oliveseeds.oss@gmail.com" WHERE id = 1'
    );
    res.json({ connected: true, email: 'oliveseeds.oss@gmail.com' });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
