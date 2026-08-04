const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite, canModify } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { from, to, category } = req.query;
    let q = 'SELECT * FROM expenses WHERE 1=1';
    const p = [];
    if (from) { q+=' AND expense_date>=?'; p.push(from); }
    if (to) { q+=' AND expense_date<=?'; p.push(to); }
    if (category) { q+=' AND category=?'; p.push(category); }
    q+=' ORDER BY expense_date DESC';
    const [rows] = await db.query(q, p);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.post('/', authenticate, canWrite, async (req, res) => {
  try {
    const [[{count}]] = await db.query('SELECT COUNT(*) as count FROM expenses');
    const expId = `EXP${String(count+1).padStart(5,'0')}`;
    const { category, description, amount, gst_amount, expense_date, payment_method, vendor } = req.body;
    const [r] = await db.query('INSERT INTO expenses (expense_id, category, description, amount, gst_amount, expense_date, payment_method, vendor, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [expId, category, description, amount, gst_amount||0, expense_date, payment_method, vendor, req.user.id]);
    res.json({ id: r.insertId, expense_id: expId });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.delete('/:id', authenticate, canModify, async (req, res) => {
  try {
    await db.query('DELETE FROM expenses WHERE id=?', [req.params.id]);
    res.json({ message:'Deleted' });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

module.exports = router;
