const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const archiverModule = require('archiver');
const createZipArchive = (options) => {
  if (archiverModule.ZipArchive) {
    return new archiverModule.ZipArchive(options);
  } else if (typeof archiverModule === 'function') {
    return archiverModule('zip', options);
  } else if (archiverModule.default && typeof archiverModule.default === 'function') {
    return archiverModule.default('zip', options);
  } else {
    throw new Error('Unsupported archiver module exports');
  }
};
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const stream = require('stream');

// ── HELPER: Create OAuth2 Client ─────────────────────────
function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Google Drive not configured. ' +
      'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ' +
      'GOOGLE_REDIRECT_URI in your .env file.'
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ── HELPER: Get stored tokens from DB ───────────────────
async function getStoredTokens() {
  try {
    const [[settings]] = await db.query(
      'SELECT google_tokens FROM company_settings LIMIT 1'
    );
    if (settings && settings.google_tokens) {
      return JSON.parse(settings.google_tokens);
    }
    return null;
  } catch (err) {
    console.error('Get tokens error:', err.message);
    return null;
  }
}

// ── HELPER: Save tokens to DB ────────────────────────────
async function saveTokens(tokens) {
  await db.query(
    'UPDATE company_settings SET google_tokens = ?',
    [JSON.stringify(tokens)]
  );
}

// ── HELPER: Get authenticated Drive client ───────────────
async function getDriveClient() {
  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error('Google Drive not connected. Please connect first.');
  }
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials(tokens);
  // Auto-refresh token if expired
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await saveTokens(credentials);
      oauth2Client.setCredentials(credentials);
    } catch (refreshErr) {
      throw new Error('Google Drive token expired. Please reconnect.');
    }
  }
  // Listen for token refresh
  oauth2Client.on('tokens', async (newTokens) => {
    try {
      const current = await getStoredTokens();
      const merged = { ...current, ...newTokens };
      await saveTokens(merged);
    } catch {}
  });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

// ── HELPER: Generate backup ZIP buffer ──────────────────
async function generateBackupBuffer() {
  return new Promise(async (resolve, reject) => {
    const archive = createZipArchive({ zlib: { level: 6 } });
    const buffers = [];
    archive.on('data', chunk => buffers.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(buffers)));
    archive.on('error', reject);
    
    // Pipe archive output to nothing, just to consume it so 'end' fires
    const writable = new stream.Writable({
      write(chunk, encoding, callback) {
        callback();
      }
    });
    archive.pipe(writable);

    const tables = [
      'users', 'company_settings', 'categories',
      'customers', 'products', 'suppliers',
      'orders', 'order_items',
      'invoices', 'invoice_items',
      'quotations', 'quotation_items',
      'digital_invoices', 'digital_invoice_items',
      'payments', 'expenses', 'shipments',
      'inventory_movements', 'raw_materials',
      'quick_bills_physical', 'quick_bill_physical_items',
      'quick_bills_digital', 'quick_bill_digital_items',
      'bulk_order_batches', 'change_requests', 'activity_log'
    ];
    const recordCounts = {};
    for (const table of tables) {
      try {
        const [rows] = await db.query(
          `SELECT * FROM \`${table}\``
        );
        recordCounts[table] = rows.length;
        if (rows.length > 0) {
          const headers = Object.keys(rows[0]).join(',');
          const csvRows = rows.map(row =>
            Object.values(row).map(val => {
              if (val === null || val === undefined) return '';
              const s = String(val);
              return (s.includes(',') || s.includes('"') || s.includes('\n'))
                ? `"${s.replace(/"/g, '""')}"` : s;
            }).join(',')
          );
          const csv = '\uFEFF' + [headers, ...csvRows].join('\n');
          archive.append(Buffer.from(csv, 'utf8'), { name: `${table}.csv` });
        } else {
          archive.append('', { name: `${table}.csv` });
        }
      } catch {
        // Table may not exist — skip
      }
    }
    const info = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      record_counts: recordCounts
    };
    archive.append(
      JSON.stringify(info, null, 2),
      { name: 'backup_info.json' }
    );
    archive.finalize();
  });
}


