const router = require('express').Router();
const db = require('../utils/db');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, user_id, name, email, role, phone, is_active, last_login, created_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const [[{count}]] = await db.query('SELECT COUNT(*) as count FROM users');
    const userId = `USR${String(count+1).padStart(3,'0')}`;
    const { name, email, password, role, phone } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const [r] = await db.query('INSERT INTO users (user_id, name, email, password, role, phone) VALUES (?,?,?,?,?,?)',
      [userId, name, email, hashed, role||'viewer', phone]);
    res.json({ id: r.insertId, user_id: userId });
  } catch(e) { res.status(500).json({ error: e.code==='ER_DUP_ENTRY'?'Email already exists':'Error' }); }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, role, phone, is_active, password } = req.body;
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET name=?, role=?, phone=?, is_active=?, password=? WHERE id=?', [name, role, phone, is_active, hashed, req.params.id]);
    } else {
      await db.query('UPDATE users SET name=?, role=?, phone=?, is_active=? WHERE id=?', [name, role, phone, is_active, req.params.id]);
    }
    res.json({ message:'User updated' });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error:'Cannot delete yourself' });
    await db.query('UPDATE users SET is_active=0 WHERE id=?', [req.params.id]);
    res.json({ message:'User deactivated' });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

module.exports = router;
