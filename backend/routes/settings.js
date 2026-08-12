const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const compDir = path.join(__dirname, '../uploads/company');
    if (!fs.existsSync(compDir)) {
      fs.mkdirSync(compDir, { recursive: true });
    }
    cb(null, compDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const prefix = file.fieldname === 'logo' ? 'logo' : 'signature';
    cb(null, `${prefix}${ext}`);
  }
});
const upload = multer({ storage });

router.get('/', authenticate, async (req, res) => {
  try {
    const [[s]] = await db.query('SELECT * FROM company_settings LIMIT 1');
    res.json(s || {});
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

router.put('/', authenticate, requireAdmin, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), async (req, res) => {
  try {
    const fields = [
      'company_name', 'gstin', 'pan', 'iec', 'email', 'phone',
      'address', 'city', 'state', 'pincode', 'country',
      'invoice_prefix', 'invoice_counter', 'currency', 'bank_name',
      'bank_account', 'bank_ifsc', 'bank_branch', 'upi_id',
      'terms_conditions', 'invoice_footer', 'backup_frequency',
      'backup_folder', 'keep_backups', 'google_drive_connected',
      'google_drive_email'
    ];
    const updatesList = [];
    const values = [];

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updatesList.push(`${f}=?`);
        values.push(req.body[f]);
      }
    });

    if (req.files) {
      if (req.files.logo && req.files.logo[0]) {
        const file = req.files.logo[0];
        updatesList.push('logo_path=?');
        values.push(`/uploads/company/${file.filename}`);
      }
      if (req.files.signature && req.files.signature[0]) {
        const file = req.files.signature[0];
        updatesList.push('default_signature_path=?');
        values.push(`/uploads/company/${file.filename}`);
      }
    }

    if (req.body.remove_logo === 'true') {
      updatesList.push('logo_path=?');
      values.push(null);
    }
    if (req.body.remove_signature === 'true') {
      updatesList.push('default_signature_path=?');
      values.push(null);
    }

    if (updatesList.length > 0) {
      await db.query(`UPDATE company_settings SET ${updatesList.join(',')} WHERE id = 1`, values);
    }
    res.json({ message: 'Settings saved' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error' });
  }
});

// Explicit signature upload route
router.post('/signature', authenticate, requireAdmin, upload.single('signature'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No signature file provided' });
    const signaturePath = `/uploads/company/${req.file.filename}`;
    await db.query('UPDATE company_settings SET default_signature_path = ? WHERE id = 1', [signaturePath]);
    res.json({ default_signature_path: signaturePath });
  } catch (e) {
    res.status(500).json({ error: 'Error saving default signature' });
  }
});

// Explicit logo upload route
router.post('/logo', authenticate, requireAdmin, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No logo file provided' });
    const logoPath = `/uploads/company/${req.file.filename}`;
    await db.query('UPDATE company_settings SET logo_path = ? WHERE id = 1', [logoPath]);
    res.json({ logo_path: logoPath });
  } catch (e) {
    res.status(500).json({ error: 'Error saving company logo' });
  }
});

module.exports = router;
