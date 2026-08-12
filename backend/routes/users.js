const router = require('express').Router();
const db = require('../utils/db');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sigDir = path.join(__dirname, '../uploads/signatures');
    if (!fs.existsSync(sigDir)) {
      fs.mkdirSync(sigDir, { recursive: true });
    }
    cb(null, sigDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `user_${req.params.id || req.user.id}_signature${ext}`);
  }
});
const upload = multer({ storage });

router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, user_id, name, email, role, phone, is_active, last_login, signature_path, created_at, updated_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM users');
    const userId = `USR${String(count + 1).padStart(3, '0')}`;
    const { name, email, password, role, phone } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const [r] = await db.query('INSERT INTO users (user_id, name, email, password, role, phone) VALUES (?,?,?,?,?,?)', [userId, name, email, hashed, role || 'viewer', phone]);
    res.json({ id: r.insertId, user_id: userId });
  } catch (e) {
    res.status(500).json({ error: e.code === 'ER_DUP_ENTRY' ? 'Email already exists' : 'Error' });
  }
});

// Single signature upload route for user signature
router.post('/:id/signature', authenticate, upload.single('signature'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No signature file provided' });
    const signaturePath = `/uploads/signatures/${req.file.filename}`;
    await db.query('UPDATE users SET signature_path = ? WHERE id = ?', [signaturePath, req.params.id]);
    res.json({ signature_path: signaturePath });
  } catch (e) {
    res.status(500).json({ error: 'Error saving user signature' });
  }
});

router.put('/:id', authenticate, requireAdmin, upload.single('signature'), async (req, res) => {
  try {
    const [[userToEdit]] = await db.query('SELECT user_id FROM users WHERE id = ?', [req.params.id]);
    if (!userToEdit) return res.status(404).json({ error: 'User not found' });
    if (['USR001', 'USR002', 'USR003'].includes(userToEdit.user_id)) {
      return res.status(403).json({ error: 'System default users cannot be edited or deactivated' });
    }

    const { name, role, phone, is_active, password } = req.body;
    let signaturePath = req.body.signature_path;

    if (req.file) {
      signaturePath = `/uploads/signatures/${req.file.filename}`;
    } else if (req.body.remove_signature === 'true') {
      const [[user]] = await db.query('SELECT signature_path FROM users WHERE id=?', [req.params.id]);
      if (user && user.signature_path) {
        const oldFile = path.join(__dirname, '..', user.signature_path);
        if (fs.existsSync(oldFile)) {
          try { fs.unlinkSync(oldFile); } catch (e) {}
        }
      }
      signaturePath = null;
    }

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET name=?, role=?, phone=?, is_active=?, password=?, signature_path=? WHERE id=?', [name, role, phone, is_active, hashed, signaturePath, req.params.id]);
    } else {
      await db.query('UPDATE users SET name=?, role=?, phone=?, is_active=?, signature_path=? WHERE id=?', [name, role, phone, is_active, signaturePath, req.params.id]);
    }
    res.json({ message: 'User updated', signature_path: signaturePath });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error' });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const [[userToDelete]] = await db.query('SELECT user_id FROM users WHERE id = ?', [req.params.id]);
    if (!userToDelete) return res.status(404).json({ error: 'User not found' });
    if (['USR001', 'USR002', 'USR003'].includes(userToDelete.user_id)) {
      return res.status(403).json({ error: 'System default users cannot be edited or deactivated' });
    }

    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await db.query('UPDATE users SET is_active=0 WHERE id=?', [req.params.id]);
    res.json({ message: 'User deactivated' });
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