// ── HELPER: Save backup to history ──────────────────────
async function saveBackupHistory(filename, type, size, status, location, userId) {
  try {
    await db.query(`
      INSERT INTO backup_history 
      (filename, type, file_size, status, location, created_by)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [filename, type, size, status, location || '', userId || null]
    );
  } catch {}
}

// ════════════════════════════════════════════════════════
// ROUTE 1: GET /api/backup/google-auth-url
// Frontend calls this to get the Google login URL
// ════════════════════════════════════════════════════════
router.get('/google-auth-url', authenticate, requireAdmin, (req, res) => {
  try {
    const oauth2Client = createOAuthClient();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    });
    res.json({ url });
  } catch (err) {
    console.error('Auth URL error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
// ROUTE 2: GET /api/backup/google-callback
// Google redirects here after user approves access
// This must close the popup and send message to parent
// ════════════════════════════════════════════════════════
router.get('/google-callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.send(`
      <html><body>
      <script>
        window.opener && window.opener.postMessage(
          { type: 'GOOGLE_AUTH_ERROR', error: '${error}' },
          '*'
        );
        setTimeout(() => window.close(), 1000);
      </script>
      <p>Authorization failed: ${error}</p>
      <p>This window will close automatically.</p>
      </body></html>
    `);
  }
  if (!code) {
    return res.send(`
      <html><body>
      <script>
        window.opener && window.opener.postMessage(
          { type: 'GOOGLE_AUTH_ERROR', error: 'No authorization code received' },
          '*'
        );
        setTimeout(() => window.close(), 1000);
      </script>
      <p>No authorization code received.</p>
      </body></html>
    `);
  }
  try {
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    // Save tokens to database
    await saveTokens(tokens);
    // Get user email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email;
    // Save connected email
    try {
      await db.query(
        'UPDATE company_settings SET google_drive_email = ?',
        [userEmail]
      );
    } catch {}
    // Send success to parent window and close popup
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Google Drive Connected</title></head>
      <body>
        <div style="
          font-family: Arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #f0fdf4;
          text-align: center;
          padding: 20px;
        ">
          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
          <h2 style="color: #166534; margin-bottom: 8px;">Connected!</h2>
          <p style="color: #374151; margin-bottom: 4px;">
            Google Drive connected as:
          </p>
          <p style="font-weight: bold; color: #1a1a2e; margin-bottom: 16px;">
            ${userEmail}
          </p>
          <p style="color: #6b7280; font-size: 14px;">
            This window will close automatically...
          </p>
        </div>
        <script>
          // Send success message to parent window
          if (window.opener) {
            window.opener.postMessage(
              {
                type: 'GOOGLE_AUTH_SUCCESS',
                email: '${userEmail}'
              },
              '*'
            );
          }
          // Close popup after short delay
          setTimeout(function() {
            window.close();
          }, 2000);
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Google callback error:', err.message);
    res.send(`
      <html><body>
      <script>
        window.opener && window.opener.postMessage(
          {
            type: 'GOOGLE_AUTH_ERROR',
            error: '${err.message.replace(/'/g, "\\'")}'
          },
          '*'
        );
        setTimeout(() => window.close(), 2000);
      </script>
      <div style="text-align:center;padding:40px;font-family:Arial">
        <p style="color:red;font-size:18px">Connection failed</p>
        <p>${err.message}</p>
      </div>
      </body></html>
    `);
  }
});

// ════════════════════════════════════════════════════════
// ROUTE 3: GET /api/backup/google-status
// Check if Google Drive is connected
// ════════════════════════════════════════════════════════
router.get('/google-status', authenticate, async (req, res) => {
  try {
    const tokens = await getStoredTokens();
    const [[settings]] = await db.query(
      'SELECT google_drive_email FROM company_settings LIMIT 1'
    );
    if (!tokens) {
      return res.json({
        connected: false,
        email: null,
        message: 'Not connected'
      });
    }
    // Test if token still works
    try {
      const oauth2Client = createOAuthClient();
      oauth2Client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      await drive.about.get({ fields: 'user' });
      res.json({
        connected: true,
        email: settings?.google_drive_email || 'Connected',
        message: 'Google Drive connected'
      });
    } catch {
      res.json({
        connected: false,
        email: null,
        message: 'Token expired — please reconnect'
      });
    }
  } catch (err) {
    res.json({ connected: false, email: null, message: err.message });
  }
});

// ════════════════════════════════════════════════════════
// ROUTE 4: POST /api/backup/google-disconnect
// Disconnect Google Drive
// ════════════════════════════════════════════════════════
router.post('/google-disconnect', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query(
      'UPDATE company_settings SET google_tokens = NULL, google_drive_email = NULL'
    );
    res.json({ message: 'Google Drive disconnected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
// ROUTE 5: GET /api/backup/download
// Download backup as ZIP to browser
// ════════════════════════════════════════════════════════
router.get('/download', authenticate, requireAdmin, async (req, res) => {
  try {
    const timestamp = new Date().toISOString()
      .slice(0, 19).replace(/[:.]/g, '-');
    const filename = `OliveSeeds_Backup_${timestamp}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.setHeader('Cache-Control', 'no-cache');
    const archive = createZipArchive({ zlib: { level: 6 } });
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });
    archive.pipe(res);
    const tables = [
      'users', 'company_settings', 'categories',
      'customers', 'products', 'suppliers',
      'orders', 'order_items',
      'invoices', 'invoice_items',
      'quotations', 'quotation_items',
      'digital_invoices', 'digital_invoice_items',
      'payments', 'expenses', 'shipments',
      'inventory_movements', 'raw_materials',
      'quick_bills_physical', 'quick_bill_physical_items',
      'quick_bills_digital', 'quick_bill_digital_items',
      'bulk_order_batches', 'change_requests'
    ];
    const recordCounts = {};
    for (const table of tables) {
      try {
        const [rows] = await db.query(`SELECT * FROM \`${table}\``);
        recordCounts[table] = rows.length;
        if (rows.length > 0) {
          const headers = Object.keys(rows[0]).join(',');
          const csvRows = rows.map(row =>
            Object.values(row).map(val => {
              if (val === null || val === undefined) return '';
              const s = String(val);
              return (s.includes(',') || s.includes('"') || s.includes('\n'))
                ? `"${s.replace(/"/g, '""')}"` : s;
            }).join(',')
          );
          const csv = '\uFEFF' + [headers, ...csvRows].join('\n');
          archive.append(Buffer.from(csv, 'utf8'), { name: `${table}.csv` });
        } else {
          archive.append('', { name: `${table}.csv` });
        }
      } catch {
        // table may not exist
      }
    }
    const info = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      record_counts: recordCounts
    };
    archive.append(JSON.stringify(info, null, 2), { name: 'backup_info.json' });
    archive.finalize();
    res.on('finish', async () => {
      await saveBackupHistory(filename, 'manual', 'N/A', 'success', 'local', req.user.id);
    });
  } catch (err) {
    console.error('Download backup error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// ════════════════════════════════════════════════════════
// ROUTE 6: POST /api/backup/google-save
// Upload backup to Google Drive
// ════════════════════════════════════════════════════════
router.post('/google-save', authenticate, requireAdmin, async (req, res) => {
  try {
    const drive = await getDriveClient();
    const timestamp = new Date().toISOString()
      .slice(0, 19).replace(/[:.]/g, '-');
    const filename = `OliveSeeds_Backup_${timestamp}.zip`;
    // Generate backup buffer
    const buffer = await generateBackupBuffer();
    // Get or create backup folder in Drive
    let folderId = null;
    const folderName = req.body.folderName || 'OliveSeeds ERP Backups';
    const folderSearch = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)'
    });
    if (folderSearch.data.files.length > 0) {
      folderId = folderSearch.data.files[0].id;
    } else {
      // Create folder
      const folder = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      folderId = folder.data.id;
    }
    // Upload file to Drive
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);
    const driveFile = await drive.files.create({
      requestBody: {
        name: filename,
        parents: folderId ? [folderId] : []
      },
      media: {
        mimeType: 'application/zip',
        body: bufferStream
      },
      fields: 'id, name, size, webViewLink'
    });
    const fileInfo = driveFile.data;
    const sizeKB = Math.round(buffer.length / 1024) + ' KB';
    const webLink = fileInfo.webViewLink || '';
    await saveBackupHistory(
      filename, 'google_drive', sizeKB, 'success',
      webLink, req.user.id
    );
    // Delete old backups if more than 10 exist
    try {
      const oldFiles = await drive.files.list({
        q: `name contains 'OliveSeeds_Backup' and '${folderId}' in parents and trashed=false`,
        orderBy: 'createdTime',
        fields: 'files(id, name, createdTime)'
      });
      const files = oldFiles.data.files;
      if (files.length > 10) {
        const toDelete = files.slice(0, files.length - 10);
        for (const f of toDelete) {
          await drive.files.delete({ fileId: f.id });
        }
      }
    } catch {}
    res.json({
      success: true,
      filename,
      size: sizeKB,
      drive_file_id: fileInfo.id,
      web_link: webLink,
      message: `Backup uploaded to Google Drive: ${filename}`
    });
  } catch (err) {
    console.error('Google Drive upload error:', err.message);
    await saveBackupHistory(
      'failed', 'google_drive', '0', 'failed',
      err.message, req.user?.id
    ).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
// ROUTE 7: GET /api/backup/history
// Get backup history
// ════════════════════════════════════════════════════════
router.get('/history', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT bh.*, u.name as created_by_name
      FROM backup_history bh
      LEFT JOIN users u ON bh.created_by = u.id
      ORDER BY bh.created_at DESC
      LIMIT 50
    `);
    res.json(rows || []);
  } catch (err) {
    res.json([]);
  }
});

// ════════════════════════════════════════════════════════
// ROUTE 8: GET /api/backup/settings
// GET /api/backup/settings — get backup config
// POST /api/backup/settings — save backup config
// ════════════════════════════════════════════════════════
router.get('/settings', authenticate, async (req, res) => {
  try {
    const [[s]] = await db.query(
      'SELECT backup_frequency, backup_keep_count, google_drive_email, google_drive_folder FROM company_settings LIMIT 1'
    );
    res.json({
      frequency: s?.backup_frequency || 'manual',
      keep_count: s?.backup_keep_count || 10,
      google_drive_email: s?.google_drive_email || null,
      google_drive_folder: s?.google_drive_folder || 'OliveSeeds ERP Backups',
      connected: !!(s?.google_drive_email)
    });
  } catch (err) {
    res.json({
      frequency: 'manual', keep_count: 10,
      google_drive_email: null, connected: false
    });
  }
});

router.post('/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { frequency, keep_count, google_drive_folder } = req.body;
    await db.query(`
      UPDATE company_settings SET
        backup_frequency = ?,
        backup_keep_count = ?,
        google_drive_folder = ?`,
      [frequency || 'manual', keep_count || 10, google_drive_folder || 'OliveSeeds ERP Backups']
    );
    res.json({ message: 'Backup settings saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
