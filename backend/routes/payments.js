const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { from, to, method, page = 1, limit = 50 } = req.query;
    let q = `
      SELECT p.*, c.name as customer_name, i.invoice_number, o.order_id as order_reference, u.name as created_by_name
      FROM payments p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN orders o ON p.order_id = o.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (from) { q += ' AND p.payment_date>=?'; params.push(from); }
    if (to) { q += ' AND p.payment_date<=?'; params.push(to); }
    if (method) { q += ' AND p.payment_method=?'; params.push(method); }
    q += ` ORDER BY p.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${(parseInt(page) - 1) * parseInt(limit)}`;
    const [payments] = await db.query(q, params);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM payments');
    res.json({ payments, total });
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/refund', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { payment_id, amount, reason } = req.body;
    const [pays] = await conn.query('SELECT * FROM payments WHERE payment_id=?', [payment_id]);
    if (!pays.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Payment not found' });
    }
    const refundId = `REF${Date.now()}`;
    await conn.query(`
      INSERT INTO payments (
        payment_id, invoice_id, order_id, customer_id, amount, payment_method, payment_date,
        status, notes, created_by
      ) VALUES (?,?,?,?,?,?,CURDATE(),"refunded",?,?)
    `, [
      refundId, pays[0].invoice_id, pays[0].order_id, pays[0].customer_id,
      -Math.abs(amount), pays[0].payment_method, reason, req.user.id
    ]);

    if (pays[0].invoice_id) {
      const [[inv]] = await conn.query('SELECT total, paid_amount FROM invoices WHERE id=?', [pays[0].invoice_id]);
      if (inv) {
        const newPaid = Math.max(0, parseFloat(inv.paid_amount || 0) - Math.abs(amount));
        const newStatus = newPaid >= parseFloat(inv.total) ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
        await conn.query('UPDATE invoices SET paid_amount = ?, payment_status = ? WHERE id = ?', [newPaid, newStatus, pays[0].invoice_id]);
      }
    }
    if (pays[0].order_id) {
      const [[ord]] = await conn.query('SELECT total, paid_amount FROM orders WHERE id=?', [pays[0].order_id]);
      if (ord) {
         const newPaid = Math.max(0, parseFloat(ord.paid_amount || 0) - Math.abs(amount));
         const newStatus = newPaid >= parseFloat(ord.total) ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
         await conn.query('UPDATE orders SET paid_amount=?, payment_status=?, balance_due=total-? WHERE id=?', [newPaid, newStatus, newPaid, pays[0].order_id]);
      }
    }

    await conn.commit();
    res.json({ message: 'Refund recorded', refund_id: refundId });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: 'Error' });
  } finally {
    conn.release();
  }
});

router.post('/', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      invoice_id, order_id, customer_id, amount, amount_paid, currency, payment_method, payment_mode,
      transaction_id, transaction_reference, payment_date, status, notes, bank_name, cheque_number, clearing_date
    } = req.body;

    const amountVal = amount !== undefined ? amount : amount_paid;
    const methodVal = payment_method || payment_mode || 'cash';
    const txVal = transaction_id || transaction_reference || null;

    const [[{ cnt }]] = await conn.query('SELECT COUNT(*) as cnt FROM payments');
    const payment_id = `PAY${String(cnt + 1).padStart(5, '0')}`;

    const [result] = await conn.query(`
      INSERT INTO payments (
        payment_id, invoice_id, order_id, customer_id, amount, currency, payment_method,
        transaction_id, payment_date, status, notes, created_by, bank_name, cheque_number,
        clearing_date
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      payment_id, invoice_id || null, order_id || null, customer_id || null, amountVal, currency || 'INR',
      methodVal, txVal, payment_date || new Date().toISOString().split('T')[0],
      status || 'completed', notes || null, req.user.id, bank_name || null, cheque_number || null,
      clearing_date || null
    ]);

    // Update invoice paid_amount and payment_status
    if (invoice_id) {
      const [[inv]] = await conn.query('SELECT total, paid_amount FROM invoices WHERE id = ?', [invoice_id]);
      if (inv) {
        const newPaid = parseFloat(inv.paid_amount || 0) + parseFloat(amountVal);
        const newStatus = newPaid >= parseFloat(inv.total) ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
        await conn.query('UPDATE invoices SET paid_amount = ?, payment_status = ? WHERE id = ?', [newPaid, newStatus, invoice_id]);

        // Update linked order
        if (order_id) {
          await conn.query('UPDATE orders SET payment_status = ?, paid_amount = ?, balance_due = total - ? WHERE id = ?', [newStatus, newPaid, newPaid, order_id]);
        }
      }
    }

    await conn.commit();
    res.json({ id: result.insertId, payment_id, message: 'Payment recorded successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('Payment error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Hard Delete Route (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM payments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Error deleting payment' });
  }
});

module.exports = router;
