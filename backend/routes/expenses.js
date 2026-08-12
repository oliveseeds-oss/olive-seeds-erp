const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite, canModify, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { from, to, category } = req.query;
    let q = 'SELECT * FROM expenses WHERE 1=1';
    const p = [];
    if (from) { q += ' AND expense_date>=?'; p.push(from); }
    if (to) { q += ' AND expense_date<=?'; p.push(to); }
    if (category) { q += ' AND category=?'; p.push(category); }
    q += ' ORDER BY expense_date DESC';
    const [rows] = await db.query(q, p);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const [[row]] = await db.query('SELECT * FROM expenses WHERE id=?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Expense not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/', authenticate, canWrite, async (req, res) => {
  try {
    const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM expenses');
    const expId = `EXP${String(count + 1).padStart(5, '0')}`;
    const { category, description, amount, gst_amount, gst_percent, expense_date, payment_method, vendor, reference_number, receipt_path, receipt_image_url } = req.body;
    const [r] = await db.query(
      `INSERT INTO expenses (
        expense_id, category, description, amount, gst_amount, gst_percent, expense_date,
        payment_method, vendor, reference_number, receipt_path, receipt_image_url, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        expId, category || null, description || null, amount || 0, gst_amount || 0, gst_percent || 0,
        expense_date || null, payment_method || null, vendor || null, reference_number || null,
        receipt_path || null, receipt_image_url || null, req.user.id
      ]
    );
    res.json({ id: r.insertId, expense_id: expId });
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

router.put('/:id', authenticate, canModify, async (req, res) => {
  try {
    const { category, description, amount, gst_amount, gst_percent, expense_date, payment_method, vendor, reference_number, receipt_path, receipt_image_url } = req.body;
    await db.query(
      `UPDATE expenses SET
        category = ?, description = ?, amount = ?, gst_amount = ?, gst_percent = ?,
        expense_date = ?, payment_method = ?, vendor = ?, reference_number = ?, receipt_path = ?, receipt_image_url = ?
      WHERE id = ?`,
      [category, description, amount, gst_amount || 0, gst_percent || 0, expense_date, payment_method, vendor, reference_number, receipt_path || null, receipt_image_url || null, req.params.id]
    );
    res.json({ message: 'Expense updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error updating expense: ' + e.message });
  }
});

// Hard Delete Route (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM expenses WHERE id=?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
