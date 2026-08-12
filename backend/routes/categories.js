const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM categories ORDER BY name ASC'
    );
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, type, description, parent_id } = req.body;
    const [r] = await db.query(
      'INSERT INTO categories (name, type, description, parent_id) VALUES (?,?,?,?)',
      [name, type || 'physical', description || null, parent_id || null]
    );
    res.json({ id: r.insertId, message: 'Category created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, type, description } = req.body;
    await db.query(
      'UPDATE categories SET name=?, type=?, description=? WHERE id=?',
      [name, type, description, req.params.id]
    );
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM categories WHERE id=?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
