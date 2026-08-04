const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { from, to, method, page=1, limit=50 } = req.query;
    let q = 'SELECT p.*, c.name as customer_name FROM payments p LEFT JOIN customers c ON p.customer_id=c.id WHERE 1=1';
    const params = [];
    if (from) { q+=' AND p.payment_date>=?'; params.push(from); }
    if (to) { q+=' AND p.payment_date<=?'; params.push(to); }
    if (method) { q+=' AND p.payment_method=?'; params.push(method); }
    q+=` ORDER BY p.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${(parseInt(page)-1)*parseInt(limit)}`;
    const [payments] = await db.query(q, params);
    const [[{total}]] = await db.query('SELECT COUNT(*) as total FROM payments');
    res.json({ payments, total });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.post('/refund', authenticate, canWrite, async (req, res) => {
  try {
    const { payment_id, amount, reason } = req.body;
    const [pays] = await db.query('SELECT * FROM payments WHERE payment_id=?', [payment_id]);
    if (!pays.length) return res.status(404).json({ error:'Payment not found' });
    const refundId = `REF${Date.now()}`;
    await db.query('INSERT INTO payments (payment_id, invoice_id, order_id, customer_id, amount, payment_method, payment_date, status, notes, created_by) VALUES (?,?,?,?,?,?,CURDATE(),"refunded",?,?)',
      [refundId, pays[0].invoice_id, pays[0].order_id, pays[0].customer_id, -Math.abs(amount), pays[0].payment_method, reason, req.user.id]);
    res.json({ message:'Refund recorded', refund_id: refundId });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

module.exports = router;
